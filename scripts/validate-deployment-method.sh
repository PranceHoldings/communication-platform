#!/bin/bash
# ==============================================================================
# Deployment Method Validation Script (v2 - Using Shared Library)
# ==============================================================================
# Purpose: Prevent manual zip upload to Lambda
# Usage: bash scripts/validate-deployment-method-v2.sh
# ==============================================================================

# Source shared libraries
source "$(dirname "$0")/lib/common.sh"

log_section "デプロイメント方法検証スクリプト"

# ==============================================================================
# Check 1: Manual zip files
# ==============================================================================

log_step "1" "Lambda ディレクトリ内の手動 zip ファイル確認"

ZIP_FILES=$(find infrastructure/lambda -name "*.zip" -o -name "lambda-deployment.zip" 2>/dev/null || true)

if [ -n "$ZIP_FILES" ]; then
  log_error "手動 zip ファイルが検出されました"
  echo ""
  echo "Found zip files:"
  echo "$ZIP_FILES"
  echo ""
  log_error "手動 zip アップロードは禁止されています"
  echo ""
  log_info "理由:"
  echo "  - TypeScript ファイル (.ts) が JavaScript (.js) に変換されていない"
  echo "  - Lambda Runtime は .js ファイルを期待 → Runtime.ImportModuleError"
  echo "  - esbuild bundling プロセスがスキップされている"
  echo ""
  log_info "正しいデプロイ方法:"
  echo "  cd infrastructure && pnpm run deploy:lambda"
  echo ""
  log_info "zip ファイルを削除するには:"
  echo "  find infrastructure/lambda -name '*.zip' -delete"
  echo ""
  increment_counter ERRORS
else
  log_success "手動 zip ファイルは見つかりませんでした"
  increment_counter PASSED
fi

# ==============================================================================
# Check 2: CDK output directory
# ==============================================================================

log_step "2" "CDK 出力ディレクトリ確認"

if [ -d "infrastructure/cdk.out" ]; then
  CDK_AGE=$(find infrastructure/cdk.out -name "*.template.json" -mmin +60 2>/dev/null | wc -l)
  if [ "$CDK_AGE" -gt 0 ]; then
    log_warning "CDK 出力が60分以上前のものです"
    log_info "  キャッシュクリアを検討: rm -rf infrastructure/cdk.out"
    increment_counter WARNINGS
  else
    log_success "CDK 出力は最新です"
    increment_counter PASSED
  fi
else
  log_success "CDK 出力ディレクトリなし（クリーン状態）"
  increment_counter PASSED
fi

# ==============================================================================
# Check 3: Deployment documentation
# ==============================================================================

log_step "3" "デプロイメントプロセスドキュメント検証"

if ! grep -q "手動zipアップロード絶対禁止" memory/deployment-rules.md 2>/dev/null; then
  log_warning "deployment-rules.md の更新が必要な可能性があります"
  increment_counter WARNINGS
else
  log_success "デプロイメントルールがドキュメント化されています"
  increment_counter PASSED
fi

# ==============================================================================
# Summary
# ==============================================================================

log_section "検証結果"
print_counter_summary

if [ $ERRORS -gt 0 ]; then
  log_error "検証に失敗しました"
  echo ""
  log_info "手動 zip ファイルをデプロイ前に削除してください"
  log_info "CDK デプロイメントプロセスのみを使用してください"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  log_warning "警告付きで検証に合格しました"
  echo ""
  log_info "続行可能ですが、上記の警告を確認してください"
  exit 0
else
  log_success "全ての検証に合格しました"
  echo ""
  log_info "デプロイメント方法は正しいです"
  log_info "次のステップ: cd infrastructure && pnpm run deploy:lambda"
  exit 0
fi
