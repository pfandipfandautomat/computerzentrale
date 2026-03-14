import { db } from '../database/db.js';
import { alertRules, events, nodes } from '../database/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { telegramService } from './telegramService.js';

export type EventType = 
  | 'node_offline'
  | 'node_online'
  | 'container_stopped'
  | 'container_started'
  | 'high_cpu'
  | 'high_memory'
  | 'high_disk';

export type Severity = 'info' | 'warning' | 'error' | 'critical';

interface AlertRule {
  id: string;
  eventType: string;
  enabled: number;
  nodeId: string | null;
  threshold: number | null;
  message: string | null;
}

interface EventData {
  eventType: EventType;
  nodeId?: string;
  nodeName?: string;
  message: string;
  details?: Record<string, any>;
  severity: Severity;
}

// Track previous node statuses to detect changes
const previousNodeStatuses: Map<string, string> = new Map();

class AlertingService {
  private rules: AlertRule[] = [];
  private initialized = false;

  /**
   * Initialize the alerting service
   */
  async initialize(): Promise<void> {
    await this.loadRules();
    await telegramService.loadConfig();
    this.initialized = true;
    console.log('[Alerting] Service initialized');
  }

  /**
   * Load alert rules from database
   */
  async loadRules(): Promise<void> {
    try {
      this.rules = await db.select().from(alertRules);
      console.log(`[Alerting] Loaded ${this.rules.length} alert rules`);
    } catch (error) {
      console.error('[Alerting] Failed to load rules:', error);
    }
  }

  /**
   * Reload rules (call after rule changes)
   */
  async reloadRules(): Promise<void> {
    await this.loadRules();
  }

  /**
   * Check if an event should trigger an alert
   */
  private shouldAlert(eventType: EventType, nodeId?: string): AlertRule | null {
    for (const rule of this.rules) {
      if (rule.enabled !== 1) continue;
      if (rule.eventType !== eventType) continue;
      
      // If rule is for a specific node, check if it matches
      if (rule.nodeId && rule.nodeId !== nodeId) continue;
      
      return rule;
    }
    return null;
  }

  /**
   * Log an event and optionally send an alert
   */
  async logEvent(data: EventData, nodeTelegramAlertsEnabled?: boolean): Promise<void> {
    const now = new Date().toISOString();
    const eventId = uuidv4();

    // Check if we should send an alert
    let shouldSendAlert = false;
    
    // For node online/offline events, check the node's telegramAlerts setting
    if (data.eventType === 'node_offline' || data.eventType === 'node_online') {
      shouldSendAlert = nodeTelegramAlertsEnabled === true && telegramService.isEnabled();
    } else {
      // For other events, use the rules system
      const matchingRule = this.shouldAlert(data.eventType, data.nodeId);
      shouldSendAlert = matchingRule !== null && telegramService.isEnabled();
    }

    let alertSent = false;

    if (shouldSendAlert) {
      // For node events, use default message; for rule-based events, check for custom message
      const title = this.getEventTitle(data.eventType);
      let message = data.message;
      
      if (data.eventType !== 'node_offline' && data.eventType !== 'node_online') {
        const matchingRule = this.shouldAlert(data.eventType, data.nodeId);
        message = matchingRule?.message || data.message;
      }

      const result = await telegramService.sendAlert(
        data.severity,
        title,
        message,
        data.details ? this.formatDetails(data.details) : undefined
      );

      alertSent = result.success;
      
      if (!result.success) {
        console.error('[Alerting] Failed to send alert:', result.error);
      }
    }

    // Log the event to database
    try {
      await db.insert(events).values({
        id: eventId,
        eventType: data.eventType,
        nodeId: data.nodeId || null,
        nodeName: data.nodeName || null,
        message: data.message,
        details: data.details ? JSON.stringify(data.details) : null,
        severity: data.severity,
        alertSent: alertSent ? 1 : 0,
        createdAt: now,
      });
    } catch (error) {
      console.error('[Alerting] Failed to log event:', error);
    }
  }

