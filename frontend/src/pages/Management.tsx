import { useEffect } from 'react'
import { 
  Container, 
  Globe, 
  Shield, 
  HardDrive, 
  Boxes,
  Server,
  Search,
  AlertCircle,
  Terminal as TerminalIcon,
  Cpu,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarHeader,
  SidebarSearch,
  SidebarNav,
  SidebarNavItem,
  SidebarDivider,
  SidebarContent,
  SidebarItem,
  SidebarEmpty,
} from '@/components/ui/sidebar'
import { 
  useManagementStore, 
  ManagementTab, 
  DockerHost, 
  ReverseProxyHost, 
  WireGuardHost,
  GPUHost,
  useActiveTab,
  useSelectedHostId,
  useDockerHosts,
  useProxyHosts,
  useWireguardHosts,
  useGpuHosts,
  useManagementActions,
} from '@/stores/useManagementStore'
import { useUrlParams, createTabParam, createHostParam } from '@/hooks/useUrlParams'
import { useNodes, useNodeStatusById, useInfraStore } from '@/stores/useInfraStore'
import { Terminal } from '@/components/Terminal'

// Import the content components
import { Docker } from './Docker'
import { ReverseProxy } from './ReverseProxy'
import { WireGuard } from './WireGuard'
import { GPU } from './GPU'

interface Tab {
  id: ManagementTab
  label: string
  icon: React.ElementType
  color: string
  tag: string
}

const tabs: Tab[] = [
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon, color: 'text-emerald-400', tag: 'terminal' },
  { id: 'docker', label: 'Docker', icon: Container, color: 'text-sky-400', tag: 'docker' },
  { id: 'reverse-proxy', label: 'Reverse Proxy', icon: Globe, color: 'text-violet-400', tag: 'reverse-proxy' },
  { id: 'wireguard', label: 'WireGuard', icon: Shield, color: 'text-amber-400', tag: 'wireguard' },
  { id: 'gpu', label: 'GPU Cluster', icon: Cpu, color: 'text-emerald-400', tag: 'gpu' },
  { id: 'storage', label: 'Storage', icon: HardDrive, color: 'text-emerald-400', tag: 'storage' },
]

const tabLabels: Record<ManagementTab, string> = {
  'docker': 'Docker Hosts',
  'reverse-proxy': 'Proxy Hosts',
  'wireguard': 'VPN Hosts',
  'terminal': 'Servers',
  'gpu': 'GPU Hosts',
  'storage': 'Storage',
}

function StoragePlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <HardDrive className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold mb-2 text-foreground/80">Storage Management</h2>
        <p className="text-sm text-muted-foreground/70 max-w-md">
          Storage management features coming soon. Monitor disk usage, manage volumes, and track storage across your infrastructure.
        </p>
      </div>
    </div>
  )
}

function HostsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[72px] bg-secondary/30 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

function TabButton({ tab }: { tab: Tab }) {
  const { activeTab, setActiveTab, getHostCounts, isLoadingDocker, isLoadingProxy, isLoadingWireguard, isLoadingGpu } = useManagementStore()
  const nodes = useNodes()
  const nodeStatusById = useNodeStatusById()
  const isActive = activeTab === tab.id
  const Icon = tab.icon
  
  const counts = getHostCounts()
  
  const getCount = () => {
    switch (tab.id) {
      case 'docker': return counts.docker
      case 'reverse-proxy': return counts.proxy
      case 'wireguard': return counts.wireguard
      case 'gpu': return counts.gpu
      case 'terminal': {
        const servers = nodes.filter(n => n.type === 'server')
        const online = servers.filter(n => {
          const status = nodeStatusById[n.id]?.status ?? n.status
          return status === 'online'
        }).length
        return { total: servers.length, online }
      }
      default: return { total: 0, online: 0 }
    }
  }
  
  const isLoading = () => {
    switch (tab.id) {
      case 'docker': return isLoadingDocker
      case 'reverse-proxy': return isLoadingProxy
      case 'wireguard': return isLoadingWireguard
      case 'gpu': return isLoadingGpu
      default: return false
    }
  }
  
  const { total, online } = getCount()
  const loading = isLoading()
  
  const getSubtitle = () => {
    if (tab.id === 'storage') return 'Coming soon'
    if (loading) return 'Loading...'
    if (total > 0) return `${online} online`
    return 'No hosts'
  }
  
  return (
    <SidebarNavItem
      icon={<Icon className="h-4 w-4" />}
      iconColor={tab.color}
      label={tab.label}
      isActive={isActive}
      onClick={() => setActiveTab(tab.id)}
      badge={tab.id !== 'storage' && total > 0 ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium bg-secondary/80">
          {total}
        </Badge>
      ) : undefined}
      subtitle={getSubtitle()}
    />
  )
}

