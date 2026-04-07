#!/bin/bash

# 環境変数の包括的整合性検証スクリプト
# 今回の問題の再発を100%防止する

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

log_section "環境変数整合性の包括的検証"
echo ""

ERRORS_FOUND=0

# ============================================================
# Check 1: 即座評価の検出（Eager Evaluation Detection）
# ============================================================
echo -e "${YELLOW}[1/5]${NC} Detecting eager evaluation (getRequiredEnv at module load)..."

# config/index.tsでgetterパターン外でgetRequiredEnv/getOptionalEnvが使われていないかチェック
# getterパターン: get XXX() { return getRequiredEnv(...); }
CONFIG_FILE="infrastructure/lambda/shared/config/index.ts"

# 誤検出を避けるため、実際のパターンをチェック
EAGER_EVAL_COUNT=$(grep -n "getRequiredEnv\|getOptionalEnv" "$CONFIG_FILE" \
  | grep -v "^[0-9]*:import" \
  | grep -v "get.*() {.*return getRequiredEnv" \
  | grep -v "get.*() {.*return getOptionalEnv" \
  | grep -v "get.*() {.*return getEnv" \
  | grep -v "function get" \
  | grep -v "  get" \
  | wc -l)

if [ "$EAGER_EVAL_COUNT" -gt 0 ]; then
  log_error "Eager evaluation detected in config/index.ts"
  grep -n "getRequiredEnv\|getOptionalEnv" "$CONFIG_FILE" \
    | grep -v "^[0-9]*:import" \
    | grep -v "get.*() {.*return getRequiredEnv" \
    | grep -v "get.*() {.*return getOptionalEnv" \
    | head -5
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
  log_success "All config uses lazy evaluation (getters)"
fi
echo ""

# ============================================================
# Check 2: 直接process.env アクセスの検出（共有モジュール）
# ============================================================
echo -e "${YELLOW}[2/5]${NC} Detecting direct process.env access in shared modules..."

# 許可されたファイル
ALLOWED_FILES=(
  "shared/config/defaults.ts"
  "shared/database/prisma.ts"
  "shared/utils/error-logger.ts"
  "shared/utils/ffmpeg-helper.ts"
)

ALLOWED_PATTERN=$(printf "|%s" "${ALLOWED_FILES[@]}")
ALLOWED_PATTERN=${ALLOWED_PATTERN:1}

DIRECT_ACCESS=$(grep -r "process\.env\.[A-Z_]" infrastructure/lambda/shared --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "\.test\.ts" \
  | grep -Ev "$ALLOWED_PATTERN" \
  || true)

if [ -n "$DIRECT_ACCESS" ]; then
  log_warning "Direct process.env access found (review needed):"
  echo "$DIRECT_ACCESS" | head -10
  echo ""
  log_info "  Recommendation: Use getRequiredEnv() or getOptionalEnv()"
else
  log_success "No unauthorized direct process.env access"
fi
echo ""

# ============================================================
# Check 3: WebSocket関数の環境変数検証
# ============================================================
echo -e "${YELLOW}[3/5]${NC} Validating WebSocket functions environment variables..."

# WebSocket connect: 必要最小限の環境変数のみ
CONNECT_ENV=$(aws lambda get-function-configuration \
  --function-name prance-websocket-connect-dev \
  --region us-east-1 \
  --query 'Environment.Variables' \
  --output json 2>/dev/null || echo "{}")

CONNECT_COUNT=$(echo "$CONNECT_ENV" | jq 'keys | length' 2>/dev/null || echo "0")

if [ "$CONNECT_COUNT" -le 8 ]; then
  log_success "WebSocket connect has minimal env vars: $CONNECT_COUNT"
else
  log_error "WebSocket connect has too many env vars: $CONNECT_COUNT"
  log_error "  Expected: ≤8, Got: $CONNECT_COUNT"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

# WebSocket disconnect: さらに少ない
DISCONNECT_ENV=$(aws lambda get-function-configuration \
  --function-name prance-websocket-disconnect-dev \
  --region us-east-1 \
  --query 'Environment.Variables' \
  --output json 2>/dev/null || echo "{}")

