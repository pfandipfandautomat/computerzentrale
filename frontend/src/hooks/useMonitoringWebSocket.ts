/// <reference types="vite/client" />
import { useEffect, useCallback, useRef } from 'react';
import { useInfraStore } from '@/stores/useInfraStore';
import { useMetricsStore } from '@/stores/useMetricsStore';

interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

interface PingResult {
  nodeId: string;
  status: 'online' | 'offline' | 'unknown';
  latency?: number;
  timestamp: string;
}

export function useMonitoringWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { updateNodeStatus } = useInfraStore();
  const updateLatestServerMetricsFromWS = useMetricsStore(state => state.updateLatestServerMetricsFromWS);

  const connect = useCallback(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isDev = import.meta.env.DEV;
    const host = isDev ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'ping_results') {
            const results = message.data as PingResult[];
            results.forEach((result) => {
              updateNodeStatus(result.nodeId, {
                status: result.status,
                latency: result.latency,
                lastChecked: result.timestamp,
              });
            });
          } else if (message.type === 'node_update') {
            const node = message.data as { id: string; status: string; latency?: number; lastChecked?: string };
            updateNodeStatus(node.id, {
              status: node.status as 'online' | 'offline' | 'unknown',
              latency: node.latency,
              lastChecked: node.lastChecked,
            });
          } else if (message.type === 'server_metrics') {
            const metricsArray = message.data as { nodeId: string; metrics: any }[];
            metricsArray.forEach((item) => {
              updateLatestServerMetricsFromWS(item.nodeId, {
                timestamp: item.metrics.timestamp,
                cpuUsage: item.metrics.cpuUsage,
                cpuLoad1m: item.metrics.cpuLoad1m,
                cpuLoad5m: item.metrics.cpuLoad5m,
                cpuLoad15m: item.metrics.cpuLoad15m,
                memoryTotal: item.metrics.memoryTotal,
                memoryUsed: item.metrics.memoryUsed,
                memoryFree: item.metrics.memoryFree,
                memoryCached: item.metrics.memoryCached,
                memoryBuffers: item.metrics.memoryBuffers,
                memoryUsedPercent: item.metrics.memoryUsedPercent,
                swapTotal: item.metrics.swapTotal,
                swapUsed: item.metrics.swapUsed,
                swapFree: item.metrics.swapFree,
                diskReadBytes: item.metrics.diskReadBytes,
                diskWriteBytes: item.metrics.diskWriteBytes,
                networkRxBytes: item.metrics.networkRxBytes,
                networkTxBytes: item.metrics.networkTxBytes,
                networkRxPackets: item.metrics.networkRxPackets,
                networkTxPackets: item.metrics.networkTxPackets,
                uptimeSeconds: item.metrics.uptimeSeconds,
                processesTotal: item.metrics.processesTotal,
              });
            });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [updateNodeStatus, updateLatestServerMetricsFromWS]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);
}
