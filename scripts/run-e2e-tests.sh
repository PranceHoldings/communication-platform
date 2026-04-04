#!/bin/bash

# E2E Test Runner for WebSocket Voice Conversation
# Usage: ./scripts/run-e2e-tests.sh [test-name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=========================================="
echo "E2E Test Runner - WebSocket Voice Conversation"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev}"

echo "Configuration:"
echo "  BASE_URL: ${BASE_URL}"
echo "  WS_URL: ${WS_URL}"
echo ""

# Check if Next.js server is running
echo "Checking Next.js server..."
if curl -sf "${BASE_URL}" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Next.js server is running${NC}"
else
  echo -e "${YELLOW}⚠️  Next.js server is not running${NC}"
  echo "  Starting server in background..."
  cd "${PROJECT_ROOT}/apps/web"
  pnpm run dev > /tmp/nextjs-dev.log 2>&1 &
  NEXTJS_PID=$!
  echo "  PID: ${NEXTJS_PID}"

  # Wait for server to start (max 60 seconds)
  echo "  Waiting for server to start..."
  for i in {1..60}; do
    if curl -sf "${BASE_URL}" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Server started successfully${NC}"
      break
    fi
    sleep 1
    echo -n "."
  done
  echo ""
fi

cd "${PROJECT_ROOT}"

# Run tests
echo ""
echo "=========================================="
echo "Running E2E Tests"
echo "=========================================="
echo ""

if [ -n "$1" ]; then
  # Run specific test
  echo "Running test: $1"
  pnpm exec playwright test --grep "$1" --reporter=list
else
  # Run all tests
  echo "Running all E2E tests"
  pnpm exec playwright test --reporter=list,html
fi

TEST_EXIT_CODE=$?

# Cleanup
if [ -n "${NEXTJS_PID}" ]; then
  echo ""
  echo "Stopping Next.js server (PID: ${NEXTJS_PID})..."
  kill ${NEXTJS_PID} 2>/dev/null || true
fi

echo ""
echo "=========================================="
if [ ${TEST_EXIT_CODE} -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
else
  echo -e "${RED}❌ Some tests failed${NC}"
fi
echo "=========================================="
echo ""

# Show report location
if [ ! -n "$1" ]; then
  echo "HTML report available at:"
  echo "  file://${PROJECT_ROOT}/playwright-report/index.html"
  echo ""
  echo "To view the report:"
  echo "  pnpm exec playwright show-report"
  echo ""
fi

exit ${TEST_EXIT_CODE}
