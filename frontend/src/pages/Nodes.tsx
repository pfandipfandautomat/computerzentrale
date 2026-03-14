import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrlParams } from '@/hooks/useUrlParams';
import { 
  useNodes,
  useInfraIsLoading,
  useNodeStatusById,
  useContainersByNodeId,
  useProxyConfigsByNodeId,
  useWireguardStatusByNodeId,
  useInterfacesByNodeId,
  useInfraActions,
  useNodeById,
  useNodeType,
} from '@/stores/useInfraStore';
import {
  useLatestServerMetricsByNodeId,
  useUptimeByNodeId,
  useSparklineByNodeId,
  useLoadingSparkline,
  useUptimeSparklineByNodeId,
  useLoadingUptimeSparkline,
  useServerMetricsByNodeId,
  useLoadingServerMetrics,
  useMetricsActions,
} from '@/stores/useMetricsStore';
import { EditNodeModal } from '@/components/Modals/EditNodeModal';
import { DeleteNodeModal } from '@/components/Modals/DeleteNodeModal';
import { AddNodeModal } from '@/components/Modals/AddNodeModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import {
  Sidebar,
  SidebarHeader,
  SidebarSearch,
  SidebarContent,
  SidebarItem,
  SidebarEmpty,
} from '@/components/ui/sidebar';
import { ScrollProgress } from '@/components/ui/scroll-progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '@/services/api';
import { InfraNode, NodeType, TAG_CONFIG } from '@/types';
import { MetricsPanel } from '@/components/NodeDetail/MetricsPanel';
import { TimeRangeSelector, type TimeRange } from '@/components/NodeDetail/MetricsPanel/TimeRangeSelector';
import { MetricSelector, type MetricType, isServerMetric } from '@/components/NodeDetail/MetricsPanel/MetricSelector';
import { UptimeChart } from '@/components/NodeDetail/MetricsPanel/UptimeChart';
import { TerminalWindow } from '@/components/Terminal';
import { MonitoringToggle } from '@/components/NodeDetail/MonitoringToggle';
import { EventLogModal } from '@/components/Modals/EventLogModal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { useKeyboardShortcuts, logEasterEgg } from '@/hooks/useKeyboardShortcuts';
import { 
  Server, 
  Router, 
  HardDrive, 
  Monitor, 
  Box,
  Cog,
  Plus, 
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  RotateCcw,
  Container,
  Globe,
  Shield,
  Terminal as TerminalIcon,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Node type icons mapping
const nodeTypeIcons: Record<NodeType, React.ElementType> = {
  server: Server,
  router: Router,
  nas: HardDrive,
  client: Monitor,
  service: Cog,
  custom: Box,
};

// Node type colors
const nodeTypeColors: Record<NodeType, string> = {
  server: 'text-blue-400',
  router: 'text-amber-400',
  nas: 'text-purple-400',
  client: 'text-teal-400',
  service: 'text-cyan-400',
  custom: 'text-slate-400',
};

export function Nodes() {
  const navigate = useNavigate();
  
  // Infra store selectors
  const nodes = useNodes()
  const isLoading = useInfraIsLoading()
  const nodeStatusById = useNodeStatusById()
  const containersByNodeId = useContainersByNodeId()
  const proxyConfigsByNodeId = useProxyConfigsByNodeId()
  const wireguardStatusByNodeId = useWireguardStatusByNodeId()
  const interfacesByNodeId = useInterfacesByNodeId()
  const { 
    fetchNodes, 
    fetchContainersForNode,
    fetchProxyConfigsForNode,
    fetchWireGuardStatusForNode,
  } = useInfraActions()

  // Metrics store selectors
  const latestServerMetricsByNodeId = useLatestServerMetricsByNodeId()
  const uptimeByNodeId = useUptimeByNodeId()
  const sparklineByNodeId = useSparklineByNodeId()
  const loadingSparkline = useLoadingSparkline()
  const uptimeSparklineByNodeId = useUptimeSparklineByNodeId()
  const loadingUptimeSparkline = useLoadingUptimeSparkline()
  const serverMetricsByNodeId = useServerMetricsByNodeId()
  const loadingServerMetrics = useLoadingServerMetrics()
  const { fetchLatestServerMetrics, fetchUptimeData, fetchSparklineData, fetchUptimeSparklineData, fetchServerMetrics } = useMetricsActions()

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editNode, setEditNode] = useState<InfraNode | null>(null);
  const [deleteNode, setDeleteNode] = useState<InfraNode | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [restarting, setRestarting] = useState<Record<string, boolean>>({});
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('latency_avg');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [eventLogOpen, setEventLogOpen] = useState(false);

  // Sync selected node with URL
  useUrlParams({
    params: [
      {
        key: 'node',
        get: () => selectedNodeId,
        set: setSelectedNodeId,
        serialize: (v) => v || '',
        deserialize: (v) => v || null,
      },
    ],
  });

  // Easter egg on mount
  useEffect(() => {
    logEasterEgg();
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      action: () => setAddModalOpen(true),
      description: 'Add new node',
    },
    {
      key: 'r',
      ctrl: true,
      action: () => fetchNodes(),
      description: 'Refresh all nodes',
    },
    {
      key: '/',
      action: () => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        searchInput?.focus();
      },
      description: 'Focus search',
    },
  ]);

  // Initial fetch
  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Auto-select first node - only depend on nodes.length to avoid re-running on every node update
  useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes.length, selectedNodeId]);

  // Get selected node data using optimized selectors
  const selectedNodeType = useNodeType(selectedNodeId);

  // Fetch metrics for selected node - use stable selectedNodeId instead of nodes array
  useEffect(() => {
    if (!selectedNodeId || !selectedNodeType) return;

    // Get current tags from the node directly (not as a dependency)
    const currentNode = nodes.find(n => n.id === selectedNodeId);
    const tags = currentNode?.tags;

    if (selectedNodeType === 'server') {
      fetchLatestServerMetrics(selectedNodeId);
    }
    fetchUptimeData(selectedNodeId, '24h');
    fetchUptimeSparklineData(selectedNodeId);

    // Fetch tag-specific data
    if (tags?.includes('docker')) {
      fetchContainersForNode(selectedNodeId);
    }
    if (tags?.includes('reverse-proxy')) {
      fetchProxyConfigsForNode(selectedNodeId);
    }
    if (tags?.includes('wireguard')) {
      fetchWireGuardStatusForNode(selectedNodeId);
    }
  }, [selectedNodeId, selectedNodeType, fetchLatestServerMetrics, fetchUptimeData, fetchUptimeSparklineData, fetchContainersForNode, fetchProxyConfigsForNode, fetchWireGuardStatusForNode]);

  // Auto-refresh data every 10 seconds - use stable references
  useEffect(() => {
    if (!selectedNodeId || !selectedNodeType) return;

    const refreshData = () => {
      // Get current tags from the node directly (not as a dependency)
      const currentNode = nodes.find(n => n.id === selectedNodeId);
      const tags = currentNode?.tags;

      fetchUptimeData(selectedNodeId, '24h');
      fetchUptimeSparklineData(selectedNodeId);

      // Refresh MetricsPanel data with current timeRange
      fetchSparklineData(selectedNodeId, timeRange);
      if (selectedNodeType === 'server') {
        fetchServerMetrics(selectedNodeId, timeRange);
      }

      if (tags?.includes('docker')) {
        fetchContainersForNode(selectedNodeId);
      }
      if (tags?.includes('reverse-proxy')) {
        fetchProxyConfigsForNode(selectedNodeId);
      }
      if (tags?.includes('wireguard')) {
        fetchWireGuardStatusForNode(selectedNodeId);
      }
    };

    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [selectedNodeId, selectedNodeType, timeRange, fetchUptimeData, fetchUptimeSparklineData, fetchSparklineData, fetchServerMetrics, fetchContainersForNode, fetchProxyConfigsForNode, fetchWireGuardStatusForNode]);

  // Fetch metrics for the performance chart (MetricsPanel)
  useEffect(() => {
    if (!selectedNodeId) return;
    
    fetchSparklineData(selectedNodeId, timeRange);
    if (selectedNodeType === 'server') {
      fetchServerMetrics(selectedNodeId, timeRange);
    }
  }, [selectedNodeId, selectedNodeType, timeRange, fetchSparklineData, fetchServerMetrics]);

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return nodes.filter(node =>
      node.name.toLowerCase().includes(query) ||
      node.host.toLowerCase().includes(query) ||
      node.type.toLowerCase().includes(query)
    );
  }, [nodes, searchQuery]);

  // Get selected node using optimized selector - only re-renders when that specific node changes
  const selectedNode = useNodeById(selectedNodeId);

  // Reset metric to network metric if switching to non-server node
  useEffect(() => {
    if (selectedNode && selectedNode.type !== 'server' && isServerMetric(selectedMetric)) {
      setSelectedMetric('latency_avg');
    }
  }, [selectedNode?.type, selectedMetric]);

  // Get node status
  const getNodeStatus = useCallback((nodeId: string, node: InfraNode) => {
    return nodeStatusById[nodeId]?.status ?? node.status ?? 'unknown';
  }, [nodeStatusById]);

  // Get node latency
  const getNodeLatency = useCallback((nodeId: string, node: InfraNode) => {
    return nodeStatusById[nodeId]?.latency ?? node.latency;
  }, [nodeStatusById]);

  // Handle restart - stable callback
  const handleRestart = useCallback(async (node: InfraNode) => {
    setRestarting(prev => ({ ...prev, [node.id]: true }));
    try {
      const result = await api.restartNode(node.id);
      if (result.success) {
        toast({
          title: 'Restart Initiated',
          description: result.message,
        });
      } else {
        toast({
          title: 'Restart Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Restart Failed',
        description: error instanceof Error ? error.message : 'Failed to restart node',
        variant: 'destructive',
      });
    } finally {
      setRestarting(prev => ({ ...prev, [node.id]: false }));
    }
  }, []);



  // Loading state
  if (isLoading && nodes.length === 0) {
    return (
      <div className="flex h-full">
        <Sidebar>
          <SidebarHeader title="Nodes" icon={<Server className="h-5 w-5" />} />
          <div className="p-3 border-b border-border/50">
            <div className="h-9 bg-secondary/30 rounded-md animate-pulse" />
          </div>
          <SidebarContent>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </SidebarContent>
        </Sidebar>
        
        <div className="flex-1 p-6 space-y-4">
          <div className="h-10 bg-secondary/30 rounded animate-pulse w-1/3" />
          <div className="h-6 bg-secondary/30 rounded animate-pulse w-1/4" />
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Node List */}
      <Sidebar>
        <SidebarHeader
          title="Nodes"
          icon={<Server className="h-5 w-5" />}
          action={
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setAddModalOpen(true)} 
              className="h-8 w-8 p-0 hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </Button>
          }
        />
        
        <SidebarSearch
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
        
        <SidebarContent>
          {filteredNodes.length === 0 ? (
            <SidebarEmpty
              icon={<AlertCircle className="h-8 w-8" />}
              title={searchQuery ? 'No matching nodes' : 'No nodes yet'}
              action={
                !searchQuery && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setAddModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add your first node
                  </Button>
                )
              }
            />
          ) : (
            filteredNodes.map(node => {
              const Icon = nodeTypeIcons[node.type] || Box;
              const status = getNodeStatus(node.id, node) as 'online' | 'offline' | 'unknown';
              const latency = getNodeLatency(node.id, node);
              
              return (
                <SidebarItem
                  key={node.id}
                  icon={<Icon className="h-4 w-4" />}
                  iconColor={nodeTypeColors[node.type]}
                  title={node.name}
                  subtitle={`${node.host} · ${node.type}`}
                  status={status}
                  isSelected={selectedNodeId === node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  badge={
                    latency !== undefined && latency !== null && status === 'online' ? (
                      <span className="text-[10px] font-medium text-emerald-400 tabular-nums">
                        {latency}ms
                      </span>
                    ) : undefined
                  }
                  tags={
                    node.tags && node.tags.length > 0 ? (
                      <>
                        {node.tags.map(tag => {
                          const config = TAG_CONFIG[tag];
                          const TagIcon = config?.icon;
                          return (
                            <div
                              key={tag}
                              className={cn(
                                "p-1 rounded",
                                config?.bg || "bg-primary/10"
                              )}
                              title={config?.label || tag}
                            >
                              {TagIcon && <TagIcon className={cn("h-3 w-3", config?.color || "text-primary")} />}
                            </div>
                          );
                        })}
                      </>
                    ) : undefined
                  }
                />
              );
            })
          )}
        </SidebarContent>
      </Sidebar>

      {/* Main Area - Node Details */}
      <ScrollProgress>
        {selectedNode ? (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = nodeTypeIcons[selectedNode.type] || Box;
                    return <Icon className={cn("h-8 w-8", nodeTypeColors[selectedNode.type])} />;
                  })()}
                  <div>
                    <h1 className="text-2xl font-bold">{selectedNode.name}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedNode.host} • {selectedNode.type}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedNode.type === 'server' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={restarting[selectedNode.id]}
                        className="h-8 w-8 opacity-60 hover:opacity-100 text-amber-500/60 hover:text-amber-400 transition-all duration-200 hover:scale-105"
                        title="Restart"
                      >
                        <RotateCcw className={cn("h-4 w-4", restarting[selectedNode.id] && "animate-spin")} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restart {selectedNode.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will send a reboot command to the server. The node will be temporarily unavailable during restart.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRestart(selectedNode)}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          Restart
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEventLogOpen(true)}
                className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
                title="Events"
              >
                <History className="h-4 w-4" />
              </Button>
              {selectedNode && (
                <MonitoringToggle
                  nodeId={selectedNode.id}
                  enabled={selectedNode.telegramAlerts ?? false}
                  compact
                />
              )}
              {selectedNode.type === 'server' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTerminalOpen(true)}
                  className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
                  title="Terminal"
                >
                  <TerminalIcon className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditNode(selectedNode)}
                className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteNode(selectedNode)}
                className="h-8 w-8 opacity-60 hover:opacity-100 text-destructive/60 hover:text-destructive transition-all duration-200 hover:scale-105"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              </div>
            </div>

            {/* Consolidated Overview Card */}
            <Card className="border-border/40">
              <CardContent className="pt-6 flex gap-6">
                {/* Left side - Compact stats */}
                <div className="w-[300px] space-y-6">
                  {/* Top row - Status, Latency, Uptime, Resources */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Status */}
                    <div className="space-y-1.5">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                        Status
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full transition-all duration-500 ease-out",
                          getNodeStatus(selectedNode.id, selectedNode) === 'online' ? "bg-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                          getNodeStatus(selectedNode.id, selectedNode) === 'offline' ? "bg-red-500/70 shadow-[0_0_6px_rgba(239,68,68,0.4)]" : "bg-slate-500/70"
                        )} />
                        <span className="text-lg font-semibold capitalize tracking-tight">
                          {getNodeStatus(selectedNode.id, selectedNode)}
                        </span>
                      </div>
                    </div>

                    {/* Latency */}
                    <div className="space-y-1.5">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                        Latency
                      </div>
                      <div className="flex items-baseline gap-1">
                        {getNodeLatency(selectedNode.id, selectedNode) !== undefined ? (
                          <>
                            <AnimatedNumber 
                              value={getNodeLatency(selectedNode.id, selectedNode)!} 
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
                        {uptimeByNodeId[selectedNode.id]?.uptime?.uptimePercentage !== undefined ? (
                          <>
                            <AnimatedNumber 
                              value={uptimeByNodeId[selectedNode.id].uptime.uptimePercentage} 
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

                    {/* Server Resources (only for servers) */}
                    {selectedNode.type === 'server' && latestServerMetricsByNodeId[selectedNode.id] && (
                      <div className="space-y-1.5">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                          Resources
                        </div>
                        <div className="space-y-0.5 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground/60">CPU</span>
                            {latestServerMetricsByNodeId[selectedNode.id]?.metrics?.cpuUsage !== undefined && 
                             latestServerMetricsByNodeId[selectedNode.id]?.metrics?.cpuUsage !== null ? (
                              <span className="font-medium">
                                <AnimatedNumber 
                                  value={latestServerMetricsByNodeId[selectedNode.id]!.metrics!.cpuUsage!} 
                                  decimals={1}
                                  duration={400}
                                />%
                              </span>
                            ) : (
                              <span className="font-medium tabular-nums">—</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground/60">MEM</span>
                            {latestServerMetricsByNodeId[selectedNode.id]?.metrics?.memoryUsedPercent !== undefined && 
                             latestServerMetricsByNodeId[selectedNode.id]?.metrics?.memoryUsedPercent !== null ? (
                              <span className="font-medium">
                                <AnimatedNumber 
                                  value={latestServerMetricsByNodeId[selectedNode.id]!.metrics!.memoryUsedPercent!} 
                                  decimals={1}
                                  duration={400}
                                />%
                              </span>
                            ) : (
                              <span className="font-medium tabular-nums">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SSH Info */}
                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border/40">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">
                        User
                      </div>
                      <div className="font-mono text-sm">{selectedNode.sshUser || 'root'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">
                        Port
                      </div>
                      <div className="font-mono text-sm">{selectedNode.port || 22}</div>
                    </div>
                  </div>
                  
                  {/* Tags */}
                  {selectedNode.tags && selectedNode.tags.length > 0 && (
                    <div className="pt-6 border-t border-border/40">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-3">
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedNode.tags.map(tag => {
                          const config = TAG_CONFIG[tag];
                          const TagIcon = config?.icon;
                          return (
                            <Badge
                              key={tag}
                              variant="outline"
                              className={cn("gap-1.5 border-border/50", config?.bg, config?.color)}
                            >
                              {TagIcon && <TagIcon className="h-3 w-3" />}
                              {config?.label || tag}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedNode.description && (
                    <div className="pt-6 border-t border-border/40">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-3">
                        Description
                      </div>
                      <p className="text-sm text-muted-foreground/80 leading-relaxed">{selectedNode.description}</p>
                    </div>
                  )}
                </div>

                {/* Right side - Uptime Chart (visual hero) */}
                <div className="flex-1 border-l border-border/40 pl-6">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium mb-4">
                    Availability
                  </div>
                  <UptimeChart 
                    data={uptimeSparklineByNodeId[selectedNode.id]?.dataPoints || []}
                    isLoading={loadingUptimeSparkline[selectedNode.id]}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Metrics Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70">
                  Metrics
                </h3>
                <div className="flex items-center gap-3">
                  <MetricSelector 
                    value={selectedMetric} 
                    onChange={setSelectedMetric} 
                    includeServerMetrics={selectedNode.type === 'server'}
                  />
                  <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                </div>
              </div>
              <MetricsPanel
                nodeId={selectedNode.id}
                nodeType={selectedNode.type}
                timeRange={timeRange}
                selectedMetric={selectedMetric}
                sparklineData={sparklineByNodeId[selectedNode.id]?.dataPoints || []}
                serverMetricsData={serverMetricsByNodeId[selectedNode.id]?.dataPoints || []}
                isLoading={loadingSparkline[selectedNode.id] || loadingServerMetrics[selectedNode.id] || false}
              />
            </div>

            {/* Network Interfaces */}
            {interfacesByNodeId[selectedNode.id]?.length > 0 && (
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                    Network Interfaces
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {interfacesByNodeId[selectedNode.id].map(iface => (
                      <Badge key={iface.id} variant="outline" className="font-mono text-xs border-border/50">
                        {iface.address}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feature Modules */}
            {(containersByNodeId[selectedNode.id]?.length > 0 || 
              proxyConfigsByNodeId[selectedNode.id]?.length > 0 || 
              wireguardStatusByNodeId[selectedNode.id]?.peers?.length > 0) && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70">
                  Modules
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {/* Docker Containers */}
                {containersByNodeId[selectedNode.id]?.length > 0 && (
                  <Card className="border-border/40">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-2">
                        <Container className="h-3.5 w-3.5" />
                        Containers · {containersByNodeId[selectedNode.id].length}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {containersByNodeId[selectedNode.id].map(container => (
                        <button
                          key={container.id}
                          onClick={() => navigate(`/management?tab=docker&host=${selectedNode.id}`)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors group text-left"
                        >
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-500 ease-out",
                            container.state === 'running' ? "bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.4)]" :
                            container.state === 'exited' ? "bg-red-500/70" :
                            "bg-slate-500/70"
                          )} title={container.state} />
                          <span className="font-mono text-sm truncate">{container.name}</span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Reverse Proxy Configs */}
                {proxyConfigsByNodeId[selectedNode.id]?.length > 0 && (
                  <Card className="border-border/40">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        Domains · {proxyConfigsByNodeId[selectedNode.id].length}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {proxyConfigsByNodeId[selectedNode.id].map((config, idx) => (
                        <button
                          key={idx}
                          onClick={() => navigate(`/management?tab=reverse-proxy&host=${selectedNode.id}`)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors group text-left"
                        >
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-500 ease-out",
                            config.sslEnabled 
                              ? "bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
                              : "bg-yellow-500/70 shadow-[0_0_6px_rgba(234,179,8,0.4)]"
                          )} title={config.sslEnabled ? 'SSL Enabled' : 'No SSL'} />
                          <span className="font-mono text-sm truncate">{config.domain}</span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* WireGuard Peers */}
                {wireguardStatusByNodeId[selectedNode.id]?.peers?.length > 0 && (
                  <Card className="border-border/40">
                    <CardHeader>
                      <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5" />
                        VPN Peers · {wireguardStatusByNodeId[selectedNode.id].peers.length}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {wireguardStatusByNodeId[selectedNode.id].peers.map((peer, idx) => (
                        <button
                          key={idx}
                          onClick={() => navigate(`/management?tab=wireguard&host=${selectedNode.id}`)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30 transition-colors group text-left"
                        >
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all duration-500 ease-out",
                            peer.isOnline 
                              ? "bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
                              : "bg-red-500/70"
                          )} title={peer.isOnline ? 'Online' : 'Offline'} />
                          <span className="font-mono text-sm truncate">
                            {peer.allowedIps?.[0] || peer.publicKey.substring(0, 12)}
                          </span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Server className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg text-foreground/60">Select a node from the sidebar</p>
              {nodes.length === 0 && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setAddModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first node
                </Button>
              )}
            </div>
          </div>
        )}
      </ScrollProgress>

      {/* Modals */}
      <EditNodeModal
        node={editNode}
        open={!!editNode}
        onOpenChange={(open) => !open && setEditNode(null)}
      />
      <DeleteNodeModal
        node={deleteNode}
        open={!!deleteNode}
        onOpenChange={(open) => !open && setDeleteNode(null)}
      />
      <AddNodeModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
      />

      {/* Terminal Window */}
      {terminalOpen && selectedNode && selectedNode.type === 'server' && (
        <TerminalWindow
          nodeId={selectedNode.id}
          nodeName={selectedNode.name}
          onClose={() => setTerminalOpen(false)}
        />
      )}

      {/* Event Log Modal */}
      {selectedNode && (
        <EventLogModal
          nodeId={selectedNode.id}
          nodeName={selectedNode.name}
          open={eventLogOpen}
          onOpenChange={setEventLogOpen}
        />
      )}
    </div>
  );
}
