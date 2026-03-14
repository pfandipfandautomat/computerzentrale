import type { Request, Response } from 'express';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { websocketService } from '../services/websocketService.js';
import { sshService } from '../services/sshService.js';
import type { InfraNode, NodeType, NodeStatus } from '../types/index.js';

export class NodeController {
  /**
   * Get all nodes
   */
  async getAllNodes(_req: Request, res: Response): Promise<void> {
    try {
      const allNodes = await db.select().from(nodes);
      
      const formattedNodes: InfraNode[] = allNodes.map(node => ({
        id: node.id,
        name: node.name,
        host: node.host,
        port: node.port ?? undefined,
        sshUser: node.sshUser ?? 'root',
        type: node.type as NodeType,
        tags: node.tags ? JSON.parse(node.tags) : [],
        description: node.description ?? undefined,
        position: { x: node.positionX, y: node.positionY },
        status: node.status as NodeStatus,
        latency: node.latency ?? undefined,
        lastChecked: node.lastChecked ?? undefined,
        telegramAlerts: node.telegramAlerts === 1,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      }));

      res.json(formattedNodes);
    } catch (error) {
      console.error('Error fetching nodes:', error);
      res.status(500).json({ error: 'Failed to fetch nodes' });
    }
  }

  /**
   * Get node by ID
   */
  async getNodeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const formattedNode: InfraNode = {
        id: node.id,
        name: node.name,
        host: node.host,
        port: node.port ?? undefined,
        sshUser: node.sshUser ?? 'root',
        type: node.type as NodeType,
        tags: node.tags ? JSON.parse(node.tags) : [],
        description: node.description ?? undefined,
        position: { x: node.positionX, y: node.positionY },
        status: node.status as NodeStatus,
        latency: node.latency ?? undefined,
        lastChecked: node.lastChecked ?? undefined,
        telegramAlerts: node.telegramAlerts === 1,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };

      res.json(formattedNode);
    } catch (error) {
      console.error('Error fetching node:', error);
      res.status(500).json({ error: 'Failed to fetch node' });
    }
  }

  /**
   * Create new node
   */
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const { name, host, port, sshUser, type, position, tags, description } = req.body;

      if (!name || !host || !type || !position) {
        res.status(400).json({ error: 'Missing required fields: name, host, type, position' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      await db.insert(nodes).values({
        id,
        name,
        host,
        port: port ?? null,
        sshUser: sshUser ?? 'root',
        type,
        tags: tags ? JSON.stringify(tags) : '[]',
        description: description ?? null,
        positionX: position.x,
        positionY: position.y,
        status: 'unknown',
        latency: null,
        lastChecked: null,
        createdAt: now,
        updatedAt: now,
      });

      const newNode: InfraNode = {
        id,
        name,
        host,
        port,
        sshUser: sshUser ?? 'root',
        type,
        tags: tags || [],
        description,
        position,
        status: 'unknown',
        createdAt: now,
        updatedAt: now,
      };

      websocketService.broadcastNodeUpdate(newNode);
      res.status(201).json(newNode);
    } catch (error) {
      console.error('Error creating node:', error);
      res.status(500).json({ error: 'Failed to create node' });
    }
  }

  /**
   * Update node
   */
  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, host, port, sshUser, type, position, status, latency, tags, description, telegramAlerts } = req.body;

      const existing = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const now = new Date().toISOString();
      const updateData: Partial<{
        name: string;
        host: string;
        port: number | null;
        sshUser: string;
        type: string;
        tags: string;
        description: string | null;
        positionX: number;
        positionY: number;
        status: string;
        latency: number | null;
        telegramAlerts: number;
        updatedAt: string;
      }> = { updatedAt: now };

      if (name !== undefined) updateData.name = name;
      if (host !== undefined) updateData.host = host;
      if (port !== undefined) updateData.port = port ?? null;
      if (sshUser !== undefined) updateData.sshUser = sshUser;
      if (type !== undefined) updateData.type = type;
      if (tags !== undefined) updateData.tags = JSON.stringify(tags);
      if (description !== undefined) updateData.description = description ?? null;
      if (position !== undefined) {
        updateData.positionX = position.x;
        updateData.positionY = position.y;
      }
      if (status !== undefined) updateData.status = status;
      if (latency !== undefined) updateData.latency = latency ?? null;
      if (telegramAlerts !== undefined) updateData.telegramAlerts = telegramAlerts ? 1 : 0;

      await db.update(nodes).set(updateData).where(eq(nodes.id, id));

      const updated = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
      const updatedNode = updated[0];

      const formattedNode: InfraNode = {
        id: updatedNode.id,
        name: updatedNode.name,
        host: updatedNode.host,
        port: updatedNode.port ?? undefined,
        sshUser: updatedNode.sshUser ?? 'root',
        type: updatedNode.type as NodeType,
        tags: updatedNode.tags ? JSON.parse(updatedNode.tags) : [],
        description: updatedNode.description ?? undefined,
        position: { x: updatedNode.positionX, y: updatedNode.positionY },
        status: updatedNode.status as NodeStatus,
        latency: updatedNode.latency ?? undefined,
        lastChecked: updatedNode.lastChecked ?? undefined,
        telegramAlerts: updatedNode.telegramAlerts === 1,
        createdAt: updatedNode.createdAt,
        updatedAt: updatedNode.updatedAt,
      };

      websocketService.broadcastNodeUpdate(formattedNode);
      res.json(formattedNode);
    } catch (error) {
      console.error('Error updating node:', error);
      res.status(500).json({ error: 'Failed to update node' });
    }
  }

  /**
   * Delete node
   */
  async deleteNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existing = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      await db.delete(nodes).where(eq(nodes.id, id));

      websocketService.broadcast('node_deleted', { id });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting node:', error);
      res.status(500).json({ error: 'Failed to delete node' });
    }
  }

  /**
   * Batch update node positions
   */
  async updatePositions(req: Request, res: Response): Promise<void> {
    try {
      const { positions } = req.body;

      if (!positions || typeof positions !== 'object') {
        res.status(400).json({ error: 'Missing positions object' });
        return;
      }

      const now = new Date().toISOString();

      // Update each node position
      for (const [nodeId, position] of Object.entries(positions)) {
        const pos = position as { x: number; y: number };
        await db.update(nodes)
          .set({
            positionX: pos.x,
            positionY: pos.y,
            updatedAt: now,
          })
          .where(eq(nodes.id, nodeId));
      }

      res.json({ success: true, updated: Object.keys(positions).length });
    } catch (error) {
      console.error('Error updating positions:', error);
      res.status(500).json({ error: 'Failed to update positions' });
    }
  }

  /**
   * Restart a node via SSH
   */
  async restartNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];

      // Only allow restart for server type nodes
      if (node.type !== 'server') {
        res.status(400).json({ error: 'Only server nodes can be restarted' });
        return;
      }

      const restartResult = await sshService.restartNode(
        node.host,
        node.port ?? 22,
        node.sshUser ?? 'root'
      );

      if (restartResult.success) {
        res.json({ success: true, message: restartResult.message });
      } else {
        res.status(500).json({ success: false, message: restartResult.message });
      }
    } catch (error) {
      console.error('Error restarting node:', error);
      res.status(500).json({ error: 'Failed to restart node' });
    }
  }
}

export const nodeController = new NodeController();
