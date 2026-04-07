#!/bin/bash

# 環境変数検証スクリプト (v3 - Shared Library版)
# このスクリプトは.env.localとinfrastructure/.envが正しく設定されているか検証します

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_section "環境変数検証スクリプト"

# 1. .env.localの存在確認
if [ ! -f ".env.local" ]; then
  log_error ".env.local が見つかりません"
else
  log_success ".env.local 存在確認 OK"
fi

# 2. infrastructure/.envの存在確認
if [ ! -f "infrastructure/.env" ]; then
  log_error "infrastructure/.env が見つかりません"
else
  log_success "infrastructure/.env 存在確認 OK"
fi

log_section "DATABASE_URL検証"

# 3. ローカルPostgreSQL接続文字列の検出
check_localhost_db() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  if grep -q "DATABASE_URL.*localhost:5432\|DATABASE_URL.*@localhost" "$file"; then
    log_error "$name にローカルPostgreSQL接続文字列が含まれています"
    echo -e "${RED}   → このプロジェクトはAWS RDS Aurora Serverless v2専用です${NC}"
    echo -e "${RED}   → DATABASE_URLをAWS RDS接続文字列に変更してください${NC}"
    grep -n "DATABASE_URL" "$file" | head -3
  else
    log_success "$name: ローカルPostgreSQL検出なし"
  fi
}

check_localhost_db ".env.local" ".env.local"
check_localhost_db "infrastructure/.env" "infrastructure/.env"

log_section "AWS RDS接続文字列の検証"

# 4. AWS RDS接続文字列の確認
check_rds_connection() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  if grep -q "DATABASE_URL.*rds\.amazonaws\.com\|DATABASE_URL.*cluster-.*\.us-east-1\.rds\.amazonaws\.com" "$file"; then
    log_success "$name: AWS RDS接続文字列を検出"
  else
    log_warning "$name にAWS RDS接続文字列が見つかりません"
  fi
}

check_rds_connection ".env.local" ".env.local"
check_rds_connection "infrastructure/.env" "infrastructure/.env"

log_section "フロントエンドAPI設定の検証"

# 4.5. NEXT_PUBLIC_*のlocalhost検出
check_frontend_config() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  # NEXT_PUBLIC_API_URLのチェック
  if grep -q "NEXT_PUBLIC_API_URL.*localhost" "$file"; then
    log_error "$name のNEXT_PUBLIC_API_URLがlocalhostを指しています"
    echo -e "${RED}   → このプロジェクトはバックエンドが完全AWS構成です${NC}"
    echo -e "${RED}   → AWS API Gateway URLに変更してください${NC}"
    grep -n "NEXT_PUBLIC_API_URL.*localhost" "$file"
  else
    if grep -q "NEXT_PUBLIC_API_URL.*execute-api.*amazonaws\.com" "$file"; then
      log_success "$name: NEXT_PUBLIC_API_URL はAWS API Gatewayを指しています"
    else
      log_warning "$name にNEXT_PUBLIC_API_URLが見つからないか、形式が不正です"
    fi
  fi

  # NEXT_PUBLIC_WS_URLのチェック
  if grep -q "NEXT_PUBLIC_WS_URL.*localhost" "$file"; then
    log_error "$name のNEXT_PUBLIC_WS_URLがlocalhostを指しています"
    echo -e "${RED}   → このプロジェクトはWebSocketがAWS IoT Core構成です${NC}"
    echo -e "${RED}   → AWS WebSocket URLに変更してください${NC}"
    grep -n "NEXT_PUBLIC_WS_URL.*localhost" "$file"
  else
    if grep -q "NEXT_PUBLIC_WS_URL.*wss://.*execute-api.*amazonaws\.com" "$file"; then
      log_success "$name: NEXT_PUBLIC_WS_URL はAWS WebSocketを指しています"
    else
      log_warning "$name にNEXT_PUBLIC_WS_URLが見つからないか、形式が不正です"
    fi
  fi
}

check_frontend_config ".env.local" ".env.local"
check_frontend_config "infrastructure/.env" "infrastructure/.env"

log_section "必須環境変数の確認"

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
      log_warning "$name に ${var} がありません"
      missing=$((missing + 1))
    fi
  done

  if [ $missing -eq 0 ]; then
    log_success "$name: 全ての必須環境変数が存在"
  fi
}

check_required_vars ".env.local" ".env.local"
check_required_vars "infrastructure/.env" "infrastructure/.env"

# サマリー表示と終了コード判定
log_section "検証結果"

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  log_success "全ての検証に合格しました！"
  print_counter_summary
  exit 0
elif [ "$ERRORS" -eq 0 ]; then
  log_warning "警告が ${WARNINGS} 件あります"
  print_counter_summary
  exit 0
else
  log_error "エラーが ${ERRORS} 件、警告が ${WARNINGS} 件あります"
  print_counter_summary
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
