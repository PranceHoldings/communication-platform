#!/bin/bash
# Create CloudWatch Dashboard for Phase 1.5 Performance Monitoring
#
# Usage:
#   ./scripts/create-cloudwatch-dashboard.sh

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Configuration
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="prance-websocket-default-dev"
DASHBOARD_NAME="Prance-dev-Performance"

log_section "Creating CloudWatch Dashboard"

log_warning "Dashboard Name: $DASHBOARD_NAME"
log_warning "Region: $REGION"
log_warning "Function: $FUNCTION_NAME"
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
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Duration", { "stat": "Average", "label": "Avg Duration" } ],
          [ "...", { "stat": "p95", "label": "p95 Duration" } ],
          [ "...", { "stat": "p99", "label": "p99 Duration" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Duration (ms)",
        "period": 300,
        "yAxis": {
          "left": {
            "min": 0
          }
        },
        "annotations": {
          "horizontal": [
            {
              "label": "Phase 1.5 Target (p95 < 6s)",
              "value": 6000,
              "fill": "above",
              "color": "#ff0000"
            }
          ]
        }
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "ConcurrentExecutions", { "stat": "Maximum", "label": "Max Concurrent" } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Concurrent Executions",
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
      "x": 0,
      "y": 12,
      "width": 24,
      "height": 6,
      "properties": {
        "query": "SOURCE '/aws/lambda/FUNCTION_NAME_PLACEHOLDER' | fields @timestamp, @message | filter @message like /ERROR|Error|error/ | sort @timestamp desc | limit 20",
        "region": "us-east-1",
        "stacked": false,
        "title": "Recent Errors (Last 1 hour)",
        "view": "table"
      }
    }
  ]
}
EOF
)

# Replace placeholder with actual function name
DASHBOARD_BODY=$(echo "$DASHBOARD_BODY" | sed "s/FUNCTION_NAME_PLACEHOLDER/$FUNCTION_NAME/g")

# Create dashboard
log_warning "Creating dashboard..."
aws cloudwatch put-dashboard \
  --region "$REGION" \
  --dashboard-name "$DASHBOARD_NAME" \
  --dashboard-body "$DASHBOARD_BODY"

if [ $? -eq 0 ]; then
  echo ""
  log_success "Dashboard created successfully"
  echo ""
  log_info "Dashboard URL:"
  echo "https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}"
  echo ""
else
  echo ""
  log_error "Failed to create dashboard"
  exit 1
fi
