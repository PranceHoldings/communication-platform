#!/bin/bash
#
# Database Query Script
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

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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
  echo -e "${RED}Error: SQL query or --file must be provided${NC}"
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
  if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}Error: File not found: $SQL_FILE${NC}"
    exit 1
  fi
  SQL=$(cat "$SQL_FILE")
fi

# Display query info
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Database Query Execution${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "Environment: ${BLUE}$ENVIRONMENT${NC}"
echo -e "Function: ${BLUE}$FUNCTION_NAME${NC}"
echo -e "Read-only: ${BLUE}$READ_ONLY${NC}"
echo -e "Max results: ${BLUE}$MAX_RESULTS${NC}"
echo ""
echo -e "${YELLOW}Query:${NC}"
echo "$SQL" | head -10
if [ $(echo "$SQL" | wc -l) -gt 10 ]; then
  echo "... (truncated)"
fi
echo ""

# Confirm for write operations
if [ "$READ_ONLY" = false ]; then
  echo -e "${YELLOW}⚠️  WARNING: Write operations enabled${NC}"
  read -p "Continue? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
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
echo -e "${CYAN}Invoking Lambda...${NC}"
echo ""

RESULT=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  /tmp/db-query-result.json 2>&1)

# Check for errors
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Lambda invocation failed${NC}"
  echo "$RESULT"
  exit 1
fi

# Parse result
if [ ! -f /tmp/db-query-result.json ]; then
  echo -e "${RED}✗ Result file not found${NC}"
  exit 1
fi

# Display result
RESULT_JSON=$(cat /tmp/db-query-result.json)
SUCCESS=$(echo "$RESULT_JSON" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Query executed successfully${NC}"
  echo ""

  ROW_COUNT=$(echo "$RESULT_JSON" | jq -r '.rowCount')
  EXEC_TIME=$(echo "$RESULT_JSON" | jq -r '.executionTime')

  echo -e "Rows: ${BLUE}$ROW_COUNT${NC}"
  echo -e "Execution time: ${BLUE}${EXEC_TIME}ms${NC}"
  echo ""

  # Display data
  DATA=$(echo "$RESULT_JSON" | jq -r '.data')

  if [ "$DATA" != "null" ] && [ "$DATA" != "[]" ]; then
    echo -e "${YELLOW}Results:${NC}"
    echo "$DATA" | jq -C '.' | head -50

    if [ $(echo "$DATA" | jq '. | length') -gt 10 ]; then
      echo ""
      echo -e "${YELLOW}... (showing first 10 rows, use --max-results to see more)${NC}"
    fi
  else
    echo -e "${YELLOW}No data returned${NC}"
  fi
else
  echo -e "${RED}✗ Query failed${NC}"
  echo ""

  ERROR=$(echo "$RESULT_JSON" | jq -r '.error')
  echo -e "${RED}Error: $ERROR${NC}"

  exit 1
fi

# Save full result
echo ""
echo -e "${CYAN}Full result saved to: /tmp/db-query-result.json${NC}"
