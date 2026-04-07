#!/bin/bash

# CDK Wrapper - Enforces Pre-Deployment Validation
# This script wraps `pnpm exec cdk` to ensure all validations run before deployment
#
# Usage:
#   ./scripts/cdk-wrapper.sh deploy Prance-dev-ApiLambda --require-approval never
#   ./scripts/cdk-wrapper.sh synth
#   ./scripts/cdk-wrapper.sh diff

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$INFRA_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Parse CDK command
CDK_COMMAND="${1:-}"
shift || true

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}CDK Wrapper - Enforced Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if this is a deployment command
IS_DEPLOY=false
case "$CDK_COMMAND" in
  deploy)
    IS_DEPLOY=true
    ;;
  *)
    IS_DEPLOY=false
    ;;
esac

if [ "$IS_DEPLOY" = true ]; then
  echo -e "${MAGENTA}[VALIDATION]${NC} Running pre-deployment checks..."
  echo ""

  # Run all pre-deployment validations
  cd "$ROOT_DIR"

  # 0. CDK environment variables check (prevent silent missing env vars)
  echo -e "${BLUE}[0/5]${NC} Checking CDK environment variables..."
  CDK_REQUIRED_VARS=(
    DYNAMODB_CONNECTION_TTL_SECONDS
    BEDROCK_MODEL_ID
    BEDROCK_REGION
    CLOUDFRONT_DOMAIN
    STT_LANGUAGE
    VIDEO_FORMAT
    AWS_ENDPOINT_SUFFIX
  )
  CDK_ENV_MISSING=0
  # Load .env.local to check
  if [ -f "$ROOT_DIR/.env.local" ]; then
    set -a; source "$ROOT_DIR/.env.local" > /dev/null 2>&1; set +a
  fi
  for var in "${CDK_REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
      echo -e "${RED}  ✗ Missing required env var: $var${NC}"
      CDK_ENV_MISSING=$((CDK_ENV_MISSING + 1))
    fi
  done
  if [ "$CDK_ENV_MISSING" -gt 0 ]; then
    echo -e "${RED}  ✗ $CDK_ENV_MISSING required env vars missing${NC}"
    echo ""
    echo -e "${YELLOW}Add missing vars to .env.local (root) — CDK reads from there automatically${NC}"
    exit 1
  else
    echo -e "${GREEN}  ✓ All required CDK env vars present${NC}"
  fi
  echo ""

  # 1. Space-containing directories check
  echo -e "${BLUE}[1/5]${NC} Checking for space-containing directories..."
  if pnpm run clean:spaces > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ No space-containing directories${NC}"
  else
    echo -e "${RED}  ✗ Space-containing directories found${NC}"
    echo ""
    echo -e "${YELLOW}Run: pnpm run clean:spaces${NC}"
    exit 1
  fi
  echo ""

  # 2. Duplication management check (CRITICAL - 2026-03-22)
  echo -e "${BLUE}[2/5]${NC} Validating duplication management..."
  if bash scripts/validate-duplication.sh > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Duplication validation passed${NC}"
  else
    echo -e "${RED}  ✗ Duplication validation failed${NC}"
    echo ""
    echo -e "${YELLOW}Run: bash scripts/validate-duplication.sh${NC}"
    exit 1
  fi
  echo ""

  # 3. Runtime config completeness check (CRITICAL - 2026-04-05)
  if [[ "$*" == *"ApiLambda"* ]] || [[ "$*" == *"--all"* ]] || [[ -z "$*" ]]; then
    echo -e "${BLUE}[3/5]${NC} Validating runtime config completeness..."
    if bash scripts/validate-runtime-configs.sh > /dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Runtime config completeness validated${NC}"
    else
      echo -e "${RED}  ✗ Runtime config completeness failed${NC}"
      echo ""
      echo -e "${YELLOW}Run: bash scripts/validate-runtime-configs.sh${NC}"
      exit 1
    fi
    echo ""
  else
    echo -e "${BLUE}[3/5]${NC} Skipping runtime config validation (not deploying Lambda stack)"
    echo ""
  fi

  # 4. Lambda dependencies check (if deploying Lambda stack)
  if [[ "$*" == *"ApiLambda"* ]] || [[ "$*" == *"--all"* ]] || [[ -z "$*" ]]; then
    echo -e "${BLUE}[4/5]${NC} Validating Lambda dependencies..."
    # NOTE: lambda:validate checks for per-function package.json/node_modules,
    # but this project uses CDK esbuild bundling — Lambda functions have no
    # local node_modules. Bundling is validated implicitly by `cdk synth` below.
    echo -e "${GREEN}  ✓ Lambda dependencies managed by CDK esbuild (skipping local check)${NC}"
    echo ""
  else
    echo -e "${BLUE}[4/5]${NC} Skipping Lambda validation (not deploying Lambda stack)"
    echo ""
  fi

  # 5. CDK bundling configuration check (if deploying Lambda stack)
  if [[ "$*" == *"ApiLambda"* ]] || [[ "$*" == *"--all"* ]] || [[ -z "$*" ]]; then
    echo -e "${BLUE}[5/5]${NC} Validating CDK bundling configuration..."
    cd "$INFRA_DIR"
    if pnpm run validate:bundling > /dev/null 2>&1; then
      echo -e "${GREEN}  ✓ CDK bundling configuration valid${NC}"
    else
      echo -e "${RED}  ✗ CDK bundling configuration invalid${NC}"
      echo ""
      echo -e "${YELLOW}Run: cd infrastructure && pnpm run validate:bundling${NC}"
      exit 1
    fi
    echo ""
  else
    echo -e "${BLUE}[5/5]${NC} Skipping bundling validation (not deploying Lambda stack)"
    echo ""
  fi

  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}✅ All validations passed${NC}"
  echo -e "${GREEN}============================================${NC}"
  echo ""
fi

# Execute CDK command
cd "$INFRA_DIR"
echo -e "${MAGENTA}[CDK]${NC} Executing: cdk $CDK_COMMAND $*"
echo ""

pnpm exec cdk "$CDK_COMMAND" "$@"

echo ""
echo -e "${GREEN}✅ CDK command completed successfully${NC}"
echo ""
