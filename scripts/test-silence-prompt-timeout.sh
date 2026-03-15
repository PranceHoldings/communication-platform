#!/bin/bash

# silencePromptTimeout 機能の自動検証スクリプト
# 使用方法:
#   ./scripts/test-silence-prompt-timeout.sh              # 全フェーズ実行
#   ./scripts/test-silence-prompt-timeout.sh --phase 1    # 特定フェーズのみ実行
#   ./scripts/test-silence-prompt-timeout.sh --auto-only  # Phase 1-5のみ実行

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# プロジェクトルート
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# カウンター
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 結果配列
declare -a FAILED_CHECKS

# テスト結果を記録
log_test() {
  local test_name="$1"
  local result="$2"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  if [ "$result" = "PASS" ]; then
    echo -e "  ${GREEN}✓${NC} $test_name"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_CHECKS+=("$test_name")
  fi
}

# ファイル内の文字列検索
check_file_contains() {
  local file_path="$1"
  local search_pattern="$2"
  local test_name="$3"

  if [ ! -f "$file_path" ]; then
    log_test "$test_name (file not found)" "FAIL"
    return 1
  fi

  if grep -q "$search_pattern" "$file_path"; then
    log_test "$test_name" "PASS"
    return 0
  else
    log_test "$test_name" "FAIL"
    return 1
  fi
}

# 複数パターンの検索（OR条件）
check_file_contains_any() {
  local file_path="$1"
  shift
  local patterns=("$@")
  local last_pattern="${patterns[-1]}"
  unset 'patterns[-1]'
  local test_name="$last_pattern"

  if [ ! -f "$file_path" ]; then
    log_test "$test_name (file not found)" "FAIL"
    return 1
  fi

  for pattern in "${patterns[@]}"; do
    if grep -q "$pattern" "$file_path"; then
      log_test "$test_name" "PASS"
      return 0
    fi
  done

  log_test "$test_name" "FAIL"
  return 1
}

# Phase 1: データモデル整合性検証
test_phase1() {
  echo -e "\n${CYAN}=== Phase 1: データモデル整合性検証 ===${NC}\n"

  # 1.1 Prismaスキーマ定義
  echo -e "${BLUE}1.1 Prismaスキーマ定義${NC}"
  check_file_contains \
    "$PROJECT_ROOT/packages/database/prisma/schema.prisma" \
    "silencePromptTimeout.*Int?" \
    "Prisma schema に silencePromptTimeout フィールドが存在"

  check_file_contains \
    "$PROJECT_ROOT/packages/database/prisma/schema.prisma" \
    '@map("silence_prompt_timeout")' \
    "フィールドが正しくマップされている"

  # 1.2 マイグレーションファイル
  echo -e "\n${BLUE}1.2 マイグレーションファイル${NC}"

  local migration_dir="$PROJECT_ROOT/packages/database/prisma/migrations"
  if [ -d "$migration_dir/20260315084516_add_silence_prompt_timeout" ]; then
    log_test "マイグレーションディレクトリが存在" "PASS"

    local migration_file="$migration_dir/20260315084516_add_silence_prompt_timeout/migration.sql"
    check_file_contains \
      "$migration_file" \
      'ALTER TABLE "scenarios" ADD COLUMN "silence_prompt_timeout" INTEGER' \
      "マイグレーション内容が正しい"
  else
    log_test "マイグレーションディレクトリが存在" "FAIL"
  fi
}

