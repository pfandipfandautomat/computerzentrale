import { cn } from "@/lib/utils"

export type Status = 'online' | 'offline' | 'unknown' | 'running' | 'exited' | 'paused' | 'restarting' | 'dead'

interface StatusIndicatorProps {
  status: Status
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  animate?: boolean
  className?: string
  label?: string
}

const STATUS_CONFIG: Record<Status, { color: string; label: string }> = {
  online: {
    color: 'bg-emerald-500',
    label: 'Online'
  },
  offline: {
    color: 'bg-red-500',
    label: 'Offline'
  },
  unknown: {
    color: 'bg-slate-500',
    label: 'Unknown'
  },
  running: {
    color: 'bg-emerald-500',
    label: 'Running'
  },
  exited: {
    color: 'bg-red-500',
    label: 'Exited'
  },
  paused: {
    color: 'bg-amber-500',
    label: 'Paused'
  },
  restarting: {
    color: 'bg-blue-500',
    label: 'Restarting'
  },
  dead: {
    color: 'bg-slate-500',
    label: 'Dead'
  }
}

const SIZE_CONFIG = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5'
}

export function StatusIndicator({
  status,
  size = 'md',
  showLabel = false,
  animate = false,
  className,
  label
}: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown
  const displayLabel = label || config.label
  const isOnline = status === 'online' || status === 'running'

  return (
    <div 
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-label={displayLabel}
      title={!showLabel ? displayLabel : undefined}
    >
      <div
        className={cn(
          "rounded-full transition-all duration-500 ease-out",
          SIZE_CONFIG[size],
          config.color,
          animate && "animate-pulse",
          isOnline && "shadow-[0_0_12px_rgba(16,185,129,0.6)]",
          status === 'offline' && "shadow-[0_0_8px_rgba(239,68,68,0.4)]",
          status === 'restarting' && "shadow-[0_0_8px_rgba(59,130,246,0.4)] animate-pulse"
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground">
          {displayLabel}
        </span>
      )}
    </div>
  )
}
