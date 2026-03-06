#!/bin/bash
# Clean production server start
# Stops existing servers, builds, and starts production server on port 3000

set -e

echo "=========================================="
echo "  Prance Production Server - Clean Start"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop existing Next.js processes
echo -e "${YELLOW}[1/4] Stopping existing servers...${NC}"
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

# Step 2: Clean build artifacts
echo -e "${YELLOW}[2/4] Cleaning build artifacts...${NC}"
rm -rf .next
rm -rf .next.old-*
rm -rf .next.broken-*
echo -e "${GREEN}  ✓ Build artifacts cleaned${NC}"
echo ""

# Step 3: Build production bundle
echo -e "${YELLOW}[3/4] Building production bundle...${NC}"
npm run build
echo -e "${GREEN}  ✓ Production build completed${NC}"
echo ""

# Step 4: Start production server
echo -e "${YELLOW}[4/4] Starting production server on port 3000...${NC}"
echo ""
PORT=3000 npm run start
