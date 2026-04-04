#!/bin/bash
set -e

# Markdownファイル内のnpm → pnpm変換

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

# 対象ファイル（backups, node_modules, .next, cdk.out を除外）
MD_FILES=$(find . -name "*.md" -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/cdk.out/*" \
  -not -path "*/backups/*" \
  2>/dev/null)

# バックアップ
BACKUP_DIR="/tmp/docs-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

log "Converting $(echo "$MD_FILES" | wc -l) markdown files"
log "Backup directory: $BACKUP_DIR"

TOTAL_FILES=0
MODIFIED_FILES=0

while IFS= read -r file; do
  TOTAL_FILES=$((TOTAL_FILES + 1))

  # ファイルが存在しない場合はスキップ
  if [ ! -f "$file" ]; then
    continue
  fi

  # バックアップ（相対パス保持）
  mkdir -p "$BACKUP_DIR/$(dirname "$file")"
  cp "$file" "$BACKUP_DIR/$file" 2>/dev/null || continue

  # 変換（コードブロック内外両方）
  sed -i.bak \
    -e 's/\bnpm install\b/pnpm install/g' \
    -e 's/\bnpm ci\b/pnpm install --frozen-lockfile/g' \
    -e 's/\bnpm run /pnpm run /g' \
    -e 's/\bnpm build\b/pnpm build/g' \
    -e 's/\bnpm ls\b/pnpm list/g' \
    -e 's/\bnpx /pnpm exec /g' \
    -e 's/`npm install`/`pnpm install`/g' \
    -e 's/`npm run /`pnpm run /g' \
    -e 's/`npx /`pnpm exec /g' \
    "$file"

  # 差分確認
  if ! diff -q "$file.bak" "$file" > /dev/null 2>&1; then
    MODIFIED_FILES=$((MODIFIED_FILES + 1))
  fi

  rm -f "$file.bak"
done <<< "$MD_FILES"

log "Conversion complete"
log "Total files: $TOTAL_FILES"
log "Modified files: $MODIFIED_FILES"
log "Backup: $BACKUP_DIR"
log ""
log "Review important files:"
log "  - CLAUDE.md"
log "  - START_HERE.md"
log "  - README.md"
log "  - infrastructure/CLAUDE.md"
log "  - docs/08-operations/DEPLOYMENT.md"
