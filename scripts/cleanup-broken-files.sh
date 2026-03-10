#!/bin/bash

# =============================================================================
# Prance Communication Platform - 破損ファイルクリーンアップスクリプト
# =============================================================================
# 用途: 削除できなかった破損ファイル・バックアップディレクトリの強制削除
# 実行方法: ./scripts/cleanup-broken-files.sh [--all] [--force]
#
# オプション:
#   --all    : 全てのバックアップを削除（日数に関わらず）
#   --force  : 確認なしで削除
# =============================================================================

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# オプション解析
DELETE_ALL=false
FORCE=false

for arg in "$@"; do
  case $arg in
    --all)
      DELETE_ALL=true
      shift
      ;;
    --force)
      FORCE=true
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

log_section() {
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# =============================================================================
# Step 1: バックアップディレクトリのスキャン
# =============================================================================
log_section "Step 1: バックアップディレクトリのスキャン"

# 破損ファイルディレクトリを検索
BROKEN_DIRS=()

# .broken-* パターン（全深度）
while IFS= read -r -d '' dir; do
  BROKEN_DIRS+=("$dir")
done < <(find . -type d -name "*.broken-*" -print0 2>/dev/null)

# node_modules.broken パターン
while IFS= read -r -d '' dir; do
  BROKEN_DIRS+=("$dir")
done < <(find . -type d -name "node_modules.broken*" -print0 2>/dev/null)

# .next.broken-*, .next.old-* パターン
while IFS= read -r -d '' dir; do
  BROKEN_DIRS+=("$dir")
done < <(find . -type d \( -name ".next.broken-*" -o -name ".next.old-*" \) -print0 2>/dev/null)

# cdk.out.old-*, cdk.out.broken-* パターン
while IFS= read -r -d '' dir; do
  BROKEN_DIRS+=("$dir")
done < <(find . -type d \( -name "cdk.out.old-*" -o -name "cdk.out.broken-*" \) -print0 2>/dev/null)

if [ ${#BROKEN_DIRS[@]} -eq 0 ]; then
  log_success "破損ファイル・バックアップディレクトリは見つかりませんでした"
  exit 0
fi

log_info "検出されたバックアップディレクトリ: ${#BROKEN_DIRS[@]} 個"
echo ""

# =============================================================================
# Step 2: ディレクトリの分析
# =============================================================================
log_section "Step 2: ディレクトリの分析"

TOTAL_SIZE=0
OLD_DIRS=()  # 7日以上前
NEW_DIRS=()  # 7日以内

for dir in "${BROKEN_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    # サイズ計算
    SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1)
    SIZE_BYTES=$(du -sb "$dir" 2>/dev/null | cut -f1)
    TOTAL_SIZE=$((TOTAL_SIZE + SIZE_BYTES))

    # 更新日時
    AGE_DAYS=$(find "$dir" -maxdepth 0 -type d -mtime +7 2>/dev/null | wc -l)

    if [ "$AGE_DAYS" -eq 1 ]; then
      OLD_DIRS+=("$dir")
      echo -e "  ${YELLOW}[古い]${NC} $dir ($SIZE)"
    else
      NEW_DIRS+=("$dir")
      echo -e "  ${BLUE}[新しい]${NC} $dir ($SIZE)"
    fi
  fi
done

echo ""
TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024 / 1024))
log_info "合計サイズ: ${TOTAL_SIZE_MB} MB"
log_info "7日以上前: ${#OLD_DIRS[@]} 個"
log_info "7日以内: ${#NEW_DIRS[@]} 個"

# =============================================================================
# Step 3: 削除対象の決定
# =============================================================================
log_section "Step 3: 削除対象の決定"

DIRS_TO_DELETE=()

if [ "$DELETE_ALL" = true ]; then
  log_warning "全てのバックアップを削除します（--all オプション指定）"
  DIRS_TO_DELETE=("${BROKEN_DIRS[@]}")
else
  log_info "7日以上前のバックアップのみ削除します"
  DIRS_TO_DELETE=("${OLD_DIRS[@]}")

  if [ ${#NEW_DIRS[@]} -gt 0 ]; then
    echo ""
    log_info "7日以内のバックアップ（保持されます）:"
    for dir in "${NEW_DIRS[@]}"; do
      echo "  - $dir"
    done
  fi
fi

if [ ${#DIRS_TO_DELETE[@]} -eq 0 ]; then
  log_success "削除対象のディレクトリはありません"
  exit 0
fi

echo ""
log_warning "削除対象: ${#DIRS_TO_DELETE[@]} 個"
for dir in "${DIRS_TO_DELETE[@]}"; do
  echo "  - $dir"
done

# =============================================================================
# Step 4: 削除確認
# =============================================================================
if [ "$FORCE" = false ]; then
  echo ""
  echo -e "${YELLOW}警告: この操作は元に戻せません${NC}"
  read -p "削除を実行しますか? (yes/no): " CONFIRM

  if [ "$CONFIRM" != "yes" ]; then
    log_info "削除をキャンセルしました"
    exit 0
  fi
fi

# =============================================================================
# Step 5: 削除実行
# =============================================================================
log_section "Step 5: 削除実行"

SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_DIRS=()

for dir in "${DIRS_TO_DELETE[@]}"; do
  log_info "削除中: $dir"

  # Strategy 1: 通常削除
  if rm -rf "$dir" 2>/dev/null; then
    log_success "  ✓ 削除成功"
    ((SUCCESS_COUNT++))
    continue
  fi

  # Strategy 2: sudo削除
  log_warning "  通常削除失敗、sudo権限で再試行..."
  if sudo rm -rf "$dir" 2>/dev/null; then
    log_success "  ✓ sudo削除成功"
    ((SUCCESS_COUNT++))
    continue
  fi

  # Strategy 3: 個別ファイル削除
  log_warning "  sudo削除失敗、個別ファイル削除を試行..."

  if [ -d "$dir" ]; then
    # ディレクトリ内のファイルを個別に削除
    find "$dir" -type f -exec sudo rm -f {} \; 2>/dev/null || true

    # 空ディレクトリを削除
    find "$dir" -depth -type d -exec sudo rmdir {} \; 2>/dev/null || true

    # 最終確認
    if [ ! -d "$dir" ]; then
      log_success "  ✓ 個別削除成功"
      ((SUCCESS_COUNT++))
      continue
    fi
  fi

  # すべて失敗
  log_error "  ✗ 削除失敗"
  ((FAILED_COUNT++))
  FAILED_DIRS+=("$dir")
done

# =============================================================================
# サマリー
# =============================================================================
log_section "削除結果サマリー"

echo ""
echo -e "${GREEN}✓ 成功: $SUCCESS_COUNT${NC}"
echo -e "${RED}✗ 失敗: $FAILED_COUNT${NC}"
echo ""

if [ ${#FAILED_DIRS[@]} -gt 0 ]; then
  log_warning "削除できなかったディレクトリ:"
  for dir in "${FAILED_DIRS[@]}"; do
    echo "  - $dir"
  done

  echo ""
  log_info "手動削除の方法:"
  echo "  1. プロセスを確認: lsof | grep node_modules"
  echo "  2. プロセスを終了: pkill -f 'node\|npm'"
  echo "  3. 再試行: sudo rm -rf <ディレクトリ>"
  echo "  4. または再起動後に削除"
fi

if [ "$SUCCESS_COUNT" -gt 0 ]; then
  log_success "クリーンアップ完了"

  # ディスク容量解放の確認
  log_info "ディスク使用量を確認: df -h"
fi
