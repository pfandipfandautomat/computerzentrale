import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { telegramConfig, alertRules, events } from '../database/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { telegramService } from '../services/telegramService.js';

const router = Router();

// ============ Telegram Config ============

// Get Telegram configuration
router.get('/telegram', async (_req: Request, res: Response) => {
  try {
    const configs = await db.select().from(telegramConfig).limit(1);
    if (configs.length === 0) {
      res.json({ configured: false });
      return;
    }
    // Don't expose the full bot token for security
    const config = configs[0];
    res.json({
      configured: true,
      id: config.id,
      botTokenSet: !!config.botToken,
      botTokenPreview: config.botToken ? `${config.botToken.slice(0, 10)}...` : null,
      chatId: config.chatId,
      enabled: config.enabled === 1,
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('[Alerting] Failed to get telegram config:', error);
    res.status(500).json({ error: 'Failed to get telegram configuration' });
  }
});

// Save Telegram configuration
router.post('/telegram', async (req: Request, res: Response) => {
  try {
    const { botToken, chatId, enabled } = req.body;

    if (!botToken || !chatId) {
      res.status(400).json({ error: 'Bot token and chat ID are required' });
      return;
    }

    const now = new Date().toISOString();
    const existing = await db.select().from(telegramConfig).limit(1);

    if (existing.length > 0) {
      // Update existing config
      await db.update(telegramConfig)
        .set({
          botToken,
          chatId,
          enabled: enabled ? 1 : 0,
          updatedAt: now,
        })
        .where(eq(telegramConfig.id, existing[0].id));
    } else {
      // Create new config
      await db.insert(telegramConfig).values({
        id: uuidv4(),
        botToken,
        chatId,
        enabled: enabled !== false ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Reload telegram service config
    await telegramService.reloadConfig();

    res.json({ success: true });
  } catch (error) {
    console.error('[Alerting] Failed to save telegram config:', error);
    res.status(500).json({ error: 'Failed to save telegram configuration' });
  }
});

// Test Telegram connection
router.post('/telegram/test', async (req: Request, res: Response) => {
  try {
    let { botToken, chatId } = req.body;

    if (!chatId) {
      res.status(400).json({ error: 'Chat ID is required' });
      return;
    }

    // If using existing token, fetch it from database
    if (botToken === 'USE_EXISTING') {
      const configs = await db.select().from(telegramConfig).limit(1);
      if (configs.length === 0 || !configs[0].botToken) {
        res.status(400).json({ error: 'No existing bot token found' });
        return;
      }
      botToken = configs[0].botToken;
    }

    if (!botToken) {
      res.status(400).json({ error: 'Bot token is required' });
      return;
    }

    const result = await telegramService.testConnection(botToken, chatId);
    res.json(result);
  } catch (error) {
    console.error('[Alerting] Failed to test telegram:', error);
    res.status(500).json({ error: 'Failed to test telegram connection' });
  }
});

// ============ Alert Rules ============

// Get all alert rules
router.get('/rules', async (_req: Request, res: Response) => {
  try {
    const rules = await db.select().from(alertRules);
    res.json(rules.map(rule => ({
      ...rule,
      enabled: rule.enabled === 1,
    })));
  } catch (error) {
    console.error('[Alerting] Failed to get alert rules:', error);
    res.status(500).json({ error: 'Failed to get alert rules' });
  }
});

// Create alert rule
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const { eventType, enabled, nodeId, threshold, message } = req.body;

    if (!eventType) {
      res.status(400).json({ error: 'Event type is required' });
      return;
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    await db.insert(alertRules).values({
      id,
      eventType,
      enabled: enabled !== false ? 1 : 0,
      nodeId: nodeId || null,
      threshold: threshold || null,
      message: message || null,
      createdAt: now,
      updatedAt: now,
    });

    const [rule] = await db.select().from(alertRules).where(eq(alertRules.id, id));
    res.json({ ...rule, enabled: rule.enabled === 1 });
  } catch (error) {
    console.error('[Alerting] Failed to create alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

// Update alert rule
router.patch('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { eventType, enabled, nodeId, threshold, message } = req.body;

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (eventType !== undefined) updates.eventType = eventType;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    if (nodeId !== undefined) updates.nodeId = nodeId || null;
    if (threshold !== undefined) updates.threshold = threshold || null;
    if (message !== undefined) updates.message = message || null;

    await db.update(alertRules).set(updates).where(eq(alertRules.id, id));

    const [rule] = await db.select().from(alertRules).where(eq(alertRules.id, id));
    if (!rule) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    res.json({ ...rule, enabled: rule.enabled === 1 });
  } catch (error) {
    console.error('[Alerting] Failed to update alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

// Delete alert rule
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(alertRules).where(eq(alertRules.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('[Alerting] Failed to delete alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// ============ Events ============

// Get events (with pagination)
router.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const eventList = await db.select()
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(eventList.map(event => ({
      ...event,
      alertSent: event.alertSent === 1,
      details: event.details ? JSON.parse(event.details) : null,
    })));
  } catch (error) {
    console.error('[Alerting] Failed to get events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get events for a specific node
router.get('/events/node/:nodeId', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const eventList = await db.select()
      .from(events)
      .where(eq(events.nodeId, nodeId))
      .orderBy(desc(events.createdAt))
      .limit(limit);

    res.json(eventList.map(event => ({
      ...event,
      alertSent: event.alertSent === 1,
      details: event.details ? JSON.parse(event.details) : null,
    })));
  } catch (error) {
    console.error('[Alerting] Failed to get node events:', error);
    res.status(500).json({ error: 'Failed to get node events' });
  }
});

// Clear all events
router.delete('/events', async (_req: Request, res: Response) => {
  try {
    await db.delete(events);
    res.json({ success: true });
  } catch (error) {
    console.error('[Alerting] Failed to clear events:', error);
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

// Get event types (for UI dropdown)
router.get('/event-types', (_req: Request, res: Response) => {
  res.json([
    { id: 'node_offline', label: 'Node Offline', description: 'When a node goes offline', severity: 'error' },
    { id: 'node_online', label: 'Node Online', description: 'When a node comes back online', severity: 'info' },
    { id: 'container_stopped', label: 'Container Stopped', description: 'When a Docker container stops', severity: 'warning' },
    { id: 'container_started', label: 'Container Started', description: 'When a Docker container starts', severity: 'info' },
    { id: 'high_cpu', label: 'High CPU Usage', description: 'When CPU usage exceeds threshold', severity: 'warning' },
    { id: 'high_memory', label: 'High Memory Usage', description: 'When memory usage exceeds threshold', severity: 'warning' },
    { id: 'high_disk', label: 'High Disk Usage', description: 'When disk usage exceeds threshold', severity: 'warning' },
  ]);
});

export default router;
