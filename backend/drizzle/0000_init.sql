CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER,
  ssh_user TEXT DEFAULT 'root',
  type TEXT NOT NULL,
  tags TEXT,
  description TEXT,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  latency INTEGER,
  last_checked TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  label TEXT,
  source_handle TEXT,
  target_handle TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  ping_interval INTEGER NOT NULL DEFAULT 10,
  enabled INTEGER NOT NULL DEFAULT 1,
  ssh_key TEXT
);
