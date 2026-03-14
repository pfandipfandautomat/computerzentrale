import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '@/services/api'
import { WireGuardInterfaceDetail, GeneratedWireGuardClient } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { 
  useSelectedHostId, 
  useWireguardHosts
} from '@/stores/useManagementStore'
import { 
  Server, 
  Shield, 
  Plus,
  Trash2, 
  Search,
  Loader2,
  Copy,
  Check,
  Users,
  ArrowUpDown,
  Clock,
  FileText,
  Terminal
} from 'lucide-react'

interface DeleteDialogState {
  open: boolean
  nodeId: string | null
  interfaceName: string | null
  publicKey: string | null
  peerName: string | null
}

interface AddClientDialogState {
  open: boolean
  clientName: string
}

interface ClientConfigDialogState {
  open: boolean
  client: GeneratedWireGuardClient | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

export function WireGuard() {
  const selectedHostId = useSelectedHostId()
  const wireguardHosts = useWireguardHosts()
  
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null)
  const [interfaceDetail, setInterfaceDetail] = useState<WireGuardInterfaceDetail | null>(null)
  const [loadingInterface, setLoadingInterface] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)
  
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    nodeId: null,
    interfaceName: null,
    publicKey: null,
    peerName: null,
  })
  
  const [addClientDialog, setAddClientDialog] = useState<AddClientDialogState>({
    open: false,
    clientName: '',
  })
  
  const [clientConfigDialog, setClientConfigDialog] = useState<ClientConfigDialogState>({
    open: false,
    client: null,
  })

  // Use ref to track previous host ID for comparison
  const prevHostIdRef = useRef<string | null>(null)

  // Stable selectedHost lookup - only recalculate when ID changes
  const selectedHost = useMemo(() => {
    return wireguardHosts.find(h => h.node.id === selectedHostId) || null
  }, [wireguardHosts, selectedHostId])

  // Auto-select first interface only when host actually changes
  useEffect(() => {
    if (selectedHostId === prevHostIdRef.current) return
    prevHostIdRef.current = selectedHostId
    
    // Look up host directly from store to avoid dependency on selectedHost
    const host = wireguardHosts.find(h => h.node.id === selectedHostId)
    
    if (host && host.interfaces.length > 0) {
      setSelectedInterface(host.interfaces[0].name)
    } else {
      setSelectedInterface(null)
      setInterfaceDetail(null)
    }
  }, [selectedHostId, wireguardHosts])

  // Stable fetch function - no toast in deps since it's module-level
  const fetchInterfaceDetail = useCallback(async () => {
    if (!selectedHostId || !selectedInterface) {
      setInterfaceDetail(null)
      return
    }
    
    setLoadingInterface(true)
    try {
      const response = await api.getWireGuardInterface(selectedHostId, selectedInterface)
      setInterfaceDetail(response.interface)
    } catch (error) {
      toast({
        title: 'Could not load interface',
        description: error instanceof Error ? error.message : 'Check WireGuard is running and try again.',
        variant: 'destructive',
      })
      setInterfaceDetail(null)
    } finally {
      setLoadingInterface(false)
    }
  }, [selectedHostId, selectedInterface])

  // Use ref to always have latest callback without re-running effect
  const fetchInterfaceDetailRef = useRef(fetchInterfaceDetail)
  fetchInterfaceDetailRef.current = fetchInterfaceDetail

  // Fetch when selection changes - stable dependencies
  useEffect(() => {
    fetchInterfaceDetailRef.current()
  }, [selectedHostId, selectedInterface])

  // Merge config peers with runtime peers
  const mergedPeers = useMemo(() => {
    if (!interfaceDetail) return []
    
    return interfaceDetail.peers.map(configPeer => {
      const runtimePeer = interfaceDetail.runtimePeers.find(
        rp => rp.publicKey === configPeer.publicKey
      )
      return {
        ...configPeer,
        runtime: runtimePeer || null,
      }
    })
  }, [interfaceDetail])

  // Filter peers based on search query
  const filteredPeers = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return mergedPeers.filter(peer => 
      peer.name.toLowerCase().includes(query) ||
      peer.publicKey.toLowerCase().includes(query) ||
      peer.allowedIps.toLowerCase().includes(query)
    )
  }, [mergedPeers, searchQuery])

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
      toast({
        description: `${field} copied to clipboard`,
      })
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not access clipboard. Try selecting and copying manually.',
        variant: 'destructive',
      })
    }
  }

  // Add new client
  const handleAddClient = async () => {
    if (!selectedHostId || !selectedInterface) return
    
    const { clientName } = addClientDialog
    
    if (!clientName.trim()) {
      toast({
        title: 'Client name required',
        description: 'Enter a name to identify this VPN client.',
        variant: 'destructive',
      })
      return
    }
    
    const key = 'add-client'
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      const response = await api.createWireGuardPeer(selectedHostId, selectedInterface, clientName.trim())
      
      // Close add dialog and open config dialog
      setAddClientDialog({ open: false, clientName: '' })
      setClientConfigDialog({ open: true, client: response.client })
      
      // Refresh interface detail
      await fetchInterfaceDetail()
      
      toast({
        description: `${clientName} created successfully`,
      })
    } catch (error) {
      toast({
        title: 'Could not create client',
        description: error instanceof Error ? error.message : 'Check WireGuard is running and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  // Delete peer
  const handleDeletePeer = async () => {
    if (!deleteDialog.nodeId || !deleteDialog.interfaceName || !deleteDialog.publicKey) return
    
    const key = `delete-${deleteDialog.publicKey}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      await api.deleteWireGuardPeer(deleteDialog.nodeId, deleteDialog.interfaceName, deleteDialog.publicKey)
      toast({
        description: 'Peer removed',
      })
      setDeleteDialog({
        open: false,
        nodeId: null,
        interfaceName: null,
        publicKey: null,
        peerName: null,
      })
      await fetchInterfaceDetail()
    } catch (error) {
      toast({
        title: 'Could not remove peer',
        description: error instanceof Error ? error.message : 'Check WireGuard is running and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const openDeleteDialog = (publicKey: string, peerName: string) => {
    if (!selectedHostId || !selectedInterface) return
    setDeleteDialog({
      open: true,
      nodeId: selectedHostId,
      interfaceName: selectedInterface,
      publicKey,
      peerName,
    })
  }

  // Empty state when no host selected
  if (!selectedHost) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Server className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Select a VPN host to view peers</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ScrollProgress>
        <div className="p-6 space-y-4">
          {/* Header */}
          <PageHeader
            icon={<Shield className="h-8 w-8" />}
            iconColor="text-amber-400"
            title={selectedHost.node.name}
            subtitle={selectedHost.node.host}
            actions={
              <>
                <Button
                  onClick={() => setAddClientDialog({ open: true, clientName: '' })}
                  size="sm"
                  className="gap-2"
                  disabled={!selectedInterface}
                >
                  <Plus className="h-4 w-4" />
                  Add Client
                </Button>
              </>
            }
          />

          {/* Interface Selector */}
          {selectedHost.interfaces.length > 0 && (
            <div className="flex items-center gap-4">
              <Label htmlFor="interface-select" className="text-sm font-medium">
                Interface:
              </Label>
              <Select
                value={selectedInterface || ''}
                onValueChange={setSelectedInterface}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select interface" />
                </SelectTrigger>
                <SelectContent>
                  {selectedHost.interfaces.map(iface => (
                    <SelectItem key={iface.name} value={iface.name}>
                      {iface.name} ({iface.peerCount} peers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {interfaceDetail && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Address: <code className="font-mono">{interfaceDetail.address}</code></span>
                  <span>Port: <code className="font-mono">{interfaceDetail.listenPort}</code></span>
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search peers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Peers Table */}
          {loadingInterface ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : !selectedInterface ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No WireGuard interfaces found on this host</p>
              </CardContent>
            </Card>
          ) : filteredPeers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>
                  {searchQuery 
                    ? 'No peers match your search' 
                    : 'No peers configured on this interface'}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setAddClientDialog({ open: true, clientName: '' })}
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first client
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Public Key</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transfer</TableHead>
                    <TableHead>Last Handshake</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeers.map(peer => (
                    <TableRow key={peer.publicKey}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-amber-400" />
                          {peer.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {peer.publicKey.slice(0, 8)}...{peer.publicKey.slice(-4)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {peer.allowedIps}
                      </TableCell>
                      <TableCell>
                        <StatusIndicator 
                          status={peer.runtime ? (peer.runtime.isOnline ? 'online' : 'offline') : 'unknown'}
                          size="md"
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {peer.runtime ? (
                          <div className="flex items-center gap-1">
                            <ArrowUpDown className="h-3 w-3" />
                            <span>↑{formatBytes(peer.runtime.transferTx)} ↓{formatBytes(peer.runtime.transferRx)}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {peer.runtime ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimeAgo(peer.runtime.latestHandshake)}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Delete Button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDeleteDialog(peer.publicKey, peer.name)}
                            className="h-8 w-8 opacity-60 hover:opacity-100 text-destructive/60 hover:text-destructive transition-all duration-200 hover:scale-105"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </ScrollProgress>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Peer</DialogTitle>
            <DialogDescription>
              Remove <span className="font-semibold text-foreground">{deleteDialog.peerName}</span>? 
              Their VPN access will be immediately revoked and they won't be able to reconnect.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePeer}
              disabled={actionLoading[`delete-${deleteDialog.publicKey}`]}
            >
              {actionLoading[`delete-${deleteDialog.publicKey}`] ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientDialog.open} onOpenChange={(open) => setAddClientDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Generate a new WireGuard client configuration. An IP address will be automatically assigned.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="e.g., laptop, phone, tablet"
                value={addClientDialog.clientName}
                onChange={(e) => setAddClientDialog(prev => ({ ...prev, clientName: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !actionLoading['add-client']) {
                    handleAddClient()
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddClientDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddClient}
              disabled={actionLoading['add-client']}
            >
              {actionLoading['add-client'] ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Client
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Config Dialog */}
      <Dialog open={clientConfigDialog.open} onOpenChange={(open) => setClientConfigDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              Client Configuration: {clientConfigDialog.client?.clientName}
            </DialogTitle>
            <DialogDescription>
              Save this configuration - the private key will not be shown again!
            </DialogDescription>
          </DialogHeader>
          
          {clientConfigDialog.client && (
            <div className="space-y-4">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">IP Address:</span>
                  <code className="ml-2 font-mono">{clientConfigDialog.client.address}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Endpoint:</span>
                  <code className="ml-2 font-mono">{clientConfigDialog.client.endpoint}</code>
                </div>
              </div>
              
              {/* Config File */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Configuration File
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(clientConfigDialog.client!.configText, 'Config')}
                    className="gap-2"
                  >
                    {copiedField === 'Config' ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy Config
                  </Button>
                </div>
                <pre className="bg-zinc-950 p-4 rounded-lg text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-48">
                  {clientConfigDialog.client.configText}
                </pre>
              </div>
              
              {/* One-liner */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Quick Setup (Linux)
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(clientConfigDialog.client!.oneLiner, 'One-liner')}
                    className="gap-2"
                  >
                    {copiedField === 'One-liner' ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy One-liner
                  </Button>
                </div>
                <pre className="bg-zinc-950 p-4 rounded-lg text-xs font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-32">
                  {clientConfigDialog.client.oneLiner}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Run this command on the client machine to set up WireGuard instantly.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setClientConfigDialog({ open: false, client: null })}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
