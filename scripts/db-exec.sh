#!/bin/bash
#
# Database Execute Script (S3 Upload Method) (v2 - Shared Library版)
# Purpose: Execute large SQL queries via S3 + Lambda
#
# Usage:
#   bash scripts/db-exec.sh queries/migration.sql
#   bash scripts/db-exec.sh --write queries/update.sql
#
# Features:
#   - Upload SQL to S3
#   - Execute via Lambda
#   - Automatic cleanup
#   - Progress indication
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Default values
ENVIRONMENT="dev"
FUNCTION_NAME="prance-db-query-${ENVIRONMENT}"
S3_BUCKET="prance-db-queries-${ENVIRONMENT}"
READ_ONLY=true
SQL_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --write)
      READ_ONLY=false
      shift
      ;;
    --env)
      ENVIRONMENT="$2"
      FUNCTION_NAME="prance-db-query-${ENVIRONMENT}"
      S3_BUCKET="prance-db-queries-${ENVIRONMENT}"
      shift 2
      ;;
    *)
      SQL_FILE="$1"
      shift
      ;;
  esac
done

# Validate input
if [ -z "$SQL_FILE" ]; then
  log_error "SQL file must be provided"
  echo ""
  echo "Usage:"
  echo "  bash scripts/db-exec.sh queries/test.sql"
  echo "  bash scripts/db-exec.sh --write queries/update.sql"
  echo ""
  echo "Options:"
  echo "  --write     Allow write operations"
  echo "  --env ENV   Environment (default: dev)"
  exit 1
fi

require_file "$SQL_FILE" "SQL file not found"

# Generate unique query ID
QUERY_ID="query-$(date +%Y%m%d-%H%M%S)-$RANDOM.sql"

# Display info
log_section "Database Execute (S3 Method)"
log_info "Environment: $ENVIRONMENT"
log_info "Function: $FUNCTION_NAME"
log_info "S3 Bucket: $S3_BUCKET"
log_info "SQL File: $SQL_FILE"
log_info "Query ID: $QUERY_ID"
log_info "Read-only: $READ_ONLY"
echo ""

# Preview SQL
log_info "SQL Preview:"
head -10 "$SQL_FILE"
if [ $(wc -l < "$SQL_FILE") -gt 10 ]; then
  echo "... (truncated, $(wc -l < "$SQL_FILE") lines total)"
fi
echo ""

# Confirm for write operations
if [ "$READ_ONLY" = false ]; then
  log_warning "⚠️  WARNING: Write operations enabled"
  if ! confirm "Continue"; then
    echo "Cancelled"
    exit 0
  fi
fi

# Upload to S3
log_step "1/3" "Uploading SQL to S3"
aws s3 cp "$SQL_FILE" "s3://${S3_BUCKET}/${QUERY_ID}" --quiet

if [ $? -eq 0 ]; then
  log_success "Uploaded to s3://${S3_BUCKET}/${QUERY_ID}"
else
  log_error "Upload failed"
  exit 1
fi
echo ""

# Create payload
PAYLOAD=$(cat <<EOF
{
  "queryId": "$QUERY_ID",
  "readOnly": $READ_ONLY
}
EOF
)

# Invoke Lambda
log_step "2/3" "Invoking Lambda"

RESULT=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  /tmp/db-exec-result.json 2>&1)

if [ $? -ne 0 ]; then
  log_error "Lambda invocation failed"
  echo "$RESULT"

  # Cleanup S3
  echo ""
  log_info "Cleaning up S3..."
  aws s3 rm "s3://${S3_BUCKET}/${QUERY_ID}" --quiet || true

  exit 1
fi

# Parse result
RESULT_JSON=$(cat /tmp/db-exec-result.json)
SUCCESS=$(echo "$RESULT_JSON" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  log_success "Query executed successfully"
  echo ""

  ROW_COUNT=$(echo "$RESULT_JSON" | jq -r '.rowCount')
  EXEC_TIME=$(echo "$RESULT_JSON" | jq -r '.executionTime')

  log_info "Rows affected: $ROW_COUNT"
  log_info "Execution time: ${EXEC_TIME}ms"
else
  log_error "Query failed"
  echo ""

  ERROR=$(echo "$RESULT_JSON" | jq -r '.error')
  log_error "Error: $ERROR"
fi
echo ""

# Cleanup S3
log_step "3/3" "Cleaning up S3"
aws s3 rm "s3://${S3_BUCKET}/${QUERY_ID}" --quiet

if [ $? -eq 0 ]; then
  log_success "Cleanup complete"
else
  log_warning "Cleanup failed (file will auto-delete after 7 days)"
fi

# Exit with appropriate code
if [ "$SUCCESS" = "true" ]; then
  exit 0
else
  exit 1
fi
