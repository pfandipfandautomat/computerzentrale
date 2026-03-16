import { Client } from 'ssh2';
import { monitoringController } from '../controllers/monitoringController.js';
import { cacheService } from './cacheService.js';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { getModelConfig, isKnownModel, getKnownModels, getCompatibleModels } from './modelConfigs.js';

export type GPUVendor = 'nvidia' | 'amd' | 'unknown';

export interface GPUInfo {
  id: number;
  name: string;
  memory: string;
  memoryUsed?: number;
  memoryTotal?: number;
  utilization?: number;
  vendor: GPUVendor;
}

export interface GPUModel {
  name: string;
  model: string;
  port: number;
  gpuIds: number[];
  status: 'running' | 'starting' | 'stopped' | 'error';
  pid?: number;
}

export interface GPUPodStatus {
  nodeId: string;
  nodeName: string;
  host: string;
  port: number;
  sshUser: string;
  gpus: GPUInfo[];
  models: GPUModel[];
  modelsPath?: string;
  isOnline: boolean;
  lastChecked?: string;
}

export interface GPUClusterStatus {
  pods: GPUPodStatus[];
  totalGpus: number;
  availableGpus: number;
  runningModels: number;
}

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

/**
 * Strip CIDR notation from hostname
 */
function stripCidr(host: string): string {
  return host.split('/')[0];
}

