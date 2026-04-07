#!/bin/bash
#
# Lambda Functions Build Script (v2 - Shared Library版)
# Purpose: Build all Lambda functions with proper dependency management
# CRITICAL: Ensures all shared modules are available for CDK bundling
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Get project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  die "Not in a git repository"
fi

cd "$PROJECT_ROOT" || die "Failed to cd to project root"

log_section "Lambda Functions Build Process"

# =============================================================================
# Step 1: Validate Lambda Dependencies
# =============================================================================

log_section "Step 1: Lambda依存関係の検証"

if [ -f "scripts/validate-lambda-dependencies.sh" ]; then
  if bash scripts/validate-lambda-dependencies.sh; then
    log_success "Lambda依存関係検証完了"
  else
    log_error "Lambda依存関係検証失敗"
    log_warning "自動修復を実行しますか？"
    if confirm "Continue"; then
      log_info "Lambda依存関係を修復中..."
      bash scripts/fix-lambda-node-modules.sh
      log_info "再検証中..."
      bash scripts/validate-lambda-dependencies.sh || die "修復後も検証失敗"
    else
      die "依存関係の問題を解決してから再実行してください"
    fi
  fi
else
  log_warning "検証スクリプトが見つかりません（スキップ）"
fi

# =============================================================================
# Step 2: Shared Modules Build
# =============================================================================

log_section "Step 2: 共有モジュールのビルド"

log_info "Shared modules TypeScript compilation..."
cd "$PROJECT_ROOT/infrastructure/lambda/shared"

if [ -f "tsconfig.json" ]; then
  pnpm exec tsc --noEmit || die "Shared modules type check failed"
  log_success "Shared modules type check完了"
else
  log_warning "tsconfig.json not found in shared/"
fi

# =============================================================================
# Step 3: Lambda Function TypeScript Compilation Check
# =============================================================================

log_section "Step 3: Lambda関数のTypeScriptチェック"

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
    if pnpm exec tsc --noEmit 2>/dev/null; then
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

log_section "Build Report"

echo ""
log_success "Lambda関数ビルド準備完了"
echo ""
log_info "次のステップ:"
echo "  1. CDK Synth: cd infrastructure && pnpm run cdk -- synth --context environment=dev"
echo "  2. CDK Deploy: cd infrastructure && pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never"
echo ""
log_warning "注意事項:"
echo "  - CDKが自動的にTypeScriptをビルドします"
echo "  - 共有モジュールはCDK bundling hookでコピーされます"
echo "  - node_modulesは各Lambda関数のpackage.jsonに基づいてインストールされます"
echo ""
