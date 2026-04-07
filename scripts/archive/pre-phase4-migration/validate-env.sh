#!/bin/bash

# 環境変数検証スクリプト
# このスクリプトは.env.localとinfrastructure/.envが正しく設定されているか検証します

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "環境変数検証スクリプト"
echo "=========================================="
echo ""

# 1. .env.localの存在確認
if [ ! -f ".env.local" ]; then
  echo -e "${RED}❌ ERROR: .env.local が見つかりません${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ .env.local 存在確認 OK${NC}"
fi

# 2. infrastructure/.envの存在確認
if [ ! -f "infrastructure/.env" ]; then
  echo -e "${RED}❌ ERROR: infrastructure/.env が見つかりません${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ infrastructure/.env 存在確認 OK${NC}"
fi

echo ""
echo "=========================================="
echo "DATABASE_URL検証"
echo "=========================================="

# 3. ローカルPostgreSQL接続文字列の検出
check_localhost_db() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  if grep -q "DATABASE_URL.*localhost:5432\|DATABASE_URL.*@localhost" "$file"; then
    echo -e "${RED}❌ ERROR: $name にローカルPostgreSQL接続文字列が含まれています${NC}"
    echo -e "${RED}   → このプロジェクトはAWS RDS Aurora Serverless v2専用です${NC}"
    echo -e "${RED}   → DATABASE_URLをAWS RDS接続文字列に変更してください${NC}"
    grep -n "DATABASE_URL" "$file" | head -3
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ $name: ローカルPostgreSQL検出なし${NC}"
  fi
}

check_localhost_db ".env.local" ".env.local"
check_localhost_db "infrastructure/.env" "infrastructure/.env"

echo ""
echo "=========================================="
echo "AWS RDS接続文字列の検証"
echo "=========================================="

# 4. AWS RDS接続文字列の確認
check_rds_connection() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  if grep -q "DATABASE_URL.*rds\.amazonaws\.com\|DATABASE_URL.*cluster-.*\.us-east-1\.rds\.amazonaws\.com" "$file"; then
    echo -e "${GREEN}✅ $name: AWS RDS接続文字列を検出${NC}"
  else
    echo -e "${YELLOW}⚠️  WARNING: $name にAWS RDS接続文字列が見つかりません${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
}

check_rds_connection ".env.local" ".env.local"
check_rds_connection "infrastructure/.env" "infrastructure/.env"

echo ""
echo "=========================================="
echo "フロントエンドAPI設定の検証"
echo "=========================================="

# 4.5. NEXT_PUBLIC_*のlocalhost検出
check_frontend_config() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  # NEXT_PUBLIC_API_URLのチェック
  if grep -q "NEXT_PUBLIC_API_URL.*localhost" "$file"; then
    echo -e "${RED}❌ ERROR: $name のNEXT_PUBLIC_API_URLがlocalhostを指しています${NC}"
    echo -e "${RED}   → このプロジェクトはバックエンドが完全AWS構成です${NC}"
    echo -e "${RED}   → AWS API Gateway URLに変更してください${NC}"
    grep -n "NEXT_PUBLIC_API_URL.*localhost" "$file"
    ERRORS=$((ERRORS + 1))
  else
    if grep -q "NEXT_PUBLIC_API_URL.*execute-api.*amazonaws\.com" "$file"; then
      echo -e "${GREEN}✅ $name: NEXT_PUBLIC_API_URL はAWS API Gatewayを指しています${NC}"
    else
      echo -e "${YELLOW}⚠️  WARNING: $name にNEXT_PUBLIC_API_URLが見つからないか、形式が不正です${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi

  # NEXT_PUBLIC_WS_URLのチェック
  if grep -q "NEXT_PUBLIC_WS_URL.*localhost" "$file"; then
    echo -e "${RED}❌ ERROR: $name のNEXT_PUBLIC_WS_URLがlocalhostを指しています${NC}"
    echo -e "${RED}   → このプロジェクトはWebSocketがAWS IoT Core構成です${NC}"
    echo -e "${RED}   → AWS WebSocket URLに変更してください${NC}"
    grep -n "NEXT_PUBLIC_WS_URL.*localhost" "$file"
    ERRORS=$((ERRORS + 1))
  else
    if grep -q "NEXT_PUBLIC_WS_URL.*wss://.*execute-api.*amazonaws\.com" "$file"; then
      echo -e "${GREEN}✅ $name: NEXT_PUBLIC_WS_URL はAWS WebSocketを指しています${NC}"
    else
      echo -e "${YELLOW}⚠️  WARNING: $name にNEXT_PUBLIC_WS_URLが見つからないか、形式が不正です${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
}

check_frontend_config ".env.local" ".env.local"
check_frontend_config "infrastructure/.env" "infrastructure/.env"

echo ""
echo "=========================================="
echo "必須環境変数の確認"
echo "=========================================="

# 5. 必須環境変数の存在確認
REQUIRED_VARS=(
  "AWS_REGION"
  "AWS_ACCOUNT_ID"
  "BEDROCK_MODEL_ID"
  "ELEVENLABS_API_KEY"
  "AZURE_SPEECH_KEY"
  "JWT_SECRET"
  "DATABASE_URL"
)

check_required_vars() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  local missing=0
  for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" "$file" && ! grep -q "^${var} =" "$file"; then
      echo -e "${YELLOW}⚠️  WARNING: $name に ${var} がありません${NC}"
      missing=$((missing + 1))
    fi
  done

  if [ $missing -eq 0 ]; then
    echo -e "${GREEN}✅ $name: 全ての必須環境変数が存在${NC}"
  else
    WARNINGS=$((WARNINGS + missing))
  fi
}

check_required_vars ".env.local" ".env.local"
check_required_vars "infrastructure/.env" "infrastructure/.env"

echo ""
echo "=========================================="
echo "検証結果"
echo "=========================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ 全ての検証に合格しました！${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  警告が ${WARNINGS} 件あります${NC}"
  exit 0
else
  echo -e "${RED}❌ エラーが ${ERRORS} 件、警告が ${WARNINGS} 件あります${NC}"
  echo ""
  echo "修正方法:"
  echo ""
  echo "【DATABASE_URL関連】"
  echo "1. AWS RDS接続情報を取得:"
  echo "   aws secretsmanager get-secret-value --secret-id \$(aws cloudformation describe-stacks --stack-name Prance-dev-Database --query 'Stacks[0].Outputs[?OutputKey==\`SecretArn\`].OutputValue' --output text)"
  echo ""
  echo "2. .env.local と infrastructure/.env を更新:"
  echo "   DATABASE_URL=\"postgresql://USERNAME:PASSWORD@RDS_ENDPOINT:5432/prance\""
  echo ""
  echo "【フロントエンドAPI設定関連】"
  echo "3. AWS API Gateway URLを取得（START_HERE.mdを参照）:"
  echo "   REST API: https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1"
  echo "   WebSocket: wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev"
  echo ""
  echo "4. .env.local と infrastructure/.env を更新:"
  echo "   NEXT_PUBLIC_API_URL=\"https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1\""
  echo "   NEXT_PUBLIC_WS_URL=\"wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev\""
  echo ""
  exit 1
fi
