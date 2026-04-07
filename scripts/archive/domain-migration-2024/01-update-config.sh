#!/bin/bash
# Domain Migration - Phase 1: Update Config Files
# config.tsとその他の設定ファイルを新しいドメインに更新

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "======================================"
echo "Domain Migration - Phase 1"
echo "Config Files Update"
echo "======================================"
echo ""

# 新しいドメイン設定
NEW_ROOT_DOMAIN="prance.jp"
NEW_PLATFORM_DOMAIN="app.prance.jp"

# 古いドメイン設定
OLD_ROOT_DOMAIN="prance.co.jp"
OLD_PLATFORM_DOMAIN="platform.prance.co.jp"

echo "変更内容:"
echo "  $OLD_ROOT_DOMAIN → $NEW_ROOT_DOMAIN"
echo "  $OLD_PLATFORM_DOMAIN → $NEW_PLATFORM_DOMAIN"
echo ""
echo "影響を受けるファイル:"
echo "  - infrastructure/lib/config.ts"
echo "  - infrastructure/lib/api-lambda-stack.ts (環境変数追加)"
echo "  - infrastructure/lib/cognito-stack.ts (CallbackURL追加)"
echo ""

read -p "続行しますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルされました"
    exit 1
fi

echo ""
echo "1. config.ts を更新中..."

# config.tsのバックアップ（追加）
if [ ! -f "$PROJECT_ROOT/infrastructure/lib/config.ts.backup" ]; then
    cp "$PROJECT_ROOT/infrastructure/lib/config.ts" "$PROJECT_ROOT/infrastructure/lib/config.ts.backup"
    echo "   ✓ バックアップ作成: config.ts.backup"
fi

# config.tsの置換
sed -i \
    -e "s/prance\.co\.jp/prance.jp/g" \
    -e "s/platform\.prance/app.prance/g" \
    -e "s/dev\.platform/dev.app/g" \
    -e "s/staging\.platform/staging.app/g" \
    "$PROJECT_ROOT/infrastructure/lib/config.ts"

echo "   ✓ config.ts 更新完了"

echo ""
echo "2. dns-stack.ts のコメントを更新中..."

sed -i \
    -e "s/platform\.prance\.co\.jp/app.prance.jp/g" \
    "$PROJECT_ROOT/infrastructure/lib/dns-stack.ts"

echo "   ✓ dns-stack.ts 更新完了"

echo ""
echo "======================================"
echo "✅ Phase 1 完了"
echo "======================================"
echo ""
echo "変更されたファイル:"
echo "  - infrastructure/lib/config.ts"
echo "  - infrastructure/lib/dns-stack.ts"
echo ""
echo "⚠️  注意: 以下のファイルは手動で編集が必要です:"
echo ""
echo "1. infrastructure/lib/api-lambda-stack.ts"
echo "   → commonEnv に FRONTEND_URL を追加:"
echo ""
echo "   const commonEnv = {"
echo "     // ... existing"
echo "     FRONTEND_URL: \`https://\${config.domain.fullDomain}\`,"
echo "   };"
echo ""
echo "2. infrastructure/lib/cognito-stack.ts"
echo "   → oAuth.callbackUrls と logoutUrls を追加:"
echo ""
echo "   oAuth: {"
echo "     // ... existing"
echo "     callbackUrls: ["
echo "       \`https://\${config.domain.fullDomain}/auth/callback\`,"
echo "       'http://localhost:3000/auth/callback',"
echo "     ],"
echo "     logoutUrls: ["
echo "       \`https://\${config.domain.fullDomain}/auth/logout\`,"
echo "       'http://localhost:3000/auth/logout',"
echo "     ],"
echo "   }"
echo ""
echo "次のステップ:"
echo "  1. 上記の手動編集を実行"
echo "  2. Phase 2スクリプト実行: ./scripts/domain-migration/02-update-docs.sh"
echo ""
