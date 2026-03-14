import { RefreshCw, Shield, ArrowUpDown, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cn } from '@/lib/utils';
import type { WireGuardStatus } from '@/types';

interface WireGuardSectionProps {
  status: WireGuardStatus | null | undefined;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

export function WireGuardSection({ status, isLoading, error, onRefresh }: WireGuardSectionProps) {
  const peers = status?.peers || [];
  const onlinePeers = peers.filter(p => p.isOnline).length;

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            WireGuard VPN
            {status && (
              <span className="text-xs text-muted-foreground font-normal">
                ({onlinePeers}/{peers.length} online)
              </span>
            )}
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
        ) : isLoading && !status ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !status || peers.length === 0 ? (
          <div className="py-8 text-center">
            <Shield className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No WireGuard peers found</p>
          </div>
        ) : (
          <ScrollArea className="h-[250px] pr-4">
            <div className="space-y-2">
              {/* Interface Info */}
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Interface</span>
                  <span className="text-sm font-mono">{status.interface}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">Listen Port</span>
                  <span className="text-sm font-mono">{status.listenPort}</span>
                </div>
              </div>

              {/* Peers */}
              {peers.map((peer) => (
                <div 
                  key={peer.publicKey} 
                  className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {peer.publicKey.substring(0, 32)}...
                    </span>
                    <StatusIndicator 
                      status={peer.isOnline ? 'online' : 'offline'}
                      size="sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ArrowUpDown className="h-3 w-3" />
                      <span>↑{formatBytes(peer.transferTx)} ↓{formatBytes(peer.transferRx)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(peer.latestHandshake)}</span>
                    </div>
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
