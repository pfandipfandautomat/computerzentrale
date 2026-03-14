import { useMemo } from 'react';
import { AreaChart } from '@tremor/react';
import type { ServerMetricsDataPoint, ChartTooltipProps, ChartTooltipPayloadItem } from '@/types';
import type { ServerMetricType } from './MetricSelector';
import { SERVER_METRIC_OPTIONS } from './MetricSelector';

interface ServerMetricChartProps {
  data: ServerMetricsDataPoint[];
  metric: ServerMetricType;
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

export function ServerMetricChart({ data, metric }: ServerMetricChartProps) {
  const metricConfig = SERVER_METRIC_OPTIONS.find(opt => opt.value === metric);
  const unit = metricConfig?.unit || '';
  const label = metricConfig?.label || 'Value';

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    
    // For rate metrics (bytes), we need to calculate the rate per second
    const isRateMetric = ['disk_read_bytes', 'disk_write_bytes', 'network_rx_bytes', 'network_tx_bytes'].includes(metric);
    
    return data.map((dp, index) => {
      let value: number | null = null;
      
      switch (metric) {
        case 'cpu_usage':
          value = dp.cpuUsage;
          break;
        case 'memory_used_percent':
          value = dp.memoryUsedPercent;
          break;
        case 'cpu_load_1m':
          value = dp.cpuLoad1m;
          break;
        case 'disk_read_bytes':
        case 'disk_write_bytes':
        case 'network_rx_bytes':
        case 'network_tx_bytes':
          // Calculate rate for byte metrics
          if (isRateMetric && index > 0) {
            const prevDp = data[index - 1];
            const currentValue = metric === 'disk_read_bytes' ? dp.diskReadBytes :
                                 metric === 'disk_write_bytes' ? dp.diskWriteBytes :
                                 metric === 'network_rx_bytes' ? dp.networkRxBytes :
                                 dp.networkTxBytes;
            const prevValue = metric === 'disk_read_bytes' ? prevDp.diskReadBytes :
                              metric === 'disk_write_bytes' ? prevDp.diskWriteBytes :
                              metric === 'network_rx_bytes' ? prevDp.networkRxBytes :
                              prevDp.networkTxBytes;
            
            if (currentValue !== null && prevValue !== null) {
              const timeDelta = (new Date(dp.timestamp).getTime() - new Date(prevDp.timestamp).getTime()) / 1000;
              if (timeDelta > 0) {
                const bytesPerSecond = (currentValue - prevValue) / timeDelta;
                // Convert to MB/s
                value = bytesPerSecond / (1024 * 1024);
                // Ensure non-negative values
                if (value < 0) value = 0;
              }
            }
          }
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

  // Use semantic colors based on metric type
  let chartColor = 'slate';
  switch (metric) {
    case 'cpu_usage':
    case 'cpu_load_1m':
      chartColor = 'blue';
      break;
    case 'memory_used_percent':
      chartColor = 'violet';
      break;
    case 'disk_read_bytes':
    case 'disk_write_bytes':
      chartColor = 'amber';
      break;
    case 'network_rx_bytes':
    case 'network_tx_bytes':
      chartColor = 'cyan';
      break;
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
