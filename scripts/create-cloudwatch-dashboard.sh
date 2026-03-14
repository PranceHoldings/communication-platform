#!/bin/bash
# Create CloudWatch Dashboard for Phase 1.5 Performance Monitoring
#
# Usage:
#   ./scripts/create-cloudwatch-dashboard.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="prance-websocket-default-dev"
DASHBOARD_NAME="Prance-dev-Performance"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}Creating CloudWatch Dashboard${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "${YELLOW}Dashboard Name:${NC} $DASHBOARD_NAME"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Function:${NC} $FUNCTION_NAME"
echo ""

# Dashboard body (JSON)
DASHBOARD_BODY=$(cat <<'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Invocations", { "stat": "Sum", "label": "Invocations" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "WebSocket Invocations",
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
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Errors", { "stat": "Sum", "label": "Errors", "color": "#d13212" } ],
          [ ".", "Throttles", { "stat": "Sum", "label": "Throttles", "color": "#ff9900" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Error Rate",
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
      "x": 0,
      "y": 6,
      "width": 24,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Duration", { "stat": "Average", "label": "Average", "color": "#1f77b4" } ],
          [ "...", { "stat": "p95", "label": "P95", "color": "#ff7f0e" } ],
          [ "...", { "stat": "Maximum", "label": "Maximum", "color": "#d62728" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Lambda Duration (Phase 1.5 Target: < 4s avg, < 6s p95)",
        "period": 300,
        "annotations": {
          "horizontal": [
            {
              "label": "Target Average (4s)",
              "value": 4000,
              "fill": "below",
              "color": "#2ca02c"
            },
            {
              "label": "Target P95 (6s)",
              "value": 6000,
              "fill": "below",
              "color": "#ff7f0e"
            }
          ]
        },
        "yAxis": {
          "left": {
            "min": 0,
            "max": 10000
          }
        }
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 12,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "ConcurrentExecutions", { "stat": "Average", "label": "Concurrent" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Concurrent Executions",
        "period": 60
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 12,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ { "expression": "100 - (errors / invocations) * 100", "label": "Success Rate %", "id": "successRate" } ],
          [ "AWS/Lambda", "Invocations", { "id": "invocations", "stat": "Sum", "visible": false } ],
          [ ".", "Errors", { "id": "errors", "stat": "Sum", "visible": false } ]
        ],
        "view": "singleValue",
        "region": "us-east-1",
        "title": "Success Rate (Last Hour)",
        "period": 3600,
        "yAxis": {
          "left": {
            "min": 0,
            "max": 100
          }
        }
      }
    }
  ]
}
EOF
)

# Replace placeholder with actual function name
DASHBOARD_BODY=$(echo "$DASHBOARD_BODY" | sed "s/FUNCTION_NAME_PLACEHOLDER/$FUNCTION_NAME/g")

# Create dashboard
echo -e "${YELLOW}Creating dashboard...${NC}"
aws cloudwatch put-dashboard \
  --region "$REGION" \
  --dashboard-name "$DASHBOARD_NAME" \
  --dashboard-body "$DASHBOARD_BODY"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Dashboard created successfully${NC}"
  echo ""
  echo -e "${BLUE}Dashboard URL:${NC}"
  echo "https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}"
  echo ""
else
  echo ""
  echo -e "${RED}❌ Failed to create dashboard${NC}"
  exit 1
fi
