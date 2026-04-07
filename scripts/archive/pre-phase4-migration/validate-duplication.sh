#!/bin/bash

# ============================================================
# Duplication Management Validation Script
# ============================================================
# Purpose: Detect duplicate configurations, types, constants across codebase
# Usage: bash scripts/validate-duplication.sh
# Exit Code: 0 = success, 1 = duplications found
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "============================================================"
echo "Duplication Management Validation"
echo "============================================================"
echo ""

# ============================================================
# Step 1: Environment Variable Duplication Check
# ============================================================
echo -e "${YELLOW}[1/8]${NC} Checking environment variable duplication..."

# Count direct process.env accesses (excluding legitimate cases)
ENV_ACCESSES=$(grep -rn "process\.env\." infrastructure/lambda --include="*.ts" --exclude-dir=node_modules \
  | grep -v ".test.ts" \
  | grep -v ".spec.ts" \
  | grep -v "shared/config/defaults.ts" \
  | grep -v "shared/database/prisma.ts" \
  | grep -v "shared/utils/elasticache-client.ts" \
  | grep -v "shared/utils/url-generator.ts" \
  | grep -v "shared/utils/ffmpeg-helper.ts" \
  | grep -v "shared/utils/response.ts" \
  | grep -v "shared/types/api-response.ts" \
  | grep -v "shared/utils/runtime-config-loader.ts" \
  | grep -v "shared/utils/error-logger.ts" \
  | grep -v "migrations/index.ts" \
  | grep -v "AWS_LAMBDA_FUNCTION_NAME" \
  | grep -v "NODE_ENV" \
  | wc -l || echo "0")

if [ "$ENV_ACCESSES" -gt 0 ]; then
  echo -e "${RED}❌ Found $ENV_ACCESSES direct process.env accesses (should use centralized config)${NC}"
  grep -rn "process\.env\." infrastructure/lambda --include="*.ts" --exclude-dir=node_modules \
    | grep -v ".test.ts" \
    | grep -v ".spec.ts" \
    | grep -v "shared/config/defaults.ts" \
    | grep -v "shared/database/prisma.ts" \
    | grep -v "shared/utils/elasticache-client.ts" \
    | grep -v "shared/utils/url-generator.ts" \
    | grep -v "shared/utils/ffmpeg-helper.ts" \
    | grep -v "shared/utils/response.ts" \
    | grep -v "shared/types/api-response.ts" \
    | grep -v "shared/utils/runtime-config-loader.ts" \
    | grep -v "shared/utils/error-logger.ts" \
    | grep -v "AWS_LAMBDA_FUNCTION_NAME" \
    | grep -v "NODE_ENV" \
    | head -10
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ No unauthorized environment variable accesses${NC}"
fi

# ============================================================
# Step 2: Type Definition Duplication Check
# ============================================================
echo -e "${YELLOW}[2/8]${NC} Checking type definition duplication..."

# Check for EmotionScore, AgeRange, Pose duplicates
TYPE_DUPLICATES=0

if grep -q "^export interface EmotionScore" infrastructure/lambda/shared/analysis/rekognition.ts 2>/dev/null; then
  echo -e "${RED}❌ EmotionScore defined in rekognition.ts (should import from types/index.ts)${NC}"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

if grep -q "^export interface AgeRange" infrastructure/lambda/shared/analysis/rekognition.ts 2>/dev/null; then
  echo -e "${RED}❌ AgeRange defined in rekognition.ts (should import from types/index.ts)${NC}"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

if grep -q "^export interface Pose" infrastructure/lambda/shared/analysis/rekognition.ts 2>/dev/null; then
  echo -e "${RED}❌ Pose defined in rekognition.ts (should import from types/index.ts)${NC}"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

# Check OrganizationSettings consistency
SHARED_HAS_INITIAL=$(grep -c "initialSilenceTimeout" packages/shared/src/types/index.ts || echo "0")
LAMBDA_HAS_INITIAL=$(grep -c "initialSilenceTimeout" infrastructure/lambda/shared/types/organization.ts || echo "0")

if [ "$SHARED_HAS_INITIAL" != "$LAMBDA_HAS_INITIAL" ]; then
  echo -e "${RED}❌ OrganizationSettings inconsistent: initialSilenceTimeout mismatch${NC}"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

if [ "$TYPE_DUPLICATES" -gt 0 ]; then
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No type definition duplicates${NC}"
fi

# ============================================================
# Step 3: Enum Synchronization Check
# ============================================================
echo -e "${YELLOW}[3/8]${NC} Checking enum synchronization..."

# Compare UserRole enum
SHARED_USER_ROLE=$(grep "export type UserRole" packages/shared/src/types/index.ts | sed 's/.*= //' | tr -d "'" | tr '|' '\n' | sort)
LAMBDA_USER_ROLE=$(grep "export type UserRole" infrastructure/lambda/shared/types/index.ts | sed 's/.*= //' | tr -d "'" | tr '|' '\n' | sort)

