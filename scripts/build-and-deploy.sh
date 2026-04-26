#!/bin/bash
# Simplified Build and Deploy Script
# Usage: pnpm run build:deploy

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_section "Build and Deploy - Phase A Refactoring"

# Step 1: Build Infrastructure
log_step 1 "Building infrastructure..."
if pnpm run build --workspace=infrastructure > /tmp/infra-build.log 2>&1; then
    log_success "Infrastructure built successfully"
else
    log_error "Infrastructure build failed"
    echo "See: /tmp/infra-build.log"
    exit 1
fi

# Step 2: Pre-deployment validation
log_step 2 "Running pre-deployment checks..."
if pnpm run lambda:predeploy > /tmp/predeploy.log 2>&1; then
    log_success "All validations passed"
else
    log_error "Validation failed"
    echo "See: /tmp/predeploy.log"
    exit 1
fi

# Step 3: Deploy Lambda functions
log_step 3 "Deploying Lambda functions..."
echo ""
log_warning "This may take 2-3 minutes..."
echo ""

if pnpm run deploy:lambda 2>&1 | tee /tmp/deploy.log | grep -E "(UPDATE_COMPLETE|CREATE_COMPLETE|✓|Error:|Failed)" | tail -5; then
    log_success "Lambda functions deployed successfully"
else
    log_error "Deployment failed"
    echo "See: /tmp/deploy.log"
    exit 1
fi

echo ""
log_section "Build and Deploy Complete"
echo ""
echo "Lambda Function: prance-websocket-default-dev"
echo "Region: us-east-1"
echo ""
echo "Next steps:"
echo "  1. Check CloudWatch Logs:"
echo "     aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --follow"
echo ""
echo "  2. Test WebSocket connection:"
echo "     Open browser: https://dev.app.prance.jp"
echo ""
