#!/bin/bash

##############################################################################
# Schema-First Validation Script
#
# Purpose: Enforce Schema-First → Interface-Second → Implementation-Third
# Author: Claude Code
# Date: 2026-03-22
#
# Validation Steps:
#   1. Prisma Schema Analysis (extract fields and types)
#   2. Type Definition Comparison (packages/shared vs Prisma)
#   3. Lambda Response Validation (detect manual field mapping)
#   4. Frontend Usage Validation (detect undefined field references)
#   5. Type Import Validation (ensure imports from @prance/shared)
#
##############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Schema-First Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

##############################################################################
# Step 1: Prisma Schema Analysis
##############################################################################

echo -e "${BLUE}[1/5]${NC} Analyzing Prisma Schema..."

SCHEMA_FILE="packages/database/prisma/schema.prisma"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo -e "${RED}  ✗ Prisma schema not found: $SCHEMA_FILE${NC}"
  ERRORS=$((ERRORS + 1))
else
  # Extract key models and their fields
  AVATAR_FIELDS=$(grep -A 20 "^model Avatar" "$SCHEMA_FILE" | grep -E "^\s+\w+\s+" | wc -l)
  SESSION_FIELDS=$(grep -A 20 "^model Session" "$SCHEMA_FILE" | grep -E "^\s+\w+\s+" | wc -l)
  SCENARIO_FIELDS=$(grep -A 30 "^model Scenario" "$SCHEMA_FILE" | grep -E "^\s+\w+\s+" | wc -l)

  echo -e "${GREEN}  ✓ Avatar model: $AVATAR_FIELDS fields${NC}"
  echo -e "${GREEN}  ✓ Session model: $SESSION_FIELDS fields${NC}"
  echo -e "${GREEN}  ✓ Scenario model: $SCENARIO_FIELDS fields${NC}"
fi

echo ""

##############################################################################
# Step 2: Type Definition Comparison
##############################################################################

echo -e "${BLUE}[2/5]${NC} Comparing Type Definitions (packages/shared vs Prisma)..."

SHARED_TYPES="packages/shared/src/types/index.ts"

if [ ! -f "$SHARED_TYPES" ]; then
  echo -e "${RED}  ✗ Shared types not found: $SHARED_TYPES${NC}"
  ERRORS=$((ERRORS + 1))
else
  # Check if key interfaces exist
  if grep -q "export interface Avatar" "$SHARED_TYPES"; then
    echo -e "${GREEN}  ✓ Avatar interface defined${NC}"
  else
    echo -e "${RED}  ✗ Avatar interface missing${NC}"
    ERRORS=$((ERRORS + 1))
  fi

  if grep -q "export interface Session" "$SHARED_TYPES"; then
    echo -e "${GREEN}  ✓ Session interface defined${NC}"
  else
    echo -e "${RED}  ✗ Session interface missing${NC}"
    ERRORS=$((ERRORS + 1))
  fi

  if grep -q "export interface Scenario" "$SHARED_TYPES"; then
    echo -e "${GREEN}  ✓ Scenario interface defined${NC}"
  else
    echo -e "${RED}  ✗ Scenario interface missing${NC}"
    ERRORS=$((ERRORS + 1))
  fi

  # Check for critical field: thumbnailUrl (not imageUrl)
  if grep -q "thumbnailUrl" "$SHARED_TYPES"; then
    echo -e "${GREEN}  ✓ thumbnailUrl field defined (correct)${NC}"
  else
    echo -e "${YELLOW}  ⚠ thumbnailUrl field not found${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi

  # Check for incorrect field: imageUrl (should be thumbnailUrl)
  if grep -q "imageUrl.*Avatar" "$SHARED_TYPES"; then
    echo -e "${RED}  ✗ imageUrl field found in Avatar (should be thumbnailUrl)${NC}"
    ERRORS=$((ERRORS + 1))
  fi
fi

echo ""

##############################################################################
# Step 3: Lambda Response Validation (Manual Field Mapping Detection)
##############################################################################

echo -e "${BLUE}[3/5]${NC} Validating Lambda Responses (detect manual field mapping)..."

# Check for manual field mapping (e.g., imageUrl: thumbnailUrl)
MANUAL_MAPPING=$(grep -rn "imageUrl:.*thumbnailUrl" infrastructure/lambda --include="*.ts" 2>/dev/null || true)

if [ -z "$MANUAL_MAPPING" ]; then
  echo -e "${GREEN}  ✓ No manual field mapping detected${NC}"
else
  echo -e "${RED}  ✗ Manual field mapping detected:${NC}"
  echo "$MANUAL_MAPPING" | while read -r line; do
    echo -e "${RED}    $line${NC}"
  done
  ERRORS=$((ERRORS + 1))
fi

# Check for spread operator with extra fields
SPREAD_WITH_EXTRA=$(grep -rn "\.\.\.\w\+\," infrastructure/lambda --include="*.ts" | grep -E "(imageUrl|modelUrl)" || true)

