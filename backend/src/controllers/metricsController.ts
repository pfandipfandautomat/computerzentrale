import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { influxService } from '../services/influxService.js';
import type { NodeMetricsHistory, NodeUptime, AggregatedMetrics } from '../types/index.js';

/**
 * Get historical metrics for a node
 * GET /api/metrics/:nodeId/history?range=1h
 */
export async function getNodeHistory(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const range = (req.query.range as string) || '1h';

    // Validate range format (e.g., 1h, 24h, 7d, 30d)
    if (!/^\d+[hdwm]$/.test(range)) {
      res.status(400).json({ error: 'Invalid range format. Use format like 1h, 24h, 7d, 30d' });
      return;
    }

    // Get node info
    const nodeResult = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    if (nodeResult.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const node = nodeResult[0];
    const dataPoints = await influxService.getNodeHistory(nodeId, range);

    const response: NodeMetricsHistory = {
      nodeId,
      nodeName: node.name,
      range,
      dataPoints,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching node history:', error);
    res.status(500).json({ error: 'Failed to fetch node history' });
  }
}

/**
 * Get uptime statistics for a node
 * GET /api/metrics/:nodeId/uptime?range=24h
 */
export async function getNodeUptime(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const range = (req.query.range as string) || '24h';

    // Validate range format
    if (!/^\d+[hdwm]$/.test(range)) {
      res.status(400).json({ error: 'Invalid range format. Use format like 1h, 24h, 7d, 30d' });
      return;
    }

    // Get node info
    const nodeResult = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    if (nodeResult.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const node = nodeResult[0];
    const uptimeStats = await influxService.getNodeUptime(nodeId, range);

    const response: NodeUptime = {
      nodeId,
      nodeName: node.name,
      range,
      ...uptimeStats,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching node uptime:', error);
    res.status(500).json({ error: 'Failed to fetch node uptime' });
  }
}

/**
 * Get aggregated metrics for a node
 * GET /api/metrics/:nodeId/aggregated?range=7d&window=1h
 */
export async function getAggregatedMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const range = (req.query.range as string) || '7d';
    const window = (req.query.window as string) || '1h';

    // Validate formats
    if (!/^\d+[hdwm]$/.test(range) || !/^\d+[hdwm]$/.test(window)) {
      res.status(400).json({ error: 'Invalid range or window format. Use format like 1h, 24h, 7d' });
      return;
    }

    // Get node info
    const nodeResult = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    if (nodeResult.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const node = nodeResult[0];
    const dataPoints = await influxService.getAggregatedMetrics(nodeId, range, window);

    // Determine aggregation type based on window
    const aggregation = window.endsWith('h') ? 'hourly' : 'daily';

    const response: AggregatedMetrics = {
      nodeId,
      nodeName: node.name,
      range,
      aggregation,
      dataPoints,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching aggregated metrics:', error);
    res.status(500).json({ error: 'Failed to fetch aggregated metrics' });
  }
}

/**
 * Check if metrics service is available
 * GET /api/metrics/status
 */
export async function getMetricsStatus(_req: Request, res: Response): Promise<void> {
  res.json({
    available: influxService.isReady(),
    message: influxService.isReady() 
      ? 'InfluxDB is connected and ready' 
      : 'InfluxDB is not configured or not connected',
  });
}

/**
 * Get server metrics history for a node
 * GET /api/metrics/:nodeId/server?range=1h
 */
export async function getServerMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const range = (req.query.range as string) || '1h';

    // Validate range format (e.g., 1h, 24h, 7d, 30d)
    if (!/^\d+[hdwm]$/.test(range)) {
      res.status(400).json({ error: 'Invalid range format. Use format like 1h, 24h, 7d, 30d' });
      return;
    }

    // Get node info
    const nodeResult = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    if (nodeResult.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const node = nodeResult[0];
    const dataPoints = await influxService.getServerMetricsHistory(nodeId, range);

    const response = {
      nodeId,
      nodeName: node.name,
      range,
      dataPoints,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching server metrics:', error);
    res.status(500).json({ error: 'Failed to fetch server metrics' });
  }
}

/**
 * Get latest server metrics for a node
 * GET /api/metrics/:nodeId/server/latest
 */
export async function getLatestServerMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;

    // Get node info
    const nodeResult = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    if (nodeResult.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const node = nodeResult[0];
    const latestMetrics = await influxService.getLatestServerMetrics(nodeId);

    if (!latestMetrics) {
      res.status(404).json({ error: 'No server metrics found for this node' });
      return;
    }

    const response = {
      nodeId,
      nodeName: node.name,
      metrics: latestMetrics,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching latest server metrics:', error);
    res.status(500).json({ error: 'Failed to fetch latest server metrics' });
  }
}

/**
 * Get aggregated server metrics for a node
 * GET /api/metrics/:nodeId/server/aggregated?range=24h&window=5m
 */
export async function getAggregatedServerMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const range = (req.query.range as string) || '24h';
    const window = (req.query.window as string) || '5m';

    // Validate formats
    if (!/^\d+[hdwm]$/.test(range) || !/^\d+[mhdw]$/.test(window)) {
      res.status(400).json({ error: 'Invalid range or window format. Use format like 1h, 24h, 7d, 5m' });
      return;
    }

    // Get node info
    const nodeResult = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
    if (nodeResult.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const node = nodeResult[0];
    const dataPoints = await influxService.getAggregatedServerMetrics(nodeId, range, window);

    const response = {
      nodeId,
      nodeName: node.name,
      range,
      window,
      dataPoints,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching aggregated server metrics:', error);
    res.status(500).json({ error: 'Failed to fetch aggregated server metrics' });
  }
}
