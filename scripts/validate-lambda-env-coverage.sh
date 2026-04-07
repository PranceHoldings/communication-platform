#!/bin/bash

###############################################################################
# Lambda Environment Variable Coverage Validator
#
# Purpose: Verify all getRequiredEnv() calls in Lambda code have corresponding
#          environment variables defined in CDK stacks.
#
# Usage: bash scripts/validate-lambda-env-coverage.sh
#
# Exit Codes:
#   0 - All checks passed
#   1 - Missing environment variables detected
#   2 - Script error
###############################################################################

set -euo pipefail

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log_section "Lambda Environment Variable Coverage Validator"
echo ""

# Step 1: Extract all getRequiredEnv() calls from Lambda code
log_info "Step 1: Extracting getRequiredEnv() calls from Lambda code..."

LAMBDA_DIR="${PROJECT_ROOT}/infrastructure/lambda"
REQUIRED_ENV_VARS=$(grep -roh "getRequiredEnv('[A-Z_]*')" "$LAMBDA_DIR" --include="*.ts" | \
                    sed "s/getRequiredEnv('//g" | \
                    sed "s/')//g" | \
                    sort -u)

if [ -z "$REQUIRED_ENV_VARS" ]; then
    log_warning "No getRequiredEnv() calls found in Lambda code"
    exit 0
fi

echo "Found $(echo "$REQUIRED_ENV_VARS" | wc -l) unique required environment variables:"
echo "$REQUIRED_ENV_VARS" | sed 's/^/  - /'
echo ""

# Step 2: Extract all getRequiredEnvAsNumber/Float/Boolean calls
log_info "Step 2: Extracting typed getRequiredEnv calls..."

TYPED_ENV_VARS=$(grep -roh "getRequiredEnvAs\(Number\|Float\|Boolean\)('[A-Z_]*')" "$LAMBDA_DIR" --include="*.ts" | \
                 sed "s/getRequiredEnvAs[A-Za-z]*('//g" | \
                 sed "s/')//g" | \
                 sort -u)

if [ -n "$TYPED_ENV_VARS" ]; then
    echo "Found $(echo "$TYPED_ENV_VARS" | wc -l) typed required environment variables:"
    echo "$TYPED_ENV_VARS" | sed 's/^/  - /'

    # Merge with REQUIRED_ENV_VARS
    REQUIRED_ENV_VARS=$(echo -e "${REQUIRED_ENV_VARS}\n${TYPED_ENV_VARS}" | sort -u)
fi
echo ""

# Step 3: Extract all environment variables defined in CDK stacks
log_info "Step 3: Extracting environment variables defined in CDK stacks..."

CDK_STACK_FILE="${PROJECT_ROOT}/infrastructure/lib/api-lambda-stack.ts"

if [ ! -f "$CDK_STACK_FILE" ]; then
    log_error "CDK stack file not found: $CDK_STACK_FILE"
    exit 2
fi

# Extract environment variable names from CDK stack
# Matches patterns like: VARIABLE_NAME: process.env.VARIABLE_NAME || 'default'
# or: VARIABLE_NAME: props.something
CDK_ENV_VARS=$(grep -oh "[A-Z_][A-Z_0-9]*:" "$CDK_STACK_FILE" | \
               sed 's/:$//' | \
               grep -v "^AWS_LAMBDA_FUNCTION" | \
               sort -u)

if [ -z "$CDK_ENV_VARS" ]; then
    log_warning "No environment variables found in CDK stack"
fi

echo "Found $(echo "$CDK_ENV_VARS" | wc -l) unique environment variables in CDK:"
# Only show first 10 for brevity
echo "$CDK_ENV_VARS" | head -10 | sed 's/^/  - /'
if [ $(echo "$CDK_ENV_VARS" | wc -l) -gt 10 ]; then
    echo "  ... and $(($(echo "$CDK_ENV_VARS" | wc -l) - 10)) more"
fi
echo ""

# Step 4: Check for missing environment variables
log_info "Step 4: Checking for missing environment variables..."

MISSING_VARS=""
MISSING_COUNT=0

for VAR in $REQUIRED_ENV_VARS; do
    # Special cases that are provided by Lambda runtime or don't need CDK definition
    if [ "$VAR" = "AWS_LAMBDA_FUNCTION_NAME" ] || \
       [ "$VAR" = "AWS_REGION" ] || \
       [ "$VAR" = "AWS_ACCOUNT_ID" ]; then
        # AWS_REGION should be checked separately as it should be explicitly set
        if [ "$VAR" = "AWS_REGION" ]; then
            if ! echo "$CDK_ENV_VARS" | grep -q "^AWS_REGION$"; then
                log_warning "AWS_REGION not explicitly set in CDK (relying on runtime)"
            fi
        fi
        continue
    fi

    # Check if variable is defined in CDK
    if ! echo "$CDK_ENV_VARS" | grep -q "^${VAR}$"; then
        MISSING_VARS="${MISSING_VARS}${VAR}\n"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

# Step 5: Report results
echo ""
log_section "Validation Results"

if [ $MISSING_COUNT -eq 0 ]; then
    log_success "All required environment variables are defined in CDK!"
    echo ""
    echo "Summary:"
    echo "  - Required variables in Lambda code: $(echo "$REQUIRED_ENV_VARS" | wc -l)"
    echo "  - Variables defined in CDK: $(echo "$CDK_ENV_VARS" | wc -l)"
    echo "  - Missing variables: 0"
    exit 0
else
    log_error "Found $MISSING_COUNT missing environment variable(s):"
    echo ""
    echo -e "$MISSING_VARS" | sed 's/^/  - /'
    echo ""
    log_warning "Action Required:"
    echo "Add these variables to the Lambda function environment blocks in:"
    echo "  $CDK_STACK_FILE"
    echo ""
    echo "Example:"
    echo "  environment: {"
    echo "    // ... existing variables"
    while IFS= read -r VAR; do
        if [ -n "$VAR" ]; then
            echo "    ${VAR}: process.env.${VAR} || 'default-value',"
        fi
    done <<< "$(echo -e "$MISSING_VARS")"
    echo "  }"
    echo ""
    exit 1
fi
