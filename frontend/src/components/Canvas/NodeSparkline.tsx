import { memo, useEffect, useMemo } from 'react';
import { AreaChart } from '@tremor/react';
import { useMetricsStore } from '@/stores/useMetricsStore';
import { cn } from '@/lib/utils';
import type { ChartTooltipProps } from '@/types';

interface NodeSparklineProps {
  nodeId: string;
  status: 'online' | 'offline' | 'unknown';
  className?: string;
}

// Custom tooltip component
const CustomTooltip = ({ 
  payload, 
  active 
}: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0];
  const latency = typeof data.value === 'number' ? data.value : 0;
  const time = (data.payload?.time as string) || '';
  
  return (
    <div className="rounded border border-border bg-popover px-2 py-1 text-xs shadow-sm">
      <span className="text-muted-foreground">{time}</span>
      <span className="mx-1.5 text-foreground font-medium">{latency.toFixed(1)}ms</span>
    </div>
  );
};

const NodeSparkline = memo(({ nodeId, status, className }: NodeSparklineProps) => {
  const fetchSparklineData = useMetricsStore((s) => s.fetchSparklineData);
  const sparklineData = useMetricsStore((s) => s.sparklineByNodeId[nodeId]);
  const metricsAvailable = useMetricsStore((s) => s.metricsAvailable);
  const checkMetricsAvailability = useMetricsStore((s) => s.checkMetricsAvailability);

  // Check metrics availability on mount
  useEffect(() => {
    if (metricsAvailable === null) {
      checkMetricsAvailability();
    }
  }, [metricsAvailable, checkMetricsAvailability]);

  // Fetch sparkline data
  useEffect(() => {
    if (metricsAvailable) {
      fetchSparklineData(nodeId, '1h');
    }
  }, [nodeId, metricsAvailable, fetchSparklineData]);

  // Refresh data periodically (every 30 seconds)
  useEffect(() => {
    if (!metricsAvailable) return;

    const interval = setInterval(() => {
      fetchSparklineData(nodeId, '1h');
    }, 30000);

    return () => clearInterval(interval);
  }, [nodeId, metricsAvailable, fetchSparklineData]);

  // Transform data for Tremor chart with 24h time format
  const chartData = useMemo(() => {
    if (!sparklineData?.dataPoints?.length) {
      return [];
    }

    return sparklineData.dataPoints.map((dp) => ({
      time: new Date(dp.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      latency: dp.latencyAvg !== null ? Math.round((dp.latencyAvg ?? 0) * 100) / 100 : null,
    }));
  }, [sparklineData]);

  // Don't render if no data or metrics not available
  if (!metricsAvailable || chartData.length < 2) {
    return null;
  }

  // Determine color based on status
  const chartColor = status === 'online' ? 'emerald' : status === 'offline' ? 'rose' : 'zinc';

  return (
    <div 
      className={cn(
        'w-full h-10 rounded-md bg-muted/30 overflow-hidden',
        className
      )}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <AreaChart
        data={chartData}
        index="time"
        categories={['latency']}
        colors={[chartColor]}
        className="h-10 w-full [&_.recharts-cartesian-grid]:hidden [&_.recharts-surface]:overflow-visible"
        curveType="monotone"
        showXAxis={false}
        showYAxis={false}
        showGridLines={false}
        showLegend={false}
        autoMinValue={true}
        startEndOnly={false}
        showTooltip={true}
        customTooltip={CustomTooltip}
        connectNulls={false}
      />
    </div>
  );
});

NodeSparkline.displayName = 'NodeSparkline';

export default NodeSparkline;
