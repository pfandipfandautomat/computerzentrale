import { RefreshCw, Globe, Lock, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ReverseProxyConfig } from '@/types';

interface ProxySectionProps {
  configs: ReverseProxyConfig[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function ProxySection({ configs, isLoading, error, onRefresh }: ProxySectionProps) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-violet-400" />
            Reverse Proxy
            <span className="text-xs text-muted-foreground font-normal">
              ({configs.length})
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
        ) : isLoading && configs.length === 0 ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="py-8 text-center">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No proxy configs found</p>
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {configs.map((config, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {config.sslEnabled ? (
                        <Lock className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{config.domain}</span>
                    </div>
                    {config.sslEnabled && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        SSL
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span className="font-mono truncate">{config.upstream}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
