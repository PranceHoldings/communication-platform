-- Migration: 00-fix-recordings-columns (Priority fix)
-- Date: 2026-03-18
-- Description: Add missing columns to recordings table - SIMPLIFIED VERSION
-- Note: Uses only simple SQL statements (no DO blocks) for compatibility

-- Step 1: Create ProcessingStatus enum (ignore if already exists)
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');

-- Step 2: Add all missing columns
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "duration_sec" INTEGER;
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "format" TEXT DEFAULT 'webm';
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3);
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "processing_status" "ProcessingStatus" DEFAULT 'PENDING';
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "resolution" TEXT DEFAULT '1280x720';
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "video_chunks_count" INTEGER;

-- Step 3: Create index if not exists
CREATE INDEX IF NOT EXISTS "recordings_processing_status_idx" ON "recordings"("processing_status");
