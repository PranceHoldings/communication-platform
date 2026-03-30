-- Migration: 20260307031420_add_recording_video_fields
-- Add video-related fields to recordings table

-- CreateEnum: ProcessingStatus
DO $$ BEGIN
  CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add columns to recordings
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "duration_sec" INTEGER;
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "format" TEXT DEFAULT 'webm';
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3);
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "processing_status" "ProcessingStatus" DEFAULT 'PENDING';
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "resolution" TEXT DEFAULT '1280x720';
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "video_chunks_count" INTEGER;

-- Migrate s3_key if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recordings' AND column_name = 's3_key'
  ) THEN
    ALTER TABLE "recordings" ADD COLUMN "s3_key" TEXT;
    UPDATE "recordings" SET "s3_key" = regexp_replace("s3_url", '^https?://[^/]+/', '') WHERE "s3_key" IS NULL AND "s3_url" IS NOT NULL;
  END IF;
END $$;

-- Ensure processing_status has values before setting NOT NULL
UPDATE "recordings" SET "processing_status" = 'PENDING' WHERE "processing_status" IS NULL;

-- Set processing_status NOT NULL
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM recordings WHERE processing_status IS NULL) THEN
    ALTER TABLE "recordings" ALTER COLUMN "processing_status" SET NOT NULL;
  END IF;
END $$;

-- Make s3_key NOT NULL if no NULL values exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM recordings WHERE s3_key IS NULL) THEN
    ALTER TABLE "recordings" ALTER COLUMN "s3_key" SET NOT NULL;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recordings_processing_status_idx" ON "recordings"("processing_status");

-- Record migration in _prisma_migrations table
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid(),
  'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3',
  NOW(),
  '20260307031420_add_recording_video_fields',
  NULL,
  NULL,
  NOW(),
  1
) ON CONFLICT (migration_name) DO NOTHING;