  /**
   * Get human-readable title for event type
   */
  private getEventTitle(eventType: EventType): string {
    const titles: Record<EventType, string> = {
      node_offline: 'Node Offline',
      node_online: 'Node Online',
      container_stopped: 'Container Stopped',
      container_started: 'Container Started',
      high_cpu: 'High CPU Usage',
      high_memory: 'High Memory Usage',
      high_disk: 'High Disk Usage',
    };
    return titles[eventType] || eventType;
  }

  /**
   * Format details for Telegram message
   */
  private formatDetails(details: Record<string, any>): Record<string, string> {
    const formatted: Record<string, string> = {};
    for (const [key, value] of Object.entries(details)) {
      formatted[key] = String(value);
    }
    return formatted;
  }

  /**
   * Process node status changes from monitoring
   * Call this after each monitoring check
   */
  async processNodeStatusChanges(
    results: Array<{ nodeId: string; status: string; latency?: number }>
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get node names for better messages
    const allNodes = await db.select().from(nodes);
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));

    for (const result of results) {
      const previousStatus = previousNodeStatuses.get(result.nodeId);
      const currentStatus = result.status;

      // Update tracked status
      previousNodeStatuses.set(result.nodeId, currentStatus);

      // Skip if no previous status (first check) or no change
      if (!previousStatus || previousStatus === currentStatus) {
        continue;
      }

      const node = nodeMap.get(result.nodeId);
      const nodeName = node?.name || 'Unknown Node';
      const telegramAlertsEnabled = node?.telegramAlerts === 1;

      // Node went offline
      if (previousStatus === 'online' && currentStatus === 'offline') {
        await this.logEvent({
          eventType: 'node_offline',
          nodeId: result.nodeId,
          nodeName,
          message: `${nodeName} is now offline`,
          details: {
            'Previous Status': previousStatus,
            'Current Status': currentStatus,
            'Host': node?.host || 'unknown',
          },
          severity: 'error',
        }, telegramAlertsEnabled);
      }

      // Node came online
      if (previousStatus === 'offline' && currentStatus === 'online') {
        await this.logEvent({
          eventType: 'node_online',
          nodeId: result.nodeId,
          nodeName,
          message: `${nodeName} is back online`,
          details: {
            'Previous Status': previousStatus,
            'Current Status': currentStatus,
            'Host': node?.host || 'unknown',
            'Latency': result.latency ? `${result.latency}ms` : 'N/A',
          },
          severity: 'info',
        }, telegramAlertsEnabled);
      }
    }
  }

  /**
   * Process container status changes
   */
  async processContainerChange(
    nodeId: string,
    nodeName: string,
    containerName: string,
    previousState: string,
    currentState: string
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (previousState === currentState) return;

    if (previousState === 'running' && currentState !== 'running') {
      await this.logEvent({
        eventType: 'container_stopped',
        nodeId,
        nodeName,
        message: `Container "${containerName}" stopped on ${nodeName}`,
        details: {
          'Container': containerName,
          'Previous State': previousState,
          'Current State': currentState,
        },
        severity: 'warning',
      });
    }

    if (previousState !== 'running' && currentState === 'running') {
      await this.logEvent({
        eventType: 'container_started',
        nodeId,
        nodeName,
        message: `Container "${containerName}" started on ${nodeName}`,
        details: {
          'Container': containerName,
          'Previous State': previousState,
          'Current State': currentState,
        },
        severity: 'info',
      });
    }
  }

  /**
   * Process high resource usage alerts
   */
  async processResourceAlert(
    nodeId: string,
    nodeName: string,
    resourceType: 'cpu' | 'memory' | 'disk',
    usage: number,
    threshold: number
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (usage < threshold) return;

    const eventType: EventType = `high_${resourceType}` as EventType;
    const resourceName = resourceType.toUpperCase();

    await this.logEvent({
      eventType,
      nodeId,
      nodeName,
      message: `${resourceName} usage on ${nodeName} is at ${usage.toFixed(1)}% (threshold: ${threshold}%)`,
      details: {
        'Resource': resourceName,
        'Usage': `${usage.toFixed(1)}%`,
        'Threshold': `${threshold}%`,
      },
      severity: 'warning',
    });
  }
}

export const alertingService = new AlertingService();
