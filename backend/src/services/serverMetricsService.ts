import { sshService, type SSHConnectionConfig } from './sshService.js';
import { monitoringController } from '../controllers/monitoringController.js';

export interface ServerMetrics {
  timestamp: string;
  nodeId: string;
  // CPU
  cpuUsage: number;           // percentage 0-100
  cpuLoad1m: number;          // load average
  cpuLoad5m: number;
  cpuLoad15m: number;
  // Memory (bytes)
  memoryTotal: number;
  memoryUsed: number;
  memoryFree: number;
  memoryCached: number;
  memoryBuffers: number;
  memoryUsedPercent: number;  // percentage 0-100
  // Swap (bytes)
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
  // Disk I/O (cumulative since boot, we'll calculate rates)
  diskReadBytes: number;
  diskWriteBytes: number;
  // Network (cumulative since boot)
  networkRxBytes: number;
  networkTxBytes: number;
  networkRxPackets: number;
  networkTxPackets: number;
  // System
  uptimeSeconds: number;
  processesTotal: number;
}

class ServerMetricsService {
  /**
   * Collect metrics from a server via SSH
   */
  async collectMetrics(
    nodeId: string,
    host: string,
    port: number = 22,
    username: string = 'root'
  ): Promise<ServerMetrics | null> {
    const privateKey = await monitoringController.getDecryptedSSHKey();
    
    if (!privateKey) {
      console.error('SSH key not configured for server metrics collection');
      return null;
    }

    const config: SSHConnectionConfig = {
      host,
      port,
      username,
      privateKey,
    };

    // Single command to collect all metrics efficiently
    const command = `
      echo "===LOADAVG==="
      cat /proc/loadavg
      echo "===STAT==="
      head -1 /proc/stat
      echo "===MEMINFO==="
      cat /proc/meminfo | grep -E '^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):'
      echo "===UPTIME==="
      cat /proc/uptime
      echo "===DISKSTATS==="
      cat /proc/diskstats | grep -E ' (sd[a-z]|nvme[0-9]+n[0-9]+|vd[a-z]) ' | head -5
      echo "===NETDEV==="
      cat /proc/net/dev | grep -E '^\\s*(eth|ens|enp|wlan|wlp)'
      echo "===PROCESSES==="
      ls -d /proc/[0-9]* 2>/dev/null | wc -l
      echo "===END==="
    `;

    try {
      const output = await sshService.executeCommand(config, command);
      return this.parseMetricsOutput(nodeId, output);
    } catch (error: any) {
      // Silently handle common connection errors (host unreachable, connection refused, timeout)
      const isConnectionError = error?.code === 'EHOSTUNREACH' || 
                                error?.code === 'ECONNREFUSED' ||
                                error?.code === 'ETIMEDOUT' ||
                                error?.level === 'client-socket' ||
                                error?.level === 'client-timeout';
      
      if (!isConnectionError) {
        // Only log unexpected errors
        console.error(`Failed to collect metrics from ${host}:`, error.message || error);
      }
      return null;
    }
  }

  /**
   * Parse the combined output from the metrics collection command
   */
  private parseMetricsOutput(nodeId: string, output: string): ServerMetrics {
    const sections = this.parseSections(output);
    const timestamp = new Date().toISOString();

    // Parse load average
    const loadAvg = this.parseLoadAvg(sections['LOADAVG'] || '');
    
    // Parse CPU usage from /proc/stat
    const cpuUsage = this.parseCpuUsage(sections['STAT'] || '');
    
    // Parse memory info
    const memInfo = this.parseMemInfo(sections['MEMINFO'] || '');
    
    // Parse uptime
    const uptime = this.parseUptime(sections['UPTIME'] || '');
    
    // Parse disk stats
    const diskStats = this.parseDiskStats(sections['DISKSTATS'] || '');
    
    // Parse network stats
    const netStats = this.parseNetStats(sections['NETDEV'] || '');
    
    // Parse process count
    const processCount = parseInt(sections['PROCESSES']?.trim() || '0', 10);

    return {
      timestamp,
      nodeId,
      cpuUsage,
      cpuLoad1m: loadAvg.load1m,
      cpuLoad5m: loadAvg.load5m,
      cpuLoad15m: loadAvg.load15m,
      memoryTotal: memInfo.total,
      memoryUsed: memInfo.used,
      memoryFree: memInfo.free,
      memoryCached: memInfo.cached,
      memoryBuffers: memInfo.buffers,
      memoryUsedPercent: memInfo.usedPercent,
      swapTotal: memInfo.swapTotal,
      swapUsed: memInfo.swapUsed,
      swapFree: memInfo.swapFree,
      diskReadBytes: diskStats.readBytes,
      diskWriteBytes: diskStats.writeBytes,
      networkRxBytes: netStats.rxBytes,
      networkTxBytes: netStats.txBytes,
      networkRxPackets: netStats.rxPackets,
      networkTxPackets: netStats.txPackets,
      uptimeSeconds: uptime,
      processesTotal: processCount,
    };
  }

