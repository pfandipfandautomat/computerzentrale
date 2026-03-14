import type { Request, Response } from 'express';
import { db } from '../database/db.js';
import { settings, nodes } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { monitoringService } from '../services/monitoringService.js';
import { pingService } from '../services/pingService.js';
import { encryptionService } from '../services/encryptionService.js';
import type { MonitoringSettings } from '../types/index.js';

export class MonitoringController {
  /**
   * Get monitoring settings
   */
  async getSettings(_req: Request, res: Response): Promise<void> {
    try {
      const result = await db.select().from(settings).where(eq(settings.id, 'default')).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Settings not found' });
        return;
      }

      const dbSettings = result[0];
      const monitoringSettings: MonitoringSettings = {
        pingInterval: dbSettings.pingInterval,
        enabled: dbSettings.enabled === 1,
        sshKey: dbSettings.sshKey ? '********' : undefined, // Masked for security
      };

      res.json(monitoringSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  /**
   * Update monitoring settings
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { pingInterval, enabled, sshKey } = req.body;

      const updateData: any = {};

      if (pingInterval !== undefined) {
        if (typeof pingInterval !== 'number' || pingInterval < 10) {
          res.status(400).json({ error: 'pingInterval must be a number >= 10' });
          return;
        }
        updateData.pingInterval = pingInterval;
      }

      if (enabled !== undefined) {
        if (typeof enabled !== 'boolean') {
          res.status(400).json({ error: 'enabled must be a boolean' });
          return;
        }
        updateData.enabled = enabled ? 1 : 0;
      }

      if (sshKey !== undefined) {
        if (sshKey) {
          // Encrypt the SSH key before storing
          try {
            updateData.sshKey = encryptionService.encrypt(sshKey);
          } catch (error) {
            res.status(500).json({ error: 'Encryption not configured. Set ENCRYPTION_SECRET environment variable.' });
            return;
          }
        } else {
          // Clear the key
          updateData.sshKey = null;
        }
      }

      await db.update(settings).set(updateData).where(eq(settings.id, 'default'));

      // Restart monitoring service with new settings
      await monitoringService.restart();

      const updated = await db.select().from(settings).where(eq(settings.id, 'default')).limit(1);
      const updatedSettings = updated[0];

      const monitoringSettings: MonitoringSettings = {
        pingInterval: updatedSettings.pingInterval,
        enabled: updatedSettings.enabled === 1,
        sshKey: updatedSettings.sshKey ? '********' : undefined, // Masked for security
      };

      res.json(monitoringSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  /**
   * Trigger immediate monitoring check
   */
  async checkNow(_req: Request, res: Response): Promise<void> {
    try {
      await monitoringService.checkNow();
      res.json({ message: 'Monitoring check triggered successfully' });
    } catch (error) {
      console.error('Error triggering monitoring check:', error);
      res.status(500).json({ error: 'Failed to trigger monitoring check' });
    }
  }

  /**
   * Ping a specific node
   */
  async pingNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

      if (result.length === 0) {
        res.status(404).json({ error: 'Node not found' });
        return;
      }

      const node = result[0];
      const pingResult = await pingService.pingHost(node.id, node.host, node.port ?? undefined);

      // Update node with ping result
      await db.update(nodes)
        .set({
          status: pingResult.status,
          latency: pingResult.latency ?? null,
          lastChecked: pingResult.timestamp,
          updatedAt: pingResult.timestamp,
        })
        .where(eq(nodes.id, id));

      res.json(pingResult);
    } catch (error) {
      console.error('Error pinging node:', error);
      res.status(500).json({ error: 'Failed to ping node' });
    }
  }

  /**
   * Check if SSH key is configured
   */
  async hasSSHKey(_req: Request, res: Response): Promise<void> {
    try {
      const result = await db.select().from(settings).where(eq(settings.id, 'default')).limit(1);
      const hasKey = result.length > 0 && !!result[0].sshKey;
      res.json({ hasSSHKey: hasKey });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check SSH key status' });
    }
  }

  /**
   * Get monitoring status
   */
  async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const settings = monitoringService.getSettings();
      const allNodes = await db.select().from(nodes);

      const onlineCount = allNodes.filter(n => n.status === 'online').length;
      const offlineCount = allNodes.filter(n => n.status === 'offline').length;
      const unknownCount = allNodes.filter(n => n.status === 'unknown').length;

      res.json({
        enabled: settings.enabled,
        pingInterval: settings.pingInterval,
        totalNodes: allNodes.length,
        onlineNodes: onlineCount,
        offlineNodes: offlineCount,
        unknownNodes: unknownCount,
      });
    } catch (error) {
      console.error('Error fetching monitoring status:', error);
      res.status(500).json({ error: 'Failed to fetch monitoring status' });
    }
  }

  /**
   * Get decrypted SSH key (internal use only - not exposed via API)
   */
  async getDecryptedSSHKey(): Promise<string | null> {
    try {
      const result = await db.select().from(settings).where(eq(settings.id, 'default')).limit(1);
      
      if (result.length === 0 || !result[0].sshKey) {
        return null;
      }
      
      return encryptionService.decrypt(result[0].sshKey);
    } catch (error) {
      console.error('Error decrypting SSH key:', error);
      return null;
    }
  }
}

export const monitoringController = new MonitoringController();
