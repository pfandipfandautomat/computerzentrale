import type { Request, Response } from 'express';
import { db } from '../database/db.js';
import { networkInterfaces } from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { NetworkInterface } from '../types/index.js';

export class InterfaceController {
  /**
   * Get all network interfaces for a node
   */
  async getNodeInterfaces(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;

      const interfaces = await db
        .select()
        .from(networkInterfaces)
        .where(eq(networkInterfaces.nodeId, nodeId));

      const formattedInterfaces: NetworkInterface[] = interfaces.map(iface => ({
        id: iface.id,
        nodeId: iface.nodeId,
        address: iface.address,
      }));

      res.json(formattedInterfaces);
    } catch (error) {
      console.error('Error fetching network interfaces:', error);
      res.status(500).json({ error: 'Failed to fetch network interfaces' });
    }
  }

  /**
   * Create new network interface
   */
  async createInterface(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { address } = req.body;

      if (!address) {
        res.status(400).json({ error: 'Missing required field: address' });
        return;
      }

      const id = uuidv4();

      await db.insert(networkInterfaces).values({
        id,
        nodeId,
        address,
      });

      const newInterface: NetworkInterface = {
        id,
        nodeId,
        address,
      };

      res.status(201).json(newInterface);
    } catch (error) {
      console.error('Error creating network interface:', error);
      res.status(500).json({ error: 'Failed to create network interface' });
    }
  }

  /**
   * Delete network interface
   */
  async deleteInterface(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, id } = req.params;

      const existing = await db
        .select()
        .from(networkInterfaces)
        .where(and(eq(networkInterfaces.id, id), eq(networkInterfaces.nodeId, nodeId)))
        .limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: 'Network interface not found' });
        return;
      }

      await db
        .delete(networkInterfaces)
        .where(and(eq(networkInterfaces.id, id), eq(networkInterfaces.nodeId, nodeId)));

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting network interface:', error);
      res.status(500).json({ error: 'Failed to delete network interface' });
    }
  }
}

export const interfaceController = new InterfaceController();
