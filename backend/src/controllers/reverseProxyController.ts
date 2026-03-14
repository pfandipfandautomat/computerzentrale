import type { Request, Response } from 'express';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { sshService } from '../services/sshService.js';

export class ReverseProxyController {
  /**
   * Helper to get node and validate reverse-proxy tag
   */
  private async getNodeWithTag(nodeId: string, res: Response): Promise<typeof nodes.$inferSelect | null> {
    const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return null;
    }

    const node = result[0];
    const tags = node.tags ? JSON.parse(node.tags) : [];

    if (!tags.includes('reverse-proxy')) {
      res.status(400).json({ error: 'Node does not have the reverse-proxy tag' });
      return null;
    }

    return node;
  }

  /**
   * Get all reverse proxy hosts (nodes with 'reverse-proxy' tag) and their configs
   */
  async getReverseProxyHosts(_req: Request, res: Response): Promise<void> {
    try {
      // Get all nodes
      const allNodes = await db.select().from(nodes);

      // Filter nodes with 'reverse-proxy' tag and fetch their configs
      const hostsPromises = allNodes
        .filter(node => {
          const tags = node.tags ? JSON.parse(node.tags) : [];
          return tags.includes('reverse-proxy');
        })
        .map(async (node) => {
          try {
            const configs = await sshService.listNginxConfigFiles(
              node.host,
              node.port || 22,
              node.sshUser || 'root'
            );
            return { node, configs };
          } catch (error) {
            console.error(`Error fetching configs for node ${node.id}:`, error);
            return { node, configs: [] };
          }
        });

      const hosts = await Promise.all(hostsPromises);

      res.json({ hosts });
    } catch (error) {
      console.error('Error fetching reverse proxy hosts:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch reverse proxy hosts'
      });
    }
  }

  /**
   * Get reverse proxy configs for a node (legacy endpoint)
   */
  async getConfigs(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const node = await this.getNodeWithTag(id, res);
      if (!node) return;

      // Get nginx configs via SSH
      const configs = await sshService.getNginxConfigs(
        node.host,
        node.port || 22,
        node.sshUser || 'root'
      );

      res.json({ configs });
    } catch (error) {
      console.error('Error fetching reverse proxy configs:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch reverse proxy configs' 
      });
    }
  }

  /**
   * List all nginx config files for a node
   */
  async listConfigFiles(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const files = await sshService.listNginxConfigFiles(
        node.host,
        node.port || 22,
        node.sshUser || 'root'
      );

      res.json({ files });
    } catch (error) {
      console.error('Error listing nginx config files:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list config files'
      });
    }
  }

  /**
   * Get content of a specific nginx config file
   */
  async getConfigFile(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, filename } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const content = await sshService.readNginxConfigFile(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        filename
      );

      res.json({ filename, content });
    } catch (error) {
      console.error('Error reading nginx config file:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to read config file'
      });
    }
  }

  /**
   * Create a new nginx reverse proxy config
   */
  async createConfig(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { domain, upstreamIp, upstreamPort } = req.body;

      // Validate input
      if (!domain || !upstreamIp || !upstreamPort) {
        res.status(400).json({ error: 'Missing required fields: domain, upstreamIp, upstreamPort' });
        return;
      }

      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const result = await sshService.createNginxConfig(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        domain,
        upstreamIp,
        parseInt(upstreamPort, 10)
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error creating nginx config:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create config'
      });
    }
  }

  /**
   * Delete an nginx config file
   */
  async deleteConfig(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, filename } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const result = await sshService.deleteNginxConfig(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        filename
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error deleting nginx config:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete config'
      });
    }
  }

  /**
   * Test nginx configuration
   */
  async testConfig(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const result = await sshService.testNginxConfig(
        node.host,
        node.port || 22,
        node.sshUser || 'root'
      );

      res.json(result);
    } catch (error) {
      console.error('Error testing nginx config:', error);
      res.status(500).json({
        success: false,
        output: error instanceof Error ? error.message : 'Failed to test config'
      });
    }
  }

  /**
   * Reload nginx to apply configuration changes
   */
  async reloadNginx(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const result = await sshService.reloadNginx(
        node.host,
        node.port || 22,
        node.sshUser || 'root'
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error reloading nginx:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reload nginx'
      });
    }
  }
}

export const reverseProxyController = new ReverseProxyController();
