import { Cpu, MemoryStick, HardDrive, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MetricPlaceholderProps {
  title: string;
  icon: 'cpu' | 'memory' | 'disk';
}

const ICONS = {
  cpu: Cpu,
  memory: MemoryStick,
  disk: HardDrive,
};

export function MetricPlaceholder({ title, icon }: MetricPlaceholderProps) {
  const Icon = ICONS[icon];

  return (
    <Card className="border-border/40 bg-card/30 backdrop-blur-sm border-dashed">
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="relative">
            <Icon className="h-8 w-8 text-muted-foreground/30" />
            <Lock className="h-3 w-3 text-muted-foreground/50 absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground/70">{title}</p>
            <p className="text-xs text-muted-foreground/50">Coming Soon</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
