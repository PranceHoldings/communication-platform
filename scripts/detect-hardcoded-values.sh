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
  --exclude="*.test.ts" --exclude="*.spec.ts" --exclude="next.config.js" \
  "${TARGET_DIR}" 2>/dev/null | grep -v "url-generator.ts" | grep -v "\.next" | grep -v "^\s*/\*\|^\s*\*\|^\s*//" || true)

if [ -n "$S3_MATCHES" ]; then
  FILTERED_S3_MATCHES=$(echo "$S3_MATCHES" | grep -v "\.next" | grep -v "^\s*/\*\|^\s*\*\|^\s*//" || true)
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
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out --exclude-dir=backups \
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
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=backups \
  --exclude="defaults.ts" --exclude="env-validator.ts" --exclude="*.md" \
  --exclude="*.test.ts" --exclude="*.spec.ts" --exclude="*.config.ts" --exclude="*.config.js" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$DEFAULT_ENV_MATCHES" ]; then
  # Filter and collect errors
  FILTERED_DEFAULT_ENV=""
  FILTERED_COUNT=0
  while IFS= read -r line; do
    # Skip comment lines
    if echo "$line" | sed 's/^[^:]*:[^:]*://' | grep -qE '^\s*(//|\*|/\*)'; then
      continue
    fi
    # Exclude scripts directory (test/performance scripts)
    if echo "$line" | grep -q "^\./scripts/"; then
      continue
    fi
    # Exclude CDK infrastructure code (deployment-time configuration)
    if echo "$line" | grep -q "^\./infrastructure/lib/"; then
      continue
    fi
    # Exclude CDK build artifacts
    if echo "$line" | grep -q "^\./infrastructure/cdk.out/"; then
      continue
    fi
    # Exclude frontend code (Next.js public env vars need fallbacks for local dev)
    if echo "$line" | grep -q "^\./apps/web/"; then
      continue
    fi
    # Exclude function definitions (getOptionalEnv, getEnv)
    if ! echo "$line" | grep -q 'function\|getOptionalEnv\|getEnv'; then
      FILTERED_DEFAULT_ENV="${FILTERED_DEFAULT_ENV}${line}\n"
      ((FILTERED_COUNT++))
    fi
  done <<< "$DEFAULT_ENV_MATCHES"

  # Only print and count if there are actual errors
  if [ -n "$FILTERED_DEFAULT_ENV" ]; then
    echo -e "${RED}❌ Default environment values detected:${NC}"
    echo -e "$FILTERED_DEFAULT_ENV" | sed 's/^/  /'
    echo ""
    echo -e "${YELLOW}Fix: Use getRequiredEnv() or getOptionalEnv() from env-validator.ts${NC}"
    echo ""
    ERROR_COUNT=$((ERROR_COUNT + FILTERED_COUNT))
  fi
fi

# ============================================================
# Pattern 4: Hardcoded Regions
# ============================================================
echo "Checking for hardcoded AWS regions..."

REGION_MATCHES=$(grep -rn "REGION.*:.*['\"][a-z]\{2\}-[a-z]\+-[0-9]['\"]" \
  --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out --exclude-dir=backups \
  --exclude="defaults.ts" --exclude="*.md" \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null || true)

if [ -n "$REGION_MATCHES" ]; then
  # Filter and collect errors
  FILTERED_REGION=""
  FILTERED_COUNT=0
  while IFS= read -r line; do
    # Exclude lines with process.env
    if ! echo "$line" | grep -q 'process\.env'; then
      FILTERED_REGION="${FILTERED_REGION}${line}\n"
      ((FILTERED_COUNT++))
    fi
  done <<< "$REGION_MATCHES"

  # Only print and count if there are actual errors
  if [ -n "$FILTERED_REGION" ]; then
    echo -e "${RED}❌ Hardcoded AWS regions detected:${NC}"
    echo -e "$FILTERED_REGION" | sed 's/^/  /'
    echo ""
    echo -e "${YELLOW}Fix: Use process.env.AWS_REGION or AWS_DEFAULTS.REGION from defaults.ts${NC}"
    echo ""
    ERROR_COUNT=$((ERROR_COUNT + FILTERED_COUNT))
  fi
