export type NodeStatus = 'online' | 'offline' | 'unknown';
export type NodeType = 'server' | 'router' | 'nas' | 'client' | 'service' | 'custom';
export type NodeTag = 'reverse-proxy' | 'wireguard' | 'docker';

export const NODE_TAGS: NodeTag[] = ['reverse-proxy', 'wireguard', 'docker'];

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead';
  ports: string;
}

export interface NetworkInterface {
  id: string;
  nodeId: string;
  address: string;
}

export interface InfraNode {
  id: string;
  name: string;
  host: string;
  port?: number;
  sshUser?: string;
  type: NodeType;
  tags: NodeTag[];
  description?: string;
  position: { x: number; y: number };
  status: NodeStatus;
  latency?: number;
  lastChecked?: string;
  telegramAlerts?: boolean;
  containers?: DockerContainer[];
  networkInterfaces?: NetworkInterface[];
  createdAt: string;
  updatedAt: string;
}

export interface InfraEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
  createdAt: string;
}

export interface MonitoringSettings {
  pingInterval: number;
  enabled: boolean;
  sshKey?: string;
}

// Enhanced ping result with multi-packet metrics
export interface PingResult {
  nodeId: string;
  status: NodeStatus;
  latency?: number;        // Average latency (for backward compatibility)
  latencyMin?: number;     // Minimum latency
  latencyMax?: number;     // Maximum latency
  latencyAvg?: number;     // Average latency
  jitter?: number;         // Standard deviation of latency
  packetLoss: number;      // Packet loss percentage (0-100)
  packetsTransmitted: number;
  packetsReceived: number;
  timestamp: string;
}

// Metrics data point for time series
export interface MetricDataPoint {
  timestamp: string;
  latencyAvg: number | null;
  latencyMin: number | null;
  latencyMax: number | null;
  jitter: number | null;
  packetLoss: number;
  status: number;  // 1 = online, 0 = offline
}

// Historical metrics response
export interface NodeMetricsHistory {
  nodeId: string;
  nodeName: string;
  range: string;
  dataPoints: MetricDataPoint[];
}

// Uptime response
export interface NodeUptime {
  nodeId: string;
  nodeName: string;
  range: string;
  uptimePercentage: number;
  totalChecks: number;
  successfulChecks: number;
}

// Aggregated metrics (hourly/daily)
export interface AggregatedMetrics {
  nodeId: string;
  nodeName: string;
  range: string;
  aggregation: 'hourly' | 'daily';
  dataPoints: MetricDataPoint[];
}
