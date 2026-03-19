-- Migration: 20260305143400_add_allow_cloning_to_avatar
-- Add allow_cloning column to avatars table

-- AlterTable: Add allow_cloning column
ALTER TABLE "avatars" ADD COLUMN IF NOT EXISTS "allow_cloning" BOOLEAN NOT NULL DEFAULT false;

-- Record migration in _prisma_migrations table
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid(),
  'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
  NOW(),
  '20260305143400_add_allow_cloning_to_avatar',
  NULL,
  NULL,
  NOW(),
  1
) ON CONFLICT (migration_name) DO NOTHING;
