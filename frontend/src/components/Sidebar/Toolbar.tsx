import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useInfraStore } from '@/stores/useInfraStore';
import { cn } from '@/lib/utils';
import { DisplayOptionsPopover } from './DisplayOptionsPopover';

interface ToolbarProps {
  onAddNode: () => void;
}

export function Toolbar({ onAddNode }: ToolbarProps) {
  const { toast } = useToast();
  const { fetchAll } = useInfraStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await fetchAll();
      const { nodes } = useInfraStore.getState();
      
      toast({
        description: `Updated ${nodes.length} node${nodes.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      toast({
        title: 'Could not refresh',
        description: error instanceof Error ? error.message : 'Check your network connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-40">
      <div className="flex gap-1 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-1.5 shadow-sm">
        <Button
          onClick={onAddNode}
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
          title="Add Node"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          onClick={handleRefreshAll}
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105"
          disabled={isRefreshing}
          title="Refresh All"
        >
          <RefreshCw className={cn(
            "h-4 w-4 transition-transform duration-500", 
            isRefreshing && "animate-spin"
          )} />
        </Button>

        <DisplayOptionsPopover />
      </div>
    </div>
  );
}
