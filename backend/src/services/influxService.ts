import { InfluxDB, Point, QueryApi, WriteApi } from '@influxdata/influxdb-client';
import type { PingResult, MetricDataPoint } from '../types/index.js';
import type { ServerMetrics } from './serverMetricsService.js';

// Helper function to determine aggregation window based on time range
function getAggregationWindow(range: string): string {
  const windowMap: Record<string, string> = {
    '5m': '30s',   // was 1m (5 points) -> now ~10 points
    '15m': '30s',  // was 1m (15 points) -> now ~30 points
    '1h': '2m',    // was 5m (12 points) -> now 30 points
    '6h': '7m',    // was 15m (24 points) -> now ~51 points
    '24h': '30m',  // was 1h (24 points) -> now 48 points
    '7d': '3h',    // was 6h (28 points) -> now 56 points
    '30d': '12h',  // was 1d (30 points) -> now 60 points
  };
  return windowMap[range] || '2m';
}

class InfluxService {
  private client: InfluxDB | null = null;
  private writeApi: WriteApi | null = null;
  private queryApi: QueryApi | null = null;
  private org: string;
  private bucket: string;
  private isConnected: boolean = false;

  constructor() {
    this.org = process.env.INFLUXDB_ORG || 'computerzentrale';
    this.bucket = process.env.INFLUXDB_BUCKET || 'ping_metrics';
  }

  /**
   * Initialize InfluxDB connection
   */
  async initialize(): Promise<void> {
    const url = process.env.INFLUXDB_URL;
    const token = process.env.INFLUXDB_TOKEN;

    if (!url || !token) {
      console.warn('InfluxDB not configured - metrics will not be stored. Set INFLUXDB_URL and INFLUXDB_TOKEN.');
      return;
    }

    try {
      this.client = new InfluxDB({ url, token });
      this.writeApi = this.client.getWriteApi(this.org, this.bucket, 'ns');
      this.writeApi.useDefaultTags({ app: 'computerzentrale' });
      this.queryApi = this.client.getQueryApi(this.org);
      
      // Test connection by running a simple query
      await this.testConnection();
      this.isConnected = true;
      console.log('InfluxDB connection established');
    } catch (error) {
      console.error('Failed to connect to InfluxDB:', error);
      this.isConnected = false;
    }
  }

  /**
   * Test InfluxDB connection
   */
  private async testConnection(): Promise<void> {
    if (!this.queryApi) throw new Error('InfluxDB not initialized');
    
    const query = `buckets() |> limit(n: 1)`;
    await this.queryApi.collectRows(query);
  }

  /**
   * Check if InfluxDB is connected
   */
  isReady(): boolean {
    return this.isConnected && this.writeApi !== null;
  }

  /**
   * Write ping result to InfluxDB
   */
  async writePingResult(result: PingResult, nodeName: string, nodeType: string): Promise<void> {
    if (!this.writeApi || !this.isConnected) {
      return;
    }

    try {
      const point = new Point('ping')
        .tag('node_id', result.nodeId)
        .tag('node_name', nodeName)
        .tag('node_type', nodeType)
        .intField('status', result.status === 'online' ? 1 : 0)
        .floatField('packet_loss', result.packetLoss)
        .intField('packets_transmitted', result.packetsTransmitted)
        .intField('packets_received', result.packetsReceived)
        .timestamp(new Date(result.timestamp));

      // Only add latency fields if we have valid data
      if (result.latencyAvg !== undefined && result.latencyAvg !== null) {
        point.floatField('latency_avg', result.latencyAvg);
      }
      if (result.latencyMin !== undefined && result.latencyMin !== null) {
        point.floatField('latency_min', result.latencyMin);
      }
      if (result.latencyMax !== undefined && result.latencyMax !== null) {
        point.floatField('latency_max', result.latencyMax);
      }
      if (result.jitter !== undefined && result.jitter !== null) {
        point.floatField('jitter', result.jitter);
      }

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      console.error('Failed to write ping result to InfluxDB:', error);
    }
  }

