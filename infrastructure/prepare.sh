#!/bin/bash
# prepare.sh - ビルド準備（依存関係インストール + ビルド）
# 使用方法: ./prepare.sh
# 実行タイミング: 初回セットアップ、クリーンビルド時

set -e

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Prance Platform - ビルド準備${NC}"
echo "=============================================="

# プロジェクトルートを取得
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. 環境変数同期
echo -e "\n${YELLOW}🔐 環境変数ファイルを同期中...${NC}"
ENV_LOCAL="${PROJECT_ROOT}/.env.local"
ENV_INFRA="$(dirname "$0")/.env"

if [ ! -f "$ENV_LOCAL" ]; then
    echo -e "${RED}❌ エラー: .env.local が見つかりません${NC}"
    exit 1
fi

cp "$ENV_LOCAL" "$ENV_INFRA"
echo -e "${GREEN}✅ 環境変数ファイル同期完了${NC}"

# 2. 依存関係インストール
echo -e "\n${YELLOW}📦 依存関係をインストール中...${NC}"
cd "$PROJECT_ROOT"
npm ci
echo -e "${GREEN}✅ 依存関係インストール完了${NC}"

# 3. Prisma Client生成
echo -e "\n${YELLOW}🔧 Prisma Client生成中...${NC}"
cd "$PROJECT_ROOT/packages/database"

# Workaround for npm workspaces hoisting
if [ ! -d "node_modules" ]; then
  mkdir -p node_modules
fi

if [ -d "$PROJECT_ROOT/node_modules/@prisma" ]; then
  cp -r "$PROJECT_ROOT/node_modules/@prisma" node_modules/
fi

npx prisma generate
echo -e "${GREEN}✅ Prisma Client生成完了${NC}"

# 4. TypeScriptビルド
echo -e "\n${YELLOW}🔨 TypeScriptをビルド中...${NC}"
cd "$PROJECT_ROOT"
npm run build
echo -e "${GREEN}✅ ビルド完了${NC}"

echo -e "\n${GREEN}✅ ビルド準備完了！${NC}"
echo -e "${BLUE}次のコマンドでデプロイできます: ./deploy.sh [環境名]${NC}"
