import { Client } from 'pg';

/**
 * Manual migration script to apply nullable session relations
 * This runs the SQL from migration: 20260305133845_make_session_relations_nullable
 */

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');
    console.log('Starting migration...');

    // Step 1: Drop existing foreign key constraints
    console.log('Step 1: Dropping foreign key constraints...');
    await client.query(`
      ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_avatar_id_fkey";
    `);
    await client.query(`
      ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_scenario_id_fkey";
    `);

    // Step 2: Make columns nullable
    console.log('Step 2: Making columns nullable...');
    await client.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "scenario_id" DROP NOT NULL,
      ALTER COLUMN "avatar_id" DROP NOT NULL;
    `);

    // Step 3: Add foreign keys with SET NULL
    console.log('Step 3: Adding foreign keys with ON DELETE SET NULL...');
    await client.query(`
      ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_scenario_id_fkey"
      FOREIGN KEY ("scenario_id")
      REFERENCES "scenarios"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
    `);
    await client.query(`
      ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_avatar_id_fkey"
      FOREIGN KEY ("avatar_id")
      REFERENCES "avatars"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
    `);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
