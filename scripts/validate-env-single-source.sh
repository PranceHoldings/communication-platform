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

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="/workspaces/prance-communication-platform"
SSOT_FILE="${PROJECT_ROOT}/.env.local"
TARGET_FILE="${PROJECT_ROOT}/infrastructure/.env"

VALIDATION_FAILED=0

echo ""
log_section "Environment Variables SSOT Validation"
echo ""

# ===================================================================
# Validation 1: .env.local exists
# ===================================================================
echo -e "${YELLOW}[1/5]${NC} Checking SSOT file exists..."

if [ ! -f "$SSOT_FILE" ]; then
  log_error "SSOT file not found: $SSOT_FILE"
  VALIDATION_FAILED=1
else
  log_success "SSOT file exists"
fi

# ===================================================================
# Validation 2: No duplicate environment variable definitions
# ===================================================================
echo -e "${YELLOW}[2/5]${NC} Checking for duplicate definitions in SSOT..."

DUPLICATES=$(grep -E "^[A-Z_]+=" "$SSOT_FILE" | cut -d= -f1 | sort | uniq -d)

if [ -n "$DUPLICATES" ]; then
  log_error "Duplicate environment variable definitions found in $SSOT_FILE:"
  echo "$DUPLICATES" | sed 's/^/  - /'
  VALIDATION_FAILED=1
else
  log_success "No duplicate definitions"
fi

# ===================================================================
# Validation 3: infrastructure/.env is in sync with .env.local
# ===================================================================
echo -e "${YELLOW}[3/5]${NC} Checking synchronization between SSOT and infrastructure/.env..."

if bash scripts/sync-env-vars.sh --check-only > /dev/null 2>&1; then
  log_success "Files are in sync"
else
  log_error "Files are out of sync"
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
    log_error "Manual additions detected in infrastructure/.env:"
    echo "$MANUAL_ADDITIONS" | sed 's/^/  - /'
    echo ""
    log_warning "Action: Remove these from infrastructure/.env and add to .env.local"
    VALIDATION_FAILED=1
  else
    log_success "No manual additions detected"
  fi
else
  log_warning "infrastructure/.env does not exist (will be created on sync)"
fi

# ===================================================================
# Validation 5: Secrets are NOT in infrastructure/.env
# ===================================================================
echo -e "${YELLOW}[5/5]${NC} Checking that secrets are not in infrastructure/.env..."

if [ -f "$TARGET_FILE" ]; then
  SECRETS_IN_INFRA=$(grep -E "_(SECRET|KEY|PASSWORD|TOKEN|CREDENTIALS)=" "$TARGET_FILE" || true)

  if [ -n "$SECRETS_IN_INFRA" ]; then
    log_error "Secrets detected in infrastructure/.env:"
    echo "$SECRETS_IN_INFRA" | sed 's/=.*/=***/' | sed 's/^/  - /'
    echo ""
    log_warning "Action: Remove these secrets. Use AWS Secrets Manager instead."
    VALIDATION_FAILED=1
  else
    log_success "No secrets in infrastructure/.env"
  fi
fi

# ===================================================================
# Summary
# ===================================================================
echo ""
print_separator "=" 60

if [ $VALIDATION_FAILED -eq 0 ]; then
  log_success "All SSOT validations passed"
  echo ""
  echo "Single Source of Truth: .env.local"
  echo "Configuration files: infrastructure/.env (auto-generated)"
  echo "Secrets: AWS Secrets Manager"
  exit 0
else
  log_error "SSOT validation failed"
  echo ""
  echo "Fix the issues above before committing."
  echo ""
  echo "Commands:"
  echo "  - Sync: bash scripts/sync-env-vars.sh"
  echo "  - Add variable: echo 'NEW_VAR=value' >> .env.local"
  exit 1
fi
