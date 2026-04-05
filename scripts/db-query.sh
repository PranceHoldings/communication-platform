#!/bin/bash
#
# Database Query Script (v2 - Shared Library版)
# Purpose: Execute SQL queries on Aurora RDS via Lambda
#
# Usage:
#   bash scripts/db-query.sh "SELECT * FROM scenarios LIMIT 5"
#   bash scripts/db-query.sh --file queries/test.sql
#   bash scripts/db-query.sh --write "UPDATE scenarios SET title='New' WHERE id='xxx'"
#
# Features:
#   - Read-only by default (only SELECT queries)
#   - Write mode with --write flag
#   - Direct SQL or from file
#   - JSON output for parsing
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Default values
ENVIRONMENT="dev"
FUNCTION_NAME="prance-db-query-${ENVIRONMENT}"
READ_ONLY=true
SQL=""
SQL_FILE=""
MAX_RESULTS=1000

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --write)
      READ_ONLY=false
      shift
      ;;
    --file)
      SQL_FILE="$2"
      shift 2
      ;;
    --max-results)
      MAX_RESULTS="$2"
      shift 2
      ;;
    --env)
      ENVIRONMENT="$2"
      FUNCTION_NAME="prance-db-query-${ENVIRONMENT}"
      shift 2
      ;;
    *)
      SQL="$1"
      shift
      ;;
  esac
done

# Validate input
if [ -z "$SQL" ] && [ -z "$SQL_FILE" ]; then
  log_error "SQL query or --file must be provided"
  echo ""
  echo "Usage:"
  echo "  bash scripts/db-query.sh \"SELECT * FROM scenarios LIMIT 5\""
  echo "  bash scripts/db-query.sh --file queries/test.sql"
  echo "  bash scripts/db-query.sh --write \"UPDATE scenarios SET ...\" "
  echo ""
  echo "Options:"
  echo "  --write         Allow write operations (INSERT, UPDATE, DELETE)"
  echo "  --file FILE     Read SQL from file"
  echo "  --max-results N Maximum rows to return (default: 1000)"
  echo "  --env ENV       Environment (default: dev)"
  exit 1
fi

# Load SQL from file if specified
if [ -n "$SQL_FILE" ]; then
  require_file "$SQL_FILE" "SQL file not found"
  SQL=$(cat "$SQL_FILE")
fi

# Display query info
log_section "Database Query Execution"
log_info "Environment: $ENVIRONMENT"
log_info "Function: $FUNCTION_NAME"
log_info "Read-only: $READ_ONLY"
log_info "Max results: $MAX_RESULTS"
echo ""
log_info "Query:"
echo "$SQL" | head -10
if [ $(echo "$SQL" | wc -l) -gt 10 ]; then
  echo "... (truncated)"
fi
echo ""

# Confirm for write operations (skip if --force or FORCE=true)
if [ "$READ_ONLY" = false ] && [ "${FORCE:-false}" != "true" ] && [[ "$*" != *"--force"* ]]; then
  log_warning "⚠️  WARNING: Write operations enabled"
  if ! confirm "Continue"; then
    echo "Cancelled"
    exit 0
  fi
fi

# Escape SQL for JSON
SQL_ESCAPED=$(echo "$SQL" | jq -Rs .)

# Create payload
PAYLOAD=$(cat <<EOF
{
  "sql": $SQL_ESCAPED,
  "readOnly": $READ_ONLY,
  "maxResults": $MAX_RESULTS
}
EOF
)

# Invoke Lambda
log_info "Invoking Lambda..."
echo ""

RESULT=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  /tmp/db-query-result.json 2>&1)

# Check for errors
if [ $? -ne 0 ]; then
  log_error "Lambda invocation failed"
  echo "$RESULT"
  exit 1
fi

# Parse result
if [ ! -f /tmp/db-query-result.json ]; then
  log_error "Result file not found"
  exit 1
fi

# Display result
RESULT_JSON=$(cat /tmp/db-query-result.json)
SUCCESS=$(echo "$RESULT_JSON" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  log_success "Query executed successfully"
  echo ""

  ROW_COUNT=$(echo "$RESULT_JSON" | jq -r '.rowCount')
  EXEC_TIME=$(echo "$RESULT_JSON" | jq -r '.executionTime')

  log_info "Rows: $ROW_COUNT"
  log_info "Execution time: ${EXEC_TIME}ms"
  echo ""

  # Display data
  DATA=$(echo "$RESULT_JSON" | jq -r '.data')

  if [ "$DATA" != "null" ] && [ "$DATA" != "[]" ]; then
    log_info "Results:"
    echo "$DATA" | jq -C '.' | head -50

    if [ $(echo "$DATA" | jq '. | length') -gt 10 ]; then
      echo ""
      log_warning "... (showing first 10 rows, use --max-results to see more)"
    fi
  else
    log_warning "No data returned"
  fi
else
  log_error "Query failed"
  echo ""

  ERROR=$(echo "$RESULT_JSON" | jq -r '.error')
  log_error "Error: $ERROR"

  exit 1
fi

# Save full result
echo ""
log_info "Full result saved to: /tmp/db-query-result.json"
