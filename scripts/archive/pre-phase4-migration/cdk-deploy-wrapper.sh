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

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get stack name from argument
STACK_NAME="${1:-}"

if [ -z "$STACK_NAME" ]; then
  echo -e "${RED}ERROR: Stack name required${NC}"
  echo "Usage: $0 <stack-name>"
  echo "Example: $0 Prance-dev-ApiLambda"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CDK Deploy Wrapper${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if deploying ApiLambda stack (contains WebSocket functions)
if [[ "$STACK_NAME" == *"ApiLambda"* ]]; then
  echo -e "${YELLOW}⚠️  Detected ApiLambda stack deployment${NC}"
  echo ""
  echo -e "${YELLOW}IMPORTANT: WebSocket Lambda functions require special deployment${NC}"
  echo ""
  echo "Options:"
  echo "  1. Deploy WebSocket Lambda ONLY (recommended):"
  echo "     ${GREEN}./scripts/deploy-lambda-websocket-manual.sh${NC}"
  echo ""
  echo "  2. Deploy full ApiLambda stack (may use old code for WebSocket):"
  echo "     Continue with standard CDK deploy"
  echo ""
  read -p "Do you want to use the manual WebSocket deployment script? (y/n): " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✓ Using manual WebSocket deployment${NC}"
    exec ./scripts/deploy-lambda-websocket-manual.sh
  else
    echo -e "${YELLOW}⚠️  Proceeding with standard CDK deploy${NC}"
    echo -e "${YELLOW}⚠️  WebSocket Lambda may use old code - verify after deployment${NC}"
    echo ""
  fi
fi

# Run pre-deployment checks
echo -e "${BLUE}Step 1/4: Running pre-deployment checks...${NC}"
if ! bash scripts/pre-deploy-lambda-check.sh; then
  echo -e "${RED}✗ Pre-deployment checks failed${NC}"
  echo "Fix the issues above before deploying"
  exit 1
fi
echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# Validate environment variables
echo -e "${BLUE}Step 2/4: Validating environment variables...${NC}"
if ! bash scripts/validate-env.sh; then
  echo -e "${RED}✗ Environment validation failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Environment variables validated${NC}"
echo ""

# Build infrastructure
echo -e "${BLUE}Step 3/4: Building infrastructure...${NC}"
cd infrastructure
pnpm run build
cd ..
echo -e "${GREEN}✓ Infrastructure built${NC}"
echo ""

# Deploy with CDK
echo -e "${BLUE}Step 4/4: Deploying stack: $STACK_NAME${NC}"
cd infrastructure
pnpm run cdk -- deploy "$STACK_NAME" --require-approval never
DEPLOY_EXIT_CODE=$?
cd ..

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}✓ Deployment completed successfully${NC}"
  echo -e "${GREEN}========================================${NC}"

  # Post-deployment validation for ApiLambda stack
  if [[ "$STACK_NAME" == *"ApiLambda"* ]]; then
    echo ""
    echo -e "${BLUE}Running post-deployment tests...${NC}"
    if bash scripts/post-deploy-lambda-test.sh prance-websocket-default-dev; then
      echo -e "${GREEN}✓ Post-deployment tests passed${NC}"
    else
      echo -e "${YELLOW}⚠️  Post-deployment tests failed - check logs${NC}"
    fi
  fi
else
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}✗ Deployment failed${NC}"
  echo -e "${RED}========================================${NC}"
  exit $DEPLOY_EXIT_CODE
fi
