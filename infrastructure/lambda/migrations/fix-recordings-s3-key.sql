-- Migration: fix-recordings-s3-key
-- Date: 2026-03-18
-- Description: Fix recordings table - ensure s3_key column exists and is populated
-- Issue: Production database missing s3_key column causing 500 errors

-- Step 1: Add column if not exists
ALTER TABLE "recordings"
ADD COLUMN IF NOT EXISTS "s3_key" TEXT;

-- Step 2: Populate from s3_url for any NULL values
UPDATE "recordings"
SET "s3_key" = regexp_replace("s3_url", '^https?://[^/]+/', '')
WHERE "s3_key" IS NULL;

-- Step 3: Make NOT NULL only if all values are populated
DO $$
BEGIN
  -- Check if column exists and is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='recordings' AND column_name='s3_key' AND is_nullable='YES'
  ) THEN
    -- Check if any NULL values exist
    IF NOT EXISTS (
      SELECT 1 FROM recordings WHERE s3_key IS NULL
    ) THEN
      ALTER TABLE "recordings" ALTER COLUMN "s3_key" SET NOT NULL;
    ELSE
      RAISE NOTICE 'Cannot set s3_key to NOT NULL: NULL values still exist';
    END IF;
  ELSE
    RAISE NOTICE 's3_key column already NOT NULL or does not exist';
  END IF;
END $$;
