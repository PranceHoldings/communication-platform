#!/bin/bash
# check-lambda-version.sh (v2 - Shared Library版) - Lambda関数のバージョンを確認
# 使用方法: ./scripts/check-lambda-version.sh [function-name]

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

FUNCTION_NAME="${1:-prance-websocket-default-dev}"

log_section "Lambda関数バージョンチェック"
log_info "関数名: ${FUNCTION_NAME}"
echo ""

# 1. ローカルのpackage.jsonからバージョンを取得
LOCAL_VERSION=$(cat infrastructure/lambda/websocket/default/package.json | grep '"version"' | sed 's/.*"version": "\(.*\)".*/\1/')
log_info "📦 ローカルバージョン: ${LOCAL_VERSION}"

# 2. Lambda関数の最終更新日時を取得
FUNCTION_INFO=$(aws lambda get-function --function-name ${FUNCTION_NAME} --query 'Configuration.[LastModified,CodeSize,Runtime]' --output json)
LAST_MODIFIED=$(echo $FUNCTION_INFO | jq -r '.[0]')
CODE_SIZE=$(echo $FUNCTION_INFO | jq -r '.[1]')
RUNTIME=$(echo $FUNCTION_INFO | jq -r '.[2]')

log_info "☁️  デプロイ済みLambda:"
echo "   最終更新: ${LAST_MODIFIED}"
echo "   コードサイズ: ${CODE_SIZE} bytes"
echo "   ランタイム: ${RUNTIME}"

# 3. CloudWatch Logsから最新のバージョンログを取得
echo ""
log_warning "📋 CloudWatch Logsから実行中のバージョンを確認中..."

# 過去5分以内のログを確認
START_TIME=$(($(date +%s) - 300))000
DEPLOYED_VERSION=$(aws logs filter-log-events \
  --log-group-name /aws/lambda/${FUNCTION_NAME} \
  --start-time ${START_TIME} \
  --filter-pattern "[Lambda Version]" \
  --max-items 1 \
  --query 'events[0].message' \
  --output text 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)

if [ -z "$DEPLOYED_VERSION" ]; then
  log_warning "⚠️  最近のログが見つかりません。テストリクエストを送信してバージョンを確認してください。"
  log_warning "   または、Lambda関数を手動で起動してログを生成してください。"
  DEPLOYED_VERSION="不明"
else
  log_success "✅ 実行中のバージョン: ${DEPLOYED_VERSION}"
fi

# 4. バージョン比較
echo ""
log_info "📊 バージョン比較:"
echo "   ローカル: ${LOCAL_VERSION}"
echo "   デプロイ済み: ${DEPLOYED_VERSION}"
echo ""

if [ "$LOCAL_VERSION" = "$DEPLOYED_VERSION" ]; then
  log_success "✅ バージョン一致 - Lambda関数は最新です"
  exit 0
elif [ "$DEPLOYED_VERSION" = "不明" ]; then
  log_warning "⚠️  デプロイ済みバージョンが不明です"
  log_warning "   テストリクエストを送信して確認してください："
  log_info "   curl -X POST \\"
  log_info "     https://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev \\"
  log_info "     -H 'Content-Type: application/json' \\"
  log_info "     -d '{\"action\":\"sendMessage\",\"message\":{\"type\":\"version\"}}'"
  exit 1
else
  log_error "❌ バージョン不一致！"
  log_error "   Lambda関数を再デプロイしてください："
  log_info "   cd infrastructure && pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never"
  exit 1
fi
