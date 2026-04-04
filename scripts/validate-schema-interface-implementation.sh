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

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

reset_counters

log_section "Schema-First Validation"
echo ""

##############################################################################
# Step 1: Prisma Schema Analysis
##############################################################################

echo -e "${BLUE}[1/5]${NC} Analyzing Prisma Schema..."

SCHEMA_FILE="packages/database/prisma/schema.prisma"

if [ ! -f "$SCHEMA_FILE" ]; then
  log_error "Prisma schema not found: $SCHEMA_FILE"
else
  # Extract key models and their fields
  AVATAR_FIELDS=$(grep -A 20 "^model Avatar" "$SCHEMA_FILE" | grep -E "^\s+\w+\s+" | wc -l)
  SESSION_FIELDS=$(grep -A 20 "^model Session" "$SCHEMA_FILE" | grep -E "^\s+\w+\s+" | wc -l)
  SCENARIO_FIELDS=$(grep -A 30 "^model Scenario" "$SCHEMA_FILE" | grep -E "^\s+\w+\s+" | wc -l)

  log_success "Avatar model: $AVATAR_FIELDS fields"
  log_success "Session model: $SESSION_FIELDS fields"
  log_success "Scenario model: $SCENARIO_FIELDS fields"
fi

echo ""

##############################################################################
# Step 2: Type Definition Comparison
##############################################################################

echo -e "${BLUE}[2/5]${NC} Comparing Type Definitions (packages/shared vs Prisma)..."

SHARED_TYPES="packages/shared/src/types/index.ts"

if [ ! -f "$SHARED_TYPES" ]; then
  log_error "Shared types not found: $SHARED_TYPES"
else
  # Check if key interfaces exist
  if grep -q "export interface Avatar" "$SHARED_TYPES"; then
    log_success "Avatar interface defined"
  else
    log_error "Avatar interface missing"
  fi

  if grep -q "export interface Session" "$SHARED_TYPES"; then
    log_success "Session interface defined"
  else
    log_error "Session interface missing"
  fi

  if grep -q "export interface Scenario" "$SHARED_TYPES"; then
    log_success "Scenario interface defined"
  else
    log_error "Scenario interface missing"
  fi

  # Check for critical field: thumbnailUrl (not imageUrl)
  if grep -q "thumbnailUrl" "$SHARED_TYPES"; then
    log_success "thumbnailUrl field defined (correct)"
  else
    log_warning "thumbnailUrl field not found"
  fi

  # Check for incorrect field: imageUrl (should be thumbnailUrl)
  if grep -q "imageUrl.*Avatar" "$SHARED_TYPES"; then
    log_error "imageUrl field found in Avatar (should be thumbnailUrl)"
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
  log_success "No manual field mapping detected"
else
  log_error "Manual field mapping detected:"
  echo "$MANUAL_MAPPING" | while read -r line; do
    echo -e "${RED}    $line${NC}"
  done
fi

# Check for spread operator with extra fields
SPREAD_WITH_EXTRA=$(grep -rn "\.\.\.\w\+\," infrastructure/lambda --include="*.ts" | grep -E "(imageUrl|modelUrl)" || true)

if [ -z "$SPREAD_WITH_EXTRA" ]; then
  log_success "No extra fields in spread operator"
else
  log_warning "Potential extra fields in spread operator:"
  echo "$SPREAD_WITH_EXTRA" | head -5 | while read -r line; do
    echo -e "${YELLOW}    $line${NC}"
  done
fi

echo ""

##############################################################################
# Step 4: Frontend Usage Validation (Undefined Field References)
##############################################################################

echo -e "${BLUE}[4/5]${NC} Validating Frontend Usage (detect undefined field references)..."

# Check for imageUrl usage (should be thumbnailUrl)
FRONTEND_IMAGE_URL=$(grep -rn "\.imageUrl" apps/web --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "AvatarRenderer" | grep -v "ThreeDAvatar" | grep -v "node_modules" || true)

if [ -z "$FRONTEND_IMAGE_URL" ]; then
  log_success "No incorrect imageUrl references in Frontend"
else
  log_error "Frontend using imageUrl (should be thumbnailUrl):"
  echo "$FRONTEND_IMAGE_URL" | head -10 | while read -r line; do
    echo -e "${RED}    $line${NC}"
  done
fi

# Check for direct field access without type safety
DIRECT_FIELD_ACCESS=$(grep -rn "session\.avatar\.\w\+" apps/web --include="*.tsx" | grep -v "thumbnailUrl" | grep -v "modelUrl" | grep -v "name" | grep -v "type" | grep -v "id" | head -5 || true)

if [ -z "$DIRECT_FIELD_ACCESS" ]; then
  log_success "Frontend uses type-safe field access"
else
  log_warning "Potential unsafe field access:"
  echo "$DIRECT_FIELD_ACCESS" | while read -r line; do
    echo -e "${YELLOW}    $line${NC}"
  done
fi

echo ""

##############################################################################
# Step 5: Type Import Validation
##############################################################################

echo -e "${BLUE}[5/5]${NC} Validating Type Imports (ensure imports from @prance/shared)..."

# Count Lambda functions importing from @prance/shared
LAMBDA_IMPORTS=$(grep -rl "from '@prance/shared'" infrastructure/lambda --include="*.ts" 2>/dev/null | wc -l)
log_success "$LAMBDA_IMPORTS Lambda functions import from @prance/shared"

# Count Frontend files importing from @prance/shared
FRONTEND_IMPORTS=$(grep -rl "from '@prance/shared'" apps/web --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | wc -l)
log_success "$FRONTEND_IMPORTS Frontend files import from @prance/shared"

# Check for inline type definitions (should use @prance/shared)
INLINE_AVATAR=$(grep -rn "^interface Avatar {" infrastructure/lambda apps/web --include="*.ts" 2>/dev/null | grep -v "packages/shared" || true)
INLINE_SESSION=$(grep -rn "^interface Session {" infrastructure/lambda apps/web --include="*.ts" 2>/dev/null | grep -v "packages/shared" || true)

if [ -z "$INLINE_AVATAR" ] && [ -z "$INLINE_SESSION" ]; then
  log_success "No inline type definitions (using @prance/shared)"
else
  log_error "Inline type definitions detected (should import from @prance/shared):"
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
fi

echo ""

##############################################################################
# Summary
##############################################################################

log_section "Summary"
if [ $ERRORS -eq 0 ]; then
  log_success "All validations passed"
  if [ $WARNINGS -gt 0 ]; then
    log_warning "$WARNINGS warnings (review recommended)"
  fi
  echo ""
  exit 0
else
  log_error "Validation failed: $ERRORS errors, $WARNINGS warnings"
  echo ""
  log_warning "Fix the errors above and run again."
  echo ""
  log_info "Common fixes:"
  echo "  1. Remove manual field mapping in Lambda functions"
  echo "  2. Change imageUrl to thumbnailUrl in Frontend"
  echo "  3. Import types from @prance/shared instead of inline definitions"
  echo "  4. Update packages/shared if Prisma schema changed"
  echo ""
  exit 1
fi
