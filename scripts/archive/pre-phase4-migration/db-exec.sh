#!/bin/bash
#
# Database Execute Script (S3 Upload Method)
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
  echo -e "${RED}Error: SQL file must be provided${NC}"
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

if [ ! -f "$SQL_FILE" ]; then
  echo -e "${RED}Error: File not found: $SQL_FILE${NC}"
  exit 1
fi

# Generate unique query ID
QUERY_ID="query-$(date +%Y%m%d-%H%M%S)-$RANDOM.sql"

# Display info
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Database Execute (S3 Method)${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "Environment: ${BLUE}$ENVIRONMENT${NC}"
echo -e "Function: ${BLUE}$FUNCTION_NAME${NC}"
echo -e "S3 Bucket: ${BLUE}$S3_BUCKET${NC}"
echo -e "SQL File: ${BLUE}$SQL_FILE${NC}"
echo -e "Query ID: ${BLUE}$QUERY_ID${NC}"
echo -e "Read-only: ${BLUE}$READ_ONLY${NC}"
echo ""

# Preview SQL
echo -e "${YELLOW}SQL Preview:${NC}"
head -10 "$SQL_FILE"
if [ $(wc -l < "$SQL_FILE") -gt 10 ]; then
  echo "... (truncated, $(wc -l < "$SQL_FILE") lines total)"
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

# Upload to S3
echo -e "${CYAN}[1/3] Uploading SQL to S3...${NC}"
aws s3 cp "$SQL_FILE" "s3://${S3_BUCKET}/${QUERY_ID}" --quiet

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Uploaded to s3://${S3_BUCKET}/${QUERY_ID}${NC}"
else
  echo -e "${RED}✗ Upload failed${NC}"
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
echo -e "${CYAN}[2/3] Invoking Lambda...${NC}"

RESULT=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  /tmp/db-exec-result.json 2>&1)

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Lambda invocation failed${NC}"
  echo "$RESULT"

  # Cleanup S3
  echo ""
  echo -e "${CYAN}Cleaning up S3...${NC}"
  aws s3 rm "s3://${S3_BUCKET}/${QUERY_ID}" --quiet || true

  exit 1
fi

# Parse result
RESULT_JSON=$(cat /tmp/db-exec-result.json)
SUCCESS=$(echo "$RESULT_JSON" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Query executed successfully${NC}"
  echo ""

  ROW_COUNT=$(echo "$RESULT_JSON" | jq -r '.rowCount')
  EXEC_TIME=$(echo "$RESULT_JSON" | jq -r '.executionTime')

  echo -e "Rows affected: ${BLUE}$ROW_COUNT${NC}"
  echo -e "Execution time: ${BLUE}${EXEC_TIME}ms${NC}"
else
  echo -e "${RED}✗ Query failed${NC}"
  echo ""

  ERROR=$(echo "$RESULT_JSON" | jq -r '.error')
  echo -e "${RED}Error: $ERROR${NC}"
fi
echo ""

# Cleanup S3
echo -e "${CYAN}[3/3] Cleaning up S3...${NC}"
aws s3 rm "s3://${S3_BUCKET}/${QUERY_ID}" --quiet

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Cleanup complete${NC}"
else
  echo -e "${YELLOW}⚠ Cleanup failed (file will auto-delete after 7 days)${NC}"
fi

# Exit with appropriate code
if [ "$SUCCESS" = "true" ]; then
  exit 0
else
  exit 1
fi
