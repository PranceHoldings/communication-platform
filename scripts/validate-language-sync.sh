#!/bin/bash
# ==============================================================================
# Language List Synchronization Validation (v2 - Using Shared Library)
# ==============================================================================
# Purpose: Ensure language lists are synchronized across:
#   1. Frontend config (apps/web/lib/i18n/config.ts)
#   2. Lambda config (infrastructure/lambda/shared/config/language-config.ts)
#   3. Message directories (apps/web/messages/)
# Usage: bash scripts/validate-language-sync-v2.sh
# ==============================================================================

# Source shared libraries
source "$(dirname "$0")/lib/common.sh"

log_section "言語リスト同期検証スクリプト"

# ==============================================================================
# Step 1: Extract Frontend language codes
# ==============================================================================

log_step "1" "フロントエンド言語コード抽出"

FRONTEND_LANGS=$(grep "^  '" "apps/web/lib/i18n/config.ts" | \
  tr -d "'," | awk '{print $1}' | sort)
FRONTEND_COUNT=$(echo "$FRONTEND_LANGS" | wc -l)

log_info "Found: ${FRONTEND_COUNT} languages"
echo "$FRONTEND_LANGS" | sed 's/^/    - /'

# ==============================================================================
# Step 2: Extract Lambda language codes
# ==============================================================================

log_step "2" "Lambda言語コード抽出"

LAMBDA_LANGS=$(grep "^\s*languageCode: '" "infrastructure/lambda/shared/config/language-config.ts" | \
  cut -d"'" -f2 | sort)
LAMBDA_COUNT=$(echo "$LAMBDA_LANGS" | wc -l)

log_info "Found: ${LAMBDA_COUNT} languages"
echo "$LAMBDA_LANGS" | sed 's/^/    - /'

# ==============================================================================
# Step 3: Get message directories
# ==============================================================================

log_step "3" "メッセージディレクトリ確認"

MESSAGE_DIRS=$(ls -1 "apps/web/messages/" | grep -v "^\." | sort)
MESSAGE_COUNT=$(echo "$MESSAGE_DIRS" | wc -l)

log_info "Found: ${MESSAGE_COUNT} directories"
echo "$MESSAGE_DIRS" | sed 's/^/    - /'

# ==============================================================================
# Step 4: Compare lists
# ==============================================================================

log_step "4" "リスト比較"
echo ""

# Compare Frontend vs Lambda
DIFF_FL=$(diff <(echo "$FRONTEND_LANGS") <(echo "$LAMBDA_LANGS") || true)
if [ -z "$DIFF_FL" ]; then
  log_success "Frontend と Lambda の言語リストが一致"
  increment_counter PASSED
else
  log_error "Frontend と Lambda の言語リストが不一致"
  echo "$DIFF_FL" | sed 's/^/    /'
  increment_counter ERRORS
fi

# Compare Frontend vs Message directories
DIFF_FM=$(diff <(echo "$FRONTEND_LANGS") <(echo "$MESSAGE_DIRS") || true)
if [ -z "$DIFF_FM" ]; then
  log_success "Frontend config と message directories が一致"
  increment_counter PASSED
else
  log_error "Frontend config と message directories が不一致"
  echo "$DIFF_FM" | sed 's/^/    /'
  increment_counter ERRORS
fi

# Count verification
if [ "$FRONTEND_COUNT" -eq "$LAMBDA_COUNT" ] && [ "$FRONTEND_COUNT" -eq "$MESSAGE_COUNT" ]; then
  log_success "全てのカウントが一致 ($FRONTEND_COUNT languages)"
  increment_counter PASSED
else
  log_error "カウント不一致: Frontend=$FRONTEND_COUNT, Lambda=$LAMBDA_COUNT, Messages=$MESSAGE_COUNT"
  increment_counter ERRORS
fi

# ==============================================================================
# Summary
# ==============================================================================

log_section "検証結果"
print_counter_summary

if [ $ERRORS -eq 0 ]; then
  log_success "全ての言語リストが同期されています"
  exit 0
else
  log_error "同期エラーが見つかりました"
  log_info "修正方法:"
  echo "  1. apps/web/lib/i18n/config.ts の locales 配列を更新"
  echo "  2. infrastructure/lambda/shared/config/language-config.ts の LANGUAGES 配列を更新"
  echo "  3. message ディレクトリが全言語に存在することを確認"
  exit 1
fi
