import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wifi, Settings, Trash2, Server, Router, HardDrive, Cpu, Globe, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { NodeType, NodeStatus } from '@/types';
import { TimeRangeSelector, type TimeRange } from './MetricsPanel/TimeRangeSelector';

interface NodeHeaderProps {
  name: string;
  type: NodeType;
  status: NodeStatus;
  latency?: number;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onPing: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPinging: boolean;
}

const TYPE_ICONS: Record<NodeType, React.ElementType> = {
  server: Server,
  router: Router,
  nas: HardDrive,
  client: Cpu,
  service: Globe,
  custom: Box,
};



export function NodeHeader({
  name,
  type,
  status,
  latency,
  timeRange,
  onTimeRangeChange,
  onPing,
  onEdit,
  onDelete,
  isPinging,
}: NodeHeaderProps) {
  const navigate = useNavigate();
  const TypeIcon = TYPE_ICONS[type] || Box;

  return (
    <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-6 py-4">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                href="/nodes" 
                onClick={(e) => { e.preventDefault(); navigate('/nodes'); }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Nodes
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">{name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header Content */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <TypeIcon className="h-6 w-6" />
            </div>
            
            {/* Title & Status */}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
                <div className="flex items-center gap-2">
                  <StatusIndicator 
                    status={status}
                    size="lg"
                    animate={status === 'online'}
                  />
                  {latency !== undefined && status === 'online' && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {latency}ms
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground capitalize mt-0.5">
                {type} Node
              </p>
            </div>
          </div>

          {/* Time Range Selector and Actions */}
          <div className="flex items-center gap-3">
            <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
            <div className="h-6 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              onClick={onPing}
              disabled={isPinging}
              className="gap-2"
            >
              <Wifi className={isPinging ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
              {isPinging ? 'Pinging...' : 'Ping'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
