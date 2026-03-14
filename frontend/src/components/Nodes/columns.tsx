import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Radio, RefreshCw, Server, Router, HardDrive, Smartphone, Globe, Box } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { InfraNode, TAG_CONFIG, NodeTag, ServerMetricsDataPoint, NodeUptime } from "@/types"
import { cn } from "@/lib/utils"

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  server: Server,
  router: Router,
  nas: HardDrive,
  client: Smartphone,
  service: Globe,
  custom: Box,
}

interface ColumnActions {
  onEdit: (node: InfraNode) => void
  onDelete: (node: InfraNode) => void
  onPing: (node: InfraNode) => void
  onRefresh: (node: InfraNode) => void
  nodeStatusById: Record<string, { status: string; latency?: number; lastChecked?: string }>
  latestServerMetricsByNodeId: Record<string, { metrics: ServerMetricsDataPoint | null; lastFetched: number }>
  uptimeByNodeId: Record<string, { uptime: NodeUptime; lastFetched: number; range: string }>
}

export const createColumns = ({
  onEdit,
  onDelete,
  onPing,
  onRefresh,
  nodeStatusById,
  latestServerMetricsByNodeId,
  uptimeByNodeId,
}: ColumnActions): ColumnDef<InfraNode>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "host",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Host
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
        {row.getValue("host")}
        {row.original.port && `:${row.original.port}`}
      </code>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("type") as string
      const Icon = TYPE_ICONS[type] || Box
      return (
        <div className="flex items-center gap-1.5" title={type.charAt(0).toUpperCase() + type.slice(1)}>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.getValue("tags") as NodeTag[]
      if (!tags || tags.length === 0) {
        return <span className="text-muted-foreground">—</span>
      }
      return (
        <div className="flex items-center gap-1">
          {tags.map((tag) => {
            const config = TAG_CONFIG[tag]
            const Icon = config?.icon
            return (
              <div
                key={tag}
                className={cn(
                  "p-1 rounded",
                  config?.bg || "bg-primary/10",
                )}
                title={config?.label || tag}
              >
                {Icon ? (
                  <Icon className={cn("h-3.5 w-3.5", config?.color || "text-primary")} />
                ) : (
                  <span className={cn("text-xs", config?.color || "text-primary")}>
                    {(config?.label || tag).charAt(0)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const nodeId = row.original.id
      const nodeStatus = nodeStatusById[nodeId]
      const status = nodeStatus?.status || row.getValue("status") as string || "unknown"
      
      return (
        <StatusIndicator 
          status={status as 'online' | 'offline' | 'unknown'} 
          size="lg"
        />
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Latency
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const nodeId = row.original.id
      const nodeStatus = nodeStatusById[nodeId]
      const latency = nodeStatus?.latency ?? row.getValue("latency") as number | undefined
      
      if (latency === undefined || latency === null) {
        return <span className="text-muted-foreground">—</span>
      }
      
      return (
        <span className={cn(
          "text-sm font-mono",
          latency < 50 ? "text-emerald-500" :
          latency < 100 ? "text-amber-500" :
          "text-red-500"
        )}>
          {latency}ms
        </span>
      )
    },
  },
  {
    accessorKey: "cpu",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        CPU
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const nodeId = row.original.id
      const nodeType = row.original.type
      
      if (nodeType !== 'server') {
        return <span className="text-muted-foreground">—</span>
      }
      
      const serverMetrics = latestServerMetricsByNodeId[nodeId]?.metrics
      
      if (!serverMetrics || serverMetrics.cpuUsage === null || serverMetrics.cpuUsage === undefined) {
        return <span className="text-muted-foreground">—</span>
      }
      
      const cpuUsage = serverMetrics.cpuUsage
      
      return (
        <span className={cn(
          "text-sm font-mono",
          cpuUsage < 50 ? "text-emerald-500" :
          cpuUsage < 80 ? "text-amber-500" :
          "text-red-500"
        )}>
          {cpuUsage.toFixed(1)}%
        </span>
      )
    },
    sortingFn: (rowA, rowB) => {
      const metricsA = latestServerMetricsByNodeId[rowA.original.id]?.metrics
      const metricsB = latestServerMetricsByNodeId[rowB.original.id]?.metrics
      const cpuA = metricsA?.cpuUsage ?? -1
      const cpuB = metricsB?.cpuUsage ?? -1
      return cpuA - cpuB
    },
  },
  {
    accessorKey: "memory",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Memory
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const nodeId = row.original.id
      const nodeType = row.original.type
      
      if (nodeType !== 'server') {
        return <span className="text-muted-foreground">—</span>
      }
      
      const serverMetrics = latestServerMetricsByNodeId[nodeId]?.metrics
      
      if (!serverMetrics || serverMetrics.memoryUsedPercent === null || serverMetrics.memoryUsedPercent === undefined) {
        return <span className="text-muted-foreground">—</span>
      }
      
      const memoryUsage = serverMetrics.memoryUsedPercent
      
      return (
        <span className={cn(
          "text-sm font-mono",
          memoryUsage < 60 ? "text-emerald-500" :
          memoryUsage < 80 ? "text-amber-500" :
          "text-red-500"
        )}>
          {memoryUsage.toFixed(1)}%
        </span>
      )
    },
    sortingFn: (rowA, rowB) => {
      const metricsA = latestServerMetricsByNodeId[rowA.original.id]?.metrics
      const metricsB = latestServerMetricsByNodeId[rowB.original.id]?.metrics
      const memA = metricsA?.memoryUsedPercent ?? -1
      const memB = metricsB?.memoryUsedPercent ?? -1
      return memA - memB
    },
  },
  {
    accessorKey: "uptime",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Uptime
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const nodeId = row.original.id
      const uptimeData = uptimeByNodeId[nodeId]?.uptime
      
      if (!uptimeData || uptimeData.uptimePercentage === undefined) {
        return <span className="text-muted-foreground">—</span>
      }
      
      const uptime = uptimeData.uptimePercentage
      
      return (
        <span className={cn(
          "text-sm font-mono",
          uptime >= 99 ? "text-emerald-500" :
          uptime >= 95 ? "text-amber-500" :
          "text-red-500"
        )}>
          {uptime.toFixed(2)}%
        </span>
      )
    },
    sortingFn: (rowA, rowB) => {
      const uptimeA = uptimeByNodeId[rowA.original.id]?.uptime?.uptimePercentage ?? -1
      const uptimeB = uptimeByNodeId[rowB.original.id]?.uptime?.uptimePercentage ?? -1
      return uptimeA - uptimeB
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const node = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onPing(node)}>
              <Radio className="mr-2 h-4 w-4" />
              Ping
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRefresh(node)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(node)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(node)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
