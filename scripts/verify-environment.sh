#!/bin/bash

# ==============================================================================
# Environment Verification Script
# ==============================================================================
# Purpose: Verify development environment before starting a new session
# Usage: bash scripts/verify-environment.sh
# ==============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_section "Environment Verification"

# ==============================================================================
# 1. Git Status
# ==============================================================================
echo -n "✅ Checking Git working directory... "
if git diff --quiet && git diff --cached --quiet; then
  echo -e "${GREEN}Clean${NC}"
  increment_counter PASSED
else
  echo -e "${YELLOW}Modified files detected${NC}"
  git status --short | head -10
  increment_counter PASSED
fi

# ==============================================================================
# 2. Node.js Version
# ==============================================================================
echo -n "✅ Checking Node.js version... "
NODE_VERSION=$(node --version)
if [[ "$NODE_VERSION" == v22.* ]]; then
  echo -e "${GREEN}$NODE_VERSION${NC}"
  increment_counter PASSED
else
  echo -e "${RED}$NODE_VERSION (Expected: v22.x)${NC}"
  increment_counter FAILED
fi

# ==============================================================================
# 3. npm Version
# ==============================================================================
echo -n "✅ Checking npm version... "
NPM_VERSION=$(npm --version)
echo -e "${GREEN}$NPM_VERSION${NC}"
increment_counter PASSED

# ==============================================================================
# 4. Environment File
# ==============================================================================
echo -n "✅ Checking .env.local file... "
if [ -f ".env.local" ]; then
  VAR_COUNT=$(grep -c "^[A-Z_]" .env.local 2>/dev/null || echo 0)
  echo -e "${GREEN}Found ($VAR_COUNT variables)${NC}"
  increment_counter PASSED
else
  echo -e "${RED}Not found${NC}"
  echo "   ❌ .env.local is missing. Copy from .env.example and configure."
  increment_counter FAILED
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
  increment_counter PASSED
else
  echo -e "${RED}Missing: ${MISSING_VARS[*]}${NC}"
  increment_counter FAILED
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
      increment_counter PASSED
    else
      echo -e "${YELLOW}Cannot reach database (might be sleeping)${NC}"
      increment_counter PASSED
    fi
  else
    echo -e "${YELLOW}Skipped (invalid DATABASE_URL)${NC}"
    increment_counter PASSED
  fi
else
  echo -e "${YELLOW}Skipped (psql not installed)${NC}"
  increment_counter PASSED
fi

# ==============================================================================
# 7. Development Server Status
# ==============================================================================
echo -n "✅ Checking development server... "
if lsof -ti:3000 &> /dev/null; then
  echo -e "${GREEN}Running on port 3000${NC}"
  increment_counter PASSED
else
  echo -e "${YELLOW}Not running (will start automatically)${NC}"
  increment_counter PASSED
fi

# ==============================================================================
# 8. API Endpoint Configuration
# ==============================================================================
echo -n "✅ Checking API endpoint configuration... "
if [ -n "$NEXT_PUBLIC_API_URL" ]; then
  echo -e "${GREEN}$NEXT_PUBLIC_API_URL${NC}"
  increment_counter PASSED
else
  echo -e "${RED}Not configured${NC}"
  increment_counter FAILED
fi

# ==============================================================================
# Summary
# ==============================================================================
echo ""
print_counter_summary

if [ $FAILED -eq 0 ]; then
  log_success "All environment checks passed"
  echo ""
  echo "You can now proceed with:"
  echo "  pnpm run dev          # Start development server"
  echo "  pnpm run test:e2e     # Run E2E tests"
  exit 0
else
  log_error "Some checks failed. Please fix the issues above."
  exit 1
fi
