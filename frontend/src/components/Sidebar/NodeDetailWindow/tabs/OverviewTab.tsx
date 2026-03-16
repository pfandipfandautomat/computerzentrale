import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Globe, Shield, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { MetricsPanel } from '@/components/NodeDetail/MetricsPanel';
import { TimeRangeSelector, type TimeRange } from '@/components/NodeDetail/MetricsPanel/TimeRangeSelector';
import { MetricSelector, type MetricType } from '@/components/NodeDetail/MetricsPanel/MetricSelector';
import {
  useLatestServerMetricsByNodeId,
  useUptimeByNodeId,
  useSparklineByNodeId,
  useLoadingSparkline,
  useServerMetricsByNodeId,
  useLoadingServerMetrics,
  useMetricsActions,
} from '@/stores/useMetricsStore';
import { cn } from '@/lib/utils';
import type { InfraNode, DockerContainer, ReverseProxyConfig, WireGuardStatus, GPUModel } from '@/types';
import { TAG_CONFIG as TAG_CONFIG_IMPORT } from '@/types';

interface OverviewTabProps {
  nodeId: string;
  node: InfraNode;
  status: 'online' | 'offline' | 'unknown';
  latency?: number;
  containers: DockerContainer[];
  proxyConfigs: ReverseProxyConfig[];
  wireguardStatus: WireGuardStatus | undefined;
  gpuModels?: GPUModel[];
}

