-- Seed Runtime Configurations
-- Initial data for runtime_configs table

-- ==================================================
-- SECURITY (SUPER_ADMIN_READ_ONLY)
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('BCRYPT_SALT_ROUNDS', '10', 'NUMBER', 'SECURITY', 'SUPER_ADMIN_READ_ONLY', '10', 8, 15, 'BCrypt password hashing salt rounds', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('RATE_LIMIT_MAX_ATTEMPTS', '5', 'NUMBER', 'SECURITY', 'SUPER_ADMIN_READ_ONLY', '5', 1, 100, 'Maximum rate limit attempts before lockout', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('RATE_LIMIT_LOCKOUT_DURATION_MS', '900000', 'NUMBER', 'SECURITY', 'SUPER_ADMIN_READ_ONLY', '900000', 60000, 3600000, 'Rate limit lockout duration in milliseconds (15 minutes)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- ==================================================
-- QUERY_PROCESSING (SUPER_ADMIN_READ_WRITE)
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('MAX_RESULTS', '1000', 'NUMBER', 'QUERY_PROCESSING', 'SUPER_ADMIN_READ_WRITE', '1000', 1, 10000, 'Maximum number of query results', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('VIDEO_CHUNK_BATCH_SIZE', '5', 'NUMBER', 'QUERY_PROCESSING', 'SUPER_ADMIN_READ_WRITE', '5', 1, 100, 'Video chunk batch processing size', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('ANALYSIS_BATCH_SIZE', '10', 'NUMBER', 'QUERY_PROCESSING', 'SUPER_ADMIN_READ_WRITE', '10', 1, 100, 'Analysis batch processing size', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- ==================================================
-- AI_PROCESSING (SUPER_ADMIN_READ_WRITE)
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('CLAUDE_TEMPERATURE', '0.7', 'NUMBER', 'AI_PROCESSING', 'SUPER_ADMIN_READ_WRITE', '0.7', 0.0, 1.0, 'Claude AI temperature parameter (creativity vs consistency)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('CLAUDE_MAX_TOKENS', '1024', 'NUMBER', 'AI_PROCESSING', 'SUPER_ADMIN_READ_WRITE', '1024', 256, 4096, 'Maximum tokens for Claude AI response', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('MAX_AUTO_DETECT_LANGUAGES', '3', 'NUMBER', 'AI_PROCESSING', 'SUPER_ADMIN_READ_WRITE', '3', 1, 10, 'Maximum number of auto-detect languages', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- ==================================================
-- AUDIO_PROCESSING (CLIENT_ADMIN_READ_WRITE)
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('TTS_STABILITY', '0.5', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '0.5', 0.3, 1.0, 'TTS stability parameter (minimum 0.3 for audio stability)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('TTS_SIMILARITY_BOOST', '0.75', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '0.75', 0.5, 1.0, 'TTS similarity boost parameter (minimum 0.5 for voice quality)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SILENCE_THRESHOLD', '0.15', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '0.15', 0.0, 0.3, 'Silence detection threshold (maximum 0.3 to avoid missing speech)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('OPTIMAL_PAUSE_SEC', '2.0', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '2.0', 1.0, 5.0, 'Optimal pause duration in seconds', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- ==================================================
-- SCORE_CALCULATION (CLIENT_ADMIN_READ_WRITE)
-- ==================================================

-- Score component weights (must sum to 1.0)
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('AUDIO_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Audio quality weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('CONTENT_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Content quality weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('DELIVERY_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Delivery quality weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('EMOTION_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Emotion analysis weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- Score category weights (must sum to 1.0)
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SCORE_WEIGHT_COMMUNICATION', '0.3', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.3', 0.0, 1.0, 'Communication skill weight (must sum to 1.0 with other category weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SCORE_WEIGHT_PROBLEM_SOLVING', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Problem solving weight (must sum to 1.0 with other category weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SCORE_WEIGHT_TECHNICAL', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Technical skill weight (must sum to 1.0 with other category weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SCORE_WEIGHT_PRESENTATION', '0.2', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.2', 0.0, 1.0, 'Presentation skill weight (must sum to 1.0 with other category weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- Score thresholds
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SCORE_THRESHOLD_GOOD', '70', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '70', 0, 100, 'Threshold for GOOD score (must be less than EXCELLENT)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SCORE_THRESHOLD_EXCELLENT', '85', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '85', 0, 100, 'Threshold for EXCELLENT score (must be greater than GOOD)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- ==================================================
-- AUDIO_PROCESSING - Missing key (DEFAULT_STT_CONFIDENCE)
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('DEFAULT_STT_CONFIDENCE', '0.95', 'NUMBER', 'AUDIO_PROCESSING', 'SUPER_ADMIN_READ_ONLY', '0.95', 0.0, 1.0, 'Default STT confidence threshold when not provided by speech service', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- ==================================================
-- SCORE_CALCULATION - Preset weights (5 presets × 4 components = 20 keys)
-- Preset names MUST match ScoringPreset type in packages/shared/src/types/index.ts:
--   'default' | 'interview_practice' | 'language_learning' | 'presentation' | 'custom'
-- DB key pattern: SCORE_PRESET_{PRESET_UPPERCASE}_{COMPONENT}
-- Values sourced from SCORING_PRESETS in infrastructure/lambda/shared/analysis/score-calculator.ts
-- ==================================================

-- default preset (emotion=0.35, audio=0.35, content=0.2, delivery=0.1)
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_DEFAULT_EMOTION', '0.35', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.35', 0.0, 1.0, 'Default preset: emotion weight (sum of 4 components must equal 1.0)', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_DEFAULT_AUDIO', '0.35', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.35', 0.0, 1.0, 'Default preset: audio weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_DEFAULT_CONTENT', '0.2', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.2', 0.0, 1.0, 'Default preset: content weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_DEFAULT_DELIVERY', '0.1', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.1', 0.0, 1.0, 'Default preset: delivery weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

-- interview_practice preset (emotion=0.4, audio=0.3, content=0.2, delivery=0.1)
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_INTERVIEW_PRACTICE_EMOTION', '0.4', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.4', 0.0, 1.0, 'Interview practice preset: emotion weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_INTERVIEW_PRACTICE_AUDIO', '0.3', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.3', 0.0, 1.0, 'Interview practice preset: audio weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_INTERVIEW_PRACTICE_CONTENT', '0.2', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.2', 0.0, 1.0, 'Interview practice preset: content weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_INTERVIEW_PRACTICE_DELIVERY', '0.1', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.1', 0.0, 1.0, 'Interview practice preset: delivery weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

-- language_learning preset (emotion=0.15, audio=0.5, content=0.25, delivery=0.1)
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_LANGUAGE_LEARNING_EMOTION', '0.15', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.15', 0.0, 1.0, 'Language learning preset: emotion weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_LANGUAGE_LEARNING_AUDIO', '0.5', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.5', 0.0, 1.0, 'Language learning preset: audio weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_LANGUAGE_LEARNING_CONTENT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Language learning preset: content weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_LANGUAGE_LEARNING_DELIVERY', '0.1', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.1', 0.0, 1.0, 'Language learning preset: delivery weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

-- presentation preset (emotion=0.3, audio=0.3, content=0.3, delivery=0.1)
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_PRESENTATION_EMOTION', '0.3', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.3', 0.0, 1.0, 'Presentation preset: emotion weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_PRESENTATION_AUDIO', '0.3', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.3', 0.0, 1.0, 'Presentation preset: audio weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_PRESENTATION_CONTENT', '0.3', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.3', 0.0, 1.0, 'Presentation preset: content weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_PRESENTATION_DELIVERY', '0.1', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.1', 0.0, 1.0, 'Presentation preset: delivery weight', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

-- custom preset (emotion=0.35, audio=0.35, content=0.2, delivery=0.1 - same as default, user-overridable)
INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_CUSTOM_EMOTION', '0.35', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.35', 0.0, 1.0, 'Custom preset: emotion weight (user-configurable)', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_CUSTOM_AUDIO', '0.35', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.35', 0.0, 1.0, 'Custom preset: audio weight (user-configurable)', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_CUSTOM_CONTENT', '0.2', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.2', 0.0, 1.0, 'Custom preset: content weight (user-configurable)', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES ('SCORE_PRESET_CUSTOM_DELIVERY', '0.1', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.1', 0.0, 1.0, 'Custom preset: delivery weight (user-configurable)', NOW())
ON CONFLICT (key) DO UPDATE SET access_level = EXCLUDED.access_level, description = EXCLUDED.description;

-- ==================================================
-- SYSTEM (SUPER_ADMIN_READ_WRITE) - WebSocket session behavior
-- WebSocket ACK timeout and retry settings.
-- These are sent to the frontend via the 'authenticated' WebSocket message
-- so the client uses whatever the admin sets, without redeploying frontend code.
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('WS_ACK_TIMEOUT_MS', '5000', 'NUMBER', 'SYSTEM', 'SUPER_ADMIN_READ_WRITE', '5000', 1000, 30000, 'WebSocket chunk ACK timeout per retry attempt (ms)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('WS_MAX_RETRIES', '6', 'NUMBER', 'SYSTEM', 'SUPER_ADMIN_READ_WRITE', '6', 1, 20, 'Maximum WebSocket chunk ACK retries before declaring failure (timeout = WS_ACK_TIMEOUT_MS × WS_MAX_RETRIES)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description;

-- ==================================================
-- Verification
-- ==================================================
SELECT 'Total records:', COUNT(*) FROM runtime_configs;
SELECT 'By category:', category, COUNT(*) FROM runtime_configs GROUP BY category ORDER BY category;
SELECT 'Keys missing from seed (should be 0):', COUNT(*) FROM runtime_configs WHERE key NOT IN (
  'BCRYPT_SALT_ROUNDS','RATE_LIMIT_MAX_ATTEMPTS','RATE_LIMIT_LOCKOUT_DURATION_MS',
  'MAX_RESULTS','VIDEO_CHUNK_BATCH_SIZE','ANALYSIS_BATCH_SIZE',
  'CLAUDE_TEMPERATURE','CLAUDE_MAX_TOKENS','MAX_AUTO_DETECT_LANGUAGES',
  'TTS_STABILITY','TTS_SIMILARITY_BOOST','SILENCE_THRESHOLD','OPTIMAL_PAUSE_SEC','DEFAULT_STT_CONFIDENCE',
  'AUDIO_WEIGHT','CONTENT_WEIGHT','DELIVERY_WEIGHT','EMOTION_WEIGHT',
  'SCORE_WEIGHT_COMMUNICATION','SCORE_WEIGHT_PROBLEM_SOLVING','SCORE_WEIGHT_TECHNICAL','SCORE_WEIGHT_PRESENTATION',
  'SCORE_THRESHOLD_GOOD','SCORE_THRESHOLD_EXCELLENT',
  'SCORE_PRESET_DEFAULT_EMOTION','SCORE_PRESET_DEFAULT_AUDIO','SCORE_PRESET_DEFAULT_CONTENT','SCORE_PRESET_DEFAULT_DELIVERY',
  'SCORE_PRESET_INTERVIEW_PRACTICE_EMOTION','SCORE_PRESET_INTERVIEW_PRACTICE_AUDIO','SCORE_PRESET_INTERVIEW_PRACTICE_CONTENT','SCORE_PRESET_INTERVIEW_PRACTICE_DELIVERY',
  'SCORE_PRESET_LANGUAGE_LEARNING_EMOTION','SCORE_PRESET_LANGUAGE_LEARNING_AUDIO','SCORE_PRESET_LANGUAGE_LEARNING_CONTENT','SCORE_PRESET_LANGUAGE_LEARNING_DELIVERY',
  'SCORE_PRESET_PRESENTATION_EMOTION','SCORE_PRESET_PRESENTATION_AUDIO','SCORE_PRESET_PRESENTATION_CONTENT','SCORE_PRESET_PRESENTATION_DELIVERY',
  'SCORE_PRESET_CUSTOM_EMOTION','SCORE_PRESET_CUSTOM_AUDIO','SCORE_PRESET_CUSTOM_CONTENT','SCORE_PRESET_CUSTOM_DELIVERY',
  'WS_ACK_TIMEOUT_MS','WS_MAX_RETRIES'
);
