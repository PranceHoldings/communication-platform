#!/bin/bash
#
# Lambda Environment Variables Validation Script
# Purpose: Validate ALL critical Lambda environment variables before deployment
# Prevents production failures due to missing or incorrect environment variables
#
# Usage: bash scripts/validate-lambda-env-vars.sh [function-name] [region]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
FUNCTION_NAME="${1:-prance-websocket-default-dev}"
REGION="${2:-us-east-1}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Lambda Environment Variables Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Function: ${YELLOW}$FUNCTION_NAME${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo ""

TOTAL_CHECKS=0
FAILED_CHECKS=0
MISSING_VARS=()
EMPTY_VARS=()

# =============================================================================
# CRITICAL Environment Variables
# =============================================================================

# AWS Configuration
# Note: AWS_REGION is automatically set by Lambda runtime, not in environment variables
CRITICAL_VARS=(
  "S3_BUCKET"
  "CLOUDFRONT_DOMAIN"
  "CONNECTIONS_TABLE_NAME"
  "WEBSOCKET_ENDPOINT"
)

# API Keys
API_KEY_VARS=(
  "ELEVENLABS_API_KEY"
  "AZURE_SPEECH_KEY"
  "AZURE_SPEECH_REGION"
  "BEDROCK_MODEL_ID"
  "BEDROCK_REGION"
)

# Database
DATABASE_VARS=(
  "DATABASE_URL"
)

# Security
SECURITY_VARS=(
  "JWT_SECRET"
)

ALL_REQUIRED_VARS=("${CRITICAL_VARS[@]}" "${API_KEY_VARS[@]}" "${DATABASE_VARS[@]}" "${SECURITY_VARS[@]}")

# =============================================================================
# Get Lambda Environment Variables
# =============================================================================

echo -e "${BLUE}[CHECK 1/4]${NC} Retrieving Lambda environment variables..."
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

ENV_VARS=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Environment.Variables' \
  --output json 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$ENV_VARS" ] || [ "$ENV_VARS" == "null" ]; then
  echo -e "${RED}✗ FAIL: Could not retrieve environment variables${NC}"
  echo -e "${YELLOW}→ Function may not exist or you may not have permissions${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  exit 1
fi

echo -e "${GREEN}✓ Retrieved environment variables${NC}"
echo ""

# =============================================================================
# Check CRITICAL Variables
# =============================================================================

echo -e "${BLUE}[CHECK 2/4]${NC} Validating CRITICAL environment variables..."
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

CRITICAL_FAILED=0

for var in "${CRITICAL_VARS[@]}"; do
  value=$(echo "$ENV_VARS" | jq -r ".$var // empty")

  if [ -z "$value" ]; then
    echo -e "${RED}  ✗ $var: MISSING${NC}"
    MISSING_VARS+=("$var")
    CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
  elif [ "$value" == "null" ]; then
    echo -e "${RED}  ✗ $var: NULL${NC}"
    EMPTY_VARS+=("$var")
    CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
  else
    echo -e "${GREEN}  ✓ $var: SET${NC}"
  fi
done

