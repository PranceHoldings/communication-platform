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

# 3. 依存関係の再インストール
echo -e "\n${YELLOW}📦 依存関係を再インストール中...${NC}"
cd "$PROJECT_ROOT"
npm install
echo -e "${GREEN}✅ 依存関係インストール完了${NC}"

# 4. Prisma Client生成
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

# 5. ビルド準備
echo -e "\n${YELLOW}📦 Step 1: ビルド準備実行中...${NC}"
cd "$PROJECT_ROOT/infrastructure"
./prepare.sh

# 6. デプロイ
echo -e "\n${YELLOW}🚢 Step 2: デプロイ実行中...${NC}"
./deploy-simple.sh "$ENVIRONMENT"

echo -e "\n${GREEN}✅ クリーンビルド + デプロイ完了！${NC}"
