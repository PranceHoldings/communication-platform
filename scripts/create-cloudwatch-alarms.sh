#!/bin/bash
# Create CloudWatch Alarms for Phase 1.5 Performance Monitoring
#
# Usage:
#   ./scripts/create-cloudwatch-alarms.sh
#   ./scripts/create-cloudwatch-alarms.sh --email your@email.com  # With SNS notifications

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

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
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

log_section "Creating CloudWatch Alarms"

log_warning "Region: $REGION"
log_warning "Function: $FUNCTION_NAME"
if [[ -n "$ALERT_EMAIL" ]]; then
  log_warning "Email: $ALERT_EMAIL"
fi
echo ""

# Create SNS Topic if email is provided
SNS_TOPIC_ARN=""
if [[ -n "$ALERT_EMAIL" ]]; then
  log_warning "Creating SNS topic..."

  SNS_TOPIC_NAME="prance-alarms-${ENVIRONMENT}"
  SNS_TOPIC_ARN=$(aws sns create-topic --region "$REGION" --name "$SNS_TOPIC_NAME" --query 'TopicArn' --output text)

  log_success "SNS topic created: $SNS_TOPIC_ARN"

  # Subscribe email
  aws sns subscribe \
    --region "$REGION" \
    --topic-arn "$SNS_TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$ALERT_EMAIL" > /dev/null

  log_success "Email subscription created (check your inbox to confirm)"
  echo ""
fi

# Alarm 1: High Error Rate (> 5%)
log_warning "Creating alarm: High Error Rate..."
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

log_success "Alarm created: $ALARM_NAME"

# Alarm 2: High Duration (p95 > 6s)
log_warning "Creating alarm: High Duration..."
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

log_success "Alarm created: $ALARM_NAME"

# Alarm 3: Throttles Detected
log_warning "Creating alarm: Throttles..."
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

log_success "Alarm created: $ALARM_NAME"

echo ""
log_section "Summary"

log_success "3 alarms created successfully"
echo ""
echo "Alarms:"
echo "  1. ${ENVIRONMENT}-websocket-high-error-rate"
echo "  2. ${ENVIRONMENT}-websocket-high-duration"
echo "  3. ${ENVIRONMENT}-websocket-throttles"
echo ""
if [[ -n "$SNS_TOPIC_ARN" ]]; then
  echo "SNS Topic: $SNS_TOPIC_ARN"
  echo ""
  log_warning "Check your email ($ALERT_EMAIL) to confirm the subscription"
  echo ""
fi
echo "View alarms:"
echo "https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:"
echo ""
