-- Migration: Add accessLevel field to RuntimeConfig
-- Date: 2026-03-21
-- Description: Add 5-level access control system to runtime configurations

-- Step 1: Create enum type for access levels
CREATE TYPE "RuntimeConfigAccessLevel" AS ENUM (
  'DEVELOPER_ONLY',
  'SUPER_ADMIN_READ_ONLY',
  'SUPER_ADMIN_READ_WRITE',
  'CLIENT_ADMIN_READ_WRITE',
  'CLIENT_ADMIN_READ_ONLY'
);

-- Step 2: Add access_level column with default value
ALTER TABLE "runtime_configs"
ADD COLUMN "access_level" "RuntimeConfigAccessLevel" NOT NULL DEFAULT 'SUPER_ADMIN_READ_WRITE';

-- Step 3: Create index on access_level
CREATE INDEX "runtime_configs_access_level_idx" ON "runtime_configs"("access_level");

-- Step 4: Update existing configurations with appropriate access levels
-- Level 1: SUPER_ADMIN_READ_ONLY (security-critical)
UPDATE "runtime_configs"
SET "access_level" = 'SUPER_ADMIN_READ_ONLY'
WHERE "key" IN (
  'BCRYPT_SALT_ROUNDS',
  'RATE_LIMIT_MAX_ATTEMPTS',
  'RATE_LIMIT_LOCKOUT_DURATION_MS'
);

-- Level 2: SUPER_ADMIN_READ_WRITE (system-wide parameters)
UPDATE "runtime_configs"
SET "access_level" = 'SUPER_ADMIN_READ_WRITE'
WHERE "key" IN (
  'MAX_RESULTS',
  'VIDEO_CHUNK_BATCH_SIZE',
  'ANALYSIS_BATCH_SIZE',
  'CLAUDE_TEMPERATURE',
  'CLAUDE_MAX_TOKENS',
  'MAX_AUTO_DETECT_LANGUAGES'
);

-- Level 3: CLIENT_ADMIN_READ_WRITE (safe UX optimization)
UPDATE "runtime_configs"
SET "access_level" = 'CLIENT_ADMIN_READ_WRITE'
WHERE "key" IN (
  'TTS_STABILITY',
  'TTS_SIMILARITY_BOOST',
  'SILENCE_THRESHOLD',
  'OPTIMAL_PAUSE_SEC',
  'AUDIO_WEIGHT',
  'CONTENT_WEIGHT',
  'DELIVERY_WEIGHT',
  'EMOTION_WEIGHT',
  'SCORE_THRESHOLD_EXCELLENT',
  'SCORE_THRESHOLD_GOOD',
  'SCORE_WEIGHT_COMMUNICATION',
  'SCORE_WEIGHT_PROBLEM_SOLVING',
  'SCORE_WEIGHT_TECHNICAL',
  'SCORE_WEIGHT_PRESENTATION'
);

-- Verification query (optional - for manual verification)
-- SELECT "key", "access_level", "category" FROM "runtime_configs" ORDER BY "access_level", "key";
