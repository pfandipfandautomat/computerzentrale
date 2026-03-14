import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useInfraStore } from '@/stores/useInfraStore';
import { api } from '@/services/api';
import { InfraNode } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface DeleteNodeModalProps {
  node: InfraNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteNodeModal({ node, open, onOpenChange }: DeleteNodeModalProps) {
  const { toast } = useToast();
  const deleteNode = useInfraStore((state) => state.deleteNode);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!node) return;

    setIsLoading(true);

    try {
      await api.deleteNode(node.id);
      deleteNode(node.id);

      toast({
        description: `${node.name} deleted successfully`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not delete node',
        description: error instanceof Error ? error.message : 'Check your network connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Node
          </DialogTitle>
          <DialogDescription>
            Delete <strong>{node?.name}</strong>? All monitoring history and configuration will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
