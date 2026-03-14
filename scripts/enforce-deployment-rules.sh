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

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to display deployment reminder
show_deployment_reminder() {
  echo ""
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}⚠️  DEPLOYMENT REMINDER${NC}"
  echo -e "${YELLOW}========================================${NC}"
  echo ""
  echo -e "${RED}Do NOT use 'cd infrastructure && npx cdk deploy' directly!${NC}"
  echo ""
  echo "Correct deployment methods:"
  echo ""
  echo "  ${GREEN}1. WebSocket Lambda functions:${NC}"
  echo "     ./scripts/deploy-lambda-websocket-manual.sh"
  echo ""
  echo "  ${GREEN}2. Other stacks:${NC}"
  echo "     ./scripts/cdk-deploy-wrapper.sh Prance-dev-<StackName>"
  echo ""
  echo "  ${GREEN}3. Full deployment:${NC}"
  echo "     npm run build:deploy"
  echo ""
  echo -e "${YELLOW}========================================${NC}"
  echo ""
}

# Create alias to prevent direct CDK usage in infrastructure directory
cdk() {
  if [ "$1" = "deploy" ]; then
    echo -e "${RED}ERROR: Direct 'cdk deploy' is not allowed!${NC}"
    echo ""
    show_deployment_reminder
    return 1
  else
    # Allow other cdk commands (diff, synth, etc.)
    command cdk "$@"
  fi
}

# Create npm run shortcuts with validation
npm-deploy() {
  echo -e "${YELLOW}⚠️  Intercepted npm deployment command${NC}"
  show_deployment_reminder

  read -p "Use recommended deployment method? (y/n): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd /workspaces/prance-communication-platform
    ./scripts/cdk-deploy-wrapper.sh "$1"
  else
    echo -e "${RED}Deployment cancelled${NC}"
    return 1
  fi
}

# Export functions
export -f show_deployment_reminder
export -f cdk
export -f npm-deploy

echo -e "${GREEN}✓ Deployment rules enforced${NC}"
echo "Run 'show_deployment_reminder' to see proper deployment methods"
