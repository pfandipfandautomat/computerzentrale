import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAlertingStore } from '@/stores/useAlertingStore';
import { useInfraStore } from '@/stores/useInfraStore';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

interface MonitoringToggleProps {
  nodeId: string;
  enabled: boolean;
  className?: string;
  compact?: boolean;
}

export function MonitoringToggle({ nodeId, enabled, className, compact = false }: MonitoringToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(enabled);
  
  const { telegramConfig, fetchTelegramConfig } = useAlertingStore();
  const updateNode = useInfraStore((state) => state.updateNode);
  
  // Fetch telegram config on mount if not loaded
  useEffect(() => {
    if (telegramConfig === null) {
      fetchTelegramConfig();
    }
  }, [telegramConfig, fetchTelegramConfig]);
  
  // Sync local state with prop
  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);
  
  const isTelegramConfigured = telegramConfig?.configured && telegramConfig?.enabled;
  
  const handleToggle = async (checked: boolean) => {
    if (!isTelegramConfigured) return;
    
    setIsLoading(true);
    setLocalEnabled(checked);
    
    try {
      await api.updateNode(nodeId, { telegramAlerts: checked });
      updateNode(nodeId, { telegramAlerts: checked });
    } catch (error) {
      // Revert on error
      setLocalEnabled(!checked);
      console.error('Failed to update telegram alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleContent = compact ? (
    // Compact mode: button-style for header rows
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleToggle(!localEnabled)}
      disabled={!isTelegramConfigured || isLoading}
      className={cn(
        "gap-2",
        localEnabled && "border-emerald-500/50 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/70",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : localEnabled ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      Alerts
    </Button>
  ) : (
    // Full mode: card-style for detail panels
    <div className={cn(
      "flex items-center justify-between py-2.5 px-3 rounded-lg",
      "bg-secondary/30 border border-border/40",
      !isTelegramConfigured && "opacity-50 cursor-not-allowed",
      className
    )}>
      <div className="flex items-center gap-2.5">
        {localEnabled ? (
          <Bell className="h-4 w-4 text-emerald-400" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground/60" />
        )}
        <Label 
          htmlFor={`alerts-${nodeId}`}
          className={cn(
            "text-sm cursor-pointer select-none",
            localEnabled ? "text-foreground" : "text-muted-foreground",
            !isTelegramConfigured && "cursor-not-allowed"
          )}
        >
          Alerts
        </Label>
      </div>
      
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          id={`alerts-${nodeId}`}
          checked={localEnabled}
          onCheckedChange={handleToggle}
          disabled={!isTelegramConfigured || isLoading}
        />
      )}
    </div>
  );
  
  if (!isTelegramConfigured) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {toggleContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">
              {!telegramConfig?.configured 
                ? "Configure Telegram in Settings to enable alerts"
                : "Enable Telegram in Settings to receive alerts"
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return toggleContent;
}