# Phase 2: 型定義の整合性検証
test_phase2() {
  echo -e "\n${CYAN}=== Phase 2: 型定義の整合性検証 ===${NC}\n"

  # 2.1 共有型定義
  echo -e "${BLUE}2.1 共有型定義 (packages/shared)${NC}"
  check_file_contains \
    "$PROJECT_ROOT/packages/shared/src/types/index.ts" \
    "silencePromptTimeout.*number" \
    "OrganizationSettings に silencePromptTimeout が存在"

  # 2.2 Lambda型定義
  echo -e "\n${BLUE}2.2 Lambda型定義${NC}"
  check_file_contains \
    "$PROJECT_ROOT/infrastructure/lambda/shared/types/organization.ts" \
    "silencePromptTimeout.*number" \
    "Lambda OrganizationSettings に silencePromptTimeout が存在"

  # 2.3 フロントエンド型定義
  echo -e "\n${BLUE}2.3 フロントエンド型定義${NC}"
  local scenarios_api="$PROJECT_ROOT/apps/web/lib/api/scenarios.ts"

  check_file_contains \
    "$scenarios_api" \
    "silencePromptTimeout.*number" \
    "Scenario interface に silencePromptTimeout が存在"

  # CreateScenarioRequest と UpdateScenarioRequest も確認
  local count=$(grep -c "silencePromptTimeout.*number" "$scenarios_api" || echo "0")
  if [ "$count" -ge 3 ]; then
    log_test "Scenario, CreateScenarioRequest, UpdateScenarioRequest 全てに存在" "PASS"
  else
    log_test "Scenario, CreateScenarioRequest, UpdateScenarioRequest 全てに存在 (found: $count/3)" "FAIL"
  fi
}

# Phase 3: デフォルト値・バリデーション検証
test_phase3() {
  echo -e "\n${CYAN}=== Phase 3: デフォルト値・バリデーション検証 ===${NC}\n"

  # 3.1 デフォルト値定義（packages/shared）
  echo -e "${BLUE}3.1 デフォルト値定義 (packages/shared)${NC}"
  local shared_defaults="$PROJECT_ROOT/packages/shared/src/defaults.ts"

  check_file_contains \
    "$shared_defaults" \
    "silencePromptTimeout.*15" \
    "DEFAULT_ORGANIZATION_SETTINGS.silencePromptTimeout = 15"

  check_file_contains \
    "$shared_defaults" \
    "silencePromptTimeout.*undefined" \
    "DEFAULT_SCENARIO_SETTINGS.silencePromptTimeout = undefined"

  check_file_contains \
    "$shared_defaults" \
    "silencePromptTimeout.*min.*5.*max.*60" \
    "VALIDATION_RANGES.silencePromptTimeout = { min: 5, max: 60 }"

  # 3.2 デフォルト値定義（Lambda）
  echo -e "\n${BLUE}3.2 デフォルト値定義 (Lambda)${NC}"
  local lambda_defaults="$PROJECT_ROOT/infrastructure/lambda/shared/defaults.ts"

  check_file_contains \
    "$lambda_defaults" \
    "silencePromptTimeout.*15" \
    "Lambda DEFAULT_ORGANIZATION_SETTINGS.silencePromptTimeout = 15"

  check_file_contains \
    "$lambda_defaults" \
    "silencePromptTimeout.*undefined" \
    "Lambda DEFAULT_SCENARIO_SETTINGS.silencePromptTimeout = undefined"

  check_file_contains \
    "$lambda_defaults" \
    "silencePromptTimeout.*min.*5.*max.*60" \
    "Lambda VALIDATION_RANGES.silencePromptTimeout = { min: 5, max: 60 }"
}

