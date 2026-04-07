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
if [[ "$NODE_VERSION" == v22.* ]] || [[ "$NODE_VERSION" == v24.* ]]; then
  echo -e "${GREEN}$NODE_VERSION${NC}"
  increment_counter PASSED
else
  echo -e "${RED}$NODE_VERSION (Expected: v22.x or v24.x)${NC}"
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
  "NEXT_PUBLIC_WS_ENDPOINT"
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
# 7. Tailwind CSS Build (required before dev server)
# ==============================================================================
echo -n "✅ Checking Tailwind CSS... "
TAILWIND_OUTPUT="$SCRIPT_DIR/../apps/web/styles/tailwind.output.css"
if [ -f "$TAILWIND_OUTPUT" ]; then
  echo -e "${GREEN}Built ($(du -h "$TAILWIND_OUTPUT" | cut -f1))${NC}"
  increment_counter PASSED
else
  echo -e "${YELLOW}Not built - building now...${NC}"
  TAILWIND_BUILD_SCRIPT="$SCRIPT_DIR/../apps/web/scripts/build-tailwind-host.sh"
  if [ -f "$TAILWIND_BUILD_SCRIPT" ]; then
    if bash "$TAILWIND_BUILD_SCRIPT" > /tmp/tailwind-build.log 2>&1; then
      echo -e "   ${GREEN}✅ Tailwind CSS built successfully${NC}"
      increment_counter PASSED
    else
      echo -e "   ${RED}❌ Tailwind CSS build failed${NC}"
      tail -10 /tmp/tailwind-build.log | sed 's/^/   /'
      increment_counter FAILED
    fi
  else
    echo -e "   ${RED}❌ build-tailwind-host.sh not found${NC}"
    increment_counter FAILED
  fi
fi

# ==============================================================================
# 8. Development Server (auto-start if not running)
# ==============================================================================
echo -n "✅ Checking development server... "
SERVER_WAS_STARTED=false
if lsof -ti:3000 &> /dev/null; then
  echo -e "${GREEN}Running on port 3000${NC}"
  increment_counter PASSED
else
  echo -e "${YELLOW}Not running - starting now...${NC}"
  # Start dev server in background, redirect output to log
  DEV_SERVER_LOG="/tmp/dev-server-$(date +%Y%m%d-%H%M%S).log"
  (cd "$SCRIPT_DIR/.." && pnpm run dev > "$DEV_SERVER_LOG" 2>&1) &
  DEV_SERVER_PID=$!
  SERVER_WAS_STARTED=true

  # Wait for server to be ready (up to 60 seconds)
  echo -n "   Waiting for server to be ready"
  READY=false
  for i in $(seq 1 60); do
    sleep 1
    echo -n "."
    if lsof -ti:3000 &> /dev/null; then
      # Port is open, but wait a bit more for Next.js to finish initializing
      sleep 2
      READY=true
      break
    fi
  done
  echo ""

  if [ "$READY" = true ]; then
    echo -e "   ${GREEN}✅ Server started (log: $DEV_SERVER_LOG)${NC}"
    increment_counter PASSED
  else
    echo -e "   ${RED}❌ Server failed to start within 60s (log: $DEV_SERVER_LOG)${NC}"
    tail -20 "$DEV_SERVER_LOG" 2>/dev/null | sed 's/^/   /'
    increment_counter FAILED
  fi
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
# 9. Browser Rendering Verification
# ==============================================================================
echo -n "✅ Checking browser rendering... "
if lsof -ti:3000 &> /dev/null; then
  RENDERING_SCRIPT="${SCRIPT_DIR}/verify-rendering.sh"

  if [ -f "$RENDERING_SCRIPT" ]; then
    # Step 1: HTTP + HTML content check
    if bash "$RENDERING_SCRIPT" --skip-screenshot > /dev/null 2>&1; then
      # Step 2: Screenshot capture
      SCREENSHOT_FILE="/tmp/verify-rendering-$(date +%Y%m%d-%H%M%S).png"
      if bash "$RENDERING_SCRIPT" --output "$SCREENSHOT_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}Verified (HTTP + HTML + Screenshot)${NC}"
        echo "   📸 Screenshot: $SCREENSHOT_FILE"
      else
        echo -e "${GREEN}Verified (HTTP + HTML)${NC}"
        echo -e "   ${YELLOW}⚠ Screenshot skipped (Playwright not available)${NC}"
      fi
      increment_counter PASSED
    else
      # Show what went wrong
      RENDER_OUTPUT=$(bash "$RENDERING_SCRIPT" --skip-screenshot 2>&1)
      echo -e "${RED}Failed${NC}"
      echo "$RENDER_OUTPUT" | grep -E "ERROR|error|failed|Failed" | head -5 | sed 's/^/   /'
      increment_counter FAILED
    fi
  else
    echo -e "${RED}verify-rendering.sh not found${NC}"
    increment_counter FAILED
  fi
else
  echo -e "${YELLOW}Skipped (server failed to start)${NC}"
  increment_counter PASSED
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
