#!/bin/bash
#
# Lambda Environment Variables Validation Script
# Purpose: Validate ALL critical Lambda environment variables before deployment
# Prevents production failures due to missing or incorrect environment variables
#
# Usage: bash scripts/validate-lambda-env-vars.sh [function-name] [region]
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Default values
FUNCTION_NAME="${1:-prance-websocket-default-dev}"
REGION="${2:-us-east-1}"

log_section "Lambda Environment Variables Validation"
echo ""
log_info "Function: $FUNCTION_NAME"
log_info "Region: $REGION"
echo ""

reset_counters
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

ENV_VARS=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Environment.Variables' \
  --output json 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$ENV_VARS" ] || [ "$ENV_VARS" == "null" ]; then
  log_error "FAIL: Could not retrieve environment variables"
  log_warning "→ Function may not exist or you may not have permissions"
  exit 1
fi

log_success "Retrieved environment variables"
echo ""

# =============================================================================
# Check CRITICAL Variables
# =============================================================================

echo -e "${BLUE}[CHECK 2/4]${NC} Validating CRITICAL environment variables..."

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
  log_success "All CRITICAL variables present"
else
  log_error "$CRITICAL_FAILED CRITICAL variables missing or empty"
fi

echo ""

# =============================================================================
# Check API Key Variables
# =============================================================================

echo -e "${BLUE}[CHECK 3/4]${NC} Validating API Key environment variables..."

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
  log_success "All API Key variables present"
else
  log_error "$API_FAILED API Key variables missing or empty"
fi

echo ""

# =============================================================================
# Check Database & Security Variables
# =============================================================================

echo -e "${BLUE}[CHECK 4/4]${NC} Validating Database & Security variables..."

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
  log_success "All Database & Security variables present"
else
  log_error "$DB_SEC_FAILED Database & Security variables missing or empty"
fi

echo ""

# =============================================================================
# CRITICAL: CLOUDFRONT_DOMAIN Validation
# =============================================================================

echo -e "${BLUE}[CRITICAL CHECK]${NC} Validating CLOUDFRONT_DOMAIN format..."

CLOUDFRONT_DOMAIN=$(echo "$ENV_VARS" | jq -r '.CLOUDFRONT_DOMAIN // empty')

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  log_error "CRITICAL: CLOUDFRONT_DOMAIN is MISSING"
  log_error "   This will cause audio playback errors!"
  log_warning "   Expected: d3mx0sug5s3a6x.cloudfront.net"
elif [[ ! "$CLOUDFRONT_DOMAIN" =~ \.cloudfront\.net$ ]]; then
  log_error "CRITICAL: CLOUDFRONT_DOMAIN has invalid format"
  log_error "   Current: $CLOUDFRONT_DOMAIN"
  log_warning "   Expected format: *.cloudfront.net"
else
  log_success "CLOUDFRONT_DOMAIN is valid: $CLOUDFRONT_DOMAIN"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================

log_section "Validation Summary"
echo ""
echo -e "Total checks: 4"
echo -e "Errors: $ERRORS"
echo ""

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  log_error "Missing variables (${#MISSING_VARS[@]}):"
  for var in "${MISSING_VARS[@]}"; do
    echo -e "${RED}  - $var${NC}"
  done
  echo ""
fi

if [ ${#EMPTY_VARS[@]} -gt 0 ]; then
  log_error "Empty/Null variables (${#EMPTY_VARS[@]}):"
  for var in "${EMPTY_VARS[@]}"; do
    echo -e "${RED}  - $var${NC}"
  done
  echo ""
fi

if [ "$ERRORS" -eq 0 ]; then
  log_success "All environment variables are valid"
  echo ""
  exit 0
else
  log_error "Environment variables validation FAILED"
  echo ""
  log_warning "How to fix:"
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