  /**
   * Write multiple ping results
   */
  async writePingResults(results: Array<{ result: PingResult; nodeName: string; nodeType: string }>): Promise<void> {
    if (!this.writeApi || !this.isConnected) {
      return;
    }

    try {
      for (const { result, nodeName, nodeType } of results) {
        const point = new Point('ping')
          .tag('node_id', result.nodeId)
          .tag('node_name', nodeName)
          .tag('node_type', nodeType)
          .intField('status', result.status === 'online' ? 1 : 0)
          .floatField('packet_loss', result.packetLoss)
          .intField('packets_transmitted', result.packetsTransmitted)
          .intField('packets_received', result.packetsReceived)
          .timestamp(new Date(result.timestamp));

        if (result.latencyAvg !== undefined && result.latencyAvg !== null) {
          point.floatField('latency_avg', result.latencyAvg);
        }
        if (result.latencyMin !== undefined && result.latencyMin !== null) {
          point.floatField('latency_min', result.latencyMin);
        }
        if (result.latencyMax !== undefined && result.latencyMax !== null) {
          point.floatField('latency_max', result.latencyMax);
        }
        if (result.jitter !== undefined && result.jitter !== null) {
          point.floatField('jitter', result.jitter);
        }

        this.writeApi.writePoint(point);
      }
      await this.writeApi.flush();
    } catch (error) {
      console.error('Failed to write ping results to InfluxDB:', error);
    }
  }

  /**
   * Query historical metrics for a node
   */
  async getNodeHistory(nodeId: string, range: string = '1h'): Promise<MetricDataPoint[]> {
    if (!this.queryApi || !this.isConnected) {
      return [];
    }

    try {
      const windowPeriod = getAggregationWindow(range);
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${range})
          |> filter(fn: (r) => r["_measurement"] == "ping")
          |> filter(fn: (r) => r["node_id"] == "${nodeId}")
          |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false, timeSrc: "_start")
          |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      const rows = await this.queryApi.collectRows<{
        _time: string;
        latency_avg?: number;
        latency_min?: number;
        latency_max?: number;
        jitter?: number;
        packet_loss: number;
        status: number;
      }>(query);