# Phase 4: Lambda API実装検証
test_phase4() {
  echo -e "\n${CYAN}=== Phase 4: Lambda API実装検証 ===${NC}\n"

  # 4.1 組織設定API
  echo -e "${BLUE}4.1 組織設定API${NC}"
  local org_settings="$PROJECT_ROOT/infrastructure/lambda/organizations/settings/index.ts"

  check_file_contains \
    "$org_settings" \
    "settings\.silencePromptTimeout.*undefined" \
    "organizations/settings - バリデーション存在"

  check_file_contains \
    "$org_settings" \
    "VALIDATION_RANGES\.silencePromptTimeout" \
    "organizations/settings - 範囲チェック存在"

  # 4.2 シナリオGET API
  echo -e "\n${BLUE}4.2 シナリオGET API${NC}"
  check_file_contains \
    "$PROJECT_ROOT/infrastructure/lambda/scenarios/get/index.ts" \
    "silencePromptTimeout.*true" \
    "scenarios/get - select に含まれる"

  # 4.3 シナリオUPDATE API
  echo -e "\n${BLUE}4.3 シナリオUPDATE API${NC}"
  local scenarios_update="$PROJECT_ROOT/infrastructure/lambda/scenarios/update/index.ts"

  check_file_contains \
    "$scenarios_update" \
    "silencePromptTimeout" \
    "scenarios/update - body抽出"

  check_file_contains \
    "$scenarios_update" \
    "'silencePromptTimeout'.*in.*body" \
    "scenarios/update - updateData に追加"

  check_file_contains \
    "$scenarios_update" \
    "silencePromptTimeout.*true" \
    "scenarios/update - select に含まれる"

  # 4.4 シナリオCREATE API
  echo -e "\n${BLUE}4.4 シナリオCREATE API${NC}"
  local scenarios_create="$PROJECT_ROOT/infrastructure/lambda/scenarios/create/index.ts"

  check_file_contains \
    "$scenarios_create" \
    "silencePromptTimeout" \
    "scenarios/create - body抽出"

  # data オブジェクトに含まれるか確認
  if grep -A 20 "prisma\.scenario\.create" "$scenarios_create" | grep -q "silencePromptTimeout"; then
    log_test "scenarios/create - data に追加" "PASS"
  else
    log_test "scenarios/create - data に追加" "FAIL"
  fi

  check_file_contains \
    "$scenarios_create" \
    "silencePromptTimeout.*true" \
    "scenarios/create - select に含まれる"

  # 4.5 シナリオLIST API
  echo -e "\n${BLUE}4.5 シナリオLIST API${NC}"
  check_file_contains \
    "$PROJECT_ROOT/infrastructure/lambda/scenarios/list/index.ts" \
    "silencePromptTimeout.*true" \
    "scenarios/list - select に含まれる"

  # 4.6 セッションGET API
  echo -e "\n${BLUE}4.6 セッションGET API${NC}"
  check_file_contains \
    "$PROJECT_ROOT/infrastructure/lambda/sessions/get/index.ts" \
    "silencePromptTimeout.*true" \
    "sessions/get - scenario.select に含まれる"
}

