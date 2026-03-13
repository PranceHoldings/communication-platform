#!/bin/bash

# =============================================================================
# Prance Communication Platform - クリーンビルドスクリプト v2.1
# =============================================================================
# 用途: 完全にクリーンな状態から確実にビルドを実行
# 実行方法: ./scripts/clean-build.sh [--skip-install] [--skip-validation]
#
# v2.1 新機能:
# - 破損ファイル対策: 削除失敗時に自動リネーム＆退避
# - 個別ディレクトリ処理: 一部失敗でも継続
# - リトライロジック: 複数戦略で削除試行
# =============================================================================

set -e  # エラー時に即座に終了

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# タイムスタンプ生成
TIMESTAMP=$(date +%s)

# オプション解析
SKIP_INSTALL=false
SKIP_VALIDATION=false
for arg in "$@"; do
  case $arg in
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
  esac
done

# ヘルパー関数
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

log_retry() {
  echo -e "${MAGENTA}[RETRY]${NC} $1"
}

# エラーハンドラ
handle_error() {
  log_error "ビルドプロセスがステップ $1 で失敗しました"
  log_info "トラブルシューティング:"
  case $1 in
    "space-cleanup")
      log_info "  - 空白を含むディレクトリが削除できません"
      log_info "  - 手動削除: find . -name \"* *\" -type d"
      log_info "  - 完全クリーン: rm -rf apps/web/.next infrastructure/cdk.out"
      ;;
    "cleanup")
      log_info "  - 開発サーバーを停止: pkill -f 'next dev'"
      log_info "  - 破損ファイルは自動的にリネームされています"
      log_info "  - バックアップ: *.broken-${TIMESTAMP} を確認"
      ;;
    "install")
      log_info "  - ネットワーク接続を確認してください"
      log_info "  - npm cache をクリア: npm cache clean --force"
      log_info "  - package-lock.json を削除して再試行"
      ;;
    "validation")
      log_info "  - 環境変数を確認: ./scripts/validate-env.sh"
      log_info "  - workspaces構成を確認: npm ls --depth=0"
      ;;
    "build")
      log_info "  - 型エラー: 各パッケージのtsconfigを確認"
      log_info "  - 依存関係エラー: npm install を再実行"
      log_info "  - 詳細ログ: /tmp/build-output.log を確認"
      ;;
  esac
  exit 1
}

# =============================================================================
# 堅牢な削除関数（3段階リトライ + リネーム退避）
# =============================================================================

# スペース付きディレクトリ名を修正（" 2" を削除）
fix_space_in_directory_names() {
  local target="$1"

  if [ ! -d "$target" ]; then
    return 0
  fi

  # スペース+数字が付いたディレクトリをリネーム
  cd "$target" 2>/dev/null || return 1

  for item in *" 2" *" 3" *" 4"; do
    if [ -e "$item" ]; then
      # スペース+数字を削除した新しい名前
      new_name=$(echo "$item" | sed 's/ [0-9]$//')
      if [ "$item" != "$new_name" ] && [ -n "$new_name" ]; then
        log_retry "ディレクトリ名修正: '$item' → '$new_name'"
        sudo mv "$item" "$new_name" 2>/dev/null || true
      fi
    fi
  done

  cd - > /dev/null
  return 0
}

# 単一ディレクトリの削除（統一スクリプト使用）
remove_directory_robust() {
  local target="$1"
  local description="$2"

  # ディレクトリが存在しない場合はスキップ
  if [ ! -e "$target" ]; then
    return 0
  fi

  log_info "削除中: $description ($target)"

  # スペース付きディレクトリ名を修正
  fix_space_in_directory_names "$target"

  # 統一スクリプトが存在する場合は使用
  if [ -f "scripts/clean-directory-safe.sh" ]; then
    if bash scripts/clean-directory-safe.sh "$target" --force > /dev/null 2>&1; then
      log_success "  ✓ 統一スクリプトで削除成功"
      return 0
    fi
  fi

  # フォールバック: 従来の方法
  # Strategy 1: 通常削除
  if rm -rf "$target" 2>/dev/null; then
    log_success "  ✓ 通常削除成功"
    return 0
  fi

  log_warning "  通常削除失敗、代替手段を試行..."

  # Strategy 2: sudo権限で削除
  log_retry "Strategy 2: sudo権限で削除"
  if sudo rm -rf "$target" 2>/dev/null; then
    log_success "  ✓ sudo削除成功"
    return 0
  fi

  log_warning "  sudo削除失敗、リネーム戦略に移行..."

  # Strategy 3: リネームして退避（破損ファイル対策）
  log_retry "Strategy 3: リネームして退避"
  local backup_name="${target}.broken-${TIMESTAMP}"

  # 通常mvを試行
  if mv "$target" "$backup_name" 2>/dev/null; then
    log_success "  ✓ リネーム成功: $backup_name"
    mkdir -p "$target" 2>/dev/null
    return 0
  fi

  # sudoでmvを試行
  if sudo mv "$target" "$backup_name" 2>/dev/null; then
    log_success "  ✓ リネーム成功（sudo）: $backup_name"
    mkdir -p "$target" 2>/dev/null
    return 0
  fi

  # Strategy 4: 個別ファイル削除試行
  log_retry "Strategy 4: 個別ファイル削除"
  if [ -d "$target" ]; then
    # ディレクトリ内のファイルを個別に削除試行
    local deleted_count=0
    local failed_count=0

    while IFS= read -r -d '' file; do
      if sudo rm -f "$file" 2>/dev/null; then
        ((deleted_count++))
      else
        ((failed_count++))
      fi
    done < <(find "$target" -type f -print0 2>/dev/null)

    log_info "  個別削除結果: 成功=$deleted_count, 失敗=$failed_count"

    # 空になったディレクトリを削除
    if sudo rm -rf "$target" 2>/dev/null; then
      log_success "  ✓ 空ディレクトリ削除成功"
      return 0
    fi

    # 最終手段: リネーム
    if sudo mv "$target" "$backup_name" 2>/dev/null; then
      log_warning "  ⚠ 一部ファイル削除後、ディレクトリをリネーム: $backup_name"
      mkdir -p "$target" 2>/dev/null
      return 0
    fi
  fi

  # すべての戦略が失敗
  log_error "  ✗ 全ての削除戦略が失敗しました: $target"
  log_warning "  このディレクトリは手動削除が必要です"
  return 1
}

