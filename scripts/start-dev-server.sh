#!/bin/bash

###############################################################################
# Next.js Development Server Startup Script (v2 - Shared Library版)
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
#   pnpm run dev:start  # via package.json
#
# Exit codes:
#   0 - Server started successfully and responding
#   1 - Failed to start or not responding within timeout
###############################################################################

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Configuration
PORT=3000
MAX_WAIT_SECONDS=60
HEALTH_CHECK_INTERVAL=2
LOG_FILE="/tmp/nextjs-dev.log"
APP_DIR="/workspaces/prance-communication-platform/apps/web"

log_section "Next.js Development Server Startup"

# Step 1: Kill existing processes on port 3000
log_step "1/4" "Checking for existing processes on port ${PORT}"
if lsof -ti:${PORT} > /dev/null 2>&1; then
  echo -e "${YELLOW}Found existing process on port ${PORT}, terminating...${NC}"
  lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true
  sleep 2
  log_success "Port ${PORT} cleared"
else
  log_success "Port ${PORT} is available"
fi

# Also kill any lingering Next.js processes
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
sleep 1

# Step 2: Start Next.js server in background
log_step "2/4" "Starting Next.js development server"
cd "$APP_DIR"

# Clear old log file
> "$LOG_FILE"

# Start server in background
PORT=${PORT} pnpm run dev > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

log_success "Server process started (PID: ${SERVER_PID})"
log_info "Logs: ${LOG_FILE}"

# Step 3: Wait for "Ready" message in logs
log_step "3/4" "Waiting for server to be ready"
READY_TIMEOUT=30
ELAPSED=0

while [ $ELAPSED -lt $READY_TIMEOUT ]; do
  if grep -q "Ready in" "$LOG_FILE"; then
    log_success "Server reported ready"
    break
  fi

  # Check if process is still running
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    log_error "Server process terminated unexpectedly"
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
  log_error "Server did not report ready within ${READY_TIMEOUT} seconds"
  echo -e "${RED}Last 20 lines of log:${NC}"
  tail -n 20 "$LOG_FILE"
  kill -9 $SERVER_PID 2>/dev/null || true
  exit 1
fi

# Step 4: Health check - Verify HTTP response
log_step "4/4" "Performing health check (HTTP requests)"
HEALTH_CHECK_TIMEOUT=$MAX_WAIT_SECONDS
ELAPSED=0
HTTP_SUCCESS=false

while [ $ELAPSED -lt $HEALTH_CHECK_TIMEOUT ]; do
  # Try to connect to server
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${PORT}/ 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    log_success "Server responding (HTTP ${HTTP_CODE})"
    HTTP_SUCCESS=true
    break
  fi

  # Check if process is still running
  if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    log_error "Server process terminated during health check"
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
  log_error "Server not responding to HTTP requests within ${HEALTH_CHECK_TIMEOUT} seconds"
  echo -e "${RED}Last 30 lines of log:${NC}"
  tail -n 30 "$LOG_FILE"
  kill -9 $SERVER_PID 2>/dev/null || true
  exit 1
fi

# Success
echo ""
print_separator
log_success "Server started successfully!"
print_separator
log_info "URL:      http://localhost:${PORT}"
log_info "PID:      ${SERVER_PID}"
log_info "Logs:     tail -f ${LOG_FILE}"
log_info "Stop:     kill ${SERVER_PID}"
print_separator

exit 0
