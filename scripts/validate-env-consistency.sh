#!/bin/bash

#######################################################
# 環境変数整合性検証スクリプト
#
# 目的: コードで使用されている環境変数が.env.exampleに
#       定義されているかを検証する
#
# 使用方法:
#   bash scripts/validate-env-consistency.sh
#
# 終了コード:
#   0 - 全チェック成功
#   1 - 不整合検出（コミット拒否）
#######################################################

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 環境変数整合性チェック開始..."
echo ""

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERROR_COUNT=0
WARNING_COUNT=0

#######################################################
# Step 1: .env.exampleから定義されている変数を抽出
#######################################################
echo "📋 Step 1: .env.exampleから変数を抽出..."

if [ ! -f ".env.example" ]; then
  echo -e "${RED}❌ .env.example が見つかりません${NC}"
  exit 1
fi

# コメント行と空行を除外し、変数名のみ抽出
DEFINED_VARS=$(grep -E "^[A-Z_][A-Z0-9_]*=" .env.example | cut -d'=' -f1 | sort)
DEFINED_COUNT=$(echo "$DEFINED_VARS" | wc -l)

echo -e "${GREEN}✅ .env.exampleに定義されている変数: ${DEFINED_COUNT}個${NC}"
echo ""

#######################################################
# Step 2: コードベースで使用されている環境変数を抽出
#######################################################
echo "📋 Step 2: コードベースから使用されている変数を抽出..."

# process.env.VARIABLE_NAME のパターンを検索
# 除外: node_modules, .next, .next-archive, build, dist
USED_VARS=$(grep -rh "process\.env\." \
  apps/web \
  infrastructure/lambda \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.next-archive \
  --exclude-dir=build \
  --exclude-dir=dist \
  2>/dev/null | \
  grep -o "process\.env\.[A-Z_][A-Z_0-9]*" | \
  sed 's/process\.env\.//' | \
  sort -u)

USED_COUNT=$(echo "$USED_VARS" | wc -l)

echo -e "${GREEN}✅ コードで使用されている変数: ${USED_COUNT}個${NC}"
echo ""

#######################################################
# Step 3: 不整合をチェック
#######################################################
echo "🔍 Step 3: 不整合をチェック..."
echo ""

# コードで使用されているが.env.exampleにない変数
echo "❓ コードで使用されているが.env.exampleに未定義の変数:"
UNDEFINED_IN_EXAMPLE=""

for var in $USED_VARS; do
  # NODE_ENV, CI, npm_* などの自動設定変数は除外
  if [[ "$var" == "NODE_ENV" ]] || \
     [[ "$var" == "CI" ]] || \
     [[ "$var" == "npm_"* ]] || \
     [[ "$var" == "VERCEL_"* ]]; then
    continue
  fi

  if ! echo "$DEFINED_VARS" | grep -q "^${var}$"; then
    echo -e "${RED}  ❌ $var${NC}"
    UNDEFINED_IN_EXAMPLE="$UNDEFINED_IN_EXAMPLE $var"
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
done

if [ -z "$UNDEFINED_IN_EXAMPLE" ]; then
  echo -e "${GREEN}  ✅ なし（全ての変数が定義済み）${NC}"
fi

echo ""

# .env.exampleにあるがコードで使用されていない変数（警告のみ）
echo "⚠️  .env.exampleに定義されているがコードで未使用の変数:"
UNUSED_IN_CODE=""

for var in $DEFINED_VARS; do
  if ! echo "$USED_VARS" | grep -q "^${var}$"; then
    echo -e "${YELLOW}  ⚠️  $var (未使用 - 削除を検討)${NC}"
    UNUSED_IN_CODE="$UNUSED_IN_CODE $var"
    WARNING_COUNT=$((WARNING_COUNT + 1))
  fi
done

if [ -z "$UNUSED_IN_CODE" ]; then
  echo -e "${GREEN}  ✅ なし（全ての変数が使用されている）${NC}"
fi

echo ""

#######################################################
# Step 4: .env.localの存在確認と必須変数チェック
#######################################################
echo "🔍 Step 4: .env.localの存在確認..."

if [ ! -f ".env.local" ]; then
  echo -e "${YELLOW}⚠️  .env.local が見つかりません${NC}"
  echo "   → .env.example をコピーして作成してください"
  echo "   cp .env.example .env.local"
  WARNING_COUNT=$((WARNING_COUNT + 1))
else
  echo -e "${GREEN}✅ .env.local が存在します${NC}"

  # .env.localに必須変数が存在するかチェック
  echo ""
  echo "🔍 .env.localの必須変数チェック..."

  MISSING_VARS=""
  for var in $DEFINED_VARS; do
    # コメントアウトされている行は無視
    if ! grep -E "^${var}=" .env.local > /dev/null 2>&1; then
      echo -e "${RED}  ❌ $var が.env.localに未設定${NC}"
      MISSING_VARS="$MISSING_VARS $var"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
  done

  if [ -z "$MISSING_VARS" ]; then
    echo -e "${GREEN}  ✅ 全ての必須変数が設定済み${NC}"
  fi
fi

echo ""

#######################################################
# Step 5: 特定の変数ペアの一致チェック
#######################################################
echo "🔍 Step 5: 重複・類似変数の一致チェック..."
echo ""

# NEXT_PUBLIC_WS_URL と NEXT_PUBLIC_WS_ENDPOINT が一致しているかチェック
if [ -f ".env.local" ]; then
  WS_URL=$(grep "^NEXT_PUBLIC_WS_URL=" .env.local 2>/dev/null | cut -d'=' -f2)
  WS_ENDPOINT=$(grep "^NEXT_PUBLIC_WS_ENDPOINT=" .env.local 2>/dev/null | cut -d'=' -f2)

  if [ -n "$WS_URL" ] && [ -n "$WS_ENDPOINT" ]; then
    if [ "$WS_URL" != "$WS_ENDPOINT" ]; then
      echo -e "${RED}❌ NEXT_PUBLIC_WS_URL と NEXT_PUBLIC_WS_ENDPOINT が不一致${NC}"
      echo "   NEXT_PUBLIC_WS_URL=$WS_URL"
      echo "   NEXT_PUBLIC_WS_ENDPOINT=$WS_ENDPOINT"
      echo "   → 両方を同じ値に設定してください"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    else
      echo -e "${GREEN}✅ NEXT_PUBLIC_WS_URL と NEXT_PUBLIC_WS_ENDPOINT が一致${NC}"
    fi
  fi
fi

echo ""

#######################################################
# 結果サマリー
#######################################################
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 検証結果サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  .env.exampleに定義: ${DEFINED_COUNT}個"
echo "  コードで使用:       ${USED_COUNT}個"
echo -e "  ${RED}エラー:             ${ERROR_COUNT}個${NC}"
echo -e "  ${YELLOW}警告:               ${WARNING_COUNT}個${NC}"
echo ""

if [ $ERROR_COUNT -gt 0 ]; then
  echo -e "${RED}❌ 検証失敗: ${ERROR_COUNT}個のエラーが検出されました${NC}"
  echo ""
  echo "📝 修正方法:"
  echo "  1. 未定義の変数を .env.example に追加"
  echo "  2. .env.local にも同じ変数を追加"
  echo "  3. このスクリプトを再実行して確認"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ 検証成功: 全チェックに合格しました${NC}"

  if [ $WARNING_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  ${WARNING_COUNT}個の警告があります（無視可能）${NC}"
  fi

  echo ""
  exit 0
fi
