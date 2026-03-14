#!/bin/bash

# CDK Bundling Configuration Validator
# Validates that all shared module paths are correct before deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CDK_STACK="$ROOT_DIR/infrastructure/lib/api-lambda-stack.ts"

echo "=========================================="
echo "CDK Bundling Configuration Validator"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check 1: No wrong path patterns (hardcoded /asset-input without infrastructure/lambda)
echo "[CHECK 1] Checking for wrong shared module paths..."
WRONG_PATHS=$(grep -n "cp -r /asset-input/shared/" "$CDK_STACK" || true)
if [ -n "$WRONG_PATHS" ]; then
  echo -e "${RED}✗ ERROR: Found wrong path patterns (missing infrastructure/lambda):${NC}"
  echo "$WRONG_PATHS"
  echo ""
  echo -e "${YELLOW}Correct pattern: \${inputDir}/infrastructure/lambda/shared/${NC}"
  ((ERRORS++))
else
  echo -e "${GREEN}✓ No wrong path patterns found${NC}"
fi
echo ""

# Check 2: Verify all shared module directories exist
echo "[CHECK 2] Verifying shared module directories exist..."
SHARED_DIR="$ROOT_DIR/infrastructure/lambda/shared"
REQUIRED_MODULES=("ai" "audio" "config" "utils" "types" "auth" "database" "analysis")

for module in "${REQUIRED_MODULES[@]}"; do
  if [ -d "$SHARED_DIR/$module" ]; then
    echo -e "${GREEN}✓ $module${NC}"
  else
    echo -e "${RED}✗ $module (directory not found)${NC}"
    ((ERRORS++))
  fi
done
echo ""

# Check 3: Verify afterBundling consistency
echo "[CHECK 3] Checking afterBundling configuration consistency..."
BUNDLING_COUNT=$(grep -c "afterBundling" "$CDK_STACK" || true)
# Updated to check for variable pattern: ${inputDir}/infrastructure/lambda/shared/
CORRECT_PATH_COUNT=$(grep -c '\${inputDir}/infrastructure/lambda/shared/' "$CDK_STACK" || true)

echo "  Total afterBundling blocks: $BUNDLING_COUNT"
echo "  Correct path references (using \${inputDir}): $CORRECT_PATH_COUNT"

if [ "$CORRECT_PATH_COUNT" -eq 0 ]; then
  echo -e "${RED}✗ ERROR: No correct path references found${NC}"
  echo -e "${YELLOW}Expected pattern: \${inputDir}/infrastructure/lambda/shared/${NC}"
  ((ERRORS++))
else
  echo -e "${GREEN}✓ Configuration appears consistent${NC}"
fi
echo ""

# Check 4: Verify CDK stack compiles
echo "[CHECK 4] Verifying CDK stack compiles..."
cd "$ROOT_DIR/infrastructure"
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ CDK stack compiles successfully${NC}"
else
  echo -e "${RED}✗ ERROR: CDK stack compilation failed${NC}"
  ((ERRORS++))
fi
echo ""

# Summary
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed${NC}"
  echo ""
  echo "Safe to deploy:"
  echo "  cd infrastructure && npx cdk deploy Prance-dev-ApiLambda --require-approval never"
  exit 0
else
  echo -e "${RED}❌ $ERRORS error(s) found${NC}"
  echo ""
  echo "Please fix the errors above before deploying."
  exit 1
fi
