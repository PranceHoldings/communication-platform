#!/bin/bash

##############################################################################
# Prisma Schema Change Guard
#
# このスクリプトはPrismaスキーマ変更時に必須手順を強制実行します。
# Git pre-commit hookとして自動実行されます。
#
# 必須手順:
#   1. マイグレーションファイル生成 (prisma migrate dev)
#   2. Prisma Client再生成 (prisma generate)
#   3. Lambda関数デプロイ (infrastructure deploy)
#   4. データベースマイグレーション実行 (Lambda invoke)
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_DIR="${PROJECT_ROOT}/packages/database"
INFRASTRUCTURE_DIR="${PROJECT_ROOT}/infrastructure"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Prisma Schema Change Guard${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if schema.prisma has changed
SCHEMA_CHANGED=false
if git diff --cached --name-only | grep -q "packages/database/prisma/schema.prisma"; then
    SCHEMA_CHANGED=true
    echo -e "${YELLOW}⚠️  Prismaスキーマファイルが変更されています${NC}"
fi

if [ "$SCHEMA_CHANGED" = false ]; then
    echo -e "${GREEN}✓ Prismaスキーマに変更はありません${NC}"
    exit 0
fi

echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}  🔴 CRITICAL: Prismaスキーマ変更検出${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Prismaスキーマを変更した場合、以下の手順を必ず実行してください:${NC}"
echo ""
echo -e "  ${BLUE}Step 1:${NC} マイグレーションファイル生成"
echo -e "    ${GREEN}cd packages/database && npx prisma migrate dev --name <変更内容>${NC}"
echo ""
echo -e "  ${BLUE}Step 2:${NC} Prisma Client再生成"
echo -e "    ${GREEN}npx prisma generate${NC}"
echo ""
echo -e "  ${BLUE}Step 3:${NC} Lambda関数デプロイ"
echo -e "    ${GREEN}cd infrastructure && npm run cdk -- deploy Prance-dev-ApiLambda${NC}"
echo ""
echo -e "  ${BLUE}Step 4:${NC} データベースマイグレーション実行"
echo -e "    ${GREEN}aws lambda invoke --function-name prance-db-migration-dev --payload '{}' /tmp/result.json${NC}"
echo ""

# Auto-execution mode (if --auto flag is provided)
if [ "$1" = "--auto" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  自動実行モード${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    read -p "マイグレーション名を入力してください: " MIGRATION_NAME

    if [ -z "$MIGRATION_NAME" ]; then
        echo -e "${RED}✗ マイグレーション名が必要です${NC}"
        exit 1
    fi

    echo ""
    echo -e "${BLUE}Step 1:${NC} マイグレーションファイル生成中..."
    cd "${DATABASE_DIR}"
    npx prisma migrate dev --name "${MIGRATION_NAME}"

    echo ""
    echo -e "${BLUE}Step 2:${NC} Prisma Client再生成中..."
    npx prisma generate

    echo ""
    echo -e "${GREEN}✓ マイグレーション処理完了${NC}"
    echo ""
    echo -e "${YELLOW}次のステップ:${NC}"
    echo -e "  1. ${GREEN}git add .${NC} - 生成されたマイグレーションファイルをステージング"
    echo -e "  2. ${GREEN}git commit${NC} - コミット"
    echo -e "  3. ${GREEN}cd infrastructure && npm run deploy:dev${NC} - Lambda関数デプロイ"
    echo -e "  4. ${GREEN}aws lambda invoke --function-name prance-db-migration-dev --payload '{}' /tmp/result.json${NC}"
    echo ""

    read -p "変更をステージングに追加しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add packages/database/prisma/migrations/
        git add packages/database/node_modules/.prisma/
        echo -e "${GREEN}✓ マイグレーションファイルをステージングに追加しました${NC}"
    fi

    exit 0
fi

# Interactive mode
echo -e "${YELLOW}以下のオプションを選択してください:${NC}"
echo ""
echo -e "  ${GREEN}1)${NC} 自動実行 (マイグレーション生成 + Prisma Client再生成)"
echo -e "  ${GREEN}2)${NC} 手動で実行する (このコミットをブロック)"
echo -e "  ${GREEN}3)${NC} スキップ (非推奨: 本番環境で500エラーが発生します)"
echo ""

read -p "選択 (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        exec "$0" --auto
        ;;
    2)
        echo ""
        echo -e "${RED}✗ コミットをブロックしました${NC}"
        echo -e "${YELLOW}上記の手順を手動で実行してから、再度コミットしてください${NC}"
        exit 1
        ;;
    3)
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  ⚠️  警告: マイグレーション手順をスキップしました${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${YELLOW}スキップした場合の影響:${NC}"
        echo -e "  - デプロイ後に500エラーが発生します"
        echo -e "  - データベースとコードの不整合が発生します"
        echo -e "  - 本番環境でサービス停止につながります"
        echo ""
        echo -e "${YELLOW}必ず以下の手順を後で実行してください:${NC}"
        echo -e "  1. マイグレーション生成"
        echo -e "  2. Prisma Client再生成"
        echo -e "  3. Lambda関数デプロイ"
        echo -e "  4. データベースマイグレーション実行"
        echo ""

        read -p "本当にスキップしますか? (yes/NO): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            echo -e "${RED}✗ コミットをブロックしました${NC}"
            exit 1
        fi

        echo -e "${RED}⚠️  スキップが確認されました${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}✗ 無効な選択です。コミットをブロックしました${NC}"
        exit 1
        ;;
esac
