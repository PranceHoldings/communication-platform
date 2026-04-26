#!/bin/bash

# E2E Test Runner for WebSocket Voice Conversation
# Usage: ./scripts/run-e2e-tests.sh [test-name]

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log_section "E2E Test Runner - WebSocket Voice Conversation"

# Configuration — E2E tests run against deployed environments only
BASE_URL="${BASE_URL:-https://dev.app.prance.jp}"
WS_URL="${WS_URL:-wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev}"

echo "Configuration:"
echo "  BASE_URL: ${BASE_URL}"
echo "  WS_URL: ${WS_URL}"
echo ""

log_info "Testing against: ${BASE_URL}"

cd "${PROJECT_ROOT}"

# Run tests
echo ""
log_section "Running E2E Tests"

if [ -n "$1" ]; then
  # Run specific test
  log_info "Running test: $1"
  pnpm exec playwright test --grep "$1" --reporter=list
else
  # Run all tests
  log_info "Running all E2E tests"
  pnpm exec playwright test --reporter=list,html
fi

TEST_EXIT_CODE=$?


echo ""
print_separator
if [ ${TEST_EXIT_CODE} -eq 0 ]; then
  log_success "All tests passed!"
else
  log_error "Some tests failed"
fi
print_separator
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
