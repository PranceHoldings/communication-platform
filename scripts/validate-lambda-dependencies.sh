#!/bin/bash
#
# Lambda Dependencies Validation Script
# Purpose: Verify all required SDKs are installed in Lambda functions
# CRITICAL: Missing SDKs cause 500 errors in production
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Lambda Dependencies Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

FAILED=0
TOTAL_CHECKS=0
MISSING_DEPS=()

# =============================================================================
# Check Lambda function dependencies
# =============================================================================

check_lambda_deps() {
  local lambda_dir="$1"
  local lambda_name="$2"
  shift 2
  local required_deps=("$@")

  echo -e "${BLUE}[CHECK]${NC} $lambda_name"

  # Check if package.json exists
  if [ ! -f "$lambda_dir/package.json" ]; then
    echo -e "  ${RED}✗ package.json not found${NC}"
    FAILED=1
    return
  fi

  # Check if node_modules exists
  if [ ! -d "$lambda_dir/node_modules" ]; then
    echo -e "  ${RED}✗ node_modules not found (not installed)${NC}"
    echo -e "  ${YELLOW}→ Run: cd $lambda_dir && npm install${NC}"
    FAILED=1
    MISSING_DEPS+=("$lambda_name")
    return
  fi

  # Check each required dependency
  local missing_count=0
  for dep in "${required_deps[@]}"; do
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ -d "$lambda_dir/node_modules/$dep" ]; then
      echo -e "  ${GREEN}✓${NC} $dep"
    else
      echo -e "  ${RED}✗${NC} $dep ${RED}(MISSING)${NC}"
      missing_count=$((missing_count + 1))
      FAILED=1
    fi
  done

  if [ $missing_count -gt 0 ]; then
    MISSING_DEPS+=("$lambda_name")
    echo -e "  ${YELLOW}→ Missing $missing_count dependencies${NC}"
  fi

  echo ""
}

# =============================================================================
# WebSocket Lambda Functions
# =============================================================================

echo -e "${BLUE}━━━ WebSocket Lambda Functions ━━━${NC}"
echo ""

# WebSocket Default Handler (CRITICAL - Real-time processing)
check_lambda_deps \
  "infrastructure/lambda/websocket/default" \
  "WebSocket Default Handler" \
  "microsoft-cognitiveservices-speech-sdk" \
  "@aws-sdk/client-bedrock-runtime" \
  "@aws-sdk/client-s3" \
  "@aws-sdk/client-apigatewaymanagementapi" \
  "ffmpeg-static"

# WebSocket Connect Handler
check_lambda_deps \
  "infrastructure/lambda/websocket/connect" \
  "WebSocket Connect Handler" \
  "@aws-sdk/client-dynamodb" \
  "@aws-sdk/lib-dynamodb"

# WebSocket Disconnect Handler
check_lambda_deps \
  "infrastructure/lambda/websocket/disconnect" \
  "WebSocket Disconnect Handler" \
  "@aws-sdk/client-dynamodb" \
  "@aws-sdk/lib-dynamodb"

# =============================================================================
# REST API Lambda Functions (Sample checks)
# =============================================================================

echo -e "${BLUE}━━━ REST API Lambda Functions ━━━${NC}"
echo ""

# Sessions Analysis (CRITICAL - Rekognition processing)
if [ -d "infrastructure/lambda/sessions/analysis" ]; then
  check_lambda_deps \
    "infrastructure/lambda/sessions/analysis" \
    "Sessions Analysis Handler" \
    "@aws-sdk/client-s3" \
    "@aws-sdk/client-rekognition"
fi

# =============================================================================
# Summary
# =============================================================================

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Total checks: $TOTAL_CHECKS"

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ All Lambda dependencies validated${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Lambda dependencies validation FAILED${NC}"
  echo ""
  echo -e "${YELLOW}Missing dependencies in:${NC}"
  for lambda in "${MISSING_DEPS[@]}"; do
    echo -e "  - $lambda"
  done
  echo ""
  echo -e "${YELLOW}Fix steps:${NC}"
  echo -e "  1. Run: ${BLUE}./scripts/fix-lambda-node-modules.sh${NC}"
  echo -e "  2. Or manually: ${BLUE}cd <lambda-dir> && npm install${NC}"
  echo -e "  3. Redeploy Lambda functions"
  echo ""
  exit 1
fi
