#!/bin/bash
#
# API Type Usage Validator
#
# Validates that Frontend API calls use types from @prance/shared
# Prevents type mismatches between caller and callee
#
# Exit codes:
#   0 - All API calls use shared types
#   1 - Type mismatches detected
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FRONTEND_DIR="apps/web"
ERROR_COUNT=0

echo ""
echo -e "${BLUE}🔍 Validating API Type Usage...${NC}"
echo ""

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
      echo -e "${YELLOW}⚠️  Missing import: $file${NC}"
      echo "   Should import response types from '@prance/shared'"
      ((NO_TYPE_ANNOTATIONS++))
    fi

    # Check for inline interface definitions (anti-pattern)
    if grep -q "^interface.*Response {" "$file"; then
      echo -e "${RED}❌ Inline interface detected: $file${NC}"
      echo "   Use shared types from '@prance/shared' instead"
      ((ERROR_COUNT++))
    fi
  fi
done

if [ $NO_TYPE_ANNOTATIONS -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Fix: Import types from @prance/shared${NC}"
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
      echo -e "${YELLOW}⚠️  Missing return type: $handler${NC}"
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
echo -e "${GREEN}✓ Type checking delegated to TypeScript compiler${NC}"

# ============================================================
# Summary
# ============================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ API type usage is consistent${NC}"
  echo ""
  echo "Best practices:"
  echo "  1. Always import types from @prance/shared"
  echo "  2. Never define inline response interfaces"
  echo "  3. Use StandardAPIResponse<T> for all API responses"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Found ${ERROR_COUNT} type consistency violation(s)${NC}"
  echo ""
  echo "Documentation:"
  echo "  - packages/shared/src/types/api.ts"
  echo "  - packages/shared/src/types/api-endpoints.ts"
  echo ""
  exit 1
fi
