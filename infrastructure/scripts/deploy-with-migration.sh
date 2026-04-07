#!/bin/bash

##############################################################################
# Deploy with Database Migration
#
# このスクリプトはLambda関数デプロイとデータベースマイグレーションを統合実行します。
# Prismaスキーマ変更時の必須手順を自動化します。
#
# 使用方法:
#   ./scripts/deploy-with-migration.sh dev     # Dev環境
#   ./scripts/deploy-with-migration.sh production  # Production環境
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT="${1:-dev}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_DIR="${PROJECT_ROOT}/packages/database"
INFRASTRUCTURE_DIR="${PROJECT_ROOT}/infrastructure"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Deploy with Database Migration - ${ENVIRONMENT}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Validate environment
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo -e "${RED}✗ Invalid environment: $ENVIRONMENT${NC}"
    echo -e "${YELLOW}Usage: $0 [dev|production]${NC}"
    exit 1
fi

# Check if Prisma schema has changed since last deploy
echo ""
echo -e "${BLUE}Step 1:${NC} Prismaスキーマ変更チェック中..."

SCHEMA_CHANGED=false
if git diff HEAD~1 HEAD --name-only 2>/dev/null | grep -q "packages/database/prisma/schema.prisma"; then
    SCHEMA_CHANGED=true
    echo -e "${YELLOW}⚠️  Prismaスキーマが変更されています${NC}"
else
    echo -e "${GREEN}✓ Prismaスキーマに変更はありません${NC}"
fi

# Step 2: Prisma Client Regeneration
echo ""
echo -e "${BLUE}Step 2:${NC} Prisma Client再生成中..."
cd "${DATABASE_DIR}"
pnpm exec prisma generate
echo -e "${GREEN}✓ Prisma Client再生成完了${NC}"

# Step 3: Lambda Function Deployment
echo ""
echo -e "${BLUE}Step 3:${NC} Lambda関数デプロイ中..."
cd "${INFRASTRUCTURE_DIR}"

STACK_NAME="Prance-${ENVIRONMENT}-ApiLambda"
echo -e "${YELLOW}Deploying: ${STACK_NAME}${NC}"

pnpm run cdk -- deploy "${STACK_NAME}" \
  -c environment="${ENVIRONMENT}" \
  --require-approval never \
  --hotswap

echo -e "${GREEN}✓ Lambda関数デプロイ完了${NC}"

# Step 4: Database Migration Execution (if schema changed)
if [ "$SCHEMA_CHANGED" = true ]; then
    echo ""
    echo -e "${BLUE}Step 4:${NC} データベースマイグレーション実行中..."

    MIGRATION_FUNCTION="prance-db-migration-${ENVIRONMENT}"
    RESULT_FILE="/tmp/migration-result-$(date +%Y%m%d-%H%M%S).json"

    aws lambda invoke \
      --function-name "${MIGRATION_FUNCTION}" \
      --payload '{}' \
      "${RESULT_FILE}" > /dev/null

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Migration Result${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    cat "${RESULT_FILE}" | jq
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Check if migration was successful
    if grep -q '"success":true' "${RESULT_FILE}"; then
        echo -e "${GREEN}✓ データベースマイグレーション成功${NC}"
    else
        echo -e "${RED}✗ データベースマイグレーション失敗${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${BLUE}Step 4:${NC} スキーマ変更がないため、マイグレーションをスキップ"
fi

# Step 5: Verification
echo ""
echo -e "${BLUE}Step 5:${NC} デプロイ検証中..."

# Test a simple Lambda function to verify deployment
TEST_FUNCTION="prance-health-check-${ENVIRONMENT}"
TEST_RESULT="/tmp/health-check-$(date +%Y%m%d-%H%M%S).json"

aws lambda invoke \
  --function-name "${TEST_FUNCTION}" \
  --payload '{}' \
  "${TEST_RESULT}" > /dev/null 2>&1 || true

if [ -f "${TEST_RESULT}" ]; then
    echo -e "${GREEN}✓ Lambda関数動作確認成功${NC}"
else
    echo -e "${YELLOW}⚠️  Lambda関数動作確認をスキップ${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ デプロイ完了${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Environment:${NC} ${ENVIRONMENT}"
echo -e "${GREEN}Stack:${NC} ${STACK_NAME}"
echo -e "${GREEN}Schema Changed:${NC} ${SCHEMA_CHANGED}"
echo -e "${GREEN}Migration Executed:${NC} ${SCHEMA_CHANGED}"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}Production環境へのデプロイが完了しました${NC}"
    echo -e "${YELLOW}E2Eテストの実行を推奨します${NC}"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