fi

# ============================================================
# Pattern 5: Hardcoded Lambda Function Names
# ============================================================
echo "Checking for hardcoded Lambda function names..."

LAMBDA_MATCHES=$(grep -rn "FunctionName.*['\"]prance-.*-dev['\"]" \
  --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out --exclude-dir=backups \
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
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out --exclude-dir=backups \
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
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out --exclude-dir=backups \
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
# Pattern 8: AWS Domain Hardcoding
# ============================================================
echo "Checking for hardcoded AWS domains..."

AWS_DOMAIN_MATCHES=$(grep -rn "\.amazonaws\.com" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out --exclude-dir=backups \
  --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}" 2>/dev/null | grep -v "url-generator.ts" | grep -v "^\s*/\*\|^\s*\*\|^\s*//" || true)

if [ -n "$AWS_DOMAIN_MATCHES" ]; then
  # Filter and collect errors
  FILTERED_AWS_DOMAIN=""
  FILTERED_COUNT=0
  while IFS= read -r line; do
    # Skip comment lines
    if echo "$line" | sed 's/^[^:]*:[^:]*://' | grep -qE '^\s*(//|\*|/\*)'; then
      continue
    fi
    # Exclude scripts directory (test/performance scripts)
    if echo "$line" | grep -q "^\./scripts/"; then
      continue
    fi
    # Exclude CDK infrastructure code (uses template strings with variables)
    if echo "$line" | grep -q "^\./infrastructure/lib/"; then
      continue
    fi
    FILTERED_AWS_DOMAIN="${FILTERED_AWS_DOMAIN}${line}\n"
    ((FILTERED_COUNT++))
  done <<< "$AWS_DOMAIN_MATCHES"

  # Only print and count if there are actual errors
  if [ -n "$FILTERED_AWS_DOMAIN" ]; then
    echo -e "${RED}❌ Hardcoded AWS domains detected:${NC}"
    echo -e "$FILTERED_AWS_DOMAIN" | sed 's/^/  /'
    echo ""
    echo -e "${YELLOW}Fix: Use getAwsEndpointSuffix() from env-validator.ts${NC}"
    echo -e "${YELLOW}     Add AWS_ENDPOINT_SUFFIX=amazonaws.com to .env.local${NC}"
    echo ""
    ERROR_COUNT=$((ERROR_COUNT + FILTERED_COUNT))
  fi
fi

# ============================================================
# Pattern 9: Numeric Hardcoded Constants (Backend only)
# ============================================================
echo "Checking for numeric hardcoded constants in backend..."

# Only check infrastructure/lambda (backend), exclude frontend components
NUMERIC_MATCHES=$(grep -rn "^[[:space:]]*const [A-Z_][A-Z_0-9]* = [0-9]" \
  --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=cdk.out --exclude-dir=backups \
  --exclude="defaults.ts" --exclude="*.test.ts" --exclude="*.spec.ts" \
  "${TARGET_DIR}/infrastructure/lambda" 2>/dev/null || true)

if [ -n "$NUMERIC_MATCHES" ]; then
  echo -e "${RED}❌ Numeric hardcoded constants detected:${NC}"
  echo "$NUMERIC_MATCHES" | while IFS= read -r line; do
    # Skip comment lines
    if echo "$line" | sed 's/^[^:]*:[^:]*://' | grep -qE '^\s*(//|\*|/\*)'; then
      continue
    fi
    # Exclude lines that are importing from defaults
    if ! echo "$line" | grep -q 'from.*defaults\|DEFAULTS\.'; then
      echo "  $line"
      ((ERROR_COUNT++))
    fi
  done
  echo ""
  echo -e "${YELLOW}Fix: Move constants to infrastructure/lambda/shared/config/defaults.ts${NC}"
  echo -e "${YELLOW}     Categories: QUERY_DEFAULTS, SECURITY_DEFAULTS, AUDIO_PROCESSING_DEFAULTS, AI_DEFAULTS, SCORE_DEFAULTS${NC}"
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
