import { useState } from 'react';
import { Settings2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { useInfraStore } from '@/stores/useInfraStore';

export function DisplayOptionsPopover() {
  const {
    showAllEdges,
    showWireGuardEdges,
    showRegularEdges,
    showOfflineNodes,
    showNodeMetrics,
    showNodeDetails,
    showMiniMap,
    showGrid,
    showHighlighting,
    setShowAllEdges,
    setShowWireGuardEdges,
    setShowRegularEdges,
    setShowOfflineNodes,
    setShowNodeMetrics,
    setShowNodeDetails,
    setShowMiniMap,
    setShowGrid,
    setShowHighlighting,
    resetToDefaults,
  } = useDisplayStore();

  const edges = useInfraStore(state => state.edges);
  const clearAllEdges = useInfraStore(state => state.clearAllEdges);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAllEdges = async () => {
    if (edges.length === 0) return;
    setIsDeleting(true);
    try {
      await clearAllEdges();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Display Options</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={resetToDefaults}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>

          <Separator />

          {/* Edge Visibility */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Connections
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-all-edges" className="text-sm font-normal">
                  Show all edges
                </Label>
                <Switch
                  id="show-all-edges"
                  checked={showAllEdges}
                  onCheckedChange={setShowAllEdges}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-wireguard-edges" className="text-sm font-normal">
                  WireGuard edges
                </Label>
                <Switch
                  id="show-wireguard-edges"
                  checked={showWireGuardEdges}
                  onCheckedChange={setShowWireGuardEdges}
                  disabled={!showAllEdges}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-regular-edges" className="text-sm font-normal">
                  Regular edges
                </Label>
                <Switch
                  id="show-regular-edges"
                  checked={showRegularEdges}
                  onCheckedChange={setShowRegularEdges}
                  disabled={!showAllEdges}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive/70 hover:text-destructive hover:bg-destructive/10 mt-2"
                onClick={handleDeleteAllEdges}
                disabled={isDeleting || edges.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {isDeleting ? 'Deleting...' : `Delete all (${edges.length})`}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Node Display */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Nodes
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-offline-nodes" className="text-sm font-normal">
                  Show offline nodes
                </Label>
                <Switch
                  id="show-offline-nodes"
                  checked={showOfflineNodes}
                  onCheckedChange={setShowOfflineNodes}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-node-metrics" className="text-sm font-normal">
                  Node metrics
                </Label>
                <Switch
                  id="show-node-metrics"
                  checked={showNodeMetrics}
                  onCheckedChange={setShowNodeMetrics}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-node-details" className="text-sm font-normal">
                  Node details
                </Label>
                <Switch
                  id="show-node-details"
                  checked={showNodeDetails}
                  onCheckedChange={setShowNodeDetails}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Visual Options */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Visual
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-minimap" className="text-sm font-normal">
                  MiniMap
                </Label>
                <Switch
                  id="show-minimap"
                  checked={showMiniMap}
                  onCheckedChange={setShowMiniMap}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-grid" className="text-sm font-normal">
                  Background grid
                </Label>
                <Switch
                  id="show-grid"
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-highlighting" className="text-sm font-normal">
                  Hover highlighting
                </Label>
                <Switch
                  id="show-highlighting"
                  checked={showHighlighting}
                  onCheckedChange={setShowHighlighting}
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
