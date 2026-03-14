import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Activity, Cpu, HardDrive, Network, Gauge, Zap } from 'lucide-react';

// Network metric types
export type NetworkMetricType = 'latency_avg' | 'latency_min' | 'latency_max' | 'jitter' | 'packet_loss';

// Server metric types
export type ServerMetricType = 
  | 'cpu_usage' 
  | 'memory_used_percent' 
  | 'cpu_load_1m' 
  | 'disk_read_bytes' 
  | 'disk_write_bytes' 
  | 'network_rx_bytes' 
  | 'network_tx_bytes';

// Combined metric type
export type MetricType = NetworkMetricType | ServerMetricType;

interface MetricOption {
  value: MetricType;
  label: string;
  unit: string;
  description: string;
  category: 'network' | 'server';
  icon: React.ElementType;
  color: string;
}

export const NETWORK_METRIC_OPTIONS: MetricOption[] = [
  { value: 'latency_avg', label: 'Avg Latency', unit: 'ms', description: 'Average response time', category: 'network', icon: Activity, color: 'text-emerald-400' },
  { value: 'latency_min', label: 'Min Latency', unit: 'ms', description: 'Minimum response time', category: 'network', icon: Activity, color: 'text-emerald-400' },
  { value: 'latency_max', label: 'Max Latency', unit: 'ms', description: 'Maximum response time', category: 'network', icon: Activity, color: 'text-emerald-400' },
  { value: 'jitter', label: 'Jitter', unit: 'ms', description: 'Latency variation', category: 'network', icon: Zap, color: 'text-amber-400' },
  { value: 'packet_loss', label: 'Packet Loss', unit: '%', description: 'Lost packets percentage', category: 'network', icon: Activity, color: 'text-rose-400' },
];

export const SERVER_METRIC_OPTIONS: MetricOption[] = [
  { value: 'cpu_usage', label: 'CPU Usage', unit: '%', description: 'Processor utilization', category: 'server', icon: Cpu, color: 'text-blue-400' },
  { value: 'memory_used_percent', label: 'Memory Usage', unit: '%', description: 'RAM utilization', category: 'server', icon: Gauge, color: 'text-violet-400' },
  { value: 'cpu_load_1m', label: 'Load Average', unit: '1m', description: 'System load', category: 'server', icon: Cpu, color: 'text-blue-400' },
  { value: 'disk_read_bytes', label: 'Disk Read', unit: 'MB/s', description: 'Read throughput', category: 'server', icon: HardDrive, color: 'text-orange-400' },
  { value: 'disk_write_bytes', label: 'Disk Write', unit: 'MB/s', description: 'Write throughput', category: 'server', icon: HardDrive, color: 'text-orange-400' },
  { value: 'network_rx_bytes', label: 'Network In', unit: 'MB/s', description: 'Receive rate', category: 'server', icon: Network, color: 'text-cyan-400' },
  { value: 'network_tx_bytes', label: 'Network Out', unit: 'MB/s', description: 'Transmit rate', category: 'server', icon: Network, color: 'text-cyan-400' },
];

// Combined options
export const ALL_METRIC_OPTIONS = [...NETWORK_METRIC_OPTIONS, ...SERVER_METRIC_OPTIONS];

// Keep backward compatibility
export const METRIC_OPTIONS = NETWORK_METRIC_OPTIONS;

// Helper to check if metric is network type
export function isNetworkMetric(metric: MetricType): metric is NetworkMetricType {
  return NETWORK_METRIC_OPTIONS.some(opt => opt.value === metric);
}

// Helper to check if metric is server type
export function isServerMetric(metric: MetricType): metric is ServerMetricType {
  return SERVER_METRIC_OPTIONS.some(opt => opt.value === metric);
}

// Get option by value
export function getMetricOption(value: MetricType): MetricOption | undefined {
  return ALL_METRIC_OPTIONS.find(opt => opt.value === value);
}

interface MetricSelectorProps {
  value: MetricType;
  onChange: (value: MetricType) => void;
  includeServerMetrics?: boolean;
}

export function MetricSelector({ value, onChange, includeServerMetrics = false }: MetricSelectorProps) {
  const options = includeServerMetrics ? ALL_METRIC_OPTIONS : NETWORK_METRIC_OPTIONS;
  const selectedOption = options.find(opt => opt.value === value);
  const SelectedIcon = selectedOption?.icon || Activity;

  return (
    <Select value={value} onValueChange={(v) => onChange(v as MetricType)}>
      <SelectTrigger className="w-[200px] h-9 border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card transition-all duration-200 opacity-90 hover:opacity-100 data-[state=open]:bg-secondary/70 data-[state=open]:border-primary/40">
        <SelectValue>
          <span className="flex items-center gap-2">
            <SelectedIcon className={`h-3.5 w-3.5 ${selectedOption?.color || 'text-muted-foreground'}`} />
            <span className="font-medium">{selectedOption?.label}</span>
            {selectedOption?.unit && (
              <span className="text-xs text-muted-foreground font-mono">({selectedOption.unit})</span>
            )}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-card/95 backdrop-blur-sm border-border/50 min-w-[240px]">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="cursor-pointer py-2.5 rounded-md transition-all duration-150 focus:bg-secondary/70 data-[highlighted]:bg-secondary/70 data-[highlighted]:border-l-2 data-[highlighted]:border-primary/60"
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${option.color} shrink-0`} />
                <div className="flex flex-col min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{option.label}</span>
                    {option.unit && (
                      <span className="text-xs text-muted-foreground/70 font-mono">({option.unit})</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground/70">{option.description}</span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
