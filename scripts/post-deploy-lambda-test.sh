#!/bin/bash
#
# Post-Deployment Lambda Test Script
# Purpose: Validate Lambda function after deployment
# Prevents silent deployment failures
#
# Usage: bash scripts/post-deploy-lambda-test.sh <function-name> [region]
#


# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

set -e

# Colors

# Check arguments
if [ $# -lt 1 ]; then
  log_error "Error: Function name required"
  echo "Usage: $0 <function-name> [region]"
  exit 1
fi

FUNCTION_NAME="$1"
REGION="${2:-us-east-1}"

log_info "============================================"
log_info "Post-Deployment Lambda Test"
log_info "============================================"
echo ""
echo -e "Function: ${YELLOW}$FUNCTION_NAME${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo ""

TOTAL_CHECKS=0
FAILED_CHECKS=0

# =============================================================================
# Check 1: Lambda function exists
# =============================================================================

echo -e "[CHECK 1/5] Lambda function exists"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Function exists"
else
  echo -e "  ${RED}✗${NC} Function NOT found"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  exit 1
fi

# =============================================================================
# Check 2: Lambda state is Active
# =============================================================================

echo -e "[CHECK 2/5] Lambda state"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

STATE=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Configuration.State' \
  --output text)

if [ "$STATE" == "Active" ]; then
  echo -e "  ${GREEN}✓${NC} State: Active"
else
  echo -e "  ${RED}✗${NC} State: $STATE (expected: Active)"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 3: Last update status
# =============================================================================

echo -e "[CHECK 3/5] Last update status"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

UPDATE_STATUS=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Configuration.LastUpdateStatus' \
  --output text)

if [ "$UPDATE_STATUS" == "Successful" ]; then
  echo -e "  ${GREEN}✓${NC} LastUpdateStatus: Successful"
else
  echo -e "  ${RED}✗${NC} LastUpdateStatus: $UPDATE_STATUS"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 4: CloudWatch Logs errors
# =============================================================================

echo -e "[CHECK 4/5] CloudWatch Logs errors"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

LOG_GROUP="/aws/lambda/$FUNCTION_NAME"
START_TIME=$(($(date +%s) - 300))000  # Last 5 minutes

ERROR_COUNT=$(aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time "$START_TIME" \
  --filter-pattern "ERROR" \
  --max-items 10 \
  --query 'length(events)' \
  --output text 2>/dev/null || echo "0")

if [ "$ERROR_COUNT" == "0" ] || [ "$ERROR_COUNT" == "None" ] || [ -z "$ERROR_COUNT" ]; then
  echo -e "  ${GREEN}✓${NC} No errors in logs (last 5 minutes)"
else
  echo -e "  ${YELLOW}⚠${NC} $ERROR_COUNT errors found in logs"

  # Check specifically for Prisma Client errors
  PRISMA_ERROR=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --filter-pattern "Cannot find module '@prisma/client'" \
    --max-items 1 \
    --query 'events[*].message' \
    --output text 2>/dev/null || echo "")

  if echo "$PRISMA_ERROR" | grep -q "Cannot find module"; then
    echo -e "  ${RED}✗${NC} CRITICAL: Prisma Client not found"
    echo -e "  ${YELLOW}→ This will cause 500 errors in production${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  else
    echo -e "  ${GREEN}✓${NC} No Prisma Client errors"
  fi

  # Check for ffmpeg-static errors (CRITICAL: causes audio processing failures)
  FFMPEG_ERROR=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --filter-pattern "Cannot find module 'ffmpeg-static'" \
    --max-items 1 \
    --query 'events[*].message' \
    --output text 2>/dev/null || echo "")

  if echo "$FFMPEG_ERROR" | grep -q "Cannot find module"; then
    echo -e "  ${RED}✗${NC} CRITICAL: ffmpeg-static not found"
    echo -e "  ${YELLOW}→ This will cause audio processing errors (Failed to process speech)${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  else
    echo -e "  ${GREEN}✓${NC} No ffmpeg-static errors"
  fi

  # Check for Azure Speech SDK errors (CRITICAL: causes STT failures)
  AZURE_ERROR=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --filter-pattern "Cannot find module 'microsoft-cognitiveservices-speech-sdk'" \
    --max-items 1 \
    --query 'events[*].message' \
    --output text 2>/dev/null || echo "")

  if echo "$AZURE_ERROR" | grep -q "Cannot find module"; then
    echo -e "  ${RED}✗${NC} CRITICAL: Azure Speech SDK not found"
    echo -e "  ${YELLOW}→ This will cause speech-to-text errors${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  else
    echo -e "  ${GREEN}✓${NC} No Azure Speech SDK errors"
  fi
