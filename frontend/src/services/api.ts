import { InfraNode, InfraEdge, MonitoringSettings, NodeTag, DockerContainer, ReverseProxyConfig, WireGuardStatus, NginxConfigFile, NginxTestResult, CreateProxyConfigRequest, WireGuardInterfaceInfo, WireGuardInterfaceDetail, GeneratedWireGuardClient, NetworkInterface, GPUInfo, GPUModel, GPUPodStatus, GPUClusterStatus, GPUCompletionRequest, GPUCompletionResponse } from '@/types'

const API_BASE_URL = '/api'

export interface CreateNodeData {
  name: string
  host: string
  port?: number
  sshUser?: string
  type: string
  tags?: NodeTag[]
  description?: string
  position: { x: number; y: number }
  status: string
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      // Clear any stored auth state
      localStorage.removeItem('auth-storage');
      // Redirect to login page
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    // Handle empty responses (e.g., DELETE)
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    return {} as T
  }

  // Nodes
  async getNodes(): Promise<InfraNode[]> {
    return this.request<InfraNode[]>('/nodes')
  }

  async getNode(id: string): Promise<InfraNode> {
    return this.request<InfraNode>(`/nodes/${id}`)
  }

  async createNode(data: CreateNodeData): Promise<InfraNode> {
    return this.request<InfraNode>('/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateNode(id: string, data: Partial<InfraNode>): Promise<InfraNode> {
    return this.request<InfraNode>(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteNode(id: string): Promise<void> {
    await this.request<void>(`/nodes/${id}`, {
      method: 'DELETE',
    })
  }

  async updateNodePosition(id: string, position: { x: number; y: number }): Promise<InfraNode> {
    return this.request<InfraNode>(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ position }),
    })
  }

  async updateNodePositions(positions: Record<string, { x: number; y: number }>): Promise<void> {
    await this.request<void>('/nodes/positions', {
      method: 'PATCH',
      body: JSON.stringify({ positions }),
    })
  }

  // Edges
  async getEdges(): Promise<InfraEdge[]> {
    return this.request<InfraEdge[]>('/edges')
  }

  async createEdge(data: { source: string; target: string; label?: string; sourceHandle?: string; targetHandle?: string }): Promise<InfraEdge> {
    return this.request<InfraEdge>('/edges', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteEdge(id: string): Promise<void> {
    await this.request<void>(`/edges/${id}`, {
      method: 'DELETE',
    })
  }

  async deleteAllEdges(): Promise<void> {
    await this.request<void>('/edges', {
      method: 'DELETE',
    })
  }

  // Monitoring
  async pingNode(id: string): Promise<{ status: string; latency?: number }> {
    return this.request<{ status: string; latency?: number }>(`/monitoring/ping/${id}`, {
      method: 'POST',
    })
  }

  async restartNode(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/nodes/${id}/restart`, {
      method: 'POST',
    })
  }

  async pingAll(): Promise<void> {
    await this.request<void>('/monitoring/check', {
      method: 'POST',
    })
  }

  // Settings
  async getMonitoringSettings(): Promise<MonitoringSettings> {
    return this.request<MonitoringSettings>('/monitoring/settings')
  }

  async updateMonitoringSettings(settings: Partial<MonitoringSettings>): Promise<MonitoringSettings> {
    return this.request<MonitoringSettings>('/monitoring/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  // Legacy alias for backward compatibility
  async getSettings(): Promise<MonitoringSettings> {
    return this.getMonitoringSettings()
  }

  async updateSettings(settings: Partial<MonitoringSettings>): Promise<MonitoringSettings> {
    return this.updateMonitoringSettings(settings)
  }

  // Docker
  async getNodeContainers(nodeId: string): Promise<{ containers: DockerContainer[] }> {
    return this.request<{ containers: DockerContainer[] }>(`/docker/${nodeId}/containers`)
  }

  // Docker Hosts - Get all docker hosts with their containers
  async getDockerHosts(): Promise<{ hosts: Array<{ node: InfraNode; containers: DockerContainer[] }> }> {
    return this.request<{ hosts: Array<{ node: InfraNode; containers: DockerContainer[] }> }>('/docker/hosts')
  }

  // Container Actions
  async startContainer(nodeId: string, containerId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/docker/${nodeId}/containers/${containerId}/start`, {
      method: 'POST',
    })
  }

  async stopContainer(nodeId: string, containerId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/docker/${nodeId}/containers/${containerId}/stop`, {
      method: 'POST',
    })
  }

  async restartContainer(nodeId: string, containerId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/docker/${nodeId}/containers/${containerId}/restart`, {
      method: 'POST',
    })
  }

  async deleteContainer(nodeId: string, containerId: string, removeVolumes: boolean = false): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/docker/${nodeId}/containers/${containerId}`, {
      method: 'DELETE',
      body: JSON.stringify({ removeVolumes }),
    })
  }

  async getContainerLogs(nodeId: string, containerId: string, tail: number = 100): Promise<{ logs: string }> {
    return this.request<{ logs: string }>(`/docker/${nodeId}/containers/${containerId}/logs?tail=${tail}`)
  }

  // Reverse Proxy
  async getNodeProxyConfigs(nodeId: string): Promise<{ configs: ReverseProxyConfig[] }> {
    return this.request<{ configs: ReverseProxyConfig[] }>(`/reverse-proxy/${nodeId}/configs`)
  }

  // Reverse Proxy Hosts - Get all reverse proxy hosts with their configs
  async getReverseProxyHosts(): Promise<{ hosts: Array<{ node: InfraNode; configs: NginxConfigFile[] }> }> {
    return this.request<{ hosts: Array<{ node: InfraNode; configs: NginxConfigFile[] }> }>('/reverse-proxy/hosts')
  }

  // List nginx config files for a node
  async listProxyConfigFiles(nodeId: string): Promise<{ files: NginxConfigFile[] }> {
    return this.request<{ files: NginxConfigFile[] }>(`/reverse-proxy/${nodeId}/files`)
  }

  // Get content of a specific nginx config file
  async getProxyConfigFile(nodeId: string, filename: string): Promise<{ filename: string; content: string }> {
    return this.request<{ filename: string; content: string }>(`/reverse-proxy/${nodeId}/files/${encodeURIComponent(filename)}`)
  }

  // Create a new nginx reverse proxy config
  async createProxyConfig(nodeId: string, data: CreateProxyConfigRequest): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/reverse-proxy/${nodeId}/files`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Delete an nginx config file
  async deleteProxyConfig(nodeId: string, filename: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/reverse-proxy/${nodeId}/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    })
  }

  // Test nginx configuration
  async testProxyConfig(nodeId: string): Promise<NginxTestResult> {
    return this.request<NginxTestResult>(`/reverse-proxy/${nodeId}/test`, {
      method: 'POST',
    })
  }

  // Reload nginx to apply configuration changes
  async reloadNginx(nodeId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/reverse-proxy/${nodeId}/reload`, {
      method: 'POST',
    })
  }

  // WireGuard
  async getNodeWireGuardStatus(nodeId: string): Promise<{ status: WireGuardStatus | null }> {
    return this.request<{ status: WireGuardStatus | null }>(`/wireguard/${nodeId}/status`)
  }

  // WireGuard Hosts - Get all WireGuard hosts with their interfaces
  async getWireGuardHosts(): Promise<{ hosts: Array<{ node: InfraNode; interfaces: WireGuardInterfaceInfo[] }> }> {
    return this.request<{ hosts: Array<{ node: InfraNode; interfaces: WireGuardInterfaceInfo[] }> }>('/wireguard/hosts')
  }

  // List WireGuard interfaces on a node
  async listWireGuardInterfaces(nodeId: string): Promise<{ interfaces: WireGuardInterfaceInfo[] }> {
    return this.request<{ interfaces: WireGuardInterfaceInfo[] }>(`/wireguard/${nodeId}/interfaces`)
  }

  // Get detailed info for a specific WireGuard interface
  async getWireGuardInterface(nodeId: string, interfaceName: string): Promise<{ interface: WireGuardInterfaceDetail }> {
    return this.request<{ interface: WireGuardInterfaceDetail }>(`/wireguard/${nodeId}/interfaces/${encodeURIComponent(interfaceName)}`)
  }

  // Create a new WireGuard peer/client
  async createWireGuardPeer(nodeId: string, interfaceName: string, name: string): Promise<{ client: GeneratedWireGuardClient }> {
    return this.request<{ client: GeneratedWireGuardClient }>(`/wireguard/${nodeId}/interfaces/${encodeURIComponent(interfaceName)}/peers`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  // Delete a WireGuard peer
  async deleteWireGuardPeer(nodeId: string, interfaceName: string, publicKey: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/wireguard/${nodeId}/interfaces/${encodeURIComponent(interfaceName)}/peers/${encodeURIComponent(publicKey)}`, {
      method: 'DELETE',
    })
  }

  // Network Interfaces
  async getNodeInterfaces(nodeId: string): Promise<NetworkInterface[]> {
    return this.request<NetworkInterface[]>(`/interfaces/${nodeId}`)
  }

  async createNodeInterface(nodeId: string, address: string): Promise<NetworkInterface> {
    return this.request<NetworkInterface>(`/interfaces/${nodeId}`, {
      method: 'POST',
      body: JSON.stringify({ address }),
    })
  }

  async deleteNodeInterface(nodeId: string, interfaceId: string): Promise<void> {
    await this.request<void>(`/interfaces/${nodeId}/${interfaceId}`, {
      method: 'DELETE',
    })
  }

  // ============ Alerting ============

  // Telegram Config
  async getTelegramConfig(): Promise<{
    configured: boolean;
    id?: string;
    botTokenSet?: boolean;
    botTokenPreview?: string;
    chatId?: string;
    enabled?: boolean;
    updatedAt?: string;
  }> {
    return this.request('/alerting/telegram');
  }

  async saveTelegramConfig(data: {
    botToken: string;
    chatId: string;
    enabled?: boolean;
  }): Promise<{ success: boolean }> {
    return this.request('/alerting/telegram', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async testTelegramConnection(data: {
    botToken: string;
    chatId: string;
  }): Promise<{ success: boolean; error?: string }> {
    return this.request('/alerting/telegram/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Alert Rules
  async getAlertRules(): Promise<Array<{
    id: string;
    eventType: string;
    enabled: boolean;
    nodeId: string | null;
    threshold: number | null;
    message: string | null;
    createdAt: string;
    updatedAt: string;
  }>> {
    return this.request('/alerting/rules');
  }

  async createAlertRule(data: {
    eventType: string;
    enabled?: boolean;
    nodeId?: string;
    threshold?: number;
    message?: string;
  }): Promise<any> {
    return this.request('/alerting/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAlertRule(id: string, data: {
    eventType?: string;
    enabled?: boolean;
    nodeId?: string | null;
    threshold?: number | null;
    message?: string | null;
  }): Promise<any> {
    return this.request(`/alerting/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAlertRule(id: string): Promise<{ success: boolean }> {
    return this.request(`/alerting/rules/${id}`, {
      method: 'DELETE',
    });
  }

  // Events
  async getEvents(limit?: number, offset?: number): Promise<Array<{
    id: string;
    eventType: string;
    nodeId: string | null;
    nodeName: string | null;
    message: string;
    details: Record<string, any> | null;
    severity: string;
    alertSent: boolean;
    createdAt: string;
  }>> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString();
    return this.request(`/alerting/events${query ? `?${query}` : ''}`);
  }

  async clearEvents(): Promise<{ success: boolean }> {
    return this.request('/alerting/events', {
      method: 'DELETE',
    });
  }

  async getEventTypes(): Promise<Array<{
    id: string;
    label: string;
    description: string;
    severity: string;
  }>> {
    return this.request('/alerting/event-types');
  }

  async getEventsForNode(nodeId: string, limit?: number): Promise<Array<{
    id: string;
    eventType: string;
    nodeId: string | null;
    nodeName: string | null;
    message: string;
    details: Record<string, any> | null;
    severity: string;
    alertSent: boolean;
    createdAt: string;
  }>> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return this.request(`/alerting/events/node/${nodeId}${query ? `?${query}` : ''}`);
  }

  // ============ GPU Cluster ============

  // Get GPU cluster status
  async getGPUClusterStatus(): Promise<GPUClusterStatus> {
    return this.request<GPUClusterStatus>('/gpu/cluster');
  }

  // Get all GPU hosts with their status
  async getGPUHosts(): Promise<{ hosts: Array<{ node: InfraNode; gpus: GPUInfo[]; models: GPUModel[] }> }> {
    return this.request<{ hosts: Array<{ node: InfraNode; gpus: GPUInfo[]; models: GPUModel[] }> }>('/gpu/hosts');
  }

  // Get GPU status for a specific node
  async getNodeGPUStatus(nodeId: string): Promise<{ status: GPUPodStatus }> {
    return this.request<{ status: GPUPodStatus }>(`/gpu/${nodeId}/status`);
  }

  // Get GPU info for a specific node
  async getNodeGPUs(nodeId: string): Promise<{ gpus: GPUInfo[] }> {
    return this.request<{ gpus: GPUInfo[] }>(`/gpu/${nodeId}/gpus`);
  }

  // Get running models on a specific node
  async getNodeModels(nodeId: string): Promise<{ models: GPUModel[] }> {
    return this.request<{ models: GPUModel[] }>(`/gpu/${nodeId}/models`);
  }

  // List all available models across the cluster
  async listGPUModels(): Promise<{ object: string; data: Array<{ id: string; object: string; created: number; owned_by: string; pod: string; port: number; status: string }> }> {
    return this.request('/gpu/v1/models');
  }

  // Send chat completion request to GPU cluster
  async gpuChatCompletion(request: GPUCompletionRequest): Promise<GPUCompletionResponse> {
    return this.request<GPUCompletionResponse>('/gpu/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Invalidate GPU cache for a node
  async invalidateGPUCache(nodeId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/gpu/${nodeId}/cache`, {
      method: 'DELETE',
    });
  }

  // Get known models with configurations
  async getKnownModels(): Promise<{ models: Array<{ id: string; name: string; configs: Array<{ gpuCount: number; gpuTypes?: string[]; args: string[]; notes?: string }> }> }> {
    return this.request('/gpu/models/known');
  }

  // Get compatible models for a node's GPU setup
  async getCompatibleModels(nodeId: string): Promise<{ gpuCount: number; gpuType: string; models: Array<{ id: string; name: string; config: { gpuCount: number; args: string[]; notes?: string } }> }> {
    return this.request(`/gpu/${nodeId}/models/compatible`);
  }

  // Start a vLLM model on a GPU node
  async startGPUModel(nodeId: string, data: {
    modelId: string;
    name: string;
    gpuIds?: number[];
    port?: number;
    vllmArgs?: string[];
    memory?: string;
    context?: string;
  }): Promise<{ success: boolean; message: string; port?: number; pid?: number }> {
    return this.request(`/gpu/${nodeId}/models/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Stop a running vLLM model
  async stopGPUModel(nodeId: string, pid: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/gpu/${nodeId}/models/stop`, {
      method: 'POST',
      body: JSON.stringify({ pid }),
    });
  }

  // Get logs for a running model
  async getGPUModelLogs(nodeId: string, modelName: string, tail: number = 100): Promise<{ success: boolean; logs?: string; message?: string }> {
    return this.request(`/gpu/${nodeId}/models/${encodeURIComponent(modelName)}/logs?tail=${tail}`);
  }
}

export const api = new ApiService()
