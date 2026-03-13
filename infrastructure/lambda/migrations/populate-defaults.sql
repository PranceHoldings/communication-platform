-- ===================================================
-- Populate Scenario Default Values
-- 作成日: 2026-03-11
-- 目的: 既存シナリオに無音管理デフォルト値を設定
-- ===================================================

-- デフォルト値を設定
UPDATE scenarios
SET
  silence_timeout = COALESCE(silence_timeout, 10),
  enable_silence_prompt = COALESCE(enable_silence_prompt, true),
  show_silence_timer = COALESCE(show_silence_timer, false),
  silence_threshold = COALESCE(silence_threshold, 0.05),
  min_silence_duration = COALESCE(min_silence_duration, 500)
WHERE
  silence_timeout IS NULL
  OR enable_silence_prompt IS NULL
  OR show_silence_timer IS NULL
  OR silence_threshold IS NULL
  OR min_silence_duration IS NULL;
