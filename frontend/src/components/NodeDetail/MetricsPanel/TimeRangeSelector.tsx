import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <ToggleGroup 
      type="single" 
      value={value} 
      onValueChange={(v) => v && onChange(v as TimeRange)}
      className="border border-border/50 bg-card/50 backdrop-blur-sm p-1 rounded gap-1"
    >
      {TIME_RANGES.map((range) => (
        <ToggleGroupItem
          key={range.value}
          value={range.value}
          className="text-xs px-3 py-1.5 opacity-60 hover:opacity-100 transition-all duration-200 data-[state=on]:opacity-100 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border data-[state=on]:border-primary/20"
        >
          {range.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
