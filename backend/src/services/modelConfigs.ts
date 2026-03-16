/**
 * Predefined model configurations for vLLM deployment
 * Inspired by pi-mono/pods models.json
 */

export interface ModelConfig {
  gpuCount: number;
  gpuTypes?: string[];
  args: string[];
  env?: Record<string, string>;
  notes?: string;
}

export interface ModelInfo {
  name: string;
  configs: ModelConfig[];
  notes?: string;
}

export const KNOWN_MODELS: Record<string, ModelInfo> = {
  'Qwen/Qwen2.5-Coder-32B-Instruct': {
    name: 'Qwen2.5-Coder-32B',
    configs: [
      {
        gpuCount: 1,
        gpuTypes: ['H100', 'H200', 'A100'],
        args: ['--tool-call-parser', 'hermes', '--enable-auto-tool-choice'],
      },
      {
        gpuCount: 2,
        gpuTypes: ['H100', 'H200', 'A100'],
        args: ['--tensor-parallel-size', '2', '--tool-call-parser', 'hermes', '--enable-auto-tool-choice'],
      },
    ],
  },
  'Qwen/Qwen3-Coder-30B-A3B-Instruct': {
    name: 'Qwen3-Coder-30B',
    configs: [
      {
        gpuCount: 1,
        gpuTypes: ['H100', 'H200'],
        args: ['--enable-auto-tool-choice', '--tool-call-parser', 'qwen3_coder'],
        notes: 'Fits comfortably on single GPU. ~60GB model weight.',
      },
      {
        gpuCount: 2,
        gpuTypes: ['H100', 'H200'],
        args: ['--tensor-parallel-size', '2', '--enable-auto-tool-choice', '--tool-call-parser', 'qwen3_coder'],
        notes: 'For higher throughput/longer context.',
      },
    ],
  },
  'meta-llama/Llama-3.1-8B-Instruct': {
    name: 'Llama-3.1-8B',
    configs: [
      {
        gpuCount: 1,
        gpuTypes: ['H100', 'H200', 'A100', 'RTX 4090', 'RTX 3090'],
        args: ['--enable-auto-tool-choice', '--tool-call-parser', 'llama3_json'],
        notes: 'Small model, fits on consumer GPUs.',
      },
    ],
  },
  'meta-llama/Llama-3.1-70B-Instruct': {
    name: 'Llama-3.1-70B',
    configs: [
      {
        gpuCount: 2,
        gpuTypes: ['H100', 'H200', 'A100'],
        args: ['--tensor-parallel-size', '2', '--enable-auto-tool-choice', '--tool-call-parser', 'llama3_json'],
      },
      {
        gpuCount: 4,
        gpuTypes: ['H100', 'H200', 'A100'],
        args: ['--tensor-parallel-size', '4', '--enable-auto-tool-choice', '--tool-call-parser', 'llama3_json'],
      },
    ],
  },
  'mistralai/Mistral-7B-Instruct-v0.3': {
    name: 'Mistral-7B',
    configs: [
      {
        gpuCount: 1,
        gpuTypes: ['H100', 'H200', 'A100', 'RTX 4090', 'RTX 3090'],
        args: ['--enable-auto-tool-choice', '--tool-call-parser', 'mistral'],
        notes: 'Small model, fits on consumer GPUs.',
      },
    ],
  },
  'deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct': {
    name: 'DeepSeek-Coder-V2-Lite',
    configs: [
      {
        gpuCount: 1,
        gpuTypes: ['H100', 'H200', 'A100'],
        args: ['--trust-remote-code'],
        notes: 'Lightweight coding model.',
      },
    ],
  },
  'microsoft/Phi-3-mini-4k-instruct': {
    name: 'Phi-3-mini',
    configs: [
      {
        gpuCount: 1,
        gpuTypes: ['H100', 'H200', 'A100', 'RTX 4090', 'RTX 3090', 'RTX 4080'],
        args: ['--trust-remote-code'],
        notes: 'Very small model, fits on most GPUs.',
      },
    ],
  },
};

/**
 * Get the best configuration for a model based on available GPUs
 */
export function getModelConfig(
  modelId: string,
  gpuCount: number,
  gpuType?: string
): ModelConfig | null {
  const modelInfo = KNOWN_MODELS[modelId];
  if (!modelInfo) {
    return null;
  }

  // Find best matching config
  for (const config of modelInfo.configs) {
    if (config.gpuCount !== gpuCount) {
      continue;
    }

    // Check GPU type if specified
    if (gpuType && config.gpuTypes && config.gpuTypes.length > 0) {
      const typeMatches = config.gpuTypes.some(
        (type) => gpuType.toLowerCase().includes(type.toLowerCase()) || 
                  type.toLowerCase().includes(gpuType.toLowerCase())
      );
      if (!typeMatches) {
        continue;
      }
    }

    return config;
  }

  // Fallback: find any config with matching GPU count
  return modelInfo.configs.find(c => c.gpuCount === gpuCount) || null;
}

/**
 * Check if a model is known
 */
export function isKnownModel(modelId: string): boolean {
  return modelId in KNOWN_MODELS;
}

/**
 * Get all known models
 */
export function getKnownModels(): Array<{ id: string; name: string; configs: ModelConfig[] }> {
  return Object.entries(KNOWN_MODELS).map(([id, info]) => ({
    id,
    name: info.name,
    configs: info.configs,
  }));
}

/**
 * Get model display name
 */
export function getModelName(modelId: string): string {
  return KNOWN_MODELS[modelId]?.name || modelId.split('/').pop() || modelId;
}

/**
 * Get compatible models for a given GPU setup
 */
export function getCompatibleModels(gpuCount: number, gpuType?: string): Array<{ id: string; name: string; config: ModelConfig }> {
  const compatible: Array<{ id: string; name: string; config: ModelConfig }> = [];
  
  for (const [id, info] of Object.entries(KNOWN_MODELS)) {
    const config = getModelConfig(id, gpuCount, gpuType);
    if (config) {
      compatible.push({ id, name: info.name, config });
    }
  }
  
  return compatible;
}
