import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  host: text('host').notNull(),
  port: integer('port'),
  sshUser: text('ssh_user').default('root'),
  type: text('type').notNull(),
  tags: text('tags'), // JSON array of tags, e.g., '["docker", "wireguard"]'
  description: text('description'),
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),
  status: text('status').notNull().default('unknown'),
  latency: integer('latency'),
  lastChecked: text('last_checked'),
  telegramAlerts: integer('telegram_alerts').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const edges = sqliteTable('edges', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  target: text('target').notNull(),
  label: text('label'),
  sourceHandle: text('source_handle'),
  targetHandle: text('target_handle'),
  createdAt: text('created_at').notNull(),
});

export const networkInterfaces = sqliteTable('network_interfaces', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  address: text('address').notNull(),
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  pingInterval: integer('ping_interval').notNull().default(10),
  enabled: integer('enabled').notNull().default(1),
  sshKey: text('ssh_key'),
});

// Telegram configuration for alerting
export const telegramConfig = sqliteTable('telegram_config', {
  id: text('id').primaryKey(),
  botToken: text('bot_token').notNull(),
  chatId: text('chat_id').notNull(),
  enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Event types that can trigger alerts
export const alertRules = sqliteTable('alert_rules', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(), // 'node_offline', 'node_online', 'container_stopped', 'container_started', 'high_cpu', 'high_memory', 'high_disk'
  enabled: integer('enabled').notNull().default(1),
  nodeId: text('node_id'), // Optional: specific node, null means all nodes
  threshold: real('threshold'), // Optional: for metrics-based alerts (e.g., CPU > 90%)
  message: text('message'), // Custom message template
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Event log - stores all events that occurred
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  nodeId: text('node_id'),
  nodeName: text('node_name'),
  message: text('message').notNull(),
  details: text('details'), // JSON string with additional details
  severity: text('severity').notNull().default('info'), // 'info', 'warning', 'error', 'critical'
  alertSent: integer('alert_sent').notNull().default(0),
  createdAt: text('created_at').notNull(),
});
