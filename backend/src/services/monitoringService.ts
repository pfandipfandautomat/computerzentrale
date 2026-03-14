import cron from 'node-cron';
import { db } from '../database/db.js';
import { nodes, settings } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { pingService } from './pingService.js';
import { websocketService } from './websocketService.js';
import { influxService } from './influxService.js';
import { serverMetricsService } from './serverMetricsService.js';
import { alertingService } from './alertingService.js';
import type { MonitoringSettings } from '../types/index.js';

export class MonitoringService {
  private cronJob: cron.ScheduledTask | null = null;
  private serverMetricsInterval: NodeJS.Timeout | null = null;
  private currentSettings: MonitoringSettings = {
    pingInterval: 10,
    enabled: true,
  };

  /**
   * Initialize monitoring service
   */
  async initialize(): Promise<void> {
    await this.loadSettings();
    
    // Initialize InfluxDB connection
    await influxService.initialize();
    
    // Initialize alerting service
    await alertingService.initialize();
    
    if (this.currentSettings.enabled) {
      this.start();
      this.startServerMetricsCollection();
    }
    console.log('Monitoring service initialized');
  }

  /**
   * Load settings from database
   */
  private async loadSettings(): Promise<void> {
    try {
      const settingsResult = await db.select().from(settings).where(eq(settings.id, 'default')).limit(1);
      
      if (settingsResult.length > 0) {
        const dbSettings = settingsResult[0];
        this.currentSettings = {
          pingInterval: dbSettings.pingInterval,
          enabled: dbSettings.enabled === 1,
        };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.cronJob) {
      console.log('Monitoring already running');
      return;
    }

    const intervalSeconds = this.currentSettings.pingInterval;
    const cronExpression = `*/${intervalSeconds} * * * * *`;

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.performMonitoringCheck();
    });

    console.log(`Monitoring started with interval: ${intervalSeconds}s`);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Monitoring stopped');
    }
    this.stopServerMetricsCollection();
  }

  /**
   * Restart monitoring with new settings
   */
  async restart(newSettings?: Partial<MonitoringSettings>): Promise<void> {
    this.stop();
    
    if (newSettings) {
      this.currentSettings = { ...this.currentSettings, ...newSettings };
    } else {
      await this.loadSettings();
    }

    if (this.currentSettings.enabled) {
      this.start();
      this.startServerMetricsCollection();
    }
  }

  /**
   * Start server metrics collection
   */
  startServerMetricsCollection(): void {
    if (this.serverMetricsInterval) {
      console.log('Server metrics collection already running');
      return;
    }

    const intervalMs = parseInt(process.env.SERVER_METRICS_INTERVAL || '10', 10) * 1000;

    // Run immediately on start
    this.collectServerMetrics();

    // Then run on interval
    this.serverMetricsInterval = setInterval(async () => {
      await this.collectServerMetrics();
    }, intervalMs);

    console.log(`Server metrics collection started with interval: ${intervalMs / 1000}s`);
  }

  /**
   * Stop server metrics collection
   */
  stopServerMetricsCollection(): void {
    if (this.serverMetricsInterval) {
      clearInterval(this.serverMetricsInterval);
      this.serverMetricsInterval = null;
      console.log('Server metrics collection stopped');
    }
  }

  /**
   * Collect metrics from all server nodes
   */
  private async collectServerMetrics(): Promise<void> {
    try {
      const allNodes = await db.select().from(nodes);
      
      // Filter nodes with 'server' type
      const serverNodes = allNodes.filter(node => {
        return node.type === 'server';
      });

      if (serverNodes.length === 0) {
        return;
      }

      // Collect metrics from each server in parallel
      const metricsPromises = serverNodes.map(async (node) => {
        try {
          const metrics = await serverMetricsService.collectMetrics(
            node.id,
            node.host,
            node.port || 22,
            node.sshUser || 'root'
          );
          if (metrics) {
            return { metrics, nodeName: node.name };
          }
          return null;
        } catch (error: any) {
          // Silently handle common connection errors
          const isConnectionError = error?.code === 'EHOSTUNREACH' || 
                                    error?.code === 'ECONNREFUSED' ||
                                    error?.code === 'ETIMEDOUT' ||
                                    error?.level === 'client-socket' ||
                                    error?.level === 'client-timeout';
          
          if (!isConnectionError) {
            console.error(`Failed to collect metrics from ${node.name}:`, error.message || error);
          }
          return null;
        }
      });

      const results = await Promise.all(metricsPromises);
      const validResults = results.filter((r): r is { metrics: any; nodeName: string } => r !== null);

      // Write to InfluxDB
      if (influxService.isReady() && validResults.length > 0) {
        await influxService.writeMultipleServerMetrics(validResults);
      }

      // Broadcast via WebSocket (matching ping_results pattern)
      if (validResults.length > 0) {
        const metricsForBroadcast = validResults.map(r => ({
          nodeId: r.metrics.nodeId,
          metrics: r.metrics,
        }));
        websocketService.broadcastServerMetrics(metricsForBroadcast);
        console.log(`Server metrics collected: ${validResults.length}/${serverNodes.length} servers`);
      }
    } catch (error) {
      console.error('Error during server metrics collection:', error);
    }
  }

  /**
   * Perform monitoring check on all nodes
   */
  private async performMonitoringCheck(): Promise<void> {
    try {
      const allNodes = await db.select().from(nodes);

      if (allNodes.length === 0) {
        return;
      }

      const nodesToPing = allNodes.map(node => ({
        id: node.id,
        host: node.host,
        port: node.port ?? undefined,
      }));

      const pingResults = await pingService.pingMultiple(nodesToPing);

      // Update database with results
      for (const result of pingResults) {
        await db.update(nodes)
          .set({
            status: result.status,
            latency: result.latency ?? null,
            lastChecked: result.timestamp,
            updatedAt: result.timestamp,
          })
          .where(eq(nodes.id, result.nodeId));
      }

      // Process status changes for alerting
      await alertingService.processNodeStatusChanges(pingResults);

      // Write to InfluxDB time series database
      if (influxService.isReady()) {
        const influxData = pingResults.map(result => {
          const node = allNodes.find(n => n.id === result.nodeId);
          return {
            result,
            nodeName: node?.name || 'unknown',
            nodeType: node?.type || 'custom',
          };
        });
        await influxService.writePingResults(influxData);
      }

      // Broadcast results via WebSocket
      websocketService.broadcastPingResults(pingResults);

      console.log(`Monitoring check completed: ${pingResults.length} nodes checked`);
    } catch (error) {
      console.error('Error during monitoring check:', error);
    }
  }

  /**
   * Perform immediate check
   */
  async checkNow(): Promise<void> {
    console.log('Performing immediate monitoring check...');
    await this.performMonitoringCheck();
  }

  /**
   * Get current settings
   */
  getSettings(): MonitoringSettings {
    return { ...this.currentSettings };
  }
}

export const monitoringService = new MonitoringService();
