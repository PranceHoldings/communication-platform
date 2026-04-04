#!/bin/bash

# npm → pnpm 自動変換スクリプト

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 対象ファイルを取得
SCRIPT_FILES=$(find scripts infrastructure/scripts apps/web/scripts -name "*.sh" -type f 2>/dev/null)

# バックアップディレクトリ作成
BACKUP_DIR="/tmp/npm-scripts-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

log "Starting conversion of $(echo "$SCRIPT_FILES" | wc -l) files" true
log "Backup directory: $BACKUP_DIR" true

TOTAL_FILES=0
MODIFIED_FILES=0

for file in $SCRIPT_FILES; do
  TOTAL_FILES=$((TOTAL_FILES + 1))

  # バックアップ
  cp "$file" "$BACKUP_DIR/$(basename "$file")"

  # 変換（sedを使用）
  sed -i.bak \
    -e 's/\bnpm install\b/pnpm install/g' \
    -e 's/\bnpm ci\b/pnpm install --frozen-lockfile/g' \
    -e 's/\bnpm run /pnpm run /g' \
    -e 's/\bnpm build\b/pnpm build/g' \
    -e 's/\bnpm ls\b/pnpm list/g' \
    -e 's/\bnpm cache clean/pnpm store prune/g' \
    -e 's/\bnpx /pnpm exec /g' \
    "$file"

  # 差分確認
  if ! diff -q "$file.bak" "$file" > /dev/null 2>&1; then
    log "Modified: $file" true
    MODIFIED_FILES=$((MODIFIED_FILES + 1))
  fi

  rm -f "$file.bak"
done

log "Conversion complete" true
log "Total files: $TOTAL_FILES" true
log "Modified files: $MODIFIED_FILES" true
log "Backup: $BACKUP_DIR" true
log "" true
log "Review changes with: git diff scripts/ infrastructure/scripts/ apps/web/scripts/" true
