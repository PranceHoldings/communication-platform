#!/bin/bash
# WebSocket Integration Test Script
# Tests real WebSocket connection to Dev environment

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_section "WebSocket Integration Test"

# Step 1: Check environment variables
log_step 1 "Checking environment variables..."
if [ -z "$NEXT_PUBLIC_WS_ENDPOINT" ]; then
  log_error "NEXT_PUBLIC_WS_ENDPOINT is not set"
  exit 1
fi
log_success "WebSocket Endpoint: $NEXT_PUBLIC_WS_ENDPOINT"
echo ""

# Step 2: Check if dev server is running
log_step 2 "Checking dev server..."
if ! curl -s http://localhost:3000 > /dev/null; then
  log_error "Dev server is not running. Please start it with 'pnpm run dev'"
  exit 1
fi
log_success "Dev server is running"
echo ""

# Step 3: Run WebSocket integration tests
log_step 3 "Running WebSocket integration tests..."
cd apps/web
pnpm exec playwright test integration/websocket-connection.spec.ts --workers=1 --reporter=line

# Check exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  log_success "All WebSocket integration tests passed!"
else
  echo ""
  log_error "Some tests failed. Check the output above."
fi

exit $EXIT_CODE
