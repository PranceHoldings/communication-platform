-- Populate Silence Management Default Values for Existing Scenarios
-- Problem: Migration added columns with DEFAULT constraints, but PostgreSQL
-- doesn't retroactively apply defaults to existing rows.
--
-- Execute this in AWS RDS Query Editor or via psql:
-- aws rds-data execute-statement \
--   --resource-arn <cluster-arn> \
--   --secret-arn <secret-arn> \
--   --database prance \
--   --sql "$(cat scripts/populate-scenario-defaults.sql)"

-- First, check which scenarios need updating
SELECT
  id,
  title,
  silence_timeout,
  enable_silence_prompt,
  show_silence_timer,
  silence_threshold,
  min_silence_duration
FROM scenarios
WHERE
  silence_timeout IS NULL
  OR enable_silence_prompt IS NULL
  OR show_silence_timer IS NULL
  OR silence_threshold IS NULL
  OR min_silence_duration IS NULL;

-- Update scenarios with NULL values to defaults
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

-- Verify the update
SELECT
  COUNT(*) as total_scenarios,
  COUNT(CASE WHEN silence_timeout IS NULL THEN 1 END) as null_timeout,
  COUNT(CASE WHEN enable_silence_prompt IS NULL THEN 1 END) as null_enable,
  COUNT(CASE WHEN show_silence_timer IS NULL THEN 1 END) as null_timer,
  COUNT(CASE WHEN silence_threshold IS NULL THEN 1 END) as null_threshold,
  COUNT(CASE WHEN min_silence_duration IS NULL THEN 1 END) as null_duration
FROM scenarios;

-- Expected result: All null counts should be 0
