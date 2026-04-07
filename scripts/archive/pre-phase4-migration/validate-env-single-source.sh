#!/bin/bash

###############################################################################
# Environment Variables Single Source of Truth Validator
#
# Purpose: Validate that .env.local is the only source of environment variables
# Enforcement: Detect duplicate definitions, manual edits to infrastructure/.env
#
# Usage:
#   bash scripts/validate-env-single-source.sh
#
# Exit Codes:
#   0 - All validations passed
#   1 - Validation failed
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

VALIDATION_FAILED=0

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Environment Variables SSOT Validation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ===================================================================
# Validation 1: .env.local exists
# ===================================================================
echo -e "${YELLOW}[1/5]${NC} Checking SSOT file exists..."

if [ ! -f "$SSOT_FILE" ]; then
  echo -e "${RED}❌ SSOT file not found: $SSOT_FILE${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}✅ SSOT file exists${NC}"
fi

# ===================================================================
# Validation 2: No duplicate environment variable definitions
# ===================================================================
echo -e "${YELLOW}[2/5]${NC} Checking for duplicate definitions in SSOT..."

DUPLICATES=$(grep -E "^[A-Z_]+=" "$SSOT_FILE" | cut -d= -f1 | sort | uniq -d)

if [ -n "$DUPLICATES" ]; then
  echo -e "${RED}❌ Duplicate environment variable definitions found in $SSOT_FILE:${NC}"
  echo "$DUPLICATES" | sed 's/^/  - /'
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}✅ No duplicate definitions${NC}"
fi

# ===================================================================
# Validation 3: infrastructure/.env is in sync with .env.local
# ===================================================================
echo -e "${YELLOW}[3/5]${NC} Checking synchronization between SSOT and infrastructure/.env..."

if bash scripts/sync-env-vars.sh --check-only > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Files are in sync${NC}"
else
  echo -e "${RED}❌ Files are out of sync${NC}"
  echo "Run: bash scripts/sync-env-vars.sh"
  VALIDATION_FAILED=1
fi

# ===================================================================
# Validation 4: No manual additions to infrastructure/.env
# ===================================================================
echo -e "${YELLOW}[4/5]${NC} Checking for manual additions to infrastructure/.env..."

if [ -f "$TARGET_FILE" ]; then
  # Extract variable names from infrastructure/.env
  INFRA_VARS=$(grep -E "^[A-Z_]+=" "$TARGET_FILE" | cut -d= -f1 | sort)

  # Extract non-secret variable names from .env.local
  SSOT_NON_SECRET_VARS=$(grep -E "^[A-Z_]+=" "$SSOT_FILE" | \
    grep -v -E "_(SECRET|KEY|PASSWORD|TOKEN|CREDENTIALS)=" | \
    grep -E "^(AWS_ENDPOINT_SUFFIX|MAX_RESULTS|BEDROCK_REGION|BEDROCK_MODEL_ID|CLOUDFRONT_DOMAIN|STT_LANGUAGE|STT_AUTO_DETECT_LANGUAGES|VIDEO_FORMAT|VIDEO_RESOLUTION|AUDIO_CONTENT_TYPE|VIDEO_CONTENT_TYPE|ENABLE_AUTO_ANALYSIS|DYNAMODB_CONNECTION_TTL_SECONDS|NODE_ENV|ENVIRONMENT|LOG_LEVEL)=" | \
    cut -d= -f1 | sort)

  # Find variables in infrastructure/.env that are not in .env.local
  MANUAL_ADDITIONS=$(comm -13 <(echo "$SSOT_NON_SECRET_VARS") <(echo "$INFRA_VARS"))

  if [ -n "$MANUAL_ADDITIONS" ]; then
    echo -e "${RED}❌ Manual additions detected in infrastructure/.env:${NC}"
    echo "$MANUAL_ADDITIONS" | sed 's/^/  - /'
    echo ""
    echo -e "${YELLOW}Action: Remove these from infrastructure/.env and add to .env.local${NC}"
    VALIDATION_FAILED=1
  else
    echo -e "${GREEN}✅ No manual additions detected${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  infrastructure/.env does not exist (will be created on sync)${NC}"
fi

# ===================================================================
# Validation 5: Secrets are NOT in infrastructure/.env
# ===================================================================
echo -e "${YELLOW}[5/5]${NC} Checking that secrets are not in infrastructure/.env..."

if [ -f "$TARGET_FILE" ]; then
  SECRETS_IN_INFRA=$(grep -E "_(SECRET|KEY|PASSWORD|TOKEN|CREDENTIALS)=" "$TARGET_FILE" || true)

  if [ -n "$SECRETS_IN_INFRA" ]; then
    echo -e "${RED}❌ Secrets detected in infrastructure/.env:${NC}"
    echo "$SECRETS_IN_INFRA" | sed 's/=.*/=***/' | sed 's/^/  - /'
    echo ""
    echo -e "${YELLOW}Action: Remove these secrets. Use AWS Secrets Manager instead.${NC}"
    VALIDATION_FAILED=1
  else
    echo -e "${GREEN}✅ No secrets in infrastructure/.env${NC}"
  fi
fi

# ===================================================================
# Summary
# ===================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $VALIDATION_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All SSOT validations passed${NC}"
  echo ""
  echo "Single Source of Truth: .env.local"
  echo "Configuration files: infrastructure/.env (auto-generated)"
  echo "Secrets: AWS Secrets Manager"
  exit 0
else
  echo -e "${RED}❌ SSOT validation failed${NC}"
  echo ""
  echo "Fix the issues above before committing."
  echo ""
  echo "Commands:"
  echo "  - Sync: bash scripts/sync-env-vars.sh"
  echo "  - Add variable: echo 'NEW_VAR=value' >> .env.local"
  exit 1
fi
