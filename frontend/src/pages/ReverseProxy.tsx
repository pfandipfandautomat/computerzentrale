import { useState, useMemo } from 'react'
import { api } from '@/services/api'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { 
  useSelectedHostId, 
  useProxyHosts, 
  useManagementActions 
} from '@/stores/useManagementStore'
import { 
  Server, 
  Globe, 
  Plus,
  Trash2, 
  FileText, 
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  RotateCcw,
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeleteDialogState {
  open: boolean
  nodeId: string | null
  filename: string | null
  domain: string | null
}

interface ViewConfigDialogState {
  open: boolean
  filename: string | null
  content: string | null
  loading: boolean
}

interface AddDomainDialogState {
  open: boolean
  domain: string
  upstreamIp: string
  upstreamPort: string
}

interface TestResultState {
  tested: boolean
  success: boolean
  output: string
}

export function ReverseProxy() {
  const selectedHostId = useSelectedHostId()
  const proxyHosts = useProxyHosts()
  const { fetchProxyHosts } = useManagementActions()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    nodeId: null,
    filename: null,
    domain: null,
  })
  
  const [viewConfigDialog, setViewConfigDialog] = useState<ViewConfigDialogState>({
    open: false,
    filename: null,
    content: null,
    loading: false,
  })
  
  const [addDomainDialog, setAddDomainDialog] = useState<AddDomainDialogState>({
    open: false,
    domain: '',
    upstreamIp: '',
    upstreamPort: '80',
  })
  
  const [testResult, setTestResult] = useState<TestResultState>({
    tested: false,
    success: false,
    output: '',
  })

  // Get selected host from store
  const selectedHost = useMemo(() => {
    return proxyHosts.find(h => h.node.id === selectedHostId) || null
  }, [proxyHosts, selectedHostId])

  // Filter configs based on search query
  const filteredConfigs = useMemo(() => {
    if (!selectedHost) return []
    
    const query = searchQuery.toLowerCase()
    return selectedHost.configs.filter(config => 
      config.domain.toLowerCase().includes(query) ||
      config.upstream.toLowerCase().includes(query) ||
      config.filename.toLowerCase().includes(query)
    )
  }, [selectedHost, searchQuery])

  // View config file content
  const handleViewConfig = async (filename: string) => {
    if (!selectedHost) return
    
    setViewConfigDialog({
      open: true,
      filename,
      content: null,
      loading: true,
    })
    
    try {
      const response = await api.getProxyConfigFile(selectedHost.node.id, filename)
      setViewConfigDialog(prev => ({
        ...prev,
        content: response.content,
        loading: false,
      }))
    } catch (error) {
      toast({
        title: 'Could not load config',
        description: error instanceof Error ? error.message : 'Check the file exists and try again.',
        variant: 'destructive',
      })
      setViewConfigDialog(prev => ({ ...prev, open: false }))
    }
  }

  // Delete config
  const handleDeleteConfig = async () => {
    if (!deleteDialog.nodeId || !deleteDialog.filename) return
    
    const key = `delete-${deleteDialog.filename}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      await api.deleteProxyConfig(deleteDialog.nodeId, deleteDialog.filename)
      toast({
        description: 'Config deleted',
      })
      setDeleteDialog({
        open: false,
        nodeId: null,
        filename: null,
        domain: null,
      })
      await fetchProxyHosts()
    } catch (error) {
      toast({
        title: 'Could not delete config',
        description: error instanceof Error ? error.message : 'Check nginx permissions and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  // Add new domain
  const handleAddDomain = async () => {
    if (!selectedHost) return
    
    const { domain, upstreamIp, upstreamPort } = addDomainDialog
    
    if (!domain || !upstreamIp || !upstreamPort) {
      toast({
        title: 'Missing required fields',
        description: 'Enter domain, upstream IP, and port to continue.',
        variant: 'destructive',
      })
      return
    }
    
    const key = 'add-domain'
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      const result = await api.createProxyConfig(selectedHost.node.id, {
        domain,
        upstreamIp,
        upstreamPort: parseInt(upstreamPort, 10),
      })
      
      if (result.success) {
        toast({
          description: result.message || 'Domain added successfully',
        })
        setAddDomainDialog({
          open: false,
          domain: '',
          upstreamIp: '',
          upstreamPort: '80',
        })
        await fetchProxyHosts()
      } else {
        toast({
          title: 'Could not add domain',
          description: result.message || 'Check nginx configuration and try again.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Could not create config',
        description: error instanceof Error ? error.message : 'Check nginx permissions and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  // Test nginx config
  const handleTestConfig = async () => {
    if (!selectedHost) return
    
    const key = 'test-config'
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      const result = await api.testProxyConfig(selectedHost.node.id)
      setTestResult({
        tested: true,
        success: result.success,
        output: result.output,
      })
      
      toast({
        description: result.success ? 'Configuration valid' : 'Configuration has errors',
        variant: result.success ? 'default' : 'destructive',
      })
    } catch (error) {
      toast({
        title: 'Could not test config',
        description: error instanceof Error ? error.message : 'Check nginx is running and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  // Reload nginx
  const handleReloadNginx = async () => {
    if (!selectedHost) return
    
    const key = 'reload-nginx'
    setActionLoading(prev => ({ ...prev, [key]: true }))
    
    try {
      const result = await api.reloadNginx(selectedHost.node.id)
      
      if (result.success) {
        toast({
          description: result.message || 'Nginx reloaded',
        })
        setTestResult({ tested: false, success: false, output: '' })
      } else {
        toast({
          title: 'Reload failed',
          description: result.message || 'Check nginx configuration and try again.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Could not reload nginx',
        description: error instanceof Error ? error.message : 'Check nginx is running and try again.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const openDeleteDialog = (nodeId: string, filename: string, domain: string) => {
    setDeleteDialog({
      open: true,
      nodeId,
      filename,
      domain,
    })
  }

  // Empty state when no host selected
  if (!selectedHost) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Server className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Select a proxy host to view domains</p>
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
            icon={<Globe className="h-8 w-8" />}
            iconColor="text-violet-400"
            title={selectedHost.node.name}
            subtitle={`${selectedHost.node.host} • ${selectedHost.configs.length} domain${selectedHost.configs.length !== 1 ? 's' : ''}`}
            actions={
              <>
                <Button
                  onClick={() => setAddDomainDialog(prev => ({ ...prev, open: true }))}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Domain
                </Button>
                
                <Button
                  onClick={handleTestConfig}
                  disabled={actionLoading['test-config']}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
                  title="Test Config"
                >
                  {actionLoading['test-config'] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  onClick={handleReloadNginx}
                  disabled={actionLoading['reload-nginx']}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
                  title="Reload"
                >
                  {actionLoading['reload-nginx'] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>
              </>
            }
          />

          {/* Test Result Banner */}
          {testResult.tested && (
            <div className={cn(
              "p-3 rounded-lg border flex items-start gap-3",
              testResult.success 
                ? "bg-green-500/10 border-green-500/30" 
                : "bg-red-500/10 border-red-500/30"
            )}>
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={cn(
                  "font-medium text-sm",
                  testResult.success ? "text-green-400" : "text-red-400"
                )}>
                  {testResult.success ? 'Configuration test passed' : 'Configuration test failed'}
                </p>
                <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap font-mono">
                  {testResult.output}
                </pre>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Domains Table */}
          {filteredConfigs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>
                  {searchQuery 
                    ? 'No matching domains' 
                    : 'No domains configured yet'}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setAddDomainDialog(prev => ({ ...prev, open: true }))}
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first domain
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Upstream</TableHead>
                    <TableHead>SSL</TableHead>
                    <TableHead>Config File</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfigs.map(config => (
                    <TableRow key={config.filename}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-violet-400" />
                          {config.domain}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">
                        {config.upstream}
                      </TableCell>
                      <TableCell>
                        {config.sslEnabled ? (
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 gap-1">
                            <Lock className="h-3 w-3" />
                            SSL
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1">
                            <Unlock className="h-3 w-3" />
                            HTTP
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {config.filename}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* View Config Button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleViewConfig(config.filename)}
                            className="h-8 w-8 opacity-60 hover:opacity-100 text-blue-400/60 hover:text-blue-400 transition-all duration-200 hover:scale-105"
                            title="View Config"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          
                          {/* Delete Button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDeleteDialog(selectedHost.node.id, config.filename, config.domain)}
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
            <DialogTitle>Delete Domain Configuration</DialogTitle>
            <DialogDescription>
              Delete <span className="font-semibold text-foreground">{deleteDialog.domain}</span>? 
              The nginx config file will be removed and the domain will stop serving traffic.
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
              onClick={handleDeleteConfig}
              disabled={actionLoading[`delete-${deleteDialog.filename}`]}
            >
              {actionLoading[`delete-${deleteDialog.filename}`] ? (
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

      {/* View Config Dialog */}
      <Dialog open={viewConfigDialog.open} onOpenChange={(open) => setViewConfigDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewConfigDialog.filename}
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-auto max-h-[60vh]">
            {viewConfigDialog.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="bg-zinc-950 p-4 rounded-lg text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto">
                {viewConfigDialog.content}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Domain Dialog */}
      <Dialog open={addDomainDialog.open} onOpenChange={(open) => setAddDomainDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Domain</DialogTitle>
            <DialogDescription>
              Create a new reverse proxy configuration for a domain.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={addDomainDialog.domain}
                onChange={(e) => setAddDomainDialog(prev => ({ ...prev, domain: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upstreamIp">Upstream IP</Label>
                <Input
                  id="upstreamIp"
                  placeholder="192.168.1.100"
                  value={addDomainDialog.upstreamIp}
                  onChange={(e) => setAddDomainDialog(prev => ({ ...prev, upstreamIp: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="upstreamPort">Upstream Port</Label>
                <Input
                  id="upstreamPort"
                  type="number"
                  placeholder="80"
                  value={addDomainDialog.upstreamPort}
                  onChange={(e) => setAddDomainDialog(prev => ({ ...prev, upstreamPort: e.target.value }))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDomainDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDomain}
              disabled={actionLoading['add-domain']}
            >
              {actionLoading['add-domain'] ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
