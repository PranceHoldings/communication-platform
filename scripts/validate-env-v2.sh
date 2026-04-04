#!/bin/bash
# ==============================================================================
# Environment Variable Validation Script (v2 - Using Shared Library)
# ==============================================================================
# Purpose: Validate .env.local and infrastructure/.env configuration
# Usage: bash scripts/validate-env-v2.sh
# ==============================================================================

# Source shared libraries
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/validate.sh"

log_section "環境変数検証スクリプト"

# ==============================================================================
# 1. File Existence Check
# ==============================================================================
require_file ".env.local" "環境変数ファイルが見つかりません"
require_file "infrastructure/.env" "インフラ環境変数ファイルが見つかりません"

# ==============================================================================
# 2. DATABASE_URL Validation
# ==============================================================================
log_section "DATABASE_URL検証"

validate_database_url ".env.local"
validate_database_url "infrastructure/.env"

# ==============================================================================
# 3. Frontend API Configuration Validation
# ==============================================================================
log_section "フロントエンドAPI設定の検証"

check_frontend_config() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    return
  fi

  # NEXT_PUBLIC_API_URL check
  if grep -q "NEXT_PUBLIC_API_URL.*localhost" "$file"; then
    log_error "$name のNEXT_PUBLIC_API_URLがlocalhostを指しています"
    log_info "→ AWS API Gateway URLに変更してください"
    grep -n "NEXT_PUBLIC_API_URL.*localhost" "$file"
  else
    if grep -q "NEXT_PUBLIC_API_URL.*execute-api.*amazonaws\.com" "$file"; then
      log_success "$name: NEXT_PUBLIC_API_URL はAWS API Gatewayを指しています"
    else
      log_warning "$name にNEXT_PUBLIC_API_URLが見つからないか、形式が不正です"
    fi
  fi

  # NEXT_PUBLIC_WS_URL check
  if grep -q "NEXT_PUBLIC_WS_URL.*localhost" "$file"; then
    log_error "$name のNEXT_PUBLIC_WS_URLがlocalhostを指しています"
    log_info "→ AWS WebSocket URLに変更してください"
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

# ==============================================================================
# 4. Required Environment Variables Check
# ==============================================================================
log_section "必須環境変数の確認"

REQUIRED_VARS=(
  "AWS_REGION"
  "AWS_ACCOUNT_ID"
  "BEDROCK_MODEL_ID"
  "ELEVENLABS_API_KEY"
  "AZURE_SPEECH_KEY"
  "JWT_SECRET"
  "DATABASE_URL"
)

validate_required_env_vars ".env.local" "${REQUIRED_VARS[@]}"
validate_required_env_vars "infrastructure/.env" "${REQUIRED_VARS[@]}"

# ==============================================================================
# 5. Summary
# ==============================================================================
log_section "検証結果"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  log_success "全ての検証に合格しました！"
  print_counter_summary
  exit 0
elif [ $ERRORS -eq 0 ]; then
  log_warning "警告が ${WARNINGS} 件あります"
  print_counter_summary
  exit 0
else
  log_error "エラーが ${ERRORS} 件、警告が ${WARNINGS} 件あります"
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
  print_counter_summary
  exit 1
fi
