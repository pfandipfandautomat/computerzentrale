import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

import { useWindowDrag } from './useWindowDrag';
import { WindowHeader } from './WindowHeader';
import { OverviewTab } from './tabs/OverviewTab';
import { Terminal } from '@/components/Terminal';
import { EditNodeModal } from '@/components/Modals/EditNodeModal';
import { EventLogModal } from '@/components/Modals/EventLogModal';
import { ScrollProgress } from '@/components/ui/scroll-progress';
import {
  useNodeById,
  useNodeStatusById,
  useContainersByNodeId,
  useProxyConfigsByNodeId,
  useWireguardStatusByNodeId,
  useGpuStatusByNodeId,
  useInfraActions,
} from '@/stores/useInfraStore';

interface NodeDetailWindowProps {
  nodeId: string;
  onClose: () => void;
}

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const MAX_WIDTH = 900;
const MAX_HEIGHT = 900;
const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 700;

export function NodeDetailWindow({ nodeId, onClose }: NodeDetailWindowProps) {
  // Zustand selectors
  const node = useNodeById(nodeId);
  const nodeStatusById = useNodeStatusById();
  const containersByNodeId = useContainersByNodeId();
  const proxyConfigsByNodeId = useProxyConfigsByNodeId();
  const wireguardStatusByNodeId = useWireguardStatusByNodeId();
  const gpuStatusByNodeId = useGpuStatusByNodeId();
  const {
    fetchContainersForNode,
    fetchProxyConfigsForNode,
    fetchWireGuardStatusForNode,
    fetchGpuStatusForNode,
  } = useInfraActions();

  const containers = containersByNodeId[nodeId] || [];
  const proxyConfigs = proxyConfigsByNodeId[nodeId] || [];
  const wireguardStatus = wireguardStatusByNodeId[nodeId];
  const gpuStatus = gpuStatusByNodeId[nodeId];
  const nodeStatus = nodeStatusById[nodeId];

  const status = nodeStatus?.status ?? node?.status ?? 'unknown';
  const latency = nodeStatus?.latency ?? node?.latency;

  // Window state
  const { position, isDragging, windowRef, handleMouseDown } = useWindowDrag();
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // UI state
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [eventLogOpen, setEventLogOpen] = useState(false);

  // Fetch refs to prevent duplicate fetches
  const lastFetchedNodeId = useRef<string | null>(null);
  const lastFetchedProxyNodeId = useRef<string | null>(null);
  const lastFetchedWireGuardNodeId = useRef<string | null>(null);

  // Resize handling
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      };
    },
    [size]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;

      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStart.current.width + deltaX));
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStart.current.height + deltaY));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Data fetching callbacks
  const fetchContainers = useCallback(async () => {
    if (!node || !node.tags?.includes('docker')) return;
    try {
      await fetchContainersForNode(node.id);
      lastFetchedNodeId.current = node.id;
    } catch (error) {
      console.error('Failed to fetch containers:', error);
    }
  }, [node, fetchContainersForNode]);

  const fetchProxyConfigs = useCallback(async () => {
    if (!node || !node.tags?.includes('reverse-proxy')) return;
    try {
      await fetchProxyConfigsForNode(node.id);
      lastFetchedProxyNodeId.current = node.id;
    } catch (error) {
      console.error('Failed to fetch proxy configs:', error);
    }
  }, [node, fetchProxyConfigsForNode]);

  const fetchWireGuardStatus = useCallback(async () => {
    if (!node || !node.tags?.includes('wireguard')) return;
    try {
      await fetchWireGuardStatusForNode(node.id);
      lastFetchedWireGuardNodeId.current = node.id;
    } catch (error) {
      console.error('Failed to fetch WireGuard status:', error);
    }
  }, [node, fetchWireGuardStatusForNode]);

  const fetchGpuStatus = useCallback(async () => {
    if (!node || !node.tags?.includes('gpu')) return;
    try {
      await fetchGpuStatusForNode(node.id);
    } catch (error) {
      console.error('Failed to fetch GPU status:', error);
    }
  }, [node, fetchGpuStatusForNode]);

  // Auto-fetch on mount
  useEffect(() => {
    if (node?.tags?.includes('docker') && lastFetchedNodeId.current !== node.id) {
      lastFetchedNodeId.current = node.id;
      fetchContainers();
    }
  }, [node?.id, node?.tags, fetchContainers]);

  useEffect(() => {
    if (node?.tags?.includes('reverse-proxy') && lastFetchedProxyNodeId.current !== node.id) {
      lastFetchedProxyNodeId.current = node.id;
      fetchProxyConfigs();
    }
  }, [node?.id, node?.tags, fetchProxyConfigs]);

  useEffect(() => {
    if (node?.tags?.includes('wireguard') && lastFetchedWireGuardNodeId.current !== node.id) {
      lastFetchedWireGuardNodeId.current = node.id;
      fetchWireGuardStatus();
    }
  }, [node?.id, node?.tags, fetchWireGuardStatus]);

  useEffect(() => {
    if (node?.tags?.includes('gpu')) {
      fetchGpuStatus();
    }
  }, [node?.id, node?.tags, fetchGpuStatus]);

  // Auto-refresh data every 10 seconds
  useEffect(() => {
    if (!node) return;

    const refreshData = () => {
      if (node.tags?.includes('docker')) {
        fetchContainersForNode(node.id);
      }
      if (node.tags?.includes('reverse-proxy')) {
        fetchProxyConfigsForNode(node.id);
      }
      if (node.tags?.includes('wireguard')) {
        fetchWireGuardStatusForNode(node.id);
      }
      if (node.tags?.includes('gpu')) {
        fetchGpuStatus();
      }
    };

    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [node?.id, node?.tags, fetchContainersForNode, fetchProxyConfigsForNode, fetchWireGuardStatusForNode, fetchGpuStatus]);

  if (!node) return null;

  const isServer = node.type === 'server';

  return (
    <>
      <div
        ref={windowRef}
        className={cn(
          'fixed z-50 flex flex-col',
          'bg-card/95 backdrop-blur-xl',
          'border border-border/50 rounded-xl',
          'shadow-2xl shadow-black/40',
          'ring-1 ring-white/5',
          'overflow-hidden',
          (isDragging || isResizing) && 'select-none'
        )}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* Header */}
        <WindowHeader
          name={node.name}
          host={node.host}
          type={node.type}
          nodeId={node.id}
          onClose={onClose}
          onEdit={() => setEditModalOpen(true)}
          onOpenEventLog={() => setEventLogOpen(true)}
          onToggleTerminal={() => setIsTerminalMode(!isTerminalMode)}
          onMouseDown={handleMouseDown}
          isDragging={isDragging}
          isServer={isServer}
          isTerminalMode={isTerminalMode}
          telegramAlerts={node.telegramAlerts}
        />

        {/* Content */}
        {isTerminalMode ? (
          <div className="flex-1 min-h-0">
            <Terminal nodeId={nodeId} autoConnect />
          </div>
        ) : (
          <ScrollProgress>
            <OverviewTab
              nodeId={node.id}
              node={node}
              status={status}
              latency={latency}
              containers={containers}
              proxyConfigs={proxyConfigs}
              wireguardStatus={wireguardStatus}
              gpuInfo={gpuStatus?.gpus}
              gpuModels={gpuStatus?.models}
            />
          </ScrollProgress>
        )}

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            'absolute bottom-0 right-0 w-5 h-5 cursor-se-resize',
            'flex items-end justify-end p-1',
            'opacity-30 hover:opacity-60 transition-opacity'
          )}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground">
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Edit Modal */}
      <EditNodeModal node={node} open={editModalOpen} onOpenChange={setEditModalOpen} />

      {/* Event Log Modal */}
      <EventLogModal nodeId={node.id} nodeName={node.name} open={eventLogOpen} onOpenChange={setEventLogOpen} />
    </>
  );
}
