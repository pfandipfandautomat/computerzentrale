import { Client } from 'ssh2';
import { monitoringController } from '../controllers/monitoringController.js';
import { cacheService } from './cacheService.js';

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead';
  ports: string;
}

export interface ReverseProxyConfig {
  domain: string;
  upstream: string;
  sslEnabled: boolean;
  configFile: string;
}

export interface NginxConfigFile {
  filename: string;
  domain: string;
  upstream: string;
  sslEnabled: boolean;
  content?: string;
}

export interface NginxTestResult {
  success: boolean;
  output: string;
}

export interface WireGuardPeer {
  publicKey: string;
  endpoint: string | null;
  allowedIps: string[];
  latestHandshake: string | null;
  transferRx: number;  // bytes received
  transferTx: number;  // bytes transmitted
  isOnline: boolean;
}

export interface WireGuardStatus {
  interface: string;
  publicKey: string;
  listenPort: number;
  peers: WireGuardPeer[];
}

export interface WireGuardInterfaceInfo {
  name: string;           // e.g., "liebe"
  address: string;        // e.g., "10.12.12.1/24"
  listenPort: number;     // e.g., 52821
  publicKey: string;      // server's public key (derived from private key)
  peerCount: number;
}

export interface WireGuardPeerConfig {
  name: string;           // from comment, e.g., "laptop"
  publicKey: string;
  allowedIps: string;     // e.g., "10.12.12.2/32"
}

export interface WireGuardInterfaceDetail {
  name: string;
  address: string;
  listenPort: number;
  publicKey: string;
  peers: WireGuardPeerConfig[];
  // Runtime status from wg show (merged with config)
  runtimePeers: WireGuardPeer[];
}

export interface GeneratedWireGuardClient {
  clientName: string;
  privateKey: string;
  publicKey: string;
  address: string;        // e.g., "10.12.12.5/32"
  serverPublicKey: string;
  endpoint: string;       // e.g., "152.53.14.47:52821"
  allowedIps: string;     // e.g., "10.12.12.0/24"
  persistentKeepalive: number;
  interfaceName: string;
  configText: string;     // full config file content
  oneLiner: string;       // bash one-liner for wg-quick
}

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

/**
 * Strip CIDR notation from hostname (e.g., "10.13.37.52/32" -> "10.13.37.52")
 */
function stripCidr(host: string): string {
  return host.split('/')[0];
}

