#!/bin/bash
#
# API Type Usage Validator (v2 - Shared Library版)
#
# Validates that Frontend API calls use types from @prance/shared
# Prevents type mismatches between caller and callee
#
# Exit codes:
#   0 - All API calls use shared types
#   1 - Type mismatches detected
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

FRONTEND_DIR="apps/web"

log_section "Validating API Type Usage"

# ============================================================
# Check 1: Frontend API functions use shared types
# ============================================================
echo "Checking Frontend API functions..."

# Find all API function files
API_FILES=$(find "$FRONTEND_DIR/lib/api" -name "*.ts" -type f | grep -v "client.ts" || true)

NO_TYPE_ANNOTATIONS=0
for file in $API_FILES; do
  # Check if file has apiClient calls
  if grep -q "apiClient\." "$file"; then
    # Check if file imports types from @prance/shared
    if ! grep -q "from '@prance/shared'" "$file"; then
      log_warning "Missing import: $file"
      echo "   Should import response types from '@prance/shared'"
      ((NO_TYPE_ANNOTATIONS++))
    fi

    # Check for inline interface definitions (anti-pattern)
    if grep -q "^interface.*Response {" "$file"; then
      log_error "Inline interface detected: $file"
      echo "   Use shared types from '@prance/shared' instead"
      increment_counter ERRORS
    fi
  fi
done

if [ $NO_TYPE_ANNOTATIONS -gt 0 ]; then
  echo ""
  log_warning "Fix: Import types from @prance/shared"
  echo "  import type { GuestSessionListResponse } from '@prance/shared';"
  echo ""
fi

# ============================================================
# Check 2: Lambda functions implement shared response types
# ============================================================
echo "Checking Lambda function implementations..."

LAMBDA_HANDLERS=$(find "infrastructure/lambda" -name "index.ts" -type f | grep -v "shared/" || true)

for handler in $LAMBDA_HANDLERS; do
  # Check if handler exports a response type that matches API contract
  if grep -q "export const handler" "$handler"; then
    # Extract function name from path
    dir=$(dirname "$handler")
    relative_path=${dir#infrastructure/lambda/}

    # Check if it has explicit return type
    if ! grep -q "Promise<StandardLambdaResponse" "$handler"; then
      log_warning "Missing return type: $handler"
      echo "   Should use: Promise<StandardLambdaResponse<ResponseType>>"
    fi
  fi
done

# ============================================================
# Check 3: Type consistency between Frontend and Lambda
# ============================================================
echo ""
echo "Checking type consistency..."

# This is done by TypeScript compiler, but we can add additional checks
log_success "Type checking delegated to TypeScript compiler"

# ============================================================
# Summary
# ============================================================
echo ""
print_separator

if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ API type usage is consistent${NC}"
  echo ""
  echo "Best practices:"
  echo "  1. Always import types from @prance/shared"
  echo "  2. Never define inline response interfaces"
  echo "  3. Use StandardAPIResponse<T> for all API responses"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Found ${ERRORS} type consistency violation(s)${NC}"
  echo ""
  echo "Documentation:"
  echo "  - packages/shared/src/types/api.ts"
  echo "  - packages/shared/src/types/api-endpoints.ts"
  echo ""
  exit 1
fi
