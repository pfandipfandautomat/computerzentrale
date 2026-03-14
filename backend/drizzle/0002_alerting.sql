CREATE TABLE IF NOT EXISTS telegram_config (
  id TEXT PRIMARY KEY,
  bot_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  node_id TEXT,
  threshold REAL,
  message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  node_id TEXT,
  node_name TEXT,
  message TEXT NOT NULL,
  details TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  alert_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
