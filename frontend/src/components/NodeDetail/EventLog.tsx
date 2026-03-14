import { useMemo } from 'react';
import { History, ArrowRight, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { MetricDataPoint } from '@/types';

interface EventLogProps {
  data: MetricDataPoint[];
  isLoading?: boolean;
}

interface StatusEvent {
  timestamp: string;
  fromStatus: 'online' | 'offline';
  toStatus: 'online' | 'offline';
}

export function EventLog({ data, isLoading }: EventLogProps) {
  // Detect status changes from the metrics data
  const events = useMemo(() => {
    if (!data?.length) return [];
    
    const statusEvents: StatusEvent[] = [];
    let prevStatus: number | null = null;
    
    for (const dp of data) {
      if (prevStatus !== null && dp.status !== prevStatus) {
        statusEvents.push({
          timestamp: dp.timestamp,
          fromStatus: prevStatus === 1 ? 'online' : 'offline',
          toStatus: dp.status === 1 ? 'online' : 'offline',
        });
      }
      prevStatus = dp.status;
    }
    
    // Return most recent events first
    return statusEvents.reverse().slice(0, 20);
  }, [data]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getStatusColor = (status: 'online' | 'offline') => {
    return status === 'online' ? 'text-emerald-500' : 'text-red-500';
  };

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Event Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center">
            <History className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No status changes recorded</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Events will appear here when the node status changes
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {events.map((event, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  {/* Timeline dot */}
                  <div className="relative">
                    <Circle className={cn("h-2.5 w-2.5 fill-current", getStatusColor(event.toStatus))} />
                    {index < events.length - 1 && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-4 bg-border" />
                    )}
                  </div>
                  
                  {/* Event content */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className={cn("text-xs font-medium capitalize", getStatusColor(event.fromStatus))}>
                      {event.fromStatus}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className={cn("text-xs font-medium capitalize", getStatusColor(event.toStatus))}>
                      {event.toStatus}
                    </span>
                  </div>
                  
                  {/* Timestamp */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
