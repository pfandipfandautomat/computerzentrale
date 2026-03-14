import type { Request, Response } from 'express';
import { db } from '../database/db.js';
import { edges } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { websocketService } from '../services/websocketService.js';
import type { InfraEdge } from '../types/index.js';

export class EdgeController {
  /**
   * Get all edges
   */
  async getAllEdges(_req: Request, res: Response): Promise<void> {
    try {
      const allEdges = await db.select().from(edges);
      
      const formattedEdges: InfraEdge[] = allEdges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label ?? undefined,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        createdAt: edge.createdAt,
      }));

      res.json(formattedEdges);
    } catch (error) {
      console.error('Error fetching edges:', error);
      res.status(500).json({ error: 'Failed to fetch edges' });
    }
  }

  /**
   * Get edge by ID
   */
  async getEdgeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await db.select().from(edges).where(eq(edges.id, id)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Edge not found' });
        return;
      }

      const edge = result[0];
      const formattedEdge: InfraEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label ?? undefined,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        createdAt: edge.createdAt,
      };

      res.json(formattedEdge);
    } catch (error) {
      console.error('Error fetching edge:', error);
      res.status(500).json({ error: 'Failed to fetch edge' });
    }
  }

  /**
   * Create new edge
   */
  async createEdge(req: Request, res: Response): Promise<void> {
    try {
      const { source, target, label, sourceHandle, targetHandle } = req.body;

      if (!source || !target) {
        res.status(400).json({ error: 'Missing required fields: source, target' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      await db.insert(edges).values({
        id,
        source,
        target,
        label: label ?? null,
        sourceHandle: sourceHandle ?? null,
        targetHandle: targetHandle ?? null,
        createdAt: now,
      });

      const newEdge: InfraEdge = {
        id,
        source,
        target,
        label,
        sourceHandle,
        targetHandle,
        createdAt: now,
      };

      websocketService.broadcastEdgeUpdate(newEdge);
      res.status(201).json(newEdge);
    } catch (error) {
      console.error('Error creating edge:', error);
      res.status(500).json({ error: 'Failed to create edge' });
    }
  }

  /**
   * Update edge
   */
  async updateEdge(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { source, target, label, sourceHandle, targetHandle } = req.body;

      const existing = await db.select().from(edges).where(eq(edges.id, id)).limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: 'Edge not found' });
        return;
      }

      const updateData: any = {};

      if (source !== undefined) updateData.source = source;
      if (target !== undefined) updateData.target = target;
      if (label !== undefined) updateData.label = label ?? null;
      if (sourceHandle !== undefined) updateData.sourceHandle = sourceHandle ?? null;
      if (targetHandle !== undefined) updateData.targetHandle = targetHandle ?? null;

      await db.update(edges).set(updateData).where(eq(edges.id, id));

      const updated = await db.select().from(edges).where(eq(edges.id, id)).limit(1);
      const updatedEdge = updated[0];

      const formattedEdge: InfraEdge = {
        id: updatedEdge.id,
        source: updatedEdge.source,
        target: updatedEdge.target,
        label: updatedEdge.label ?? undefined,
        sourceHandle: updatedEdge.sourceHandle ?? undefined,
        targetHandle: updatedEdge.targetHandle ?? undefined,
        createdAt: updatedEdge.createdAt,
      };

      websocketService.broadcastEdgeUpdate(formattedEdge);
      res.json(formattedEdge);
    } catch (error) {
      console.error('Error updating edge:', error);
      res.status(500).json({ error: 'Failed to update edge' });
    }
  }

  /**
   * Delete edge
   */
  async deleteEdge(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existing = await db.select().from(edges).where(eq(edges.id, id)).limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: 'Edge not found' });
        return;
      }

      await db.delete(edges).where(eq(edges.id, id));

      websocketService.broadcast('edge_deleted', { id });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting edge:', error);
      res.status(500).json({ error: 'Failed to delete edge' });
    }
  }

  /**
   * Delete all edges
   */
  async deleteAllEdges(_req: Request, res: Response): Promise<void> {
    try {
      await db.delete(edges);
      
      websocketService.broadcast('edges_cleared', {});
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting all edges:', error);
      res.status(500).json({ error: 'Failed to delete all edges' });
    }
  }
}

export const edgeController = new EdgeController();
