#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENV_FILE="${1:-.env.local}"

echo ""
echo "🔍 環境変数の重複・矛盾チェック: ${ENV_FILE}"
echo ""

ERROR_COUNT=0

# ============================================================
# Check 1: 重複キーの確認
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Check 1: 重複キーの確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# コメント行と空行を除外してキーを抽出
KEYS=$(grep -v "^#" "$ENV_FILE" | grep -v "^$" | grep "=" | cut -d'=' -f1 | sort)

# 重複チェック
DUPLICATES=$(echo "$KEYS" | uniq -d)

if [ -n "$DUPLICATES" ]; then
  echo -e "${RED}❌ 重複キーが見つかりました:${NC}"
  echo "$DUPLICATES" | while read key; do
    echo -e "  ${YELLOW}${key}${NC}"
    grep -n "^${key}=" "$ENV_FILE" | sed 's/^/    /'
    ((ERROR_COUNT++))
  done
  echo ""
else
  echo -e "${GREEN}✅ 重複キーはありません${NC}"
  echo ""
fi

# ============================================================
# Check 2: リージョンの一貫性
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌍 Check 2: AWSリージョンの一貫性"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

AWS_REGION=$(grep "^AWS_REGION=" "$ENV_FILE" | cut -d'=' -f2)
BEDROCK_REGION=$(grep "^BEDROCK_REGION=" "$ENV_FILE" | cut -d'=' -f2)
REKOGNITION_REGION=$(grep "^REKOGNITION_REGION=" "$ENV_FILE" | cut -d'=' -f2)
POLLY_REGION=$(grep "^POLLY_REGION=" "$ENV_FILE" | cut -d'=' -f2)
AZURE_SPEECH_REGION=$(grep "^AZURE_SPEECH_REGION=" "$ENV_FILE" | cut -d'=' -f2)

echo "  AWS_REGION           = $AWS_REGION"
echo "  BEDROCK_REGION       = $BEDROCK_REGION"
echo "  REKOGNITION_REGION   = $REKOGNITION_REGION"
echo "  POLLY_REGION         = $POLLY_REGION"
echo "  AZURE_SPEECH_REGION  = $AZURE_SPEECH_REGION"
echo ""

REGION_INCONSISTENT=false
if [ "$AWS_REGION" != "$BEDROCK_REGION" ] || [ "$AWS_REGION" != "$REKOGNITION_REGION" ] || [ "$AWS_REGION" != "$POLLY_REGION" ]; then
  echo -e "${YELLOW}⚠️  AWSサービス間でリージョンが異なります${NC}"
  echo "   推奨: すべてのAWSサービスを同じリージョンに統一（レイテンシー削減・コスト削減）"
  echo ""
  REGION_INCONSISTENT=true
fi

if [ "$REGION_INCONSISTENT" = false ]; then
  echo -e "${GREEN}✅ AWSリージョンは一貫しています (${AWS_REGION})${NC}"
  echo ""
fi

