#!/bin/bash

# ============================================================
# Duplication Management Validation Script
# ============================================================
# Purpose: Detect duplicate configurations, types, constants across codebase
# Usage: bash scripts/validate-duplication.sh
# Exit Code: 0 = success, 1 = duplications found
# ============================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

reset_counters

log_section "Duplication Management Validation"
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
  log_error "Found $ENV_ACCESSES direct process.env accesses (should use centralized config)"
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
  increment_counter WARNINGS
else
  log_success "No unauthorized environment variable accesses"
fi

# ============================================================
# Step 2: Type Definition Duplication Check
# ============================================================
echo -e "${YELLOW}[2/8]${NC} Checking type definition duplication..."

# Check for EmotionScore, AgeRange, Pose duplicates
TYPE_DUPLICATES=0

if grep -q "^export interface EmotionScore" infrastructure/lambda/shared/analysis/rekognition.ts 2>/dev/null; then
  log_error "EmotionScore defined in rekognition.ts (should import from types/index.ts)"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

if grep -q "^export interface AgeRange" infrastructure/lambda/shared/analysis/rekognition.ts 2>/dev/null; then
  log_error "AgeRange defined in rekognition.ts (should import from types/index.ts)"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

if grep -q "^export interface Pose" infrastructure/lambda/shared/analysis/rekognition.ts 2>/dev/null; then
  log_error "Pose defined in rekognition.ts (should import from types/index.ts)"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

# Check OrganizationSettings consistency
SHARED_HAS_INITIAL=$(grep -c "initialSilenceTimeout" packages/shared/src/types/index.ts || echo "0")
LAMBDA_HAS_INITIAL=$(grep -c "initialSilenceTimeout" infrastructure/lambda/shared/types/organization.ts || echo "0")

if [ "$SHARED_HAS_INITIAL" != "$LAMBDA_HAS_INITIAL" ]; then
  log_error "OrganizationSettings inconsistent: initialSilenceTimeout mismatch"
  TYPE_DUPLICATES=$((TYPE_DUPLICATES + 1))
fi

if [ "$TYPE_DUPLICATES" -gt 0 ]; then
  increment_counter ERRORS
else
  log_success "No type definition duplicates"
fi

# ============================================================
# Step 3: Enum Synchronization Check
# ============================================================
echo -e "${YELLOW}[3/8]${NC} Checking enum synchronization..."

# Compare UserRole enum
SHARED_USER_ROLE=$(grep "export type UserRole" packages/shared/src/types/index.ts | sed 's/.*= //' | tr -d "'" | tr '|' '\n' | sort)
LAMBDA_USER_ROLE=$(grep "export type UserRole" infrastructure/lambda/shared/types/index.ts | sed 's/.*= //' | tr -d "'" | tr '|' '\n' | sort)

if [ "$SHARED_USER_ROLE" != "$LAMBDA_USER_ROLE" ]; then
  log_error "UserRole enum mismatch between packages/shared and infrastructure/lambda/shared"
else
  log_success "Enum definitions synchronized"
fi

# ============================================================
# Step 4: Constants/Configuration Duplication
# ============================================================
echo -e "${YELLOW}[4/8]${NC} Checking constants/configuration duplication..."

# Verify all constants are in defaults.ts
CONSTANT_GROUPS=$(grep -c "^export const.*DEFAULTS = {" infrastructure/lambda/shared/config/defaults.ts || echo "0")

if [ "$CONSTANT_GROUPS" -lt 15 ]; then
  log_warning "Expected 15+ constant groups, found $CONSTANT_GROUPS"
else
  log_success "Constants properly centralized ($CONSTANT_GROUPS groups)"
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
  log_warning "Found $DUPLICATE_UTILS utility files outside shared/utils (verify they're not duplicates)"
  find infrastructure/lambda -name "*-utils.ts" -type f | grep -v shared/utils | grep -v node_modules
else
  log_success "Utility functions centralized ($UTIL_FILES files in shared/utils)"
fi

# ============================================================
# Step 6: Validation Logic Duplication
# ============================================================
echo -e "${YELLOW}[6/8]${NC} Checking validation logic duplication..."

VALIDATION_FILES=$(find infrastructure/lambda -name "*validat*.ts" -type f | grep -v node_modules | grep -v ".test.ts" | wc -l)

if [ "$VALIDATION_FILES" -lt 3 ]; then
  log_warning "Expected 3 validation files, found $VALIDATION_FILES"
else
  log_success "Validation logic centralized ($VALIDATION_FILES files)"
fi

# ============================================================
# Step 7: Frontend API Call Duplication
# ============================================================
echo -e "${YELLOW}[7/8]${NC} Checking frontend API call duplication..."

# Check for direct fetch() calls bypassing API client
# Exclude apps/web/app/api/ — those are Next.js API routes (server-side proxy/handlers)
# that legitimately call fetch() to proxy requests to the backend Lambda.
DIRECT_FETCH=$(grep -rn "fetch(" apps/web/app apps/web/components --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules \
  | grep -v "apps/web/app/api/" \
  | wc -l || echo "0")

if [ "$DIRECT_FETCH" -gt 0 ]; then
  log_error "Found $DIRECT_FETCH direct fetch() calls (should use API client)"
  grep -rn "fetch(" apps/web/app apps/web/components --include="*.ts" --include="*.tsx" \
    | grep -v node_modules | grep -v "apps/web/app/api/" | head -5
else
  log_success "All API calls go through centralized client"
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
    log_error "Missing shared/$dir directory"
    MISSING_DIRS=$((MISSING_DIRS + 1))
  fi
done

if [ "$MISSING_DIRS" -gt 0 ]; then
  increment_counter ERRORS
else
  log_success "Lambda functions properly structured ($LAMBDA_FUNCTIONS functions)"
fi

# ============================================================
# Summary
# ============================================================
echo ""
log_section "Validation Summary"

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  log_success "All checks passed (0 errors, 0 warnings)"
  echo ""
  exit 0
elif [ "$ERRORS" -eq 0 ]; then
  log_warning "Validation passed with warnings"
  log_warning "   Errors: $ERRORS"
  log_warning "   Warnings: $WARNINGS"
  echo ""
  exit 0
else
  log_error "Validation failed"
  log_error "   Errors: $ERRORS"
  log_warning "   Warnings: $WARNINGS"
  echo ""
  echo "Please fix the errors above before committing/deploying."
  echo ""
  exit 1
fi
