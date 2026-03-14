import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { api } from '@/services/api'
import { InfraNode, DockerContainer, NginxConfigFile, WireGuardInterfaceInfo } from '@/types'

// Fast deep equality check for arrays of hosts
// Uses JSON.stringify for simplicity but caches to avoid repeated comparisons
function areHostsEqual<T extends { node: InfraNode }>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  if (a.length === 0) return true
  
  // Fast path: check if it's the same reference
  if (a === b) return true
  
  // Compare serialized data (efficient for nested objects)
  // This is fast enough for typical management page data sizes
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    // Fallback to false if serialization fails
    return false
  }
}

export type ManagementTab = 'docker' | 'reverse-proxy' | 'wireguard' | 'terminal' | 'storage'

export interface DockerHost {
  node: InfraNode
  containers: DockerContainer[]
}

export interface ReverseProxyHost {
  node: InfraNode
  configs: NginxConfigFile[]
}

export interface WireGuardHost {
  node: InfraNode
  interfaces: WireGuardInterfaceInfo[]
}

interface SearchResults {
  docker: DockerHost[]
  proxy: ReverseProxyHost[]
  wireguard: WireGuardHost[]
  hasOtherResults: boolean
  otherTabsWithResults: ManagementTab[]
}

interface ManagementStore {
  // Navigation state
  activeTab: ManagementTab
  selectedHostId: string | null
  searchQuery: string
  
  // Data
  dockerHosts: DockerHost[]
  proxyHosts: ReverseProxyHost[]
  wireguardHosts: WireGuardHost[]
  
  // Loading states
  isLoadingDocker: boolean
  isLoadingProxy: boolean
  isLoadingWireguard: boolean
  initialLoadComplete: boolean
  
  // Actions
  setActiveTab: (tab: ManagementTab) => void
  setSelectedHostId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  
  // Fetch actions
  fetchDockerHosts: () => Promise<void>
  fetchProxyHosts: () => Promise<void>
  fetchWireguardHosts: () => Promise<void>
  fetchAllHosts: () => Promise<void>
  refreshCurrentTab: () => Promise<void>
  
  // Computed getters
  getHostCounts: () => {
    docker: { total: number; online: number }
    proxy: { total: number; online: number }
    wireguard: { total: number; online: number }
  }
  
  getFilteredHostsForCurrentTab: () => DockerHost[] | ReverseProxyHost[] | WireGuardHost[]
  
  getSearchResults: () => SearchResults
  
  getCurrentTabHosts: () => DockerHost[] | ReverseProxyHost[] | WireGuardHost[]
  
  getSelectedHost: () => DockerHost | ReverseProxyHost | WireGuardHost | null
}

// Helper to filter hosts by search query
function filterDockerHosts(hosts: DockerHost[], query: string): DockerHost[] {
  if (!query) return hosts
  const q = query.toLowerCase()
  return hosts.filter(host => 
    host.node.name.toLowerCase().includes(q) ||
    host.node.host.toLowerCase().includes(q) ||
    host.containers.some(c => c.name.toLowerCase().includes(q))
  )
}

function filterProxyHosts(hosts: ReverseProxyHost[], query: string): ReverseProxyHost[] {
  if (!query) return hosts
  const q = query.toLowerCase()
  return hosts.filter(host => 
    host.node.name.toLowerCase().includes(q) ||
    host.node.host.toLowerCase().includes(q) ||
    host.configs.some(c => c.domain.toLowerCase().includes(q))
  )
}

function filterWireguardHosts(hosts: WireGuardHost[], query: string): WireGuardHost[] {
  if (!query) return hosts
  const q = query.toLowerCase()
  return hosts.filter(host => 
    host.node.name.toLowerCase().includes(q) ||
    host.node.host.toLowerCase().includes(q) ||
    host.interfaces.some(i => i.name.toLowerCase().includes(q))
  )
}

