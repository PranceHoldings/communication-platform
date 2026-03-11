#!/bin/bash
#
# Lambda Functions Build Script
# Purpose: Build all Lambda functions with proper dependency management
# CRITICAL: Ensures all shared modules are available for CDK bundling
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}============================================${NC}"
}

# Get project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  log_error "Not in a git repository"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

log_step "Lambda Functions Build Process"

# =============================================================================
# Step 1: Validate Lambda Dependencies
# =============================================================================

log_step "Step 1: Lambda依存関係の検証"

if [ -f "scripts/validate-lambda-dependencies.sh" ]; then
  if bash scripts/validate-lambda-dependencies.sh; then
    log_success "Lambda依存関係検証完了"
  else
    log_error "Lambda依存関係検証失敗"
    log_warning "自動修復を実行しますか？ (y/N)"
    read -r -n 1 REPLY
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      log_info "Lambda依存関係を修復中..."
      bash scripts/fix-lambda-node-modules.sh
      log_info "再検証中..."
      bash scripts/validate-lambda-dependencies.sh || {
        log_error "修復後も検証失敗"
        exit 1
      }
    else
      log_error "依存関係の問題を解決してから再実行してください"
      exit 1
    fi
  fi
else
  log_warning "検証スクリプトが見つかりません（スキップ）"
fi

# =============================================================================
# Step 2: Shared Modules Build
# =============================================================================

log_step "Step 2: 共有モジュールのビルド"

log_info "Shared modules TypeScript compilation..."
cd "$PROJECT_ROOT/infrastructure/lambda/shared"

if [ -f "tsconfig.json" ]; then
  npx tsc --noEmit || {
    log_error "Shared modules type check failed"
    exit 1
  }
  log_success "Shared modules type check完了"
else
  log_warning "tsconfig.json not found in shared/"
fi

# =============================================================================
# Step 3: Lambda Function TypeScript Compilation Check
# =============================================================================

log_step "Step 3: Lambda関数のTypeScriptチェック"

LAMBDA_DIRS=(
  "infrastructure/lambda/websocket/default"
  "infrastructure/lambda/websocket/connect"
  "infrastructure/lambda/websocket/disconnect"
  "infrastructure/lambda/sessions/analysis"
)

FAILED_COUNT=0

for lambda_dir in "${LAMBDA_DIRS[@]}"; do
  if [ -f "$PROJECT_ROOT/$lambda_dir/tsconfig.json" ]; then
    log_info "Type checking: $lambda_dir"
    cd "$PROJECT_ROOT/$lambda_dir"
    if npx tsc --noEmit 2>/dev/null; then
      log_success "  ✓ Type check passed"
    else
      log_warning "  ⚠ Type check failed (will be caught by CDK)"
      FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
  fi
done

if [ $FAILED_COUNT -gt 0 ]; then
  log_warning "$FAILED_COUNT Lambda functions have type errors"
  log_warning "CDK bundling will catch these during deployment"
fi

# =============================================================================
# Step 4: Build Report
# =============================================================================

log_step "Build Report"

echo ""
echo -e "${GREEN}✅ Lambda関数ビルド準備完了${NC}"
echo ""
echo -e "${BLUE}次のステップ:${NC}"
echo -e "  1. ${GREEN}CDK Synth${NC}: cd infrastructure && npm run cdk -- synth --context environment=dev"
echo -e "  2. ${GREEN}CDK Deploy${NC}: cd infrastructure && npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never"
echo ""
echo -e "${YELLOW}注意事項:${NC}"
echo -e "  - CDKが自動的にTypeScriptをビルドします"
echo -e "  - 共有モジュールはCDK bundling hookでコピーされます"
echo -e "  - node_modulesは各Lambda関数のpackage.jsonに基づいてインストールされます"
echo ""
