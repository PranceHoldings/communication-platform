#!/bin/bash
# validate-nextjs-deployment.sh
# Next.js Lambda デプロイが正しく動作しているか検証する
# デプロイ後に実行し、静的ファイル配信・SSR・APIクライアント設定を確認

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENVIRONMENT="${1:-production}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

pass()    { echo -e "${GREEN}  ✅ $1${NC}"; }
fail()    { echo -e "${RED}  ❌ $1${NC}"; ERRORS=$((ERRORS + 1)); }
warn()    { echo -e "${YELLOW}  ⚠️  $1${NC}"; WARNINGS=$((WARNINGS + 1)); }
section() { echo -e "\n${BLUE}── $1 ──${NC}"; }

if [ "$ENVIRONMENT" = "production" ]; then
  BASE_URL="https://app.prance.jp"
  LAMBDA_NAME="prance-nextjs-production"
else
  BASE_URL="https://dev.app.prance.jp"
  LAMBDA_NAME="prance-nextjs-dev"
fi

echo -e "${BLUE}🔍 Next.js デプロイ検証: $ENVIRONMENT${NC}"
echo "   URL: $BASE_URL"

# ─── 1. Lambda の最終更新時刻確認 ──────────────────────────────────────────

section "Lambda 最終更新確認"

LAST_MODIFIED=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --query 'LastModified' --output text 2>/dev/null || echo "N/A")

LAST_MODIFIED_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_MODIFIED%.*}" "+%s" 2>/dev/null || echo "0")
NOW_EPOCH=$(date +%s)
AGE_HOURS=$(( (NOW_EPOCH - LAST_MODIFIED_EPOCH) / 3600 ))

echo "  最終更新: $LAST_MODIFIED (${AGE_HOURS}時間前)"
if [ "$AGE_HOURS" -gt 24 ]; then
  warn "Lambda が24時間以上更新されていません — 最新のビルドがデプロイされているか確認してください"
fi

# ─── 2. Lambda の BUILD_ID 確認 ────────────────────────────────────────────

section "BUILD_ID 確認"

LOCAL_BUILD_ID=$(cat "$PROJECT_ROOT/apps/web/.next/BUILD_ID" 2>/dev/null || echo "")

# /.build-id は Lambda が HTML で返すため直接取得不可。
# 代わりに HTML の webpack ハッシュで「デプロイ済みビルド」を確認する。
LAMBDA_HTML=$(curl -s --max-time 10 "$BASE_URL/" 2>/dev/null)
LAMBDA_WEBPACK_HASH=$(echo "$LAMBDA_HTML" | grep -o 'webpack-[a-f0-9]*\.js' | head -1 | sed 's/webpack-\([a-f0-9]*\)\.js/\1/')

if [ -n "$LOCAL_BUILD_ID" ]; then
  echo "  ローカル BUILD_ID: $LOCAL_BUILD_ID"
fi
if [ -n "$LAMBDA_WEBPACK_HASH" ]; then
  pass "Lambda webpack ハッシュ確認済み: $LAMBDA_WEBPACK_HASH"
else
  warn "webpack ハッシュを取得できませんでした"
fi

# ─── 3. HTTP ステータス確認 ──────────────────────────────────────────────────

section "HTTP ステータス確認"

check_url() {
  local URL="$1"
  local EXPECTED_STATUS="$2"
  local LABEL="$3"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null)
  if [ "$STATUS" = "$EXPECTED_STATUS" ]; then
    pass "$LABEL → HTTP $STATUS"
  else
    fail "$LABEL → HTTP $STATUS (期待: $EXPECTED_STATUS)"
    echo "    URL: $URL"
  fi
}

# トップページ
check_url "$BASE_URL/" "200" "トップページ"

# ─── 4. 静的ファイル配信確認 ─────────────────────────────────────────────────

section "静的ファイル配信確認"

# HTML から静的チャンク URL を抽出して確認
HTML=$(curl -s --max-time 10 "$BASE_URL/" 2>/dev/null)

if [ -z "$HTML" ]; then
  fail "トップページの HTML を取得できません"
else
  # webpack チャンクを抽出
  WEBPACK_CHUNK=$(echo "$HTML" | grep -o '_next/static/chunks/webpack-[^"]*\.js' | head -1)
  CSS_FILE=$(echo "$HTML" | grep -o '_next/static/css/[^"]*\.css' | head -1)

  if [ -n "$WEBPACK_CHUNK" ]; then
    CHUNK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/$WEBPACK_CHUNK" 2>/dev/null)
    if [ "$CHUNK_STATUS" = "200" ]; then
      pass "webpack チャンク → HTTP 200 ($WEBPACK_CHUNK)"
    else
      fail "webpack チャンク → HTTP $CHUNK_STATUS (期待: 200)"
      echo "    URL: $BASE_URL/$WEBPACK_CHUNK"
      echo "    → Lambda パッケージに静的ファイルが含まれていない可能性があります"
    fi
  else
    warn "webpack チャンクの URL を HTML から抽出できませんでした"
  fi

  if [ -n "$CSS_FILE" ]; then
    CSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/$CSS_FILE" 2>/dev/null)
    if [ "$CSS_STATUS" = "200" ]; then
      pass "CSS ファイル → HTTP 200 ($CSS_FILE)"
    else
      fail "CSS ファイル → HTTP $CSS_STATUS (期待: 200)"
    fi
  fi
