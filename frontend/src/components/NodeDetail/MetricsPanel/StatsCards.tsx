import { Activity, Clock, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MetricDataPoint } from '@/types';

interface StatsCardsProps {
  uptimePercentage?: number;
  totalChecks?: number;
  latencyData?: MetricDataPoint[];
  isLoading?: boolean;
  status: 'online' | 'offline' | 'unknown';
}

export function StatsCards({ 
  uptimePercentage, 
  totalChecks, 
  latencyData,
  isLoading,
  status,
}: StatsCardsProps) {
  // Calculate average latency from data
  const avgLatency = latencyData?.length 
    ? latencyData.reduce((sum, dp) => sum + (dp.latencyAvg || 0), 0) / latencyData.filter(dp => dp.latencyAvg).length
    : undefined;

  // Calculate min/max latency
  const minLatency = latencyData?.length
    ? Math.min(...latencyData.filter(dp => dp.latencyMin).map(dp => dp.latencyMin!))
    : undefined;
  const maxLatency = latencyData?.length
    ? Math.max(...latencyData.filter(dp => dp.latencyMax).map(dp => dp.latencyMax!))
    : undefined;

  const stats = [
    {
      title: 'Uptime',
      value: uptimePercentage !== undefined ? `${uptimePercentage.toFixed(1)}%` : '—',
      icon: Activity,
      color: uptimePercentage !== undefined && uptimePercentage >= 99 
        ? 'text-emerald-500/70' 
        : uptimePercentage !== undefined && uptimePercentage >= 95 
          ? 'text-amber-500/70' 
          : 'text-red-500/70',
    },
    {
      title: 'Avg Latency',
      value: avgLatency !== undefined && !isNaN(avgLatency) ? `${avgLatency.toFixed(1)}ms` : '—',
      icon: Zap,
      color: status === 'online' ? 'text-emerald-500' : status === 'offline' ? 'text-rose-500/70' : 'text-muted-foreground',
    },
    {
      title: 'Min / Max',
      value: minLatency !== undefined && maxLatency !== undefined && !isNaN(minLatency) && !isNaN(maxLatency)
        ? `${minLatency.toFixed(0)} / ${maxLatency.toFixed(0)}ms`
        : '—',
      icon: TrendingUp,
      color: status === 'online' ? 'text-emerald-500/70' : 'text-muted-foreground',
    },
    {
      title: 'Total Checks',
      value: totalChecks !== undefined ? totalChecks.toLocaleString() : '—',
      icon: Clock,
      color: 'text-blue-400/70',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <Card className="border-border/40">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.title} className="space-y-1.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1.5">
                <stat.icon className="h-3.5 w-3.5" />
                {stat.title}
              </div>
              <div className={cn("text-lg font-semibold tabular-nums tracking-tight", stat.color)}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