if [ $CRITICAL_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All CRITICAL variables present${NC}"
else
  echo -e "${RED}✗ $CRITICAL_FAILED CRITICAL variables missing or empty${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

echo ""

# =============================================================================
# Check API Key Variables
# =============================================================================

echo -e "${BLUE}[CHECK 3/4]${NC} Validating API Key environment variables..."
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

API_FAILED=0

for var in "${API_KEY_VARS[@]}"; do
  value=$(echo "$ENV_VARS" | jq -r ".$var // empty")

  if [ -z "$value" ]; then
    echo -e "${RED}  ✗ $var: MISSING${NC}"
    MISSING_VARS+=("$var")
    API_FAILED=$((API_FAILED + 1))
  elif [ "$value" == "null" ]; then
    echo -e "${RED}  ✗ $var: NULL${NC}"
    EMPTY_VARS+=("$var")
    API_FAILED=$((API_FAILED + 1))
  else
    # Mask API keys for security
    masked_value=$(echo "$value" | sed 's/\(.\{4\}\).*/\1***/')
    echo -e "${GREEN}  ✓ $var: SET ($masked_value...)${NC}"
  fi
done

if [ $API_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All API Key variables present${NC}"
else
  echo -e "${RED}✗ $API_FAILED API Key variables missing or empty${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

echo ""

# =============================================================================
# Check Database & Security Variables
# =============================================================================

echo -e "${BLUE}[CHECK 4/4]${NC} Validating Database & Security variables..."
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

DB_SEC_FAILED=0

for var in "${DATABASE_VARS[@]}" "${SECURITY_VARS[@]}"; do
  value=$(echo "$ENV_VARS" | jq -r ".$var // empty")

  if [ -z "$value" ]; then
    echo -e "${RED}  ✗ $var: MISSING${NC}"
    MISSING_VARS+=("$var")
    DB_SEC_FAILED=$((DB_SEC_FAILED + 1))
  elif [ "$value" == "null" ]; then
    echo -e "${RED}  ✗ $var: NULL${NC}"
    EMPTY_VARS+=("$var")
    DB_SEC_FAILED=$((DB_SEC_FAILED + 1))
  else
    # Mask sensitive values
    masked_value=$(echo "$value" | sed 's/\(.\{10\}\).*/\1***/')
    echo -e "${GREEN}  ✓ $var: SET ($masked_value...)${NC}"
  fi
done

if [ $DB_SEC_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All Database & Security variables present${NC}"
else
  echo -e "${RED}✗ $DB_SEC_FAILED Database & Security variables missing or empty${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

echo ""

# =============================================================================
# CRITICAL: CLOUDFRONT_DOMAIN Validation
# =============================================================================

echo -e "${BLUE}[CRITICAL CHECK]${NC} Validating CLOUDFRONT_DOMAIN format..."

CLOUDFRONT_DOMAIN=$(echo "$ENV_VARS" | jq -r '.CLOUDFRONT_DOMAIN // empty')

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo -e "${RED}✗ CRITICAL: CLOUDFRONT_DOMAIN is MISSING${NC}"
  echo -e "${RED}   This will cause audio playback errors!${NC}"
  echo -e "${YELLOW}   Expected: d3mx0sug5s3a6x.cloudfront.net${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
elif [[ ! "$CLOUDFRONT_DOMAIN" =~ \.cloudfront\.net$ ]]; then
  echo -e "${RED}✗ CRITICAL: CLOUDFRONT_DOMAIN has invalid format${NC}"
  echo -e "${RED}   Current: $CLOUDFRONT_DOMAIN${NC}"
  echo -e "${YELLOW}   Expected format: *.cloudfront.net${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
else
  echo -e "${GREEN}✓ CLOUDFRONT_DOMAIN is valid: $CLOUDFRONT_DOMAIN${NC}"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Total checks: ${TOTAL_CHECKS}"
echo -e "Failed: ${FAILED_CHECKS}"
echo ""

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo -e "${RED}Missing variables (${#MISSING_VARS[@]}):${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo -e "${RED}  - $var${NC}"
  done
  echo ""
fi

if [ ${#EMPTY_VARS[@]} -gt 0 ]; then
  echo -e "${RED}Empty/Null variables (${#EMPTY_VARS[@]}):${NC}"
  for var in "${EMPTY_VARS[@]}"; do
    echo -e "${RED}  - $var${NC}"
  done
  echo ""
fi

if [ "$FAILED_CHECKS" -eq 0 ]; then
  echo -e "${GREEN}✅ All environment variables are valid${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Environment variables validation FAILED${NC}"
  echo ""
  echo -e "${YELLOW}How to fix:${NC}"
  echo ""
  echo "1. Update Lambda environment variables manually:"
  echo "   aws lambda update-function-configuration \\"
  echo "     --function-name $FUNCTION_NAME \\"
  echo "     --region $REGION \\"
  echo "     --environment 'Variables={...}'"
  echo ""
  echo "2. Or update CDK stack and redeploy:"
  echo "   - Edit infrastructure/lib/api-lambda-stack.ts"
  echo "   - Add missing variables to environment: { ... }"
  echo "   - Run: cd infrastructure && pnpm exec cdk deploy Prance-dev-ApiLambda"
  echo ""
  echo "3. Get CloudFront domain:"
  echo "   aws cloudfront list-distributions \\"
  echo "     --query 'DistributionList.Items[*].[DomainName,Comment]' \\"
  echo "     --output table | grep Prance"
  echo ""
  exit 1
fi
