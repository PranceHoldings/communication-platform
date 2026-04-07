#!/bin/bash
# =============================================================================
# validate-s3-paths.sh
#
# Enforces that ALL S3 path construction in Lambda TypeScript code goes through
# infrastructure/lambda/shared/config/s3-paths.ts.
#
# Detects hardcoded S3 path template literals that bypass the central module,
# e.g.:
#   `recordings/${id}.webm`         ← wrong prefix AND bypasses s3-paths.ts
#   `sessions/${id}/chunks/...`     ← bypasses s3-paths.ts
#   `reports/sessions/${id}/...`    ← bypasses s3-paths.ts
#
# Exit codes:
#   0 - No violations
#   1 - Violations found
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/infrastructure/lambda"
S3_PATHS_FILE="$LAMBDA_DIR/shared/config/s3-paths.ts"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== S3 Path Consistency Validation ==="
echo "Scanning: $LAMBDA_DIR"
echo ""

VIOLATIONS=0

# ---------------------------------------------------------------------------
# Helper: grep for a pattern and report violations
# ---------------------------------------------------------------------------
check_pattern() {
  local description="$1"
  local pattern="$2"

  # Grep returns exit code 1 when no matches — don't fail the script
  local matches
  matches=$(grep -rn \
    --include="*.ts" \
    -E "$pattern" \
    "$LAMBDA_DIR" \
    | grep -v "$S3_PATHS_FILE" \
    | grep -v "\.test\.ts:" \
    | grep -v "\.spec\.ts:" \
    | grep -v "// s3-paths-ignore" \
    || true)

  if [ -n "$matches" ]; then
    echo -e "${RED}❌ VIOLATION: $description${NC}"
    echo "$matches" | while IFS= read -r line; do
      echo "   $line"
    done
    echo ""
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# ---------------------------------------------------------------------------
# Pattern 1: Hardcoded `recordings/` prefix (the critical bug)
# The correct prefix is always `sessions/` via getRecordingKey()
# ---------------------------------------------------------------------------
check_pattern \
  "Hardcoded 'recordings/' prefix — use getRecordingKey() from s3-paths.ts" \
  "\`recordings/"

# ---------------------------------------------------------------------------
# Pattern 2: Inline template literals starting with sessions/{var}
# These must go through s3-paths.ts functions (getSessionRootPrefix, etc.)
# ---------------------------------------------------------------------------
check_pattern \
  "Inline S3 path template 'sessions/\${' — use s3-paths.ts functions" \
  "\`sessions/\\\$\{"

# ---------------------------------------------------------------------------
# Pattern 3: Inline reports/ path construction
# Use getReportKey() from s3-paths.ts
# ---------------------------------------------------------------------------
check_pattern \
  "Inline S3 path template 'reports/' — use getReportKey() from s3-paths.ts" \
  "\`reports/"

# ---------------------------------------------------------------------------
# Pattern 4: Inline audio-chunks/ or video-chunks/ path construction
# Use getChunkKey() from s3-paths.ts
# ---------------------------------------------------------------------------
check_pattern \
  "Inline S3 chunk path 'audio-chunks/' or 'video-chunks/' — use getChunkKey() from s3-paths.ts" \
  "\`(audio-chunks|video-chunks)/"

# ---------------------------------------------------------------------------
# Pattern 5: Inline realtime-chunks/ path construction
# Use getRealtimeChunkKey() or getRealtimeChunksPrefix() from s3-paths.ts
# ---------------------------------------------------------------------------
check_pattern \
  "Inline S3 path template 'realtime-chunks/' — use s3-paths.ts functions" \
  "\`realtime-chunks/"

# ---------------------------------------------------------------------------
# Pattern 6: Raw SQL strings with recordings/ prefix in TypeScript files
# (These are SQL template strings, not JS template literals — separate check)
# ---------------------------------------------------------------------------
check_pattern \
  "Raw SQL string with 'recordings/' prefix — use 'sessions/' prefix to match S3 structure" \
  "'recordings/"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "---"
if [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "${RED}❌ Found $VIOLATIONS violation(s). All S3 path construction must use functions from:${NC}"
  echo -e "   ${YELLOW}infrastructure/lambda/shared/config/s3-paths.ts${NC}"
  echo ""
  echo "Fix options:"
  echo "  recordings/...       → getRecordingKey(sessionId)"
  echo "  sessions/...chunks   → getChunkKey(sessionId, type, ts, n, ext)"
  echo "  sessions/...audio    → getInitialGreetingKey / getSilencePromptKey / getAudioKey"
  echo "  sessions/...frames   → getFrameKey(sessionId, frameIndex)"
  echo "  sessions/...temp     → getTempChunkPartKey / getTempChunkPartPrefix"
  echo "  sessions/...record   → getRecordingKey(sessionId)"
  echo "  reports/...          → getReportKey(sessionId)"
  echo ""
  echo "To suppress a specific line (use sparingly):"
  echo "  // s3-paths-ignore"
  exit 1
else
  echo -e "${GREEN}✅ No hardcoded S3 paths detected. All paths go through s3-paths.ts.${NC}"
  exit 0
fi
