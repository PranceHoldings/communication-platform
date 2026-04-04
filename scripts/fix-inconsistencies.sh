#!/bin/bash
# 不整合自動修正スクリプト
# 検出された不整合を自動的に修正

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

BACKUP_DIR="/tmp/prance-backup-$(date +%s)"
mkdir -p "$BACKUP_DIR"

log_info "🔧 不整合の自動修正を開始します..."
echo ""
log_info "📦 バックアップディレクトリ: $BACKUP_DIR"
echo ""

FIXED_COUNT=0

# ============================================================
# 1. Prismaスキーマ不整合の修正
# ============================================================
log_info "📌 [1/4] Prismaスキーマ不整合を修正中..."

# session_id → sessionId (WebSocket handler)
FILE="infrastructure/lambda/websocket/default/index.ts"
if [ -f "$FILE" ]; then
    cp "$FILE" "$BACKUP_DIR/"
    sed -i "s/message\.session_id/message.sessionId/g" "$FILE"
    sed -i "s/session_id: sessionId/sessionId: sessionId/g" "$FILE"
    echo "  ✓ $FILE"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# user_id → userId (WebSocket connect handler)
FILE="infrastructure/lambda/websocket/connect/index.ts"
if [ -f "$FILE" ]; then
    cp "$FILE" "$BACKUP_DIR/"
    sed -i "s/user_id: userId/userId: userId/g" "$FILE"
    echo "  ✓ $FILE"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# ============================================================
# 2. 型定義の重複を修正（共有型を使用）
# ============================================================
log_info "📌 [2/4] 型定義の重複を修正中..."

# apps/web/lib/api/auth.ts - Userインターフェース削除
FILE="apps/web/lib/api/auth.ts"
if [ -f "$FILE" ]; then
    cp "$FILE" "$BACKUP_DIR/"
    # User型定義を削除し、import文を追加
    sed -i '/^export interface User {/,/^}/d' "$FILE"
    # import文が存在しない場合のみ追加
    if ! grep -q "from '@prance/shared'" "$FILE"; then
        sed -i "1i import type { User } from '@prance/shared';" "$FILE"
    fi
    echo "  ✓ $FILE - Userインターフェースを共有型に置換"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# apps/web/lib/api/avatars.ts - Avatarインターフェース削除
FILE="apps/web/lib/api/avatars.ts"
if [ -f "$FILE" ]; then
    cp "$FILE" "$BACKUP_DIR/"
    # Avatar型定義を削除し、import文を追加
    sed -i '/^export interface Avatar {/,/^}/d' "$FILE"
    # import文が存在しない場合のみ追加
    if ! grep -q "from '@prance/shared'" "$FILE"; then
        sed -i "1i import type { Avatar } from '@prance/shared';" "$FILE"
    fi
    echo "  ✓ $FILE - Avatarインターフェースを共有型に置換"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# ============================================================
# 3. ハードコード設定値の修正
# ============================================================
log_info "📌 [3/4] ハードコード設定値を修正中..."

# audio-processor.ts - ハードコード言語
FILE="infrastructure/lambda/websocket/default/audio-processor.ts"
if [ -f "$FILE" ] && grep -q "config.language || 'en-US'" "$FILE"; then
    cp "$FILE" "$BACKUP_DIR/"
    # デフォルト値をインポート
    if ! grep -q "from '../../shared/config/defaults'" "$FILE"; then
        sed -i "6i import { LANGUAGE_DEFAULTS } from '../../shared/config/defaults';" "$FILE"
    fi
    sed -i "s/config.language || 'en-US'/config.language || LANGUAGE_DEFAULTS.STT_LANGUAGE/g" "$FILE"
    echo "  ✓ $FILE - 言語デフォルト値を一元管理に変更"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# audio-processor.ts - ハードコードメディアフォーマット
if [ -f "$FILE" ] && grep -q "audioFormat = 'webm'" "$FILE"; then
    # 既にバックアップ済みなのでコピー不要
    sed -i "s/audioFormat = 'webm'/audioFormat = 'unknown'/g" "$FILE"
    sed -i "s/this.convertToWav(audioData, 'webm')/this.convertToWav(audioData, 'unknown')/g" "$FILE"
    echo "  ✓ $FILE - メディアフォーマットのハードコードを削除"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# stt-azure.ts - ハードコード言語
FILE="infrastructure/lambda/shared/audio/stt-azure.ts"
if [ -f "$FILE" ] && grep -q "'en-US'" "$FILE"; then
    cp "$FILE" "$BACKUP_DIR/"
    # デフォルト値をインポート
    if ! grep -q "from '../config/defaults'" "$FILE"; then
        sed -i "1i import { LANGUAGE_DEFAULTS } from '../config/defaults';" "$FILE"
    fi
    sed -i "s/options.language || 'en-US'/options.language || LANGUAGE_DEFAULTS.STT_LANGUAGE/g" "$FILE"
    echo "  ✓ $FILE - 言語デフォルト値を一元管理に変更"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# ============================================================
# 4. コードフォーマット
# ============================================================
log_info "📌 [4/4] コードフォーマットを適用中..."

# 修正したファイルをフォーマット
if command -v prettier &> /dev/null; then
    for file in infrastructure/lambda/websocket/default/index.ts \
                infrastructure/lambda/websocket/connect/index.ts \
                infrastructure/lambda/websocket/default/audio-processor.ts \
                infrastructure/lambda/shared/audio/stt-azure.ts \
                apps/web/lib/api/auth.ts \
                apps/web/lib/api/avatars.ts; do
        if [ -f "$file" ]; then
            prettier --write "$file" 2>/dev/null || true
            echo "  ✓ $file"
        fi
    done
else
    log_warning "Prettier not found, skipping formatting"
fi

echo ""
log_success "自動修正完了！"
echo ""
log_info "📊 修正したファイル数: $FIXED_COUNT"
log_info "📦 バックアップ: $BACKUP_DIR"
echo ""
echo "次のステップ:"
echo "1. git diff で変更内容を確認"
echo "2. pnpm run build でビルドエラーがないか確認"
echo "3. pnpm run test でテストが通るか確認"
echo "4. git commit で変更をコミット"
echo ""
