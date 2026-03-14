CREATE TABLE IF NOT EXISTS network_interfaces (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  address TEXT NOT NULL
);
