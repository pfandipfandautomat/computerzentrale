import type { Request, Response } from 'express';
import { cacheService } from '../services/cacheService.js';
import { sshService } from '../services/sshService.js';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';

export class CacheController {
  /**
   * Get cache statistics
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await cacheService.getStats();
      const keys = await cacheService.keys();
      
      res.json({
        stats,
        keys: keys.length,
        keyList: keys,
      });
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      res.status(500).json({ error: 'Failed to fetch cache statistics' });
    }
  }

  /**
   * Invalidate cache for a specific node
   */
  async invalidateNodeCache(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;

      // Get node details from database
      const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const deletedCount = await sshService.invalidateCache(node.host, node.port ?? undefined);

      console.log(`[Cache Controller] Invalidated ${deletedCount} cache entries for node ${nodeId} (${node.host}:${node.port})`);

      res.json({
        success: true,
        message: `Invalidated cache for node ${node.name}`,
        deletedCount,
        node: {
          id: node.id,
          name: node.name,
          host: node.host,
          port: node.port,
        },
      });
    } catch (error) {
      console.error('Error invalidating node cache:', error);
      res.status(500).json({ error: 'Failed to invalidate node cache' });
    }
  }

  /**
   * Invalidate all cache
   */
  async invalidateAllCache(_req: Request, res: Response): Promise<void> {
    try {
      const keysBefore = (await cacheService.keys()).length;
      await sshService.invalidateAllCache();
      const keysAfter = (await cacheService.keys()).length;
      const deletedCount = keysBefore - keysAfter;

      console.log(`[Cache Controller] Invalidated all SSH cache (${deletedCount} entries)`);

      res.json({
        success: true,
        message: 'Invalidated all SSH cache',
        deletedCount,
      });
    } catch (error) {
      console.error('Error invalidating all cache:', error);
      res.status(500).json({ error: 'Failed to invalidate all cache' });
    }
  }

  /**
   * Flush all cache (including non-SSH cache if any)
   */
  async flushAllCache(_req: Request, res: Response): Promise<void> {
    try {
      const keysBefore = (await cacheService.keys()).length;
      await cacheService.flush();

      console.log(`[Cache Controller] Flushed all cache (${keysBefore} entries)`);

      res.json({
        success: true,
        message: 'Flushed all cache',
        deletedCount: keysBefore,
      });
    } catch (error) {
      console.error('Error flushing cache:', error);
      res.status(500).json({ error: 'Failed to flush cache' });
    }
  }
}

export const cacheController = new CacheController();
