#!/bin/bash

# =============================================================================
# Prance Communication Platform - デプロイ前チェックスクリプト
# =============================================================================
# 用途: デプロイ前に必須条件を検証
# 実行方法: ./scripts/pre-deploy-check.sh [--environment dev|staging|production]
# =============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 環境指定（デフォルト: dev）
ENVIRONMENT="dev"
if [ "$1" == "--environment" ] && [ -n "$2" ]; then
  ENVIRONMENT="$2"
fi

# Reset counters (PASSED=success, FAILED=failures, WARNINGS=warnings)
reset_counters

# チェック結果記録 (use shared library functions)
pass_check() {
  log_success "$1"
  increment_counter PASSED
}

fail_check() {
  log_error "$1"
  increment_counter FAILED
}

warn_check() {
  log_warning "$1"
  increment_counter WARNINGS
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
  log_info "pnpm run build を実行してください"
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
  log_info "  2. pnpm exec prisma migrate dev --name <変更内容>"
  log_info "  3. pnpm exec prisma generate"
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
  if pnpm list "$package" --depth=0 > /dev/null 2>&1; then
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
  log_info "pnpm install を実行してください"
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
  log_info "初回デプロイ前に実行: cd infrastructure && pnpm exec cdk bootstrap"
fi

# =============================================================================
# Check 9: コード整合性検証（ハードコード検出）
# =============================================================================
log_section "Check 9: コード整合性検証"

log_info "ハードコードされた言語コード、リージョン、設定値を検出中..."

# consistency:validate を実行（TypeScript型整合性チェック）
if pnpm run consistency:validate > /dev/null 2>&1; then
  pass_check "TypeScript型整合性チェック passed"
else
  fail_check "TypeScript型整合性に問題があります"
  log_info "詳細: pnpm run consistency:validate を実行してください"
fi

# detect-inconsistencies.sh を実行（ハードコード検出）
TEMP_REPORT=$(mktemp)
if bash scripts/detect-inconsistencies.sh > "$TEMP_REPORT" 2>&1; then
  # レポートから問題数を取得
  TOTAL_ISSUES=$(grep "合計問題数:" "$TEMP_REPORT" | grep -o "[0-9]*" | head -1 || echo "0")

  if [ "$TOTAL_ISSUES" -eq 0 ]; then
    pass_check "ハードコード検出: 0件"
  else
    fail_check "ハードコードが検出されました: $TOTAL_ISSUES 件"
    log_info "詳細: pnpm run consistency:check でレポートを確認してください"
    log_info "自動修正: pnpm run consistency:fix を実行"
  fi
else
  warn_check "ハードコード検出スクリプトの実行に失敗しました"
fi
rm -f "$TEMP_REPORT"

# =============================================================================
# Check 10: Infrastructure (CDK) TypeScriptコンパイルチェック
# =============================================================================
log_section "Check 10: Infrastructure (CDK) TypeScriptコンパイルチェック"

log_info "Infrastructure (CDK) のTypeScriptコンパイルエラーを検出中..."

if cd infrastructure && pnpm exec tsc --noEmit > /dev/null 2>&1; then
  cd ..
  pass_check "Infrastructure (CDK) TypeScriptコンパイルチェック passed"
else
  cd ..
  fail_check "Infrastructure (CDK) にTypeScriptコンパイルエラーがあります"
  log_info "詳細: cd infrastructure && pnpm exec tsc --noEmit を実行してください"
fi

# =============================================================================
# Check 11: Lambda関数のworkspace依存関係チェック
# =============================================================================
log_section "Check 11: Lambda関数のworkspace依存関係チェック"

log_info "Lambda関数内の@prance/shared importを検出中..."

# Lambda関数内で@prance/sharedをimportしている箇所を検出（.d.tsファイルとコメント行は除外）
WORKSPACE_IMPORTS=$(grep -r "from '@prance/shared'" infrastructure/lambda --include="*.ts" --exclude="*.d.ts" | grep -v "//" | wc -l)

if [ "$WORKSPACE_IMPORTS" -eq 0 ]; then
  pass_check "Lambda関数でworkspace依存関係は使用されていません"
else
  fail_check "Lambda関数で@prance/sharedが使用されています（${WORKSPACE_IMPORTS}箇所）"
  log_info "Lambda関数はworkspace:*依存関係を使用できません"
  log_info "検出された箇所:"
  grep -rn "from '@prance/shared'" infrastructure/lambda --include="*.ts" --exclude="*.d.ts" | grep -v "//" | head -5
  log_info ""
  log_info "対応方法:"
  log_info "  1. 共有コードを infrastructure/lambda/shared/ にコピーする"
  log_info "  2. または、ハードコードした定数配列を使用する"
  log_info "  例: const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', ...] // From: language-config.ts"
fi

# =============================================================================
# Check 12: i18n翻訳キー検証（CRITICAL）
# =============================================================================
log_section "Check 12: i18n翻訳キー検証"

log_info "コードで使用されている翻訳キーの存在確認中..."

if [ -f "./scripts/validate-i18n-keys.sh" ]; then
  # Run in strict mode (no --warn flag) for deployment
  if bash ./scripts/validate-i18n-keys.sh > /tmp/i18n-validation.log 2>&1; then
    pass_check "全ての翻訳キーが言語リソースファイルに存在します"
  else
    fail_check "翻訳キーの検証に失敗しました"
    log_info "詳細:"
    tail -30 /tmp/i18n-validation.log | sed 's/^/    /'
    log_info ""
    log_info "対応方法:"
    log_info "  1. 欠けている翻訳キーを apps/web/messages/<lang>/<category>.json に追加"
    log_info "  2. 詳細確認: pnpm run validate:i18n-keys"
    log_info "  3. 開発中は警告のみ: bash scripts/validate-i18n-keys.sh --warn"
  fi
else
  warn_check "i18n検証スクリプトが見つかりません"
fi

# =============================================================================
# Check 13: UI設定項目とデータベース同期検証（CRITICAL）
# =============================================================================
log_section "Check 13: UI設定項目とデータベース同期検証"

log_info "UI設定可能項目のデータベース保存・取得の整合性を検証中..."

if [ -f "./scripts/validate-ui-settings-sync.sh" ]; then
  if bash ./scripts/validate-ui-settings-sync.sh > /tmp/ui-settings-validation.log 2>&1; then
    pass_check "全てのUI設定項目が正しく同期されています"
  else
    fail_check "UI設定項目の同期に問題があります"
    log_info "詳細:"
    tail -50 /tmp/ui-settings-validation.log | sed 's/^/    /'
    log_info ""
    log_info "対応方法:"
    log_info "  1. GET APIの select にフィールドを追加"
    log_info "  2. UPDATE/CREATE APIの body抽出と updateData にフィールドを追加"
    log_info "  3. 組織設定 DEFAULT_SETTINGS にデフォルト値を追加（該当する場合）"
    log_info "  4. 詳細ガイド: docs/07-development/UI_SETTINGS_DATABASE_SYNC_RULES.md"
  fi
else
  warn_check "UI設定同期検証スクリプトが見つかりません"
fi

# =============================================================================
# サマリー
# =============================================================================
log_section "チェック結果サマリー"

echo ""
echo -e "${GREEN}✓ 成功: $PASSED${NC}"
echo -e "${YELLOW}⚠ 警告: $WARNINGS${NC}"
echo -e "${RED}✗ 失敗: $FAILED${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  print_separator "━" 42
  echo -e "${RED}デプロイ前チェック失敗${NC}"
  print_separator "━" 42
  echo ""
  log_error "デプロイ前に上記の問題を解決してください"
  exit 1
else
  print_separator "━" 42
  echo -e "${GREEN}デプロイ前チェック完了 ✓${NC}"
  print_separator "━" 42
  echo ""
  log_success "デプロイ可能です"
  echo ""
  log_info "次のステップ:"
  echo -e "  ${GREEN}cd infrastructure && ./deploy.sh $ENVIRONMENT${NC}"
  echo ""

  if [ "$WARNINGS" -gt 0 ]; then
    log_warning "警告がありますが、デプロイは可能です"
  fi

  exit 0
fi
