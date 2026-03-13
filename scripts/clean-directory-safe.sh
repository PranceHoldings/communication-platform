#!/bin/bash

# =============================================================================
# Prance Communication Platform - 統一ディレクトリクリーニングスクリプト v1.0
# =============================================================================
# 用途: 削除困難なディレクトリを安全に削除（.broken-* リネーム戦略）
# 実行方法: ./scripts/clean-directory-safe.sh <directory> [--force]
#
# 戦略:
#   1. 通常削除 (rm -rf)
#   2. sudo削除 (sudo rm -rf)
#   3. リネーム退避 (.broken-{TIMESTAMP})
#   4. 個別ファイル削除 + リネーム
#   5. mv戦略 (移動後に新規作成)
#
# 使用例:
#   ./scripts/clean-directory-safe.sh infrastructure/cdk.out
#   ./scripts/clean-directory-safe.sh apps/web/.next --force
# =============================================================================

set +e  # エラーでも継続

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# タイムスタンプ生成
TIMESTAMP=$(date +%s)

# 引数チェック
if [ $# -lt 1 ]; then
  echo -e "${RED}エラー: ディレクトリパスを指定してください${NC}"
  echo "使用方法: $0 <directory> [--force]"
  exit 1
fi

TARGET_DIR="$1"
FORCE=false

if [ "$2" = "--force" ]; then
  FORCE=true
fi

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

log_retry() {
  echo -e "${MAGENTA}[RETRY]${NC} $1"
}

log_step() {
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# =============================================================================
# メイン削除関数（5段階リトライ + リネーム退避）
# =============================================================================
remove_directory_safe() {
  local target="$1"
  local parent_dir=$(dirname "$target")
  local dir_name=$(basename "$target")

  # ディレクトリが存在しない場合
  if [ ! -e "$target" ]; then
    log_success "ディレクトリは既に存在しません: $target"
    return 0
  fi

  log_step "削除開始: $target"

  # ディレクトリサイズを計算
  if [ -d "$target" ]; then
    local size=$(du -sh "$target" 2>/dev/null | cut -f1)
    log_info "ディレクトリサイズ: $size"
  fi

  # ========================================
  # Strategy 1: 通常削除
  # ========================================
  log_info "[Strategy 1/5] 通常削除を試行"

  if rm -rf "$target" 2>/dev/null; then
    log_success "✓ 通常削除成功"
    return 0
  fi

  log_warning "通常削除失敗、次の戦略を試行..."

  # ========================================
  # Strategy 2: sudo権限で削除
  # ========================================
  log_retry "[Strategy 2/5] sudo権限で削除を試行"

  if sudo rm -rf "$target" 2>/dev/null; then
    log_success "✓ sudo削除成功"
    return 0
  fi

  log_warning "sudo削除失敗、次の戦略を試行..."

  # ========================================
  # Strategy 3: mv戦略（リネームして新規作成）
  # ========================================
  log_retry "[Strategy 3/5] mv戦略（リネーム + 新規作成）を試行"

  local backup_name="${target}.broken-${TIMESTAMP}"

  # 通常mvを試行
  if mv "$target" "$backup_name" 2>/dev/null; then
    log_success "✓ リネーム成功（通常権限）: $backup_name"

    # 元のディレクトリを作成
    if mkdir -p "$target" 2>/dev/null; then
      log_success "✓ 新規ディレクトリ作成成功: $target"
      log_info "退避されたディレクトリ: $backup_name"
      return 0
    else
      log_warning "新規ディレクトリ作成失敗、継続..."
    fi
  fi

  # sudo mvを試行
  if sudo mv "$target" "$backup_name" 2>/dev/null; then
    log_success "✓ リネーム成功（sudo）: $backup_name"

    # 元のディレクトリを作成
    if mkdir -p "$target" 2>/dev/null; then
      log_success "✓ 新規ディレクトリ作成成功: $target"
      log_info "退避されたディレクトリ: $backup_name"
      return 0
    else
      log_warning "新規ディレクトリ作成失敗、継続..."
    fi
  fi

  log_warning "mv戦略失敗、次の戦略を試行..."

  # ========================================
  # Strategy 4: 個別ファイル削除
  # ========================================
  log_retry "[Strategy 4/5] 個別ファイル削除を試行"

  if [ -d "$target" ]; then
    local deleted_count=0
    local failed_count=0
    local total_files=$(find "$target" -type f 2>/dev/null | wc -l)

    log_info "ファイル数: $total_files 個"

    # ファイルを個別に削除
    while IFS= read -r -d '' file; do
      if sudo rm -f "$file" 2>/dev/null; then
        ((deleted_count++))
      else
        ((failed_count++))
      fi

      # 進捗表示（100ファイルごと）
      if [ $((deleted_count % 100)) -eq 0 ] && [ $deleted_count -gt 0 ]; then
        log_info "進捗: $deleted_count/$total_files ファイル削除済み"
      fi
    done < <(find "$target" -type f -print0 2>/dev/null)

    log_info "削除結果: 成功=$deleted_count, 失敗=$failed_count"

    # 空ディレクトリを削除（深い階層から）
    log_info "空ディレクトリを削除中..."
    find "$target" -depth -type d -exec sudo rmdir {} \; 2>/dev/null || true

    # ルートディレクトリが削除できたか確認
    if [ ! -d "$target" ]; then
      log_success "✓ 個別削除成功"
      return 0
    fi

    log_warning "一部ファイル削除後もディレクトリが残っています"
  fi

  # ========================================
  # Strategy 5: 最終手段（リネームのみ）
  # ========================================
  log_retry "[Strategy 5/5] 最終手段: リネームのみ"

  # もう一度別のタイムスタンプで試行
  local final_backup="${target}.broken-${TIMESTAMP}-final"

  if sudo mv "$target" "$final_backup" 2>/dev/null; then
    log_warning "⚠ リネームのみ成功: $final_backup"
    log_info "元のディレクトリを作成..."

    if mkdir -p "$target" 2>/dev/null; then
      log_success "✓ 新規ディレクトリ作成成功"
      log_warning "退避されたディレクトリ（手動削除が必要）: $final_backup"
      return 0
    fi
  fi

  # ========================================
  # すべての戦略が失敗
  # ========================================
  log_error "✗ すべての削除戦略が失敗しました"
  log_error "ディレクトリ: $target"

  echo ""
  log_info "トラブルシューティング:"
  echo "  1. プロセス確認: lsof +D \"$target\" 2>/dev/null | head -10"
  echo "  2. プロセス終了: pkill -f 'node\\|npm\\|next'"
  echo "  3. 再起動後に削除"
  echo "  4. Docker使用中の場合: docker system prune -a"
  echo ""

  return 1
}

# =============================================================================
# メイン実行
# =============================================================================

# 確認プロンプト
if [ "$FORCE" = false ]; then
  echo ""
  echo -e "${YELLOW}警告: 以下のディレクトリを削除します:${NC}"
  echo -e "  ${BLUE}$TARGET_DIR${NC}"
  echo ""

  if [ -d "$TARGET_DIR" ]; then
    local size=$(du -sh "$TARGET_DIR" 2>/dev/null | cut -f1)
    echo -e "  サイズ: ${size}"
    echo ""
  fi

  read -p "続行しますか? (yes/no): " CONFIRM

  if [ "$CONFIRM" != "yes" ]; then
    log_info "キャンセルしました"
    exit 0
  fi
fi

# 削除実行
if remove_directory_safe "$TARGET_DIR"; then
  echo ""
  log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_success "ディレクトリクリーニング完了"
  log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # バックアップディレクトリの情報
  backup_count=$(find "$(dirname "$TARGET_DIR")" -maxdepth 1 -name "$(basename "$TARGET_DIR").broken-*" 2>/dev/null | wc -l)

  if [ "$backup_count" -gt 0 ]; then
    log_warning "退避されたディレクトリ: $backup_count 個"
    find "$(dirname "$TARGET_DIR")" -maxdepth 1 -name "$(basename "$TARGET_DIR").broken-*" 2>/dev/null | sed 's/^/  - /'
    echo ""
    log_info "これらは自動削除されません。手動削除してください。"
    log_info "削除コマンド: find \"$(dirname "$TARGET_DIR")\" -name \"$(basename "$TARGET_DIR").broken-*\" -exec sudo rm -rf {} +"
  fi

  exit 0
else
  echo ""
  log_error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_error "ディレクトリクリーニング失敗"
  log_error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 1
fi
