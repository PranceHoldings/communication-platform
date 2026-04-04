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

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

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
      log_error "Unknown option: $1"
      exit 2
      ;;
  esac
done

echo ""
log_section "Environment Variables Synchronization"

# Check if SSOT file exists
if [ ! -f "$SSOT_FILE" ]; then
  log_error "Single Source of Truth file not found"
  log_info "Expected: $SSOT_FILE"
  exit 2
fi

log_warning "Single Source of Truth: $SSOT_FILE"
log_warning "Target: $TARGET_FILE"
echo ""

# Extract non-secret environment variables from SSOT
# Exclude: API keys, passwords, secrets, tokens
# Include: Configuration values, domains, formats, limits
log_info "Extracting non-secret environment variables from SSOT..."

TEMP_FILE=$(mktemp)

# Extract non-secret variables (exclude lines with SECRET, KEY, PASSWORD, TOKEN in name)
grep -E "^[A-Z_]+=" "$SSOT_FILE" | \
  grep -v -E "_(SECRET|KEY|PASSWORD|TOKEN|CREDENTIALS)=" | \
  grep -E "^(AWS_ENDPOINT_SUFFIX|MAX_RESULTS|BEDROCK_REGION|BEDROCK_MODEL_ID|CLOUDFRONT_DOMAIN|STT_LANGUAGE|STT_AUTO_DETECT_LANGUAGES|VIDEO_FORMAT|VIDEO_RESOLUTION|AUDIO_CONTENT_TYPE|VIDEO_CONTENT_TYPE|ENABLE_AUTO_ANALYSIS|DYNAMODB_CONNECTION_TTL_SECONDS|NODE_ENV|ENVIRONMENT|LOG_LEVEL)=" \
  > "$TEMP_FILE"

NON_SECRET_COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
log_success "Extracted $NON_SECRET_COUNT non-secret variables"
echo ""

# Check if target file exists
if [ ! -f "$TARGET_FILE" ]; then
  if [ "$CHECK_ONLY" = true ]; then
    log_error "Target file does not exist"
    rm -f "$TEMP_FILE"
    exit 1
  else
    log_warning "Target file does not exist. Creating..."
    mkdir -p "$(dirname "$TARGET_FILE")"
    touch "$TARGET_FILE"
  fi
fi

# Compare files
if diff -q "$TEMP_FILE" "$TARGET_FILE" > /dev/null 2>&1; then
  log_success "Files are already in sync"
  rm -f "$TEMP_FILE"
  exit 0
else
  log_warning "Files are out of sync"
  echo ""

  if [ "$CHECK_ONLY" = true ]; then
    log_info "Differences:"
    diff "$TEMP_FILE" "$TARGET_FILE" || true
    echo ""
    log_error "Sync required"
    log_info "Run: bash scripts/sync-env-vars.sh"
    rm -f "$TEMP_FILE"
    exit 1
  else
    # Create backup
    if [ -f "$TARGET_FILE" ]; then
      BACKUP_FILE="${TARGET_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
      cp "$TARGET_FILE" "$BACKUP_FILE"
      log_success "Backup created: $BACKUP_FILE"
    fi

    # Sync
    cp "$TEMP_FILE" "$TARGET_FILE"
    log_success "Synced $NON_SECRET_COUNT variables to $TARGET_FILE"
    echo ""

    # Show summary
    log_info "Synced variables:"
    cat "$TARGET_FILE" | sed 's/=.*/=***/' | sed 's/^/  - /'
    echo ""

    log_section "Synchronization complete"
    echo ""
  fi
fi

rm -f "$TEMP_FILE"
