#!/bin/bash

# =============================================================================
# Prance Communication Platform - デプロイ前チェックスクリプト
# =============================================================================
# 用途: デプロイ前に必須条件を検証
# 実行方法: ./scripts/pre-deploy-check.sh [--environment dev|staging|production]
# =============================================================================

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 環境指定（デフォルト: dev）
ENVIRONMENT="dev"
if [ "$1" == "--environment" ] && [ -n "$2" ]; then
  ENVIRONMENT="$2"
fi

# ヘルパー関数
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# チェック結果記録
pass_check() {
  log_success "$1"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

fail_check() {
  log_error "$1"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

warn_check() {
  log_warning "$1"
  CHECKS_WARNING=$((CHECKS_WARNING + 1))
}

# =============================================================================
# Check 1: 環境変数検証
# =============================================================================
log_section "Check 1: 環境変数検証"

if [ -f "./scripts/validate-env.sh" ]; then
  if ./scripts/validate-env.sh > /dev/null 2>&1; then
    pass_check "環境変数が正しく設定されています"
  else
    fail_check "環境変数に問題があります"
    log_info "詳細: ./scripts/validate-env.sh を実行してください"
  fi
else
  warn_check "環境変数検証スクリプトが見つかりません"
fi

# =============================================================================
# Check 2: AWS認証確認
# =============================================================================
log_section "Check 2: AWS認証確認"

if aws sts get-caller-identity > /dev/null 2>&1; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  pass_check "AWS認証成功（Account: $ACCOUNT_ID）"
else
  fail_check "AWS認証に失敗しました"
  log_info "aws configure または環境変数を確認してください"
fi

# =============================================================================
# Check 3: ビルド成果物確認
# =============================================================================
log_section "Check 3: ビルド成果物確認"

# Infrastructure
if [ -f "infrastructure/lib/api-lambda-stack.js" ]; then
  pass_check "Infrastructure ビルド成果物が存在します"
else
  fail_check "Infrastructure ビルド成果物が見つかりません"
  log_info "npm run build を実行してください"
fi

# Web
if [ -d "apps/web/.next/server" ]; then
  pass_check "Web (Next.js) ビルド成果物が存在します"
else
  warn_check "Web ビルド成果物が見つかりません（デプロイには不要）"
fi

# =============================================================================
# Check 4: Prismaスキーマ変更確認
# =============================================================================
log_section "Check 4: Prismaスキーマ変更確認"

if git diff HEAD -- packages/database/prisma/schema.prisma | grep -q "^[+-]"; then
  warn_check "Prismaスキーマに変更があります"
  log_info "マイグレーション必須手順:"
  log_info "  1. cd packages/database"
  log_info "  2. npx prisma migrate dev --name <変更内容>"
  log_info "  3. npx prisma generate"
  log_info "  4. Lambda関数デプロイ後、マイグレーション実行"
else
  pass_check "Prismaスキーマに変更はありません"
fi

# =============================================================================
# Check 5: Git状態確認
# =============================================================================
log_section "Check 5: Git状態確認"

# 未コミットの変更
MODIFIED_FILES=$(git status --short | wc -l)
if [ "$MODIFIED_FILES" -eq 0 ]; then
  pass_check "未コミットの変更はありません"
else
  warn_check "未コミットの変更があります（$MODIFIED_FILES ファイル）"
  log_info "git status で確認してください"
fi

# コミットされていないコミット（ahead）
AHEAD_COMMITS=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
if [ "$AHEAD_COMMITS" -gt 0 ]; then
  warn_check "プッシュされていないコミットがあります（$AHEAD_COMMITS コミット）"
  log_info "デプロイ前に git push を実行することを推奨"
else
  pass_check "全てのコミットがプッシュ済みです"
fi

# =============================================================================
# Check 6: 依存関係の整合性
# =============================================================================
log_section "Check 6: 依存関係の整合性"

# 重要パッケージの確認
CRITICAL_PACKAGES=(
  "@aws-sdk/client-lambda"
  "@types/aws-lambda"
  "@prisma/client"
  "aws-cdk-lib"
)

ALL_PACKAGES_OK=true
for package in "${CRITICAL_PACKAGES[@]}"; do
  if npm ls "$package" --depth=0 > /dev/null 2>&1; then
    : # パッケージ存在
  else
    log_error "  $package が見つかりません"
    ALL_PACKAGES_OK=false
  fi
done

if [ "$ALL_PACKAGES_OK" = true ]; then
  pass_check "全ての重要パッケージが存在します"
else
  fail_check "依存関係に問題があります"
  log_info "npm install を実行してください"
fi

# =============================================================================
# Check 7: Lambda API稼働確認
# =============================================================================
log_section "Check 7: Lambda API稼働確認（$ENVIRONMENT 環境）"

case $ENVIRONMENT in
  dev)
    API_URL="https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health"
    ;;
  staging)
    API_URL="https://staging-api-url/health"  # TODO: 実際のURLに置き換え
    ;;
  production)
    API_URL="https://production-api-url/health"  # TODO: 実際のURLに置き換え
    ;;
esac

if curl -s "$API_URL" | grep -q "healthy"; then
  pass_check "Lambda API が正常に稼働しています"
else
  warn_check "Lambda API からの応答がありません（初回デプロイの場合は正常）"
fi

# =============================================================================
# Check 8: CDK Bootstrap確認
# =============================================================================
log_section "Check 8: CDK Bootstrap確認"

if aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
  pass_check "CDK Bootstrap 実行済み"
else
  warn_check "CDK Bootstrap が実行されていません"
  log_info "初回デプロイ前に実行: cd infrastructure && npx cdk bootstrap"
fi

# =============================================================================
# サマリー
# =============================================================================
log_section "チェック結果サマリー"

echo ""
echo -e "${GREEN}✓ 成功: $CHECKS_PASSED${NC}"
echo -e "${YELLOW}⚠ 警告: $CHECKS_WARNING${NC}"
echo -e "${RED}✗ 失敗: $CHECKS_FAILED${NC}"
echo ""

if [ "$CHECKS_FAILED" -gt 0 ]; then
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}デプロイ前チェック失敗${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  log_error "デプロイ前に上記の問題を解決してください"
  exit 1
else
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}デプロイ前チェック完了 ✓${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  log_success "デプロイ可能です"
  echo ""
  echo -e "${BLUE}次のステップ:${NC}"
  echo -e "  ${GREEN}cd infrastructure && ./deploy.sh $ENVIRONMENT${NC}"
  echo ""

  if [ "$CHECKS_WARNING" -gt 0 ]; then
    log_warning "警告がありますが、デプロイは可能です"
  fi

  exit 0
fi
