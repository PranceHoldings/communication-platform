#!/bin/bash
#
# Test db-mutation Lambda Function
#
# Usage:
#   bash scripts/test-db-mutation.sh <environment> <mode> [sessionId]
#
# Examples:
#   bash scripts/test-db-mutation.sh dev dry-run f839e789-e5ae-4e39-b184-d975d6e7029f
#   bash scripts/test-db-mutation.sh dev execute f839e789-e5ae-4e39-b184-d975d6e7029f
#

set -e

# Parse arguments
ENVIRONMENT="${1:-dev}"
EXECUTION_MODE="${2:-dry-run}"
SESSION_ID="${3:-f839e789-e5ae-4e39-b184-d975d6e7029f}"
CDN_DOMAIN="${CLOUDFRONT_DOMAIN:-d3mx0sug5s3a6x.cloudfront.net}"

FUNCTION_NAME="prance-db-mutation-${ENVIRONMENT}"

echo "========================================="
echo " DB Mutation Test"
echo "========================================="
echo "Environment: ${ENVIRONMENT}"
echo "Function: ${FUNCTION_NAME}"
echo "Execution Mode: ${EXECUTION_MODE}"
echo "Session ID: ${SESSION_ID}"
echo "CDN Domain: ${CDN_DOMAIN}"
echo ""

# Test 1: Dry-run direct SQL
echo "========================================="
echo " Test 1: Dry-run Direct SQL"
echo "========================================="

PAYLOAD=$(cat <<EOF
{
  "mode": "direct",
  "executionMode": "dry-run",
  "sql": "INSERT INTO recordings (id, session_id, type, s3_key, s3_url, cdn_url, file_size_bytes, duration_sec, format, resolution, processing_status, created_at) VALUES (gen_random_uuid(), '${SESSION_ID}', 'COMBINED', 'test.webm', 'https://test.s3.amazonaws.com/test.webm', 'https://cdn.test.com/test.webm', 5242880, 120, 'webm', '1280x720', 'COMPLETED', NOW())"
}
EOF
)

echo "$PAYLOAD" | jq '.'
echo ""

aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --cli-binary-format raw-in-base64-out \
  --payload "$PAYLOAD" \
  /tmp/test1-result.json

echo "Result:"
cat /tmp/test1-result.json | jq '.'
echo ""

# Test 2: Preset query (seed-test-recording)
echo "========================================="
echo " Test 2: Preset Query - seed-test-recording"
echo "========================================="

PAYLOAD=$(cat <<EOF
{
  "mode": "preset",
  "executionMode": "${EXECUTION_MODE}",
  "queryId": "seed-test-recording",
  "params": {
    "sessionId": "${SESSION_ID}",
    "cdnDomain": "${CDN_DOMAIN}"
  }
}
EOF
)

echo "$PAYLOAD" | jq '.'
echo ""

aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --cli-binary-format raw-in-base64-out \
  --payload "$PAYLOAD" \
  /tmp/test2-result.json

echo "Result:"
cat /tmp/test2-result.json | jq '.'
echo ""

# Test 3: Preset query (seed-test-transcripts)
if [ "${EXECUTION_MODE}" = "execute" ]; then
  echo "========================================="
  echo " Test 3: Preset Query - seed-test-transcripts"
  echo "========================================="

  PAYLOAD=$(cat <<EOF
{
  "mode": "preset",
  "executionMode": "execute",
  "queryId": "seed-test-transcripts",
  "params": {
    "sessionId": "${SESSION_ID}"
  }
}
EOF
)

  echo "$PAYLOAD" | jq '.'
  echo ""

  aws lambda invoke \
    --function-name "${FUNCTION_NAME}" \
    --cli-binary-format raw-in-base64-out \
    --payload "$PAYLOAD" \
    /tmp/test3-result.json

  echo "Result:"
  cat /tmp/test3-result.json | jq '.'
  echo ""

  # Test 4: Preset query (seed-test-score)
  echo "========================================="
  echo " Test 4: Preset Query - seed-test-score"
  echo "========================================="

  PAYLOAD=$(cat <<EOF
{
  "mode": "preset",
  "executionMode": "execute",
  "queryId": "seed-test-score",
  "params": {
    "sessionId": "${SESSION_ID}"
  }
}
EOF
)

  echo "$PAYLOAD" | jq '.'
  echo ""

  aws lambda invoke \
    --function-name "${FUNCTION_NAME}" \
    --cli-binary-format raw-in-base64-out \
    --payload "$PAYLOAD" \
    /tmp/test4-result.json

  echo "Result:"
  cat /tmp/test4-result.json | jq '.'
  echo ""
fi

echo "========================================="
echo " ✅ All tests completed"
echo "========================================="
echo ""
echo "To insert full test data:"
echo "  bash scripts/test-db-mutation.sh dev execute ${SESSION_ID}"
echo ""
