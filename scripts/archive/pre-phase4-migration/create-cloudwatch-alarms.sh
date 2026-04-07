#!/bin/bash
# Create CloudWatch Alarms for Phase 1.5 Performance Monitoring
#
# Usage:
#   ./scripts/create-cloudwatch-alarms.sh
#   ./scripts/create-cloudwatch-alarms.sh --email your@email.com  # With SNS notifications

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="prance-websocket-default-dev"
ENVIRONMENT="dev"

# Parse arguments
ALERT_EMAIL=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --email)
      ALERT_EMAIL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}Creating CloudWatch Alarms${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Function:${NC} $FUNCTION_NAME"
if [[ -n "$ALERT_EMAIL" ]]; then
  echo -e "${YELLOW}Email:${NC} $ALERT_EMAIL"
fi
echo ""

# Create SNS Topic if email is provided
SNS_TOPIC_ARN=""
if [[ -n "$ALERT_EMAIL" ]]; then
  echo -e "${YELLOW}Creating SNS topic...${NC}"

  SNS_TOPIC_NAME="prance-alarms-${ENVIRONMENT}"
  SNS_TOPIC_ARN=$(aws sns create-topic --region "$REGION" --name "$SNS_TOPIC_NAME" --query 'TopicArn' --output text)

  echo -e "${GREEN}✓${NC} SNS topic created: $SNS_TOPIC_ARN"

  # Subscribe email
  aws sns subscribe \
    --region "$REGION" \
    --topic-arn "$SNS_TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$ALERT_EMAIL" > /dev/null

  echo -e "${GREEN}✓${NC} Email subscription created (check your inbox to confirm)"
  echo ""
fi

# Alarm 1: High Error Rate (> 5%)
echo -e "${YELLOW}Creating alarm: High Error Rate...${NC}"
ALARM_NAME="${ENVIRONMENT}-websocket-high-error-rate"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "$ALARM_NAME" \
  --alarm-description "WebSocket error rate exceeds 5%" \
  --actions-enabled \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
  --period 300 \
  --evaluation-periods 2 \
  --datapoints-to-alarm 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  ${SNS_TOPIC_ARN:+--alarm-actions "$SNS_TOPIC_ARN"} > /dev/null

echo -e "${GREEN}✓${NC} Alarm created: $ALARM_NAME"

# Alarm 2: High Duration (p95 > 6s)
echo -e "${YELLOW}Creating alarm: High Duration...${NC}"
ALARM_NAME="${ENVIRONMENT}-websocket-high-duration"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "$ALARM_NAME" \
  --alarm-description "WebSocket p95 duration exceeds 6 seconds (Phase 1.5 target)" \
  --actions-enabled \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --extended-statistic p95 \
  --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
  --period 300 \
  --evaluation-periods 3 \
  --datapoints-to-alarm 2 \
  --threshold 6000 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  ${SNS_TOPIC_ARN:+--alarm-actions "$SNS_TOPIC_ARN"} > /dev/null

echo -e "${GREEN}✓${NC} Alarm created: $ALARM_NAME"

# Alarm 3: Throttles Detected
echo -e "${YELLOW}Creating alarm: Throttles...${NC}"
ALARM_NAME="${ENVIRONMENT}-websocket-throttles"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "$ALARM_NAME" \
  --alarm-description "WebSocket Lambda is being throttled" \
  --actions-enabled \
  --metric-name Throttles \
  --namespace AWS/Lambda \
  --statistic Sum \
  --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  ${SNS_TOPIC_ARN:+--alarm-actions "$SNS_TOPIC_ARN"} > /dev/null

echo -e "${GREEN}✓${NC} Alarm created: $ALARM_NAME"

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "${GREEN}✅ 3 alarms created successfully${NC}"
echo ""
echo "Alarms:"
echo "  1. ${ENVIRONMENT}-websocket-high-error-rate"
echo "  2. ${ENVIRONMENT}-websocket-high-duration"
echo "  3. ${ENVIRONMENT}-websocket-throttles"
echo ""
if [[ -n "$SNS_TOPIC_ARN" ]]; then
  echo "SNS Topic: $SNS_TOPIC_ARN"
  echo ""
  echo -e "${YELLOW}⚠️  Check your email ($ALERT_EMAIL) to confirm the subscription${NC}"
  echo ""
fi
echo "View alarms:"
echo "https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:"
echo ""
