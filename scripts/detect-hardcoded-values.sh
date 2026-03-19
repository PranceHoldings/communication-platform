#!/bin/bash
#
# Hardcoded Values Detection Script
#
# ハードコードされた値を検出し、エラーとして報告する
#
# Usage:
#   bash scripts/detect-hardcoded-values.sh [directory]
#
# Exit codes:
#   0 - No hardcoded values detected
#   1 - Hardcoded values detected
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Target directory (default: all)
TARGET_DIR="${1:-.}"

# Error counter
ERROR_COUNT=0

echo ""
echo "🔍 Detecting hardcoded values in ${TARGET_DIR}..."
echo ""

# ============================================================
# Pattern 1: S3 Direct URLs
# ============================================================
echo "Checking for S3 direct URLs..."

S3_MATCHES=$(grep -rn "\.s3\.amazonaws\.com\|\.s3\.[a-z0-9-]*\.amazonaws\.com" \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null | grep -v "^\s*/\*\|^\s*\*\|^\s*//" || true)

if [ -n "$S3_MATCHES" ]; then
  FILTERED_S3_MATCHES=$(echo "$S3_MATCHES" | grep -v "^\s*/\*\|^\s*\*\|^\s*//" || true)
  if [ -n "$FILTERED_S3_MATCHES" ]; then
    echo -e "${RED}❌ S3 direct URLs detected:${NC}"
    echo "$FILTERED_S3_MATCHES" | while IFS= read -r line; do
      # Skip comment lines (check the content after line number)
      if ! echo "$line" | sed 's/^[^:]*:[^:]*://' | grep -qE '^\s*(//|\*|/\*)'; then
        echo "  $line"
        ((ERROR_COUNT++))
      fi
    done
    echo ""
    echo -e "${YELLOW}Fix: Use generateCdnUrl() or generateProtectedUrl() from url-generator.ts${NC}"
    echo ""
  fi
fi

# ============================================================
# Pattern 2: CloudFront Direct URLs (specific domains)
# ============================================================
echo "Checking for CloudFront direct URLs..."

