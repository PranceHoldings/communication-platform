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
  echo "1. AWS RDS接続情報を取得:"
  echo "   aws secretsmanager get-secret-value --secret-id \$(aws cloudformation describe-stacks --stack-name Prance-dev-Database --query 'Stacks[0].Outputs[?OutputKey==\`SecretArn\`].OutputValue' --output text)"
  echo ""
  echo "2. .env.local と infrastructure/.env を更新:"
  echo "   DATABASE_URL=\"postgresql://USERNAME:PASSWORD@RDS_ENDPOINT:5432/prance\""
  echo ""
  exit 1
fi
