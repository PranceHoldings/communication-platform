#!/bin/bash

# ==============================================================================
# Environment Verification Script
# ==============================================================================
# Purpose: Verify development environment before starting a new session
# Usage: bash scripts/verify-environment.sh
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

echo "=========================================="
echo "  Environment Verification"
echo "=========================================="
echo ""

# ==============================================================================
# 1. Git Status
# ==============================================================================
echo -n "✅ Checking Git working directory... "
if git diff --quiet && git diff --cached --quiet; then
  echo -e "${GREEN}Clean${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}Modified files detected${NC}"
  git status --short | head -10
  ((PASSED++))
fi

# ==============================================================================
# 2. Node.js Version
# ==============================================================================
echo -n "✅ Checking Node.js version... "
NODE_VERSION=$(node --version)
if [[ "$NODE_VERSION" == v22.* ]]; then
  echo -e "${GREEN}$NODE_VERSION${NC}"
  ((PASSED++))
else
  echo -e "${RED}$NODE_VERSION (Expected: v22.x)${NC}"
  ((FAILED++))
fi

# ==============================================================================
# 3. npm Version
# ==============================================================================
echo -n "✅ Checking npm version... "
NPM_VERSION=$(npm --version)
echo -e "${GREEN}$NPM_VERSION${NC}"
((PASSED++))

# ==============================================================================
# 4. Environment File
# ==============================================================================
echo -n "✅ Checking .env.local file... "
if [ -f ".env.local" ]; then
  VAR_COUNT=$(grep -c "^[A-Z_]" .env.local 2>/dev/null || echo 0)
  echo -e "${GREEN}Found ($VAR_COUNT variables)${NC}"
  ((PASSED++))
else
  echo -e "${RED}Not found${NC}"
  echo "   ❌ .env.local is missing. Copy from .env.example and configure."
  ((FAILED++))
fi

# ==============================================================================
# 5. Required Environment Variables
# ==============================================================================
echo -n "✅ Checking required environment variables... "
source .env.local 2>/dev/null || true

REQUIRED_VARS=(
  "DATABASE_URL"
  "AWS_REGION"
  "NEXT_PUBLIC_API_URL"
  "NEXT_PUBLIC_WS_URL"
  "JWT_SECRET"
)

MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
  echo -e "${GREEN}All set${NC}"
  ((PASSED++))
else
  echo -e "${RED}Missing: ${MISSING_VARS[*]}${NC}"
  ((FAILED++))
fi

# ==============================================================================
# 6. Database Connection
# ==============================================================================
echo -n "✅ Checking database connection... "
if command -v psql &> /dev/null; then
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
  if [ -n "$DB_HOST" ]; then
    if nc -z -w5 "$DB_HOST" 5432 &> /dev/null; then
      echo -e "${GREEN}Connected${NC}"
      ((PASSED++))
    else
      echo -e "${YELLOW}Cannot reach database (might be sleeping)${NC}"
      ((PASSED++))
    fi
  else
    echo -e "${YELLOW}Skipped (invalid DATABASE_URL)${NC}"
    ((PASSED++))
  fi
else
  echo -e "${YELLOW}Skipped (psql not installed)${NC}"
  ((PASSED++))
fi

# ==============================================================================
# 7. Development Server Status
# ==============================================================================
echo -n "✅ Checking development server... "
if lsof -ti:3000 &> /dev/null; then
  echo -e "${GREEN}Running on port 3000${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}Not running (will start automatically)${NC}"
  ((PASSED++))
fi

# ==============================================================================
# 8. API Endpoint Configuration
# ==============================================================================
echo -n "✅ Checking API endpoint configuration... "
if [ -n "$NEXT_PUBLIC_API_URL" ]; then
  echo -e "${GREEN}$NEXT_PUBLIC_API_URL${NC}"
  ((PASSED++))
else
  echo -e "${RED}Not configured${NC}"
  ((FAILED++))
fi

# ==============================================================================
# Summary
# ==============================================================================
echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "Failed: ${RED}$FAILED${NC}"
else
  echo -e "Failed: ${GREEN}$FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All environment checks passed${NC}"
  echo ""
  echo "You can now proceed with:"
  echo "  npm run dev          # Start development server"
  echo "  npm run test:e2e     # Run E2E tests"
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Please fix the issues above.${NC}"
  exit 1
fi
