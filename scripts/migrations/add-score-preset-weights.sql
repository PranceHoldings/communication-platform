-- Migration: Add Score Preset Weights to runtime_configs
-- Date: 2026-03-21
-- Purpose: Enable UI-based management of score calculation weights
-- Total: 20 new runtime_configs (5 presets × 4 weights)

-- ============================================================
-- Default Preset Weights
-- ============================================================

INSERT INTO runtime_configs (
  key,
  value,
  data_type,
  category,
  access_level,
  description,
  created_at,
  updated_at
) VALUES
-- Default preset
('SCORE_PRESET_DEFAULT_EMOTION', 0.35, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Default preset: Emotion weight (must sum to 1.0 with other weights)', NOW(), NOW()),

('SCORE_PRESET_DEFAULT_AUDIO', 0.35, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Default preset: Audio weight (must sum to 1.0 with other weights)', NOW(), NOW()),

('SCORE_PRESET_DEFAULT_CONTENT', 0.2, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Default preset: Content weight (must sum to 1.0 with other weights)', NOW(), NOW()),

('SCORE_PRESET_DEFAULT_DELIVERY', 0.1, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Default preset: Delivery weight (must sum to 1.0 with other weights)', NOW(), NOW()),

-- ============================================================
-- Interview Practice Preset Weights
-- ============================================================

('SCORE_PRESET_INTERVIEW_EMOTION', 0.4, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Interview practice preset: Emotion weight (emphasis on emotional control)', NOW(), NOW()),

('SCORE_PRESET_INTERVIEW_AUDIO', 0.3, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Interview practice preset: Audio weight (clear communication)', NOW(), NOW()),

('SCORE_PRESET_INTERVIEW_CONTENT', 0.2, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Interview practice preset: Content weight (relevant answers)', NOW(), NOW()),

('SCORE_PRESET_INTERVIEW_DELIVERY', 0.1, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Interview practice preset: Delivery weight (professional presentation)', NOW(), NOW()),

-- ============================================================
-- Language Learning Preset Weights
-- ============================================================

('SCORE_PRESET_LANGUAGE_EMOTION', 0.15, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Language learning preset: Emotion weight (less emphasis on emotion)', NOW(), NOW()),

('SCORE_PRESET_LANGUAGE_AUDIO', 0.5, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Language learning preset: Audio weight (pronunciation and fluency focus)', NOW(), NOW()),

('SCORE_PRESET_LANGUAGE_CONTENT', 0.25, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Language learning preset: Content weight (vocabulary and grammar)', NOW(), NOW()),

('SCORE_PRESET_LANGUAGE_DELIVERY', 0.1, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Language learning preset: Delivery weight (natural speech)', NOW(), NOW()),

-- ============================================================
-- Presentation Preset Weights
-- ============================================================

('SCORE_PRESET_PRESENTATION_EMOTION', 0.3, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Presentation preset: Emotion weight (engaging delivery)', NOW(), NOW()),

('SCORE_PRESET_PRESENTATION_AUDIO', 0.3, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Presentation preset: Audio weight (clear articulation)', NOW(), NOW()),

('SCORE_PRESET_PRESENTATION_CONTENT', 0.3, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Presentation preset: Content weight (structured message)', NOW(), NOW()),

('SCORE_PRESET_PRESENTATION_DELIVERY', 0.1, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Presentation preset: Delivery weight (confident presence)', NOW(), NOW()),

-- ============================================================
-- Custom Preset Weights (same as default initially)
-- ============================================================

('SCORE_PRESET_CUSTOM_EMOTION', 0.35, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Custom preset: Emotion weight (fully customizable by organization)', NOW(), NOW()),

('SCORE_PRESET_CUSTOM_AUDIO', 0.35, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Custom preset: Audio weight (fully customizable by organization)', NOW(), NOW()),

('SCORE_PRESET_CUSTOM_CONTENT', 0.2, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Custom preset: Content weight (fully customizable by organization)', NOW(), NOW()),

('SCORE_PRESET_CUSTOM_DELIVERY', 0.1, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE',
 'Custom preset: Delivery weight (fully customizable by organization)', NOW(), NOW())

ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================
-- Verification Query
-- ============================================================

-- Verify all 20 configs were inserted
SELECT
  key,
  value,
  description,
  category,
  access_level
FROM runtime_configs
WHERE key LIKE 'SCORE_PRESET_%'
ORDER BY key;

-- Verify weight sums for each preset (should all equal 1.0)
SELECT
  'default' AS preset,
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_DEFAULT_EMOTION') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_DEFAULT_AUDIO') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_DEFAULT_CONTENT') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_DEFAULT_DELIVERY') AS weight_sum
UNION ALL
SELECT
  'interview' AS preset,
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_INTERVIEW_EMOTION') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_INTERVIEW_AUDIO') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_INTERVIEW_CONTENT') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_INTERVIEW_DELIVERY') AS weight_sum
UNION ALL
SELECT
  'language' AS preset,
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_LANGUAGE_EMOTION') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_LANGUAGE_AUDIO') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_LANGUAGE_CONTENT') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_LANGUAGE_DELIVERY') AS weight_sum
UNION ALL
SELECT
  'presentation' AS preset,
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_PRESENTATION_EMOTION') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_PRESENTATION_AUDIO') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_PRESENTATION_CONTENT') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_PRESENTATION_DELIVERY') AS weight_sum
UNION ALL
SELECT
  'custom' AS preset,
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_CUSTOM_EMOTION') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_CUSTOM_AUDIO') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_CUSTOM_CONTENT') +
  (SELECT value FROM runtime_configs WHERE key = 'SCORE_PRESET_CUSTOM_DELIVERY') AS weight_sum;
