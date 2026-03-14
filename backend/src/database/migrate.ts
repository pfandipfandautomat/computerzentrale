import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(closeConnection = false) {
  try {
    console.log('Running migrations...');
    
    const migrationsFolder = join(__dirname, '../../drizzle');
    migrate(db, { migrationsFolder });
    
    console.log('Migrations completed successfully!');
    
    // Initialize default settings if not exists
    const settingsResult = sqlite.prepare('SELECT * FROM settings WHERE id = ?').get('default');
    
    if (!settingsResult) {
      console.log('Initializing default settings...');
      sqlite.prepare(`
        INSERT INTO settings (id, ping_interval, enabled)
        VALUES (?, ?, ?)
      `).run('default', 10, 1);
      console.log('Default settings created.');
    }
    
    if (closeConnection) {
      sqlite.close();
    }
    
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    if (closeConnection) {
      sqlite.close();
    }
    throw error;
  }
}

// Run as standalone script
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runMigrations(true)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