function HostCard({ 
  host, 
  isSelected, 
  onClick,
  icon: Icon,
  iconColor,
  subtitle,
}: { 
  host: DockerHost | ReverseProxyHost | WireGuardHost | GPUHost
  isSelected: boolean
  onClick: () => void
  icon: React.ElementType
  iconColor: string
  subtitle: string
}) {
  const status = host.node.status as 'online' | 'offline' | 'unknown'
  
  return (
    <SidebarItem
      icon={<Icon className="h-4 w-4" />}
      iconColor={iconColor}
      title={host.node.name}
      subtitle={`${host.node.host} · ${subtitle}`}
      status={status}
      isSelected={isSelected}
      onClick={onClick}
      badge={status === 'online' && host.node.latency != null ? (
        <span className="text-[10px] font-medium text-emerald-400 tabular-nums">
          {host.node.latency}ms
        </span>
      ) : undefined}
    />
  )
}

function TerminalHostsList() {
  const nodes = useNodes()
  const nodeStatusById = useNodeStatusById()
  const { selectedHostId, setSelectedHostId, searchQuery } = useManagementStore()
  
  const servers = nodes.filter(n => {
    if (n.type !== 'server') return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return n.name.toLowerCase().includes(q) || n.host.toLowerCase().includes(q)
  })
  
  if (servers.length === 0) {
    if (searchQuery) {
      return (
        <SidebarEmpty
          icon={<Search className="h-8 w-8" />}
          title="No matches found"
        />
      )
    }
    return (
      <SidebarEmpty
        icon={<Server className="h-8 w-8" />}
        title="No servers found"
        description="Add server nodes to use Terminal"
      />
    )
  }
  
  return (
    <>
      {servers.map((node) => {
        const status = (nodeStatusById[node.id]?.status ?? node.status ?? 'unknown') as 'online' | 'offline' | 'unknown'
        const latency = nodeStatusById[node.id]?.latency ?? node.latency
        
        return (
          <SidebarItem
            key={node.id}
            icon={<Server className="h-4 w-4" />}
            iconColor="text-blue-400"
            title={node.name}
            subtitle={`${node.sshUser || 'root'}@${node.host}:${node.port || 22}`}
            status={status}
            isSelected={selectedHostId === node.id}
            onClick={() => setSelectedHostId(node.id)}
            badge={status === 'online' && latency != null ? (
              <span className="text-[10px] font-medium text-emerald-400 tabular-nums">
                {latency}ms
              </span>
            ) : undefined}
          />
        )
      })}
    </>
  )
}

