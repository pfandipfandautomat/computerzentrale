import type { Request, Response } from 'express';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { sshService } from '../services/sshService.js';

export class WireGuardController {
  /**
   * Helper to get node and validate wireguard tag
   */
  private async getNodeWithTag(nodeId: string, res: Response): Promise<typeof nodes.$inferSelect | null> {
    const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return null;
    }

    const node = result[0];
    const tags = node.tags ? JSON.parse(node.tags) : [];

    if (!tags.includes('wireguard')) {
      res.status(400).json({ error: 'Node does not have the wireguard tag' });
      return null;
    }

    return node;
  }

  /**
   * Get all WireGuard hosts (nodes with 'wireguard' tag) and their interfaces
   */
  async getWireGuardHosts(_req: Request, res: Response): Promise<void> {
    try {
      // Get all nodes
      const allNodes = await db.select().from(nodes);

      // Filter nodes with 'wireguard' tag and fetch their interfaces
      const hostsPromises = allNodes
        .filter(node => {
          const tags = node.tags ? JSON.parse(node.tags) : [];
          return tags.includes('wireguard');
        })
        .map(async (node) => {
          try {
            const interfaces = await sshService.listWireGuardInterfaces(
              node.host,
              node.port || 22,
              node.sshUser || 'root'
            );
            return { node, interfaces };
          } catch (error) {
            console.error(`Error fetching interfaces for node ${node.id}:`, error);
            return { node, interfaces: [] };
          }
        });

      const hosts = await Promise.all(hostsPromises);

      res.json({ hosts });
    } catch (error) {
      console.error('Error fetching WireGuard hosts:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch WireGuard hosts'
      });
    }
  }

  /**
   * Get WireGuard status for a node (legacy endpoint)
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const node = await this.getNodeWithTag(id, res);
      if (!node) return;

      // Get WireGuard status via SSH
      const status = await sshService.getWireGuardStatus(
        node.host,
        node.port || 22,
        node.sshUser || 'root'
      );

      res.json({ status });
    } catch (error) {
      console.error('Error fetching WireGuard status:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch WireGuard status' 
      });
    }
  }

  /**
   * List all WireGuard interfaces on a node
   */
  async listInterfaces(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const interfaces = await sshService.listWireGuardInterfaces(
        node.host,
        node.port || 22,
        node.sshUser || 'root'
      );

      res.json({ interfaces });
    } catch (error) {
      console.error('Error listing WireGuard interfaces:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list interfaces'
      });
    }
  }

  /**
   * Get detailed info for a specific WireGuard interface
   */
  async getInterface(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, interfaceName } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      const interfaceDetail = await sshService.getWireGuardInterface(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        interfaceName
      );

      if (!interfaceDetail) {
        res.status(404).json({ error: 'Interface not found' });
        return;
      }

      res.json({ interface: interfaceDetail });
    } catch (error) {
      console.error('Error getting WireGuard interface:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get interface'
      });
    }
  }

  /**
   * Generate a new WireGuard client
   */
  async createPeer(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, interfaceName } = req.params;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Missing required field: name' });
        return;
      }

      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      // Use the node's host as the endpoint
      const serverEndpointHost = node.host;

      const client = await sshService.generateWireGuardClient(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        interfaceName,
        name,
        serverEndpointHost
      );

      res.json({ client });
    } catch (error) {
      console.error('Error creating WireGuard peer:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create peer'
      });
    }
  }

  /**
   * Remove a WireGuard peer
   */
  async deletePeer(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, interfaceName, publicKey } = req.params;
      const node = await this.getNodeWithTag(nodeId, res);
      if (!node) return;

      // URL decode the public key (it may contain + and / characters)
      const decodedPublicKey = decodeURIComponent(publicKey);

      const result = await sshService.removeWireGuardPeer(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        interfaceName,
        decodedPublicKey
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error deleting WireGuard peer:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete peer'
      });
    }
  }
}

export const wireguardController = new WireGuardController();