if [ "$SHARED_USER_ROLE" != "$LAMBDA_USER_ROLE" ]; then
  echo -e "${RED}❌ UserRole enum mismatch between packages/shared and infrastructure/lambda/shared${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ Enum definitions synchronized${NC}"
fi

# ============================================================
# Step 4: Constants/Configuration Duplication
# ============================================================
echo -e "${YELLOW}[4/8]${NC} Checking constants/configuration duplication..."

# Verify all constants are in defaults.ts
CONSTANT_GROUPS=$(grep -c "^export const.*DEFAULTS = {" infrastructure/lambda/shared/config/defaults.ts || echo "0")

if [ "$CONSTANT_GROUPS" -lt 15 ]; then
  echo -e "${YELLOW}⚠️  Expected 15+ constant groups, found $CONSTANT_GROUPS${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ Constants properly centralized ($CONSTANT_GROUPS groups)${NC}"
fi

# ============================================================
# Step 5: Utility Function Duplication
# ============================================================
echo -e "${YELLOW}[5/8]${NC} Checking utility function duplication..."

# Count utility files
UTIL_FILES=$(find infrastructure/lambda/shared/utils -name "*.ts" -type f | wc -l)

# Check for duplicate utils outside shared/
DUPLICATE_UTILS=$(find infrastructure/lambda -name "*-utils.ts" -type f | grep -v shared/utils | grep -v node_modules | wc -l)

if [ "$DUPLICATE_UTILS" -gt 1 ]; then
  echo -e "${YELLOW}⚠️  Found $DUPLICATE_UTILS utility files outside shared/utils (verify they're not duplicates)${NC}"
  find infrastructure/lambda -name "*-utils.ts" -type f | grep -v shared/utils | grep -v node_modules
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ Utility functions centralized ($UTIL_FILES files in shared/utils)${NC}"
fi

# ============================================================
# Step 6: Validation Logic Duplication
# ============================================================
echo -e "${YELLOW}[6/8]${NC} Checking validation logic duplication..."

VALIDATION_FILES=$(find infrastructure/lambda -name "*validat*.ts" -type f | grep -v node_modules | grep -v ".test.ts" | wc -l)

if [ "$VALIDATION_FILES" -lt 3 ]; then
  echo -e "${YELLOW}⚠️  Expected 3 validation files, found $VALIDATION_FILES${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ Validation logic centralized ($VALIDATION_FILES files)${NC}"
fi

# ============================================================
# Step 7: Frontend API Call Duplication
# ============================================================
echo -e "${YELLOW}[7/8]${NC} Checking frontend API call duplication..."

# Check for direct fetch() calls bypassing API client
DIRECT_FETCH=$(grep -rn "fetch(" apps/web/app apps/web/components --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l || echo "0")

if [ "$DIRECT_FETCH" -gt 0 ]; then
  echo -e "${RED}❌ Found $DIRECT_FETCH direct fetch() calls (should use API client)${NC}"
  grep -rn "fetch(" apps/web/app apps/web/components --include="*.ts" --include="*.tsx" | grep -v node_modules | head -5
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ All API calls go through centralized client${NC}"
fi

# ============================================================
# Step 8: Lambda Function Duplicate Implementation
# ============================================================
echo -e "${YELLOW}[8/8]${NC} Checking Lambda function duplicate implementation..."

# Count Lambda functions
LAMBDA_FUNCTIONS=$(find infrastructure/lambda -maxdepth 1 -type d | grep -v node_modules | grep -v shared | wc -l)

# Verify shared/ directory exists and has required subdirectories
REQUIRED_DIRS=("config" "utils" "types" "analysis" "scenario")
MISSING_DIRS=0

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "infrastructure/lambda/shared/$dir" ]; then
    echo -e "${RED}❌ Missing shared/$dir directory${NC}"
    MISSING_DIRS=$((MISSING_DIRS + 1))
  fi
done

if [ "$MISSING_DIRS" -gt 0 ]; then
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ Lambda functions properly structured ($LAMBDA_FUNCTIONS functions)${NC}"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "============================================================"
echo "Validation Summary"
echo "============================================================"

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed (0 errors, 0 warnings)${NC}"
  echo ""
  exit 0
elif [ "$ERRORS" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Validation passed with warnings${NC}"
  echo -e "${YELLOW}   Errors: $ERRORS${NC}"
  echo -e "${YELLOW}   Warnings: $WARNINGS${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Validation failed${NC}"
  echo -e "${RED}   Errors: $ERRORS${NC}"
  echo -e "${YELLOW}   Warnings: $WARNINGS${NC}"
  echo ""
  echo "Please fix the errors above before committing/deploying."
  echo ""
  exit 1
fi
