import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { metricsService } from '@/services/metricsService';
import type { MetricDataPoint, NodeUptime, ServerMetricsDataPoint, InfraNode } from '@/types';

// Helper to check if metric data points are equal (shallow comparison of key values)
function areDataPointsEqual(a: MetricDataPoint[] | undefined, b: MetricDataPoint[] | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].timestamp !== b[i].timestamp || 
        a[i].latencyAvg !== b[i].latencyAvg ||
        a[i].status !== b[i].status) {
      return false;
    }
  }
  return true;
}

function areServerMetricsEqual(a: ServerMetricsDataPoint[] | undefined, b: ServerMetricsDataPoint[] | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].timestamp !== b[i].timestamp || 
        a[i].cpuUsage !== b[i].cpuUsage ||
        a[i].memoryUsedPercent !== b[i].memoryUsedPercent) {
      return false;
    }
  }
  return true;
}

interface NodeMetricsCache {
  dataPoints: MetricDataPoint[];
  lastFetched: number;
  range: string;
}

interface NodeUptimeCache {
  uptime: NodeUptime;
  lastFetched: number;
  range: string;
}

interface ServerMetricsCache {
  dataPoints: ServerMetricsDataPoint[];
  lastFetched: number;
  range: string;
}

interface UptimeSparklineCache {
  dataPoints: MetricDataPoint[];
  lastFetched: number;
}

interface LatestServerMetricsCache {
  metrics: ServerMetricsDataPoint | null;
  lastFetched: number;
}

interface MetricsStore {
  // Cache for sparkline data (1h history)
  sparklineByNodeId: Record<string, NodeMetricsCache>;
  // Cache for uptime sparkline data (24h history)
  uptimeSparklineByNodeId: Record<string, UptimeSparklineCache>;
  // Cache for uptime data
  uptimeByNodeId: Record<string, NodeUptimeCache>;
  // Cache for server metrics
  serverMetricsByNodeId: Record<string, ServerMetricsCache>;
  latestServerMetricsByNodeId: Record<string, LatestServerMetricsCache>;
  // Loading states
  loadingSparkline: Record<string, boolean>;
  loadingUptimeSparkline: Record<string, boolean>;
  loadingUptime: Record<string, boolean>;
  loadingServerMetrics: Record<string, boolean>;
  loadingLatestServerMetrics: Record<string, boolean>;
  // Service availability
  metricsAvailable: boolean | null;
  
  // Actions
  fetchSparklineData: (nodeId: string, range?: string) => Promise<MetricDataPoint[]>;
  fetchUptimeSparklineData: (nodeId: string) => Promise<MetricDataPoint[]>;
  fetchUptimeData: (nodeId: string, range?: string) => Promise<NodeUptime | null>;
  fetchServerMetrics: (nodeId: string, range?: string) => Promise<ServerMetricsDataPoint[]>;
  fetchLatestServerMetrics: (nodeId: string) => Promise<ServerMetricsDataPoint | null>;
  fetchMetricsForAllServerNodes: (nodes: InfraNode[]) => Promise<void>;
  updateLatestServerMetricsFromWS: (nodeId: string, metrics: ServerMetricsDataPoint) => void;
  checkMetricsAvailability: () => Promise<boolean>;
  clearNodeMetrics: (nodeId: string) => void;
  clearAllMetrics: () => void;
}

