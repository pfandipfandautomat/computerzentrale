import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Download, 
  Trash2, 
  Pause, 
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContainerLogViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeId: string
  containerId: string
  containerName: string
}

type LogLevel = 'all' | 'info' | 'warning' | 'error'

interface LogEntry {
  timestamp: string
  text: string
  level: LogLevel
}

const getWebSocketUrl = (): string => {
  if (typeof window === 'undefined') return 'ws://localhost:3001'
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = process.env.NODE_ENV === 'development' 
    ? 'localhost:3001' 
    : window.location.host
  
  return `${protocol}//${host}`
}

const detectLogLevel = (text: string): LogLevel => {
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('error') || lowerText.includes('err:') || lowerText.includes('fatal')) {
    return 'error'
  }
  if (lowerText.includes('warn') || lowerText.includes('warning')) {
    return 'warning'
  }
  if (lowerText.includes('info') || lowerText.includes('debug') || lowerText.includes('trace')) {
    return 'info'
  }
  
  return 'info'
}

const formatTimestamp = (): string => {
  const now = new Date()
  return now.toISOString().split('T')[1].split('.')[0]
}

export function ContainerLogViewer({
  open,
  onOpenChange,
  nodeId,
  containerId,
  containerName
}: ContainerLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [logLevelFilter, setLogLevelFilter] = useState<LogLevel>('all')
  const [isPaused, setIsPaused] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  
  const wsRef = useRef<WebSocket | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const pendingLogsRef = useRef<LogEntry[]>([])

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!open || !nodeId || !containerId) return

    try {
      const wsUrl = getWebSocketUrl()
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        
        // Subscribe to container logs
        ws.send(JSON.stringify({
          type: 'subscribe_logs',
          nodeId,
          containerId
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'container_log' && message.data) {
            const newLog: LogEntry = {
              timestamp: formatTimestamp(),
              text: message.data,
              level: detectLogLevel(message.data)
            }

            if (isPaused) {
              // Store logs while paused
              pendingLogsRef.current.push(newLog)
            } else {
              setLogs(prev => [...prev, newLog])
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null

        // Attempt to reconnect after 3 seconds if modal is still open
        if (open) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket()
          }, 3000)
        }
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      setIsConnected(false)
    }
  }, [open, nodeId, containerId, isPaused])

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      // Unsubscribe from logs
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe_logs'
        }))
      }
      
      wsRef.current.close()
      wsRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    setIsConnected(false)
  }, [])

  // Connect/disconnect based on modal state
  useEffect(() => {
    if (open) {
      connectWebSocket()
    } else {
      disconnectWebSocket()
      // Clear logs when modal closes
      setLogs([])
      setSearchQuery('')
      setLogLevelFilter('all')
      setIsPaused(false)
      pendingLogsRef.current = []
    }

    return () => {
      disconnectWebSocket()
    }
  }, [open, connectWebSocket, disconnectWebSocket])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    setAutoScroll(isAtBottom)
  }, [])

  // Toggle pause/resume
  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev
      
      // If resuming, add all pending logs
      if (!newPaused && pendingLogsRef.current.length > 0) {
        setLogs(prevLogs => [...prevLogs, ...pendingLogsRef.current])
        pendingLogsRef.current = []
      }
      
      return newPaused
    })
  }, [])

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([])
    pendingLogsRef.current = []
  }, [])

  // Download logs
  const downloadLogs = useCallback(() => {
    const logText = logs.map(log => `[${log.timestamp}] ${log.text}`).join('\n')
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${containerName}_${containerId.substring(0, 12)}_${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [logs, containerName, containerId])

  // Filter logs based on search and log level
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filter by log level
      if (logLevelFilter !== 'all' && log.level !== logLevelFilter) {
        return false
      }

      // Filter by search query
      if (searchQuery && !log.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      return true
    })
  }, [logs, searchQuery, logLevelFilter])

  // Highlight search query in text
  const highlightText = useCallback((text: string) => {
    if (!searchQuery) return text

    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === searchQuery.toLowerCase() 
        ? <mark key={index} className="bg-yellow-400 text-black">{part}</mark>
        : part
    )
  }, [searchQuery])

  // Get log level color
  const getLogLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">Container Logs</DialogTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {containerName}
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {containerId.substring(0, 12)}
              </Badge>
              {isConnected ? (
                <Badge variant="default" className="bg-green-600">
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Controls */}
        <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={logLevelFilter}
            onChange={(e) => setLogLevelFilter(e.target.value as LogLevel)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={togglePause}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={downloadLogs}
            className="gap-2"
            disabled={logs.length === 0}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        {/* Log Display */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {logs.length === 0 ? (
                <p>No logs yet. Waiting for container output...</p>
              ) : (
                <p>No logs match the current filters.</p>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    "leading-relaxed whitespace-pre-wrap break-all",
                    getLogLevelColor(log.level)
                  )}
                >
                  <span className="text-gray-500 select-none">
                    [{log.timestamp}]
                  </span>{' '}
                  {highlightText(log.text)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Total: {logs.length} lines</span>
            <span>Filtered: {filteredLogs.length} lines</span>
            {isPaused && pendingLogsRef.current.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingLogsRef.current.length} pending
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!autoScroll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAutoScroll(true)
                  if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
                  }
                }}
                className="h-7 text-xs"
              >
                Scroll to bottom
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
