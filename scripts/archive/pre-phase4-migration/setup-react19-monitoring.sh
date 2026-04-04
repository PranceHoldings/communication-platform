#!/bin/bash
# setup-react19-monitoring.sh - React 19 Monitoring Dashboard Setup
# Creates CloudWatch dashboards and alarms for React 19 deployment monitoring

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 React 19 Monitoring Setup${NC}"
echo "=============================================="

# Configuration
ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-us-east-1}"
DASHBOARD_NAME="React19-Migration-${ENVIRONMENT}"

echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"
echo ""

# Step 1: Create CloudWatch Dashboard
echo -e "${YELLOW}Step 1: Creating CloudWatch Dashboard...${NC}"

DASHBOARD_BODY=$(cat <<'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Errors", { "stat": "Sum", "label": "Lambda Errors" } ],
          [ ".", "Throttles", { "stat": "Sum", "label": "Lambda Throttles" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Lambda Error Rate",
        "period": 300,
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Duration", { "stat": "Average", "label": "Avg Duration" } ],
          [ "...", { "stat": "p95", "label": "P95 Duration" } ],
          [ "...", { "stat": "p99", "label": "P99 Duration" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Lambda Response Time",
        "period": 300,
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "AWS/CloudFront", "Requests", { "stat": "Sum", "label": "Total Requests" } ],
          [ ".", "4xxErrorRate", { "stat": "Average", "label": "4xx Error Rate" } ],
          [ ".", "5xxErrorRate", { "stat": "Average", "label": "5xx Error Rate" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Frontend Error Rate (CloudFront)",
        "period": 300,
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/aws/lambda/prance-api-${ENVIRONMENT}'\n| fields @timestamp, @message\n| filter @message like /ReactCurrentOwner|Hydration failed|WebGL context lost/\n| sort @timestamp desc\n| limit 20",
        "region": "us-east-1",
        "stacked": false,
        "title": "React 19 Specific Errors",
        "view": "table"
      }
    }
  ]
}
EOF
)

# Replace environment variable in dashboard body
DASHBOARD_BODY=$(echo "$DASHBOARD_BODY" | sed "s/\${ENVIRONMENT}/${ENVIRONMENT}/g")

# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "${DASHBOARD_NAME}" \
  --dashboard-body "${DASHBOARD_BODY}" \
  --region "${REGION}" >/dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Dashboard created: ${DASHBOARD_NAME}${NC}"
  echo -e "${BLUE}  View at: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}${NC}"
else
  echo -e "${RED}✗ Failed to create dashboard${NC}"
  exit 1
fi

# Step 2: Create CloudWatch Alarms
echo ""
echo -e "${YELLOW}Step 2: Creating CloudWatch Alarms...${NC}"

# Alarm 1: High Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name "React19-${ENVIRONMENT}-HighErrorRate" \
  --alarm-description "React 19 deployment - Lambda error rate > 0.1%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --region "${REGION}" >/dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Alarm created: React19-${ENVIRONMENT}-HighErrorRate${NC}"
else
  echo -e "${YELLOW}⚠ Alarm creation failed or already exists${NC}"
fi

# Alarm 2: Slow Response Time
aws cloudwatch put-metric-alarm \
  --alarm-name "React19-${ENVIRONMENT}-SlowResponseTime" \
  --alarm-description "React 19 deployment - API response time > 500ms" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 500 \
  --comparison-operator GreaterThanThreshold \
  --region "${REGION}" >/dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Alarm created: React19-${ENVIRONMENT}-SlowResponseTime${NC}"
else
  echo -e "${YELLOW}⚠ Alarm creation failed or already exists${NC}"
fi

# Alarm 3: Frontend 5xx Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name "React19-${ENVIRONMENT}-Frontend5xxErrors" \
  --alarm-description "React 19 deployment - Frontend 5xx error rate > 1%" \
  --metric-name 5xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --region "${REGION}" >/dev/null 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Alarm created: React19-${ENVIRONMENT}-Frontend5xxErrors${NC}"
else
  echo -e "${YELLOW}⚠ Alarm creation failed or already exists${NC}"
fi

# Step 3: Create Log Insights Queries
echo ""
echo -e "${YELLOW}Step 3: Creating CloudWatch Log Insights Queries...${NC}"

# Query 1: React 19 Specific Errors
QUERY_1=$(cat <<EOF
fields @timestamp, @message
| filter @message like /ReactCurrentOwner|Hydration failed|WebGL context lost|Cannot read properties of null/
| sort @timestamp desc
| limit 100
EOF
)

# Query 2: Performance Degradation
QUERY_2=$(cat <<EOF
fields @timestamp, @message, @duration
| filter @type = "REPORT"
| stats avg(@duration) as avg_duration, max(@duration) as max_duration, count(*) as invocations by bin(5m)
| sort @timestamp desc
EOF
)

echo -e "${BLUE}Saved queries (manual setup required):${NC}"
echo ""
echo -e "${GREEN}Query 1: React 19 Specific Errors${NC}"
echo "$QUERY_1"
echo ""
echo -e "${GREEN}Query 2: Performance Metrics${NC}"
echo "$QUERY_2"
echo ""

# Step 4: Summary
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}✓ Monitoring Setup Complete${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. View dashboard:"
echo "   https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}"
echo ""
echo "2. Configure SNS notifications for alarms (optional):"
echo "   aws sns create-topic --name React19-Deployment-Alerts"
echo "   aws cloudwatch put-metric-alarm ... --alarm-actions arn:aws:sns:${REGION}:ACCOUNT_ID:React19-Deployment-Alerts"
echo ""
echo "3. Monitor for 24-48 hours after deployment"
echo ""
echo -e "${YELLOW}Key Metrics to Watch:${NC}"
echo "- Error Rate: Should stay < 0.1%"
echo "- Response Time: Should stay < 500ms (P95)"
echo "- React-specific errors: Should be 0"
echo ""