function HostsList() {
  const { 
    activeTab, 
    selectedHostId, 
    setSelectedHostId,
    getFilteredHostsForCurrentTab,
    searchQuery,
  } = useManagementStore()
  
  // Terminal tab uses its own host list
  if (activeTab === 'terminal') {
    return <TerminalHostsList />
  }
  
  const filteredHosts = getFilteredHostsForCurrentTab()
  
  if (activeTab === 'storage') {
    return (
      <SidebarEmpty
        icon={<HardDrive className="h-8 w-8" />}
        title="Coming soon"
      />
    )
  }
  
  if (filteredHosts.length === 0) {
    if (searchQuery) {
      return (
        <SidebarEmpty
          icon={<Search className="h-8 w-8" />}
          title="No matches found"
        />
      )
    }
    
    const tagName = activeTab === 'reverse-proxy' ? 'reverse-proxy' : activeTab
    return (
      <SidebarEmpty
        icon={<AlertCircle className="h-8 w-8" />}
        title="No hosts found"
        description={`Add '${tagName}' tag to nodes`}
      />
    )
  }
  
  const getHostConfig = () => {
    switch (activeTab) {
      case 'docker':
        return {
          icon: Container,
          iconColor: 'text-sky-400',
          getSubtitle: (h: DockerHost) => `${h.containers.length} container${h.containers.length !== 1 ? 's' : ''}`,
        }
      case 'reverse-proxy':
        return {
          icon: Globe,
          iconColor: 'text-violet-400',
          getSubtitle: (h: ReverseProxyHost) => `${h.configs.length} domain${h.configs.length !== 1 ? 's' : ''}`,
        }
      case 'wireguard':
        return {
          icon: Shield,
          iconColor: 'text-amber-400',
          getSubtitle: (h: WireGuardHost) => `${h.interfaces.length} interface${h.interfaces.length !== 1 ? 's' : ''}`,
        }
      case 'gpu':
        return {
          icon: Cpu,
          iconColor: 'text-emerald-400',
          getSubtitle: (h: GPUHost) => `${h.gpus.length} GPU${h.gpus.length !== 1 ? 's' : ''} · ${h.models.length} model${h.models.length !== 1 ? 's' : ''}`,
        }
      default:
        return {
          icon: Server,
          iconColor: 'text-muted-foreground',
          getSubtitle: () => '',
        }
    }
  }
  
  const config = getHostConfig()
  
  return (
    <>
      {filteredHosts.map((host: DockerHost | ReverseProxyHost | WireGuardHost | GPUHost) => (
        <HostCard
          key={host.node.id}
          host={host}
          isSelected={selectedHostId === host.node.id}
          onClick={() => setSelectedHostId(host.node.id)}
          icon={config.icon}
          iconColor={config.iconColor}
          subtitle={config.getSubtitle(host as any)}
        />
      ))}
    </>
  )
}

function TerminalContent() {
  const nodes = useNodes()
  const { selectedHostId } = useManagementStore()
  
  const selectedNode = selectedHostId ? nodes.find(n => n.id === selectedHostId) : null
  
  if (!selectedNode) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <TerminalIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2 text-foreground/80">SSH Terminal</h2>
          <p className="text-sm text-muted-foreground/70 max-w-md">
            Select a server to open a terminal session
          </p>
        </div>
      </div>
    )
  }
  
  if (selectedNode.type !== 'server') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <TerminalIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2 text-foreground/80">Terminal not available</h2>
          <p className="text-sm text-muted-foreground/70 max-w-md">
            Terminal is only available for server nodes with SSH access
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header matching other management pages */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-border">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <TerminalIcon className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{selectedNode.name}</h1>
          <p className="text-sm text-muted-foreground">
            {selectedNode.sshUser || 'root'}@{selectedNode.host}:{selectedNode.port || 22}
          </p>
        </div>
      </div>
      
      {/* Terminal fills remaining space */}
      <div className="flex-1 min-h-0">
        <Terminal key={selectedNode.id} nodeId={selectedNode.id} autoConnect />
      </div>
    </div>
  )
}

