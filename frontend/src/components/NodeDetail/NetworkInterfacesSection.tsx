import { useState } from 'react';
import { Network, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api';
import { useInfraStore } from '@/stores/useInfraStore';
import type { NetworkInterface } from '@/types';

interface NetworkInterfacesSectionProps {
  nodeId: string;
  interfaces: NetworkInterface[];
  isLoading?: boolean;
  error?: string | null;
}

export function NetworkInterfacesSection({
  nodeId,
  interfaces,
  isLoading,
  error,
}: NetworkInterfacesSectionProps) {
  const { toast } = useToast();
  const { addInterface, removeInterface } = useInfraStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newAddress.trim()) return;
    
    setIsSubmitting(true);
    try {
      const iface = await api.createNodeInterface(nodeId, newAddress.trim());
      addInterface(nodeId, iface);
      setNewAddress('');
      setIsAdding(false);
      toast({
        title: 'Interface added',
        description: `Added ${iface.address}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to add interface',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (iface: NetworkInterface) => {
    setDeletingId(iface.id);
    try {
      await api.deleteNodeInterface(nodeId, iface.id);
      removeInterface(nodeId, iface.id);
      toast({
        title: 'Interface removed',
        description: `Removed ${iface.address}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to remove interface',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewAddress('');
    }
  };

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            Network Interfaces
            {interfaces.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({interfaces.length})
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="h-7 text-xs gap-1"
            disabled={isAdding}
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-2">{error}</div>
        ) : (
          <>
            {isAdding && (
              <div className="flex items-center gap-2">
                <Input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., 192.168.1.100"
                  className="h-8 text-sm font-mono"
                  autoFocus
                  disabled={isSubmitting}
                />
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={isSubmitting || !newAddress.trim()}
                  className="h-8 px-3"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Add'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setNewAddress('');
                  }}
                  disabled={isSubmitting}
                  className="h-8 px-2"
                >
                  Cancel
                </Button>
              </div>
            )}
            
            {interfaces.length === 0 && !isAdding ? (
              <p className="text-sm text-muted-foreground italic py-2">
                No network interfaces configured.
              </p>
            ) : (
              <div className="space-y-1">
                {interfaces.map((iface) => (
                  <div
                    key={iface.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 group"
                  >
                    <code className="text-sm font-mono">{iface.address}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(iface)}
                      disabled={deletingId === iface.id}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      {deletingId === iface.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
