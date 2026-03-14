import { useMemo } from 'react';
import { AreaChart } from '@tremor/react';
import type { MetricDataPoint, ChartTooltipProps, ChartTooltipPayloadItem } from '@/types';
import type { NetworkMetricType } from './MetricSelector';
import { NETWORK_METRIC_OPTIONS } from './MetricSelector';

interface MetricChartProps {
  data: MetricDataPoint[];
  metric: NetworkMetricType;
}

// Custom tooltip for elegant dark mode
const createCustomTooltip = (unit: string) => ({ payload, active, label }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((item: ChartTooltipPayloadItem, idx: number) => (
        <p key={idx} className="text-sm font-medium text-foreground">
          <span className="font-mono">{typeof item.value === 'number' ? item.value.toFixed(2) : item.value}{unit}</span>
        </p>
      ))}
    </div>
  );
};

export function MetricChart({ data, metric }: MetricChartProps) {
  const metricConfig = NETWORK_METRIC_OPTIONS.find(opt => opt.value === metric);
  const unit = metricConfig?.unit || 'ms';
  const label = metricConfig?.label || 'Value';

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    
    return data.map((dp) => {
      let value: number | null = null;
      
      switch (metric) {
        case 'latency_avg':
          value = dp.latencyAvg;
          break;
        case 'latency_min':
          value = dp.latencyMin;
          break;
        case 'latency_max':
          value = dp.latencyMax;
          break;
        case 'jitter':
          value = dp.jitter;
          break;
        case 'packet_loss':
          value = dp.packetLoss;
          break;
      }
      
      return {
        time: new Date(dp.timestamp).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        [label]: value !== null && value !== undefined ? Math.round(value * 100) / 100 : null,
      };
    });
  }, [data, metric, label]);

  if (chartData.length < 2) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        Not enough data to display chart
      </div>
    );
  }

  // Color based on metric type - use more muted tones
  let chartColor = 'emerald';
  if (metric === 'packet_loss') {
    chartColor = 'rose';
  } else if (metric === 'jitter') {
    chartColor = 'amber';
  }

  return (
    <AreaChart
      data={chartData}
      index="time"
      categories={[label]}
      colors={[chartColor]}
      className="h-[200px] [&_.recharts-cartesian-grid-horizontal_line]:stroke-border/30 [&_.recharts-cartesian-grid-horizontal_line]:stroke-[0.5] [&_.recharts-cartesian-grid-vertical_line]:stroke-transparent [&_.recharts-area]:opacity-60 [&_.recharts-line]:opacity-80"
      curveType="monotone"
      showXAxis={true}
      showYAxis={true}
      showGridLines={true}
      showLegend={false}
      autoMinValue={true}
      connectNulls={false}
      yAxisWidth={45}
      customTooltip={createCustomTooltip(unit)}
    />
  );
}

// Keep the old export name for backwards compatibility
export { MetricChart as LatencyChart };
