import { useState, useEffect } from 'react';
import { History, Send, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import type { AlertEvent } from '@/types';

interface EventLogModalProps {
  nodeId: string;
  nodeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const severityConfig = {
  info: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: Info,
  },
  warning: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    icon: AlertTriangle,
  },
  error: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    icon: AlertCircle,
  },
  critical: {
    color: 'text-red-500',
    bg: 'bg-red-500/20',
    icon: AlertCircle,
  },
};

const eventTypeLabels: Record<string, string> = {
  node_offline: 'Went Offline',
  node_online: 'Back Online',
  container_stopped: 'Container Stopped',
  container_started: 'Container Started',
  high_cpu: 'High CPU',
  high_memory: 'High Memory',
  high_disk: 'High Disk',
};

export function EventLogModal({ nodeId, nodeName, open, onOpenChange }: EventLogModalProps) {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchEvents();
    }
  }, [open, nodeId]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await api.getEventsForNode(nodeId, 50);
      setEvents(data as AlertEvent[]);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Event Log
            <span className="text-muted-foreground font-normal">— {nodeName}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4 -mr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <History className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm text-muted-foreground">No events recorded</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Events will appear here when status changes occur
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((event) => {
                const config = severityConfig[event.severity as keyof typeof severityConfig] || severityConfig.info;
                const Icon = config.icon;
                
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg transition-colors",
                      "hover:bg-secondary/30"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      config.bg
                    )}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn("text-sm font-medium", config.color)}>
                          {eventTypeLabels[event.eventType] || event.eventType}
                        </span>
                        {event.alertSent && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 border-border/50 text-muted-foreground">
                            <Send className="h-2.5 w-2.5" />
                            Sent
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.message}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-xs text-muted-foreground/60">
                      {formatTime(event.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
