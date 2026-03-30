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

-- Verification
SELECT 'Total records:', COUNT(*) FROM runtime_configs;
SELECT 'By access level:', access_level, COUNT(*) FROM runtime_configs GROUP BY access_level ORDER BY access_level;
