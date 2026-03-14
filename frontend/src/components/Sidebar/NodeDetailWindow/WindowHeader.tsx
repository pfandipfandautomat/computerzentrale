import { X, Pencil, Server, Router, HardDrive, Monitor, Cog, Box, History, Terminal as TerminalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MonitoringToggle } from '@/components/NodeDetail/MonitoringToggle';
import { NodeType } from '@/types';
import { cn } from '@/lib/utils';

interface WindowHeaderProps {
  name: string;
  host: string;
  type: NodeType;
  nodeId: string;
  onClose: () => void;
  onEdit: () => void;
  onOpenEventLog: () => void;
  onToggleTerminal: () => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  isServer: boolean;
  isTerminalMode: boolean;
  telegramAlerts?: boolean;
}

// Type icons
const nodeTypeIcons: Record<NodeType, React.ElementType> = {
  server: Server,
  router: Router,
  nas: HardDrive,
  client: Monitor,
  service: Cog,
  custom: Box,
};

// Type colors (matching InfraNode canvas nodes)
const TYPE_COLORS: Record<NodeType, { iconBg: string; iconColor: string; ringColor: string }> = {
  server: {
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    ringColor: 'ring-blue-500/30',
  },
  router: {
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
    ringColor: 'ring-orange-500/30',
  },
  nas: {
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    ringColor: 'ring-purple-500/30',
  },
  client: {
    iconBg: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
    ringColor: 'ring-teal-500/30',
  },
  service: {
    iconBg: 'bg-pink-500/20',
    iconColor: 'text-pink-400',
    ringColor: 'ring-pink-500/30',
  },
  custom: {
    iconBg: 'bg-slate-500/20',
    iconColor: 'text-slate-400',
    ringColor: 'ring-slate-500/30',
  },
};

export function WindowHeader({
  name,
  host,
  type,
  nodeId,
  onClose,
  onEdit,
  onOpenEventLog,
  onToggleTerminal,
  onMouseDown,
  isDragging,
  isServer,
  isTerminalMode,
  telegramAlerts,
}: WindowHeaderProps) {
  const Icon = nodeTypeIcons[type] || Box;
  const colors = TYPE_COLORS[type] || TYPE_COLORS.custom;

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80",
        "select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      {/* Left: Type icon + name + subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg ring-1",
            colors.iconBg,
            colors.ringColor
          )}
        >
          <Icon className={cn("w-4 h-4", colors.iconColor)} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{name}</h2>
          <span className="text-xs text-muted-foreground">
            {host} · {type}
          </span>
        </div>
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Events */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenEventLog}
          className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
          title="Events"
        >
          <History className="h-4 w-4" />
        </Button>

        {/* Alerts */}
        <MonitoringToggle
          nodeId={nodeId}
          enabled={telegramAlerts ?? false}
          compact
          className="h-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
        />

        {/* Terminal (servers only) */}
        {isServer && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTerminal}
            className={cn(
              "h-8 w-8 transition-all duration-200 hover:scale-105",
              isTerminalMode
                ? "text-primary opacity-100"
                : "opacity-60 hover:opacity-100"
            )}
            title="Terminal"
          >
            <TerminalIcon className="h-4 w-4" />
          </Button>
        )}

        {/* Edit */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>

        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          title="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