      return rows.map(row => ({
        timestamp: row._time,
        latencyAvg: row.latency_avg ?? null,
        latencyMin: row.latency_min ?? null,
        latencyMax: row.latency_max ?? null,
        jitter: row.jitter ?? null,
        packetLoss: row.packet_loss ?? 0,
        status: row.status ?? 0,
      }));
    } catch (error) {
      console.error('Failed to query node history from InfluxDB:', error);
      return [];
    }
  }

  /**
   * Calculate uptime percentage for a node
   */
  async getNodeUptime(nodeId: string, range: string = '24h'): Promise<{ uptimePercentage: number; totalChecks: number; successfulChecks: number }> {
    if (!this.queryApi || !this.isConnected) {
      return { uptimePercentage: 0, totalChecks: 0, successfulChecks: 0 };
    }

    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${range})
          |> filter(fn: (r) => r["_measurement"] == "ping")
          |> filter(fn: (r) => r["node_id"] == "${nodeId}")
          |> filter(fn: (r) => r["_field"] == "status")
          |> group()
          |> reduce(
              identity: {total: 0, success: 0},
              fn: (r, accumulator) => ({
                total: accumulator.total + 1,
                success: accumulator.success + r._value
              })
          )
      `;

      const rows = await this.queryApi.collectRows<{ total: number; success: number }>(query);
      
      if (rows.length === 0) {
        return { uptimePercentage: 0, totalChecks: 0, successfulChecks: 0 };
      }

      const { total, success } = rows[0];
      const uptimePercentage = total > 0 ? (success / total) * 100 : 0;

      return {
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        totalChecks: total,
        successfulChecks: success,
      };
    } catch (error) {
      console.error('Failed to calculate uptime from InfluxDB:', error);
      return { uptimePercentage: 0, totalChecks: 0, successfulChecks: 0 };
    }
  }

  /**
   * Get aggregated metrics (hourly averages)
   */
  async getAggregatedMetrics(nodeId: string, range: string = '7d', windowPeriod: string = '1h'): Promise<MetricDataPoint[]> {
    if (!this.queryApi || !this.isConnected) {
      return [];
    }

    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${range})
          |> filter(fn: (r) => r["_measurement"] == "ping")
          |> filter(fn: (r) => r["node_id"] == "${nodeId}")
          |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false)
          |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      const rows = await this.queryApi.collectRows<{
        _time: string;
        latency_avg?: number;
        latency_min?: number;
        latency_max?: number;
        jitter?: number;
        packet_loss: number;
        status: number;
      }>(query);

      return rows.map(row => ({
        timestamp: row._time,
        latencyAvg: row.latency_avg ?? null,
        latencyMin: row.latency_min ?? null,
        latencyMax: row.latency_max ?? null,
        jitter: row.jitter ?? null,
        packetLoss: row.packet_loss ?? 0,
        status: row.status ?? 0,
      }));
    } catch (error) {
      console.error('Failed to query aggregated metrics from InfluxDB:', error);
      return [];
    }
  }

  /**
   * Write server metrics to InfluxDB
   */
  async writeServerMetrics(metrics: ServerMetrics, nodeName: string): Promise<void> {
    if (!this.writeApi || !this.isConnected) {
      return;
    }

    try {
      const point = new Point('server_metrics')
        .tag('node_id', metrics.nodeId)
        .tag('node_name', nodeName)
        // CPU
        .floatField('cpu_usage', metrics.cpuUsage)
        .floatField('cpu_load_1m', metrics.cpuLoad1m)
        .floatField('cpu_load_5m', metrics.cpuLoad5m)
        .floatField('cpu_load_15m', metrics.cpuLoad15m)
        // Memory
        .intField('memory_total', metrics.memoryTotal)
        .intField('memory_used', metrics.memoryUsed)
        .intField('memory_free', metrics.memoryFree)
        .intField('memory_cached', metrics.memoryCached)
        .intField('memory_buffers', metrics.memoryBuffers)
        .floatField('memory_used_percent', metrics.memoryUsedPercent)
        // Swap
        .intField('swap_total', metrics.swapTotal)
        .intField('swap_used', metrics.swapUsed)
        .intField('swap_free', metrics.swapFree)
        // Disk I/O
        .intField('disk_read_bytes', metrics.diskReadBytes)
        .intField('disk_write_bytes', metrics.diskWriteBytes)
        // Network
        .intField('network_rx_bytes', metrics.networkRxBytes)
        .intField('network_tx_bytes', metrics.networkTxBytes)
        .intField('network_rx_packets', metrics.networkRxPackets)
        .intField('network_tx_packets', metrics.networkTxPackets)
        // System
        .intField('uptime_seconds', metrics.uptimeSeconds)
        .intField('processes_total', metrics.processesTotal)
        .timestamp(new Date(metrics.timestamp));

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      console.error('Failed to write server metrics to InfluxDB:', error);
    }
  }

  /**
   * Write multiple server metrics
   */
  async writeMultipleServerMetrics(metricsArray: Array<{ metrics: ServerMetrics; nodeName: string }>): Promise<void> {
    if (!this.writeApi || !this.isConnected) {
      return;
    }

    try {
      for (const { metrics, nodeName } of metricsArray) {
        const point = new Point('server_metrics')
          .tag('node_id', metrics.nodeId)
          .tag('node_name', nodeName)
          .floatField('cpu_usage', metrics.cpuUsage)
          .floatField('cpu_load_1m', metrics.cpuLoad1m)
          .floatField('cpu_load_5m', metrics.cpuLoad5m)
          .floatField('cpu_load_15m', metrics.cpuLoad15m)
          .intField('memory_total', metrics.memoryTotal)
          .intField('memory_used', metrics.memoryUsed)
          .intField('memory_free', metrics.memoryFree)
          .intField('memory_cached', metrics.memoryCached)
          .intField('memory_buffers', metrics.memoryBuffers)
          .floatField('memory_used_percent', metrics.memoryUsedPercent)
          .intField('swap_total', metrics.swapTotal)
          .intField('swap_used', metrics.swapUsed)
          .intField('swap_free', metrics.swapFree)
          .intField('disk_read_bytes', metrics.diskReadBytes)
          .intField('disk_write_bytes', metrics.diskWriteBytes)
          .intField('network_rx_bytes', metrics.networkRxBytes)
          .intField('network_tx_bytes', metrics.networkTxBytes)
          .intField('network_rx_packets', metrics.networkRxPackets)
          .intField('network_tx_packets', metrics.networkTxPackets)
          .intField('uptime_seconds', metrics.uptimeSeconds)
          .intField('processes_total', metrics.processesTotal)
          .timestamp(new Date(metrics.timestamp));

        this.writeApi.writePoint(point);
      }
      await this.writeApi.flush();
    } catch (error) {
      console.error('Failed to write server metrics to InfluxDB:', error);
    }
  }

  /**
   * Query server metrics history for a node
   */
  async getServerMetricsHistory(nodeId: string, range: string = '1h'): Promise<any[]> {
    if (!this.queryApi || !this.isConnected) {
      return [];
    }

    try {
      const windowPeriod = getAggregationWindow(range);
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${range})
          |> filter(fn: (r) => r["_measurement"] == "server_metrics")
          |> filter(fn: (r) => r["node_id"] == "${nodeId}")
          |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false, timeSrc: "_start")
          |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      const rows = await this.queryApi.collectRows(query);
      return rows.map((row: any) => ({
        timestamp: row._time,
        cpuUsage: row.cpu_usage ?? null,
        cpuLoad1m: row.cpu_load_1m ?? null,
        cpuLoad5m: row.cpu_load_5m ?? null,
        cpuLoad15m: row.cpu_load_15m ?? null,
        memoryTotal: row.memory_total ?? null,
        memoryUsed: row.memory_used ?? null,
        memoryFree: row.memory_free ?? null,
        memoryCached: row.memory_cached ?? null,
        memoryBuffers: row.memory_buffers ?? null,
        memoryUsedPercent: row.memory_used_percent ?? null,
        swapTotal: row.swap_total ?? null,
        swapUsed: row.swap_used ?? null,
        swapFree: row.swap_free ?? null,
        diskReadBytes: row.disk_read_bytes ?? null,
        diskWriteBytes: row.disk_write_bytes ?? null,
        networkRxBytes: row.network_rx_bytes ?? null,
        networkTxBytes: row.network_tx_bytes ?? null,
        networkRxPackets: row.network_rx_packets ?? null,
        networkTxPackets: row.network_tx_packets ?? null,
        uptimeSeconds: row.uptime_seconds ?? null,
        processesTotal: row.processes_total ?? null,
      }));
    } catch (error) {
      console.error('Failed to query server metrics from InfluxDB:', error);
      return [];
    }
  }

  /**
   * Get latest server metrics for a node
   */
  async getLatestServerMetrics(nodeId: string): Promise<any | null> {
    if (!this.queryApi || !this.isConnected) {
      return null;
    }

    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -5m)
          |> filter(fn: (r) => r["_measurement"] == "server_metrics")
          |> filter(fn: (r) => r["node_id"] == "${nodeId}")
          |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 1)
      `;

      const rows = await this.queryApi.collectRows(query);
      if (rows.length === 0) return null;

      const row: any = rows[0];
      return {
        timestamp: row._time,
        cpuUsage: row.cpu_usage ?? null,
        cpuLoad1m: row.cpu_load_1m ?? null,
        cpuLoad5m: row.cpu_load_5m ?? null,
        cpuLoad15m: row.cpu_load_15m ?? null,
        memoryTotal: row.memory_total ?? null,
        memoryUsed: row.memory_used ?? null,
        memoryFree: row.memory_free ?? null,
        memoryCached: row.memory_cached ?? null,
        memoryBuffers: row.memory_buffers ?? null,
        memoryUsedPercent: row.memory_used_percent ?? null,
        swapTotal: row.swap_total ?? null,
        swapUsed: row.swap_used ?? null,
        swapFree: row.swap_free ?? null,
        diskReadBytes: row.disk_read_bytes ?? null,
        diskWriteBytes: row.disk_write_bytes ?? null,
        networkRxBytes: row.network_rx_bytes ?? null,
        networkTxBytes: row.network_tx_bytes ?? null,
        networkRxPackets: row.network_rx_packets ?? null,
        networkTxPackets: row.network_tx_packets ?? null,
        uptimeSeconds: row.uptime_seconds ?? null,
        processesTotal: row.processes_total ?? null,
      };
    } catch (error) {
      console.error('Failed to query latest server metrics from InfluxDB:', error);
      return null;
    }
  }

  /**
   * Get aggregated server metrics
   */
  async getAggregatedServerMetrics(nodeId: string, range: string = '24h', windowPeriod: string = '5m'): Promise<any[]> {
    if (!this.queryApi || !this.isConnected) {
      return [];
    }

    try {
      const query = `
        from(bucket: "${this.bucket}")
          |> range(start: -${range})
          |> filter(fn: (r) => r["_measurement"] == "server_metrics")
          |> filter(fn: (r) => r["node_id"] == "${nodeId}")
          |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false)
          |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
      `;

      const rows = await this.queryApi.collectRows(query);
      return rows.map((row: any) => ({
        timestamp: row._time,
        cpuUsage: row.cpu_usage ?? null,
        cpuLoad1m: row.cpu_load_1m ?? null,
        cpuLoad5m: row.cpu_load_5m ?? null,
        cpuLoad15m: row.cpu_load_15m ?? null,
        memoryUsedPercent: row.memory_used_percent ?? null,
        memoryUsed: row.memory_used ?? null,
        diskReadBytes: row.disk_read_bytes ?? null,
        diskWriteBytes: row.disk_write_bytes ?? null,
        networkRxBytes: row.network_rx_bytes ?? null,
        networkTxBytes: row.network_tx_bytes ?? null,
      }));
    } catch (error) {
      console.error('Failed to query aggregated server metrics from InfluxDB:', error);
      return [];
    }
  }

  /**
   * Close InfluxDB connection
   */
  async close(): Promise<void> {
    if (this.writeApi) {
      await this.writeApi.close();
    }
    this.isConnected = false;
    console.log('InfluxDB connection closed');
  }
}

export const influxService = new InfluxService();
