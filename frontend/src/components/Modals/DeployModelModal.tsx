import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api';
import { GPUInfo } from '@/types';
import { cn } from '@/lib/utils';
import { Cpu, Loader2, Rocket, Sparkles, Zap } from 'lucide-react';

interface DeployModelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  nodeName: string;
  gpus: GPUInfo[];
  onDeployed?: () => void;
}

interface CompatibleModel {
  id: string;
  name: string;
  config: {
    gpuCount: number;
    args: string[];
    notes?: string;
  };
}

export function DeployModelModal({ 
  open, 
  onOpenChange, 
  nodeId, 
  nodeName, 
  gpus,
  onDeployed 
}: DeployModelModalProps) {
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [compatibleModels, setCompatibleModels] = useState<CompatibleModel[]>([]);
  
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [customModelId, setCustomModelId] = useState('');
  const [modelName, setModelName] = useState('');
  const [selectedGpuIds, setSelectedGpuIds] = useState<number[]>([]);
  const [memory, setMemory] = useState('90');
  const [context, setContext] = useState('32k');

  // Fetch compatible models when modal opens
  useEffect(() => {
    if (open && nodeId) {
      setIsLoadingModels(true);
      api.getCompatibleModels(nodeId)
        .then(response => {
          setCompatibleModels(response.models);
          // Auto-select first model if available
          if (response.models.length > 0) {
            setSelectedModelId(response.models[0].id);
            setModelName(response.models[0].name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
          }
        })
        .catch(error => {
          console.error('Failed to fetch compatible models:', error);
          toast({
            title: 'Could not load models',
            description: 'Failed to fetch compatible models for this GPU setup.',
            variant: 'destructive',
          });
        })
        .finally(() => setIsLoadingModels(false));
      
      // Default to first GPU
      if (gpus.length > 0) {
        setSelectedGpuIds([gpus[0].id]);
      }
    }
  }, [open, nodeId, gpus, toast]);

  // Update model name when selection changes
  useEffect(() => {
    if (selectedModelId && selectedModelId !== 'custom') {
      const model = compatibleModels.find(m => m.id === selectedModelId);
      if (model) {
        setModelName(model.name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
      }
    }
  }, [selectedModelId, compatibleModels]);

  const handleDeploy = async () => {
    const finalModelId = selectedModelId === 'custom' ? customModelId : selectedModelId;
    
    if (!finalModelId || !modelName) {
      toast({
        title: 'Missing fields',
        description: 'Please select a model and provide a name.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.startGPUModel(nodeId, {
        modelId: finalModelId,
        name: modelName,
        gpuIds: selectedGpuIds.length > 0 ? selectedGpuIds : undefined,
        memory: `${memory}%`,
        context,
      });

      if (result.success) {
        toast({
          description: `Model ${modelName} deployed on port ${result.port}`,
        });
        onOpenChange(false);
        onDeployed?.();
      } else {
        toast({
          title: 'Deployment failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Deployment failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGpu = (gpuId: number) => {
    setSelectedGpuIds(prev => 
      prev.includes(gpuId) 
        ? prev.filter(id => id !== gpuId)
        : [...prev, gpuId]
    );
  };

  const selectedModel = compatibleModels.find(m => m.id === selectedModelId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-400" />
            Deploy Model
          </DialogTitle>
          <DialogDescription>
            Deploy a vLLM model to {nodeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label>Model</Label>
            {isLoadingModels ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading compatible models...
              </div>
            ) : (
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {compatibleModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        {model.name}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-amber-400" />
                      Custom Model ID
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            
            {selectedModelId === 'custom' && (
              <Input
                placeholder="e.g., meta-llama/Llama-3.1-8B-Instruct"
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                className="mt-2"
              />
            )}
            
            {selectedModel?.config.notes && (
              <p className="text-xs text-muted-foreground">{selectedModel.config.notes}</p>
            )}
          </div>

          {/* Model Name */}
          <div className="space-y-2">
            <Label htmlFor="modelName">Instance Name</Label>
            <Input
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-model"
            />
            <p className="text-xs text-muted-foreground">Used for logs and API routing</p>
          </div>

          {/* GPU Selection */}
          <div className="space-y-2">
            <Label>GPUs</Label>
            <div className="flex flex-wrap gap-2">
              {gpus.map(gpu => (
                <button
                  key={gpu.id}
                  type="button"
                  onClick={() => toggleGpu(gpu.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm',
                    selectedGpuIds.includes(gpu.id)
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-border/50 hover:border-border text-muted-foreground'
                  )}
                >
                  <Cpu className="h-3 w-3" />
                  GPU {gpu.id}
                  <span className="text-xs opacity-70">
                    {gpu.vendor === 'nvidia' ? 'NVIDIA' : gpu.vendor === 'amd' ? 'AMD' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Memory & Context */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GPU Memory</Label>
              <Select value={memory} onValueChange={setMemory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="90">90%</SelectItem>
                  <SelectItem value="95">95%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context Length</Label>
              <Select value={context} onValueChange={setContext}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4k">4K tokens</SelectItem>
                  <SelectItem value="8k">8K tokens</SelectItem>
                  <SelectItem value="16k">16K tokens</SelectItem>
                  <SelectItem value="32k">32K tokens</SelectItem>
                  <SelectItem value="64k">64K tokens</SelectItem>
                  <SelectItem value="128k">128K tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleDeploy} disabled={isLoading || (!selectedModelId && !customModelId)}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Deploy
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