fi

# ─── 5. API クライアント設定確認 ────────────────────────────────────────────

section "API クライアント設定確認"

# Lambda の env vars で NEXT_PUBLIC_API_URL を確認
API_URL=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --query 'Environment.Variables.NEXT_PUBLIC_API_URL' \
  --output text 2>/dev/null || echo "N/A")

EXPECTED_API_URL="https://api.app.prance.jp/api/v1"
EXPECTED_API_HOST="api.app.prance.jp"
if [ "$ENVIRONMENT" != "production" ]; then
  EXPECTED_API_URL="https://api.dev.app.prance.jp/api/v1"
  EXPECTED_API_HOST="api.dev.app.prance.jp"
fi

# Lambda env var may include /api/v1 suffix or not — normalise for comparison
API_URL_NORMALISED="${API_URL%/api/v1}"  # strip trailing /api/v1 if present
EXPECTED_HOST_ONLY="${EXPECTED_API_URL%/api/v1}"

echo "  NEXT_PUBLIC_API_URL (Lambda env): $API_URL"
echo "  NEXT_PUBLIC_API_URL は Next.js ビルド時に焼き込まれます。Lambda env は参考値のみ。"
if [ "$API_URL" = "$EXPECTED_API_URL" ] || [ "$API_URL_NORMALISED" = "$EXPECTED_HOST_ONLY" ]; then
  pass "Lambda env NEXT_PUBLIC_API_URL が正しく設定されています"
else
  warn "Lambda env NEXT_PUBLIC_API_URL が期待値と異なります: $API_URL (期待: $EXPECTED_API_URL)"
  echo "    → Lambda env は参考値です。重要なのはバンドル内の値（下記チェック参照）"
fi

# バンドル内の API URL を確認（NEXT_PUBLIC_* はバンドルに焼き込まれる）
# Lambda パッケージが存在する場合のみチェック
BUNDLE_DIR="/tmp/nextjs-lambda-package/apps/web/.next/static/chunks"
if [ -d "$BUNDLE_DIR" ]; then
  BUNDLE_CORRECT_COUNT=$(grep -rl "$EXPECTED_API_HOST" "$BUNDLE_DIR" 2>/dev/null | wc -l | tr -d ' ')
  BUNDLE_OLD_APIGW_COUNT=$(grep -rl "execute-api.*\.amazonaws\.com" "$BUNDLE_DIR" 2>/dev/null | wc -l | tr -d ' ')
  BUNDLE_MISSING_PATH_COUNT=$(grep -rl "prance\.jp['\"]" "$BUNDLE_DIR" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$BUNDLE_CORRECT_COUNT" -gt 0 ]; then
    pass "バンドル内 API URL: 正しいエンドポイント '$EXPECTED_API_HOST' (${BUNDLE_CORRECT_COUNT} ファイル)"
  else
    fail "バンドル内に '$EXPECTED_API_HOST' が見つかりません — 正しい環境用に再ビルドが必要です"
    echo "    実行: cd infrastructure && bash deploy.sh $ENVIRONMENT"
  fi

  if [ "$BUNDLE_OLD_APIGW_COUNT" -gt 0 ]; then
    fail "バンドル内に古い API Gateway URL が残っています (${BUNDLE_OLD_APIGW_COUNT} ファイル) — 再ビルドしてください"
  fi

  # Only flag http(s) URLs missing /api/v1 — ws:// URLs don't need the path
  BUNDLE_HTTP_MISSING_COUNT=$(grep -rl "https*://[a-z.]*prance\.jp['\"]" "$BUNDLE_DIR" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$BUNDLE_HTTP_MISSING_COUNT" -gt 0 ]; then
    warn "バンドル内に /api/v1 なしの http(s) ドメインが見つかります (${BUNDLE_HTTP_MISSING_COUNT} ファイル) — 確認してください"
  fi
fi

# ─── 結果サマリー ─────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "${GREEN}✅ 全チェック通過 — デプロイ正常${NC}"
elif [ "$ERRORS" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  警告 ${WARNINGS} 件 (エラーなし)${NC}"
else
  echo -e "${RED}❌ エラー ${ERRORS} 件 / 警告 ${WARNINGS} 件${NC}"
  echo ""
  echo "修正手順:"
  echo "  cd \$(git rev-parse --show-toplevel)"
  echo "  bash scripts/build-nextjs-standalone.sh"
  echo "  bash scripts/package-nextjs-lambda.sh"
  echo "  cd infrastructure && pnpm run deploy:nextjs-production"
fi
echo "══════════════════════════════════════"

exit $ERRORS
