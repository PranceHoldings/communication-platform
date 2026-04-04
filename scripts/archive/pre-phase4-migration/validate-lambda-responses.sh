#!/bin/bash
#
# Lambda Response Structure Validator
#
# Validates that all Lambda functions return standard response structure.
# Detects direct response construction (forbidden pattern).
#
# Exit codes:
#   0 - All Lambda functions use standard responses
#   1 - Direct response construction detected
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

LAMBDA_DIR="infrastructure/lambda"
ERROR_COUNT=0

echo ""
echo "🔍 Validating Lambda Response Structures..."
echo ""

# ============================================================
# Pattern 1: Direct response construction (FORBIDDEN)
# ============================================================
echo "Checking for direct response construction..."

DIRECT_RESPONSES=$(grep -rn "return {" "$LAMBDA_DIR" --include="*.ts" --exclude-dir=node_modules \
  --exclude-dir=node_modules \
  | grep "statusCode:" \
  | grep "body:" \
  | grep -v "shared/utils/response.ts" \
  | grep -v ".eslintrc.js" \
  | grep -v "// ALLOWED:" || true)

if [ -n "$DIRECT_RESPONSES" ]; then
  echo -e "${RED}❌ Direct response construction detected:${NC}"
  echo "$DIRECT_RESPONSES" | while IFS= read -r line; do
    echo "  $line"
    ((ERROR_COUNT++))
  done
  echo ""
  echo -e "${YELLOW}FIX: Use successResponse() or errorResponse()${NC}"
  echo "Example:"
  echo "  return successResponse({ items: data });"
  echo ""
fi

# ============================================================
# Pattern 2: JSON.stringify without success field
# ============================================================
echo "Checking for JSON.stringify() without success field..."

INVALID_JSON=$(grep -rn "JSON.stringify({" "$LAMBDA_DIR" --include="*.ts" --exclude-dir=node_modules \
  | grep -v "success:" \
  | grep -v "shared/utils/response.ts" \
  | grep -v "console.log" \
  | grep -v "console.error" \
  | grep -v ".eslintrc.js" || true)

if [ -n "$INVALID_JSON" ]; then
  echo -e "${YELLOW}⚠️  JSON.stringify() without success field:${NC}"
  echo "$INVALID_JSON" | while IFS= read -r line; do
    echo "  $line"
    ((ERROR_COUNT++))
  done
  echo ""
  echo -e "${YELLOW}FIX: Ensure response has { success: true/false } structure${NC}"
  echo ""
fi

# ============================================================
# Pattern 3: Import verification
# ============================================================
echo "Checking for missing response utility imports..."

LAMBDA_HANDLERS=$(find "$LAMBDA_DIR" -name "index.ts" -type f | grep -v "shared/" || true)

MISSING_IMPORTS=0
for handler in $LAMBDA_HANDLERS; do
  # Check if file has return statements with statusCode/body
  if grep -q "return" "$handler" && grep -q "statusCode" "$handler"; then
    # Check if it imports response utilities
    if ! grep -q "from.*shared/utils/response" "$handler"; then
      echo -e "${YELLOW}⚠️  Missing import: $handler${NC}"
      ((MISSING_IMPORTS++))
    fi
  fi
done

if [ $MISSING_IMPORTS -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}FIX: Import response utilities:${NC}"
  echo "  import { successResponse, errorResponse } from '../../shared/utils/response';"
  echo ""
  ((ERROR_COUNT += MISSING_IMPORTS))
fi

# ============================================================
# Pattern 4: Handler return type verification
# ============================================================
echo "Checking Lambda handler return types..."

MISSING_RETURN_TYPES=$(grep -rn "export const handler = async" "$LAMBDA_DIR" --include="index.ts" \
  | grep -v ": Promise<StandardLambdaResponse" \
  | grep -v ": Promise<APIGatewayProxyResult>" \
  | grep -v "shared/" || true)

if [ -n "$MISSING_RETURN_TYPES" ]; then
  echo -e "${YELLOW}⚠️  Lambda handlers without explicit return types:${NC}"
  echo "$MISSING_RETURN_TYPES" | while IFS= read -r line; do
    echo "  $line"
    ((ERROR_COUNT++))
  done
  echo ""
  echo -e "${YELLOW}FIX: Add explicit return type:${NC}"
  echo "  export const handler = async (event): Promise<StandardLambdaResponse<MyDataType>> => {"
  echo ""
fi

# ============================================================
# Summary
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ All Lambda functions use standard response structure${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Found ${ERROR_COUNT} response structure violation(s)${NC}"
  echo ""
  echo "Documentation:"
  echo "  - infrastructure/lambda/shared/types/api-response.ts"
  echo "  - infrastructure/lambda/shared/utils/response.ts"
  echo ""
  echo "Standard response structure:"
  echo "  { success: true, data: { ... } }          // Success"
  echo "  { success: false, error: { code, message } } // Error"
  echo ""
  exit 1
fi
