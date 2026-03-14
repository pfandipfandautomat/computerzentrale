import { Container, Globe, Shield, type LucideIcon } from 'lucide-react';

export type NodeStatus = 'online' | 'offline' | 'unknown';
export type NodeType = 'server' | 'router' | 'nas' | 'client' | 'service' | 'custom';
export type NodeTag = 'reverse-proxy' | 'wireguard' | 'docker';
export type HandleType = 'external' | 'internal' | 'default' | 'wireguard';

export const NODE_TAGS: NodeTag[] = ['reverse-proxy', 'wireguard', 'docker'];

export const TAG_CONFIG: Record<NodeTag, { label: string; color: string; bg: string; ring: string; icon: LucideIcon }> = {
  'reverse-proxy': {
    label: 'Reverse Proxy',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    ring: 'ring-violet-500/30',
    icon: Globe,
  },
  'wireguard': {
    label: 'WireGuard',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/30',
    icon: Shield,
  },
  'docker': {
    label: 'Docker',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    ring: 'ring-sky-500/30',
    icon: Container,
  },
};

export interface NetworkInterface {
  id: string;
  nodeId: string;
  address: string;
}

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

export interface CreateProxyConfigRequest {
  domain: string;
  upstreamIp: string;
  upstreamPort: number;
}

export interface WireGuardPeer {
  publicKey: string;
  endpoint: string | null;
  allowedIps: string[];
  latestHandshake: string | null;
  transferRx: number;
  transferTx: number;
  isOnline: boolean;
}

export interface WireGuardStatus {
  interface: string;
  publicKey: string;
  listenPort: number;
  peers: WireGuardPeer[];
}

export interface WireGuardInterfaceInfo {
  name: string;
  address: string;
  listenPort: number;
  publicKey: string;
  peerCount: number;
}

export interface WireGuardPeerConfig {
  name: string;
  publicKey: string;
  allowedIps: string;
}

export interface WireGuardInterfaceDetail {
  name: string;
  address: string;
  listenPort: number;
  publicKey: string;
  peers: WireGuardPeerConfig[];
  runtimePeers: WireGuardPeer[];
}

export interface GeneratedWireGuardClient {
  clientName: string;
  privateKey: string;
  publicKey: string;
  address: string;
  serverPublicKey: string;
  endpoint: string;
  allowedIps: string;
  persistentKeepalive: number;
  interfaceName: string;
  configText: string;
  oneLiner: string;
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
  containers?: DockerContainer[];
  networkInterfaces?: NetworkInterface[];
  telegramAlerts?: boolean;
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

// React Flow specific types - following official docs pattern
// Define the node type with Node<DataType, 'typeName'>
import type { Node, Edge } from '@xyflow/react';

// Our custom node data
export type InfraNodeData = {
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
  containers?: DockerContainer[];
  networkInterfaces?: NetworkInterface[];
  telegramAlerts?: boolean;
  createdAt: string;
  updatedAt: string;
  // Highlighting properties for connected nodes
  isHighlighted?: boolean | null;
  isDimmed?: boolean;
  isSelected?: boolean;
  // Display options
  showMetrics?: boolean;
  showDetails?: boolean;
};

// Define the custom node type
export type InfraFlowNode = Node<InfraNodeData, 'infraNode'>;

// Union of all node types (include BuiltInNode if using default nodes)
export type AppNode = InfraFlowNode;

// Edge data type
export type CustomEdgeData = {
  onDelete?: (edgeId: string) => void;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  sourceStatus?: NodeStatus;
  targetStatus?: NodeStatus;
  isDimmed?: boolean;
};

// Define the custom edge type
export type InfraFlowEdge = Edge<CustomEdgeData, 'custom'>;

// Union of all edge types
export type AppEdge = InfraFlowEdge;

// Metrics types for time series data
export interface MetricDataPoint {
  timestamp: string;
  latencyAvg: number | null;
  latencyMin: number | null;
  latencyMax: number | null;
  jitter: number | null;
  packetLoss: number;
  status: number;  // 1 = online, 0 = offline
}

export interface NodeMetricsHistory {
  nodeId: string;
  nodeName: string;
  range: string;
  dataPoints: MetricDataPoint[];
}

export interface NodeUptime {
  nodeId: string;
  nodeName: string;
  range: string;
  uptimePercentage: number;
  totalChecks: number;
  successfulChecks: number;
}

export interface AggregatedMetrics {
  nodeId: string;
  nodeName: string;
  range: string;
  aggregation: 'hourly' | 'daily';
  dataPoints: MetricDataPoint[];
}

export interface MetricsStatus {
  available: boolean;
  message: string;
}

// Server metrics types
export interface ServerMetricsDataPoint {
  timestamp: string;
  // CPU
  cpuUsage: number | null;
  cpuLoad1m: number | null;
  cpuLoad5m: number | null;
  cpuLoad15m: number | null;
  // Memory
  memoryTotal: number | null;
  memoryUsed: number | null;
  memoryFree: number | null;
  memoryCached: number | null;
  memoryBuffers: number | null;
  memoryUsedPercent: number | null;
  // Swap
  swapTotal: number | null;
  swapUsed: number | null;
  swapFree: number | null;
  // Disk I/O
  diskReadBytes: number | null;
  diskWriteBytes: number | null;
  // Network
  networkRxBytes: number | null;
  networkTxBytes: number | null;
  networkRxPackets: number | null;
  networkTxPackets: number | null;
  // System
  uptimeSeconds: number | null;
  processesTotal: number | null;
}

export interface ServerMetricsHistory {
  nodeId: string;
  nodeName: string;
  range: string;
  dataPoints: ServerMetricsDataPoint[];
}

export interface ServerMetricsLatest {
  nodeId: string;
  nodeName: string;
  metrics: ServerMetricsDataPoint | null;
}

export interface ServerMetricsAggregated {
  nodeId: string;
  nodeName: string;
  range: string;
  window: string;
  dataPoints: ServerMetricsDataPoint[];
}

// Alert event type for event log
export interface AlertEvent {
  id: string;
  eventType: string;
  nodeId: string | null;
  nodeName: string | null;
  message: string;
  details: Record<string, any> | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
  alertSent: boolean;
  createdAt: string;
}

// Recharts/Tremor tooltip callback types
export interface ChartTooltipPayloadItem {
  value?: number | string | (string | number)[];
  name?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  payload?: ChartTooltipPayloadItem[];
  active?: boolean;
  label?: string | number;
}
