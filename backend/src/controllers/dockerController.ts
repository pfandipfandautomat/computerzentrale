import type { Request, Response } from 'express';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { sshService } from '../services/sshService.js';
import { websocketService } from '../services/websocketService.js';

export class DockerController {
  /**
   * Get all Docker hosts (nodes with 'docker' tag) and their containers
   */
  async getDockerHosts(_req: Request, res: Response): Promise<void> {
    try {
      // Get all nodes
      const allNodes = await db.select().from(nodes);

      // Filter nodes with 'docker' tag and fetch their containers
      const hostsPromises = allNodes
        .filter(node => {
          const tags = node.tags ? JSON.parse(node.tags) : [];
          return tags.includes('docker');
        })
        .map(async (node) => {
          try {
            const containers = await sshService.getDockerContainers(
              node.host,
              node.port || 22,
              node.sshUser || 'root'
            );
            return { node, containers };
          } catch (error) {
            // Silently return empty containers for unreachable hosts
            // This is expected for offline nodes
            return { node, containers: [] };
          }
        });

      const hosts = await Promise.all(hostsPromises);

      res.json({ hosts });
    } catch (error) {
      console.error('Error fetching Docker hosts:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch Docker hosts'
      });
    }
  }

  /**
   * Get Docker containers for a node
   */
  async getContainers(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get the node
      const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const tags = node.tags ? JSON.parse(node.tags) : [];

      // Check if node has docker tag
      if (!tags.includes('docker')) {
        res.status(400).json({ error: 'Node does not have the docker tag' });
        return;
      }

      // Get containers via SSH
      const containers = await sshService.getDockerContainers(
        node.host,
        node.port || 22,
        node.sshUser || 'root'
      );

      res.json({ containers });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch containers';
      // Only log unexpected errors, not connection failures
      if (error instanceof Error && !['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].some(code => message.includes(code))) {
        console.error('Error fetching containers:', error);
      }
      res.status(500).json({ error: message });
    }
  }

  /**
   * Start a Docker container
   */
  async startContainer(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, containerId } = req.params;

      // Get the node
      const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const tags = node.tags ? JSON.parse(node.tags) : [];

      // Check if node has docker tag
      if (!tags.includes('docker')) {
        res.status(400).json({ error: 'Node does not have the docker tag' });
        return;
      }

      // Start the container
      const result_action = await sshService.startContainer(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        containerId
      );

      // Broadcast action via WebSocket
      websocketService.broadcastContainerAction(
        nodeId,
        containerId,
        'start',
        result_action.success
      );

      if (result_action.success) {
        res.json(result_action);
      } else {
        res.status(500).json(result_action);
      }
    } catch (error) {
      console.error('Error starting container:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start container'
      });
    }
  }

  /**
   * Stop a Docker container
   */
  async stopContainer(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, containerId } = req.params;

      // Get the node
      const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const tags = node.tags ? JSON.parse(node.tags) : [];

      // Check if node has docker tag
      if (!tags.includes('docker')) {
        res.status(400).json({ error: 'Node does not have the docker tag' });
        return;
      }

      // Stop the container
      const result_action = await sshService.stopContainer(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        containerId
      );

      // Broadcast action via WebSocket
      websocketService.broadcastContainerAction(
        nodeId,
        containerId,
        'stop',
        result_action.success
      );

      if (result_action.success) {
        res.json(result_action);
      } else {
        res.status(500).json(result_action);
      }
    } catch (error) {
      console.error('Error stopping container:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to stop container'
      });
    }
  }

  /**
   * Restart a Docker container
   */
  async restartContainer(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, containerId } = req.params;

      // Get the node
      const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const tags = node.tags ? JSON.parse(node.tags) : [];

      // Check if node has docker tag
      if (!tags.includes('docker')) {
        res.status(400).json({ error: 'Node does not have the docker tag' });
        return;
      }

      // Restart the container
      const result_action = await sshService.restartContainer(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        containerId
      );

      // Broadcast action via WebSocket
      websocketService.broadcastContainerAction(
        nodeId,
        containerId,
        'restart',
        result_action.success
      );

      if (result_action.success) {
        res.json(result_action);
      } else {
        res.status(500).json(result_action);
      }
    } catch (error) {
      console.error('Error restarting container:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restart container'
      });
    }
  }

  /**
   * Delete a Docker container
   */
  async deleteContainer(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, containerId } = req.params;
      const { removeVolumes = false } = req.body;

      // Get the node
      const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const tags = node.tags ? JSON.parse(node.tags) : [];

      // Check if node has docker tag
      if (!tags.includes('docker')) {
        res.status(400).json({ error: 'Node does not have the docker tag' });
        return;
      }

      // Delete the container
      const result_action = await sshService.deleteContainer(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        containerId,
        removeVolumes
      );

      // Broadcast action via WebSocket
      websocketService.broadcastContainerAction(
        nodeId,
        containerId,
        'delete',
        result_action.success
      );

      if (result_action.success) {
        res.json(result_action);
      } else {
        res.status(500).json(result_action);
      }
    } catch (error) {
      console.error('Error deleting container:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete container'
      });
    }
  }

  /**
   * Get Docker container logs (non-streaming)
   */
  async getContainerLogs(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, containerId } = req.params;
      const tail = parseInt(req.query.tail as string) || 100;

      // Get the node
      const result = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const tags = node.tags ? JSON.parse(node.tags) : [];

      // Check if node has docker tag
      if (!tags.includes('docker')) {
        res.status(400).json({ error: 'Node does not have the docker tag' });
        return;
      }

      // Get container logs
      const result_logs = await sshService.getContainerLogs(
        node.host,
        node.port || 22,
        node.sshUser || 'root',
        containerId,
        tail
      );

      if (result_logs.success) {
        res.json({ logs: result_logs.logs || '' });
      } else {
        res.status(500).json({
          error: result_logs.message || 'Failed to fetch logs'
        });
      }
    } catch (error) {
      console.error('Error fetching container logs:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch container logs'
      });
    }
  }
}

export const dockerController = new DockerController();
