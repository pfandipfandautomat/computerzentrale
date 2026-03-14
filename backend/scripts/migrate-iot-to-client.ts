/**
 * One-time migration script
 * - Renames node type 'iot' to 'client'
 * - Removes 'server' tag from all nodes
 * 
 * Run with: npx tsx scripts/migrate-iot-to-client.ts
 */

import { sqlite } from '../src/database/db.js';

function main() {
  console.log('🔄 Running migration...\n');

  // 1. Update node type from 'iot' to 'client'
  const typeResult = sqlite.prepare(`
    UPDATE nodes SET type = 'client' WHERE type = 'iot'
  `).run();
  console.log(`✅ Updated ${typeResult.changes} node(s) from type 'iot' to 'client'`);

  // 2. Remove 'server' tag from all nodes
  // Get all nodes with tags containing 'server'
  const nodesWithServerTag = sqlite.prepare(`
    SELECT id, tags FROM nodes WHERE tags LIKE '%server%'
  `).all() as { id: string; tags: string }[];

  let tagsUpdated = 0;
  for (const node of nodesWithServerTag) {
    if (node.tags) {
      try {
        const tags = JSON.parse(node.tags) as string[];
        const filteredTags = tags.filter(tag => tag !== 'server');
        if (filteredTags.length !== tags.length) {
          sqlite.prepare(`
            UPDATE nodes SET tags = ? WHERE id = ?
          `).run(JSON.stringify(filteredTags), node.id);
          tagsUpdated++;
        }
      } catch (e) {
        console.warn(`Warning: Could not parse tags for node ${node.id}`);
      }
    }
  }
  console.log(`✅ Removed 'server' tag from ${tagsUpdated} node(s)`);

  console.log('\n✅ Migration complete!');
  
  sqlite.close();
}

main();
