#!/bin/bash
#
# Pre-commit Hook: API Response Structure Validation
#
# This hook prevents commits that violate API response structure standards.
# Automatically runs before every commit.
#
# Exit codes:
#   0 - All checks passed, commit allowed
#   1 - Validation failed, commit blocked
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Pre-commit: API Response Validation${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# Check if Lambda files were modified
LAMBDA_FILES_CHANGED=$(git diff --cached --name-only --diff-filter=ACM | grep "infrastructure/lambda" | grep "\.ts$" || true)

if [ -z "$LAMBDA_FILES_CHANGED" ]; then
  echo -e "${GREEN}✅ No Lambda files modified, skipping validation${NC}"
  echo ""
  exit 0
fi

echo -e "${YELLOW}Lambda files modified:${NC}"
echo "$LAMBDA_FILES_CHANGED" | sed 's/^/  /'
echo ""

# ============================================================
# Validation 1: Response Structure
# ============================================================
echo -e "${BLUE}[1/3]${NC} Validating response structures..."

if bash scripts/validate-lambda-responses.sh > /tmp/response-validation.log 2>&1; then
  echo -e "${GREEN}  ✓ Response structures valid${NC}"
else
  echo -e "${RED}  ✗ Response structure validation failed${NC}"
  echo ""
  cat /tmp/response-validation.log
  echo ""
  echo -e "${RED}❌ COMMIT BLOCKED: Fix response structures before committing${NC}"
  echo ""
  exit 1
fi

# ============================================================
# Validation 2: TypeScript Compilation
# ============================================================
echo -e "${BLUE}[2/3]${NC} Checking TypeScript compilation..."

cd infrastructure
if pnpm run build > /tmp/tsc-build.log 2>&1; then
  echo -e "${GREEN}  ✓ TypeScript compilation successful${NC}"
else
  echo -e "${RED}  ✗ TypeScript compilation failed${NC}"
  echo ""
  cat /tmp/tsc-build.log | head -20
  echo ""
  echo -e "${RED}❌ COMMIT BLOCKED: Fix TypeScript errors before committing${NC}"
  echo ""
  exit 1
fi
cd ..

# ============================================================
# Validation 3: ESLint
# ============================================================
echo -e "${BLUE}[3/3]${NC} Running ESLint on Lambda functions..."

cd infrastructure/lambda
if pnpm exec eslint --quiet . > /tmp/eslint.log 2>&1; then
  echo -e "${GREEN}  ✓ ESLint passed${NC}"
else
  echo -e "${RED}  ✗ ESLint failed${NC}"
  echo ""
  cat /tmp/eslint.log
  echo ""
  echo -e "${RED}❌ COMMIT BLOCKED: Fix ESLint errors before committing${NC}"
  echo ""
  exit 1
fi
cd ../..

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ All validations passed - Commit allowed${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

exit 0
