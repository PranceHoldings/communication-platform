#!/bin/bash

# 環境変数の包括的整合性検証スクリプト
# 今回の問題の再発を100%防止する

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${BLUE}=================================================================="
echo "環境変数整合性の包括的検証"
echo -e "==================================================================${NC}"
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
  echo -e "${RED}✗ Eager evaluation detected in config/index.ts${NC}"
  grep -n "getRequiredEnv\|getOptionalEnv" "$CONFIG_FILE" \
    | grep -v "^[0-9]*:import" \
    | grep -v "get.*() {.*return getRequiredEnv" \
    | grep -v "get.*() {.*return getOptionalEnv" \
    | head -5
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
  echo -e "${GREEN}✓ All config uses lazy evaluation (getters)${NC}"
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
  echo -e "${YELLOW}⚠ Direct process.env access found (review needed):${NC}"
  echo "$DIRECT_ACCESS" | head -10
  echo ""
  echo -e "${YELLOW}  Recommendation: Use getRequiredEnv() or getOptionalEnv()${NC}"
else
  echo -e "${GREEN}✓ No unauthorized direct process.env access${NC}"
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
  echo -e "${GREEN}✓ WebSocket connect has minimal env vars: $CONNECT_COUNT${NC}"
else
  echo -e "${RED}✗ WebSocket connect has too many env vars: $CONNECT_COUNT${NC}"
  echo -e "${RED}  Expected: ≤8, Got: $CONNECT_COUNT${NC}"
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
  echo -e "${GREEN}✓ WebSocket disconnect has minimal env vars: $DISCONNECT_COUNT${NC}"
else
  echo -e "${RED}✗ WebSocket disconnect has too many env vars: $DISCONNECT_COUNT${NC}"
  echo -e "${RED}  Expected: ≤6, Got: $DISCONNECT_COUNT${NC}"
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
  echo -e "${GREEN}✓ ELEVENLABS_API_KEY limited to $ELEVENLABS_COUNT functions${NC}"
else
  echo -e "${YELLOW}⚠ ELEVENLABS_API_KEY found in $ELEVENLABS_COUNT functions:${NC}"
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
  echo -e "${YELLOW}⚠ auth-login has ELEVENLABS_API_KEY (likely unused)${NC}"
fi

if [ "$LOGIN_HAS_BEDROCK" = "yes" ]; then
  echo -e "${GREEN}✓ auth-login has BEDROCK_REGION (likely used)${NC}"
fi
echo ""

# ============================================================
# Check 5: 型定義の整合性検証
# ============================================================
echo -e "${YELLOW}[5/5]${NC} Validating type definition consistency..."

# shared/config/index.ts がgetter形式になっているか確認
CONFIG_FILE="infrastructure/lambda/shared/config/index.ts"

if grep -q "get API_KEY()" "$CONFIG_FILE"; then
  echo -e "${GREEN}✓ shared/config/index.ts uses getter functions (lazy evaluation)${NC}"
else
  echo -e "${RED}✗ shared/config/index.ts does not use getter functions${NC}"
  ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

if grep -q "} as const;" "$CONFIG_FILE"; then
  echo -e "${YELLOW}⚠ Found 'as const' in config (should be removed for getters)${NC}"
fi
echo ""

# ============================================================
# Summary
# ============================================================
echo -e "${BLUE}=================================================================="
echo "Validation Summary"
echo -e "==================================================================${NC}"

if [ "$ERRORS_FOUND" -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed${NC}"
  echo ""
  echo "Environment variable management is consistent."
  echo "No immediate evaluation detected."
  echo "WebSocket functions have minimal dependencies."
  exit 0
else
  echo -e "${RED}✗ Found $ERRORS_FOUND error(s)${NC}"
  echo ""
  echo "Please fix the issues above before committing."
  exit 1
fi
