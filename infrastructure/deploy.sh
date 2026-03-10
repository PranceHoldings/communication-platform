#!/bin/bash
# deploy.sh - フルデプロイ（ビルド + デプロイ）
# 使用方法: ./deploy.sh [環境名] [--skip-build]
# 例: ./deploy.sh dev
#     ./deploy.sh dev --skip-build

set -e

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Prance Platform - フルデプロイ${NC}"
echo "=============================================="

# 環境名とオプションの解析
ENVIRONMENT="${1:-dev}"
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
  esac
done

echo -e "${BLUE}📍 環境: ${ENVIRONMENT}${NC}"
if [ "$SKIP_BUILD" = true ]; then
  echo -e "${YELLOW}⚠️  ビルドスキップモード${NC}"
fi
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Step 1: ビルド準備（スキップ可能）
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}📦 Step 1: ビルド準備実行中...${NC}"
  "$SCRIPT_DIR/prepare.sh"
else
  echo -e "${YELLOW}📦 Step 1: ビルドスキップ${NC}"
  echo -e "${BLUE}   既存のビルド成果物を使用します${NC}"
fi

# Step 2: デプロイ
echo -e "\n${YELLOW}🚢 Step 2: デプロイ実行中...${NC}"
"$SCRIPT_DIR/deploy-simple.sh" "$ENVIRONMENT"

echo -e "\n${GREEN}✅ フルデプロイ完了！${NC}"
echo -e "${BLUE}=============================================="
echo -e "🎉 Prance Platform が正常にデプロイされました"
echo -e "=============================================="
echo -e "${NC}"