# =============================================================================
# Step 0: 空白文字を含むディレクトリのクリーンアップ (CRITICAL)
# =============================================================================
log_step "Step 0: 空白文字を含むディレクトリの検出・削除"

if [ -f "scripts/clean-space-directories.sh" ]; then
  log_info "実行中: clean-space-directories.sh"
  if bash scripts/clean-space-directories.sh; then
    log_success "空白文字チェック完了"
  else
    log_error "空白文字を含むディレクトリの削除に失敗しました"
    handle_error "space-cleanup"
  fi
else
  log_warning "clean-space-directories.sh が見つかりません（スキップ）"
fi

# =============================================================================
# Step 1: クリーンアップ
# =============================================================================
log_step "Step 1: クリーンアップ（古いビルド成果物・キャッシュ削除）"

cleanup() {
  local cleanup_failed=false

  # node_modules の削除（個別処理）
  log_info "━━━ node_modules の削除 ━━━"

  local node_modules_dirs=(
    "node_modules"
    "apps/web/node_modules"
    "apps/workers/node_modules"
    "packages/shared/node_modules"
    "packages/database/node_modules"
    "infrastructure/node_modules"
  )

  for dir in "${node_modules_dirs[@]}"; do
    if ! remove_directory_robust "$dir" "node_modules"; then
      cleanup_failed=true
    fi
  done

  # ビルド成果物の削除
  log_info "━━━ ビルド成果物の削除 ━━━"

  local build_artifacts=(
    ".next"
    "apps/web/.next"
    "packages/shared/dist"
    "infrastructure/cdk.out"
  )

  for artifact in "${build_artifacts[@]}"; do
    remove_directory_robust "$artifact" "ビルド成果物" || true
  done

  # TypeScript生成ファイル（*.js, *.d.ts）
  log_info "TypeScript生成ファイルの削除..."
  find infrastructure/lib -type f \( -name "*.js" -o -name "*.d.ts" \) -delete 2>/dev/null || true

  # キャッシュの削除
  log_info "━━━ キャッシュの削除 ━━━"

  local cache_dirs=(
    ".turbo"
    "apps/web/.turbo"
    "packages/shared/.turbo"
    "infrastructure/.turbo"
  )

  for cache in "${cache_dirs[@]}"; do
    remove_directory_robust "$cache" "キャッシュ" || true
  done

  # 破損したビルドディレクトリの削除
  log_info "━━━ 古いバックアップ・破損ファイルの削除 ━━━"

  # 古い .broken-* ディレクトリを削除（7日以上前のもの）
  log_info "7日以上前のバックアップを削除中..."
  find . -maxdepth 2 -type d -name "*.broken-*" -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

  # 古い .next.broken-*, .old-* ディレクトリ
  find apps/web -maxdepth 1 -type d \( -name ".next.broken-*" -o -name ".next.old-*" \) -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

  # 現在のバックアップをリスト表示
  local backup_count=$(find . -maxdepth 2 -type d -name "*.broken-${TIMESTAMP}" 2>/dev/null | wc -l)
  if [ "$backup_count" -gt 0 ]; then
    log_warning "今回のクリーンアップで $backup_count 個のディレクトリをリネーム退避しました"
    log_info "バックアップディレクトリ（7日後に自動削除）:"
    find . -maxdepth 2 -type d -name "*.broken-${TIMESTAMP}" 2>/dev/null | sed 's/^/  - /'
  fi

  if [ "$cleanup_failed" = true ]; then
    log_warning "一部のクリーンアップが失敗しましたが、継続します"
  else
    log_success "クリーンアップ完了"
  fi
}

