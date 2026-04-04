#!/bin/bash
# Populate Silence Management Default Values via AWS RDS Data API
#
# Usage:
#   ./scripts/populate-scenario-defaults-aws.sh
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Access to RDS cluster and secret ARN

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

STACK_NAME="Prance-dev-Database"
DATABASE_NAME="prance"

log_info "[populate-defaults] Fetching RDS cluster ARN and secret ARN..."

# Get secret ARN from CloudFormation stack outputs
SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`SecretArn`].OutputValue' \
  --output text)

# Get cluster endpoint from CloudFormation stack outputs
CLUSTER_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)

# Get cluster ARN from RDS describe-db-clusters
CLUSTER_ARN=$(aws rds describe-db-clusters \
  --query "DBClusters[?Endpoint==\`$CLUSTER_ENDPOINT\`].DBClusterArn" \
  --output text)

if [ -z "$CLUSTER_ARN" ] || [ -z "$SECRET_ARN" ]; then
  log_error "Could not retrieve cluster ARN or secret ARN from stack $STACK_NAME"
  log_info "Cluster ARN: ${CLUSTER_ARN:-NOT FOUND}"
  log_info "Secret ARN: ${SECRET_ARN:-NOT FOUND}"
  exit 1
fi

log_success "Cluster ARN: $CLUSTER_ARN"
log_success "Secret ARN: $SECRET_ARN"
echo ""

# Step 1: Check which scenarios need updating
log_info "[populate-defaults] Step 1: Checking scenarios with NULL values..."

CHECK_QUERY="SELECT id, title, silence_timeout, enable_silence_prompt, show_silence_timer, silence_threshold, min_silence_duration FROM scenarios WHERE silence_timeout IS NULL OR enable_silence_prompt IS NULL OR show_silence_timer IS NULL OR silence_threshold IS NULL OR min_silence_duration IS NULL;"

CHECK_RESULT=$(aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE_NAME" \
  --sql "$CHECK_QUERY" \
  --format-records-as JSON \
  --output json)

NUM_RECORDS=$(echo "$CHECK_RESULT" | jq -r '.records | length')

if [ "$NUM_RECORDS" -eq 0 ]; then
  log_success "No scenarios need updating. All fields are populated."
  exit 0
fi

log_info "Found $NUM_RECORDS scenarios with NULL values:"
echo "$CHECK_RESULT" | jq -r '.records[] | "\(.[] | select(.name == "title").stringValue // "N/A")"'
echo ""

# Step 2: Update scenarios
log_info "[populate-defaults] Step 2: Updating scenarios with default values..."

UPDATE_QUERY="UPDATE scenarios SET silence_timeout = COALESCE(silence_timeout, 10), enable_silence_prompt = COALESCE(enable_silence_prompt, true), show_silence_timer = COALESCE(show_silence_timer, false), silence_threshold = COALESCE(silence_threshold, 0.05), min_silence_duration = COALESCE(min_silence_duration, 500) WHERE silence_timeout IS NULL OR enable_silence_prompt IS NULL OR show_silence_timer IS NULL OR silence_threshold IS NULL OR min_silence_duration IS NULL;"

UPDATE_RESULT=$(aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE_NAME" \
  --sql "$UPDATE_QUERY" \
  --output json)

UPDATED_COUNT=$(echo "$UPDATE_RESULT" | jq -r '.numberOfRecordsUpdated')

log_success "Updated $UPDATED_COUNT scenarios"
echo ""

# Step 3: Verify the update
log_info "[populate-defaults] Step 3: Verifying update..."

VERIFY_QUERY="SELECT COUNT(*) as total_scenarios, COUNT(CASE WHEN silence_timeout IS NULL THEN 1 END) as null_timeout, COUNT(CASE WHEN enable_silence_prompt IS NULL THEN 1 END) as null_enable, COUNT(CASE WHEN show_silence_timer IS NULL THEN 1 END) as null_timer, COUNT(CASE WHEN silence_threshold IS NULL THEN 1 END) as null_threshold, COUNT(CASE WHEN min_silence_duration IS NULL THEN 1 END) as null_duration FROM scenarios;"

VERIFY_RESULT=$(aws rds-data execute-statement \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE_NAME" \
  --sql "$VERIFY_QUERY" \
  --format-records-as JSON \
  --output json)

log_info "Verification results:"
echo "$VERIFY_RESULT" | jq -r '.records[0] | to_entries | map("\(.key): \(.value.longValue // .value.stringValue)") | .[]'

NULL_COUNT=$(echo "$VERIFY_RESULT" | jq -r '.records[0][] | select(.name | startswith("null_")) | .longValue' | awk '{s+=$1} END {print s}')

if [ "$NULL_COUNT" -eq 0 ]; then
  echo ""
  log_success "SUCCESS: All scenarios have been updated with default values"
else
  echo ""
  log_warning "WARNING: $NULL_COUNT NULL values remain. Please check manually."
fi