export function OverviewTab({
  nodeId,
  node,
  status,
  latency,
  containers,
  proxyConfigs,
  wireguardStatus,
  gpuModels,
}: OverviewTabProps) {
  const navigate = useNavigate();

  // Metrics store
  const latestServerMetricsByNodeId = useLatestServerMetricsByNodeId();
  const uptimeByNodeId = useUptimeByNodeId();
  const sparklineByNodeId = useSparklineByNodeId();
  const loadingSparkline = useLoadingSparkline();
  const serverMetricsByNodeId = useServerMetricsByNodeId();
  const loadingServerMetrics = useLoadingServerMetrics();
  const { fetchLatestServerMetrics, fetchUptimeData, fetchSparklineData, fetchServerMetrics } = useMetricsActions();

  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('latency_avg');

  const isServer = node.type === 'server';
  const latestMetrics = latestServerMetricsByNodeId[nodeId];
  const uptime = uptimeByNodeId[nodeId];

  // Fetch metrics on mount and when nodeId changes
  const fetchMetrics = useCallback(() => {
    fetchSparklineData(nodeId, timeRange);
    if (isServer) {
      fetchServerMetrics(nodeId, timeRange);
    }
    fetchUptimeData(nodeId, '24h');
  }, [nodeId, isServer, timeRange, fetchSparklineData, fetchServerMetrics, fetchUptimeData]);

  // Initial data load
  useEffect(() => {
    if (isServer) {
      fetchLatestServerMetrics(nodeId); // One-time, WebSocket handles updates
    }
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [fetchMetrics, isServer, nodeId, fetchLatestServerMetrics]);

  // Refetch when time range changes
  useEffect(() => {
    fetchSparklineData(nodeId, timeRange);
    if (isServer) {
      fetchServerMetrics(nodeId, timeRange);
    }
  }, [nodeId, isServer, timeRange, fetchSparklineData, fetchServerMetrics]);

  // Status dot color
  const getStatusDotClass = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      case 'offline':
        return 'bg-red-500/70 shadow-[0_0_6px_rgba(239,68,68,0.4)]';
      default:
        return 'bg-slate-500/70';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Section 1: Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Status */}
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
            Status
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full transition-all duration-500 ease-out',
                getStatusDotClass(status)
              )}
            />
            <span className="text-lg font-semibold capitalize tracking-tight">
              {status}
            </span>
          </div>
        </div>

        {/* Latency */}
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
            Latency
          </div>
          <div className="flex items-baseline gap-1">
            {latency !== undefined ? (
              <>
                <AnimatedNumber
                  value={latency}
                  className="text-lg font-semibold tracking-tight"
                  decimals={0}
                  duration={400}
                />
                <span className="text-xs text-muted-foreground/60">ms</span>
              </>
            ) : (
              <span className="text-lg font-semibold tabular-nums tracking-tight">—</span>
            )}
          </div>
        </div>

        {/* Uptime */}
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
            Uptime
          </div>
          <div className="flex items-baseline gap-1">
            {uptime?.uptime?.uptimePercentage !== undefined ? (
              <>
                <AnimatedNumber
                  value={uptime.uptime.uptimePercentage}
                  className="text-lg font-semibold tracking-tight"
                  decimals={1}
                  duration={400}
                />
                <span className="text-xs text-muted-foreground/60">%</span>
              </>
            ) : (
              <span className="text-lg font-semibold tabular-nums tracking-tight">—</span>
            )}
          </div>
        </div>

        {/* Resources (servers only) */}
        {isServer && latestMetrics && (
          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
              Resources
            </div>
            <div className="space-y-0.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground/60">CPU</span>
                {latestMetrics?.metrics?.cpuUsage !== undefined &&
                latestMetrics?.metrics?.cpuUsage !== null ? (
                  <span className="font-medium">
                    <AnimatedNumber
                      value={latestMetrics.metrics.cpuUsage}
                      decimals={1}
                      duration={400}
                    />
                    %
                  </span>
                ) : (
                  <span className="font-medium tabular-nums">—</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground/60">MEM</span>
                {latestMetrics?.metrics?.memoryUsedPercent !== undefined &&
                latestMetrics?.metrics?.memoryUsedPercent !== null ? (
                  <span className="font-medium">
                    <AnimatedNumber
                      value={latestMetrics.metrics.memoryUsedPercent}
                      decimals={1}
                      duration={400}
                    />
                    %
                  </span>
                ) : (
                  <span className="font-medium tabular-nums">—</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Connection Info */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">
            User
          </div>
          <div className="font-mono text-sm">{node.sshUser || 'root'}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">
            Port
          </div>
          <div className="font-mono text-sm">{node.port || 22}</div>
        </div>
      </div>

      {/* Section 3: Tags */}
      {node.tags && node.tags.length > 0 && (
        <div className="pt-4 border-t border-border/40">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-3">
            Tags
          </div>
          <div className="flex flex-wrap gap-2">
            {node.tags.map((tag) => {
              const config = TAG_CONFIG_IMPORT[tag];
              const TagIcon = config?.icon;
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn('gap-1.5 border-border/50', config?.bg, config?.color)}
                >
                  {TagIcon && <TagIcon className="h-3 w-3" />}
                  {config?.label || tag}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 4: Metrics */}
      <div className="pt-4 border-t border-border/40 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
            Metrics
          </h3>
          <div className="flex items-center gap-3">
            <MetricSelector
              value={selectedMetric}
              onChange={setSelectedMetric}
              includeServerMetrics={isServer}
            />
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        </div>
        <div className="h-[200px]">
          <MetricsPanel
            nodeId={nodeId}
            nodeType={node.type}
            timeRange={timeRange}
            selectedMetric={selectedMetric}
            sparklineData={sparklineByNodeId[nodeId]?.dataPoints || []}
            serverMetricsData={serverMetricsByNodeId[nodeId]?.dataPoints || []}
            isLoading={loadingSparkline[nodeId] || loadingServerMetrics[nodeId] || false}
          />
        </div>
      </div>

      {/* Section 5: Modules */}
      {(containers.length > 0 || proxyConfigs.length > 0 || (wireguardStatus?.peers?.length ?? 0) > 0 || (gpuModels?.length ?? 0) > 0) && (
        <div className="pt-4 border-t border-border/40 space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
            Modules
          </h3>
          <div className="space-y-3">
            {/* Docker Containers */}
            {containers.length > 0 && (
              <Card className="border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Container className="h-3.5 w-3.5" />
                      Containers · {containers.length}
                    </div>
                    <button
                      onClick={() => navigate(`/management?tab=docker&host=${nodeId}`)}
                      className="text-xs text-primary hover:underline normal-case font-normal"
                    >
                      Manage
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {containers.slice(0, 5).map((container) => (
                    <button
                      key={container.id}
                      onClick={() => navigate(`/management?tab=docker&host=${nodeId}`)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-500 ease-out',
                          container.state === 'running'
                            ? 'bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                            : container.state === 'exited'
                            ? 'bg-red-500/70'
                            : 'bg-slate-500/70'
                        )}
                        title={container.state}
                      />
                      <span className="font-mono text-sm truncate">{container.name}</span>
                    </button>
                  ))}
                  {containers.length > 5 && (
                    <div className="text-xs text-muted-foreground/60 text-center pt-1">
                      +{containers.length - 5} more
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reverse Proxy Configs */}
            {proxyConfigs.length > 0 && (
              <Card className="border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Domains · {proxyConfigs.length}
                    </div>
                    <button
                      onClick={() => navigate(`/management?tab=reverse-proxy&host=${nodeId}`)}
                      className="text-xs text-primary hover:underline normal-case font-normal"
                    >
                      Manage
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {proxyConfigs.slice(0, 5).map((config, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(`/management?tab=reverse-proxy&host=${nodeId}`)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-500 ease-out',
                          config.sslEnabled
                            ? 'bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                            : 'bg-yellow-500/70 shadow-[0_0_6px_rgba(234,179,8,0.4)]'
                        )}
                        title={config.sslEnabled ? 'SSL Enabled' : 'No SSL'}
                      />
                      <span className="font-mono text-sm truncate">{config.domain}</span>
                    </button>
                  ))}
                  {proxyConfigs.length > 5 && (
                    <div className="text-xs text-muted-foreground/60 text-center pt-1">
                      +{proxyConfigs.length - 5} more
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* WireGuard Peers */}
            {wireguardStatus?.peers && wireguardStatus.peers.length > 0 && (
              <Card className="border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" />
                      VPN Peers · {wireguardStatus.peers.length}
                    </div>
                    <button
                      onClick={() => navigate(`/management?tab=wireguard&host=${nodeId}`)}
                      className="text-xs text-primary hover:underline normal-case font-normal"
                    >
                      Manage
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {wireguardStatus.peers.slice(0, 5).map((peer, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(`/management?tab=wireguard&host=${nodeId}`)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-500 ease-out',
                          peer.isOnline
                            ? 'bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                            : 'bg-red-500/70'
                        )}
                        title={peer.isOnline ? 'Online' : 'Offline'}
                      />
                      <span className="font-mono text-sm truncate">
                        {peer.allowedIps?.[0] || peer.publicKey.substring(0, 12)}
                      </span>
                    </button>
                  ))}
                  {wireguardStatus.peers.length > 5 && (
                    <div className="text-xs text-muted-foreground/60 text-center pt-1">
                      +{wireguardStatus.peers.length - 5} more
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* GPU Models */}
            {gpuModels && gpuModels.length > 0 && (
              <Card className="border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5" />
                      GPU Models · {gpuModels.length}
                    </div>
                    <button
                      onClick={() => navigate(`/management?tab=gpu&host=${nodeId}`)}
                      className="text-xs text-primary hover:underline normal-case font-normal"
                    >
                      Manage
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {gpuModels.slice(0, 5).map((model, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(`/management?tab=gpu&host=${nodeId}`)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-500 ease-out',
                          model.status === 'running'
                            ? 'bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                            : model.status === 'starting'
                            ? 'bg-yellow-500/70 shadow-[0_0_6px_rgba(234,179,8,0.4)]'
                            : 'bg-red-500/70'
                        )}
                        title={model.status}
                      />
                      <span className="font-mono text-sm truncate">{model.name}</span>
                    </button>
                  ))}
                  {gpuModels.length > 5 && (
                    <div className="text-xs text-muted-foreground/60 text-center pt-1">
                      +{gpuModels.length - 5} more
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
