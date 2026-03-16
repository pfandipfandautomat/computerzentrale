import { Router } from 'express';
import { gpuService } from '../services/gpuService.js';
import { db } from '../database/index.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /gpu/cluster
 * Get status of the entire GPU cluster
 */
router.get('/cluster', async (_req, res) => {
  try {
    const status = await gpuService.getClusterStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting GPU cluster status:', error);
    res.status(500).json({ 
      error: 'Failed to get GPU cluster status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /gpu/hosts
 * Get all GPU hosts with their status (similar to docker/hosts, wireguard/hosts)
 */
router.get('/hosts', async (_req, res) => {
  try {
    const status = await gpuService.getClusterStatus();
    res.json({ 
      hosts: status.pods.map(pod => ({
        node: {
          id: pod.nodeId,
          name: pod.nodeName,
          host: pod.host,
          port: pod.port,
          sshUser: pod.sshUser,
          status: pod.isOnline ? 'online' : 'offline',
        },
        gpus: pod.gpus,
        models: pod.models,
      }))
    });
  } catch (error) {
    console.error('Error getting GPU hosts:', error);
    res.status(500).json({ 
      error: 'Failed to get GPU hosts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /gpu/:nodeId/status
 * Get GPU status for a specific node
 */
router.get('/:nodeId/status', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const status = await gpuService.getPodStatus(nodeId);
    
    if (!status) {
      return res.status(404).json({ error: 'Node not found or not a GPU node' });
    }
    
    res.json({ status });
  } catch (error) {
    console.error('Error getting GPU status:', error);
    res.status(500).json({ 
      error: 'Failed to get GPU status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /gpu/:nodeId/gpus
 * Get GPU information for a specific node
 */
router.get('/:nodeId/gpus', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    const node = await db.query.nodes.findFirst({
      where: eq(nodes.id, nodeId),
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const host = node.host.split('/')[0];
    const port = node.port || 22;
    const sshUser = node.sshUser || 'root';

    const gpus = await gpuService.getGPUInfo(host, port, sshUser);
    res.json({ gpus });
  } catch (error) {
    console.error('Error getting GPU info:', error);
    res.status(500).json({ 
      error: 'Failed to get GPU info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /gpu/:nodeId/models
 * Get running models on a specific node
 */
router.get('/:nodeId/models', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    const node = await db.query.nodes.findFirst({
      where: eq(nodes.id, nodeId),
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const host = node.host.split('/')[0];
    const port = node.port || 22;
    const sshUser = node.sshUser || 'root';

    const models = await gpuService.getRunningModels(host, port, sshUser);
    res.json({ models });
  } catch (error) {
    console.error('Error getting running models:', error);
    res.status(500).json({ 
      error: 'Failed to get running models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /gpu/v1/chat/completions
 * OpenAI-compatible chat completions endpoint
 * Routes to an available GPU pod
 */
router.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // For now, we don't support streaming
    if (stream) {
      return res.status(400).json({ error: 'Streaming not yet supported through proxy' });
    }

    const result = await gpuService.proxyCompletionRequest({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    });

    res.json(result);
  } catch (error) {
    console.error('Error proxying completion request:', error);
    res.status(500).json({ 
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'server_error',
      }
    });
  }
});

/**
 * GET /gpu/v1/models
 * List all available models across the cluster
 */
router.get('/v1/models', async (_req, res) => {
  try {
    const cluster = await gpuService.getClusterStatus();
    
    const models = cluster.pods.flatMap(pod => 
      pod.models.map(model => ({
        id: model.model,
        object: 'model',
        created: Date.now(),
        owned_by: 'computerzentrale',
        pod: pod.nodeName,
        port: model.port,
        status: model.status,
      }))
    );

    res.json({
      object: 'list',
      data: models,
    });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ 
      error: 'Failed to list models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /gpu/:nodeId/cache
 * Invalidate GPU cache for a node
 */
router.delete('/:nodeId/cache', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    const node = await db.query.nodes.findFirst({
      where: eq(nodes.id, nodeId),
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    await gpuService.invalidateCache(node.host, node.port || 22);
    res.json({ success: true, message: 'Cache invalidated' });
  } catch (error) {
    console.error('Error invalidating GPU cache:', error);
    res.status(500).json({ 
      error: 'Failed to invalidate cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /gpu/models/known
 * Get list of known models with their configurations
 */
router.get('/models/known', async (_req, res) => {
  try {
    const models = gpuService.getKnownModels();
    res.json({ models });
  } catch (error) {
    console.error('Error getting known models:', error);
    res.status(500).json({ 
      error: 'Failed to get known models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /gpu/:nodeId/models/compatible
 * Get models compatible with a node's GPU setup
 */
router.get('/:nodeId/models/compatible', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const status = await gpuService.getPodStatus(nodeId);
    
    if (!status) {
      return res.status(404).json({ error: 'Node not found or not a GPU node' });
    }
    
    const gpuCount = status.gpus.length;
    const gpuType = status.gpus[0]?.name;
    const compatible = gpuService.getCompatibleModels(gpuCount, gpuType);
    
    res.json({ 
      gpuCount,
      gpuType,
      models: compatible 
    });
  } catch (error) {
    console.error('Error getting compatible models:', error);
    res.status(500).json({ 
      error: 'Failed to get compatible models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /gpu/:nodeId/models/start
 * Start a vLLM model on a GPU node
 */
router.post('/:nodeId/models/start', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { modelId, name, gpuIds, port, vllmArgs, memory, context } = req.body;

    if (!modelId || !name) {
      return res.status(400).json({ error: 'modelId and name are required' });
    }

    const result = await gpuService.startModel(nodeId, modelId, name, {
      gpuIds,
      port,
      vllmArgs,
      memory,
      context,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error starting model:', error);
    res.status(500).json({ 
      error: 'Failed to start model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /gpu/:nodeId/models/stop
 * Stop a running vLLM model
 */
router.post('/:nodeId/models/stop', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { pid } = req.body;

    if (!pid) {
      return res.status(400).json({ error: 'pid is required' });
    }

    const result = await gpuService.stopModel(nodeId, pid);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error stopping model:', error);
    res.status(500).json({ 
      error: 'Failed to stop model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /gpu/:nodeId/models/:modelName/logs
 * Get logs for a running model
 */
router.get('/:nodeId/models/:modelName/logs', async (req, res) => {
  try {
    const { nodeId, modelName } = req.params;
    const tail = parseInt(req.query.tail as string, 10) || 100;

    const result = await gpuService.getModelLogs(nodeId, modelName, tail);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error getting model logs:', error);
    res.status(500).json({ 
      error: 'Failed to get model logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
