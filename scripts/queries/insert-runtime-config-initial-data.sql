-- Phase 5: Runtime Configuration Initial Data
-- Insert 15 system parameters

INSERT INTO runtime_configs (key, value, data_type, category, default_value, min_value, max_value, description)
VALUES
  -- Query & Processing
  ('MAX_RESULTS', '1000', 'NUMBER', 'QUERY_PROCESSING', '1000', 1, 10000, 'Maximum number of query results'),
  ('VIDEO_CHUNK_BATCH_SIZE', '5', 'NUMBER', 'QUERY_PROCESSING', '5', 1, 100, 'Video chunk batch size for processing'),
  ('ANALYSIS_BATCH_SIZE', '10', 'NUMBER', 'QUERY_PROCESSING', '10', 1, 100, 'Analysis batch size'),

  -- AI Processing
  ('CLAUDE_TEMPERATURE', '0.7', 'NUMBER', 'AI_PROCESSING', '0.7', 0.0, 1.0, 'Claude AI temperature (creativity vs consistency)'),
  ('CLAUDE_MAX_TOKENS', '1024', 'NUMBER', 'AI_PROCESSING', '1024', 128, 4096, 'Claude AI max tokens for response'),
  ('MAX_AUTO_DETECT_LANGUAGES', '3', 'NUMBER', 'AI_PROCESSING', '3', 1, 10, 'Maximum number of languages for STT auto-detection'),

  -- Security
  ('RATE_LIMIT_MAX_ATTEMPTS', '5', 'NUMBER', 'SECURITY', '5', 1, 100, 'Maximum number of failed attempts before lockout'),
  ('RATE_LIMIT_LOCKOUT_DURATION_MS', '900000', 'NUMBER', 'SECURITY', '900000', 60000, 3600000, 'Lockout duration in milliseconds (default: 15 minutes)'),
  ('BCRYPT_SALT_ROUNDS', '10', 'NUMBER', 'SECURITY', '10', 8, 14, 'bcrypt salt rounds for password hashing'),

  -- Score Calculation
  ('SCORE_WEIGHT_COMMUNICATION', '0.25', 'NUMBER', 'SCORE_CALCULATION', '0.25', 0.0, 1.0, 'Weight for communication skills in overall score'),
  ('SCORE_WEIGHT_PROBLEM_SOLVING', '0.25', 'NUMBER', 'SCORE_CALCULATION', '0.25', 0.0, 1.0, 'Weight for problem solving in overall score'),
  ('SCORE_WEIGHT_TECHNICAL', '0.25', 'NUMBER', 'SCORE_CALCULATION', '0.25', 0.0, 1.0, 'Weight for technical skills in overall score'),
  ('SCORE_WEIGHT_PRESENTATION', '0.25', 'NUMBER', 'SCORE_CALCULATION', '0.25', 0.0, 1.0, 'Weight for presentation skills in overall score'),
  ('SCORE_THRESHOLD_EXCELLENT', '70', 'NUMBER', 'SCORE_CALCULATION', '70', 0, 100, 'Threshold for excellent rating'),
  ('SCORE_THRESHOLD_GOOD', '60', 'NUMBER', 'SCORE_CALCULATION', '60', 0, 100, 'Threshold for good rating')
ON CONFLICT (key) DO NOTHING;
