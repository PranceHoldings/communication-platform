#!/bin/bash

###############################################################################
# Next.js Development Server Stop Script (v2 - Shared Library版)
#
# Purpose: Gracefully stop all Next.js dev server processes
#
# Usage:
#   bash scripts/stop-dev-server.sh
#   pnpm run dev:stop  # via package.json
###############################################################################

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PORT=3000

echo -e "${YELLOW}Stopping Next.js development server...${NC}"

# Kill processes on port 3000
if lsof -ti:${PORT} > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing processes on port ${PORT}...${NC}"
  lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true
  log_success "Port ${PORT} cleared"
else
  echo -e "${YELLOW}No process found on port ${PORT}${NC}"
fi

# Kill any Next.js processes
if pgrep -f "next dev" > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing Next.js dev processes...${NC}"
  pkill -9 -f "next dev" 2>/dev/null || true
  log_success "Next.js dev processes killed"
fi

if pgrep -f "next-server" > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing next-server processes...${NC}"
  pkill -9 -f "next-server" 2>/dev/null || true
  log_success "next-server processes killed"
fi

sleep 1

# Verify
if lsof -ti:${PORT} > /dev/null 2>&1 || pgrep -f "next" > /dev/null 2>&1; then
  log_error "Some processes may still be running"
  echo -e "${YELLOW}Remaining processes:${NC}"
  ps aux | grep "next" | grep -v grep || true
  exit 1
else
  log_success "All Next.js processes stopped"
fi

exit 0
