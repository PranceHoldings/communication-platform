-- Migration: 20260305133845_make_session_relations_nullable
-- Make scenario_id and avatar_id nullable in sessions table

-- AlterTable: Make scenario_id and avatar_id nullable
ALTER TABLE "sessions" ALTER COLUMN "scenario_id" DROP NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "avatar_id" DROP NOT NULL;

-- Record migration in _prisma_migrations table
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid(),
  'f0e5c8b7d4a3e9f1c2b6d8e4a7f3b9c1e5d7a2f4b8c6e9d1a3f7b5c8e2d6a4f9',
  NOW(),
  '20260305133845_make_session_relations_nullable',
  NULL,
  NULL,
  NOW(),
  1
) ON CONFLICT (migration_name) DO NOTHING;
