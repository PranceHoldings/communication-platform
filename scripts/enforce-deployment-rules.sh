#!/bin/bash

##############################################################################
# Enforce Deployment Rules
#
# Purpose: Block direct CDK usage and enforce proper deployment procedures
#
# Usage:
#   Source this in your shell profile:
#   source ./scripts/enforce-deployment-rules.sh
#
# This script:
# 1. Creates aliases to prevent direct CDK usage
# 2. Displays deployment reminders
# 3. Enforces use of wrapper scripts
##############################################################################

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Function to display deployment reminder
show_deployment_reminder() {
  echo ""
  log_warning "DEPLOYMENT REMINDER"
  print_separator
  echo ""
  log_error "Do NOT use 'cd infrastructure && pnpm exec cdk deploy' directly!"
  echo ""
  echo "Correct deployment methods:"
  echo ""
  log_success "1. WebSocket Lambda functions:"
  echo "     ./scripts/deploy-lambda-websocket-manual.sh"
  echo ""
  log_success "2. Other stacks:"
  echo "     ./scripts/cdk-deploy-wrapper.sh Prance-dev-<StackName>"
  echo ""
  log_success "3. Full deployment:"
  echo "     pnpm run build:deploy"
  echo ""
  print_separator
  echo ""
}

# Create alias to prevent direct CDK usage in infrastructure directory
cdk() {
  if [ "$1" = "deploy" ]; then
    log_error "Direct 'cdk deploy' is not allowed!"
    echo ""
    show_deployment_reminder
    return 1
  else
    # Allow other cdk commands (diff, synth, etc.)
    command cdk "$@"
  fi
}

# Create pnpm run shortcuts with validation
npm-deploy() {
  log_warning "Intercepted npm deployment command"
  show_deployment_reminder

  if confirm "Use recommended deployment method?" "y"; then
    cd /workspaces/prance-communication-platform
    ./scripts/cdk-deploy-wrapper.sh "$1"
  else
    log_error "Deployment cancelled"
    return 1
  fi
}

# Export functions
export -f show_deployment_reminder
export -f cdk
export -f npm-deploy

log_success "Deployment rules enforced"
echo "Run 'show_deployment_reminder' to see proper deployment methods"
