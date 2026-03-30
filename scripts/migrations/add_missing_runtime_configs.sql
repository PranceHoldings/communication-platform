-- Add missing runtime configurations
-- AUDIO_PROCESSING and SCORE_CALCULATION missing entries

-- ==================================================
-- AUDIO_PROCESSING (CLIENT_ADMIN_READ_WRITE)
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('TTS_STABILITY', '0.5', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '0.5', 0.3, 1.0, 'TTS stability parameter (minimum 0.3 for audio stability)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('TTS_SIMILARITY_BOOST', '0.75', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '0.75', 0.5, 1.0, 'TTS similarity boost parameter (minimum 0.5 for voice quality)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('SILENCE_THRESHOLD', '0.15', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '0.15', 0.0, 0.3, 'Silence detection threshold (maximum 0.3 to avoid missing speech)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('OPTIMAL_PAUSE_SEC', '2.0', 'NUMBER', 'AUDIO_PROCESSING', 'CLIENT_ADMIN_READ_WRITE', '2.0', 1.0, 5.0, 'Optimal pause duration in seconds', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

-- ==================================================
-- SCORE_CALCULATION - Score component weights
-- ==================================================

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('AUDIO_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Audio quality weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('CONTENT_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Content quality weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('DELIVERY_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Delivery quality weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

INSERT INTO runtime_configs (key, value, data_type, category, access_level, default_value, min_value, max_value, description, updated_at)
VALUES
  ('EMOTION_WEIGHT', '0.25', 'NUMBER', 'SCORE_CALCULATION', 'CLIENT_ADMIN_READ_WRITE', '0.25', 0.0, 1.0, 'Emotion analysis weight (must sum to 1.0 with other weights)', NOW())
ON CONFLICT (key) DO UPDATE
SET
  access_level = EXCLUDED.access_level,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  data_type = EXCLUDED.data_type,
  default_value = EXCLUDED.default_value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;

-- Verification
SELECT 'After insertion - Total records:', COUNT(*) FROM runtime_configs;
SELECT 'After insertion - By category:', category, COUNT(*) FROM runtime_configs GROUP BY category ORDER BY category;
