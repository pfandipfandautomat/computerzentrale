import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { PingResult, InfraNode, InfraEdge } from '../types/index.js';
import { db } from '../database/db.js';
import { nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { sshService } from './sshService.js';
import { monitoringController } from '../controllers/monitoringController.js';

interface LogSubscription {
  nodeId: string;
  containerId: string;
  cleanup: () => void;
}

interface TerminalSession {
  nodeId: string;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  close: () => void;
}

interface ClientMessage {
  type: string;
  nodeId?: string;
  containerId?: string;
  data?: string;  // for terminal input
  cols?: number;  // for terminal resize
  rows?: number;  // for terminal resize
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private logSubscriptions: Map<WebSocket, LogSubscription> = new Map();
  private terminalSessions: Map<WebSocket, TerminalSession> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      this.clients.add(ws);

      // Handle incoming messages from clients
      ws.on('message', (message: string) => {
        try {
          const data: ClientMessage = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format' 
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.unsubscribeFromLogs(ws);
        this.stopTerminalSession(ws);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.unsubscribeFromLogs(ws);
        this.stopTerminalSession(ws);
        this.clients.delete(ws);
      });

      // Send initial connection message
      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Computerzentrale' }));
    });

    console.log('WebSocket server initialized');
  }

  /**
   * Handle incoming messages from clients
   */
  private handleClientMessage(ws: WebSocket, data: ClientMessage): void {
    switch (data.type) {
      case 'subscribe_logs':
        if (data.nodeId && data.containerId) {
          this.subscribeToLogs(ws, data.nodeId, data.containerId);
        } else {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Missing nodeId or containerId' 
          }));
        }
        break;

      case 'unsubscribe_logs':
        this.unsubscribeFromLogs(ws);
        break;

      case 'terminal_start':
        if (data.nodeId) {
          this.startTerminalSession(ws, data.nodeId, data.cols, data.rows);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing nodeId' }));
        }
        break;

      case 'terminal_input':
        this.handleTerminalInput(ws, data.data);
        break;

      case 'terminal_resize':
        this.handleTerminalResize(ws, data.cols, data.rows);
        break;

      case 'terminal_stop':
        this.stopTerminalSession(ws);
        break;

      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: `Unknown message type: ${data.type}` 
        }));
    }
  }

  /**
   * Subscribe to container logs
   */
  private async subscribeToLogs(ws: WebSocket, nodeId: string, containerId: string): Promise<void> {
    try {
      // Unsubscribe from any existing subscription first
      this.unsubscribeFromLogs(ws);

      // Get the node from database
      const nodeResults = await db.select().from(nodes).where(eq(nodes.id, nodeId));
      
      if (nodeResults.length === 0) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: `Node ${nodeId} not found` 
        }));
        return;
      }

      const node = nodeResults[0];

      // Get decrypted SSH key
      const sshKey = await monitoringController.getDecryptedSSHKey();

      if (!sshKey) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'SSH key not configured' 
        }));
        return;
      }

      // Use sshUser from node, fallback to 'root'
      const username = node.sshUser || 'root';
      const host = node.host;

      // Start streaming logs
      const cleanup = await sshService.streamContainerLogs(
        {
          host,
          port: node.port || 22,
          username,
          privateKey: sshKey
        },
        containerId,
        (logData: string) => {
          // Send log data to the client
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'container_log',
              data: logData,
              timestamp: new Date().toISOString()
            }));
          }
        },
        (error: Error) => {
          // Send error to the client
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Log streaming error: ${error.message}`,
              timestamp: new Date().toISOString()
            }));
          }
        }
      );

      // Store the subscription
      this.logSubscriptions.set(ws, {
        nodeId,
        containerId,
        cleanup
      });

      // Send confirmation
      ws.send(JSON.stringify({
        type: 'log_subscription_started',
        nodeId,
        containerId,
        timestamp: new Date().toISOString()
      }));

      console.log(`Started log streaming for container ${containerId} on node ${nodeId}`);
    } catch (error) {
      console.error('Error subscribing to logs:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to subscribe to logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }

  /**
   * Unsubscribe from container logs
   */
  private unsubscribeFromLogs(ws: WebSocket): void {
    const subscription = this.logSubscriptions.get(ws);
    
    if (subscription) {
      try {
        subscription.cleanup();
        console.log(`Stopped log streaming for container ${subscription.containerId} on node ${subscription.nodeId}`);
      } catch (error) {
        console.error('Error cleaning up log subscription:', error);
      }
      
      this.logSubscriptions.delete(ws);

      // Send confirmation if connection is still open
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'log_subscription_stopped',
          timestamp: new Date().toISOString()
        }));
      }
    }
  }

  /**
   * Start a terminal session for a node
   */
  private async startTerminalSession(ws: WebSocket, nodeId: string, cols?: number, rows?: number): Promise<void> {
    try {
      // Stop any existing terminal session
      this.stopTerminalSession(ws);

      // Get the node from database
      const nodeResults = await db.select().from(nodes).where(eq(nodes.id, nodeId));
      
      if (nodeResults.length === 0) {
        ws.send(JSON.stringify({ type: 'error', message: `Node ${nodeId} not found` }));
        return;
      }

      const node = nodeResults[0];

      // Get decrypted SSH key
      const sshKey = await monitoringController.getDecryptedSSHKey();

      if (!sshKey) {
        ws.send(JSON.stringify({ type: 'error', message: 'SSH key not configured' }));
        return;
      }

      // Use sshUser from node, fallback to 'root'
      const username = node.sshUser || 'root';
      const host = node.host;

      // Start shell session
      const session = await sshService.startShellSession(
        {
          host,
          port: node.port || 22,
          username,
          privateKey: sshKey,
        },
        {
          cols: cols || 80,
          rows: rows || 24,
          onData: (data: string) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'terminal_output',
                data,
              }));
            }
          },
          onError: (error: Error) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'terminal_error',
                message: error.message,
              }));
            }
          },
          onClose: () => {
            this.terminalSessions.delete(ws);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'terminal_closed' }));
            }
          },
        }
      );

      // Store the session
      this.terminalSessions.set(ws, {
        nodeId,
        write: session.write,
        resize: session.resize,
        close: session.close,
      });

      // Send confirmation
      ws.send(JSON.stringify({
        type: 'terminal_started',
        nodeId,
      }));

      console.log(`Started terminal session for node ${nodeId}`);
    } catch (error) {
      console.error('Error starting terminal session:', error);
      ws.send(JSON.stringify({
        type: 'terminal_error',
        message: `Failed to start terminal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  }

  /**
   * Handle terminal input from client
   */
  private handleTerminalInput(ws: WebSocket, data?: string): void {
    const session = this.terminalSessions.get(ws);
    if (session && data) {
      session.write(data);
    }
  }

  /**
   * Handle terminal resize from client
   */
  private handleTerminalResize(ws: WebSocket, cols?: number, rows?: number): void {
    const session = this.terminalSessions.get(ws);
    if (session && cols && rows) {
      session.resize(cols, rows);
    }
  }

  /**
   * Stop terminal session
   */
  private stopTerminalSession(ws: WebSocket): void {
    const session = this.terminalSessions.get(ws);
    if (session) {
      try {
        session.close();
        console.log(`Stopped terminal session for node ${session.nodeId}`);
      } catch (error) {
        console.error('Error closing terminal session:', error);
      }
      this.terminalSessions.delete(ws);
    }
  }

  /**
   * Broadcast container action results
   */
  broadcastContainerAction(nodeId: string, containerId: string, action: string, success: boolean): void {
    this.broadcast('container_action', {
      nodeId,
      containerId,
      action,
      success
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(type: string, data: unknown): void {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast ping results
   */
  broadcastPingResults(results: PingResult[]): void {
    this.broadcast('ping_results', results);
  }

  /**
   * Broadcast server metrics
   */
  broadcastServerMetrics(metrics: { nodeId: string; metrics: any }[]): void {
    this.broadcast('server_metrics', metrics);
  }

  /**
   * Broadcast node update
   */
  broadcastNodeUpdate(node: InfraNode): void {
    this.broadcast('node_update', node);
  }

  /**
   * Broadcast edge update
   */
  broadcastEdgeUpdate(edge: InfraEdge): void {
    this.broadcast('edge_update', edge);
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

export const websocketService = new WebSocketService();
