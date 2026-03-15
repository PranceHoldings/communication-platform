#!/bin/bash

##############################################
# Deployment Method Validation Script
# Purpose: Prevent manual zip upload to Lambda
# Created: 2026-03-15
##############################################

set -e

echo "============================================"
echo "Deployment Method Validation"
echo "============================================"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "[1/3] Checking for manual zip files in Lambda directories..."
ZIP_FILES=$(find infrastructure/lambda -name "*.zip" -o -name "lambda-deployment.zip" 2>/dev/null || true)

if [ -n "$ZIP_FILES" ]; then
  echo ""
  echo -e "${RED}❌ ERROR: Manual zip files detected!${NC}"
  echo ""
  echo "Found zip files:"
  echo "$ZIP_FILES"
  echo ""
  echo -e "${RED}Manual zip upload is FORBIDDEN.${NC}"
  echo ""
  echo "Reason:"
  echo "  - TypeScript files (.ts) are not transpiled to JavaScript (.js)"
  echo "  - Lambda Runtime expects .js files → Runtime.ImportModuleError"
  echo "  - esbuild bundling process is skipped"
  echo ""
  echo "Correct deployment method:"
  echo "  cd infrastructure && npm run deploy:lambda"
  echo ""
  echo "To remove these zip files:"
  echo "  find infrastructure/lambda -name '*.zip' -delete"
  echo ""
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}  ✓ No manual zip files found${NC}"
fi

echo ""
echo "[2/3] Checking CDK output directory..."
if [ -d "infrastructure/cdk.out" ]; then
  CDK_AGE=$(find infrastructure/cdk.out -name "*.template.json" -mmin +60 2>/dev/null | wc -l)
  if [ "$CDK_AGE" -gt 0 ]; then
    echo -e "${YELLOW}  ⚠ Warning: CDK output is older than 60 minutes${NC}"
    echo "  Consider clearing cache: rm -rf infrastructure/cdk.out"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${GREEN}  ✓ CDK output is recent${NC}"
  fi
else
  echo -e "${GREEN}  ✓ No CDK output directory (clean state)${NC}"
fi

echo ""
echo "[3/3] Validating deployment process documentation..."
if ! grep -q "手動zipアップロード絶対禁止" memory/deployment-rules.md 2>/dev/null; then
  echo -e "${YELLOW}  ⚠ Warning: deployment-rules.md may need update${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}  ✓ Deployment rules documented${NC}"
fi

echo ""
echo "============================================"
echo "Validation Summary"
echo "============================================"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Validation FAILED with $ERRORS error(s)${NC}"
  echo ""
  echo "Manual zip files must be removed before deployment."
  echo "Use CDK deployment process only."
  echo ""
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠ Validation PASSED with $WARNINGS warning(s)${NC}"
  echo ""
  echo "You may proceed, but please review the warnings above."
  echo ""
  exit 0
else
  echo -e "${GREEN}✅ All validations passed${NC}"
  echo ""
  echo "Deployment method is correct."
  echo "Proceed with: cd infrastructure && npm run deploy:lambda"
  echo ""
  exit 0
fi
