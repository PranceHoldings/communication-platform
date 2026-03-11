-- AlterTable: scenarios テーブルに無音時間管理フィールドを追加
-- Created: 2026-03-11
-- Purpose: Add silence management fields for AI-driven conversation prompts

ALTER TABLE "scenarios"
ADD COLUMN "initial_greeting" TEXT,
ADD COLUMN "silence_timeout" INTEGER DEFAULT 10,
ADD COLUMN "enable_silence_prompt" BOOLEAN DEFAULT true,
ADD COLUMN "show_silence_timer" BOOLEAN DEFAULT false,
ADD COLUMN "silence_threshold" DOUBLE PRECISION DEFAULT 0.05,
ADD COLUMN "min_silence_duration" INTEGER DEFAULT 500;

-- Add comments for documentation
COMMENT ON COLUMN "scenarios"."initial_greeting" IS 'AI initial greeting text displayed at session start';
COMMENT ON COLUMN "scenarios"."silence_timeout" IS 'Silence timeout in seconds before prompting user';
COMMENT ON COLUMN "scenarios"."enable_silence_prompt" IS 'Enable/disable silence prompt feature';
COMMENT ON COLUMN "scenarios"."show_silence_timer" IS 'Show silence timer in UI';
COMMENT ON COLUMN "scenarios"."silence_threshold" IS 'Volume threshold for silence detection (0.01-0.2)';
COMMENT ON COLUMN "scenarios"."min_silence_duration" IS 'Minimum silence duration in milliseconds';
