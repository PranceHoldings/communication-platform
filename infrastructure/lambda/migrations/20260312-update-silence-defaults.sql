-- Migration: Update silence management default values
-- Date: 2026-03-12
-- Description: Update existing scenarios with default values for silenceThreshold and minSilenceDuration

-- Update NULL values to new default (0.12 for threshold, 500ms for duration)
UPDATE "scenarios"
SET
  "silence_threshold" = 0.12
WHERE "silence_threshold" IS NULL;

UPDATE "scenarios"
SET
  "min_silence_duration" = 500
WHERE "min_silence_duration" IS NULL;

-- Add comments
COMMENT ON COLUMN "scenarios"."silence_threshold" IS 'Audio level threshold (0.0-1.0) to detect speech vs silence. Default: 0.12 (12%) to avoid ambient noise ~10%';
COMMENT ON COLUMN "scenarios"."min_silence_duration" IS 'Minimum silence duration in milliseconds to trigger speech_end. Default: 500ms';
