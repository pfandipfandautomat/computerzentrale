import { memo, useEffect } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { Server, Router, HardDrive, Cpu, Globe, Box, Container, Lock, Shield, MemoryStick } from 'lucide-react';
import { InfraNodeData, TAG_CONFIG, NodeTag } from '@/types';
import { useInfraStore } from '@/stores/useInfraStore';
import { useMetricsStore } from '@/stores/useMetricsStore';
import { cn } from '@/lib/utils';
import NodeSparkline from './NodeSparkline';

const nodeTypeIcons = {
  server: Server,
  router: Router,
  nas: HardDrive,
  client: Cpu,
  service: Globe,
  custom: Box,
};

// Color configuration for each node type
const nodeTypeConfig = {
  server: {
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    borderColor: 'border-l-blue-500',
    ringColor: 'ring-blue-500/30',
  },
  router: {
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    borderColor: 'border-l-orange-500',
    ringColor: 'ring-orange-500/30',
  },
  nas: {
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    borderColor: 'border-l-purple-500',
    ringColor: 'ring-purple-500/30',
  },
  client: {
    iconBg: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
    borderColor: 'border-l-teal-500',
    ringColor: 'ring-teal-500/30',
  },
  service: {
    iconBg: 'bg-pink-500/20',
    iconColor: 'text-pink-400',
    borderColor: 'border-l-pink-500',
    ringColor: 'ring-pink-500/30',
  },
  custom: {
    iconBg: 'bg-slate-500/20',
    iconColor: 'text-slate-400',
    borderColor: 'border-l-slate-500',
    ringColor: 'ring-slate-500/30',
  },
};

const statusConfig = {
  online: {
    color: 'bg-emerald-500',
    glow: 'shadow-emerald-500/50',
  },
  offline: {
    color: 'bg-red-500',
    glow: 'shadow-red-500/50',
  },
  unknown: {
    color: 'bg-slate-500',
    glow: 'shadow-slate-500/50',
  },
};

const containerStateColors = {
  running: 'bg-emerald-500',
  paused: 'bg-amber-500',
  exited: 'bg-red-500',
  restarting: 'bg-blue-500',
  dead: 'bg-slate-500',
};

// Circular progress gauge component
interface CircularGaugeProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  bgColor?: string;
  icon: React.ReactNode;
  label: string;
}

const CircularGauge = ({ 
  value, 
  max = 100, 
  size = 44, 
  strokeWidth = 4, 
  color, 
  bgColor = 'stroke-secondary',
  icon,
  label 
}: CircularGaugeProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(Math.max(value, 0), max) / max;
  const offset = circumference - percent * circumference;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={bgColor}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={color}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            }}
          />
        </svg>
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-center">
        <span className="text-[10px] font-bold tabular-nums">{value.toFixed(0)}%</span>
        <span className="text-[8px] text-muted-foreground block -mt-0.5">{label}</span>
      </div>
    </div>
  );
};

