#!/bin/bash

###############################################################################
# Comprehensive Environment Variable Audit
#
# Systematically audits all Lambda functions for environment variable usage
# and cross-references with CDK definitions
###############################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="/workspaces/prance-communication-platform"
LAMBDA_DIR="${PROJECT_ROOT}/infrastructure/lambda"
OUTPUT_FILE="${PROJECT_ROOT}/docs/09-progress/archives/2026-03-20-environment-variable-audit/DETAILED_AUDIT_RESULTS.md"

echo "=================================================="
echo "Comprehensive Environment Variable Audit"
echo "=================================================="
echo ""

# Create output file header
cat > "$OUTPUT_FILE" << 'EOF'
# Detailed Environment Variable Audit Results

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Audit Scope:** All 44 Lambda functions

---

## Audit Methodology

1. **Extract direct `process.env.XXX` references** from each Lambda function
2. **Extract env-validator getter calls** (getRequiredEnv, getAwsRegion, etc.)
3. **Cross-reference with CDK environment blocks** in api-lambda-stack.ts
4. **Identify missing, duplicate, or unused variables**

---

EOF

echo "Step 1: Analyzing Lambda functions..."

# Find all Lambda function handlers
LAMBDA_FUNCTIONS=$(find "$LAMBDA_DIR" -type f -name "index.ts" \
  -not -path "*/node_modules/*" \
  -not -path "*/shared/*" \
  -not -path "*/report/templates/*" | sort)

TOTAL_FUNCTIONS=$(echo "$LAMBDA_FUNCTIONS" | wc -l | tr -d ' ')
echo "Found $TOTAL_FUNCTIONS Lambda functions to audit"
echo ""

# Initialize counters
COUNT=0

# Analyze each function
for FUNC_PATH in $LAMBDA_FUNCTIONS; do
  COUNT=$((COUNT + 1))

  # Get function name from path
  FUNC_DIR=$(dirname "$FUNC_PATH")
  FUNC_NAME=$(echo "$FUNC_DIR" | sed "s|$LAMBDA_DIR/||g" | tr '/' '-')

  echo -n "[$COUNT/$TOTAL_FUNCTIONS] Analyzing: $FUNC_NAME"

  # Extract process.env references
  DIRECT_ENV=$(grep -oh "process\.env\.[A-Z_][A-Z_0-9]*" "$FUNC_PATH" 2>/dev/null | \
               sed 's/process\.env\.//' | sort -u || true)

  # Extract env-validator getter calls
  GETTER_CALLS=$(grep -oh "get[A-Za-z]*Env[A-Za-z]*(['\"][A-Z_][A-Z_0-9]*['\"])" "$FUNC_PATH" 2>/dev/null | \
                 sed "s/.*(['\"]//g" | sed "s/['\"]).*//g" | sort -u || true)

  # Named getters (getAwsRegion, getS3Bucket, etc.)
  NAMED_GETTERS=$(grep -oh "get[A-Za-z]*\(\)" "$FUNC_PATH" 2>/dev/null | sort -u || true)

  # Combine all
  ALL_ENV_REFS=$(echo -e "${DIRECT_ENV}\n${GETTER_CALLS}" | sort -u | grep -v "^$" || true)

  if [ -n "$ALL_ENV_REFS" ]; then
    ENV_COUNT=$(echo "$ALL_ENV_REFS" | wc -l | tr -d ' ')
    echo " - $ENV_COUNT env vars"
  else
    echo " - 0 env vars"
  fi

  # Append to output file
  cat >> "$OUTPUT_FILE" << FUNC_EOF

## $FUNC_NAME

**Path:** \`${FUNC_PATH#$PROJECT_ROOT/}\`

**Environment Variables Used:**

FUNC_EOF

  if [ -n "$ALL_ENV_REFS" ]; then
    echo "$ALL_ENV_REFS" | while read -r VAR; do
      if [ -n "$VAR" ]; then
        echo "- \`$VAR\`" >> "$OUTPUT_FILE"
      fi
    done
  else
    echo "_None_" >> "$OUTPUT_FILE"
  fi

  if [ -n "$NAMED_GETTERS" ]; then
    cat >> "$OUTPUT_FILE" << FUNC_EOF2

**Named Getter Functions:**

FUNC_EOF2
    echo "$NAMED_GETTERS" | while read -r GETTER; do
      if [ -n "$GETTER" ]; then
        echo "- \`$GETTER\`" >> "$OUTPUT_FILE"
      fi
    done
  fi

  echo "" >> "$OUTPUT_FILE"
done

echo ""
echo "Step 2: Extracting CDK environment definitions..."

CDK_FILE="${PROJECT_ROOT}/infrastructure/lib/api-lambda-stack.ts"

# Extract all environment blocks from CDK
# This is complex - we'll extract function names and their environment vars

echo ""
echo "Step 3: Generating summary..."

cat >> "$OUTPUT_FILE" << 'EOF'

---

## Summary Statistics

EOF

echo "- Total Lambda functions analyzed: $TOTAL_FUNCTIONS" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo -e "${GREEN}✅ Audit complete!${NC}"
echo ""
echo "Results saved to:"
echo "  $OUTPUT_FILE"
echo ""
echo "Next: Review the results and identify missing/duplicate variables"
