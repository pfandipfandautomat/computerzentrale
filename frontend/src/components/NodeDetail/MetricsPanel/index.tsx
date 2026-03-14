import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type TimeRange } from './TimeRangeSelector';
import { type MetricType, isNetworkMetric, isServerMetric } from './MetricSelector';
import { MetricChart } from './LatencyChart';
import { ServerMetricChart } from './ServerMetricChart';
import type { NodeType, MetricDataPoint, ServerMetricsDataPoint } from '@/types';

interface MetricsPanelProps {
  nodeId: string;
  nodeType: NodeType;
  timeRange: TimeRange;
  selectedMetric: MetricType;
  sparklineData: MetricDataPoint[];
  serverMetricsData: ServerMetricsDataPoint[];
  isLoading: boolean;
}

export function MetricsPanel({ 
  selectedMetric,
  sparklineData,
  serverMetricsData,
  isLoading,
}: MetricsPanelProps) {
  // Determine which chart to show based on selected metric
  const showNetworkChart = isNetworkMetric(selectedMetric);
  const showServerChart = isServerMetric(selectedMetric);

  // Determine if we have data to display
  const hasNetworkData = sparklineData.length > 0;
  const hasServerData = serverMetricsData.length > 0;

  return (
    <Card className="border-border/40">
      <CardContent className="pt-4">
        {showNetworkChart && (
          isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : hasNetworkData ? (
            <MetricChart 
              data={sparklineData} 
              metric={selectedMetric as any}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Not enough data to display
            </div>
          )
        )}
        {showServerChart && (
          isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : hasServerData ? (
            <ServerMetricChart 
              data={serverMetricsData} 
              metric={selectedMetric as any}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Not enough data to display
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
