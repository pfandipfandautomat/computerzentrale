import type { NodeMetricsHistory, NodeUptime, AggregatedMetrics, MetricsStatus, ServerMetricsHistory, ServerMetricsLatest, ServerMetricsAggregated } from '@/types';

const API_BASE_URL = '/api';

class MetricsService {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Check if metrics service is available
   */
  async getStatus(): Promise<MetricsStatus> {
    return this.request<MetricsStatus>('/metrics/status');
  }

  /**
   * Get historical metrics for a node
   * @param nodeId - Node ID
   * @param range - Time range (e.g., '1h', '24h', '7d', '30d')
   */
  async getNodeHistory(nodeId: string, range: string = '1h'): Promise<NodeMetricsHistory> {
    return this.request<NodeMetricsHistory>(`/metrics/${nodeId}/history?range=${range}`);
  }

  /**
   * Get uptime statistics for a node
   * @param nodeId - Node ID
   * @param range - Time range (e.g., '24h', '7d', '30d')
   */
  async getNodeUptime(nodeId: string, range: string = '24h'): Promise<NodeUptime> {
    return this.request<NodeUptime>(`/metrics/${nodeId}/uptime?range=${range}`);
  }

  /**
   * Get aggregated metrics for a node
   * @param nodeId - Node ID
   * @param range - Time range (e.g., '7d', '30d')
   * @param window - Aggregation window (e.g., '1h', '1d')
   */
  async getAggregatedMetrics(
    nodeId: string,
    range: string = '7d',
    window: string = '1h'
  ): Promise<AggregatedMetrics> {
    return this.request<AggregatedMetrics>(`/metrics/${nodeId}/aggregated?range=${range}&window=${window}`);
  }

  /**
   * Get server metrics history for a node
   * @param nodeId - Node ID
   * @param range - Time range (e.g., '1h', '24h', '7d')
   */
  async getServerMetrics(nodeId: string, range: string = '1h'): Promise<ServerMetricsHistory> {
    return this.request<ServerMetricsHistory>(`/metrics/${nodeId}/server?range=${range}`);
  }

  /**
   * Get latest server metrics for a node
   * @param nodeId - Node ID
   */
  async getLatestServerMetrics(nodeId: string): Promise<ServerMetricsLatest> {
    return this.request<ServerMetricsLatest>(`/metrics/${nodeId}/server/latest`);
  }

  /**
   * Get aggregated server metrics for a node
   * @param nodeId - Node ID
   * @param range - Time range (e.g., '24h', '7d')
   * @param window - Aggregation window (e.g., '5m', '1h')
   */
  async getAggregatedServerMetrics(
    nodeId: string,
    range: string = '24h',
    window: string = '5m'
  ): Promise<ServerMetricsAggregated> {
    return this.request<ServerMetricsAggregated>(`/metrics/${nodeId}/server/aggregated?range=${range}&window=${window}`);
  }
}

export const metricsService = new MetricsService();
