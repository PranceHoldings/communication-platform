#!/bin/bash
# deploy.sh - フルデプロイ（Lambda + Next.js フロントエンド）
# 使用方法: ./deploy.sh [環境名] [オプション]
# 例: ./deploy.sh dev
#     ./deploy.sh production
#     ./deploy.sh dev --skip-build
#     ./deploy.sh production --skip-nextjs   # Next.js のみスキップ（Lambda だけ更新）

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Prance Platform - フルデプロイ${NC}"
echo "=============================================="

ENVIRONMENT="${1:-dev}"
SKIP_BUILD=false
SKIP_NEXTJS=false

for arg in "$@"; do
  case $arg in
    --skip-build)  SKIP_BUILD=true ;;
    --skip-nextjs) SKIP_NEXTJS=true ;;
  esac
done

echo -e "${BLUE}📍 環境: ${ENVIRONMENT}${NC}"
[ "$SKIP_BUILD"  = true ] && echo -e "${YELLOW}⚠️  ビルドスキップモード${NC}"
[ "$SKIP_NEXTJS" = true ] && echo -e "${YELLOW}⚠️  Next.js スキップモード${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Step 1: ビルド準備 ───────────────────────────────────────────────────────

if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}📦 Step 1: ビルド準備実行中...${NC}"

  ENV_LOCAL="${PROJECT_ROOT}/.env.local"
  ENV_INFRA="${SCRIPT_DIR}/.env"
  if [ ! -f "$ENV_LOCAL" ]; then
    echo -e "${RED}❌ エラー: .env.local が見つかりません${NC}"
    exit 1
  fi
  cp "$ENV_LOCAL" "$ENV_INFRA"
  echo -e "${GREEN}   ✅ 環境変数同期完了${NC}"

  if [ -f "$SCRIPT_DIR/scripts/pre-deploy-clean.sh" ]; then
    bash "$SCRIPT_DIR/scripts/pre-deploy-clean.sh"
    echo -e "${GREEN}   ✅ Lambda 自動生成ファイルクリーンアップ完了${NC}"
  fi

  cd "$PROJECT_ROOT"
  pnpm install --ignore-scripts
  echo -e "${GREEN}   ✅ 依存関係インストール完了${NC}"

  npx prisma generate --schema=packages/database/prisma/schema.prisma
  echo -e "${GREEN}   ✅ Prisma Client 生成完了${NC}"

  # infrastructure TypeScript のみビルド（Next.js は別ステップ）
  cd "$SCRIPT_DIR"
  pnpm run build
  echo -e "${GREEN}   ✅ Infrastructure ビルド完了${NC}"
else
  echo -e "${YELLOW}📦 Step 1: ビルドスキップ${NC}"
fi

# ─── Step 2: Next.js フロントエンドビルド ──────────────────────────────────

if [ "$SKIP_NEXTJS" = false ]; then
  echo -e "\n${YELLOW}🖥️  Step 2: Next.js フロントエンドビルド中...${NC}"
  echo -e "${BLUE}   (変更がない場合でも再ビルドすることで BUILD_ID を最新化します)${NC}"

  # NEXT_PUBLIC_* はビルド時に静的に焼き込まれるため、環境ごとに上書きが必須
  if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${BLUE}   本番用 NEXT_PUBLIC_* を設定中...${NC}"
    export NEXT_PUBLIC_API_URL="https://api.app.prance.jp/api/v1"
    export NEXT_PUBLIC_WS_ENDPOINT="wss://ws.app.prance.jp"
  elif [ "$ENVIRONMENT" = "dev" ]; then
    echo -e "${BLUE}   Dev用 NEXT_PUBLIC_* を設定中...${NC}"
    export NEXT_PUBLIC_API_URL="https://api.dev.app.prance.jp/api/v1"
    export NEXT_PUBLIC_WS_ENDPOINT="wss://ws.dev.app.prance.jp"
  fi
  # Always disable speech bypass in deployed bundles (.env.local has =true for Playwright)
  export NEXT_PUBLIC_BYPASS_SPEECH_DETECTION=false
  echo -e "${GREEN}   ✅ NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL${NC}"
  echo -e "${GREEN}   ✅ NEXT_PUBLIC_WS_ENDPOINT=$NEXT_PUBLIC_WS_ENDPOINT${NC}"
  echo -e "${GREEN}   ✅ NEXT_PUBLIC_BYPASS_SPEECH_DETECTION=$NEXT_PUBLIC_BYPASS_SPEECH_DETECTION${NC}"

  cd "$PROJECT_ROOT"
  bash scripts/build-nextjs-standalone.sh
  echo -e "${GREEN}   ✅ Next.js ビルド完了${NC}"

  bash scripts/package-nextjs-lambda.sh
  echo -e "${GREEN}   ✅ Next.js Lambda パッケージ作成完了${NC}"
else
  echo -e "\n${YELLOW}🖥️  Step 2: Next.js スキップ${NC}"
  # スキップ時は既存パッケージが必要
  if [ ! -d "/tmp/nextjs-lambda-package" ]; then
    echo -e "${RED}❌ /tmp/nextjs-lambda-package が存在しません${NC}"
    echo -e "${YELLOW}   --skip-nextjs を外して再実行してください${NC}"
    exit 1
  fi
fi

# ─── Step 3: CDK デプロイ ────────────────────────────────────────────────────

echo -e "\n${YELLOW}🚢 Step 3: CDK デプロイ実行中...${NC}"
"$SCRIPT_DIR/deploy-simple.sh" "$ENVIRONMENT"

# ─── Step 4: デプロイ後検証 ─────────────────────────────────────────────────

echo -e "\n${YELLOW}🔍 Step 4: デプロイ後検証...${NC}"
if [ -f "$PROJECT_ROOT/scripts/validate-nextjs-deployment.sh" ]; then
  bash "$PROJECT_ROOT/scripts/validate-nextjs-deployment.sh" "$ENVIRONMENT" || {
    echo -e "${RED}⚠️  検証で問題が検出されました。上記のエラーを確認してください。${NC}"
    # 検証失敗でもデプロイ自体は完了しているため exit 1 しない
  }
fi

echo -e "\n${GREEN}✅ フルデプロイ完了！${NC}"
echo -e "${BLUE}=============================================="
echo -e "🎉 Prance Platform が正常にデプロイされました"
echo -e "   環境: ${ENVIRONMENT}"
if [ "$ENVIRONMENT" = "production" ]; then
  echo -e "   URL: https://app.prance.jp"
fi
echo -e "=============================================="
echo -e "${NC}"
