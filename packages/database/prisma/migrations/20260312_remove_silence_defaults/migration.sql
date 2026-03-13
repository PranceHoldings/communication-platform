-- Remove default values from all silence management settings
-- This allows scenarios to properly inherit organization default settings

-- Step 1: Remove default constraints
ALTER TABLE "scenarios" ALTER COLUMN "silence_timeout" DROP DEFAULT;
ALTER TABLE "scenarios" ALTER COLUMN "enable_silence_prompt" DROP DEFAULT;
ALTER TABLE "scenarios" ALTER COLUMN "show_silence_timer" DROP DEFAULT;
ALTER TABLE "scenarios" ALTER COLUMN "silence_threshold" DROP DEFAULT;
ALTER TABLE "scenarios" ALTER COLUMN "min_silence_duration" DROP DEFAULT;

-- Step 2: Update existing default values to null (so they use organization defaults)
-- Only update values that match the old defaults (these were auto-set, not user-chosen)
UPDATE "scenarios" SET "silence_timeout" = NULL WHERE "silence_timeout" = 10;
UPDATE "scenarios" SET "enable_silence_prompt" = NULL WHERE "enable_silence_prompt" = true;
UPDATE "scenarios" SET "show_silence_timer" = NULL WHERE "show_silence_timer" = false;
UPDATE "scenarios" SET "silence_threshold" = NULL WHERE "silence_threshold" = 0.05;
UPDATE "scenarios" SET "min_silence_duration" = NULL WHERE "min_silence_duration" = 500;

-- Note: This migration ensures that:
-- - All silence settings: null → uses organization default setting
-- - All silence settings: explicit value → user's explicit choice (overrides org default)
