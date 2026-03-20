#!/bin/bash

###############################################################################
# Environment Variables Synchronization Script
#
# Purpose: Synchronize .env.local (SSOT) to infrastructure/.env
# Single Source of Truth: .env.local
#
# Usage:
#   bash scripts/sync-env-vars.sh [--check-only]
#
# Options:
#   --check-only  Only check sync status, don't modify files
#
# Exit Codes:
#   0 - Success (files are in sync or successfully synced)
#   1 - Files are out of sync (--check-only mode)
#   2 - Script error
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="/workspaces/prance-communication-platform"
SSOT_FILE="${PROJECT_ROOT}/.env.local"
TARGET_FILE="${PROJECT_ROOT}/infrastructure/.env"

CHECK_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 2
      ;;
  esac
done

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Environment Variables Synchronization${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if SSOT file exists
if [ ! -f "$SSOT_FILE" ]; then
  echo -e "${RED}❌ Error: Single Source of Truth file not found${NC}"
  echo "Expected: $SSOT_FILE"
  exit 2
fi

echo -e "${YELLOW}Single Source of Truth:${NC} $SSOT_FILE"
echo -e "${YELLOW}Target:${NC} $TARGET_FILE"
echo ""

# Extract non-secret environment variables from SSOT
# Exclude: API keys, passwords, secrets, tokens
# Include: Configuration values, domains, formats, limits
echo "Extracting non-secret environment variables from SSOT..."

TEMP_FILE=$(mktemp)

# Extract non-secret variables (exclude lines with SECRET, KEY, PASSWORD, TOKEN in name)
grep -E "^[A-Z_]+=" "$SSOT_FILE" | \
  grep -v -E "_(SECRET|KEY|PASSWORD|TOKEN|CREDENTIALS)=" | \
  grep -E "^(AWS_ENDPOINT_SUFFIX|MAX_RESULTS|BEDROCK_REGION|BEDROCK_MODEL_ID|CLOUDFRONT_DOMAIN|STT_LANGUAGE|STT_AUTO_DETECT_LANGUAGES|VIDEO_FORMAT|VIDEO_RESOLUTION|AUDIO_CONTENT_TYPE|VIDEO_CONTENT_TYPE|ENABLE_AUTO_ANALYSIS|DYNAMODB_CONNECTION_TTL_SECONDS|NODE_ENV|ENVIRONMENT|LOG_LEVEL)=" \
  > "$TEMP_FILE"

NON_SECRET_COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
echo -e "${GREEN}✓${NC} Extracted $NON_SECRET_COUNT non-secret variables"
echo ""

# Check if target file exists
if [ ! -f "$TARGET_FILE" ]; then
  if [ "$CHECK_ONLY" = true ]; then
    echo -e "${RED}❌ Target file does not exist${NC}"
    rm -f "$TEMP_FILE"
    exit 1
  else
    echo -e "${YELLOW}Target file does not exist. Creating...${NC}"
    mkdir -p "$(dirname "$TARGET_FILE")"
    touch "$TARGET_FILE"
  fi
fi

# Compare files
if diff -q "$TEMP_FILE" "$TARGET_FILE" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Files are already in sync${NC}"
  rm -f "$TEMP_FILE"
  exit 0
else
  echo -e "${YELLOW}⚠️  Files are out of sync${NC}"
  echo ""

  if [ "$CHECK_ONLY" = true ]; then
    echo "Differences:"
    diff "$TEMP_FILE" "$TARGET_FILE" || true
    echo ""
    echo -e "${RED}❌ Sync required${NC}"
    echo "Run: bash scripts/sync-env-vars.sh"
    rm -f "$TEMP_FILE"
    exit 1
  else
    # Create backup
    if [ -f "$TARGET_FILE" ]; then
      BACKUP_FILE="${TARGET_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
      cp "$TARGET_FILE" "$BACKUP_FILE"
      echo -e "${GREEN}✓${NC} Backup created: $BACKUP_FILE"
    fi

    # Sync
    cp "$TEMP_FILE" "$TARGET_FILE"
    echo -e "${GREEN}✓${NC} Synced $NON_SECRET_COUNT variables to $TARGET_FILE"
    echo ""

    # Show summary
    echo "Synced variables:"
    cat "$TARGET_FILE" | sed 's/=.*/=***/' | sed 's/^/  - /'
    echo ""

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Synchronization complete${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
  fi
fi

rm -f "$TEMP_FILE"
