import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Connection,
  NodeMouseHandler,
  NodeChange,
  EdgeChange,
  Viewport,
  ConnectionMode,
} from '@xyflow/react';
import { useInfraStore } from '@/stores/useInfraStore';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { api } from '@/services/api';
import InfraNode from './InfraNode';
import CustomEdge from './CustomEdge';
import { AppNode, AppEdge, InfraNode as InfraNodeType } from '@/types';

const nodeTypes = {
  infraNode: InfraNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const InfrastructureCanvas = () => {
  const storeNodes = useInfraStore(state => state.nodes);
  const storeEdges = useInfraStore(state => state.edges);
  const nodeStatusById = useInfraStore(state => state.nodeStatusById);
  const isLoading = useInfraStore(state => state.isLoading);
  const setSelectedNode = useInfraStore(state => state.setSelectedNode);
  const updateNodePosition = useInfraStore(state => state.updateNodePosition);
  const savePositions = useInfraStore(state => state.savePositions);
  const addEdge = useInfraStore(state => state.addEdge);
  const deleteEdge = useInfraStore(state => state.deleteEdge);

  const {
    showAllEdges,
    showWireGuardEdges,
    showRegularEdges,
    showOfflineNodes,
    showNodeMetrics,
    showNodeDetails,
    showMiniMap,
    showGrid,
    showHighlighting,
    viewport,
    setViewport,
  } = useDisplayStore();

  // Local state for node dimensions (not persisted, only needed for MiniMap)
  const [nodeDimensions, setNodeDimensions] = useState<Record<string, { width: number; height: number }>>({});
  
  // Track hovered node for highlighting
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  // Track selected node for persistent highlighting
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Use selected node if set, otherwise use hovered node
  const activeNodeId = selectedNodeId ?? hoveredNodeId;

  // Compute connected node IDs for the active node (selected or hovered)
  const connectedNodeIds = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    
    const connectedIds = new Set<string>();
    connectedIds.add(activeNodeId);
    
    // Helper to check if an edge is a WireGuard edge
    const isWireGuardEdge = (edge: typeof storeEdges[0]) => 
      edge.sourceHandle?.includes('wireguard') || edge.targetHandle?.includes('wireguard');
    
    // First pass: find all directly connected nodes
    storeEdges.forEach(edge => {
      if (edge.source === activeNodeId) {
        connectedIds.add(edge.target);
      }
      if (edge.target === activeNodeId) {
        connectedIds.add(edge.source);
      }
    });
    
    // Second pass: for WireGuard connections, find all peers connected to the same WireGuard server
    // But DON'T traverse through multiple WireGuard servers
    storeEdges.forEach(edge => {
      if (!isWireGuardEdge(edge)) return;
      
      // If active node is connected via this WireGuard edge
      if (edge.source === activeNodeId || edge.target === activeNodeId) {
        // Find the WireGuard server (the other end of this edge)
        const wireGuardServer = edge.source === activeNodeId ? edge.target : edge.source;
        
        // Find all OTHER nodes connected to this same WireGuard server via WireGuard
        storeEdges.forEach(otherEdge => {
          if (!isWireGuardEdge(otherEdge)) return;
          
          // If this edge connects to the same WireGuard server
          if (otherEdge.source === wireGuardServer) {
            connectedIds.add(otherEdge.target);
          }
          if (otherEdge.target === wireGuardServer) {
            connectedIds.add(otherEdge.source);
          }
        });
      }
    });
    
    return connectedIds;
  }, [activeNodeId, storeEdges]);

  // Compute visible node IDs (for filtering edges)
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    storeNodes.forEach((node) => {
      // Apply the same filter logic as nodes
      if (!showOfflineNodes) {
        const status = nodeStatusById[node.id]?.status ?? node.status;
        if (status === 'offline') return;
      }
      ids.add(node.id);
    });
    return ids;
  }, [storeNodes, showOfflineNodes, nodeStatusById]);

  // Compute ReactFlow nodes from Zustand store, merged with local dimensions
  const nodes = useMemo<AppNode[]>(() => {
    return storeNodes
      .filter((node) => {
        // Filter out offline nodes if setting is disabled
        if (!showOfflineNodes) {
          const status = nodeStatusById[node.id]?.status ?? node.status;
          if (status === 'offline') return false;
        }
        return true;
      })
      .map((node) => ({
        id: node.id,
        type: 'infraNode' as const,
        position: node.position,
        data: { 
          ...node,
          isSelected: showHighlighting ? node.id === activeNodeId : false,
          isHighlighted: showHighlighting && activeNodeId ? connectedNodeIds.has(node.id) : null,
          isDimmed: showHighlighting && activeNodeId ? !connectedNodeIds.has(node.id) : false,
          showMetrics: showNodeMetrics,
          showDetails: showNodeDetails,
        },
        // Include measured dimensions if available (needed for MiniMap)
        ...(nodeDimensions[node.id] && {
          measured: nodeDimensions[node.id],
          width: nodeDimensions[node.id].width,
          height: nodeDimensions[node.id].height,
        }),
      }));
  }, [storeNodes, nodeDimensions, activeNodeId, connectedNodeIds, showOfflineNodes, showNodeMetrics, showNodeDetails, nodeStatusById, showHighlighting]);

  // Compute ReactFlow edges from Zustand store with real-time status
  const edges = useMemo<AppEdge[]>(() => {
    // If all edges are hidden, return empty array
    if (!showAllEdges) return [];
    
    return storeEdges
      .filter((edge) => {
        // Hide edges if either endpoint node is hidden
        if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
          return false;
        }
        
        const isWireGuardEdge = edge.sourceHandle?.includes('wireguard') || edge.targetHandle?.includes('wireguard');
        
        // Filter based on edge type visibility
        if (isWireGuardEdge && !showWireGuardEdges) return false;
        if (!isWireGuardEdge && !showRegularEdges) return false;
        
        return true;
      })
      .map((edge) => {
        const sourceNode = storeNodes.find(n => n.id === edge.source);
        const targetNode = storeNodes.find(n => n.id === edge.target);
        
        const sourceStatus = nodeStatusById[edge.source]?.status ?? sourceNode?.status ?? 'unknown';
        const targetStatus = nodeStatusById[edge.target]?.status ?? targetNode?.status ?? 'unknown';
        
        const isWireGuardEdge = edge.sourceHandle?.includes('wireguard') || edge.targetHandle?.includes('wireguard');
        
        // Edge is dimmed if there's an active node and EITHER endpoint is not in the connected set
        // This applies to ALL edges including WireGuard edges
        const isEdgeDimmed = activeNodeId 
          ? !(connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target))
          : false;
        
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          type: 'custom' as const,
          style: {
            stroke: isWireGuardEdge ? '#f59e0b' : undefined
          },
          data: {
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            sourceStatus,
            targetStatus,
            isDimmed: isEdgeDimmed,
          },
        };
      });
  }, [storeEdges, storeNodes, nodeStatusById, activeNodeId, connectedNodeIds, showAllEdges, showWireGuardEdges, showRegularEdges, visibleNodeIds]);

  // Handle node changes
  const onNodesChange = useCallback((changes: NodeChange<AppNode>[]) => {
    changes.forEach((change) => {
      // Handle position changes - update Zustand store
      if (change.type === 'position' && change.position) {
        updateNodePosition(change.id, change.position);
      }
      
      // Handle dimension changes - update local state for MiniMap
      if (change.type === 'dimensions' && change.dimensions) {
        setNodeDimensions(prev => ({
          ...prev,
          [change.id]: change.dimensions!,
        }));
      }
    });
  }, [updateNodePosition]);

  // Handle edge changes
  const onEdgesChange = useCallback((changes: EdgeChange<AppEdge>[]) => {
    changes.forEach((change) => {
      if (change.type === 'remove') {
        api.deleteEdge(change.id).catch(console.error);
        deleteEdge(change.id);
      }
    });
  }, [deleteEdge]);

  // Save pending positions on unmount
  useEffect(() => {
    return () => {
      savePositions();
    };
  }, [savePositions]);

  // Handle new connection
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      try {
        const newEdge = await api.createEdge({
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        });

        addEdge(newEdge);
      } catch (error) {
        console.error('Failed to create edge:', error);
      }
    },
    [addEdge]
  );

  // Handle edge deletion from custom edge component
  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    try {
      await api.deleteEdge(edgeId);
      deleteEdge(edgeId);
    } catch (error) {
      console.error('Failed to delete edge:', error);
    }
  }, [deleteEdge]);

  // Add onDelete handler to edges
  const edgesWithHandlers = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        onDelete: handleDeleteEdge,
      },
    }));
  }, [edges, handleDeleteEdge]);

  // Handle node click to select/deselect
  const onNodeClick: NodeMouseHandler<AppNode> = useCallback(
    (_event, node) => {
      setSelectedNodeId(prev => prev === node.id ? null : node.id);
    },
    []
  );

  // Handle node double-click to open detail panel
  const onNodeDoubleClick: NodeMouseHandler<AppNode> = useCallback(
    (_event, node) => {
      setSelectedNode(node.data as unknown as InfraNodeType);
    },
    [setSelectedNode]
  );

  // Handle node mouse enter
  const onNodeMouseEnter: NodeMouseHandler<AppNode> = useCallback(
    (_event, node) => {
      setHoveredNodeId(node.id);
    },
    []
  );

  // Handle node mouse leave
  const onNodeMouseLeave: NodeMouseHandler<AppNode> = useCallback(
    () => {
      setHoveredNodeId(null);
    },
    []
  );

  // Handle pane click to deselect
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Get node color for minimap using real-time status
  const getNodeColor = useCallback((node: AppNode) => {
    const data = node.data as InfraNodeType;
    const status = nodeStatusById[data?.id]?.status ?? data?.status;
    switch (status) {
      case 'online':
        return '#10b981';
      case 'offline':
        return '#ef4444';
      default:
        return '#64748b';
    }
  }, [nodeStatusById]);

  // Show loading state while nodes are initializing
  const showLoading = isLoading && storeNodes.length === 0;

  return (
    <div className="h-full w-full">
      {showLoading ? (
        <div className="h-full w-full flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {/* Outer spinning ring */}
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              {/* Inner pulsing dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-primary rounded-full animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Loading infrastructure...</p>
          </div>
        </div>
      ) : (
        <ReactFlow<AppNode, AppEdge>
          nodes={nodes}
          edges={edgesWithHandlers}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={viewport ?? { x: 0, y: 0, zoom: 1 }}
          fitView={!viewport}
          onMoveEnd={(_event, newViewport: Viewport) => setViewport(newViewport)}
          attributionPosition="bottom-left"
          className="bg-background"
        >
        {showGrid && (
          <Background
            gap={20}
            size={1}
            color="hsl(215 20% 25%)"
            className="opacity-40"
          />
        )}
        <Controls
          className="!bg-card !border-border !rounded-lg !shadow-lg"
          showInteractive={false}
        />
        {showMiniMap && (
          <MiniMap
            className="!bg-card !border-border !rounded-lg !shadow-lg"
            nodeColor={getNodeColor}
            maskColor="rgba(0, 0, 0, 0.8)"
          />
        )}
        </ReactFlow>
      )}
    </div>
  );
};

export default InfrastructureCanvas;
