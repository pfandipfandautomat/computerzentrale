import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { InfraNode, InfraEdge, DockerContainer, ReverseProxyConfig, WireGuardStatus, NetworkInterface } from '@/types'
import { api } from '@/services/api'

// Interface for node status stored separately from nodes
interface NodeStatus {
  status: 'online' | 'offline' | 'unknown'
  latency?: number
  lastChecked?: string
}

interface InfraStore {
  nodes: InfraNode[]
  edges: InfraEdge[]
  selectedNodeId: string | null
  isLoading: boolean
  containersFetched: boolean
  proxyConfigsFetched: boolean
  wireguardStatusFetched: boolean
  interfacesFetched: boolean
  containersByNodeId: Record<string, DockerContainer[]>
  proxyConfigsByNodeId: Record<string, ReverseProxyConfig[]>
  wireguardStatusByNodeId: Record<string, WireGuardStatus>
  interfacesByNodeId: Record<string, NetworkInterface[]>
  nodeStatusById: Record<string, NodeStatus>
  pendingPositions: Record<string, { x: number; y: number }>
  
  setNodes: (nodes: InfraNode[]) => void
  setEdges: (edges: InfraEdge[]) => void
  setSelectedNodeId: (id: string | null) => void
  setSelectedNode: (node: InfraNode | null) => void
  setIsLoading: (loading: boolean) => void
  addNode: (node: InfraNode) => void
  updateNode: (id: string, updates: Partial<InfraNode>) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  updateNodeStatus: (id: string, status: NodeStatus) => void
  savePositions: () => Promise<void>
  deleteNode: (id: string) => void
  addEdge: (edge: InfraEdge) => void
  deleteEdge: (id: string) => void
  clearAllEdges: () => Promise<void>
  fetchNodes: () => Promise<void>
  fetchEdges: () => Promise<void>
  fetchAll: () => Promise<void>
  fetchContainersForNode: (nodeId: string) => Promise<void>
  fetchAllContainers: () => Promise<void>
  fetchProxyConfigsForNode: (nodeId: string) => Promise<void>
  fetchAllProxyConfigs: () => Promise<void>
  fetchWireGuardStatusForNode: (nodeId: string) => Promise<void>
  fetchAllWireGuardStatus: () => Promise<void>
  fetchInterfacesForNode: (nodeId: string) => Promise<void>
  fetchAllInterfaces: () => Promise<void>
  addInterface: (nodeId: string, iface: NetworkInterface) => void
  removeInterface: (nodeId: string, interfaceId: string) => void
}

// Debounce timer stored outside of Zustand to avoid re-renders
let savePositionsTimeout: NodeJS.Timeout | null = null;