cleanup

# =============================================================================
# Step 2: 依存関係のインストール
# =============================================================================
if [ "$SKIP_INSTALL" = false ]; then
  log_step "Step 2: 依存関係のインストール"

  log_info "プロジェクトルートで npm install 実行中..."
  npm install || handle_error "install"

  log_success "依存関係インストール完了"
else
  log_warning "Step 2: 依存関係インストールをスキップ"
fi

# =============================================================================
# Step 3: 依存関係の検証
# =============================================================================
if [ "$SKIP_VALIDATION" = false ]; then
  log_step "Step 3: 依存関係の検証"

  # 重要なパッケージの存在確認
  log_info "重要なパッケージの検証中..."

  REQUIRED_PACKAGES=(
    "@aws-sdk/client-lambda"
    "@types/aws-lambda"
    "@prisma/client"
    "typescript"
    "next"
  )

  for package in "${REQUIRED_PACKAGES[@]}"; do
    if npm ls "$package" --depth=0 > /dev/null 2>&1; then
      log_success "  ✓ $package"
    else
      log_error "  ✗ $package が見つかりません"
      handle_error "validation"
    fi
  done

  # Prisma Client の生成確認
  log_info "Prisma Client の確認..."
  if [ -d "packages/database/node_modules/.prisma/client" ]; then
    log_success "  ✓ Prisma Client 生成済み"
  else
    log_warning "  Prisma Client が生成されていません。生成中..."
    cd packages/database && npx prisma generate && cd ../..
    log_success "  ✓ Prisma Client 生成完了"
  fi

  log_success "依存関係検証完了"
else
  log_warning "Step 3: 依存関係検証をスキップ"
fi

# =============================================================================
# Step 4: ビルド実行
# =============================================================================
log_step "Step 4: ビルド実行"

log_info "Turboでビルド開始..."
START_TIME=$(date +%s)

npm run build 2>&1 | tee /tmp/build-output.log || {
  log_error "ビルド失敗"
  log_info "エラーログ: /tmp/build-output.log"

  # エラーの種類を特定
  if grep -q "TS[0-9]\+:" /tmp/build-output.log; then
    log_warning "TypeScriptエラーが検出されました:"
    grep "TS[0-9]\+:" /tmp/build-output.log | tail -10
  fi

  if grep -q "Cannot find module" /tmp/build-output.log; then
    log_warning "モジュール解決エラーが検出されました:"
    grep "Cannot find module" /tmp/build-output.log | tail -10
  fi

  handle_error "build"
}

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_success "ビルド完了（所要時間: ${DURATION}秒）"

# =============================================================================
# Step 5: ビルド成果物の確認
# =============================================================================
log_step "Step 5: ビルド成果物の確認"

VERIFICATION_FAILED=false

# Infrastructure
log_info "Infrastructure ビルド成果物..."
if [ -f "infrastructure/lib/api-lambda-stack.js" ]; then
  log_success "  ✓ infrastructure/lib/*.js"
else
  log_error "  ✗ infrastructure/lib/*.js が見つかりません"
  VERIFICATION_FAILED=true
fi

# Web (Next.js)
log_info "Web (Next.js) ビルド成果物..."
if [ -d "apps/web/.next/server" ]; then
  log_success "  ✓ apps/web/.next/"
else
  log_error "  ✗ apps/web/.next/ が見つかりません"
  VERIFICATION_FAILED=true
fi

# Shared
log_info "Shared パッケージ..."
if [ -f "packages/shared/tsconfig.tsbuildinfo" ]; then
  log_success "  ✓ packages/shared ビルド済み"
else
  log_warning "  ⚠ packages/shared/tsconfig.tsbuildinfo が見つかりません"
fi

if [ "$VERIFICATION_FAILED" = true ]; then
  log_error "ビルド成果物の検証に失敗しました"
  exit 1
fi

log_success "ビルド成果物の検証完了"

# =============================================================================
# サマリー
# =============================================================================
log_step "クリーンビルド完了 🎉"

echo ""
echo -e "${GREEN}次のステップ:${NC}"
echo -e "  1. ${BLUE}環境変数検証${NC}: ./scripts/validate-env.sh"
echo -e "  2. ${BLUE}デプロイ前チェック${NC}: ./scripts/pre-deploy-check.sh"
echo -e "  3. ${BLUE}CDKデプロイ${NC}: cd infrastructure && ./deploy.sh dev"
echo ""

log_info "ビルドログ: /tmp/build-output.log"

# バックアップディレクトリの情報
local backup_count=$(find . -maxdepth 2 -type d -name "*.broken-*" 2>/dev/null | wc -l)
if [ "$backup_count" -gt 0 ]; then
  echo ""
  log_warning "削除できなかったディレクトリ: $backup_count 個"
  log_info "これらは7日後に自動削除されます"
  log_info "今すぐ削除する場合: find . -name '*.broken-*' -exec sudo rm -rf {} +"
fi
