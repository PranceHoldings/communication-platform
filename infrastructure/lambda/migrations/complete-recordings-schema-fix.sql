-- Migration: complete-recordings-schema-fix
-- Date: 2026-03-18
-- Description: Complete fix for recordings table - add ALL missing columns
-- Issue: Multiple columns from add-recording-video-fields migration not applied

-- Ensure ProcessingStatus enum exists
DO $$ BEGIN
  CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add all missing columns from add-recording-video-fields migration
ALTER TABLE "recordings"
ADD COLUMN IF NOT EXISTS "s3_key" TEXT,
ADD COLUMN IF NOT EXISTS "duration_sec" INTEGER,
ADD COLUMN IF NOT EXISTS "error_message" TEXT,
ADD COLUMN IF NOT EXISTS "format" TEXT DEFAULT 'webm',
ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "processing_status" "ProcessingStatus" DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "resolution" TEXT DEFAULT '1280x720',
ADD COLUMN IF NOT EXISTS "video_chunks_count" INTEGER;

-- Populate s3_key from s3_url for any NULL values
UPDATE "recordings"
SET "s3_key" = regexp_replace("s3_url", '^https?://[^/]+/', '')
WHERE "s3_key" IS NULL AND "s3_url" IS NOT NULL;

-- Make s3_key NOT NULL only if all values are populated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='recordings' AND column_name='s3_key' AND is_nullable='YES'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM recordings WHERE s3_key IS NULL
    ) THEN
      ALTER TABLE "recordings" ALTER COLUMN "s3_key" SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Make processing_status NOT NULL only if all values are populated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='recordings' AND column_name='processing_status' AND is_nullable='YES'
  ) THEN
    -- Set default value for any NULL
    UPDATE "recordings" SET "processing_status" = 'PENDING' WHERE "processing_status" IS NULL;

    IF NOT EXISTS (
      SELECT 1 FROM recordings WHERE processing_status IS NULL
    ) THEN
      ALTER TABLE "recordings" ALTER COLUMN "processing_status" SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Create index if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename='recordings' AND indexname='recordings_processing_status_idx'
  ) THEN
    CREATE INDEX "recordings_processing_status_idx" ON "recordings"("processing_status");
  END IF;
END $$;
