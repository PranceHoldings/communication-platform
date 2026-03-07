-- Migration: add_recording_video_fields
-- Date: 2026-03-07
-- Description: Add video processing fields to recordings table

-- CreateEnum (skip if already exists)
DO $$ BEGIN
 CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add columns
ALTER TABLE "recordings"
  ADD COLUMN IF NOT EXISTS "duration_sec" INTEGER,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "format" TEXT DEFAULT 'webm',
  ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processing_status" "ProcessingStatus" DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "resolution" TEXT DEFAULT '1280x720',
  ADD COLUMN IF NOT EXISTS "s3_key" TEXT,
  ADD COLUMN IF NOT EXISTS "video_chunks_count" INTEGER;

-- Migrate existing data: Extract s3_key from s3_url
UPDATE "recordings"
SET "s3_key" = regexp_replace("s3_url", '^https?://[^/]+/', '')
WHERE "s3_key" IS NULL;

-- Make s3_key NOT NULL if not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='recordings' AND column_name='s3_key' AND is_nullable='YES'
  ) THEN
    ALTER TABLE "recordings" ALTER COLUMN "s3_key" SET NOT NULL;
  END IF;
END $$;

-- Make processing_status NOT NULL if not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='recordings' AND column_name='processing_status' AND is_nullable='YES'
  ) THEN
    ALTER TABLE "recordings" ALTER COLUMN "processing_status" SET NOT NULL;
  END IF;
END $$;

-- CreateIndex (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename='recordings' AND indexname='recordings_processing_status_idx'
  ) THEN
    CREATE INDEX "recordings_processing_status_idx" ON "recordings"("processing_status");
  END IF;
END $$;
