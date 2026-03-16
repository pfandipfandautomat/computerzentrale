import { useState, useMemo } from 'react'
import { api } from '@/services/api'
import { GPUInfo, GPUModel } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusIndicator, type Status } from '@/components/ui/status-indicator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/page-header'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DeployModelModal } from '@/components/Modals/DeployModelModal'
import { 
  useSelectedHostId, 
  useGpuHosts, 
  useManagementActions 
} from '@/stores/useManagementStore'
import { 
  Cpu, 
  Search,
  Loader2,
  HardDrive,
  Activity,
  RefreshCw,
  MessageSquare,
  Box,
  Rocket,
  Square,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function GPU() {
  const selectedHostId = useSelectedHostId()
  const gpuHosts = useGpuHosts()
  const { fetchGpuHosts } = useManagementActions()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deployModalOpen, setDeployModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [logsModal, setLogsModal] = useState<{ open: boolean; modelName: string; logs: string }>({
    open: false,
    modelName: '',
    logs: '',
  })

  const selectedHost = useMemo(() => {
    return gpuHosts.find(h => h.node.id === selectedHostId) || null
  }, [gpuHosts, selectedHostId])

  const filteredModels = useMemo(() => {
    if (!selectedHost) return []
    const query = searchQuery.toLowerCase()
    return selectedHost.models.filter(model => 
      model.name.toLowerCase().includes(query) ||
      model.model.toLowerCase().includes(query)
    )
  }, [selectedHost, searchQuery])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      if (selectedHostId) {
        await api.invalidateGPUCache(selectedHostId)
      }
      await fetchGpuHosts()
      toast({ description: 'GPU data refreshed' })
    } catch (error) {
      toast({
        title: 'Could not refresh GPU data',
        description: error instanceof Error ? error.message : 'Check your connection and try again.',
        variant: 'destructive',
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleStopModel = async (pid: number, modelName: string) => {
    if (!selectedHostId) return
    
    const key = `stop-${pid}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      const result = await api.stopGPUModel(selectedHostId, pid)
      if (result.success) {
        toast({ description: `Model ${modelName} stopped` })
        await fetchGpuHosts()
      } else {
        toast({
          title: 'Failed to stop model',
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Failed to stop model',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleViewLogs = async (modelName: string) => {
    if (!selectedHostId) return
    
    try {
      const result = await api.getGPUModelLogs(selectedHostId, modelName, 200)
      if (result.success && result.logs) {
        setLogsModal({ open: true, modelName, logs: result.logs })
      } else {
        toast({
          title: 'Failed to get logs',
          description: result.message || 'No logs available',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Failed to get logs',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const getModelStatus = (status: GPUModel['status']): Status => {
    const statusMap: Record<string, Status> = {
      running: 'online',
      starting: 'unknown',
      stopped: 'offline',
      error: 'offline',
    }
    return statusMap[status] || 'unknown'
  }

  const getMemoryPercent = (gpu: GPUInfo): number => {
    if (!gpu.memoryTotal || !gpu.memoryUsed) return 0
    return Math.round((gpu.memoryUsed / gpu.memoryTotal) * 100)
  }

  if (!selectedHost) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Cpu className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2 text-foreground/80">GPU Cluster</h2>
          <p className="text-sm text-muted-foreground/70 max-w-md">
            Select a GPU host to view GPUs and running models
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollProgress className="h-full overflow-y-auto">
      <div className="p-8 space-y-8">
        <PageHeader
          icon={<Cpu className="h-8 w-8" />}
          iconColor="text-emerald-400"
          title={selectedHost.node.name}
          subtitle={`${selectedHost.node.host} • ${selectedHost.gpus.length} GPU${selectedHost.gpus.length !== 1 ? 's' : ''} • ${selectedHost.models.length} model${selectedHost.models.length !== 1 ? 's' : ''}`}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setDeployModalOpen(true)}
                className="gap-2"
              >
                <Rocket className="h-4 w-4" />
                Deploy Model
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          }
        />

        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">GPUs</h3>
          
          {selectedHost.gpus.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Cpu className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No GPUs detected</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {selectedHost.gpus.map((gpu) => {
                const memPercent = getMemoryPercent(gpu)
                const isHighUsage = memPercent > 80
                return (
                  <Card key={gpu.id} className="relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("p-2 rounded-lg", isHighUsage ? "bg-amber-500/10" : "bg-emerald-500/10")}>
                            <Cpu className={cn("h-4 w-4", isHighUsage ? "text-amber-400" : "text-emerald-400")} />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-medium">GPU {gpu.id}</CardTitle>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{gpu.name}</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" />Memory</span>
                          <span className="font-mono tabular-nums">{gpu.memoryUsed?.toLocaleString() || 0} / {gpu.memoryTotal?.toLocaleString() || 0} MiB</span>
                        </div>
                        <Progress value={memPercent} className={cn("h-1.5", isHighUsage && "[&>div]:bg-amber-500")} />
                      </div>
                      {gpu.utilization !== undefined && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" />Utilization</span>
                            <span className="font-mono tabular-nums">{gpu.utilization}%</span>
                          </div>
                          <Progress value={gpu.utilization} className={cn("h-1.5", gpu.utilization > 80 && "[&>div]:bg-amber-500")} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">Running Models</h3>
            {selectedHost.models.length > 0 && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search models..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
            )}
          </div>
          
          {selectedHost.models.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Box className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No models running</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Start a model with vLLM to see it here</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredModels.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No models match your search</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>GPUs</TableHead>
                    <TableHead>PID</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModels.map((model, index) => (
                    <TableRow key={`${model.model}-${index}`}>
                      <TableCell><StatusIndicator status={getModelStatus(model.status)} /></TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{model.model}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="font-mono text-sm">{model.port}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {model.gpuIds.map(id => (
                            <span key={id} className="inline-flex items-center justify-center h-5 w-5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">{id}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell><span className="font-mono text-sm text-muted-foreground">{model.pid || '-'}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleViewLogs(model.name)}
                            title="View logs"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          {model.pid && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleStopModel(model.pid!, model.name)}
                              disabled={actionLoading[`stop-${model.pid}`]}
                              title="Stop model"
                            >
                              {actionLoading[`stop-${model.pid}`] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">API Endpoint</h3>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10"><MessageSquare className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-medium">OpenAI-Compatible API</p>
                    <p className="text-xs text-muted-foreground">Send requests to the cluster and they'll be routed to an available GPU</p>
                  </div>
                  <code className="text-xs bg-secondary/50 px-2 py-1 rounded font-mono">POST /api/gpu/v1/chat/completions</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deploy Modal */}
      <DeployModelModal
        open={deployModalOpen}
        onOpenChange={setDeployModalOpen}
        nodeId={selectedHostId || ''}
        nodeName={selectedHost?.node.name || ''}
        gpus={selectedHost?.gpus || []}
        onDeployed={() => fetchGpuHosts()}
      />

      {/* Logs Dialog */}
      <Dialog open={logsModal.open} onOpenChange={(open) => setLogsModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Logs: {logsModal.modelName}</DialogTitle>
          </DialogHeader>
          <div className="bg-black/50 rounded-lg p-4 overflow-auto max-h-[60vh]">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
              {logsModal.logs || 'No logs available'}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollProgress>
  )
}
