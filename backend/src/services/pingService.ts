import ping from 'ping';
import type { NodeStatus, PingResult } from '../types/index.js';

// Number of packets to send per ping check
const PACKET_COUNT = 4;

export class PingService {
  /**
   * Calculate standard deviation (jitter) from an array of numbers
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Ping a host with multiple packets and return detailed metrics
   * @param nodeId - The node ID
   * @param host - The host to ping
   * @param _port - Reserved for future TCP ping support
   */
  async pingHost(nodeId: string, host: string, _port?: number): Promise<PingResult> {
    const timestamp = new Date().toISOString();
    
    try {
      // Send multiple ping packets
      const result = await ping.promise.probe(host, {
        timeout: 10,
        extra: ['-c', String(PACKET_COUNT)],
      });

      // Parse the output to get individual packet times
      const latencies: number[] = [];
      
      // Try to parse individual RTT values from output
      // ping output format varies by OS, but typically includes lines like:
      // "64 bytes from host: icmp_seq=1 ttl=64 time=1.23 ms"
      if (result.output) {
        const timeMatches = result.output.match(/time[=<](\d+\.?\d*)\s*ms/gi);
        if (timeMatches) {
          for (const match of timeMatches) {
            const timeValue = match.match(/(\d+\.?\d*)/);
            if (timeValue) {
              latencies.push(parseFloat(timeValue[1]));
            }
          }
        }
      }

      // Parse packet statistics from output
      // Format: "4 packets transmitted, 4 received, 0% packet loss"
      let packetsTransmitted = PACKET_COUNT;
      let packetsReceived = result.alive ? PACKET_COUNT : 0;
      
      if (result.output) {
        const statsMatch = result.output.match(/(\d+)\s+packets?\s+transmitted,\s+(\d+)\s+(?:packets?\s+)?received/i);
        if (statsMatch) {
          packetsTransmitted = parseInt(statsMatch[1], 10);
          packetsReceived = parseInt(statsMatch[2], 10);
        }
      }

      const packetLoss = packetsTransmitted > 0 
        ? ((packetsTransmitted - packetsReceived) / packetsTransmitted) * 100 
        : 100;

      // Determine status based on packet loss
      let status: NodeStatus;
      if (packetsReceived === 0) {
        status = 'offline';
      } else if (packetLoss > 50) {
        status = 'offline'; // More than 50% packet loss = effectively offline
      } else {
        status = 'online';
      }

      // Calculate latency statistics
      let latencyAvg: number | undefined;
      let latencyMin: number | undefined;
      let latencyMax: number | undefined;
      let jitter: number | undefined;

      if (latencies.length > 0) {
        latencyAvg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length * 100) / 100;
        latencyMin = Math.round(Math.min(...latencies) * 100) / 100;
        latencyMax = Math.round(Math.max(...latencies) * 100) / 100;
        jitter = Math.round(this.calculateStdDev(latencies) * 100) / 100;
      } else if (result.alive && result.time !== 'unknown') {
        // Fallback to single time value if parsing failed
        const time = typeof result.time === 'number' ? result.time : parseFloat(result.time);
        if (!isNaN(time)) {
          latencyAvg = Math.round(time * 100) / 100;
          latencyMin = latencyAvg;
          latencyMax = latencyAvg;
          jitter = 0;
        }
      }

      return {
        nodeId,
        status,
        latency: latencyAvg, // For backward compatibility
        latencyAvg,
        latencyMin,
        latencyMax,
        jitter,
        packetLoss: Math.round(packetLoss * 100) / 100,
        packetsTransmitted,
        packetsReceived,
        timestamp,
      };
    } catch (error) {
      console.error(`Error pinging ${host}:`, error);
      return {
        nodeId,
        status: 'offline',
        packetLoss: 100,
        packetsTransmitted: PACKET_COUNT,
        packetsReceived: 0,
        timestamp,
      };
    }
  }

  /**
   * Ping multiple hosts in parallel
   */
  async pingMultiple(nodes: Array<{ id: string; host: string; port?: number }>): Promise<PingResult[]> {
    const pingPromises = nodes.map(node => this.pingHost(node.id, node.host, node.port));
    return Promise.all(pingPromises);
  }
}

export const pingService = new PingService();
