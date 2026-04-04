#!/bin/bash
# Domain Migration - Phase 3: Update Environment Files
# 環境変数ファイルを新しいドメインに更新

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "======================================"
echo "Domain Migration - Phase 3"
echo "Environment Files Update"
echo "======================================"
echo ""

echo "更新対象ファイル:"
echo "  - .env.example"
echo "  - infrastructure/.env"
echo "  - apps/web/.env.local.example"
echo ""

read -p "続行しますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルされました"
    exit 1
fi

echo ""

# 1. .env.example
if [ -f "$PROJECT_ROOT/.env.example" ]; then
    echo "1. .env.example を更新中..."

    if [ ! -f "$PROJECT_ROOT/.env.example.backup" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.example.backup"
    fi

    sed -i \
        -e "s/prance\.co\.jp/prance.jp/g" \
        -e "s/platform\.prance/app.prance/g" \
        "$PROJECT_ROOT/.env.example"

    echo "   ✓ .env.example 更新完了"
else
    echo "   ⚠  .env.example が見つかりません"
fi

echo ""

# 2. infrastructure/.env
if [ -f "$PROJECT_ROOT/infrastructure/.env" ]; then
    echo "2. infrastructure/.env を更新中..."

    if [ ! -f "$PROJECT_ROOT/infrastructure/.env.backup" ]; then
        cp "$PROJECT_ROOT/infrastructure/.env" "$PROJECT_ROOT/infrastructure/.env.backup"
    fi

    # ROOT_DOMAIN行を更新
    if grep -q "^ROOT_DOMAIN=" "$PROJECT_ROOT/infrastructure/.env"; then
        sed -i 's/^ROOT_DOMAIN=.*/ROOT_DOMAIN=prance.jp/' "$PROJECT_ROOT/infrastructure/.env"
    else
        echo "ROOT_DOMAIN=prance.jp" >> "$PROJECT_ROOT/infrastructure/.env"
    fi

    # PLATFORM_DOMAIN行を更新
    if grep -q "^PLATFORM_DOMAIN=" "$PROJECT_ROOT/infrastructure/.env"; then
        sed -i 's/^PLATFORM_DOMAIN=.*/PLATFORM_DOMAIN=app.prance.jp/' "$PROJECT_ROOT/infrastructure/.env"
    else
        echo "PLATFORM_DOMAIN=app.prance.jp" >> "$PROJECT_ROOT/infrastructure/.env"
    fi

    echo "   ✓ infrastructure/.env 更新完了"
else
    echo "   ⚠  infrastructure/.env が見つかりません"
fi

echo ""

# 3. apps/web/.env.local.example
if [ -f "$PROJECT_ROOT/apps/web/.env.local.example" ]; then
    echo "3. apps/web/.env.local.example を更新中..."

    if [ ! -f "$PROJECT_ROOT/apps/web/.env.local.example.backup" ]; then
        cp "$PROJECT_ROOT/apps/web/.env.local.example" "$PROJECT_ROOT/apps/web/.env.local.example.backup"
    fi

    sed -i \
        -e "s/prance\.co\.jp/prance.jp/g" \
        -e "s/platform\.prance/app.prance/g" \
        "$PROJECT_ROOT/apps/web/.env.local.example"

    echo "   ✓ apps/web/.env.local.example 更新完了"
else
    echo "   ⚠  apps/web/.env.local.example が見つかりません"
fi

echo ""
echo "======================================"
echo "✅ Phase 3 完了"
echo "======================================"
echo ""
echo "⚠️  注意: 以下のファイルは手動で更新が必要です:"
echo ""
echo "1. .env.local (存在する場合)"
echo "   - FRONTEND_URL=https://dev.app.prance.jp"
echo ""
echo "2. apps/web/.env.local (存在する場合)"
echo "   - NEXT_PUBLIC_APP_URL=https://dev.app.prance.jp"
echo "   - NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp (カスタムドメイン設定時)"
echo "   - NEXT_PUBLIC_WS_ENDPOINT=wss://ws.dev.app.prance.jp (カスタムドメイン設定時)"
echo ""
echo "次のステップ:"
echo "  1. 上記の手動編集を実行（必要に応じて）"
echo "  2. 変更内容を確認: git diff"
echo "  3. コミット: git add . && git commit -m 'chore: migrate domain from prance.co.jp to prance.jp'"
echo ""
