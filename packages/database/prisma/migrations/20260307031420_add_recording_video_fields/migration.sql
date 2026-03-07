/*
  Warnings:

  - Added the required column `s3_key` to the `recordings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');

-- AlterTable: Add columns with nullable first, then set NOT NULL after data migration
ALTER TABLE "recordings" ADD COLUMN     "duration_sec" INTEGER,
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "format" TEXT DEFAULT 'webm',
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "resolution" TEXT DEFAULT '1280x720',
ADD COLUMN     "s3_key" TEXT,
ADD COLUMN     "video_chunks_count" INTEGER;

-- Migrate existing data: Extract s3_key from s3_url
-- Format: https://bucket-name.s3.region.amazonaws.com/key/path → key/path
UPDATE "recordings"
SET "s3_key" = regexp_replace("s3_url", '^https?://[^/]+/', '')
WHERE "s3_key" IS NULL;

-- Now make s3_key NOT NULL
ALTER TABLE "recordings" ALTER COLUMN "s3_key" SET NOT NULL;

-- CreateIndex
CREATE INDEX "recordings_processing_status_idx" ON "recordings"("processing_status");
