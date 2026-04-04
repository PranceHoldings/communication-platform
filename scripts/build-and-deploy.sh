#!/bin/bash
# Simplified Build and Deploy Script
# Usage: pnpm run build:deploy

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function
log_step() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Build and Deploy - Phase A Refactoring${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Step 1: Build Infrastructure
log_step "Step 1/3: Building infrastructure..."
if pnpm run build --workspace=infrastructure > /tmp/infra-build.log 2>&1; then
    log_success "Infrastructure built successfully"
else
    log_error "Infrastructure build failed"
    echo "See: /tmp/infra-build.log"
    exit 1
fi

# Step 2: Pre-deployment validation
log_step "Step 2/3: Running pre-deployment checks..."
if pnpm run lambda:predeploy > /tmp/predeploy.log 2>&1; then
    log_success "All validations passed"
else
    log_error "Validation failed"
    echo "See: /tmp/predeploy.log"
    exit 1
fi

# Step 3: Deploy Lambda functions
log_step "Step 3/3: Deploying Lambda functions..."
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
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Build and Deploy Complete${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Lambda Function: prance-websocket-default-dev"
echo "Region: us-east-1"
echo ""
echo "Next steps:"
echo "  1. Check CloudWatch Logs:"
echo "     aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --follow"
echo ""
echo "  2. Test WebSocket connection:"
echo "     Open browser: http://localhost:3000"
echo ""
