#!/bin/bash
# Quick restart development server
# Stops existing servers and starts fresh on port 3000 (no build)

set -e

echo "=========================================="
echo "  Prance Development Server - Quick Restart"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop existing Next.js processes
echo -e "${YELLOW}[1/2] Stopping existing servers...${NC}"
pkill -f "next dev" || true
pkill -f "next start" || true

# Kill specific ports
for PORT in 3000 3001 3002; do
  PID=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ ! -z "$PID" ]; then
    echo "  - Killing process on port $PORT (PID: $PID)"
    kill -9 $PID 2>/dev/null || true
  fi
done

sleep 2
echo -e "${GREEN}  ✓ Existing servers stopped${NC}"
echo ""

# Step 2: Start development server
echo -e "${YELLOW}[2/2] Starting development server on port 3000...${NC}"
echo ""
PORT=3000 npm run dev
