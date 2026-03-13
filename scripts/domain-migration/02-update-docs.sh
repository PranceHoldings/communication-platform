#!/bin/bash
# Domain Migration - Phase 2: Update Documentation
# 全てのドキュメントを新しいドメインに更新

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "======================================"
echo "Domain Migration - Phase 2"
echo "Documentation Update"
echo "======================================"
echo ""

# 検出されたドキュメント一覧
DOCS_TO_UPDATE=(
    "docs/06-infrastructure/DOMAIN_SETUP_SUMMARY.md"
    "docs/05-modules/MULTILINGUAL_SYSTEM.md"
    "docs/10-reference/GLOSSARY.md"
    "infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md"
    "infrastructure/docs/QUICKSTART_DOMAIN.md"
    "infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md"
    "infrastructure/docs/README.md"
    "infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md"
    "infrastructure/docs/DOMAIN_SETUP.md"
    "infrastructure/README.md"
    "infrastructure/ROUTE53_SETUP_RESULT.md"
    "START_HERE.md"
    "CLAUDE.md"
)

echo "更新対象ドキュメント: ${#DOCS_TO_UPDATE[@]}件"
echo ""

for doc in "${DOCS_TO_UPDATE[@]}"; do
    echo "  - $doc"
done

echo ""
read -p "続行しますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルされました"
    exit 1
fi

echo ""
echo "ドキュメントを更新中..."
echo ""

updated_count=0
skipped_count=0

for doc in "${DOCS_TO_UPDATE[@]}"; do
    doc_path="$PROJECT_ROOT/$doc"

    if [ -f "$doc_path" ]; then
        # バックアップ作成
        if [ ! -f "${doc_path}.backup" ]; then
            cp "$doc_path" "${doc_path}.backup"
        fi

        # 置換実行
        sed -i \
            -e "s/prance\.co\.jp/prance.jp/g" \
            -e "s/platform\.prance\.co\.jp/app.prance.jp/g" \
            -e "s/platform\.prance/app.prance/g" \
            -e "s/dev\.platform\.prance\.jp/dev.app.prance.jp/g" \
            -e "s/staging\.platform\.prance\.jp/staging.app.prance.jp/g" \
            "$doc_path"

        echo "  ✓ $doc"
        ((updated_count++))
    else
        echo "  ⚠  スキップ (ファイルが存在しない): $doc"
        ((skipped_count++))
    fi
done

echo ""
echo "======================================"
echo "✅ Phase 2 完了"
echo "======================================"
echo ""
echo "更新結果:"
echo "  - 更新: $updated_count 件"
echo "  - スキップ: $skipped_count 件"
echo ""
echo "バックアップファイル: *.backup として保存されています"
echo ""
echo "次のステップ:"
echo "  1. 変更内容を確認: git diff"
echo "  2. Phase 3スクリプト実行: ./scripts/domain-migration/03-update-env.sh"
echo ""
