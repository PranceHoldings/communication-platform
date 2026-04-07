#!/bin/bash
# Phase 1.5 Performance Metrics Collection Script
#
# Collects CloudWatch metrics for WebSocket Lambda functions:
# - Invocation count
# - Duration (average, p95, max)
# - Error rate
# - Concurrent executions
#
# Usage:
#   ./scripts/collect-metrics.sh              # Last 1 hour
#   ./scripts/collect-metrics.sh --hours 24   # Last 24 hours
#   ./scripts/collect-metrics.sh --days 7     # Last 7 days

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="prance-websocket-default-dev"

# Parse arguments
HOURS=1
DAYS=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --hours)
      HOURS="$2"
      shift 2
      ;;
    --days)
      DAYS="$2"
      HOURS=$((DAYS * 24))
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Calculate start and end times
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
START_TIME=$(date -u -d "$HOURS hours ago" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -v-${HOURS}H +"%Y-%m-%dT%H:%M:%S")

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}📊 CloudWatch Metrics Collection${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "${YELLOW}Function:${NC} $FUNCTION_NAME"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Time Range:${NC} Last $HOURS hours"
echo -e "${YELLOW}Period:${NC} $START_TIME to $END_TIME"
echo ""

# Function to get metric statistics
get_metric_stats() {
  local metric_name=$1
  local stat_type=$2
  local period=$3

  aws cloudwatch get-metric-statistics \
    --region "$REGION" \
    --namespace "AWS/Lambda" \
    --metric-name "$metric_name" \
    --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period "$period" \
    --statistics "$stat_type" \
    --query 'Datapoints[0].['"$stat_type"']' \
    --output text 2>/dev/null || echo "N/A"
}

# 1. Invocation Count
echo -e "${GREEN}1. Invocation Metrics${NC}"
echo "---"

INVOCATIONS=$(get_metric_stats "Invocations" "Sum" 3600)
echo "  Total Invocations: $INVOCATIONS"

ERRORS=$(get_metric_stats "Errors" "Sum" 3600)
echo "  Total Errors: $ERRORS"

THROTTLES=$(get_metric_stats "Throttles" "Sum" 3600)
echo "  Total Throttles: $THROTTLES"

# Calculate error rate
if [[ "$INVOCATIONS" != "N/A" ]] && [[ "$ERRORS" != "N/A" ]] && (( $(echo "$INVOCATIONS > 0" | bc -l) )); then
  ERROR_RATE=$(echo "scale=2; ($ERRORS / $INVOCATIONS) * 100" | bc)
  echo "  Error Rate: ${ERROR_RATE}%"
fi

echo ""

# 2. Duration Metrics
echo -e "${GREEN}2. Duration Metrics${NC}"
echo "---"

DURATION_AVG=$(get_metric_stats "Duration" "Average" 3600)
DURATION_P95=$(get_metric_stats "Duration" "ExtendedStatistics" 3600)
DURATION_MAX=$(get_metric_stats "Duration" "Maximum" 3600)

echo "  Average Duration: ${DURATION_AVG}ms"
echo "  P95 Duration: ${DURATION_P95}ms"
echo "  Max Duration: ${DURATION_MAX}ms"

echo ""

# 3. Concurrent Executions
echo -e "${GREEN}3. Concurrent Executions${NC}"
echo "---"

CONCURRENT_AVG=$(get_metric_stats "ConcurrentExecutions" "Average" 3600)
CONCURRENT_MAX=$(get_metric_stats "ConcurrentExecutions" "Maximum" 3600)

echo "  Average Concurrent: $CONCURRENT_AVG"
echo "  Max Concurrent: $CONCURRENT_MAX"

echo ""

# 4. Check if metrics meet Phase 1.5 criteria
echo -e "${GREEN}4. Phase 1.5 Completion Criteria${NC}"
echo "---"

# Note: These are Lambda execution times, not end-to-end response times
# For full pipeline metrics, use the performance-test.ts script

if [[ "$DURATION_AVG" != "N/A" ]]; then
  AVG_SEC=$(echo "scale=2; $DURATION_AVG / 1000" | bc)
  if (( $(echo "$AVG_SEC < 4.0" | bc -l) )); then
    echo -e "  ✅ Average Duration < 4s: ${GREEN}PASS${NC} (${AVG_SEC}s)"
  else
    echo -e "  ❌ Average Duration < 4s: ${RED}FAIL${NC} (${AVG_SEC}s)"
  fi
fi

if [[ "$ERROR_RATE" != "" ]]; then
  if (( $(echo "$ERROR_RATE < 5.0" | bc -l) )); then
    echo -e "  ✅ Error Rate < 5%: ${GREEN}PASS${NC} (${ERROR_RATE}%)"
  else
    echo -e "  ❌ Error Rate < 5%: ${RED}FAIL${NC} (${ERROR_RATE}%)"
  fi
fi

echo ""

# 5. Recent errors (last 10)
echo -e "${GREEN}5. Recent Errors (Last 10)${NC}"
echo "---"

aws logs filter-log-events \
  --region "$REGION" \
  --log-group-name "/aws/lambda/$FUNCTION_NAME" \
  --filter-pattern "ERROR" \
  --start-time "$(($(date +%s) - 3600))000" \
  --max-items 10 \
  --query 'events[*].[timestamp,message]' \
  --output text 2>/dev/null | while read -r timestamp message; do
    if [[ -n "$timestamp" ]]; then
      DATE=$(date -d "@$((timestamp / 1000))" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r $((timestamp / 1000)) "+%Y-%m-%d %H:%M:%S")
      echo "  [$DATE] ${message:0:100}"
    fi
  done || echo "  No recent errors found"

echo ""
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: For end-to-end performance metrics, run:${NC}"
echo -e "   pnpm run perf:test"
echo ""
