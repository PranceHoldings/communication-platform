#!/bin/bash
# clean-deploy.sh - クリーンビルド + デプロイ
# 使用方法: ./clean-deploy.sh [環境名]
# 例: ./clean-deploy.sh dev

set -e

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Prance Platform - クリーンビルド + デプロイ${NC}"
echo "=============================================="

# 環境名の取得（デフォルト: dev）
ENVIRONMENT="${1:-dev}"
echo -e "${BLUE}📍 環境: ${ENVIRONMENT}${NC}\n"

# プロジェクトルートを取得
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. node_modulesクリーンアップ
echo -e "${YELLOW}🧹 node_modulesをクリーンアップ中...${NC}"
cd "$PROJECT_ROOT"

# Robust delete function with 4-stage retry
remove_directory_robust() {
  local target="$1"
  local label="${2:-directory}"
  local timestamp=$(date +%s)

  if [ ! -d "$target" ]; then
    return 0
  fi

  echo -e "${BLUE}   削除中: $label ($target)${NC}"

  # Strategy 1: Normal deletion
  if rm -rf "$target" 2>/dev/null; then
    echo -e "${GREEN}   ✓ 通常削除成功${NC}"
    return 0
  fi

  # Strategy 2: sudo deletion
  echo -e "${YELLOW}   再試行1: sudo削除${NC}"
  if sudo rm -rf "$target" 2>/dev/null; then
    echo -e "${GREEN}   ✓ sudo削除成功${NC}"
    return 0
  fi

  # Strategy 3: Rename to backup
  echo -e "${YELLOW}   再試行2: リネーム退避${NC}"
  local backup_name="${target}.broken-${timestamp}"
  if sudo mv "$target" "$backup_name" 2>/dev/null; then
    echo -e "${GREEN}   ✓ リネーム成功: $backup_name${NC}"
    return 0
  fi

  # Strategy 4: Individual file deletion
  echo -e "${YELLOW}   再試行3: ファイル個別削除${NC}"
  if find "$target" -type f -exec sudo rm -f {} \; 2>/dev/null; then
    sudo rm -rf "$target" 2>/dev/null
    echo -e "${GREEN}   ✓ 個別削除成功${NC}"
    return 0
  fi

  echo -e "${RED}   ✗ 削除失敗（手動確認が必要）${NC}"
  return 1
}

# Delete node_modules directories
remove_directory_robust "node_modules" "トップレベルnode_modules"
remove_directory_robust "infrastructure/node_modules" "infrastructureのnode_modules"
remove_directory_robust "packages/shared/node_modules" "packages/sharedのnode_modules"
remove_directory_robust "packages/database/node_modules" "packages/databaseのnode_modules"
remove_directory_robust "apps/web/node_modules" "apps/webのnode_modules"

# Delete Lambda function node_modules (CRITICAL - prevents stale SDK issues)
echo -e "${BLUE}   Lambda関数のnode_modulesを削除中...${NC}"
remove_directory_robust "infrastructure/lambda/websocket/default/node_modules" "WebSocket default handler"
remove_directory_robust "infrastructure/lambda/websocket/connect/node_modules" "WebSocket connect handler"
remove_directory_robust "infrastructure/lambda/websocket/disconnect/node_modules" "WebSocket disconnect handler"
if [ -d "infrastructure/lambda/sessions/analysis/node_modules" ]; then
  remove_directory_robust "infrastructure/lambda/sessions/analysis/node_modules" "Sessions analysis handler"
fi

echo -e "${GREEN}✅ node_modulesクリーンアップ完了${NC}"

# 2. ビルドキャッシュクリーンアップ
echo -e "\n${YELLOW}🧹 ビルドキャッシュをクリーンアップ中...${NC}"

# Turboキャッシュ
if [ -d ".turbo" ]; then
  echo -e "${BLUE}   削除: .turbo${NC}"
  rm -rf .turbo
fi

# Next.jsキャッシュ
if [ -d "apps/web/.next" ]; then
  echo -e "${BLUE}   削除: apps/web/.next${NC}"
  rm -rf apps/web/.next
fi

# TypeScriptビルド出力
if [ -d "packages/shared/dist" ]; then
  echo -e "${BLUE}   削除: packages/shared/dist${NC}"
  rm -rf packages/shared/dist
fi

if [ -d "infrastructure/dist" ]; then
  echo -e "${BLUE}   削除: infrastructure/dist${NC}"
  rm -rf infrastructure/dist
fi

# CDK出力
if [ -d "infrastructure/cdk.out" ]; then
  echo -e "${BLUE}   削除: infrastructure/cdk.out${NC}"
  rm -rf infrastructure/cdk.out
fi

echo -e "${GREEN}✅ ビルドキャッシュクリーンアップ完了${NC}"

# 3. 環境変数ファイル同期
echo -e "\n${YELLOW}🔐 環境変数ファイルを同期中...${NC}"
ENV_LOCAL="${PROJECT_ROOT}/.env.local"
ENV_INFRA="${PROJECT_ROOT}/infrastructure/.env"

if [ ! -f "$ENV_LOCAL" ]; then
    echo -e "${RED}❌ エラー: .env.local が見つかりません${NC}"
    exit 1
fi

cp "$ENV_LOCAL" "$ENV_INFRA"
echo -e "${GREEN}✅ 環境変数ファイル同期完了${NC}"

# 4. 依存関係の再インストール（prepare hookなし）
echo -e "\n${YELLOW}📦 依存関係を再インストール中...${NC}"
cd "$PROJECT_ROOT"
npm install --ignore-scripts  # prepare hookをスキップ
echo -e "${GREEN}✅ 依存関係インストール完了${NC}"

# 5. Prisma Client生成
echo -e "\n${YELLOW}🔧 Prisma Client生成中...${NC}"
cd "$PROJECT_ROOT/packages/database"

# Workaround for npm workspaces hoisting
# Copy @prisma from root node_modules to local node_modules
if [ ! -d "node_modules" ]; then
  mkdir -p node_modules
fi

if [ -d "$PROJECT_ROOT/node_modules/@prisma" ]; then
  echo -e "${BLUE}   @prismaをコピー中...${NC}"
  cp -r "$PROJECT_ROOT/node_modules/@prisma" node_modules/
fi

npx prisma generate
echo -e "${GREEN}✅ Prisma Client生成完了${NC}"

# 6. Lambda Dependencies Installation (CRITICAL)
echo -e "\n${YELLOW}📦 Lambda依存関係を再インストール中...${NC}"
if [ -f "$PROJECT_ROOT/scripts/fix-lambda-node-modules.sh" ]; then
    "$PROJECT_ROOT/scripts/fix-lambda-node-modules.sh"
    echo -e "${GREEN}✅ Lambda依存関係インストール完了${NC}"
else
    echo -e "${YELLOW}⚠️  修復スクリプトが見つかりません${NC}"
    echo -e "${YELLOW}   手動でLambda依存関係をインストールしてください${NC}"
fi

# 7. TypeScriptビルド
echo -e "\n${YELLOW}🔨 TypeScriptをビルド中...${NC}"
cd "$PROJECT_ROOT"
npm run build
echo -e "${GREEN}✅ ビルド完了${NC}"

# 8. デプロイ
echo -e "\n${YELLOW}🚢 デプロイ実行中...${NC}"
cd "$PROJECT_ROOT/infrastructure"
./deploy-simple.sh "$ENVIRONMENT"

echo -e "\n${GREEN}✅ クリーンビルド + デプロイ完了！${NC}"
