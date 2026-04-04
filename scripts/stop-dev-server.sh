#!/bin/bash

###############################################################################
# Next.js Development Server Stop Script
#
# Purpose: Gracefully stop all Next.js dev server processes
#
# Usage:
#   bash scripts/stop-dev-server.sh
#   pnpm run dev:stop  # via package.json
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PORT=3000

echo -e "${YELLOW}Stopping Next.js development server...${NC}"

# Kill processes on port 3000
if lsof -ti:${PORT} > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing processes on port ${PORT}...${NC}"
  lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓ Port ${PORT} cleared${NC}"
else
  echo -e "${YELLOW}No process found on port ${PORT}${NC}"
fi

# Kill any Next.js processes
if pgrep -f "next dev" > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing Next.js dev processes...${NC}"
  pkill -9 -f "next dev" 2>/dev/null || true
  echo -e "${GREEN}✓ Next.js dev processes killed${NC}"
fi

if pgrep -f "next-server" > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing next-server processes...${NC}"
  pkill -9 -f "next-server" 2>/dev/null || true
  echo -e "${GREEN}✓ next-server processes killed${NC}"
fi

sleep 1

# Verify
if lsof -ti:${PORT} > /dev/null 2>&1 || pgrep -f "next" > /dev/null 2>&1; then
  echo -e "${RED}✗ Some processes may still be running${NC}"
  echo -e "${YELLOW}Remaining processes:${NC}"
  ps aux | grep "next" | grep -v grep || true
  exit 1
else
  echo -e "${GREEN}✓ All Next.js processes stopped${NC}"
fi

exit 0
