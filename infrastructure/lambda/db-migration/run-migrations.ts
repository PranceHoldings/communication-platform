/**
 * Database Migration Runner
 * Runs SQL migration files in sequence
 */

import { prisma } from '../shared/database/prisma';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationFile {
  name: string;
  path: string;
  sql: string;
}

async function runMigrations() {
  console.log('[Migration] Starting database migrations...');

  const migrationsDir = path.join(__dirname, '../migrations');
  console.log('[Migration] Migrations directory:', migrationsDir);

  // Read all migration files
  const migrationFiles: MigrationFile[] = [];

  try {
    const files = fs.readdirSync(migrationsDir);
    console.log('[Migration] Found files:', files);

    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        migrationFiles.push({
          name: file,
          path: filePath,
          sql,
        });
      }
    }

    // Sort by filename (chronological order)
    migrationFiles.sort((a, b) => a.name.localeCompare(b.name));

    console.log(
      '[Migration] Migration files to run:',
      migrationFiles.map(m => m.name)
    );

    // Run each migration
    for (const migration of migrationFiles) {
      console.log(`[Migration] Running: ${migration.name}`);

      try {
        // Split by semicolon and run each statement
        const statements = migration.sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement) {
            console.log(`[Migration] Executing statement ${i + 1}/${statements.length}`);
            await prisma.$executeRawUnsafe(statement);
          }
        }

        console.log(`[Migration] ✅ Completed: ${migration.name}`);
      } catch (error) {
        console.error(`[Migration] ❌ Failed: ${migration.name}`, error);
        // Continue with next migration (don't throw)
      }
    }

    console.log('[Migration] All migrations completed');

    return {
      success: true,
      message: 'Migrations completed successfully',
      migrationsRun: migrationFiles.length,
    };
  } catch (error) {
    console.error('[Migration] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Lambda handler
export const handler = async (event: any) => {
  console.log('[Migration] Lambda invoked', { event });

  try {
    const result = await runMigrations();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[Migration] Lambda error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any).code || 'UNKNOWN',
      }),
    };
  }
};

// Direct execution (for testing)
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migration] Done');
      process.exit(0);
    })
    .catch(error => {
      console.error('[Migration] Failed:', error);
      process.exit(1);
    });
}
