import Database, { Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use environment variable for database path or default to local data directory
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/computerzentrale.db');

// Ensure data directory exists
const dataDir = dirname(dbPath);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database connection
const sqlite: DatabaseType = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

export { sqlite };