class SSHService {
  /**
   * Execute a command via SSH
   */
  async executeCommand(config: SSHConnectionConfig, command: string): Promise<string> {
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
              reject(new Error(errorOutput || `Command exited with code ${code}`));
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
   * Get Docker containers from a remote host
   */
  async getDockerContainers(host: string, port: number = 22, username: string = 'root'): Promise<DockerContainer[]> {
    const cleanHost = stripCidr(host);
    
    // Check cache first
    const cacheKey = `docker:${cleanHost}:${port}`;
    const cached = await cacheService.get<DockerContainer[]>(cacheKey);
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

    const command = 'docker ps -a --format \'{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}","ports":"{{.Ports}}"}\'';

    try {
      const output = await this.executeCommand(config, command);
      
      if (!output) {
        return [];
      }

      const containers: DockerContainer[] = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((c): c is DockerContainer => c !== null);

      // Cache the result for 10 seconds (matches frontend auto-refresh interval)
      await cacheService.set(cacheKey, containers, 10);

      return containers;
    } catch (error) {
      // Don't log here - let the caller handle it
      throw error;
    }
  }

  /**
   * Get nginx reverse proxy configurations from a remote host
   */
  async getNginxConfigs(host: string, port: number = 22, username: string = 'root'): Promise<ReverseProxyConfig[]> {
    const cleanHost = stripCidr(host);
    
    // Check cache first
    const cacheKey = `nginx:${cleanHost}:${port}`;
    const cached = await cacheService.get<ReverseProxyConfig[]>(cacheKey);
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
      // Simple approach: use grep to find server_name and proxy_pass lines
      // Then parse them in JavaScript
      const command = `grep -r -h "server_name\\|proxy_pass\\|ssl_certificate\\|listen.*443" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -v "^#"`;

      const output = await this.executeCommand(config, command);
      
      if (!output) {
        return [];
      }

      // Parse the grep output to extract configs
      const lines = output.split('\n').filter(line => line.trim());
      const configs: ReverseProxyConfig[] = [];
      
      let currentDomain = '';
      let currentUpstream = '';
      let sslEnabled = false;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for server_name
        const serverNameMatch = trimmed.match(/server_name\s+([^;]+)/);
        if (serverNameMatch) {
          // If we have a previous config, save it
          if (currentDomain && currentUpstream) {
            configs.push({
              domain: currentDomain,
              upstream: currentUpstream,
              sslEnabled,
              configFile: 'nginx',
            });
          }
          // Start new config
          currentDomain = serverNameMatch[1].trim().split(/\s+/)[0]; // Take first domain
          currentUpstream = '';
          sslEnabled = false;
        }
        
        // Check for proxy_pass
        const proxyPassMatch = trimmed.match(/proxy_pass\s+([^;]+)/);
        if (proxyPassMatch && currentDomain) {
          currentUpstream = proxyPassMatch[1].trim();
        }
        
        // Check for SSL
        if (trimmed.includes('ssl_certificate') || trimmed.match(/listen\s+.*443/)) {
          sslEnabled = true;
        }
      }
      
      // Don't forget the last config
      if (currentDomain && currentUpstream) {
        configs.push({
          domain: currentDomain,
          upstream: currentUpstream,
          sslEnabled,
          configFile: 'nginx',
        });
      }

      // Remove duplicates based on domain
      const uniqueConfigs = configs.filter((config, index, self) =>
        index === self.findIndex(c => c.domain === config.domain)
      );

      // Cache the result for 30 seconds
      await cacheService.set(cacheKey, uniqueConfigs, 30);

      return uniqueConfigs;
    } catch (error) {
      // Don't log here - let the caller handle it
      throw error;
    }
  }

  /**
   * Get WireGuard status and peers from a remote host
   */
  async getWireGuardStatus(host: string, port: number = 22, username: string = 'root'): Promise<WireGuardStatus | null> {
    const cleanHost = stripCidr(host);
    
    // Check cache first
    const cacheKey = `wireguard:${cleanHost}:${port}`;
    const cached = await cacheService.get<WireGuardStatus | null>(cacheKey);
    if (cached !== undefined) {
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
      // Get WireGuard status using wg show command
      // This provides real-time peer information including handshake times and transfer stats
      const command = `wg show all dump 2>/dev/null || sudo wg show all dump 2>/dev/null`;

      const output = await this.executeCommand(config, command);
      
      if (!output) {
        // Cache null result for 30 seconds
        await cacheService.set(cacheKey, null, 30);
        return null;
      }

      // Parse wg show dump output
      // Format: interface\tprivate-key\tpublic-key\tlisten-port\tfwmark
      // Then for each peer: interface\tpublic-key\tpreshared-key\tendpoint\tallowed-ips\tlatest-handshake\ttransfer-rx\ttransfer-tx\tpersistent-keepalive
      const lines = output.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        // Cache null result for 30 seconds
        await cacheService.set(cacheKey, null, 30);
        return null;
      }

      let currentInterface = '';
      let publicKey = '';
      let listenPort = 0;
      const peers: WireGuardPeer[] = [];

      for (const line of lines) {
        const parts = line.split('\t');
        
        if (parts.length === 5) {
          // Interface line: interface, private-key, public-key, listen-port, fwmark
          currentInterface = parts[0];
          publicKey = parts[2];
          listenPort = parseInt(parts[3], 10) || 0;
        } else if (parts.length >= 8) {
          // Peer line: interface, public-key, preshared-key, endpoint, allowed-ips, latest-handshake, transfer-rx, transfer-tx, [persistent-keepalive]
          const peerPublicKey = parts[1];
          const endpoint = parts[3] === '(none)' ? null : parts[3];
          const allowedIps = parts[4] ? parts[4].split(',') : [];
          const latestHandshakeTimestamp = parseInt(parts[5], 10);
          const transferRx = parseInt(parts[6], 10) || 0;
          const transferTx = parseInt(parts[7], 10) || 0;
          
          // Calculate if peer is online (handshake within last 3 minutes)
          const now = Math.floor(Date.now() / 1000);
          const handshakeAge = latestHandshakeTimestamp > 0 ? now - latestHandshakeTimestamp : Infinity;
          const isOnline = handshakeAge < 180; // 3 minutes
          
          // Format handshake time
          let latestHandshake: string | null = null;
          if (latestHandshakeTimestamp > 0) {
            const date = new Date(latestHandshakeTimestamp * 1000);
            latestHandshake = date.toISOString();
          }

          peers.push({
            publicKey: peerPublicKey,
            endpoint,
            allowedIps,
            latestHandshake,
            transferRx,
            transferTx,
            isOnline,
          });
        }
      }

      const result: WireGuardStatus = {
        interface: currentInterface,
        publicKey,
        listenPort,
        peers,
      };

      // Cache the result for 30 seconds
      await cacheService.set(cacheKey, result, 30);

      return result;
    } catch (error) {
      // Don't log here - let the caller handle it
      throw error;
    }
  }

  /**
   * Start a Docker container
   */
  async startContainer(host: string, port: number = 22, username: string = 'root', containerId: string): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    const command = `docker start ${containerId}`;

    try {
      await this.executeCommand(config, command);
      
      // Invalidate docker cache
      await cacheService.del(`docker:${host}:${port}`);
      
      return {
        success: true,
        message: `Container ${containerId} started successfully`,
      };
    } catch (error) {
      console.error('Error starting Docker container:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start container',
      };
    }
  }

  /**
   * Stop a Docker container
   */
  async stopContainer(host: string, port: number = 22, username: string = 'root', containerId: string): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    const command = `docker stop ${containerId}`;

    try {
      await this.executeCommand(config, command);
      
      // Invalidate docker cache
      await cacheService.del(`docker:${host}:${port}`);
      
      return {
        success: true,
        message: `Container ${containerId} stopped successfully`,
      };
    } catch (error) {
      console.error('Error stopping Docker container:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop container',
      };
    }
  }

  /**
   * Restart a Docker container
   */
  async restartContainer(host: string, port: number = 22, username: string = 'root', containerId: string): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    const command = `docker restart ${containerId}`;

    try {
      await this.executeCommand(config, command);
      
      // Invalidate docker cache
      await cacheService.del(`docker:${host}:${port}`);
      
      return {
        success: true,
        message: `Container ${containerId} restarted successfully`,
      };
    } catch (error) {
      console.error('Error restarting Docker container:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restart container',
      };
    }
  }

  /**
   * Delete a Docker container
   */
  async deleteContainer(host: string, port: number = 22, username: string = 'root', containerId: string, removeVolumes: boolean = false): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    const command = removeVolumes ? `docker rm -v ${containerId}` : `docker rm ${containerId}`;

    try {
      await this.executeCommand(config, command);
      
      // Invalidate docker cache
      await cacheService.del(`docker:${host}:${port}`);
      
      return {
        success: true,
        message: `Container ${containerId} deleted successfully`,
      };
    } catch (error) {
      console.error('Error deleting Docker container:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete container',
      };
    }
  }

  /**
   * Get Docker container logs
   */
  async getContainerLogs(host: string, port: number = 22, username: string = 'root', containerId: string, tail: number = 100): Promise<{ success: boolean; logs?: string; message?: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    const command = `docker logs --tail ${tail} ${containerId}`;

    try {
      const output = await this.executeCommand(config, command);
      
      return {
        success: true,
        logs: output,
      };
    } catch (error) {
      console.error('Error fetching Docker container logs:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch logs',
      };
    }
  }

  /**
   * Stream Docker container logs via WebSocket
   * Returns a cleanup function that closes the SSH connection
   */
  async streamContainerLogs(
    config: SSHConnectionConfig,
    containerId: string,
    onData: (data: string) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const command = `docker logs -f --tail 100 ${containerId}`;

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          // Return cleanup function
          const cleanup = () => {
            stream.close();
            conn.end();
          };

          resolve(cleanup);

          stream.on('close', () => {
            conn.end();
          });

          stream.on('data', (data: Buffer) => {
            onData(data.toString());
          });

          stream.stderr.on('data', (data: Buffer) => {
            onData(data.toString());
          });

          stream.on('error', (err: Error) => {
            onError(err);
          });
        });
      });

      conn.on('error', (err) => {
        onError(err);
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
   * Start an interactive shell session via SSH with PTY
   * Returns functions to write to stdin and close the connection
   */
  async startShellSession(
    config: SSHConnectionConfig,
    options: {
      cols?: number;
      rows?: number;
      onData: (data: string) => void;
      onError: (error: Error) => void;
      onClose: () => void;
    }
  ): Promise<{
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    close: () => void;
  }> {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        conn.shell(
          {
            term: 'xterm-256color',
            cols: options.cols || 80,
            rows: options.rows || 24,
          },
          (err, stream) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }

            // Handle incoming data from the shell
            stream.on('data', (data: Buffer) => {
              options.onData(data.toString());
            });

            stream.stderr.on('data', (data: Buffer) => {
              options.onData(data.toString());
            });

            stream.on('close', () => {
              conn.end();
              options.onClose();
            });

            stream.on('error', (err: Error) => {
              options.onError(err);
            });

            // Return control functions
            resolve({
              write: (data: string) => {
                if (stream.writable) {
                  stream.write(data);
                }
              },
              resize: (cols: number, rows: number) => {
                stream.setWindow(rows, cols, 0, 0);
              },
              close: () => {
                stream.close();
                conn.end();
              },
            });
          }
        );
      });

      conn.on('error', (err) => {
        options.onError(err);
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
   * List nginx config files in /etc/nginx/conf.d/
   */
  async listNginxConfigFiles(host: string, port: number = 22, username: string = 'root'): Promise<NginxConfigFile[]> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    try {
      // Step 1: List config files
      const listCommand = `ls /etc/nginx/conf.d/*.conf 2>/dev/null || true`;
      const fileList = await this.executeCommand(config, listCommand);
      
      console.log('[DEBUG] nginx config files:', fileList);
      
      if (!fileList || !fileList.trim()) {
        return [];
      }

      const files = fileList.split('\n').filter(f => f.trim());
      
      // Step 2: Read all files with markers
      const catCommands = files.map(f => `echo "===FILE:${f}==="; cat "${f}"; echo "===ENDFILE==="`).join('; ');
      const contentOutput = await this.executeCommand(config, catCommands);
      
      // Step 3: Parse the output
      const configs: NginxConfigFile[] = [];
      const fileBlocks = contentOutput.split('===FILE:').filter(block => block.trim());
      
      for (const block of fileBlocks) {
        const endMarker = block.indexOf('===ENDFILE===');
        if (endMarker === -1) continue;
        
        const firstNewline = block.indexOf('\n');
        if (firstNewline === -1) continue;
        
        const filepath = block.substring(0, firstNewline).replace('===', '').trim();
        const content = block.substring(firstNewline + 1, endMarker);
        const filename = filepath.split('/').pop() || '';
        
        // Parse server_name
        const serverNameMatch = content.match(/server_name\s+([^;]+)/);
        const domain = serverNameMatch ? serverNameMatch[1].trim().split(/\s+/)[0] : filename.replace('.conf', '');
        
        // Parse proxy_pass
        const proxyPassMatch = content.match(/proxy_pass\s+([^;]+)/);
        const upstream = proxyPassMatch ? proxyPassMatch[1].trim() : '';
        
        // Check for SSL
        const sslEnabled = content.includes('ssl_certificate') || /listen\s+.*443/.test(content);

        configs.push({
          filename,
          domain,
          upstream,
          sslEnabled,
        });
      }

      return configs;
    } catch (error) {
      // Don't log here - let the caller handle it
      throw error;
    }
  }

  /**
   * Read a specific nginx config file
   */
  async readNginxConfigFile(host: string, port: number = 22, username: string = 'root', filename: string): Promise<string> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filepath = `/etc/nginx/conf.d/${sanitizedFilename}`;

    try {
      const command = `cat "${filepath}"`;
      const content = await this.executeCommand(config, command);
      return content;
    } catch (error) {
      console.error('Error reading nginx config file:', error);
      throw error;
    }
  }

  /**
   * Create a new nginx reverse proxy config
   */
  async createNginxConfig(
    host: string,
    port: number = 22,
    username: string = 'root',
    domain: string,
    upstreamIp: string,
    upstreamPort: number
  ): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    // Sanitize domain for filename
    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
    const filename = `${sanitizedDomain}.conf`;
    const filepath = `/etc/nginx/conf.d/${filename}`;

    // Create nginx config content
    const nginxConfig = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://${upstreamIp}:${upstreamPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

    try {
      // Check if file already exists
      const checkCommand = `test -f "${filepath}" && echo "exists" || echo "not_exists"`;
      const checkResult = await this.executeCommand(config, checkCommand);
      
      if (checkResult.trim() === 'exists') {
        return {
          success: false,
          message: `Config file for domain ${domain} already exists`,
        };
      }

      // Write the config file using cat with heredoc
      const writeCommand = `cat > "${filepath}" << 'NGINX_CONFIG_EOF'
${nginxConfig}
NGINX_CONFIG_EOF`;
      
      await this.executeCommand(config, writeCommand);

      // Invalidate nginx cache
      await cacheService.del(`nginx:${host}:${port}`);

      return {
        success: true,
        message: `Config for ${domain} created successfully`,
      };
    } catch (error) {
      console.error('Error creating nginx config:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create config',
      };
    }
  }

  /**
   * Delete an nginx config file
   */
  async deleteNginxConfig(
    host: string,
    port: number = 22,
    username: string = 'root',
    filename: string
  ): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filepath = `/etc/nginx/conf.d/${sanitizedFilename}`;

    try {
      // Check if file exists
      const checkCommand = `test -f "${filepath}" && echo "exists" || echo "not_exists"`;
      const checkResult = await this.executeCommand(config, checkCommand);
      
      if (checkResult.trim() === 'not_exists') {
        return {
          success: false,
          message: `Config file ${filename} does not exist`,
        };
      }

      // Delete the file
      const deleteCommand = `rm "${filepath}"`;
      await this.executeCommand(config, deleteCommand);

      // Invalidate nginx cache
      await cacheService.del(`nginx:${host}:${port}`);

      return {
        success: true,
        message: `Config ${filename} deleted successfully`,
      };
    } catch (error) {
      console.error('Error deleting nginx config:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete config',
      };
    }
  }

  /**
   * Test nginx configuration
   */
  async testNginxConfig(host: string, port: number = 22, username: string = 'root'): Promise<NginxTestResult> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    try {
      const command = `nginx -t 2>&1`;
      const output = await this.executeCommand(config, command);
      
      return {
        success: true,
        output,
      };
    } catch (error) {
      // nginx -t returns non-zero exit code on failure, but we still want the output
      return {
        success: false,
        output: error instanceof Error ? error.message : 'Failed to test nginx config',
      };
    }
  }

  /**
   * Reload nginx to apply configuration changes
   */
  async reloadNginx(host: string, port: number = 22, username: string = 'root'): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    try {
      // First test the config
      const testResult = await this.testNginxConfig(host, port, username);
      
      if (!testResult.success) {
        return {
          success: false,
          message: `Config test failed: ${testResult.output}`,
        };
      }

      // Reload nginx
      const command = `systemctl reload nginx 2>&1 || nginx -s reload 2>&1`;
      await this.executeCommand(config, command);

      return {
        success: true,
        message: 'Nginx reloaded successfully',
      };
    } catch (error) {
      console.error('Error reloading nginx:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reload nginx',
      };
    }
  }

  /**
   * List all WireGuard interfaces on a host
   */
  async listWireGuardInterfaces(host: string, port: number = 22, username: string = 'root'): Promise<WireGuardInterfaceInfo[]> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    try {
      // Step 1: List config files (simple ls command)
      const listCommand = `ls /etc/wireguard/*.conf 2>/dev/null || true`;
      const fileList = await this.executeCommand(config, listCommand);
      
      if (!fileList || !fileList.trim()) {
        return [];
      }

      const files = fileList.split('\n').filter(f => f.trim());
      
      // Step 2: Read all files and get pubkeys in one command
      // Build a simple script that cats each file with markers
      const catCommands = files.map(f => {
        const name = f.split('/').pop()?.replace('.conf', '') || '';
        return `echo "===FILE:${name}==="; cat "${f}"; echo "===ENDFILE==="`;
      }).join('; ');
      
      const contentOutput = await this.executeCommand(config, catCommands);
      
      // Step 3: Parse the output
      const interfaces: WireGuardInterfaceInfo[] = [];
      const fileBlocks = contentOutput.split('===FILE:').filter(block => block.trim());
      
      for (const block of fileBlocks) {
        const endMarker = block.indexOf('===ENDFILE===');
        if (endMarker === -1) continue;
        
        const firstNewline = block.indexOf('\n');
        if (firstNewline === -1) continue;
        
        const name = block.substring(0, firstNewline).replace('===', '').trim();
        const content = block.substring(firstNewline + 1, endMarker);
        
        // Parse Address
        const addressMatch = content.match(/Address\s*=\s*([^\n]+)/);
        const address = addressMatch ? addressMatch[1].trim() : '';
        
        // Parse ListenPort
        const listenPortMatch = content.match(/ListenPort\s*=\s*(\d+)/);
        const listenPort = listenPortMatch ? parseInt(listenPortMatch[1], 10) : 0;
        
        // Parse PrivateKey to derive PublicKey
        const privateKeyMatch = content.match(/PrivateKey\s*=\s*([^\n]+)/);
        let publicKey = '';
        if (privateKeyMatch) {
          try {
            const privKey = privateKeyMatch[1].trim();
            const pubKeyCmd = `echo "${privKey}" | wg pubkey`;
            publicKey = (await this.executeCommand(config, pubKeyCmd)).trim();
          } catch {
            // Ignore pubkey derivation errors
          }
        }
        
        // Count peers
        const peerCount = (content.match(/\[Peer\]/g) || []).length;

        interfaces.push({
          name,
          address,
          listenPort,
          publicKey,
          peerCount,
        });
      }

      return interfaces;
    } catch (error) {
      // Don't log here - let the caller handle it
      throw error;
    }
  }

  /**
   * Get detailed info for a specific WireGuard interface
   */
  async getWireGuardInterface(host: string, port: number = 22, username: string = 'root', interfaceName: string): Promise<WireGuardInterfaceDetail | null> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    // Sanitize interface name
    const sanitizedName = interfaceName.replace(/[^a-zA-Z0-9_-]/g, '');
    const filepath = `/etc/wireguard/${sanitizedName}.conf`;

    try {
      // Read the config file
      const content = await this.executeCommand(config, `cat "${filepath}"`);
      
      // Parse Address
      const addressMatch = content.match(/Address\s*=\s*([^\n]+)/);
      const address = addressMatch ? addressMatch[1].trim() : '';
      
      // Parse ListenPort
      const listenPortMatch = content.match(/ListenPort\s*=\s*(\d+)/);
      const listenPort = listenPortMatch ? parseInt(listenPortMatch[1], 10) : 0;
      
      // Parse PrivateKey and derive PublicKey
      const privateKeyMatch = content.match(/PrivateKey\s*=\s*([^\n]+)/);
      let publicKey = '';
      if (privateKeyMatch) {
        try {
          const privKey = privateKeyMatch[1].trim();
          const pubKeyCmd = `echo "${privKey}" | wg pubkey`;
          publicKey = (await this.executeCommand(config, pubKeyCmd)).trim();
        } catch {
          // Ignore pubkey derivation errors
        }
      }
      
      // Parse peers from config
      const peers: WireGuardPeerConfig[] = [];
      const peerBlocks = content.split(/\[Peer\]/g).slice(1);
      
      for (const block of peerBlocks) {
        const nameMatch = block.match(/#\s*([^\n]+)/);
        const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
        
        const pubKeyMatch = block.match(/PublicKey\s*=\s*([^\n]+)/);
        const peerPublicKey = pubKeyMatch ? pubKeyMatch[1].trim() : '';
        
        const allowedIpsMatch = block.match(/AllowedIPs\s*=\s*([^\n]+)/);
        const allowedIps = allowedIpsMatch ? allowedIpsMatch[1].trim() : '';

        if (peerPublicKey) {
          peers.push({
            name,
            publicKey: peerPublicKey,
            allowedIps,
          });
        }
      }

      // Get runtime status
      const runtimeStatus = await this.getWireGuardStatus(host, port, username);
      const runtimePeers = runtimeStatus?.interface === sanitizedName ? runtimeStatus.peers : [];

      return {
        name: sanitizedName,
        address,
        listenPort,
        publicKey,
        peers,
        runtimePeers,
      };
    } catch (error) {
      console.error('Error getting WireGuard interface:', error);
      throw error;
    }
  }

  /**
   * Generate a new WireGuard client
   */
  async generateWireGuardClient(
    host: string,
    port: number = 22,
    username: string = 'root',
    interfaceName: string,
    clientName: string,
    serverEndpointHost: string
  ): Promise<GeneratedWireGuardClient> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    // Sanitize inputs
    const sanitizedInterfaceName = interfaceName.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, '');
    const filepath = `/etc/wireguard/${sanitizedInterfaceName}.conf`;

    try {
      // Read current config to get server info and find next available IP
      const readCommand = `cat "${filepath}"`;
      const content = await this.executeCommand(config, readCommand);
      
      // Parse server Address to get subnet
      const addressMatch = content.match(/Address\s*=\s*([^\n]+)/);
      if (!addressMatch) {
        throw new Error('Could not parse server address from config');
      }
      const serverAddress = addressMatch[1].trim();
      // Extract base IP and subnet (e.g., "10.12.12.1/24" -> "10.12.12" and "24")
      const [serverIp, subnet] = serverAddress.split('/');
      const ipParts = serverIp.split('.');
      const baseIp = ipParts.slice(0, 3).join('.');
      
      // Parse ListenPort
      const listenPortMatch = content.match(/ListenPort\s*=\s*(\d+)/);
      const listenPort = listenPortMatch ? parseInt(listenPortMatch[1], 10) : 51820;
      
      // Get server public key
      const privateKeyMatch = content.match(/PrivateKey\s*=\s*([^\n]+)/);
      if (!privateKeyMatch) {
        throw new Error('Could not parse server private key from config');
      }
      const serverPrivKey = privateKeyMatch[1].trim();
      const pubKeyCommand = `echo "${serverPrivKey}" | wg pubkey`;
      const serverPublicKey = (await this.executeCommand(config, pubKeyCommand)).trim();
      
      // Find all used IPs
      const usedIps: number[] = [];
      // Server IP
      usedIps.push(parseInt(ipParts[3], 10));
      // Peer IPs
      const allowedIpsMatches = content.matchAll(/AllowedIPs\s*=\s*([^\n]+)/g);
      for (const match of allowedIpsMatches) {
        const peerIp = match[1].trim().split('/')[0];
        const lastOctet = parseInt(peerIp.split('.')[3], 10);
        if (!isNaN(lastOctet)) {
          usedIps.push(lastOctet);
        }
      }
      
      // Find next available IP
      let nextIp = 2; // Start from .2
      while (usedIps.includes(nextIp) && nextIp < 255) {
        nextIp++;
      }
      if (nextIp >= 255) {
        throw new Error('No available IP addresses in subnet');
      }
      
      const clientIp = `${baseIp}.${nextIp}`;
      const clientAddress = `${clientIp}/32`;
      const allowedIps = `${baseIp}.0/${subnet}`;
      
      // Generate client keypair
      const genKeyCommand = `wg genkey`;
      const clientPrivateKey = (await this.executeCommand(config, genKeyCommand)).trim();
      const clientPubKeyCommand = `echo "${clientPrivateKey}" | wg pubkey`;
      const clientPublicKey = (await this.executeCommand(config, clientPubKeyCommand)).trim();
      
      // Add peer to server config
      const peerConfig = `
[Peer]
# ${sanitizedClientName}
PublicKey = ${clientPublicKey}
AllowedIPs = ${clientAddress}
`;
      
      const appendCommand = `echo '${peerConfig}' >> "${filepath}"`;
      await this.executeCommand(config, appendCommand);
      
      // Sync the config to the running interface (if it's up)
      const syncCommand = `wg syncconf ${sanitizedInterfaceName} <(wg-quick strip ${sanitizedInterfaceName}) 2>/dev/null || true`;
      await this.executeCommand(config, syncCommand);
      
      // Build client config
      const endpoint = `${serverEndpointHost}:${listenPort}`;
      const persistentKeepalive = 25;
      
      const configText = `[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientAddress}

[Peer]
PublicKey = ${serverPublicKey}
AllowedIPs = ${allowedIps}
Endpoint = ${endpoint}
PersistentKeepalive = ${persistentKeepalive}`;

      // Build one-liner
      const oneLiner = `echo '[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientAddress}

[Peer]
PublicKey = ${serverPublicKey}
AllowedIPs = ${allowedIps}
Endpoint = ${endpoint}
PersistentKeepalive = ${persistentKeepalive}' | sudo tee /etc/wireguard/${sanitizedInterfaceName}.conf && sudo wg-quick up ${sanitizedInterfaceName}`;

      // Invalidate cache
      await cacheService.del(`wireguard:${host}:${port}`);

      return {
        clientName: sanitizedClientName,
        privateKey: clientPrivateKey,
        publicKey: clientPublicKey,
        address: clientAddress,
        serverPublicKey,
        endpoint,
        allowedIps,
        persistentKeepalive,
        interfaceName: sanitizedInterfaceName,
        configText,
        oneLiner,
      };
    } catch (error) {
      console.error('Error generating WireGuard client:', error);
      throw error;
    }
  }

  /**
   * Remove a WireGuard peer from an interface
   */
  async removeWireGuardPeer(
    host: string,
    port: number = 22,
    username: string = 'root',
    interfaceName: string,
    peerPublicKey: string
  ): Promise<{ success: boolean; message: string }> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      throw new Error('SSH key not configured. Please add an SSH key in Settings.');
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    // Sanitize inputs
    const sanitizedInterfaceName = interfaceName.replace(/[^a-zA-Z0-9_-]/g, '');
    const filepath = `/etc/wireguard/${sanitizedInterfaceName}.conf`;

    try {
      // Read current config
      const readCommand = `cat "${filepath}"`;
      const content = await this.executeCommand(config, readCommand);
      
      // Find and remove the peer block
      // We need to remove from the [Peer] line (and any comment above it) to the next [Peer] or end of file
      const lines = content.split('\n');
      const newLines: string[] = [];
      let skipUntilNextPeer = false;
      let foundPeer = false;
      let commentBuffer: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Check if this is a comment line (potential peer name)
        if (trimmedLine.startsWith('#') && !skipUntilNextPeer) {
          commentBuffer.push(line);
          continue;
        }
        
        // Check if this is a [Peer] line
        if (trimmedLine === '[Peer]') {
          // Look ahead to see if this peer has the public key we're looking for
          let isPeerToRemove = false;
          for (let j = i + 1; j < lines.length && !lines[j].trim().startsWith('['); j++) {
            const peerLine = lines[j].trim();
            if (peerLine.startsWith('PublicKey') && peerLine.includes(peerPublicKey)) {
              isPeerToRemove = true;
              break;
            }
          }
          
          if (isPeerToRemove) {
            // Skip this peer block (don't add comment buffer or [Peer] line)
            skipUntilNextPeer = true;
            foundPeer = true;
            commentBuffer = [];
            continue;
          } else {
            // Keep this peer, add any buffered comments
            newLines.push(...commentBuffer);
            commentBuffer = [];
            newLines.push(line);
            continue;
          }
        }
        
        // If we're skipping, check if we've reached the next section
        if (skipUntilNextPeer) {
          if (trimmedLine.startsWith('[')) {
            skipUntilNextPeer = false;
            newLines.push(line);
          }
          // Otherwise, skip this line
          continue;
        }
        
        // Add any buffered comments (for non-peer sections)
        if (commentBuffer.length > 0) {
          newLines.push(...commentBuffer);
          commentBuffer = [];
        }
        
        newLines.push(line);
      }
      
      if (!foundPeer) {
        return {
          success: false,
          message: 'Peer not found in configuration',
        };
      }
      
      // Write the new config
      const newContent = newLines.join('\n').replace(/\n{3,}/g, '\n\n'); // Clean up extra newlines
      const writeCommand = `cat > "${filepath}" << 'WIREGUARD_CONFIG_EOF'
${newContent}
WIREGUARD_CONFIG_EOF`;
      
      await this.executeCommand(config, writeCommand);
      
      // Remove peer from running interface
      const removeCommand = `wg set ${sanitizedInterfaceName} peer ${peerPublicKey} remove 2>/dev/null || true`;
      await this.executeCommand(config, removeCommand);
      
      // Invalidate cache
      await cacheService.del(`wireguard:${host}:${port}`);

      return {
        success: true,
        message: 'Peer removed successfully',
      };
    } catch (error) {
      console.error('Error removing WireGuard peer:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove peer',
      };
    }
  }

  /**
   * Restart a node via SSH
   */
  async restartNode(host: string, port: number = 22, username: string = 'root'): Promise<{ success: boolean; message: string }> {
    const cacheKey = `ssh:restart:${host}`;
    
    // Prevent multiple restart attempts
    const cached = await cacheService.get<{ inProgress: boolean }>(cacheKey);
    if (cached?.inProgress) {
      return { success: false, message: 'Restart already in progress' };
    }

    try {
      await cacheService.set(cacheKey, { inProgress: true }, 60); // 60 second cooldown

      const privateKey = await monitoringController.getDecryptedSSHKey();
      
      if (!privateKey) {
        throw new Error('SSH key not configured. Please add an SSH key in Settings.');
      }

      const config: SSHConnectionConfig = { host, port, username, privateKey };
      
      // Execute reboot command (without sudo, assuming root or user with reboot permissions)
      // Using nohup and background to ensure command executes even if SSH connection drops
      await this.executeCommand(config, 'nohup reboot &');
      
      return {
        success: true,
        message: `Restart command sent to ${host}`,
      };
    } catch (error) {
      console.error('Error restarting node:', error);
      await cacheService.del(cacheKey);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restart node',
      };
    }
  }

  /**
   * Invalidate cache for a specific host
   * @param host The host to invalidate cache for
   * @param port Optional port (if not provided, invalidates all ports for the host)
   */
  async invalidateCache(host: string, port?: number): Promise<number> {
    if (port !== undefined) {
      // Invalidate cache for specific host:port combination
      const patterns = [
        `docker:${host}:${port}`,
        `nginx:${host}:${port}`,
        `wireguard:${host}:${port}`,
      ];
      console.log(`[SSH Service] Invalidating cache for ${host}:${port}`);
      return await cacheService.delMultiple(patterns);
    } else {
      // Invalidate all cache entries for this host (all ports)
      console.log(`[SSH Service] Invalidating all cache for ${host}`);
      return await cacheService.delPattern(`:${host}:`);
    }
  }

  /**
   * Invalidate all SSH-related cache
   */
  async invalidateAllCache(): Promise<void> {
    console.log('[SSH Service] Invalidating all SSH cache');
    const patterns = ['docker:*', 'nginx:*', 'wireguard:*'];
    for (const pattern of patterns) {
      await cacheService.delPattern(pattern);
    }
  }
}

export const sshService = new SSHService();
