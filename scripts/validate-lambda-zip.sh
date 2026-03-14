#!/bin/bash
#
# Lambda ZIP Structure Validation Script
# Purpose: Validate ZIP file structure before deployment
# Prevents deployment failures due to incorrect ZIP structure
#
# Usage: bash scripts/validate-lambda-zip.sh <path-to-zip-file>
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check arguments
if [ $# -lt 1 ]; then
  echo -e "${RED}Error: ZIP file path required${NC}"
  echo "Usage: $0 <path-to-zip-file>"
  exit 1
fi

ZIP_FILE="$1"

# Check if ZIP file exists
if [ ! -f "$ZIP_FILE" ]; then
  echo -e "${RED}Error: ZIP file not found: $ZIP_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Lambda ZIP Structure Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "ZIP File: ${YELLOW}$ZIP_FILE${NC}"
echo ""

TOTAL_CHECKS=0
FAILED_CHECKS=0

# =============================================================================
# Check 1: index.js in root
# =============================================================================

echo -e "[CHECK 1/6] index.js in root"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if unzip -l "$ZIP_FILE" | grep -q "^.*[[:space:]]index.js$"; then
  echo -e "  ${GREEN}✓${NC} index.js found in ZIP root"
else
  echo -e "  ${RED}✗${NC} index.js NOT in ZIP root"
  echo -e "  ${YELLOW}→ index.js must be in the root of the ZIP file${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 2: node_modules/ in root
# =============================================================================

echo -e "[CHECK 2/6] node_modules/ in root"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if unzip -l "$ZIP_FILE" | grep -q "^.*[[:space:]]node_modules/$"; then
  echo -e "  ${GREEN}✓${NC} node_modules/ found in ZIP root"
else
  echo -e "  ${RED}✗${NC} node_modules/ NOT in ZIP root"
  echo -e "  ${YELLOW}→ node_modules/ must be in the root of the ZIP file${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 3: Prisma Client in node_modules
# =============================================================================

echo -e "[CHECK 3/6] Prisma Client in node_modules"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if unzip -l "$ZIP_FILE" | grep -q "node_modules/.prisma/client/index.js"; then
  echo -e "  ${GREEN}✓${NC} Prisma Client found"
else
  echo -e "  ${RED}✗${NC} Prisma Client NOT found"
  echo -e "  ${YELLOW}→ node_modules/.prisma/client/index.js is missing${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 4: @prisma module in node_modules
# =============================================================================

echo -e "[CHECK 4/6] @prisma module in node_modules"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if unzip -l "$ZIP_FILE" | grep -q "node_modules/@prisma/client"; then
  echo -e "  ${GREEN}✓${NC} @prisma module found"
else
  echo -e "  ${RED}✗${NC} @prisma module NOT found"
  echo -e "  ${YELLOW}→ node_modules/@prisma/client is missing${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 5: ffmpeg-static in node_modules (CRITICAL)
# =============================================================================

echo -e "[CHECK 5/8] ffmpeg-static in node_modules"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if unzip -l "$ZIP_FILE" | grep -q "node_modules/ffmpeg-static"; then
  echo -e "  ${GREEN}✓${NC} ffmpeg-static found"
else
  echo -e "  ${RED}✗${NC} ffmpeg-static NOT found"
  echo -e "  ${YELLOW}→ node_modules/ffmpeg-static is missing${NC}"
  echo -e "  ${YELLOW}→ This will cause audio processing errors (Failed to process speech)${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 6: Azure Speech SDK in node_modules (CRITICAL)
# =============================================================================

echo -e "[CHECK 6/8] Azure Speech SDK in node_modules"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if unzip -l "$ZIP_FILE" | grep -q "node_modules/microsoft-cognitiveservices-speech-sdk"; then
  echo -e "  ${GREEN}✓${NC} Azure Speech SDK found"
else
  echo -e "  ${RED}✗${NC} Azure Speech SDK NOT found"
  echo -e "  ${YELLOW}→ node_modules/microsoft-cognitiveservices-speech-sdk is missing${NC}"
  echo -e "  ${YELLOW}→ This will cause speech-to-text errors${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 7: No deploy/ directory in ZIP
# =============================================================================

echo -e "[CHECK 7/8] No deploy/ directory"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

DEPLOY_COUNT=$(unzip -l "$ZIP_FILE" | grep -c "deploy/" || true)
if [ "$DEPLOY_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} No deploy/ directory (correct structure)"
else
  echo -e "  ${RED}✗${NC} deploy/ directory found ($DEPLOY_COUNT occurrences)"
  echo -e "  ${YELLOW}→ ZIP was created incorrectly: zip -r file.zip deploy/${NC}"
  echo -e "  ${YELLOW}→ Correct: cd deploy && zip -r ../file.zip .${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 8: ZIP file size
# =============================================================================

echo -e "[CHECK 8/8] ZIP file size"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

ZIP_SIZE=$(stat -c%s "$ZIP_FILE" 2>/dev/null || stat -f%z "$ZIP_FILE")
ZIP_SIZE_MB=$((ZIP_SIZE / 1024 / 1024))

if [ "$ZIP_SIZE" -lt 1000000 ]; then
  echo -e "  ${RED}✗${NC} ZIP too small: ${ZIP_SIZE} bytes ($ZIP_SIZE_MB MB)"
  echo -e "  ${YELLOW}→ Expected at least 10 MB (including Prisma Client)${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
else
  echo -e "  ${GREEN}✓${NC} ZIP size OK: $ZIP_SIZE bytes ($ZIP_SIZE_MB MB)"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Total checks: ${TOTAL_CHECKS}"
echo -e "Failed: ${FAILED_CHECKS}"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
  echo -e "${GREEN}✅ ZIP structure validation passed${NC}"
  echo ""
  echo -e "${BLUE}ZIP Preview (first 20 entries):${NC}"
  unzip -l "$ZIP_FILE" | head -25
  echo ""
  exit 0
else
  echo -e "${RED}❌ ZIP structure validation FAILED${NC}"
  echo ""
  echo -e "${YELLOW}Fix the issues above before deployment${NC}"
  echo ""
  exit 1
fi