class GPUService {
  /**
   * Execute a command via SSH
   */
  private async executeCommand(config: SSHConnectionConfig, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      let errorOutput = '';

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          stream.on('close', (code: number) => {
            conn.end();
            if (code === 0) {
              resolve(output.trim());
            } else {
              // For some commands, non-zero exit is okay (e.g., no processes found)
              resolve(output.trim());
            }
          });

          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        reject(err);
      });

      conn.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey: config.privateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Get GPU information from a host using nvidia-smi or rocm-smi
   */
  async getGPUInfo(host: string, port: number = 22, username: string = 'root'): Promise<GPUInfo[]> {
    const cleanHost = stripCidr(host);
    
    // Check cache first
    const cacheKey = `gpu:info:${cleanHost}:${port}`;
    const cached = await cacheService.get<GPUInfo[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host: cleanHost,
      port,
      username,
      privateKey,
    };

    try {
      // Try NVIDIA first, then AMD
      const command = `
        if command -v nvidia-smi &> /dev/null; then
          echo "VENDOR:nvidia"
          nvidia-smi --query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader,nounits 2>/dev/null
        elif command -v rocm-smi &> /dev/null; then
          echo "VENDOR:amd"
          rocm-smi --showid --showproductname --showmeminfo vram --showuse --csv 2>/dev/null | tail -n +2
        else
          echo "NO_GPU"
        fi
      `;
      const output = await this.executeCommand(config, command);
      
      if (!output || output.trim() === 'NO_GPU') {
        return [];
      }

      const lines = output.split('\n').filter(line => line.trim());
      const gpus: GPUInfo[] = [];
      
      // Detect vendor from first line
      const vendorLine = lines.find(l => l.startsWith('VENDOR:'));
      const vendor: GPUVendor = vendorLine?.includes('nvidia') ? 'nvidia' : 
                                vendorLine?.includes('amd') ? 'amd' : 'unknown';
      
      // Parse based on vendor
      const dataLines = lines.filter(l => !l.startsWith('VENDOR:'));
      
      if (vendor === 'nvidia') {
        for (const line of dataLines) {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length < 6) continue;
          
          const memTotal = parseInt(parts[2], 10) || 0;
          const memUsed = parseInt(parts[3], 10) || 0;
          
          gpus.push({
            id: parseInt(parts[0], 10) || 0,
            name: parts[1] || 'Unknown GPU',
            memory: `${memTotal} MiB`,
            memoryTotal: memTotal,
            memoryUsed: memUsed,
            utilization: parseInt(parts[5], 10) || 0,
            vendor: 'nvidia',
          });
        }
      } else if (vendor === 'amd') {
        // rocm-smi CSV format varies, parse what we can
        // Format: device,Card series,Card model,Card vendor,Card SKU,Subsystem ID,Device Rev,Node ID,GUID,GFX Version,VRAM Total Memory (B),VRAM Total Used Memory (B),GPU use (%)
        for (const line of dataLines) {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length < 3) continue;
          
          // Try to extract GPU ID from first column
          const idMatch = parts[0].match(/\d+/);
          const id = idMatch ? parseInt(idMatch[0], 10) : gpus.length;
          
          // Find memory columns (look for large numbers in bytes)
          let memTotal = 0;
          let memUsed = 0;
          let utilization = 0;
          
          for (let i = 0; i < parts.length; i++) {
            const val = parseInt(parts[i], 10);
            // Memory values are typically in bytes (billions)
            if (val > 1000000000 && memTotal === 0) {
              memTotal = Math.round(val / (1024 * 1024)); // Convert to MiB
            } else if (val > 1000000000 && memUsed === 0) {
              memUsed = Math.round(val / (1024 * 1024)); // Convert to MiB
            }
            // Utilization is typically 0-100
            if (parts[i].includes('%') || (val >= 0 && val <= 100 && i > parts.length - 3)) {
              utilization = val;
            }
          }
          
          // Get name from Card series or Card model
          const name = parts[1] || parts[2] || 'AMD GPU';
          
          gpus.push({
            id,
            name,
            memory: `${memTotal} MiB`,
            memoryTotal: memTotal,
            memoryUsed: memUsed,
            utilization,
            vendor: 'amd',
          });
        }
      }

      // Cache for 10 seconds
      await cacheService.set(cacheKey, gpus, 10);

      return gpus;
    } catch (error) {
      console.error(`Error getting GPU info from ${cleanHost}:`, error);
      return [];
    }
  }

  /**
   * Get running vLLM models on a host
   */
  async getRunningModels(host: string, port: number = 22, username: string = 'root'): Promise<GPUModel[]> {
    const cleanHost = stripCidr(host);
    
    // Check cache first
    const cacheKey = `gpu:models:${cleanHost}:${port}`;
    const cached = await cacheService.get<GPUModel[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host: cleanHost,
      port,
      username,
      privateKey,
    };

    try {
      // Find vLLM processes and extract model info
      // Look for vllm.entrypoints.openai.api_server processes
      const command = `ps aux | grep -E 'vllm.*api_server|python.*-m vllm' | grep -v grep | awk '{print $2, $0}'`;
      const output = await this.executeCommand(config, command);
      
      if (!output) {
        return [];
      }

      const models: GPUModel[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const pid = parseInt(line.split(' ')[0], 10);
        
        // Extract model name from command line
        const modelMatch = line.match(/--model\s+([^\s]+)/);
        const portMatch = line.match(/--port\s+(\d+)/);
        const gpuMatch = line.match(/CUDA_VISIBLE_DEVICES=([0-9,]+)/);
        
        if (modelMatch) {
          const modelPath = modelMatch[1];
          const modelName = modelPath.split('/').pop() || modelPath;
          
          models.push({
            name: modelName,
            model: modelPath,
            port: portMatch ? parseInt(portMatch[1], 10) : 8000,
            gpuIds: gpuMatch ? gpuMatch[1].split(',').map(Number) : [0],
            status: 'running',
            pid,
          });
        }
      }

      // Cache for 10 seconds
      await cacheService.set(cacheKey, models, 10);

      return models;
    } catch (error) {
      console.error(`Error getting running models from ${cleanHost}:`, error);
      return [];
    }
  }

  /**
   * Get status of a single GPU pod
   */
  async getPodStatus(nodeId: string): Promise<GPUPodStatus | null> {
    const node = await db.query.nodes.findFirst({
      where: eq(nodes.id, nodeId),
    });

    if (!node) {
      return null;
    }

    const tags = JSON.parse(node.tags || '[]');
    if (!tags.includes('gpu')) {
      return null;
    }

    const host = stripCidr(node.host);
    const port = node.port || 22;
    const sshUser = node.sshUser || 'root';

    try {
      const [gpus, models] = await Promise.all([
        this.getGPUInfo(host, port, sshUser),
        this.getRunningModels(host, port, sshUser),
      ]);

      return {
        nodeId: node.id,
        nodeName: node.name,
        host,
        port,
        sshUser,
        gpus,
        models,
        isOnline: node.status === 'online',
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error getting pod status for ${node.name}:`, error);
      return {
        nodeId: node.id,
        nodeName: node.name,
        host,
        port,
        sshUser,
        gpus: [],
        models: [],
        isOnline: false,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Get status of all GPU pods in the cluster
   */
  async getClusterStatus(): Promise<GPUClusterStatus> {
    // Find all nodes with 'gpu' tag
    const allNodes = await db.query.nodes.findMany();
    const gpuNodes = allNodes.filter((node: any) => {
      const tags = JSON.parse(node.tags || '[]');
      return tags.includes('gpu');
    });

    const pods: GPUPodStatus[] = [];
    let totalGpus = 0;
    let availableGpus = 0;
    let runningModels = 0;

    // Fetch status for all GPU nodes in parallel
    const statusPromises = gpuNodes.map((node: any) => this.getPodStatus(node.id));
    const statuses = await Promise.allSettled(statusPromises);

    for (const result of statuses) {
      if (result.status === 'fulfilled' && result.value) {
        const pod = result.value;
        pods.push(pod);
        
        totalGpus += pod.gpus.length;
        runningModels += pod.models.length;
        
        // Calculate available GPUs (GPUs not assigned to any model)
        const usedGpuIds = new Set(pod.models.flatMap((m: GPUModel) => m.gpuIds));
        availableGpus += pod.gpus.filter((g: GPUInfo) => !usedGpuIds.has(g.id)).length;
      }
    }

    return {
      pods,
      totalGpus,
      availableGpus,
      runningModels,
    };
  }

  /**
   * Find an available GPU pod for inference
   * Returns the pod with the most available GPU memory
   */
  async findAvailablePod(): Promise<GPUPodStatus | null> {
    const cluster = await this.getClusterStatus();
    
    // Filter to online pods with running models
    const availablePods = cluster.pods.filter(pod => 
      pod.isOnline && pod.models.length > 0
    );

    if (availablePods.length === 0) {
      return null;
    }

    // Sort by available GPU memory (prefer pods with more free memory)
    availablePods.sort((a, b) => {
      const aFreeMemory = a.gpus.reduce((sum, g) => sum + ((g.memoryTotal || 0) - (g.memoryUsed || 0)), 0);
      const bFreeMemory = b.gpus.reduce((sum, g) => sum + ((g.memoryTotal || 0) - (g.memoryUsed || 0)), 0);
      return bFreeMemory - aFreeMemory;
    });

    return availablePods[0];
  }

  /**
   * Proxy an OpenAI-compatible request to an available GPU pod
   */
  async proxyCompletionRequest(request: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }): Promise<any> {
    const cluster = await this.getClusterStatus();
    
    // Find a pod with the requested model, or any available model
    let targetPod: GPUPodStatus | null = null;
    let targetModel: GPUModel | null = null;

    for (const pod of cluster.pods) {
      if (!pod.isOnline || pod.models.length === 0) continue;

      if (request.model) {
        // Look for specific model
        const model = pod.models.find(m => 
          m.model.includes(request.model!) || m.name.includes(request.model!)
        );
        if (model) {
          targetPod = pod;
          targetModel = model;
          break;
        }
      } else {
        // Use first available model
        targetPod = pod;
        targetModel = pod.models[0];
        break;
      }
    }

    if (!targetPod || !targetModel) {
      throw new Error('No available GPU pod with running models');
    }

    // Make request to the vLLM server
    const url = `http://${targetPod.host}:${targetModel.port}/v1/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 2048,
        stream: request.stream ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GPU inference failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Start a vLLM model on a GPU pod
   */
  async startModel(
    nodeId: string,
    modelId: string,
    name: string,
    options: {
      gpuIds?: number[];
      port?: number;
      vllmArgs?: string[];
      memory?: string;
      context?: string;
    } = {}
  ): Promise<{ success: boolean; message: string; port?: number; pid?: number }> {
    const node = await db.query.nodes.findFirst({
      where: eq(nodes.id, nodeId),
    });

    if (!node) {
      return { success: false, message: 'Node not found' };
    }

    const host = stripCidr(node.host);
    const sshPort = node.port || 22;
    const sshUser = node.sshUser || 'root';

    const privateKey = await monitoringController.getDecryptedSSHKey();
    if (!privateKey) {
      return { success: false, message: 'SSH key not configured' };
    }

    const config: SSHConnectionConfig = {
      host,
      port: sshPort,
      username: sshUser,
      privateKey,
    };

    try {
      // Get GPU info to determine available GPUs
      const gpus = await this.getGPUInfo(host, sshPort, sshUser);
      if (gpus.length === 0) {
        return { success: false, message: 'No GPUs detected on this node' };
      }

      // Determine which GPUs to use
      const gpuIds = options.gpuIds || [gpus[0].id];
      const gpuCount = gpuIds.length;

      // Get vLLM args
      let vllmArgs: string[] = [];
      if (options.vllmArgs && options.vllmArgs.length > 0) {
        vllmArgs = options.vllmArgs;
      } else if (isKnownModel(modelId)) {
        const gpuType = gpus[0]?.name;
        const modelConfig = getModelConfig(modelId, gpuCount, gpuType);
        if (modelConfig) {
          vllmArgs = [...modelConfig.args];
        }
      }

      // Apply memory/context overrides
      if (options.memory) {
        const fraction = parseFloat(options.memory.replace('%', '')) / 100;
        vllmArgs = vllmArgs.filter(arg => !arg.includes('gpu-memory-utilization'));
        vllmArgs.push('--gpu-memory-utilization', String(fraction));
      }
      if (options.context) {
        const contextSizes: Record<string, number> = {
          '4k': 4096, '8k': 8192, '16k': 16384, '32k': 32768, '64k': 65536, '128k': 131072,
        };
        const maxTokens = contextSizes[options.context.toLowerCase()] || parseInt(options.context, 10);
        vllmArgs = vllmArgs.filter(arg => !arg.includes('max-model-len'));
        vllmArgs.push('--max-model-len', String(maxTokens));
      }

      // Find available port
      const port = options.port || await this.findAvailablePort(config, 8001);

      // Build the vLLM start command
      const cudaDevices = gpuIds.join(',');
      const vllmArgsStr = vllmArgs.join(' ');
      
      const startCmd = `
        export CUDA_VISIBLE_DEVICES=${cudaDevices}
        export HF_HUB_ENABLE_HF_TRANSFER=1
        export VLLM_NO_USAGE_STATS=1
        mkdir -p ~/.vllm_logs
        nohup python -m vllm.entrypoints.openai.api_server \\
          --model ${modelId} \\
          --port ${port} \\
          --host 0.0.0.0 \\
          ${vllmArgsStr} \\
          > ~/.vllm_logs/${name}.log 2>&1 &
        echo $!
      `;

      const result = await this.executeCommand(config, startCmd);
      const pid = parseInt(result.trim(), 10);

      if (!pid || isNaN(pid)) {
        return { success: false, message: 'Failed to start model - no PID returned' };
      }

      // Invalidate cache to refresh model list
      await this.invalidateCache(host, sshPort);

      return {
        success: true,
        message: `Model ${name} started on port ${port}`,
        port,
        pid,
      };
    } catch (error) {
      console.error('Error starting model:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start model',
      };
    }
  }

  /**
   * Stop a running vLLM model
   */
  async stopModel(
    nodeId: string,
    pid: number
  ): Promise<{ success: boolean; message: string }> {
    const node = await db.query.nodes.findFirst({
      where: eq(nodes.id, nodeId),
    });

    if (!node) {
      return { success: false, message: 'Node not found' };
    }

    const host = stripCidr(node.host);
    const sshPort = node.port || 22;
    const sshUser = node.sshUser || 'root';

    const privateKey = await monitoringController.getDecryptedSSHKey();
    if (!privateKey) {
      return { success: false, message: 'SSH key not configured' };
    }

    const config: SSHConnectionConfig = {
      host,
      port: sshPort,
      username: sshUser,
      privateKey,
    };

    try {
      // Kill the process and all its children
      const killCmd = `
        pkill -TERM -P ${pid} 2>/dev/null || true
        kill ${pid} 2>/dev/null || true
        sleep 1
        kill -9 ${pid} 2>/dev/null || true
      `;
      await this.executeCommand(config, killCmd);

      // Invalidate cache
      await this.invalidateCache(host, sshPort);

      return { success: true, message: 'Model stopped' };
    } catch (error) {
      console.error('Error stopping model:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop model',
      };
    }
  }

  /**
   * Get model logs
   */
  async getModelLogs(
    nodeId: string,
    modelName: string,
    tail: number = 100
  ): Promise<{ success: boolean; logs?: string; message?: string }> {
    const node = await db.query.nodes.findFirst({
      where: eq(nodes.id, nodeId),
    });

    if (!node) {
      return { success: false, message: 'Node not found' };
    }

    const host = stripCidr(node.host);
    const sshPort = node.port || 22;
    const sshUser = node.sshUser || 'root';

    const privateKey = await monitoringController.getDecryptedSSHKey();
    if (!privateKey) {
      return { success: false, message: 'SSH key not configured' };
    }

    const config: SSHConnectionConfig = {
      host,
      port: sshPort,
      username: sshUser,
      privateKey,
    };

    try {
      const logs = await this.executeCommand(config, `tail -n ${tail} ~/.vllm_logs/${modelName}.log 2>/dev/null || echo "No logs found"`);
      return { success: true, logs };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get logs',
      };
    }
  }

  /**
   * Find an available port on the remote host
   */
  private async findAvailablePort(config: SSHConnectionConfig, startPort: number): Promise<number> {
    const checkCmd = `
      for port in $(seq ${startPort} $((${startPort} + 100))); do
        if ! ss -tuln | grep -q ":$port "; then
          echo $port
          exit 0
        fi
      done
      echo ${startPort}
    `;
    const result = await this.executeCommand(config, checkCmd);
    return parseInt(result.trim(), 10) || startPort;
  }

  /**
   * Get list of known models
   */
  getKnownModels() {
    return getKnownModels();
  }

  /**
   * Get compatible models for a GPU setup
   */
  getCompatibleModels(gpuCount: number, gpuType?: string) {
    return getCompatibleModels(gpuCount, gpuType);
  }

  /**
   * Invalidate GPU cache for a host
   */
  async invalidateCache(host: string, port?: number): Promise<void> {
    const cleanHost = stripCidr(host);
    if (port !== undefined) {
      await cacheService.del(`gpu:info:${cleanHost}:${port}`);
      await cacheService.del(`gpu:models:${cleanHost}:${port}`);
    } else {
      await cacheService.delPattern(`gpu:*:${cleanHost}:*`);
    }
  }
}

export const gpuService = new GPUService();
