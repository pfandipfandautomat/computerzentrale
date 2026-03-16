import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useInfraStore } from '@/stores/useInfraStore';
import { api } from '@/services/api';
import { NodeType, NodeTag, NODE_TAGS, TAG_CONFIG } from '@/types';
import { cn } from '@/lib/utils';
import { 
  Server, 
  Router, 
  HardDrive, 
  Cpu, 
  Globe, 
  Box, 
  User, 
  Network, 
  Terminal,
  Sparkles,
  Check
} from 'lucide-react';

interface AddNodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NODE_TYPE_CONFIG: Record<NodeType, { icon: typeof Server; label: string }> = {
  server: { icon: Server, label: 'Server' },
  router: { icon: Router, label: 'Router' },
  nas: { icon: HardDrive, label: 'NAS' },
  client: { icon: Cpu, label: 'Client' },
  service: { icon: Globe, label: 'Service' },
  custom: { icon: Box, label: 'Custom' },
};

const TAG_DESCRIPTIONS: Record<NodeTag, { description: string }> = {
  'docker': { 
    description: 'Monitor containers, start/stop services, view logs' 
  },
  'reverse-proxy': { 
    description: 'Manage nginx configs, SSL certificates, domains' 
  },
  'wireguard': { 
    description: 'View VPN peers, generate client configs' 
  },
  'gpu': {
    description: 'GPU cluster for LLM inference with OpenAI-compatible API'
  },
};

export function AddNodeModal({ open, onOpenChange }: AddNodeModalProps) {
  const { toast } = useToast();
  const addNode = useInfraStore((state) => state.addNode);
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '22',
    sshUser: 'root',
    type: 'client' as NodeType,
    description: '',
  });
  const [tags, setTags] = useState<NodeTag[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.host.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Please enter both a name and host address for this node.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const newNode = await api.createNode({
        name: formData.name.trim(),
        host: formData.host.trim(),
        port: formData.type === 'server' ? (formData.port ? parseInt(formData.port, 10) : 22) : undefined,
        sshUser: formData.type === 'server' ? (formData.sshUser.trim() || 'root') : undefined,
        type: formData.type,
        tags: formData.type === 'server' ? tags : [],
        description: formData.description.trim() || undefined,
        position: { x: 100, y: 100 },
        status: 'unknown',
      });

      addNode(newNode);

      toast({
        description: `${newNode.name} added successfully`,
      });

      // Reset form and close modal
      setFormData({
        name: '',
        host: '',
        port: '22',
        sshUser: 'root',
        type: 'client',
        description: '',
      });
      setTags([]);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not create node',
        description: error instanceof Error ? error.message : 'Check your network connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      host: '',
      port: '22',
      sshUser: 'root',
      type: 'client',
      description: '',
    });
    setTags([]);
    onOpenChange(false);
  };

  const toggleTag = (tag: NodeTag) => {
    setTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Add New Node</DialogTitle>
          <DialogDescription>
            Add a new device to your infrastructure monitoring
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" id="add-node-form">
          <div className="flex-1 overflow-y-auto px-1 -mx-1">
            <div className="space-y-6 py-4">
              {/* Node Type */}
              <div className="space-y-3">
                <Label className="text-sm">Type</Label>
                <div className="grid grid-cols-6 gap-1.5">
                  {(Object.entries(NODE_TYPE_CONFIG) as [NodeType, typeof NODE_TYPE_CONFIG.server][]).map(([type, config]) => {
                    const Icon = config.icon;
                    const isSelected = formData.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, type });
                          if (type !== 'server') {
                            setTags([]);
                          }
                        }}
                        disabled={isLoading}
                        className={cn(
                          'flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border/50 hover:border-border hover:bg-secondary/50 text-muted-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[11px] font-medium">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name + Host */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-sm">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Server"
                    disabled={isLoading}
                    className="h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="host" className="text-sm">
                    Host <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="host"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      placeholder="192.168.1.100"
                      disabled={isLoading}
                      className="h-10 pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-sm">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Production web server running nginx..."
                  disabled={isLoading}
                  className="resize-none h-20"
                />
              </div>

              {/* SSH Connection Section - Only for servers */}
              {formData.type === 'server' && (
                <div className="space-y-4 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Network className="h-4 w-4" />
                    SSH Connection
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sshUser" className="text-sm">
                        SSH User
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="sshUser"
                          value={formData.sshUser}
                          onChange={(e) => setFormData({ ...formData, sshUser: e.target.value })}
                          placeholder="root"
                          disabled={isLoading}
                          className="h-10 pl-10"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="port" className="text-sm">
                        SSH Port
                      </Label>
                      <div className="relative">
                        <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="port"
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                          placeholder="22"
                          disabled={isLoading}
                          className="h-10 pl-10"
                          min="1"
                          max="65535"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Features/Tags Section - Only for servers */}
              {formData.type === 'server' && (
                <div className="space-y-4 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Features
                  </div>
                
                  <div className="grid gap-2">
                    {NODE_TAGS.map((tag) => {
                      const config = TAG_CONFIG[tag];
                      const tagInfo = TAG_DESCRIPTIONS[tag];
                      const Icon = config.icon;
                      const isSelected = tags.includes(tag);
                      
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          disabled={isLoading}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
                            isSelected
                              ? cn('border-primary/50 bg-primary/5', config.bg)
                              : 'border-border/50 hover:border-border hover:bg-secondary/30'
                          )}
                        >
                          <div className={cn(
                            'p-2 rounded-lg ring-1 ring-inset flex-shrink-0',
                            isSelected
                              ? cn(config.bg, config.ring)
                              : 'bg-secondary ring-border/50'
                          )}>
                            <Icon className={cn(
                              'h-4 w-4',
                              isSelected ? config.color : 'text-muted-foreground'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'font-medium text-sm',
                                isSelected ? config.color : 'text-foreground'
                              )}>
                                {config.label}
                              </span>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tagInfo.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        <DialogFooter className="flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            form="add-node-form"
            disabled={isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              'Create Node'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
