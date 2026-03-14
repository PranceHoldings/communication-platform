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
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Step 1: ビルド準備（スキップ可能）
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}📦 Step 1: ビルド準備実行中...${NC}"

  # 環境変数同期
  echo -e "${BLUE}   環境変数ファイルを同期中...${NC}"
  ENV_LOCAL="${PROJECT_ROOT}/.env.local"
  ENV_INFRA="${SCRIPT_DIR}/.env"

  if [ ! -f "$ENV_LOCAL" ]; then
    echo -e "${RED}❌ エラー: .env.local が見つかりません${NC}"
    exit 1
  fi

  cp "$ENV_LOCAL" "$ENV_INFRA"
  echo -e "${GREEN}   ✅ 環境変数同期完了${NC}"

  # Lambda auto-generated files cleanup (CRITICAL - prevents stale code deployment)
  echo -e "${BLUE}   Lambda自動生成ファイルをクリーンアップ中...${NC}"
  if [ -f "$SCRIPT_DIR/scripts/pre-deploy-clean.sh" ]; then
    bash "$SCRIPT_DIR/scripts/pre-deploy-clean.sh"
    echo -e "${GREEN}   ✅ Lambda自動生成ファイルクリーンアップ完了${NC}"
  else
    echo -e "${RED}   ⚠️  警告: scripts/pre-deploy-clean.sh が見つかりません${NC}"
  fi

  # 依存関係インストール
  echo -e "${BLUE}   依存関係をインストール中...${NC}"
  cd "$PROJECT_ROOT"
  npm install --ignore-scripts
  echo -e "${GREEN}   ✅ 依存関係インストール完了${NC}"

  # Prisma Client生成
  echo -e "${BLUE}   Prisma Client生成中...${NC}"
  cd "$PROJECT_ROOT/packages/database"

  if [ ! -d "node_modules" ]; then
    mkdir -p node_modules
  fi

  if [ -d "$PROJECT_ROOT/node_modules/@prisma" ]; then
    cp -r "$PROJECT_ROOT/node_modules/@prisma" node_modules/
  fi

  npx prisma generate
  echo -e "${GREEN}   ✅ Prisma Client生成完了${NC}"

  # TypeScriptビルド
  echo -e "${BLUE}   TypeScriptをビルド中...${NC}"
  cd "$PROJECT_ROOT"
  npm run build
  echo -e "${GREEN}   ✅ ビルド完了${NC}"
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