// Cache duration in milliseconds (30 seconds for sparkline, 60 seconds for uptime)
const SPARKLINE_CACHE_DURATION = 30 * 1000;
const UPTIME_CACHE_DURATION = 60 * 1000;
const SERVER_METRICS_CACHE_DURATION = 10 * 1000; // 10 seconds
const LATEST_SERVER_METRICS_CACHE_DURATION = 5 * 1000; // 5 seconds

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  sparklineByNodeId: {},
  uptimeSparklineByNodeId: {},
  uptimeByNodeId: {},
  serverMetricsByNodeId: {},
  latestServerMetricsByNodeId: {},
  loadingSparkline: {},
  loadingUptimeSparkline: {},
  loadingUptime: {},
  loadingServerMetrics: {},
  loadingLatestServerMetrics: {},
  metricsAvailable: null,

  checkMetricsAvailability: async () => {
    try {
      const status = await metricsService.getStatus();
      set({ metricsAvailable: status.available });
      return status.available;
    } catch (error) {
      console.error('Failed to check metrics availability:', error);
      set({ metricsAvailable: false });
      return false;
    }
  },

  fetchSparklineData: async (nodeId: string, range: string = '1h') => {
    const state = get();
    
    // Check if metrics are available
    if (state.metricsAvailable === false) {
      return [];
    }

    // Check cache
    const cached = state.sparklineByNodeId[nodeId];
    const hasValidCache = cached && cached.range === range;
    
    if (
      hasValidCache &&
      Date.now() - cached.lastFetched < SPARKLINE_CACHE_DURATION
    ) {
      return cached.dataPoints;
    }

    // Check if already loading
    if (state.loadingSparkline[nodeId]) {
      return cached?.dataPoints || [];
    }

    // Only set loading state if we don't have valid cached data to show
    if (!hasValidCache) {
      set((s) => ({
        loadingSparkline: { ...s.loadingSparkline, [nodeId]: true },
      }));
    }

    try {
      const history = await metricsService.getNodeHistory(nodeId, range);
      
      // Check if data actually changed to prevent unnecessary re-renders
      const existingCache = get().sparklineByNodeId[nodeId];
      if (existingCache && 
          existingCache.range === range && 
          areDataPointsEqual(existingCache.dataPoints, history.dataPoints)) {
        // Data unchanged - only clear loading state if it was set, don't touch data
        if (get().loadingSparkline[nodeId]) {
          set((s) => ({
            loadingSparkline: { ...s.loadingSparkline, [nodeId]: false },
          }));
        }
        return existingCache.dataPoints;  // Return EXISTING reference, not new one
      }
      
      // Data changed - update everything
      set((s) => ({
        sparklineByNodeId: {
          ...s.sparklineByNodeId,
          [nodeId]: {
            dataPoints: history.dataPoints,
            lastFetched: Date.now(),
            range,
          },
        },
        loadingSparkline: { ...s.loadingSparkline, [nodeId]: false },
      }));

      return history.dataPoints;
    } catch (error) {
      console.error(`Failed to fetch sparkline data for node ${nodeId}:`, error);
      set((s) => ({
        loadingSparkline: { ...s.loadingSparkline, [nodeId]: false },
      }));
      return [];
    }
  },

  fetchUptimeSparklineData: async (nodeId: string) => {
    const state = get();
    
    // Check if metrics are available
    if (state.metricsAvailable === false) {
      return [];
    }

    // Check cache
    const cached = state.uptimeSparklineByNodeId[nodeId];
    if (
      cached &&
      Date.now() - cached.lastFetched < SPARKLINE_CACHE_DURATION
    ) {
      return cached.dataPoints;
    }

    // Check if already loading
    if (state.loadingUptimeSparkline[nodeId]) {
      return cached?.dataPoints || [];
    }

    // Set loading state
    set((s) => ({
      loadingUptimeSparkline: { ...s.loadingUptimeSparkline, [nodeId]: true },
    }));

    try {
      const history = await metricsService.getNodeHistory(nodeId, '24h');
      
      set((s) => ({
        uptimeSparklineByNodeId: {
          ...s.uptimeSparklineByNodeId,
          [nodeId]: {
            dataPoints: history.dataPoints,
            lastFetched: Date.now(),
          },
        },
        loadingUptimeSparkline: { ...s.loadingUptimeSparkline, [nodeId]: false },
      }));

      return history.dataPoints;
    } catch (error) {
      console.error(`Failed to fetch uptime sparkline data for node ${nodeId}:`, error);
      set((s) => ({
        loadingUptimeSparkline: { ...s.loadingUptimeSparkline, [nodeId]: false },
      }));
      return [];
    }
  },

  fetchUptimeData: async (nodeId: string, range: string = '24h') => {
    const state = get();
    
    // Check if metrics are available
    if (state.metricsAvailable === false) {
      return null;
    }

    // Check cache
    const cached = state.uptimeByNodeId[nodeId];
    if (
      cached &&
      cached.range === range &&
      Date.now() - cached.lastFetched < UPTIME_CACHE_DURATION
    ) {
      return cached.uptime;
    }

    // Check if already loading
    if (state.loadingUptime[nodeId]) {
      return cached?.uptime || null;
    }

    // Set loading state
    set((s) => ({
      loadingUptime: { ...s.loadingUptime, [nodeId]: true },
    }));

    try {
      const uptime = await metricsService.getNodeUptime(nodeId, range);
      
      set((s) => ({
        uptimeByNodeId: {
          ...s.uptimeByNodeId,
          [nodeId]: {
            uptime,
            lastFetched: Date.now(),
            range,
          },
        },
        loadingUptime: { ...s.loadingUptime, [nodeId]: false },
      }));

      return uptime;
    } catch (error) {
      console.error(`Failed to fetch uptime data for node ${nodeId}:`, error);
      set((s) => ({
        loadingUptime: { ...s.loadingUptime, [nodeId]: false },
      }));
      return null;
    }
  },

  fetchServerMetrics: async (nodeId: string, range: string = '1h') => {
    const state = get();
    
    if (state.metricsAvailable === false) {
      return [];
    }

    const cached = state.serverMetricsByNodeId[nodeId];
    const hasValidCache = cached && cached.range === range;
    
    if (
      hasValidCache &&
      Date.now() - cached.lastFetched < SERVER_METRICS_CACHE_DURATION
    ) {
      return cached.dataPoints;
    }

    if (state.loadingServerMetrics[nodeId]) {
      return cached?.dataPoints || [];
    }

    // Only set loading state if we don't have valid cached data to show
    if (!hasValidCache) {
      set((s) => ({
        loadingServerMetrics: { ...s.loadingServerMetrics, [nodeId]: true },
      }));
    }

    try {
      const history = await metricsService.getServerMetrics(nodeId, range);
      
      // Check if data actually changed to prevent unnecessary re-renders
      const existingCache = get().serverMetricsByNodeId[nodeId];
      if (existingCache && 
          existingCache.range === range && 
          areServerMetricsEqual(existingCache.dataPoints, history.dataPoints)) {
        // Data unchanged - only clear loading state if it was set
        if (get().loadingServerMetrics[nodeId]) {
          set((s) => ({
            loadingServerMetrics: { ...s.loadingServerMetrics, [nodeId]: false },
          }));
        }
        return existingCache.dataPoints;  // Return EXISTING reference
      }
      
      // Data changed - update everything
      set((s) => ({
        serverMetricsByNodeId: {
          ...s.serverMetricsByNodeId,
          [nodeId]: {
            dataPoints: history.dataPoints,
            lastFetched: Date.now(),
            range,
          },
        },
        loadingServerMetrics: { ...s.loadingServerMetrics, [nodeId]: false },
      }));

      return history.dataPoints;
    } catch (error) {
      console.error(`Failed to fetch server metrics for node ${nodeId}:`, error);
      set((s) => ({
        loadingServerMetrics: { ...s.loadingServerMetrics, [nodeId]: false },
      }));
      return [];
    }
  },

  fetchLatestServerMetrics: async (nodeId: string) => {
    const state = get();
    
    if (state.metricsAvailable === false) {
      return null;
    }

    const cached = state.latestServerMetricsByNodeId[nodeId];
    const hasValidCache = cached && cached.metrics !== null;
    
    if (
      hasValidCache &&
      Date.now() - cached.lastFetched < LATEST_SERVER_METRICS_CACHE_DURATION
    ) {
      return cached.metrics;
    }

    if (state.loadingLatestServerMetrics[nodeId]) {
      return cached?.metrics || null;
    }

    // Only set loading state if we don't have valid cached data
    if (!hasValidCache) {
      set((s) => ({
        loadingLatestServerMetrics: { ...s.loadingLatestServerMetrics, [nodeId]: true },
      }));
    }

    try {
      const result = await metricsService.getLatestServerMetrics(nodeId);
      
      // Check if data actually changed (compare key metrics)
      const existingCache = get().latestServerMetricsByNodeId[nodeId];
      if (existingCache?.metrics && result.metrics &&
          existingCache.metrics.cpuUsage === result.metrics.cpuUsage &&
          existingCache.metrics.memoryUsedPercent === result.metrics.memoryUsedPercent) {
        // Data unchanged - only clear loading state if needed
        if (get().loadingLatestServerMetrics[nodeId]) {
          set((s) => ({
            loadingLatestServerMetrics: { ...s.loadingLatestServerMetrics, [nodeId]: false },
          }));
        }
        return existingCache.metrics;
      }
      
      set((s) => ({
        latestServerMetricsByNodeId: {
          ...s.latestServerMetricsByNodeId,
          [nodeId]: {
            metrics: result.metrics,
            lastFetched: Date.now(),
          },
        },
        loadingLatestServerMetrics: { ...s.loadingLatestServerMetrics, [nodeId]: false },
      }));

      return result.metrics;
    } catch (error) {
      console.error(`Failed to fetch latest server metrics for node ${nodeId}:`, error);
      set((s) => ({
        loadingLatestServerMetrics: { ...s.loadingLatestServerMetrics, [nodeId]: false },
      }));
      return null;
    }
  },

  clearNodeMetrics: (nodeId: string) => {
    set((s) => {
      const { [nodeId]: _spark, ...restSparkline } = s.sparklineByNodeId;
      const { [nodeId]: _uptimeSpark, ...restUptimeSparkline } = s.uptimeSparklineByNodeId;
      const { [nodeId]: _uptime, ...restUptime } = s.uptimeByNodeId;
      const { [nodeId]: _server, ...restServer } = s.serverMetricsByNodeId;
      const { [nodeId]: _latestServer, ...restLatestServer } = s.latestServerMetricsByNodeId;
      return {
        sparklineByNodeId: restSparkline,
        uptimeSparklineByNodeId: restUptimeSparkline,
        uptimeByNodeId: restUptime,
        serverMetricsByNodeId: restServer,
        latestServerMetricsByNodeId: restLatestServer,
      };
    });
  },

  fetchMetricsForAllServerNodes: async (nodes: InfraNode[]) => {
    const state = get();
    
    // Check if metrics are available
    if (state.metricsAvailable === false) {
      return;
    }

    // Filter server nodes
    const serverNodes = nodes.filter(node => node.type === 'server');
    
    // Fetch latest server metrics for all server nodes
    const serverMetricsPromises = serverNodes.map(node => 
      state.fetchLatestServerMetrics(node.id)
    );
    
    // Fetch uptime for all nodes
    const uptimePromises = nodes.map(node => 
      state.fetchUptimeData(node.id, '24h')
    );
    
    // Wait for all fetches to complete
    await Promise.all([...serverMetricsPromises, ...uptimePromises]);
  },

  updateLatestServerMetricsFromWS: (nodeId: string, metrics: ServerMetricsDataPoint) => {
    const existing = get().latestServerMetricsByNodeId[nodeId];
    
    // Only update if data actually changed
    if (existing?.metrics &&
        existing.metrics.cpuUsage === metrics.cpuUsage &&
        existing.metrics.memoryUsedPercent === metrics.memoryUsedPercent) {
      return;
    }
    
    set((s) => ({
      latestServerMetricsByNodeId: {
        ...s.latestServerMetricsByNodeId,
        [nodeId]: {
          metrics,
          lastFetched: Date.now(),
        },
      },
    }));
  },

  clearAllMetrics: () => {
    set({
      sparklineByNodeId: {},
      uptimeSparklineByNodeId: {},
      uptimeByNodeId: {},
      serverMetricsByNodeId: {},
      latestServerMetricsByNodeId: {},
      loadingSparkline: {},
      loadingUptimeSparkline: {},
      loadingUptime: {},
      loadingServerMetrics: {},
      loadingLatestServerMetrics: {},
    });
  },
}));

