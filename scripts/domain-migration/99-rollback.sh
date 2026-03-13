#!/bin/bash
# Domain Migration - Rollback Script
# 移行を元に戻す緊急用スクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "======================================"
echo "⚠️  Domain Migration - Rollback"
echo "======================================"
echo ""
echo "このスクリプトは移行を元に戻します。"
echo ""

read -p "本当にロールバックしますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルされました"
    exit 1
fi

echo ""
echo "ロールバック中..."
echo ""

rollback_count=0
error_count=0

# バックアップファイルのリストを取得
backup_files=$(find "$PROJECT_ROOT" -name "*.backup" -type f 2>/dev/null || true)

if [ -z "$backup_files" ]; then
    echo "⚠️  バックアップファイルが見つかりません"
    echo ""
    echo "手動でロールバックしてください:"
    echo "  1. git checkout でファイルを元に戻す"
    echo "  2. CDKスタックを再デプロイ"
    exit 1
fi

echo "バックアップファイルを復元中..."
echo ""

while IFS= read -r backup_file; do
    original_file="${backup_file%.backup}"

    if [ -f "$backup_file" ]; then
        cp "$backup_file" "$original_file"
        echo "  ✓ 復元: $(basename "$original_file")"
        ((rollback_count++))
    else
        echo "  ✗ エラー: $(basename "$backup_file")"
        ((error_count++))
    fi
done <<< "$backup_files"

echo ""
echo "======================================"

if [ $error_count -eq 0 ]; then
    echo "✅ ロールバック完了"
else
    echo "⚠️  ロールバック完了（エラー: $error_count 件）"
fi

echo "======================================"
echo ""
echo "復元結果:"
echo "  - 成功: $rollback_count 件"
echo "  - エラー: $error_count 件"
echo ""
echo "次のステップ:"
echo "  1. 変更内容を確認: git diff"
echo "  2. CDKスタックを再デプロイ:"
echo "     cd infrastructure"
echo "     npm run cdk -- deploy Prance-dev-Dns --require-approval never"
echo "     npm run cdk -- deploy Prance-dev-Certificate --require-approval never --region us-east-1"
echo "     npm run cdk -- deploy Prance-dev-Storage --require-approval never"
echo "     npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never"
echo "     npm run cdk -- deploy Prance-dev-Cognito --require-approval never"
echo ""