  private parseSections(output: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = output.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('===') && line.endsWith('===')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n');
        }
        currentSection = line.replace(/===/g, '');
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    return sections;
  }

  private parseLoadAvg(data: string): { load1m: number; load5m: number; load15m: number } {
    const parts = data.trim().split(/\s+/);
    return {
      load1m: parseFloat(parts[0]) || 0,
      load5m: parseFloat(parts[1]) || 0,
      load15m: parseFloat(parts[2]) || 0,
    };
  }

  private parseCpuUsage(data: string): number {
    // Parse: cpu  user nice system idle iowait irq softirq steal guest guest_nice
    const match = data.match(/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (!match) return 0;

    const user = parseInt(match[1], 10);
    const nice = parseInt(match[2], 10);
    const system = parseInt(match[3], 10);
    const idle = parseInt(match[4], 10);
    const iowait = parseInt(match[5], 10);
    const irq = parseInt(match[6], 10);
    const softirq = parseInt(match[7], 10);
    const steal = parseInt(match[8], 10);

    const total = user + nice + system + idle + iowait + irq + softirq + steal;
    const active = total - idle - iowait;

    return total > 0 ? Math.round((active / total) * 10000) / 100 : 0;
  }

  private parseMemInfo(data: string): {
    total: number;
    used: number;
    free: number;
    cached: number;
    buffers: number;
    usedPercent: number;
    swapTotal: number;
    swapUsed: number;
    swapFree: number;
  } {
    const values: Record<string, number> = {};
    
    for (const line of data.split('\n')) {
      const match = line.match(/^(\w+):\s+(\d+)/);
      if (match) {
        // Values are in kB, convert to bytes
        values[match[1]] = parseInt(match[2], 10) * 1024;
      }
    }

    const total = values['MemTotal'] || 0;
    const free = values['MemFree'] || 0;
    const buffers = values['Buffers'] || 0;
    const cached = values['Cached'] || 0;
    const available = values['MemAvailable'] || (free + buffers + cached);
    const used = total - available;
    const swapTotal = values['SwapTotal'] || 0;
    const swapFree = values['SwapFree'] || 0;

    return {
      total,
      used,
      free,
      cached,
      buffers,
      usedPercent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
      swapTotal,
      swapUsed: swapTotal - swapFree,
      swapFree,
    };
  }

  private parseUptime(data: string): number {
    const parts = data.trim().split(/\s+/);
    return Math.floor(parseFloat(parts[0]) || 0);
  }

  private parseDiskStats(data: string): { readBytes: number; writeBytes: number } {
    let readSectors = 0;
    let writeSectors = 0;

    for (const line of data.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 14) {
        // Fields: major minor name reads_completed reads_merged sectors_read ms_reading writes_completed writes_merged sectors_written ms_writing ios_in_progress ms_io weighted_ms_io
        readSectors += parseInt(parts[5], 10) || 0;
        writeSectors += parseInt(parts[9], 10) || 0;
      }
    }

    // Sector size is typically 512 bytes
    return {
      readBytes: readSectors * 512,
      writeBytes: writeSectors * 512,
    };
  }

  private parseNetStats(data: string): {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
  } {
    let rxBytes = 0;
    let txBytes = 0;
    let rxPackets = 0;
    let txPackets = 0;

    for (const line of data.split('\n')) {
      // Format: iface: rx_bytes rx_packets rx_errs rx_drop ... tx_bytes tx_packets tx_errs tx_drop ...
      const match = line.match(/^\s*\w+:\s*(\d+)\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)\s+(\d+)/);
      if (match) {
        rxBytes += parseInt(match[1], 10);
        rxPackets += parseInt(match[2], 10);
        txBytes += parseInt(match[3], 10);
        txPackets += parseInt(match[4], 10);
      }
    }

    return { rxBytes, txBytes, rxPackets, txPackets };
  }
}

export const serverMetricsService = new ServerMetricsService();
