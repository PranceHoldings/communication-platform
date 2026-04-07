#!/bin/bash
#
# Lambda Response Structure Validator (v2 - Shared Library版)
#
# Validates that all Lambda functions return standard response structure.
# Detects direct response construction (forbidden pattern).
#
# Exit codes:
#   0 - All Lambda functions use standard responses
#   1 - Direct response construction detected
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

LAMBDA_DIR="infrastructure/lambda"

log_section "Validating Lambda Response Structures"

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
  log_error "Direct response construction detected:"
  echo "$DIRECT_RESPONSES" | while IFS= read -r line; do
    echo "  $line"
    increment_counter ERRORS
  done
  echo ""
  log_warning "FIX: Use successResponse() or errorResponse()"
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
  log_warning "JSON.stringify() without success field:"
  echo "$INVALID_JSON" | while IFS= read -r line; do
    echo "  $line"
    increment_counter ERRORS
  done
  echo ""
  log_warning "FIX: Ensure response has { success: true/false } structure"
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
      log_warning "Missing import: $handler"
      ((MISSING_IMPORTS++))
    fi
  fi
done

if [ $MISSING_IMPORTS -gt 0 ]; then
  echo ""
  log_warning "FIX: Import response utilities:"
  echo "  import { successResponse, errorResponse } from '../../shared/utils/response';"
  echo ""
  for ((i=0; i<MISSING_IMPORTS; i++)); do
    increment_counter ERRORS
  done
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
  log_warning "Lambda handlers without explicit return types:"
  echo "$MISSING_RETURN_TYPES" | while IFS= read -r line; do
    echo "  $line"
    increment_counter ERRORS
  done
  echo ""
  log_warning "FIX: Add explicit return type:"
  echo "  export const handler = async (event): Promise<StandardLambdaResponse<MyDataType>> => {"
  echo ""
fi

# ============================================================
# Summary
# ============================================================
print_separator

if [ "$ERRORS" -eq 0 ]; then
  log_success "All Lambda functions use standard response structure"
  echo ""
  exit 0
else
  log_error "Found ${ERRORS} response structure violation(s)"
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
