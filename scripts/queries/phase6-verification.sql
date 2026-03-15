--
-- Phase 6 Verification Query
-- Purpose: Verify silencePromptTimeout hierarchical fallback
--

-- Test Scenario
SELECT
  'Test Scenario' as "Check",
  id,
  title,
  "silencePromptTimeout",
  CASE
    WHEN "silencePromptTimeout" IS NULL THEN 'null (組織設定を使用)'
    ELSE "silencePromptTimeout"::text || '秒'
  END as "Status"
FROM scenarios
WHERE id = '6f7f02c2-624e-41a2-b7ba-c0bc683584e5';

-- Organization Settings
SELECT
  'Organization Settings' as "Check",
  "orgId",
  "silencePromptTimeout",
  "enableSilencePrompt",
  "silenceTimeout",
  CASE
    WHEN "silencePromptTimeout" IS NULL THEN 'null (システムデフォルトを使用)'
    ELSE "silencePromptTimeout"::text || '秒'
  END as "Status"
FROM organization_settings
LIMIT 1;

-- Hierarchical Fallback Simulation
SELECT
  'Hierarchical Fallback' as "Check",
  s."silencePromptTimeout" as "Scenario Value",
  os."silencePromptTimeout" as "Organization Value",
  15 as "System Default",
  COALESCE(s."silencePromptTimeout", os."silencePromptTimeout", 15) as "Resolved Value",
  CASE
    WHEN COALESCE(s."silencePromptTimeout", os."silencePromptTimeout", 15) = 25 THEN '✓ 正常'
    ELSE '✗ 異常'
  END as "Verification"
FROM scenarios s
CROSS JOIN organization_settings os
WHERE s.id = '6f7f02c2-624e-41a2-b7ba-c0bc683584e5'
LIMIT 1;
