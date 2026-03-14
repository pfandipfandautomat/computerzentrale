import { useMemo } from 'react';
import { BarChart } from '@tremor/react';
import type { MetricDataPoint, ChartTooltipProps } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

interface UptimeChartProps {
  data: MetricDataPoint[];
  isLoading?: boolean;
}

// Custom tooltip for elegant dark mode
const customTooltip = ({ payload, active, label }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const value = payload[0]?.value;
  const numValue = typeof value === 'number' ? value : 0;
  const color = numValue === 100 ? 'text-emerald-400' : numValue >= 95 ? 'text-amber-400' : 'text-red-400';
  
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold font-mono ${color}`}>
        {value}% uptime
      </p>
    </div>
  );
};

export function UptimeChart({ data, isLoading }: UptimeChartProps) {
  const chartData = useMemo(() => {
    if (!data?.length) return [];
    
    // Group data into time buckets and calculate uptime percentage
    const bucketSize = Math.max(1, Math.floor(data.length / 20));
    const buckets: { time: string; Uptime: number }[] = [];
    
    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, i + bucketSize);
      const onlineCount = bucket.filter(dp => dp.status === 1).length;
      const uptime = (onlineCount / bucket.length) * 100;
      
      const time = new Date(bucket[0].timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      buckets.push({
        time,
        Uptime: Math.round(uptime),
      });
    }
    
    return buckets;
  }, [data]);

  if (chartData.length < 2) {
    // Show skeleton when loading and not enough data
    if (isLoading) {
      return (
        <div className="h-[150px] space-y-2">
          <Skeleton className="h-full w-full" />
        </div>
      );
    }
    
    return (
      <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
        Collecting availability data...
      </div>
    );
  }

  return (
    <BarChart
      data={chartData}
      index="time"
      categories={['Uptime']}
      colors={['emerald']}
      className="h-[150px] [&_.recharts-cartesian-grid-horizontal_line]:stroke-border/20 [&_.recharts-cartesian-grid-horizontal_line]:stroke-[0.5] [&_.recharts-cartesian-grid-vertical_line]:stroke-transparent [&_.recharts-bar]:opacity-70"
      showXAxis={true}
      showYAxis={true}
      showGridLines={true}
      showLegend={false}
      yAxisWidth={35}
      customTooltip={customTooltip}
    />
  );
}
