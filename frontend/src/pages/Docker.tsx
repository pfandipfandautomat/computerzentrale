import { useState, useMemo } from 'react'
import { api } from '@/services/api'
import { DockerContainer } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusIndicator, type Status } from '@/components/ui/status-indicator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { ContainerLogViewer } from '@/components/Docker/ContainerLogViewer'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { 
  useSelectedHostId, 
  useDockerHosts, 
  useManagementActions 
} from '@/stores/useManagementStore'
import { 
  Server, 
  Container, 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  FileText, 
  Search,
  Loader2,
} from 'lucide-react'

interface DeleteDialogState {
  open: boolean
  nodeId: string | null
  containerId: string | null
  containerName: string | null
  removeVolumes: boolean
}

interface LogViewerState {
  open: boolean
  nodeId: string | null
  containerId: string | null
  containerName: string | null
}

export function Docker() {
  const selectedHostId = useSelectedHostId()
  const dockerHosts = useDockerHosts()
  const { fetchDockerHosts } = useManagementActions()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    nodeId: null,
    containerId: null,
    containerName: null,
    removeVolumes: false,
  })
  const [logViewer, setLogViewer] = useState<LogViewerState>({
    open: false,
    nodeId: null,
    containerId: null,
    containerName: null,
  })
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // Get selected host from store
  const selectedHost = useMemo(() => {
    return dockerHosts.find(h => h.node.id === selectedHostId) || null
  }, [dockerHosts, selectedHostId])

  // Filter containers based on search query
  const filteredContainers = useMemo(() => {
    if (!selectedHost) return []
    
    const query = searchQuery.toLowerCase()
    return selectedHost.containers.filter(container => 
      container.name.toLowerCase().includes(query) ||
      container.image.toLowerCase().includes(query) ||
      container.status.toLowerCase().includes(query)
    )
  }, [selectedHost, searchQuery])

  // Container actions
  const handleStartContainer = async (nodeId: string, containerId: string) => {
    const key = `${nodeId}-${containerId}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      await api.startContainer(nodeId, containerId)
      toast({
        description: 'Container started',
      })
      await fetchDockerHosts()
    } catch (error) {
      toast({
        title: 'Could not start container',
        description: error instanceof Error ? error.message : 'Check your Docker daemon and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleStopContainer = async (nodeId: string, containerId: string) => {
    const key = `${nodeId}-${containerId}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      await api.stopContainer(nodeId, containerId)
      toast({
        description: 'Container stopped',
      })
      await fetchDockerHosts()
    } catch (error) {
      toast({
        title: 'Could not stop container',
        description: error instanceof Error ? error.message : 'Check your Docker daemon and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleRestartContainer = async (nodeId: string, containerId: string) => {
    const key = `${nodeId}-${containerId}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      await api.restartContainer(nodeId, containerId)
      toast({
        description: 'Container restarted',
      })
      await fetchDockerHosts()
    } catch (error) {
      toast({
        title: 'Could not restart container',
        description: error instanceof Error ? error.message : 'Check your Docker daemon and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleDeleteContainer = async () => {
    if (!deleteDialog.nodeId || !deleteDialog.containerId) return
    
    const key = `${deleteDialog.nodeId}-${deleteDialog.containerId}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      await api.deleteContainer(deleteDialog.nodeId, deleteDialog.containerId, deleteDialog.removeVolumes)
      toast({
        description: 'Container deleted',
      })
      setDeleteDialog({
        open: false,
        nodeId: null,
        containerId: null,
        containerName: null,
        removeVolumes: false,
      })
      await fetchDockerHosts()
    } catch (error) {
      toast({
        title: 'Could not delete container',
        description: error instanceof Error ? error.message : 'Check your Docker daemon and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const openDeleteDialog = (nodeId: string, containerId: string, containerName: string) => {
    setDeleteDialog({
      open: true,
      nodeId,
      containerId,
      containerName,
      removeVolumes: false,
    })
  }

  const openLogViewer = (nodeId: string, containerId: string, containerName: string) => {
    setLogViewer({
      open: true,
      nodeId,
      containerId,
      containerName,
    })
  }

  // Get status indicator
  const getStatusIndicator = (state: DockerContainer['state']) => {
    const statusMap: Record<string, Status> = {
      'running': 'running',
      'exited': 'exited',
      'paused': 'paused',
      'restarting': 'restarting',
      'dead': 'dead',
    }
    return <StatusIndicator status={statusMap[state] || 'unknown'} size="md" showLabel />
  }

  // Empty state when no host selected
  if (!selectedHost) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Server className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Select a Docker host to view containers</p>
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
            icon={<Container className="h-8 w-8" />}
            iconColor="text-sky-400"
            title={selectedHost.node.name}
            subtitle={`${selectedHost.node.host} • ${selectedHost.containers.length} container${selectedHost.containers.length !== 1 ? 's' : ''}`}
          />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search containers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Containers Table */}
          {filteredContainers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Container className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>
                  {searchQuery 
                    ? 'No matching containers' 
                    : 'No containers running on this host'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ports</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContainers.map(container => {
                    const actionKey = `${selectedHost.node.id}-${container.id}`
                    const isLoading = actionLoading[actionKey]
                    
                    return (
                      <TableRow key={container.id}>
                        <TableCell className="font-medium">
                          {container.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {container.image}
                        </TableCell>
                        <TableCell>
                          {getStatusIndicator(container.state)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {container.ports || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* Start Button - only for non-running containers */}
                            {container.state !== 'running' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartContainer(selectedHost.node.id, container.id)}
                                disabled={isLoading}
                                className="h-8 w-8 opacity-60 hover:opacity-100 text-emerald-400/60 hover:text-emerald-400 transition-all duration-200 hover:scale-105"
                                title="Start"
                              >
                                {isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            
                            {/* Stop Button - only for running containers */}
                            {container.state === 'running' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStopContainer(selectedHost.node.id, container.id)}
                                disabled={isLoading}
                                className="h-8 w-8 opacity-60 hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all duration-200 hover:scale-105"
                                title="Stop"
                              >
                                {isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            
                            {/* Restart Button */}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRestartContainer(selectedHost.node.id, container.id)}
                              disabled={isLoading}
                              className="h-8 w-8 opacity-60 hover:opacity-100 text-blue-400/60 hover:text-blue-400 transition-all duration-200 hover:scale-105"
                              title="Restart"
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                            
                            {/* Logs Button */}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openLogViewer(selectedHost.node.id, container.id, container.name)}
                              className="h-8 w-8 opacity-60 hover:opacity-100 text-amber-400/60 hover:text-amber-400 transition-all duration-200 hover:scale-105"
                              title="View Logs"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            
                            {/* Delete Button */}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openDeleteDialog(selectedHost.node.id, container.id, container.name)}
                              disabled={isLoading}
                              className="h-8 w-8 opacity-60 hover:opacity-100 text-destructive/60 hover:text-destructive transition-all duration-200 hover:scale-105"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
            <DialogTitle>Delete Container</DialogTitle>
            <DialogDescription>
              Delete <span className="font-semibold text-foreground">{deleteDialog.containerName}</span>? 
              The container will be permanently removed. Data in volumes will be preserved unless you check the option below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center space-x-2 py-4">
            <input
              type="checkbox"
              id="removeVolumes"
              checked={deleteDialog.removeVolumes}
              onChange={(e) => setDeleteDialog(prev => ({ ...prev, removeVolumes: e.target.checked }))}
              className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            />
            <Label htmlFor="removeVolumes" className="text-sm font-normal cursor-pointer">
              Also remove volumes
            </Label>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteContainer}
              disabled={actionLoading[`${deleteDialog.nodeId}-${deleteDialog.containerId}`]}
            >
              {actionLoading[`${deleteDialog.nodeId}-${deleteDialog.containerId}`] ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Viewer */}
      {logViewer.nodeId && logViewer.containerId && logViewer.containerName && (
        <ContainerLogViewer
          open={logViewer.open}
          onOpenChange={(open) => setLogViewer(prev => ({ ...prev, open }))}
          nodeId={logViewer.nodeId}
          containerId={logViewer.containerId}
          containerName={logViewer.containerName}
        />
      )}
    </>
  )
}
