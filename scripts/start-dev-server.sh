#!/bin/bash

###############################################################################
# Next.js Development Server Startup Script
#
# Purpose: Start Next.js dev server and verify it's responding to HTTP requests
#
# Features:
# - Kill existing processes on port 3000
# - Start Next.js in background
# - Wait for "Ready" message in logs
# - Health check with retry logic (max 60 seconds)
# - Return success only when server responds to HTTP requests
#
# Usage:
#   bash scripts/start-dev-server.sh
#   npm run dev:start  # via package.json
#
# Exit codes:
#   0 - Server started successfully and responding
#   1 - Failed to start or not responding within timeout
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=3000
MAX_WAIT_SECONDS=60
HEALTH_CHECK_INTERVAL=2
LOG_FILE="/tmp/nextjs-dev.log"
APP_DIR="/workspaces/prance-communication-platform/apps/web"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Next.js Development Server Startup${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Kill existing processes on port 3000
echo -e "\n${YELLOW}[1/4] Checking for existing processes on port ${PORT}...${NC}"
if lsof -ti:${PORT} > /dev/null 2>&1; then
  echo -e "${YELLOW}Found existing process on port ${PORT}, terminating...${NC}"
  lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true
  sleep 2
  echo -e "${GREEN}✓ Port ${PORT} cleared${NC}"
else
  echo -e "${GREEN}✓ Port ${PORT} is available${NC}"
fi

# Also kill any lingering Next.js processes
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
sleep 1

# Step 2: Start Next.js server in background
echo -e "\n${YELLOW}[2/4] Starting Next.js development server...${NC}"
cd "$APP_DIR"

# Clear old log file
> "$LOG_FILE"

# Start server in background
PORT=${PORT} npm run dev > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo -e "${GREEN}✓ Server process started (PID: ${SERVER_PID})${NC}"
echo -e "${BLUE}   Logs: ${LOG_FILE}${NC}"

# Step 3: Wait for "Ready" message in logs
echo -e "\n${YELLOW}[3/4] Waiting for server to be ready...${NC}"
READY_TIMEOUT=30
ELAPSED=0

while [ $ELAPSED -lt $READY_TIMEOUT ]; do
  if grep -q "Ready in" "$LOG_FILE"; then
    echo -e "${GREEN}✓ Server reported ready${NC}"
    break
  fi

  # Check if process is still running
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo -e "${RED}✗ Server process terminated unexpectedly${NC}"
    echo -e "${RED}Last 20 lines of log:${NC}"
    tail -n 20 "$LOG_FILE"
    exit 1
  fi

  sleep 1
  ELAPSED=$((ELAPSED + 1))
  echo -ne "\r${BLUE}   Waiting... ${ELAPSED}/${READY_TIMEOUT}s${NC}"
done
echo "" # New line after progress indicator

if [ $ELAPSED -ge $READY_TIMEOUT ]; then
  echo -e "${RED}✗ Server did not report ready within ${READY_TIMEOUT} seconds${NC}"
  echo -e "${RED}Last 20 lines of log:${NC}"
  tail -n 20 "$LOG_FILE"
  kill -9 $SERVER_PID 2>/dev/null || true
  exit 1
fi

# Step 4: Health check - Verify HTTP response
echo -e "\n${YELLOW}[4/4] Performing health check (HTTP requests)...${NC}"
HEALTH_CHECK_TIMEOUT=$MAX_WAIT_SECONDS
ELAPSED=0
HTTP_SUCCESS=false

while [ $ELAPSED -lt $HEALTH_CHECK_TIMEOUT ]; do
  # Try to connect to server
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${PORT}/ 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    echo -e "${GREEN}✓ Server responding (HTTP ${HTTP_CODE})${NC}"
    HTTP_SUCCESS=true
    break
  fi

  # Check if process is still running
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo -e "${RED}✗ Server process terminated during health check${NC}"
    echo -e "${RED}Last 20 lines of log:${NC}"
    tail -n 20 "$LOG_FILE"
    exit 1
  fi

  sleep $HEALTH_CHECK_INTERVAL
  ELAPSED=$((ELAPSED + HEALTH_CHECK_INTERVAL))
  echo -ne "\r${BLUE}   Trying to connect... ${ELAPSED}/${HEALTH_CHECK_TIMEOUT}s (HTTP ${HTTP_CODE})${NC}"
done
echo "" # New line after progress indicator

if [ "$HTTP_SUCCESS" = false ]; then
  echo -e "${RED}✗ Server not responding to HTTP requests within ${HEALTH_CHECK_TIMEOUT} seconds${NC}"
  echo -e "${RED}Last 30 lines of log:${NC}"
  tail -n 30 "$LOG_FILE"
  kill -9 $SERVER_PID 2>/dev/null || true
  exit 1
fi

# Success
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Server started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}URL:${NC}      http://localhost:${PORT}"
echo -e "${BLUE}PID:${NC}      ${SERVER_PID}"
echo -e "${BLUE}Logs:${NC}     tail -f ${LOG_FILE}"
echo -e "${BLUE}Stop:${NC}     kill ${SERVER_PID}"
echo -e "${GREEN}========================================${NC}"

exit 0