function ManagementSidebar() {
  const { 
    activeTab,
    searchQuery, 
    setSearchQuery,
    getSearchResults,
    isLoadingDocker,
    isLoadingProxy,
    isLoadingWireguard,
  } = useManagementStore()
  
  const searchResults = getSearchResults()
  
  const isCurrentTabLoading = () => {
    switch (activeTab) {
      case 'docker': return isLoadingDocker
      case 'reverse-proxy': return isLoadingProxy
      case 'wireguard': return isLoadingWireguard
      default: return false
    }
  }
  
  // Format other tabs with results for display
  const formatOtherTabs = (tabIds: ManagementTab[]) => {
    return tabIds.map(id => {
      const tab = tabs.find(t => t.id === id)
      return tab?.label || id
    }).join(', ')
  }
  
  return (
    <Sidebar>
      <SidebarHeader
        title="Management"
        icon={<Boxes className="h-5 w-5" />}
        action={<div className="h-8 w-8" />}
      />
      
      <SidebarSearch
        placeholder="Search hosts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        icon={<Search className="h-4 w-4" />}
      />
      
      {/* Cross-tab search hint */}
      {searchQuery && searchResults.hasOtherResults && (
        <p className="px-4 -mt-1 mb-2 text-[10px] text-muted-foreground/70">
          Also found in: {formatOtherTabs(searchResults.otherTabsWithResults)}
        </p>
      )}
      
      <SidebarNav>
        {tabs.map(tab => (
          <TabButton key={tab.id} tab={tab} />
        ))}
      </SidebarNav>
      
      <SidebarDivider label={tabLabels[activeTab]} />
      
      <SidebarContent>
        {isCurrentTabLoading() ? (
          <HostsSkeleton />
        ) : (
          <HostsList />
        )}
      </SidebarContent>
    </Sidebar>
  )
}

export function Management() {
  const store = useManagementStore()
  const activeTab = useActiveTab()
  const selectedHostId = useSelectedHostId()
  const dockerHosts = useDockerHosts()
  const proxyHosts = useProxyHosts()
  const wireguardHosts = useWireguardHosts()
  const gpuHosts = useGpuHosts()
  const nodes = useNodes()
  const { setSelectedHostId, fetchAllHosts, refreshCurrentTab } = useManagementActions()
  const { initialLoadComplete } = store
  const fetchNodes = useInfraStore(state => state.fetchNodes)
  
  // Sync URL params with store
  useUrlParams({
    params: [
      createTabParam(
        () => store.activeTab,
        (tab) => store.setActiveTab(tab as ManagementTab),
        'terminal'
      ),
      createHostParam(
        () => store.selectedHostId,
        store.setSelectedHostId
      ),
    ],
  })
  
  // Fetch all hosts on mount
  useEffect(() => {
    if (!initialLoadComplete) {
      fetchAllHosts()
    }
    // Also ensure infra nodes are loaded (needed for Terminal tab)
    if (nodes.length === 0) {
      fetchNodes()
    }
  }, [fetchAllHosts, initialLoadComplete, nodes.length, fetchNodes])
  
  // Auto-select first host when tab changes and no host is selected
  useEffect(() => {
    // Skip if a host is already selected
    if (selectedHostId) return
    
    // Skip storage tab (no hosts)
    if (activeTab === 'storage') return
    
    // For terminal tab, auto-select first server from infra store
    if (activeTab === 'terminal') {
      const servers = nodes.filter(n => n.type === 'server')
      if (servers.length > 0) {
        setSelectedHostId(servers[0].id)
      }
      return
    }
    
    // Get hosts for current tab
    let hosts: { node: { id: string } }[] = []
    switch (activeTab) {
      case 'docker':
        hosts = dockerHosts
        break
      case 'reverse-proxy':
        hosts = proxyHosts
        break
      case 'wireguard':
        hosts = wireguardHosts
        break
      case 'gpu':
        hosts = gpuHosts
        break
    }
    
    // Auto-select first host if available
    if (hosts.length > 0) {
      setSelectedHostId(hosts[0].node.id)
    }
  }, [activeTab, dockerHosts, proxyHosts, wireguardHosts, gpuHosts, selectedHostId, setSelectedHostId, nodes])
  
  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshCurrentTab()
      }
    }, 10000)
    
    return () => clearInterval(interval)
  }, [refreshCurrentTab])
  
  return (
    <div className="flex h-full">
      <ManagementSidebar />
      
      <div className="flex-1 overflow-hidden">
        {activeTab === 'docker' && <Docker />}
        {activeTab === 'reverse-proxy' && <ReverseProxy />}
        {activeTab === 'wireguard' && <WireGuard />}
        {activeTab === 'gpu' && <GPU />}
        {activeTab === 'terminal' && <TerminalContent />}
        {activeTab === 'storage' && <StoragePlaceholder />}
      </div>
    </div>
  )
}