fi

# =============================================================================
# Check 5: Test invocation
# =============================================================================

echo -e "[CHECK 5/6] Test invocation"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

TEST_PAYLOAD='{"requestContext":{"routeKey":"$default","connectionId":"test-connection"}}'
INVOKE_RESULT=$(mktemp)

if aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "$TEST_PAYLOAD" \
  "$INVOKE_RESULT" \
  --region "$REGION" \
  --query 'StatusCode' \
  --output text > /dev/null 2>&1; then

  # Check for function errors in response
  if grep -q "errorMessage" "$INVOKE_RESULT"; then
    ERROR_MSG=$(cat "$INVOKE_RESULT" | grep -o '"errorMessage":"[^"]*"' | head -1)
    echo -e "  ${YELLOW}⚠${NC} Invocation succeeded but function returned error:"
    echo -e "  ${YELLOW}→ $ERROR_MSG${NC}"

    # Check if it's a Prisma Client error
    if grep -q "Cannot find module '@prisma/client'" "$INVOKE_RESULT"; then
      echo -e "  ${RED}✗${NC} CRITICAL: Prisma Client not found in Lambda"
      FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
  else
    echo -e "  ${GREEN}✓${NC} Test invocation successful"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Test invocation failed (may be expected for test payload)"
fi

rm -f "$INVOKE_RESULT"

# =============================================================================
# Check 6: Environment variables (FFMPEG_PATH)
# =============================================================================

echo -e "[CHECK 6/7] Environment variables (FFMPEG_PATH)"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

FFMPEG_PATH=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Environment.Variables.FFMPEG_PATH' \
  --output text 2>/dev/null || echo "")

if [ -z "$FFMPEG_PATH" ] || [ "$FFMPEG_PATH" == "None" ]; then
  echo -e "  ${RED}✗${NC} CRITICAL: FFMPEG_PATH not set"
  echo -e "  ${RED}   This will cause audio/video processing errors!${NC}"
  echo -e "  ${YELLOW}   Expected: /var/task/ffmpeg${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
elif [ "$FFMPEG_PATH" != "/var/task/ffmpeg" ]; then
  echo -e "  ${YELLOW}⚠${NC} WARNING: FFMPEG_PATH is set to non-standard path"
  echo -e "  ${YELLOW}   Current: $FFMPEG_PATH${NC}"
  echo -e "  ${YELLOW}   Expected: /var/task/ffmpeg${NC}"
else
  echo -e "  ${GREEN}✓${NC} FFMPEG_PATH is correct: $FFMPEG_PATH"
fi

# =============================================================================
# Check 7: Environment variables (CLOUDFRONT_DOMAIN)
# =============================================================================

echo -e "[CHECK 7/7] Environment variables (CLOUDFRONT_DOMAIN)"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

CLOUDFRONT_DOMAIN=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Environment.Variables.CLOUDFRONT_DOMAIN' \
  --output text 2>/dev/null || echo "")

if [ -z "$CLOUDFRONT_DOMAIN" ] || [ "$CLOUDFRONT_DOMAIN" == "None" ]; then
  echo -e "  ${RED}✗${NC} CRITICAL: CLOUDFRONT_DOMAIN not set"
  echo -e "  ${RED}   This will cause audio playback errors!${NC}"
  echo -e "  ${YELLOW}   Expected: d3mx0sug5s3a6x.cloudfront.net${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
elif [[ ! "$CLOUDFRONT_DOMAIN" =~ \.cloudfront\.net$ ]]; then
  echo -e "  ${RED}✗${NC} CRITICAL: CLOUDFRONT_DOMAIN has invalid format"
  echo -e "  ${RED}   Current: $CLOUDFRONT_DOMAIN${NC}"
  echo -e "  ${YELLOW}   Expected format: *.cloudfront.net${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
else
  echo -e "  ${GREEN}✓${NC} CLOUDFRONT_DOMAIN is valid: $CLOUDFRONT_DOMAIN"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
log_info "============================================"
log_info "Test Summary"
log_info "============================================"
echo ""
echo -e "Total checks: ${TOTAL_CHECKS}"
echo -e "Failed: ${FAILED_CHECKS}"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
  log_success "All post-deployment tests passed"
  echo ""
  log_info "Lambda Details:"
  aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Configuration.[State,LastUpdateStatus,LastModified,CodeSize]' \
    --output table
  echo ""
  exit 0
else
  log_error "Post-deployment tests FAILED"
  echo ""
  log_warning "Fix the issues and redeploy"
  echo ""
  exit 1
fi