export const useManagementStore = create<ManagementStore>((set, get) => ({
  // Initial state
  activeTab: 'terminal',
  selectedHostId: null,
  searchQuery: '',
  
  dockerHosts: [],
  proxyHosts: [],
  wireguardHosts: [],
  
  isLoadingDocker: false,
  isLoadingProxy: false,
  isLoadingWireguard: false,
  initialLoadComplete: false,
  
  // Actions
  setActiveTab: (tab) => {
    const currentTab = get().activeTab
    if (currentTab !== tab) {
      set({ activeTab: tab, selectedHostId: null })
    }
  },
  
  setSelectedHostId: (id) => set({ selectedHostId: id }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Fetch actions
  fetchDockerHosts: async () => {
    const isInitialLoad = get().dockerHosts.length === 0
    
    // Only show loading state on initial load to avoid re-renders during refresh
    if (isInitialLoad) {
      set({ isLoadingDocker: true })
    }
    
    try {
      const response = await api.getDockerHosts()
      const currentHosts = get().dockerHosts
      
      // Only update if data has changed
      if (!areHostsEqual(currentHosts, response.hosts)) {
        set({ dockerHosts: response.hosts })
      }
    } catch (error) {
      console.error('Failed to fetch Docker hosts:', error)
    } finally {
      if (isInitialLoad) {
        set({ isLoadingDocker: false })
      }
    }
  },
  
  fetchProxyHosts: async () => {
    const isInitialLoad = get().proxyHosts.length === 0
    
    // Only show loading state on initial load to avoid re-renders during refresh
    if (isInitialLoad) {
      set({ isLoadingProxy: true })
    }
    
    try {
      const response = await api.getReverseProxyHosts()
      const currentHosts = get().proxyHosts
      
      // Only update if data has changed
      if (!areHostsEqual(currentHosts, response.hosts)) {
        set({ proxyHosts: response.hosts })
      }
    } catch (error) {
      console.error('Failed to fetch Reverse Proxy hosts:', error)
    } finally {
      if (isInitialLoad) {
        set({ isLoadingProxy: false })
      }
    }
  },
  
  fetchWireguardHosts: async () => {
    const isInitialLoad = get().wireguardHosts.length === 0
    
    // Only show loading state on initial load to avoid re-renders during refresh
    if (isInitialLoad) {
      set({ isLoadingWireguard: true })
    }
    
    try {
      const response = await api.getWireGuardHosts()
      const currentHosts = get().wireguardHosts
      
      // Only update if data has changed
      if (!areHostsEqual(currentHosts, response.hosts)) {
        set({ wireguardHosts: response.hosts })
      }
    } catch (error) {
      console.error('Failed to fetch WireGuard hosts:', error)
    } finally {
      if (isInitialLoad) {
        set({ isLoadingWireguard: false })
      }
    }
  },
  
  fetchAllHosts: async () => {
    set({ isLoadingDocker: true, isLoadingProxy: true, isLoadingWireguard: true })
    
    try {
      const [dockerRes, proxyRes, wireguardRes] = await Promise.allSettled([
        api.getDockerHosts(),
        api.getReverseProxyHosts(),
        api.getWireGuardHosts(),
      ])
      
      const currentState = get()
      const newDockerHosts = dockerRes.status === 'fulfilled' ? dockerRes.value.hosts : []
      const newProxyHosts = proxyRes.status === 'fulfilled' ? proxyRes.value.hosts : []
      const newWireguardHosts = wireguardRes.status === 'fulfilled' ? wireguardRes.value.hosts : []
      
      // Only update state with changed data
      const updates: Partial<ManagementStore> = {
        initialLoadComplete: true,
      }
      
      if (!areHostsEqual(currentState.dockerHosts, newDockerHosts)) {
        updates.dockerHosts = newDockerHosts
      }
      if (!areHostsEqual(currentState.proxyHosts, newProxyHosts)) {
        updates.proxyHosts = newProxyHosts
      }
      if (!areHostsEqual(currentState.wireguardHosts, newWireguardHosts)) {
        updates.wireguardHosts = newWireguardHosts
      }
      
      set(updates)
    } finally {
      set({ isLoadingDocker: false, isLoadingProxy: false, isLoadingWireguard: false })
    }
  },
  
  refreshCurrentTab: async () => {
    const { activeTab, fetchDockerHosts, fetchProxyHosts, fetchWireguardHosts } = get()
    
    switch (activeTab) {
      case 'docker':
        await fetchDockerHosts()
        break
      case 'reverse-proxy':
        await fetchProxyHosts()
        break
      case 'wireguard':
        await fetchWireguardHosts()
        break
    }
  },
  
  // Computed getters
  getHostCounts: () => {
    const { dockerHosts, proxyHosts, wireguardHosts } = get()
    
    return {
      docker: {
        total: dockerHosts.length,
        online: dockerHosts.filter(h => h.node.status === 'online').length,
      },
      proxy: {
        total: proxyHosts.length,
        online: proxyHosts.filter(h => h.node.status === 'online').length,
      },
      wireguard: {
        total: wireguardHosts.length,
        online: wireguardHosts.filter(h => h.node.status === 'online').length,
      },
    }
  },
  
  getCurrentTabHosts: () => {
    const { activeTab, dockerHosts, proxyHosts, wireguardHosts } = get()
    
    switch (activeTab) {
      case 'docker':
        return dockerHosts
      case 'reverse-proxy':
        return proxyHosts
      case 'wireguard':
        return wireguardHosts
      default:
        return []
    }
  },
  
  getFilteredHostsForCurrentTab: () => {
    const { activeTab, dockerHosts, proxyHosts, wireguardHosts, searchQuery } = get()
    
    switch (activeTab) {
      case 'docker':
        return filterDockerHosts(dockerHosts, searchQuery)
      case 'reverse-proxy':
        return filterProxyHosts(proxyHosts, searchQuery)
      case 'wireguard':
        return filterWireguardHosts(wireguardHosts, searchQuery)
      default:
        return []
    }
  },
  
  getSearchResults: () => {
    const { activeTab, dockerHosts, proxyHosts, wireguardHosts, searchQuery } = get()
    
    const filteredDocker = filterDockerHosts(dockerHosts, searchQuery)
    const filteredProxy = filterProxyHosts(proxyHosts, searchQuery)
    const filteredWireguard = filterWireguardHosts(wireguardHosts, searchQuery)
    
    const otherTabsWithResults: ManagementTab[] = []
    
    if (activeTab !== 'docker' && filteredDocker.length > 0) {
      otherTabsWithResults.push('docker')
    }
    if (activeTab !== 'reverse-proxy' && filteredProxy.length > 0) {
      otherTabsWithResults.push('reverse-proxy')
    }
    if (activeTab !== 'wireguard' && filteredWireguard.length > 0) {
      otherTabsWithResults.push('wireguard')
    }
    
    return {
      docker: filteredDocker,
      proxy: filteredProxy,
      wireguard: filteredWireguard,
      hasOtherResults: otherTabsWithResults.length > 0,
      otherTabsWithResults,
    }
  },
  
  getSelectedHost: () => {
    const { activeTab, selectedHostId, dockerHosts, proxyHosts, wireguardHosts } = get()
    
    if (!selectedHostId) return null
    
    switch (activeTab) {
      case 'docker':
        return dockerHosts.find(h => h.node.id === selectedHostId) || null
      case 'reverse-proxy':
        return proxyHosts.find(h => h.node.id === selectedHostId) || null
      case 'wireguard':
        return wireguardHosts.find(h => h.node.id === selectedHostId) || null
      default:
        return null
    }
  },
}))

// Optimized selectors for components - prevents re-renders when unrelated state changes
export const useSelectedHostId = () => useManagementStore(state => state.selectedHostId)
export const useActiveTab = () => useManagementStore(state => state.activeTab)
export const useSearchQuery = () => useManagementStore(state => state.searchQuery)

// For hosts, we need to be careful - only subscribe to what we need
export const useWireguardHosts = () => useManagementStore(state => state.wireguardHosts)
export const useDockerHosts = () => useManagementStore(state => state.dockerHosts)
export const useProxyHosts = () => useManagementStore(state => state.proxyHosts)

// Loading states
export const useIsLoadingWireguard = () => useManagementStore(state => state.isLoadingWireguard)
export const useIsLoadingDocker = () => useManagementStore(state => state.isLoadingDocker)
export const useIsLoadingProxy = () => useManagementStore(state => state.isLoadingProxy)

// Actions - these are stable references, safe to destructure
export const useManagementActions = () => useManagementStore(
  useShallow(state => ({
    setActiveTab: state.setActiveTab,
    setSelectedHostId: state.setSelectedHostId,
    setSearchQuery: state.setSearchQuery,
    fetchDockerHosts: state.fetchDockerHosts,
    fetchProxyHosts: state.fetchProxyHosts,
    fetchWireguardHosts: state.fetchWireguardHosts,
    fetchAllHosts: state.fetchAllHosts,
    refreshCurrentTab: state.refreshCurrentTab,
  }))
)
