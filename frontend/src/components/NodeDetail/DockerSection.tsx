import { RefreshCw, Box, Play, Pause, Square, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DockerContainer } from '@/types';

interface DockerSectionProps {
  containers: DockerContainer[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const STATE_ICONS: Record<string, React.ElementType> = {
  running: Play,
  paused: Pause,
  exited: Square,
  restarting: RefreshCw,
  dead: AlertCircle,
};

const STATE_COLORS: Record<string, string> = {
  running: 'text-emerald-400 bg-emerald-500/10',
  paused: 'text-amber-400 bg-amber-500/10',
  exited: 'text-red-400 bg-red-500/10',
  restarting: 'text-sky-400 bg-sky-500/10',
  dead: 'text-red-400 bg-red-500/10',
};

export function DockerSection({ containers, isLoading, error, onRefresh }: DockerSectionProps) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Box className="h-4 w-4 text-sky-400" />
            Docker Containers
            <span className="text-xs text-muted-foreground font-normal">
              ({containers.length})
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : isLoading && containers.length === 0 ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : containers.length === 0 ? (
          <div className="py-8 text-center">
            <Box className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No containers found</p>
          </div>
        ) : (
          <ScrollArea className="h-[250px] pr-4">
            <div className="space-y-2">
              {containers.map((container) => {
                const StateIcon = STATE_ICONS[container.state] || Square;
                const stateColor = STATE_COLORS[container.state] || 'text-slate-400 bg-slate-500/10';
                
                return (
                  <div
                    key={container.id}
                    className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-1.5 rounded-md flex-shrink-0", stateColor)}>
                        <StateIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{container.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {container.image}
                        </p>
                        {container.ports && (
                          <p className="text-xs text-muted-foreground/70 font-mono mt-1 truncate">
                            {container.ports}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
