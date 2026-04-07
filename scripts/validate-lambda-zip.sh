#!/bin/bash
#
# Lambda ZIP Structure Validation Script
# Purpose: Validate ZIP file structure before deployment
# Prevents deployment failures due to incorrect ZIP structure
#
# Usage: bash scripts/validate-lambda-zip.sh <path-to-zip-file>
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Check arguments
if [ $# -lt 1 ]; then
  log_error "ZIP file path required"
  echo "Usage: $0 <path-to-zip-file>"
  exit 1
fi

ZIP_FILE="$1"

# Check if ZIP file exists
if [ ! -f "$ZIP_FILE" ]; then
  log_error "ZIP file not found: $ZIP_FILE"
  exit 1
fi

log_section "Lambda ZIP Structure Validation"
echo ""
log_info "ZIP File: $ZIP_FILE"
echo ""

reset_counters

# =============================================================================
# Check 1: index.js in root
# =============================================================================

echo -e "[CHECK 1/6] index.js in root"

if unzip -l "$ZIP_FILE" | grep -q "^.*[[:space:]]index.js$"; then
  log_success "index.js found in ZIP root"
else
  log_error "index.js NOT in ZIP root"
  log_warning "→ index.js must be in the root of the ZIP file"
fi

# =============================================================================
# Check 2: node_modules/ in root
# =============================================================================

echo -e "[CHECK 2/6] node_modules/ in root"

if unzip -l "$ZIP_FILE" | grep -q "^.*[[:space:]]node_modules/$"; then
  log_success "node_modules/ found in ZIP root"
else
  log_error "node_modules/ NOT in ZIP root"
  log_warning "→ node_modules/ must be in the root of the ZIP file"
fi

# =============================================================================
# Check 3: Prisma Client in node_modules
# =============================================================================

echo -e "[CHECK 3/6] Prisma Client in node_modules"

if unzip -l "$ZIP_FILE" | grep -q "node_modules/.prisma/client/index.js"; then
  log_success "Prisma Client found"
else
  log_error "Prisma Client NOT found"
  log_warning "→ node_modules/.prisma/client/index.js is missing"
fi

# =============================================================================
# Check 4: @prisma module in node_modules
# =============================================================================

echo -e "[CHECK 4/6] @prisma module in node_modules"

if unzip -l "$ZIP_FILE" | grep -q "node_modules/@prisma/client"; then
  log_success "@prisma module found"
else
  log_error "@prisma module NOT found"
  log_warning "→ node_modules/@prisma/client is missing"
fi

# =============================================================================
# Check 5: ffmpeg-static in node_modules (CRITICAL)
# =============================================================================

echo -e "[CHECK 5/8] ffmpeg-static in node_modules"

if unzip -l "$ZIP_FILE" | grep -q "node_modules/ffmpeg-static"; then
  log_success "ffmpeg-static found"
else
  log_error "ffmpeg-static NOT found"
  log_warning "→ node_modules/ffmpeg-static is missing"
  log_warning "→ This will cause audio processing errors (Failed to process speech)"
fi

# =============================================================================
# Check 6: Azure Speech SDK in node_modules (CRITICAL)
# =============================================================================

echo -e "[CHECK 6/8] Azure Speech SDK in node_modules"

if unzip -l "$ZIP_FILE" | grep -q "node_modules/microsoft-cognitiveservices-speech-sdk"; then
  log_success "Azure Speech SDK found"
else
  log_error "Azure Speech SDK NOT found"
  log_warning "→ node_modules/microsoft-cognitiveservices-speech-sdk is missing"
  log_warning "→ This will cause speech-to-text errors"
fi

# =============================================================================
# Check 7: No deploy/ directory in ZIP
# =============================================================================

echo -e "[CHECK 7/8] No deploy/ directory"

DEPLOY_COUNT=$(unzip -l "$ZIP_FILE" | grep -c "deploy/" || true)
if [ "$DEPLOY_COUNT" -eq 0 ]; then
  log_success "No deploy/ directory (correct structure)"
else
  log_error "deploy/ directory found ($DEPLOY_COUNT occurrences)"
  log_warning "→ ZIP was created incorrectly: zip -r file.zip deploy/"
  log_warning "→ Correct: cd deploy && zip -r ../file.zip ."
fi

# =============================================================================
# Check 8: ZIP file size
# =============================================================================

echo -e "[CHECK 8/8] ZIP file size"

ZIP_SIZE=$(stat -c%s "$ZIP_FILE" 2>/dev/null || stat -f%z "$ZIP_FILE")
ZIP_SIZE_MB=$((ZIP_SIZE / 1024 / 1024))

if [ "$ZIP_SIZE" -lt 1000000 ]; then
  log_error "ZIP too small: ${ZIP_SIZE} bytes ($ZIP_SIZE_MB MB)"
  log_warning "→ Expected at least 10 MB (including Prisma Client)"
else
  log_success "ZIP size OK: $ZIP_SIZE bytes ($ZIP_SIZE_MB MB)"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
log_section "Validation Summary"
echo ""
echo -e "Total checks: 8"
echo -e "Errors: $ERRORS"
echo ""

if [ "$ERRORS" -eq 0 ]; then
  log_success "ZIP structure validation passed"
  echo ""
  log_info "ZIP Preview (first 20 entries):"
  unzip -l "$ZIP_FILE" | head -25
  echo ""
  exit 0
else
  log_error "ZIP structure validation FAILED"
  echo ""
  log_warning "Fix the issues above before deployment"
  echo ""
  exit 1
fi
