#!/bin/bash
# WebSocket Integration Test Script
# Tests real WebSocket connection to Dev environment

set -e

echo "🔧 WebSocket Integration Test"
echo "================================"
echo ""

# Step 1: Check environment variables
echo "📋 Step 1: Checking environment variables..."
if [ -z "$NEXT_PUBLIC_WS_ENDPOINT" ]; then
  echo "❌ NEXT_PUBLIC_WS_ENDPOINT is not set"
  exit 1
fi
echo "✅ WebSocket Endpoint: $NEXT_PUBLIC_WS_ENDPOINT"
echo ""

# Step 2: Check if dev server is running
echo "📋 Step 2: Checking dev server..."
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ Dev server is not running. Please start it with 'pnpm run dev'"
  exit 1
fi
echo "✅ Dev server is running"
echo ""

# Step 3: Run WebSocket integration tests
echo "📋 Step 3: Running WebSocket integration tests..."
cd apps/web
pnpm exec playwright test integration/websocket-connection.spec.ts --workers=1 --reporter=line

# Check exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All WebSocket integration tests passed!"
else
  echo ""
  echo "❌ Some tests failed. Check the output above."
fi

exit $EXIT_CODE
