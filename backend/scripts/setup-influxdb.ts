/**
 * InfluxDB Setup Script
 * 
 * This script sets up:
 * 1. Aggregated bucket for hourly data (infinite retention)
 * 2. Task to aggregate raw data into hourly averages
 * 
 * Run with: npx tsx scripts/setup-influxdb.ts
 */

import { InfluxDB, HttpError } from '@influxdata/influxdb-client';
import { BucketsAPI, TasksAPI } from '@influxdata/influxdb-client-apis';
import 'dotenv/config';

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'computerzentrale';
const RAW_BUCKET = process.env.INFLUXDB_BUCKET || 'ping_metrics';
const AGGREGATED_BUCKET = 'ping_metrics_aggregated';

async function main() {
  if (!INFLUXDB_TOKEN) {
    console.error('Error: INFLUXDB_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('🔧 Setting up InfluxDB...\n');
  console.log(`URL: ${INFLUXDB_URL}`);
  console.log(`Organization: ${INFLUXDB_ORG}`);
  console.log(`Raw bucket: ${RAW_BUCKET}`);
  console.log(`Aggregated bucket: ${AGGREGATED_BUCKET}\n`);

  const client = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
  const bucketsAPI = new BucketsAPI(client);
  const tasksAPI = new TasksAPI(client);

  try {
    // Get organization ID
    const orgsAPI = client.getOrgsApi();
    const orgs = await orgsAPI.getOrgs({ org: INFLUXDB_ORG });
    if (!orgs.orgs || orgs.orgs.length === 0) {
      console.error(`Error: Organization '${INFLUXDB_ORG}' not found`);
      process.exit(1);
    }
    const orgID = orgs.orgs[0].id!;
    console.log(`✅ Found organization: ${INFLUXDB_ORG} (${orgID})\n`);

    // Create aggregated bucket (if not exists)
    console.log('📦 Setting up aggregated bucket...');
    try {
      const existingBuckets = await bucketsAPI.getBuckets({ name: AGGREGATED_BUCKET, orgID });
      if (existingBuckets.buckets && existingBuckets.buckets.length > 0) {
        console.log(`   Bucket '${AGGREGATED_BUCKET}' already exists`);
      } else {
        await bucketsAPI.postBuckets({
          body: {
            name: AGGREGATED_BUCKET,
            orgID,
            retentionRules: [], // No retention = infinite
            description: 'Hourly aggregated ping metrics (infinite retention)',
          },
        });
        console.log(`   ✅ Created bucket '${AGGREGATED_BUCKET}' with infinite retention`);
      }
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 422) {
        console.log(`   Bucket '${AGGREGATED_BUCKET}' already exists`);
      } else {
        throw error;
      }
    }

    // Create aggregation task
    console.log('\n⏰ Setting up aggregation task...');
    const taskName = 'aggregate_ping_metrics_hourly';
    
    // Check if task exists
    const existingTasks = await tasksAPI.getTasks({ name: taskName, orgID });
    if (existingTasks.tasks && existingTasks.tasks.length > 0) {
      console.log(`   Task '${taskName}' already exists`);
      console.log(`   Task ID: ${existingTasks.tasks[0].id}`);
    } else {
      // Create the aggregation task
      const taskFlux = `
option task = {name: "${taskName}", every: 1h, offset: 5m}

from(bucket: "${RAW_BUCKET}")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "ping")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
  |> to(bucket: "${AGGREGATED_BUCKET}", org: "${INFLUXDB_ORG}")
`;

      const task = await tasksAPI.postTasks({
        body: {
          orgID,
          flux: taskFlux,
          status: 'active',
          description: 'Aggregates raw ping metrics into hourly averages',
        },
      });
      console.log(`   ✅ Created task '${taskName}'`);
      console.log(`   Task ID: ${task.id}`);
    }

    console.log('\n✅ InfluxDB setup complete!\n');
    console.log('Summary:');
    console.log(`  - Raw data bucket: ${RAW_BUCKET} (30 day retention)`);
    console.log(`  - Aggregated bucket: ${AGGREGATED_BUCKET} (infinite retention)`);
    console.log(`  - Aggregation task: ${taskName} (runs every hour)`);
    console.log('\nYou can access the InfluxDB UI at: http://localhost:8086');

  } catch (error) {
    console.error('Error setting up InfluxDB:', error);
    process.exit(1);
  }
}

main();