# Phase 5: フロントエンドUI実装検証
test_phase5() {
  echo -e "\n${CYAN}=== Phase 5: フロントエンドUI実装検証 ===${NC}\n"

  # 5.1 組織設定画面
  echo -e "${BLUE}5.1 組織設定画面${NC}"
  local settings_page="$PROJECT_ROOT/apps/web/app/dashboard/settings/page.tsx"

  check_file_contains \
    "$settings_page" \
    "silencePromptTimeout.*setSilencePromptTimeout.*useState" \
    "settings/page - state定義"

  # 設定読み込みの確認（より柔軟なパターン）
  if grep -q "settings\.silencePromptTimeout.*undefined" "$settings_page" && \
     grep -q "setSilencePromptTimeout.*settings\.silencePromptTimeout" "$settings_page"; then
    log_test "settings/page - 設定読み込み" "PASS"
  else
    log_test "settings/page - 設定読み込み" "FAIL"
  fi

  # 設定保存の確認（複数行にまたがる可能性があるため柔軟にチェック）
  if grep -A 10 "updateOrganizationSettings" "$settings_page" | grep -q "silencePromptTimeout"; then
    log_test "settings/page - 設定保存" "PASS"
  else
    log_test "settings/page - 設定保存" "FAIL"
  fi

  check_file_contains \
    "$settings_page" \
    "setSilencePromptTimeout.*DEFAULT_ORGANIZATION_SETTINGS\.silencePromptTimeout" \
    "settings/page - デフォルトリセット"

  # UI input要素の確認（複数行にまたがる可能性があるため柔軟にチェック）
  if grep -B 5 -A 5 "silencePromptTimeout" "$settings_page" | grep -q 'type="number"'; then
    log_test "settings/page - UI input要素" "PASS"
  else
    log_test "settings/page - UI input要素" "FAIL"
  fi

  # 5.2 シナリオ詳細画面
  echo -e "\n${BLUE}5.2 シナリオ詳細画面${NC}"
  local scenario_detail="$PROJECT_ROOT/apps/web/app/dashboard/scenarios/[id]/page.tsx"

  check_file_contains \
    "$scenario_detail" \
    "scenario\.silencePromptTimeout.*null.*undefined" \
    "scenarios/[id]/page - 表示ロジック"

  check_file_contains \
    "$scenario_detail" \
    "t.*scenarios\.detail\.silencePromptTimeout" \
    "scenarios/[id]/page - 翻訳キー使用"

  # 5.3 翻訳ファイル
  echo -e "\n${BLUE}5.3 翻訳ファイル${NC}"

  check_file_contains \
    "$PROJECT_ROOT/apps/web/messages/en/settings.json" \
    '"silencePromptTimeout"' \
    "翻訳: en/settings.json - silencePromptTimeout"

  check_file_contains \
    "$PROJECT_ROOT/apps/web/messages/en/settings.json" \
    '"silencePromptTimeoutHelp"' \
    "翻訳: en/settings.json - silencePromptTimeoutHelp"

  check_file_contains \
    "$PROJECT_ROOT/apps/web/messages/ja/settings.json" \
    '"silencePromptTimeout"' \
    "翻訳: ja/settings.json - silencePromptTimeout"

  check_file_contains \
    "$PROJECT_ROOT/apps/web/messages/ja/settings.json" \
    '"silencePromptTimeoutHelp"' \
    "翻訳: ja/settings.json - silencePromptTimeoutHelp"

  check_file_contains \
    "$PROJECT_ROOT/apps/web/messages/en/scenarios.json" \
    '"silencePromptTimeout"' \
    "翻訳: en/scenarios.json - silencePromptTimeout"

  check_file_contains \
    "$PROJECT_ROOT/apps/web/messages/ja/scenarios.json" \
    '"silencePromptTimeout"' \
    "翻訳: ja/scenarios.json - silencePromptTimeout"
}

# サマリー表示
print_summary() {
  echo -e "\n${CYAN}========================================${NC}"
  echo -e "${CYAN}テスト結果サマリー${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "総テスト数: ${BLUE}$TOTAL_TESTS${NC}"
  echo -e "成功: ${GREEN}$PASSED_TESTS${NC}"
  echo -e "失敗: ${RED}$FAILED_TESTS${NC}"

  if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "\n${RED}失敗したテスト:${NC}"
    for check in "${FAILED_CHECKS[@]}"; do
      echo -e "  ${RED}✗${NC} $check"
    done
    echo -e "\n${RED}❌ テストが失敗しました${NC}"
    exit 1
  else
    echo -e "\n${GREEN}✅ 全てのテストが成功しました！${NC}"
    exit 0
  fi
}

# メイン処理
main() {
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}silencePromptTimeout 機能検証${NC}"
  echo -e "${CYAN}========================================${NC}"

  local phase=""
  local auto_only=false

  # 引数解析
  while [[ $# -gt 0 ]]; do
    case $1 in
      --phase)
        phase="$2"
        shift 2
        ;;
      --auto-only)
        auto_only=true
        shift
        ;;
      *)
        echo "Unknown option: $1"
        echo "Usage: $0 [--phase N] [--auto-only]"
        exit 1
        ;;
    esac
  done

  # フェーズ実行
  if [ -n "$phase" ]; then
    case $phase in
      1) test_phase1 ;;
      2) test_phase2 ;;
      3) test_phase3 ;;
      4) test_phase4 ;;
      5) test_phase5 ;;
      *)
        echo -e "${RED}Invalid phase: $phase${NC}"
        echo "Valid phases: 1, 2, 3, 4, 5"
        exit 1
        ;;
    esac
  else
    # 全フェーズ実行
    test_phase1
    test_phase2
    test_phase3
    test_phase4
    test_phase5
  fi

  print_summary
}

main "$@"