# ============================================================
# Check 3: WebSocketエンドポイントの一貫性
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 Check 3: WebSocketエンドポイントの一貫性"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NEXT_PUBLIC_WS=$(grep "^NEXT_PUBLIC_WS_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2)
WEBSOCKET_ENDPOINT=$(grep "^WEBSOCKET_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2)

echo "  NEXT_PUBLIC_WS_ENDPOINT = $NEXT_PUBLIC_WS"
echo "  WEBSOCKET_ENDPOINT      = $WEBSOCKET_ENDPOINT"
echo ""

if [ "$NEXT_PUBLIC_WS" != "$WEBSOCKET_ENDPOINT" ]; then
  echo -e "${RED}❌ WebSocketエンドポイントが一致しません${NC}"
  echo "   フロントエンドとLambdaで異なるエンドポイントを使用しています"
  echo ""
  ((ERROR_COUNT++))
else
  echo -e "${GREEN}✅ WebSocketエンドポイントは一致しています${NC}"
  echo ""
fi

# ============================================================
# Check 4: スコア重みの合計
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚖️  Check 4: スコア計算の重み合計"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

EMOTION_WEIGHT=$(grep "^EMOTION_WEIGHT=" "$ENV_FILE" | cut -d'=' -f2)
AUDIO_WEIGHT=$(grep "^AUDIO_WEIGHT=" "$ENV_FILE" | cut -d'=' -f2)
CONTENT_WEIGHT=$(grep "^CONTENT_WEIGHT=" "$ENV_FILE" | cut -d'=' -f2)
DELIVERY_WEIGHT=$(grep "^DELIVERY_WEIGHT=" "$ENV_FILE" | cut -d'=' -f2)

echo "  EMOTION_WEIGHT  = $EMOTION_WEIGHT"
echo "  AUDIO_WEIGHT    = $AUDIO_WEIGHT"
echo "  CONTENT_WEIGHT  = $CONTENT_WEIGHT"
echo "  DELIVERY_WEIGHT = $DELIVERY_WEIGHT"
echo ""

# awk計算（浮動小数点対応）
TOTAL=$(awk "BEGIN {print $EMOTION_WEIGHT + $AUDIO_WEIGHT + $CONTENT_WEIGHT + $DELIVERY_WEIGHT}")
echo "  合計 = $TOTAL"
echo ""

# 許容誤差 0.001 (浮動小数点演算の誤差考慮)
DIFF=$(awk "BEGIN {print ($TOTAL - 1.0 < 0 ? -($ TOTAL - 1.0) : $TOTAL - 1.0)}")
IS_VALID=$(awk "BEGIN {print ($DIFF < 0.001 ? 1 : 0)}")

if [ "$IS_VALID" -eq 1 ]; then
  echo -e "${GREEN}✅ 重みの合計は1.0です (正規化済み)${NC}"
  echo ""
else
  echo -e "${RED}❌ 重みの合計が1.0ではありません (現在: ${TOTAL})${NC}"
  echo "   推奨: 合計が1.0になるように調整してください"
  echo ""
  ((ERROR_COUNT++))
fi

# ============================================================
# Check 5: Frontend URLの一貫性
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Check 5: Frontend URLの一貫性"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FRONTEND_URL=$(grep "^FRONTEND_URL=" "$ENV_FILE" | cut -d'=' -f2)
BASE_URL=$(grep "^BASE_URL=" "$ENV_FILE" | cut -d'=' -f2)

echo "  FRONTEND_URL = $FRONTEND_URL"
echo "  BASE_URL     = $BASE_URL (Playwright用)"
echo ""

if [ "$FRONTEND_URL" != "$BASE_URL" ]; then
  echo -e "${YELLOW}⚠️  FRONTEND_URLとBASE_URLが異なります${NC}"
  echo "   BASE_URLはPlaywright E2Eテスト用のため、異なることは問題ありません"
  echo ""
else
  echo -e "${GREEN}✅ Frontend URLは一致しています${NC}"
  echo ""
fi

# ============================================================
# Check 6: API エンドポイントのリージョン一貫性
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Check 6: API エンドポイントのリージョン一貫性"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

API_URL=$(grep "^NEXT_PUBLIC_API_URL=" "$ENV_FILE" | cut -d'=' -f2)
WS_URL=$(grep "^NEXT_PUBLIC_WS_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2)

# URLからリージョン抽出
API_REGION=$(echo "$API_URL" | grep -oP 'execute-api\.\K[a-z0-9-]+(?=\.amazonaws)')
WS_REGION=$(echo "$WS_URL" | grep -oP 'execute-api\.\K[a-z0-9-]+(?=\.amazonaws)')

echo "  API URL      = $API_URL"
echo "  WS URL       = $WS_URL"
echo ""
echo "  API Region   = $API_REGION"
echo "  WS Region    = $WS_REGION"
echo "  AWS_REGION   = $AWS_REGION"
echo ""

ENDPOINT_INCONSISTENT=false
if [ "$API_REGION" != "$WS_REGION" ]; then
  echo -e "${RED}❌ APIとWebSocketで異なるリージョンを使用しています${NC}"
  echo "   これは通常エラーです。同じリージョンに統一してください。"
  echo ""
  ((ERROR_COUNT++))
  ENDPOINT_INCONSISTENT=true
fi

if [ "$API_REGION" != "$AWS_REGION" ] || [ "$WS_REGION" != "$AWS_REGION" ]; then
  echo -e "${YELLOW}⚠️  エンドポイントのリージョンとAWS_REGIONが異なります${NC}"
  echo "   AWS_REGION=$AWS_REGION だが、エンドポイントは $API_REGION を使用"
  echo ""
fi

if [ "$ENDPOINT_INCONSISTENT" = false ] && [ "$API_REGION" = "$AWS_REGION" ]; then
  echo -e "${GREEN}✅ すべてのエンドポイントで同じリージョンを使用しています (${API_REGION})${NC}"
  echo ""
fi

# ============================================================
# Check 7: 必須環境変数の存在確認
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✔️  Check 7: 必須環境変数の存在確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REQUIRED_VARS=(
  "AWS_REGION"
  "DATABASE_URL"
  "JWT_SECRET"
  "ELEVENLABS_API_KEY"
  "AZURE_SPEECH_KEY"
  "BEDROCK_MODEL_ID"
  "CLOUDFRONT_DOMAIN"
  "S3_BUCKET"
  "NEXT_PUBLIC_API_URL"
  "NEXT_PUBLIC_WS_ENDPOINT"
  "AWS_ENDPOINT_SUFFIX"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=" "$ENV_FILE"; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ すべての必須環境変数が定義されています${NC}"
  echo ""
else
  echo -e "${RED}❌ 以下の必須環境変数が見つかりません:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
    ((ERROR_COUNT++))
  done
  echo ""
fi

# ============================================================
# Check 8: セキュリティチェック（開発環境用の値が残っていないか）
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Check 8: セキュリティチェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

JWT_SECRET_VALUE=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2)

SECURITY_WARNINGS=0

if [[ "$JWT_SECRET_VALUE" == *"dev-secret"* ]] || [[ "$JWT_SECRET_VALUE" == *"change"* ]]; then
  echo -e "${YELLOW}⚠️  JWT_SECRETに開発用の値が含まれています${NC}"
  echo "   本番環境では必ず長く複雑なランダム文字列に変更してください"
  echo "   生成方法: openssl rand -base64 64"
  echo ""
  ((SECURITY_WARNINGS++))
fi

# CloudFront署名キーのプレースホルダーチェック
CF_KEY_PAIR=$(grep "^CLOUDFRONT_KEY_PAIR_ID=" "$ENV_FILE" | cut -d'=' -f2)
CF_PRIVATE_KEY=$(grep "^CLOUDFRONT_PRIVATE_KEY=" "$ENV_FILE" | cut -d'=' -f2)

if [ "$CF_KEY_PAIR" = "placeholder" ] || [ "$CF_PRIVATE_KEY" = "placeholder" ]; then
  echo -e "${YELLOW}⚠️  CloudFront署名キーがプレースホルダーのままです${NC}"
  echo "   保護されたコンテンツ配信を使用する場合は、実際のキーを設定してください"
  echo ""
  ((SECURITY_WARNINGS++))
fi

if [ "$SECURITY_WARNINGS" -eq 0 ]; then
  echo -e "${GREEN}✅ セキュリティ上の問題は検出されませんでした${NC}"
  echo ""
else
  echo -e "${BLUE}ℹ️  ${SECURITY_WARNINGS}件のセキュリティ警告があります（本番環境では対応必須）${NC}"
  echo ""
fi

# ============================================================
# Summary
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$ERROR_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ エラーは検出されませんでした${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ ${ERROR_COUNT}件のエラーが検出されました${NC}"
  echo ""
  echo "上記の問題を修正してから、再度実行してください。"
  echo ""
  exit 1
fi