CLOUDFRONT_MATCHES=$(grep -rn "https://[a-z0-9]\{13\}\.cloudfront\.net" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  --exclude="defaults.ts" --exclude="*.md" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$CLOUDFRONT_MATCHES" ]; then
  echo -e "${RED}❌ CloudFront direct URLs detected:${NC}"
  echo "$CLOUDFRONT_MATCHES" | while IFS= read -r line; do
    # Skip comment lines
    if echo "$line" | sed 's/^[^:]*:[^:]*://' | grep -qE '^\s*(//|\*|/\*)'; then
      continue
    fi
    # Exclude lines with variables (${...} or CLOUDFRONT_DOMAIN)
    if ! echo "$line" | grep -q '\${\|CLOUDFRONT_DOMAIN'; then
      echo "  $line"
      ((ERROR_COUNT++))
    fi
  done
  echo ""
  echo -e "${YELLOW}Fix: Use generateCdnUrl() from url-generator.ts${NC}"
  echo ""
fi

# ============================================================
# Pattern 3: Default Environment Values (|| 'default')
# ============================================================
echo "Checking for default environment values..."

DEFAULT_ENV_MATCHES=$(grep -rn "process\.env\.[A-Z_][A-Z0-9_]* || ['\"]" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build \
  --exclude="defaults.ts" --exclude="env-validator.ts" --exclude="*.md" \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$DEFAULT_ENV_MATCHES" ]; then
  echo -e "${RED}❌ Default environment values detected:${NC}"
  echo "$DEFAULT_ENV_MATCHES" | while IFS= read -r line; do
    # Skip comment lines
    if echo "$line" | sed 's/^[^:]*:[^:]*://' | grep -qE '^\s*(//|\*|/\*)'; then
      continue
    fi
    # Exclude function definitions (getOptionalEnv, getEnv)
    if ! echo "$line" | grep -q 'function\|getOptionalEnv\|getEnv'; then
      echo "  $line"
      ((ERROR_COUNT++))
    fi
  done
  echo ""
  echo -e "${YELLOW}Fix: Use getRequiredEnv() or getOptionalEnv() from env-validator.ts${NC}"
  echo ""
fi

# ============================================================
# Pattern 4: Hardcoded Regions
# ============================================================
echo "Checking for hardcoded AWS regions..."

REGION_MATCHES=$(grep -rn "REGION.*:.*['\"][a-z]\{2\}-[a-z]\+-[0-9]['\"]" \
  --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build \
  --exclude="defaults.ts" --exclude="*.md" \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$REGION_MATCHES" ]; then
  echo -e "${RED}❌ Hardcoded AWS regions detected:${NC}"
  echo "$REGION_MATCHES" | while IFS= read -r line; do
    # Exclude lines with process.env
    if ! echo "$line" | grep -q 'process\.env'; then
      echo "  $line"
      ((ERROR_COUNT++))
    fi
  done
  echo ""
  echo -e "${YELLOW}Fix: Use process.env.AWS_REGION or AWS_DEFAULTS.REGION from defaults.ts${NC}"
  echo ""
fi

# ============================================================
# Pattern 5: Hardcoded Lambda Function Names
# ============================================================
echo "Checking for hardcoded Lambda function names..."

LAMBDA_MATCHES=$(grep -rn "FunctionName.*['\"]prance-.*-dev['\"]" \
  --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build \
  --exclude="*.md" \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$LAMBDA_MATCHES" ]; then
  echo -e "${RED}❌ Hardcoded Lambda function names detected:${NC}"
  echo "$LAMBDA_MATCHES" | while IFS= read -r line; do
    echo "  $line"
    ((ERROR_COUNT++))
  done
  echo ""
  echo -e "${YELLOW}Fix: Use getAnalysisLambdaFunctionName() from env-validator.ts${NC}"
  echo ""
fi

# ============================================================
# Pattern 6: Hardcoded localhost URLs
# ============================================================
echo "Checking for hardcoded localhost URLs..."

LOCALHOST_MATCHES=$(grep -rn "['\"]http://localhost:[0-9]\+['\"]" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build \
  --exclude="playwright.config.ts" --exclude="*.md" \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$LOCALHOST_MATCHES" ]; then
  echo -e "${RED}❌ Hardcoded localhost URLs detected:${NC}"
  echo "$LOCALHOST_MATCHES" | while IFS= read -r line; do
    echo "  $line"
    ((ERROR_COUNT++))
  done
  echo ""
  echo -e "${YELLOW}Fix: Use getFrontendUrl() from env-validator.ts or configure BASE_URL${NC}"
  echo ""
fi

# ============================================================
# Pattern 7: Hardcoded Bucket Names
# ============================================================
echo "Checking for hardcoded bucket names..."

BUCKET_MATCHES=$(grep -rn "['\"]prance-[a-z-]*-dev['\"]" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build \
  --exclude="*.md" --exclude="lib/api-lambda-stack.ts" \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$BUCKET_MATCHES" ]; then
  echo -e "${RED}❌ Hardcoded bucket names detected:${NC}"
  echo "$BUCKET_MATCHES" | while IFS= read -r line; do
    # Exclude CDK stack definitions (legitimate use)
    if ! echo "$line" | grep -q 'bucketName:\|Bucket('; then
      echo "  $line"
      ((ERROR_COUNT++))
    fi
  done
  echo ""
  echo -e "${YELLOW}Fix: Use getS3Bucket() from env-validator.ts${NC}"
  echo ""
fi

# ============================================================
# Summary
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ No hardcoded values detected${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Found ${ERROR_COUNT} hardcoded value(s)${NC}"
  echo ""
  echo "Please fix the issues above before committing."
  echo ""
  echo "Documentation:"
  echo "  - docs/07-development/HARDCODE_PREVENTION_SYSTEM.md"
  echo "  - infrastructure/lambda/shared/utils/url-generator.ts"
  echo "  - infrastructure/lambda/shared/utils/env-validator.ts"
  echo ""
  exit 1
fi
