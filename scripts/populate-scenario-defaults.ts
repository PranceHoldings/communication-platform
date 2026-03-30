#!/usr/bin/env tsx
/**
 * Populate Silence Management Default Values for Existing Scenarios
 *
 * Problem: Week 1 migration added columns with DEFAULT values, but PostgreSQL
 * only applies defaults to NEW rows, not existing rows. Existing scenarios
 * have NULL values for silence management fields.
 *
 * Solution: This script updates all existing scenarios to populate the default
 * values that should have been set during migration.
 *
 * Usage:
 *   npm run db:populate-defaults
 *   # or directly:
 *   npx tsx scripts/populate-scenario-defaults.ts
 *
 * Safety: Idempotent - safe to run multiple times. Only updates NULL values.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '../packages/database/node_modules/.prisma/client';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const prisma = new PrismaClient();

// Default values from schema and migration
const DEFAULTS = {
  silenceTimeout: 10,
  enableSilencePrompt: true,
  showSilenceTimer: false,
  silenceThreshold: 0.05,
  minSilenceDuration: 500,
  // initialGreeting is intentionally NULL - it's scenario-specific
};

async function main() {
  console.log('[populate-defaults] Starting...');
  console.log('[populate-defaults] Connecting to database...');

  try {
    // Find all scenarios with NULL silence management fields
    const scenarios = await prisma.scenario.findMany({
      where: {
        OR: [
          { silenceTimeout: null },
          { enableSilencePrompt: null },
          { showSilenceTimer: null },
          { silenceThreshold: null },
          { minSilenceDuration: null },
        ],
      },
      select: {
        id: true,
        title: true,
        silenceTimeout: true,
        enableSilencePrompt: true,
        showSilenceTimer: true,
        silenceThreshold: true,
        minSilenceDuration: true,
      },
    });

    if (scenarios.length === 0) {
      console.log('[populate-defaults] ✅ No scenarios need updating. All fields are populated.');
      return;
    }

    console.log(`[populate-defaults] Found ${scenarios.length} scenarios with NULL values:`);
    scenarios.forEach((s, idx) => {
      console.log(`  ${idx + 1}. "${s.title}" (${s.id})`);
      console.log(`     - silenceTimeout: ${s.silenceTimeout ?? 'NULL'}`);
      console.log(`     - enableSilencePrompt: ${s.enableSilencePrompt ?? 'NULL'}`);
      console.log(`     - showSilenceTimer: ${s.showSilenceTimer ?? 'NULL'}`);
      console.log(`     - silenceThreshold: ${s.silenceThreshold ?? 'NULL'}`);
      console.log(`     - minSilenceDuration: ${s.minSilenceDuration ?? 'NULL'}`);
    });

    console.log('\n[populate-defaults] Updating scenarios...');

    // Update each scenario
    let successCount = 0;
    let errorCount = 0;

    for (const scenario of scenarios) {
      try {
        // Build update data - only update NULL fields
        const updateData: any = {};
        if (scenario.silenceTimeout === null) {
          updateData.silenceTimeout = DEFAULTS.silenceTimeout;
        }
        if (scenario.enableSilencePrompt === null) {
          updateData.enableSilencePrompt = DEFAULTS.enableSilencePrompt;
        }
        if (scenario.showSilenceTimer === null) {
          updateData.showSilenceTimer = DEFAULTS.showSilenceTimer;
        }
        if (scenario.silenceThreshold === null) {
          updateData.silenceThreshold = DEFAULTS.silenceThreshold;
        }
        if (scenario.minSilenceDuration === null) {
          updateData.minSilenceDuration = DEFAULTS.minSilenceDuration;
        }

        if (Object.keys(updateData).length === 0) {
          console.log(`  ⏭️  Skipping "${scenario.title}" - no NULL values`);
          continue;
        }

        await prisma.scenario.update({
          where: { id: scenario.id },
          data: updateData,
        });

        console.log(`  ✅ Updated "${scenario.title}" (${Object.keys(updateData).length} fields)`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to update "${scenario.title}":`, error);
        errorCount++;
      }
    }

    console.log('\n[populate-defaults] ========================================');
    console.log(`[populate-defaults] ✅ Successfully updated: ${successCount} scenarios`);
    if (errorCount > 0) {
      console.log(`[populate-defaults] ❌ Failed to update: ${errorCount} scenarios`);
    }
    console.log('[populate-defaults] ========================================');
  } catch (error) {
    console.error('[populate-defaults] ❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('[populate-defaults] Done.');
    process.exit(0);
  })
  .catch(error => {
    console.error('[populate-defaults] Uncaught error:', error);
    process.exit(1);
  });
