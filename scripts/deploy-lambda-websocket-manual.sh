#!/bin/bash
#
# Lambda WebSocket Manual Deployment Script
# Purpose: Automate all 8 steps of manual deployment with validation
# Prevents Prisma Client and ZIP structure errors
#
# Based on: docs/07-development/LAMBDA_MANUAL_DEPLOY_PROCEDURE.md
#
# Usage: bash scripts/deploy-lambda-websocket-manual.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

LAMBDA_DIR="$PROJECT_ROOT/infrastructure/lambda/websocket/default"
FUNCTION_NAME="prance-websocket-default-dev"
REGION="us-east-1"

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Lambda WebSocket Manual Deployment${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This is a fallback deployment method${NC}"
echo -e "${YELLOW}    Use this only when CDK deployment fails${NC}"
echo ""
echo -e "Function: ${BLUE}$FUNCTION_NAME${NC}"
echo -e "Region: ${BLUE}$REGION${NC}"
echo ""

# Confirm
read -p "Continue with manual deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled"
  exit 0
fi

echo ""

# =============================================================================
# Step 1: Prisma Client Generation
# =============================================================================

echo -e "${MAGENTA}[STEP 1/8]${NC} Prisma Client Generation"
echo ""

cd "$PROJECT_ROOT"
pnpm run db:generate > /dev/null 2>&1

# Validation
if [ ! -d "packages/database/node_modules/.prisma/client" ]; then
  echo -e "${RED}✗ FAIL: Prisma Client not found${NC}"
  exit 1
fi

if [ ! -f "packages/database/node_modules/.prisma/client/index.js" ]; then
  echo -e "${RED}✗ FAIL: Prisma Client index.js not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Prisma Client generated${NC}"
echo ""

# =============================================================================
# Step 2: esbuild Build
# =============================================================================

echo -e "${MAGENTA}[STEP 2/8]${NC} esbuild Build"
echo ""

cd "$LAMBDA_DIR"
pnpm exec esbuild index.ts \
  --bundle \
  --platform=node \
  --target=es2020 \
  --outfile=dist/index.js \
  --external:@aws-sdk/* \
  --external:@prisma/client \
  --sourcemap > /dev/null 2>&1

# Validation
if [ ! -f "dist/index.js" ]; then
  echo -e "${RED}✗ FAIL: dist/index.js not found${NC}"
  exit 1
fi

INDEX_SIZE=$(stat -c%s dist/index.js 2>/dev/null || stat -f%z dist/index.js)
if [ "$INDEX_SIZE" -lt 1000000 ]; then
  echo -e "${RED}✗ FAIL: index.js too small ($INDEX_SIZE bytes)${NC}"
  exit 1
fi

echo -e "${GREEN}✓ esbuild completed ($(numfmt --to=iec-i --suffix=B $INDEX_SIZE 2>/dev/null || echo "$INDEX_SIZE bytes"))${NC}"
echo ""

# =============================================================================
# Step 3: Deploy Directory Preparation
# =============================================================================

echo -e "${MAGENTA}[STEP 3/8]${NC} Deploy Directory Preparation"
echo ""

rm -rf deploy
mkdir -p deploy/node_modules
cp dist/index.js deploy/
cp dist/index.js.map deploy/ 2>/dev/null || true

# Validation
if [ ! -f "deploy/index.js" ]; then
  echo -e "${RED}✗ FAIL: deploy/index.js not found${NC}"
  exit 1
fi

if [ ! -d "deploy/node_modules" ]; then
  echo -e "${RED}✗ FAIL: deploy/node_modules not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Deploy directory prepared${NC}"
echo ""

# =============================================================================
# Step 4: Prisma Client Copy
# =============================================================================

echo -e "${MAGENTA}[STEP 4/8]${NC} Prisma Client Copy"
echo ""

# Step 4.1: .prisma/client
echo -e "  Copying .prisma/client..."
SOURCE_PRISMA="$PROJECT_ROOT/packages/database/node_modules/.prisma"

if [ ! -d "$SOURCE_PRISMA/client" ]; then
  echo -e "${RED}✗ FAIL: Source Prisma Client not found at $SOURCE_PRISMA/client${NC}"
  exit 1
fi

cp -r "$SOURCE_PRISMA" deploy/node_modules/

if [ ! -d "deploy/node_modules/.prisma/client" ]; then
  echo -e "${RED}✗ FAIL: Prisma Client copy failed${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓ .prisma/client copied${NC}"

# Step 4.2: @prisma module
echo -e "  Copying @prisma module..."
SOURCE_PRISMA_MODULE="$PROJECT_ROOT/node_modules/@prisma"

if [ ! -d "$SOURCE_PRISMA_MODULE" ]; then
  echo -e "${RED}✗ FAIL: Source @prisma module not found at $SOURCE_PRISMA_MODULE${NC}"
  exit 1
fi

cp -r "$SOURCE_PRISMA_MODULE" deploy/node_modules/

if [ ! -d "deploy/node_modules/@prisma/client" ]; then
  echo -e "${RED}✗ FAIL: @prisma module copy failed${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓ @prisma module copied${NC}"

# Step 4.3: schema.prisma
echo -e "  Copying schema.prisma..."
mkdir -p deploy/prisma
cp "$PROJECT_ROOT/packages/database/prisma/schema.prisma" deploy/prisma/

if [ ! -f "deploy/prisma/schema.prisma" ]; then
  echo -e "${RED}✗ FAIL: schema.prisma copy failed${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓ schema.prisma copied${NC}"

# Step 4.4: package.json
echo '{"dependencies":{"@prisma/client":"^5.22.0"}}' > deploy/package.json

echo -e "${GREEN}✓ All Prisma files copied${NC}"
echo ""

# =============================================================================
# Step 4.5: Native Dependencies (ffmpeg-static, Azure Speech SDK)
# =============================================================================

echo -e "  Copying native dependencies..."

# Copy ffmpeg-static
if [ -d "$LAMBDA_DIR/node_modules/ffmpeg-static" ]; then
  mkdir -p deploy/node_modules/ffmpeg-static
  cp -r "$LAMBDA_DIR/node_modules/ffmpeg-static/"* deploy/node_modules/ffmpeg-static/
  echo -e "${GREEN}  ✓ ffmpeg-static copied${NC}"
else
  echo -e "${YELLOW}  ⚠ ffmpeg-static not found (may cause audio processing errors)${NC}"
fi

# Copy Azure Speech SDK (if exists)
if [ -d "$LAMBDA_DIR/node_modules/microsoft-cognitiveservices-speech-sdk" ]; then
  mkdir -p deploy/node_modules/microsoft-cognitiveservices-speech-sdk
  cp -r "$LAMBDA_DIR/node_modules/microsoft-cognitiveservices-speech-sdk/"* deploy/node_modules/microsoft-cognitiveservices-speech-sdk/
  echo -e "${GREEN}  ✓ microsoft-cognitiveservices-speech-sdk copied${NC}"
else
  echo -e "${YELLOW}  ⚠ microsoft-cognitiveservices-speech-sdk not found${NC}"
fi

echo ""

# =============================================================================
# Step 5: Final Validation
# =============================================================================

echo -e "${MAGENTA}[STEP 5/8]${NC} Final Validation (6 checks)"
echo ""

cd deploy

VALIDATION_FAILED=0

# Check 1: index.js in root
if [ ! -f "index.js" ]; then
  echo -e "${RED}  ✗ FAIL: index.js not in root${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}  ✓ index.js in root${NC}"
fi

# Check 2: node_modules in root
if [ ! -d "node_modules" ]; then
  echo -e "${RED}  ✗ FAIL: node_modules not in root${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}  ✓ node_modules in root${NC}"
fi

# Check 3: Prisma Client
if [ ! -f "node_modules/.prisma/client/index.js" ]; then
  echo -e "${RED}  ✗ FAIL: Prisma Client not found${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}  ✓ Prisma Client found${NC}"
fi

# Check 4: @prisma module
if [ ! -d "node_modules/@prisma/client" ]; then
  echo -e "${RED}  ✗ FAIL: @prisma module not found${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}  ✓ @prisma module found${NC}"
fi

# Check 5: schema.prisma
if [ ! -f "prisma/schema.prisma" ]; then
  echo -e "${RED}  ✗ FAIL: schema.prisma not found${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}  ✓ schema.prisma found${NC}"
fi

# Check 6: File sizes
INDEX_SIZE=$(stat -c%s index.js 2>/dev/null || stat -f%z index.js)
if [ "$INDEX_SIZE" -lt 1000000 ]; then
  echo -e "${RED}  ✗ FAIL: index.js too small ($INDEX_SIZE bytes)${NC}"
  VALIDATION_FAILED=1
else
  echo -e "${GREEN}  ✓ index.js size OK ($INDEX_SIZE bytes)${NC}"
fi

if [ $VALIDATION_FAILED -eq 1 ]; then
  echo ""
  echo -e "${RED}✗ Validation failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ All validation checks passed${NC}"
echo ""

cd ..

# =============================================================================
# Step 6: ZIP Creation & Validation
# =============================================================================

echo -e "${MAGENTA}[STEP 6/8]${NC} ZIP Creation & Validation"
echo ""

# Remove old ZIP
rm -f lambda-deployment.zip

# Create ZIP from inside deploy directory
cd deploy
zip -r ../lambda-deployment.zip . > /dev/null 2>&1
cd ..

echo -e "${GREEN}✓ ZIP created${NC}"
echo ""

# Validate ZIP structure using dedicated script
if [ -f "$PROJECT_ROOT/scripts/validate-lambda-zip.sh" ]; then
  bash "$PROJECT_ROOT/scripts/validate-lambda-zip.sh" lambda-deployment.zip
else
  echo -e "${YELLOW}⚠ ZIP validation script not found, skipping detailed validation${NC}"

  # Basic validation
  if ! unzip -l lambda-deployment.zip | grep -q "^.*[[:space:]]index.js$"; then
    echo -e "${RED}✗ FAIL: index.js not in ZIP root${NC}"
    exit 1
  fi

  if unzip -l lambda-deployment.zip | grep -q "deploy/"; then
    echo -e "${RED}✗ FAIL: deploy/ directory found in ZIP${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ ZIP structure validated${NC}"
fi

echo ""

# =============================================================================
# Step 7: Lambda Deployment
# =============================================================================

echo -e "${MAGENTA}[STEP 7/8]${NC} Lambda Deployment"
echo ""

# Check ZIP size
ZIP_SIZE=$(stat -c%s lambda-deployment.zip 2>/dev/null || stat -f%z lambda-deployment.zip)
ZIP_SIZE_MB=$((ZIP_SIZE / 1024 / 1024))
echo -e "  ZIP size: ${BLUE}${ZIP_SIZE_MB} MB${NC}"

# If ZIP > 50MB, use S3
if [ "$ZIP_SIZE" -gt 52428800 ]; then
  echo -e "  ${YELLOW}ZIP size exceeds 50MB, using S3 upload${NC}"

  # Upload to S3
  S3_BUCKET="prance-deployments-${REGION}"
  S3_KEY="lambda/${FUNCTION_NAME}/$(date +%Y%m%d-%H%M%S)-lambda-deployment.zip"

  echo -e "  Uploading to S3: s3://${S3_BUCKET}/${S3_KEY}"
  aws s3 cp lambda-deployment.zip "s3://${S3_BUCKET}/${S3_KEY}" --region "$REGION" > /dev/null

  echo -e "  ${GREEN}✓ Uploaded to S3${NC}"
  echo ""

  # Deploy from S3
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --s3-bucket "$S3_BUCKET" \
    --s3-key "$S3_KEY" \
    --region "$REGION" \
    --query '[FunctionName,LastModified,CodeSize,State]' \
    --output table
else
  # Direct upload for small packages
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://lambda-deployment.zip \
    --region "$REGION" \
    --query '[FunctionName,LastModified,CodeSize,State]' \
    --output table
fi

echo ""
echo -e "${GREEN}✓ Deployment initiated${NC}"
echo ""

# Wait for deployment to complete
echo -e "Waiting 10 seconds for deployment to complete..."
sleep 10
echo ""

# Check deployment status
STATE=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Configuration.State' \
  --output text)

UPDATE_STATUS=$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'Configuration.LastUpdateStatus' \
  --output text)

if [ "$STATE" == "Active" ] && [ "$UPDATE_STATUS" == "Successful" ]; then
  echo -e "${GREEN}✓ Deployment successful${NC}"
  echo -e "  State: ${GREEN}$STATE${NC}"
  echo -e "  UpdateStatus: ${GREEN}$UPDATE_STATUS${NC}"
else
  echo -e "${YELLOW}⚠ Deployment status unclear${NC}"
  echo -e "  State: $STATE"
  echo -e "  UpdateStatus: $UPDATE_STATUS"
fi

echo ""

# =============================================================================
# Step 8: Post-Deployment Test
# =============================================================================

echo -e "${MAGENTA}[STEP 8/8]${NC} Post-Deployment Test"
echo ""

if [ -f "$PROJECT_ROOT/scripts/post-deploy-lambda-test.sh" ]; then
  bash "$PROJECT_ROOT/scripts/post-deploy-lambda-test.sh" "$FUNCTION_NAME" "$REGION"
else
  echo -e "${YELLOW}⚠ Post-deployment test script not found${NC}"

  # Basic test
  echo -e "Basic validation:"

  # Check CloudWatch Logs for Prisma Client errors
  LOG_GROUP="/aws/lambda/$FUNCTION_NAME"
  START_TIME=$(($(date +%s) - 60))000

  PRISMA_ERROR=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --filter-pattern "Cannot find module '@prisma/client'" \
    --max-items 1 \
    --query 'events[*].message' \
    --output text 2>/dev/null || echo "")

  if echo "$PRISMA_ERROR" | grep -q "Cannot find module"; then
    echo -e "${RED}✗ CRITICAL: Prisma Client not found in Lambda${NC}"
    exit 1
  else
    echo -e "${GREEN}✓ No Prisma Client errors detected${NC}"
  fi
fi

echo ""

# =============================================================================
# Summary
# =============================================================================

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Deployment Summary${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "${GREEN}✅ Manual deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Test in browser: http://localhost:3000"
echo -e "2. Login and start a session"
echo -e "3. Check Console for Phase 1.6 features"
echo ""
echo -e "${YELLOW}Note: Consider fixing the root cause of CDK bundling issue${NC}"
echo -e "      to avoid manual deployment in the future"
echo ""