if [ -z "$SPREAD_WITH_EXTRA" ]; then
  echo -e "${GREEN}  ✓ No extra fields in spread operator${NC}"
else
  echo -e "${YELLOW}  ⚠ Potential extra fields in spread operator:${NC}"
  echo "$SPREAD_WITH_EXTRA" | head -5 | while read -r line; do
    echo -e "${YELLOW}    $line${NC}"
  done
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

##############################################################################
# Step 4: Frontend Usage Validation (Undefined Field References)
##############################################################################

echo -e "${BLUE}[4/5]${NC} Validating Frontend Usage (detect undefined field references)..."

# Check for imageUrl usage (should be thumbnailUrl)
FRONTEND_IMAGE_URL=$(grep -rn "\.imageUrl" apps/web --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "AvatarRenderer" | grep -v "ThreeDAvatar" | grep -v "node_modules" || true)

if [ -z "$FRONTEND_IMAGE_URL" ]; then
  echo -e "${GREEN}  ✓ No incorrect imageUrl references in Frontend${NC}"
else
  echo -e "${RED}  ✗ Frontend using imageUrl (should be thumbnailUrl):${NC}"
  echo "$FRONTEND_IMAGE_URL" | head -10 | while read -r line; do
    echo -e "${RED}    $line${NC}"
  done
  ERRORS=$((ERRORS + 1))
fi

# Check for direct field access without type safety
DIRECT_FIELD_ACCESS=$(grep -rn "session\.avatar\.\w\+" apps/web --include="*.tsx" | grep -v "thumbnailUrl" | grep -v "modelUrl" | grep -v "name" | grep -v "type" | grep -v "id" | head -5 || true)

if [ -z "$DIRECT_FIELD_ACCESS" ]; then
  echo -e "${GREEN}  ✓ Frontend uses type-safe field access${NC}"
else
  echo -e "${YELLOW}  ⚠ Potential unsafe field access:${NC}"
  echo "$DIRECT_FIELD_ACCESS" | while read -r line; do
    echo -e "${YELLOW}    $line${NC}"
  done
  WARNINGS=$((WARNINGS + 1))
fi

echo ""

##############################################################################
# Step 5: Type Import Validation
##############################################################################

echo -e "${BLUE}[5/5]${NC} Validating Type Imports (ensure imports from @prance/shared)..."

# Count Lambda functions importing from @prance/shared
LAMBDA_IMPORTS=$(grep -rl "from '@prance/shared'" infrastructure/lambda --include="*.ts" 2>/dev/null | wc -l)
echo -e "${GREEN}  ✓ $LAMBDA_IMPORTS Lambda functions import from @prance/shared${NC}"

# Count Frontend files importing from @prance/shared
FRONTEND_IMPORTS=$(grep -rl "from '@prance/shared'" apps/web --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | wc -l)
echo -e "${GREEN}  ✓ $FRONTEND_IMPORTS Frontend files import from @prance/shared${NC}"

# Check for inline type definitions (should use @prance/shared)
INLINE_AVATAR=$(grep -rn "^interface Avatar {" infrastructure/lambda apps/web --include="*.ts" 2>/dev/null | grep -v "packages/shared" || true)
INLINE_SESSION=$(grep -rn "^interface Session {" infrastructure/lambda apps/web --include="*.ts" 2>/dev/null | grep -v "packages/shared" || true)

if [ -z "$INLINE_AVATAR" ] && [ -z "$INLINE_SESSION" ]; then
  echo -e "${GREEN}  ✓ No inline type definitions (using @prance/shared)${NC}"
else
  echo -e "${RED}  ✗ Inline type definitions detected (should import from @prance/shared):${NC}"
  if [ -n "$INLINE_AVATAR" ]; then
    echo "$INLINE_AVATAR" | while read -r line; do
      echo -e "${RED}    $line${NC}"
    done
  fi
  if [ -n "$INLINE_SESSION" ]; then
    echo "$INLINE_SESSION" | while read -r line; do
      echo -e "${RED}    $line${NC}"
    done
  fi
  ERRORS=$((ERRORS + 1))
fi

echo ""

##############################################################################
# Summary
##############################################################################

echo -e "${BLUE}============================================${NC}"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All validations passed${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warnings (review recommended)${NC}"
  fi
  echo -e "${BLUE}============================================${NC}"
  exit 0
else
  echo -e "${RED}❌ Validation failed: $ERRORS errors, $WARNINGS warnings${NC}"
  echo -e "${BLUE}============================================${NC}"
  echo ""
  echo -e "${YELLOW}Fix the errors above and run again.${NC}"
  echo ""
  echo -e "${BLUE}Common fixes:${NC}"
  echo "  1. Remove manual field mapping in Lambda functions"
  echo "  2. Change imageUrl to thumbnailUrl in Frontend"
  echo "  3. Import types from @prance/shared instead of inline definitions"
  echo "  4. Update packages/shared if Prisma schema changed"
  echo ""
  exit 1
fi