// Optimized selectors

// Individual state selectors
export const useUptimeByNodeId = () => useMetricsStore(state => state.uptimeByNodeId)
export const useLatestServerMetricsByNodeId = () => useMetricsStore(state => state.latestServerMetricsByNodeId)
export const useSparklineByNodeId = () => useMetricsStore(state => state.sparklineByNodeId)
export const useUptimeSparklineByNodeId = () => useMetricsStore(state => state.uptimeSparklineByNodeId)
export const useServerMetricsByNodeId = () => useMetricsStore(state => state.serverMetricsByNodeId)
export const useMetricsAvailable = () => useMetricsStore(state => state.metricsAvailable)

// Loading states
export const useLoadingSparkline = () => useMetricsStore(state => state.loadingSparkline)
export const useLoadingUptimeSparkline = () => useMetricsStore(state => state.loadingUptimeSparkline)
export const useLoadingUptime = () => useMetricsStore(state => state.loadingUptime)
export const useLoadingServerMetrics = () => useMetricsStore(state => state.loadingServerMetrics)
export const useLoadingLatestServerMetrics = () => useMetricsStore(state => state.loadingLatestServerMetrics)

// Actions - stable references
export const useMetricsActions = () => useMetricsStore(
  useShallow(state => ({
    fetchSparklineData: state.fetchSparklineData,
    fetchUptimeSparklineData: state.fetchUptimeSparklineData,
    fetchUptimeData: state.fetchUptimeData,
    fetchServerMetrics: state.fetchServerMetrics,
    fetchLatestServerMetrics: state.fetchLatestServerMetrics,
    fetchMetricsForAllServerNodes: state.fetchMetricsForAllServerNodes,
    updateLatestServerMetricsFromWS: state.updateLatestServerMetricsFromWS,
    checkMetricsAvailability: state.checkMetricsAvailability,
    clearNodeMetrics: state.clearNodeMetrics,
    clearAllMetrics: state.clearAllMetrics,
  }))
)
