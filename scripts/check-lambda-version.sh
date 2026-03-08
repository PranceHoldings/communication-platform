#!/bin/bash
# check-lambda-version.sh - Lambda関数のバージョンを確認
# 使用方法: ./scripts/check-lambda-version.sh [function-name]

set -e

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

FUNCTION_NAME="${1:-prance-websocket-default-dev}"

echo -e "${BLUE}🔍 Lambda関数バージョンチェック${NC}"
echo "=============================================="
echo -e "${BLUE}関数名: ${FUNCTION_NAME}${NC}\n"

# 1. ローカルのpackage.jsonからバージョンを取得
LOCAL_VERSION=$(cat infrastructure/lambda/websocket/default/package.json | grep '"version"' | sed 's/.*"version": "\(.*\)".*/\1/')
echo -e "${BLUE}📦 ローカルバージョン:${NC} ${LOCAL_VERSION}"

# 2. Lambda関数の最終更新日時を取得
FUNCTION_INFO=$(aws lambda get-function --function-name ${FUNCTION_NAME} --query 'Configuration.[LastModified,CodeSize,Runtime]' --output json)
LAST_MODIFIED=$(echo $FUNCTION_INFO | jq -r '.[0]')
CODE_SIZE=$(echo $FUNCTION_INFO | jq -r '.[1]')
RUNTIME=$(echo $FUNCTION_INFO | jq -r '.[2]')

echo -e "${BLUE}☁️  デプロイ済みLambda:${NC}"
echo "   最終更新: ${LAST_MODIFIED}"
echo "   コードサイズ: ${CODE_SIZE} bytes"
echo "   ランタイム: ${RUNTIME}"

# 3. CloudWatch Logsから最新のバージョンログを取得
echo -e "\n${YELLOW}📋 CloudWatch Logsから実行中のバージョンを確認中...${NC}"

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
  echo -e "${YELLOW}⚠️  最近のログが見つかりません。テストリクエストを送信してバージョンを確認してください。${NC}"
  echo -e "${YELLOW}   または、Lambda関数を手動で起動してログを生成してください。${NC}"
  DEPLOYED_VERSION="不明"
else
  echo -e "${GREEN}✅ 実行中のバージョン:${NC} ${DEPLOYED_VERSION}"
fi

# 4. バージョン比較
echo -e "\n${BLUE}📊 バージョン比較:${NC}"
echo "   ローカル: ${LOCAL_VERSION}"
echo "   デプロイ済み: ${DEPLOYED_VERSION}"

if [ "$LOCAL_VERSION" = "$DEPLOYED_VERSION" ]; then
  echo -e "\n${GREEN}✅ バージョン一致 - Lambda関数は最新です${NC}"
  exit 0
elif [ "$DEPLOYED_VERSION" = "不明" ]; then
  echo -e "\n${YELLOW}⚠️  デプロイ済みバージョンが不明です${NC}"
  echo -e "${YELLOW}   テストリクエストを送信して確認してください：${NC}"
  echo -e "   ${BLUE}curl -X POST \\"
  echo -e "     https://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev \\"
  echo -e "     -H 'Content-Type: application/json' \\"
  echo -e "     -d '{\"action\":\"sendMessage\",\"message\":{\"type\":\"version\"}}'${NC}"
  exit 1
else
  echo -e "\n${RED}❌ バージョン不一致！${NC}"
  echo -e "${RED}   Lambda関数を再デプロイしてください：${NC}"
  echo -e "   ${BLUE}cd infrastructure && npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never${NC}"
  exit 1
fi
