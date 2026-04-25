#!/bin/bash
# package-nextjs-lambda.sh
# Next.js standalone ビルドを Lambda デプロイ用パッケージに組み立てる
# 前提: build-nextjs-standalone.sh 実行済み

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="/tmp/nextjs-lambda-package"
STANDALONE_DIR="$PROJECT_ROOT/apps/web/.next/standalone"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📦 Next.js Lambda パッケージを組み立て中...${NC}"

# ─── 前提チェック ───────────────────────────────────────────────────────────

if [ ! -d "$STANDALONE_DIR" ]; then
  echo -e "${RED}❌ standalone ビルドが見つかりません: $STANDALONE_DIR${NC}"
  echo -e "${YELLOW}   先に実行してください: bash scripts/build-nextjs-standalone.sh${NC}"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/apps/web/lambda.js" ]; then
  echo -e "${RED}❌ Lambda ハンドラーが見つかりません: apps/web/lambda.js${NC}"
  exit 1
fi

# ─── パッケージディレクトリを初期化 ─────────────────────────────────────────

echo -e "${BLUE}   既存パッケージを削除中...${NC}"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# ─── standalone ビルドをコピー ───────────────────────────────────────────────
# standalone output の構造:
#   apps/web/.next/standalone/          ← サーバーコード (node_modules含む)
#   apps/web/.next/static/              ← 静的アセット
#   apps/web/public/                    ← public ディレクトリ

echo -e "${BLUE}   standalone サーバーをコピー中...${NC}"
cp -r "$STANDALONE_DIR/." "$PACKAGE_DIR/"

# standalone には static が含まれないので別途コピー
echo -e "${BLUE}   静的アセットをコピー中...${NC}"
mkdir -p "$PACKAGE_DIR/apps/web/.next/static"
cp -r "$PROJECT_ROOT/apps/web/.next/static/." "$PACKAGE_DIR/apps/web/.next/static/"

# public ディレクトリをコピー
if [ -d "$PROJECT_ROOT/apps/web/public" ]; then
  echo -e "${BLUE}   public ディレクトリをコピー中...${NC}"
  mkdir -p "$PACKAGE_DIR/apps/web/public"
  cp -r "$PROJECT_ROOT/apps/web/public/." "$PACKAGE_DIR/apps/web/public/"
fi

# ─── Lambda ハンドラーをコピー（最新版で上書き）────────────────────────────
# standalone が生成した server.js ではなく、カスタム lambda.js を使用
echo -e "${BLUE}   Lambda ハンドラーをコピー中...${NC}"
cp "$PROJECT_ROOT/apps/web/lambda.js" "$PACKAGE_DIR/apps/web/lambda.js"

# ─── 検証 ───────────────────────────────────────────────────────────────────

echo -e "${BLUE}   パッケージ内容を検証中...${NC}"

ERRORS=0

check_exists() {
  if [ ! -e "$PACKAGE_DIR/$1" ]; then
    echo -e "${RED}   ❌ 必須ファイルが不足: $1${NC}"
    ERRORS=$((ERRORS + 1))
  fi
}

check_exists "apps/web/lambda.js"
check_exists "apps/web/.next/static"
check_exists "apps/web/.next/required-server-files.json"
# standalone の server.js は standalone/ のルートに展開される
check_exists "apps/web/server.js"

# 静的チャンクの存在確認
CHUNK_COUNT=$(find "$PACKAGE_DIR/apps/web/.next/static/chunks" -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHUNK_COUNT" -eq 0 ]; then
  echo -e "${RED}   ❌ 静的チャンクが存在しません${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}   ✅ 静的チャンク: ${CHUNK_COUNT} ファイル${NC}"
fi

# BUILD_ID を記録（デプロイ検証に使用）
BUILD_ID=$(cat "$PROJECT_ROOT/apps/web/.next/BUILD_ID" 2>/dev/null || echo "unknown")
echo "$BUILD_ID" > "$PACKAGE_DIR/.build-id"
echo -e "${GREEN}   ✅ BUILD_ID: $BUILD_ID${NC}"

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}❌ パッケージ検証失敗 (${ERRORS} エラー)${NC}"
  exit 1
fi

# ─── サイズ確認 ─────────────────────────────────────────────────────────────

PACKAGE_SIZE=$(du -sh "$PACKAGE_DIR" | cut -f1)
echo -e "${GREEN}✅ パッケージ作成完了: $PACKAGE_DIR (${PACKAGE_SIZE})${NC}"
echo ""
echo "  BUILD_ID:  $BUILD_ID"
echo "  パス:      $PACKAGE_DIR"
echo "  サイズ:    $PACKAGE_SIZE"