const InfraNode = memo(({ id, data, selected }: NodeProps) => {
  // Type assertion to help TypeScript understand the data type
  const nodeData = data as unknown as InfraNodeData;
  
  // Extract highlighting properties
  const isHighlighted = nodeData.isHighlighted;
  const isDimmed = nodeData.isDimmed;
  const isSelected = nodeData.isSelected;
  const showMetrics = nodeData.showMetrics ?? true;
  const showDetails = nodeData.showDetails ?? true;
  
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeStatusById = useInfraStore(state => state.nodeStatusById);
  const containersByNodeId = useInfraStore(state => state.containersByNodeId);
  const proxyConfigsByNodeId = useInfraStore(state => state.proxyConfigsByNodeId);
  const wireguardStatusByNodeId = useInfraStore(state => state.wireguardStatusByNodeId);
  const interfacesByNodeId = useInfraStore(state => state.interfacesByNodeId);
  
  // Metrics store for server metrics
  const metricsAvailable = useMetricsStore(state => state.metricsAvailable);
  const latestServerMetricsByNodeId = useMetricsStore(state => state.latestServerMetricsByNodeId);
  const fetchLatestServerMetrics = useMetricsStore(state => state.fetchLatestServerMetrics);
  const checkMetricsAvailability = useMetricsStore(state => state.checkMetricsAvailability);
  
  const nodeStatus = nodeStatusById[nodeData.id];
  const containers = containersByNodeId[nodeData.id] || [];
  const proxyConfigs = proxyConfigsByNodeId[nodeData.id] || [];
  const wireguardStatus = wireguardStatusByNodeId[nodeData.id];
  const interfaces = interfacesByNodeId[nodeData.id] || [];
  const serverMetrics = latestServerMetricsByNodeId[nodeData.id];
  
  // Use status from separate store, fallback to node's initial status
  const currentStatus = nodeStatus?.status ?? nodeData.status ?? 'unknown';
  const currentLatency = nodeStatus?.latency ?? nodeData.latency;
  
  const Icon = nodeTypeIcons[nodeData.type] || Box;
  const typeConfig = nodeTypeConfig[nodeData.type] || nodeTypeConfig.custom;
  const status = statusConfig[currentStatus] || statusConfig.unknown;
  const hasContainers = containers.length > 0;
  const hasProxyConfigs = proxyConfigs.length > 0;
  const hasWireGuard = wireguardStatus && wireguardStatus.peers.length > 0;
  const isServer = nodeData.type === 'server';

  // Fetch server metrics for server nodes
  useEffect(() => {
    if (metricsAvailable === null) {
      checkMetricsAvailability();
    }
  }, [metricsAvailable, checkMetricsAvailability]);

  useEffect(() => {
    if (isServer && metricsAvailable && currentStatus === 'online') {
      // Initial fetch - subsequent updates come via WebSocket
      fetchLatestServerMetrics(nodeData.id);
    }
  }, [isServer, metricsAvailable, currentStatus, nodeData.id, fetchLatestServerMetrics]);

  const cpuUsage = serverMetrics?.metrics?.cpuUsage;
  const memoryUsage = serverMetrics?.metrics?.memoryUsedPercent;
  const hasServerMetrics = isServer && metricsAvailable && currentStatus === 'online' && 
    (cpuUsage != null || memoryUsage != null);

  // Update node internals when content that affects size changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, hasContainers, hasProxyConfigs, hasWireGuard, hasServerMetrics, interfaces.length, showMetrics, showDetails]);

  return (
    <div
      className={cn(
        'min-w-[240px] max-w-[320px] rounded-xl border border-l-[3px] bg-card/90 backdrop-blur-sm transition-all duration-200',
        typeConfig.borderColor,
        selected
          ? 'border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20'
          : 'border-border/50 hover:border-border hover:shadow-lg hover:shadow-black/20',
        // Selected node styling (emerald/green) - the node that was clicked
        isSelected && 'ring-2 ring-emerald-500/70 shadow-lg shadow-emerald-500/30',
        // Highlighted styling (primary/blue) - connected nodes (but not the selected one)
        isHighlighted === true && !isSelected && 'ring-2 ring-primary/50 shadow-lg shadow-primary/20',
        isDimmed && 'opacity-40',
      )}
    >
      {/* Universal handles - one per side, all act as source+target with loose mode */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-muted hover:!bg-primary hover:!border-primary transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-muted hover:!bg-primary hover:!border-primary transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-muted hover:!bg-primary hover:!border-primary transition-colors"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-muted hover:!bg-primary hover:!border-primary transition-colors"
      />

      {/* Header Section */}
      <div className="p-3 pb-2">
        {/* Title Row: Icon + Name + Tags */}
        <div className="flex items-center gap-2">
          {/* Icon with Status */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg ring-1",
              typeConfig.iconBg,
              typeConfig.ringColor
            )}>
              <Icon className={cn("h-4 w-4", typeConfig.iconColor)} />
            </div>
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                status.color,
                status.glow
              )}
            />
          </div>

          {/* Name */}
          <h3 className="font-semibold text-sm text-foreground truncate flex-1">
            {nodeData.name}
          </h3>

          {/* Tags - inline next to title */}
          {nodeData.tags && nodeData.tags.length > 0 && (
            <div className="flex gap-1 flex-shrink-0">
              {nodeData.tags.map((tag: NodeTag) => {
                const config = TAG_CONFIG[tag];
                const TagIcon = config?.icon;
                return (
                  <div
                    key={tag}
                    className={cn(
                      'p-1 rounded ring-1 ring-inset',
                      config?.bg || 'bg-primary/10',
                      config?.ring || 'ring-primary/20'
                    )}
                    title={config?.label || tag}
                  >
                    {TagIcon ? (
                      <TagIcon className={cn("h-3 w-3", config?.color || "text-primary")} />
                    ) : (
                      <span className={cn("text-[9px] font-medium", config?.color || "text-primary")}>
                        {(config?.label || tag).charAt(0)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Row: Host + Latency */}
        <div className="flex items-center gap-2 mt-1.5">
          {nodeData.host && (
            <span className="text-xs text-muted-foreground font-mono truncate">
              {nodeData.host}
            </span>
          )}
          {currentLatency !== undefined && currentLatency !== null && (
            <span className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0',
              currentStatus === 'online'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}>
              {currentLatency}ms
            </span>
          )}
        </div>

        {/* Network Interfaces */}
        {interfaces.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {interfaces.map((iface) => (
              <span
                key={iface.id}
                className="text-[10px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded"
              >
                {iface.address}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Server Metrics Section - Circular Gauges */}
      {showMetrics && hasServerMetrics && (
        <div className="border-t border-border/30 px-3 py-2">
          <div className="flex items-center justify-center gap-6">
            {cpuUsage != null && (
              <CircularGauge
                value={cpuUsage}
                color="stroke-blue-500"
                icon={<Cpu className="h-3.5 w-3.5 text-blue-400" />}
                label="CPU"
              />
            )}
            {memoryUsage != null && (
              <CircularGauge
                value={memoryUsage}
                color="stroke-violet-500"
                icon={<MemoryStick className="h-3.5 w-3.5 text-violet-400" />}
                label="MEM"
              />
            )}
          </div>
        </div>
      )}

      {/* Latency Sparkline */}
      {showMetrics && (
        <div className="px-3 pb-2">
          <NodeSparkline nodeId={nodeData.id} status={currentStatus} />
        </div>
      )}

      {/* Containers Section */}
      {showDetails && hasContainers && (
        <div className="border-t border-border/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Container className="h-3 w-3 text-sky-400" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {containers.length} container{containers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {containers.slice(0, 5).map((container) => (
              <div
                key={container.id}
                className="flex items-center gap-1.5 text-[10px]"
              >
                <div
                  className={cn(
                    'h-1.5 w-1.5 rounded-full flex-shrink-0',
                    containerStateColors[container.state] || 'bg-slate-500'
                  )}
                />
                <span className="truncate text-foreground/80">{container.name}</span>
              </div>
            ))}
            {containers.length > 5 && (
              <span className="text-[10px] text-muted-foreground">
                +{containers.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Proxy Configs Section */}
      {showDetails && hasProxyConfigs && (
        <div className="border-t border-border/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Globe className="h-3 w-3 text-violet-400" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {proxyConfigs.length} domain{proxyConfigs.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1 max-h-[80px] overflow-y-auto">
            {proxyConfigs.slice(0, 3).map((config, index) => (
              <div
                key={`${config.domain}-${index}`}
                className="flex items-center gap-1.5 text-[10px]"
              >
                {config.sslEnabled ? (
                  <Lock className="h-2.5 w-2.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Globe className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="truncate text-foreground/80">{config.domain}</span>
              </div>
            ))}
            {proxyConfigs.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{proxyConfigs.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* WireGuard Section */}
      {showDetails && hasWireGuard && (
        <div className="border-t border-border/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {wireguardStatus.peers.length} peer{wireguardStatus.peers.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-emerald-400">
              ({wireguardStatus.peers.filter(p => p.isOnline).length} online)
            </span>
          </div>
          <div className="space-y-1 max-h-[60px] overflow-y-auto">
            {wireguardStatus.peers.slice(0, 3).map((peer) => (
              <div
                key={peer.publicKey}
                className="flex items-center gap-1.5 text-[10px]"
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full flex-shrink-0",
                    peer.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                  )}
                />
                <span className="truncate text-foreground/80 font-mono">
                  {peer.allowedIps[0] || peer.publicKey.substring(0, 12) + '...'}
                </span>
              </div>
            ))}
            {wireguardStatus.peers.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{wireguardStatus.peers.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

InfraNode.displayName = 'InfraNode';

export default InfraNode;