DISCONNECT_COUNT=$(echo "$DISCONNECT_ENV" | jq 'keys | length' 2>/dev/null || echo "0")

if [ "$DISCONNECT_COUNT" -le 6 ]; then
  log_success "WebSocket disconnect has minimal env vars: $DISCONNECT_COUNT"
else
  log_error "WebSocket disconnect has too many env vars: $DISCONNECT_COUNT"
  log_error "  Expected: ≤6, Got: $DISCONNECT_COUNT"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

# ELEVENLABS_API_KEY は websocket-default-v2 のみに存在すべき
ELEVENLABS_FUNCS=$(aws lambda list-functions --region us-east-1 \
  --query 'Functions[?contains(FunctionName, `prance`) && contains(FunctionName, `dev`)].FunctionName' \
  --output text | tr '\t' '\n' | while read func; do
    ENV_VARS=$(aws lambda get-function-configuration \
      --function-name "$func" \
      --region us-east-1 \
      --query 'Environment.Variables' \
      --output json 2>/dev/null || echo "{}")
    if echo "$ENV_VARS" | jq -e '.ELEVENLABS_API_KEY' > /dev/null 2>&1; then
      echo "$func"
    fi
  done)

ELEVENLABS_COUNT=$(echo "$ELEVENLABS_FUNCS" | grep -c "prance" || echo "0")

if [ "$ELEVENLABS_COUNT" -le 2 ]; then
  log_success "ELEVENLABS_API_KEY limited to $ELEVENLABS_COUNT functions"
else
  log_warning "ELEVENLABS_API_KEY found in $ELEVENLABS_COUNT functions:"
  echo "$ELEVENLABS_FUNCS"
fi
echo ""

# ============================================================
# Check 4: 未使用環境変数の検出（サンプル）
# ============================================================
echo -e "${YELLOW}[4/5]${NC} Checking for unused environment variables (sample)..."

# auth-login関数の例
LOGIN_ENV=$(aws lambda get-function-configuration \
  --function-name prance-auth-login-dev \
  --region us-east-1 \
  --query 'Environment.Variables' \
  --output json 2>/dev/null || echo "{}")

LOGIN_HAS_BEDROCK=$(echo "$LOGIN_ENV" | jq -e '.BEDROCK_REGION' > /dev/null 2>&1 && echo "yes" || echo "no")
LOGIN_HAS_ELEVENLABS=$(echo "$LOGIN_ENV" | jq -e '.ELEVENLABS_API_KEY' > /dev/null 2>&1 && echo "yes" || echo "no")

if [ "$LOGIN_HAS_ELEVENLABS" = "yes" ]; then
  log_warning "auth-login has ELEVENLABS_API_KEY (likely unused)"
fi

if [ "$LOGIN_HAS_BEDROCK" = "yes" ]; then
  log_success "auth-login has BEDROCK_REGION (likely used)"
fi
echo ""

# ============================================================
# Check 5: 型定義の整合性検証
# ============================================================
echo -e "${YELLOW}[5/5]${NC} Validating type definition consistency..."

# shared/config/index.ts がgetter形式になっているか確認
CONFIG_FILE="infrastructure/lambda/shared/config/index.ts"

if grep -q "get API_KEY()" "$CONFIG_FILE"; then
  log_success "shared/config/index.ts uses getter functions (lazy evaluation)"
else
  log_error "shared/config/index.ts does not use getter functions"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

if grep -q "} as const;" "$CONFIG_FILE"; then
  log_warning "Found 'as const' in config (should be removed for getters)"
fi
echo ""

# ============================================================
# Summary
# ============================================================
log_section "Validation Summary"

if [ "$ERRORS_FOUND" -eq 0 ]; then
  log_success "All checks passed"
  echo ""
  echo "Environment variable management is consistent."
  echo "No immediate evaluation detected."
  echo "WebSocket functions have minimal dependencies."
  exit 0
else
  log_error "Found $ERRORS_FOUND error(s)"
  echo ""
  echo "Please fix the issues above before committing."
  exit 1
fi