export const useInfraStore = create<InfraStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isLoading: false,
  containersFetched: false,
  proxyConfigsFetched: false,
  wireguardStatusFetched: false,
  interfacesFetched: false,
  containersByNodeId: {},
  proxyConfigsByNodeId: {},
  wireguardStatusByNodeId: {},
  interfacesByNodeId: {},
  nodeStatusById: {},
  pendingPositions: {},
  
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedNode: (node) => set({ selectedNodeId: node?.id || null }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  
  // Update node (for non-position updates like name, host, etc.)
  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    })),
  
  // Update node position - updates store immediately and queues backend save
  updateNodePosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, position } : node
      ),
      pendingPositions: {
        ...state.pendingPositions,
        [id]: position,
      },
    }));
    
    // Debounce backend save
    if (savePositionsTimeout) {
      clearTimeout(savePositionsTimeout);
    }
    savePositionsTimeout = setTimeout(() => {
      get().savePositions();
    }, 1000);
  },
  
  // Save pending positions to backend
  savePositions: async () => {
    const { pendingPositions } = get();
    if (Object.keys(pendingPositions).length === 0) return;
    
    // Clear pending positions immediately
    set({ pendingPositions: {} });
    
    try {
      await api.updateNodePositions(pendingPositions);
    } catch (error) {
      console.error('Failed to save positions:', error);
    }
  },
  
  // Status updates (separate from nodes to avoid re-renders)
  updateNodeStatus: (id, status) =>
    set((state) => ({
      nodeStatusById: {
        ...state.nodeStatusById,
        [id]: status,
      },
    })),
    
  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      nodeStatusById: Object.fromEntries(
        Object.entries(state.nodeStatusById).filter(([key]) => key !== id)
      ),
      containersByNodeId: Object.fromEntries(
        Object.entries(state.containersByNodeId).filter(([key]) => key !== id)
      ),
      proxyConfigsByNodeId: Object.fromEntries(
        Object.entries(state.proxyConfigsByNodeId).filter(([key]) => key !== id)
      ),
      wireguardStatusByNodeId: Object.fromEntries(
        Object.entries(state.wireguardStatusByNodeId).filter(([key]) => key !== id)
      ),
      interfacesByNodeId: Object.fromEntries(
        Object.entries(state.interfacesByNodeId).filter(([key]) => key !== id)
      ),
      pendingPositions: Object.fromEntries(
        Object.entries(state.pendingPositions).filter(([key]) => key !== id)
      ),
    })),
  addEdge: (edge) => set((state) => ({ edges: [...state.edges, edge] })),
  deleteEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    })),
  clearAllEdges: async () => {
    try {
      await api.deleteAllEdges()
      set({ edges: [] })
    } catch (error) {
      console.error('Failed to delete all edges:', error)
      throw error
    }
  },
  fetchNodes: async () => {
    set({ isLoading: true })
    try {
      const nodes = await api.getNodes()
      set({ nodes })
    } catch (error) {
      console.error('Failed to fetch nodes:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
  fetchEdges: async () => {
    set({ isLoading: true })
    try {
      const edges = await api.getEdges()
      set({ edges })
    } catch (error) {
      console.error('Failed to fetch edges:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
  fetchAll: async () => {
    set({ isLoading: true })
    try {
      const [nodes, edges] = await Promise.all([
        api.getNodes(),
        api.getEdges(),
      ])
      set({ nodes, edges })
      
      const fetchPromises: Promise<void>[] = []
      
      if (!get().containersFetched) {
        set({ containersFetched: true })
        fetchPromises.push(get().fetchAllContainers())
      }
      
      if (!get().proxyConfigsFetched) {
        set({ proxyConfigsFetched: true })
        fetchPromises.push(get().fetchAllProxyConfigs())
      }
      
      if (!get().wireguardStatusFetched) {
        set({ wireguardStatusFetched: true })
        fetchPromises.push(get().fetchAllWireGuardStatus())
      }
      
      if (!get().interfacesFetched) {
        set({ interfacesFetched: true })
        fetchPromises.push(get().fetchAllInterfaces())
      }
      
      Promise.allSettled(fetchPromises)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
  fetchContainersForNode: async (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId)
    if (!node || !node.tags?.includes('docker')) return
    
    try {
      const result = await api.getNodeContainers(nodeId)
      set((state) => ({
        containersByNodeId: {
          ...state.containersByNodeId,
          [nodeId]: result.containers,
        },
      }))
    } catch (error) {
      console.error(`Failed to fetch containers for node ${nodeId}:`, error)
    }
  },
  fetchAllContainers: async () => {
    const dockerNodes = get().nodes.filter(n => n.tags?.includes('docker'))
    await Promise.allSettled(
      dockerNodes.map(node => get().fetchContainersForNode(node.id))
    )
  },
  fetchProxyConfigsForNode: async (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId)
    if (!node || !node.tags?.includes('reverse-proxy')) return
    
    try {
      const result = await api.getNodeProxyConfigs(nodeId)
      set((state) => ({
        proxyConfigsByNodeId: {
          ...state.proxyConfigsByNodeId,
          [nodeId]: result.configs,
        },
      }))
    } catch (error) {
      console.error(`Failed to fetch proxy configs for node ${nodeId}:`, error)
    }
  },
  fetchAllProxyConfigs: async () => {
    const proxyNodes = get().nodes.filter(n => n.tags?.includes('reverse-proxy'))
    await Promise.allSettled(
      proxyNodes.map(node => get().fetchProxyConfigsForNode(node.id))
    )
  },
  fetchWireGuardStatusForNode: async (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId)
    if (!node || !node.tags?.includes('wireguard')) return
    
    try {
      const result = await api.getNodeWireGuardStatus(nodeId)
      const status = result.status
      if (status) {
        set((state) => ({
          wireguardStatusByNodeId: {
            ...state.wireguardStatusByNodeId,
            [nodeId]: status,
          },
        }))
      }
    } catch (error) {
      console.error(`Failed to fetch WireGuard status for node ${nodeId}:`, error)
    }
  },
  fetchAllWireGuardStatus: async () => {
    const wireguardNodes = get().nodes.filter(n => n.tags?.includes('wireguard'))
    await Promise.allSettled(
      wireguardNodes.map(node => get().fetchWireGuardStatusForNode(node.id))
    )
  },
  fetchInterfacesForNode: async (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId)
    if (!node || !node.tags?.includes('wireguard')) return
    
    try {
      const interfaces = await api.getNodeInterfaces(nodeId)
      set((state) => ({
        interfacesByNodeId: {
          ...state.interfacesByNodeId,
          [nodeId]: interfaces,
        },
      }))
    } catch (error) {
      console.error(`Failed to fetch interfaces for node ${nodeId}:`, error)
    }
  },
  fetchAllInterfaces: async () => {
    const wireguardNodes = get().nodes.filter(n => n.tags?.includes('wireguard'))
    await Promise.allSettled(
      wireguardNodes.map(node => get().fetchInterfacesForNode(node.id))
    )
  },
  addInterface: (nodeId: string, iface: NetworkInterface) =>
    set((state) => ({
      interfacesByNodeId: {
        ...state.interfacesByNodeId,
        [nodeId]: [...(state.interfacesByNodeId[nodeId] || []), iface],
      },
    })),
  removeInterface: (nodeId: string, interfaceId: string) =>
    set((state) => ({
      interfacesByNodeId: {
        ...state.interfacesByNodeId,
        [nodeId]: (state.interfacesByNodeId[nodeId] || []).filter(
          (iface) => iface.id !== interfaceId
        ),
      },
    })),
}))

// Optimized selectors

// Individual state selectors
export const useNodes = () => useInfraStore(state => state.nodes)
export const useEdges = () => useInfraStore(state => state.edges)
export const useInfraSelectedNodeId = () => useInfraStore(state => state.selectedNodeId)
export const useInfraIsLoading = () => useInfraStore(state => state.isLoading)

// Data by node ID selectors
export const useNodeStatusById = () => useInfraStore(state => state.nodeStatusById)
export const useContainersByNodeId = () => useInfraStore(state => state.containersByNodeId)
export const useProxyConfigsByNodeId = () => useInfraStore(state => state.proxyConfigsByNodeId)
export const useWireguardStatusByNodeId = () => useInfraStore(state => state.wireguardStatusByNodeId)
export const useInterfacesByNodeId = () => useInfraStore(state => state.interfacesByNodeId)

// Optimized single node selectors - only re-render when that specific node changes
export const useNodeById = (id: string | null) => 
  useInfraStore(state => id ? state.nodes.find(n => n.id === id) || null : null)

export const useNodeTags = (id: string | null) =>
  useInfraStore(
    useShallow(state => {
      if (!id) return undefined
      const node = state.nodes.find(n => n.id === id)
      return node?.tags
    })
  )

export const useNodeType = (id: string | null) =>
  useInfraStore(state => {
    if (!id) return undefined
    const node = state.nodes.find(n => n.id === id)
    return node?.type
  })

// Actions - stable references
export const useInfraActions = () => useInfraStore(
  useShallow(state => ({
    setNodes: state.setNodes,
    setEdges: state.setEdges,
    setSelectedNodeId: state.setSelectedNodeId,
    setSelectedNode: state.setSelectedNode,
    addNode: state.addNode,
    updateNode: state.updateNode,
    updateNodePosition: state.updateNodePosition,
    updateNodeStatus: state.updateNodeStatus,
    deleteNode: state.deleteNode,
    addEdge: state.addEdge,
    deleteEdge: state.deleteEdge,
    clearAllEdges: state.clearAllEdges,
    fetchNodes: state.fetchNodes,
    fetchEdges: state.fetchEdges,
    fetchAll: state.fetchAll,
    fetchContainersForNode: state.fetchContainersForNode,
    fetchProxyConfigsForNode: state.fetchProxyConfigsForNode,
    fetchWireGuardStatusForNode: state.fetchWireGuardStatusForNode,
    fetchInterfacesForNode: state.fetchInterfacesForNode,
  }))
)
