#!/bin/bash

##############################################################################
# CDK Deploy Wrapper Script
#
# Purpose: Enforce deployment validation and prevent direct CDK usage
#
# Usage:
#   ./scripts/cdk-deploy-wrapper.sh <stack-name>
#   ./scripts/cdk-deploy-wrapper.sh Prance-dev-ApiLambda
#   ./scripts/cdk-deploy-wrapper.sh --all
#
# This script ensures:
# 1. WebSocket Lambda functions use manual deployment script
# 2. All other stacks run pre-deployment checks
# 3. Environment variables are validated
# 4. No broken dependencies before deployment
##############################################################################

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Get stack name from argument
STACK_NAME="${1:-}"

if [ -z "$STACK_NAME" ]; then
  log_error "Stack name required"
  log_info "Usage: $0 <stack-name>"
  log_info "Example: $0 Prance-dev-ApiLambda"
  exit 1
fi

log_section "CDK Deploy Wrapper"

# Check if deploying ApiLambda stack (contains WebSocket functions)
if [[ "$STACK_NAME" == *"ApiLambda"* ]]; then
  log_warning "Detected ApiLambda stack deployment"
  echo ""
  log_warning "IMPORTANT: WebSocket Lambda functions require special deployment"
  echo ""
  echo "Options:"
  echo "  1. Deploy WebSocket Lambda ONLY (recommended):"
  log_info "     ./scripts/deploy-lambda-websocket-manual.sh"
  echo ""
  echo "  2. Deploy full ApiLambda stack (may use old code for WebSocket):"
  echo "     Continue with standard CDK deploy"
  echo ""

  if confirm "Do you want to use the manual WebSocket deployment script?" "y"; then
    log_success "Using manual WebSocket deployment"
    exec ./scripts/deploy-lambda-websocket-manual.sh
  else
    log_warning "Proceeding with standard CDK deploy"
    log_warning "WebSocket Lambda may use old code - verify after deployment"
    echo ""
  fi
fi

# Run pre-deployment checks
log_step 1 "Running pre-deployment checks..."
if ! bash scripts/pre-deploy-lambda-check.sh; then
  log_error "Pre-deployment checks failed"
  log_info "Fix the issues above before deploying"
  exit 1
fi
log_success "Pre-deployment checks passed"
echo ""

# Validate environment variables
log_step 2 "Validating environment variables..."
if ! bash scripts/validate-env.sh; then
  log_error "Environment validation failed"
  exit 1
fi
log_success "Environment variables validated"
echo ""

# Build infrastructure
log_step 3 "Building infrastructure..."
cd infrastructure
pnpm run build
cd ..
log_success "Infrastructure built"
echo ""

# Deploy with CDK
log_step 4 "Deploying stack: $STACK_NAME"
cd infrastructure
pnpm run cdk -- deploy "$STACK_NAME" --require-approval never
DEPLOY_EXIT_CODE=$?
cd ..

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
  echo ""
  log_section "Deployment completed successfully"

  # Post-deployment validation for ApiLambda stack
  if [[ "$STACK_NAME" == *"ApiLambda"* ]]; then
    echo ""
    log_info "Running post-deployment tests..."
    if bash scripts/post-deploy-lambda-test.sh prance-websocket-default-dev; then
      log_success "Post-deployment tests passed"
    else
      log_warning "Post-deployment tests failed - check logs"
    fi
  fi
else
  echo ""
  log_error "Deployment failed"
  exit $DEPLOY_EXIT_CODE
fi
