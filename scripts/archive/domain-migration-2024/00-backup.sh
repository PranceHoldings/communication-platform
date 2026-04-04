#!/bin/bash
# Domain Migration - Phase 0: Backup Script
# 移行前にすべての設定ファイルをバックアップ

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups/domain-migration-$(date +%Y%m%d-%H%M%S)"

echo "======================================"
echo "Domain Migration - Backup Script"
echo "======================================"
echo ""
echo "バックアップ先: $BACKUP_DIR"
echo ""

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR"

# 1. Infrastructure config
echo "✓ インフラ設定をバックアップ中..."
mkdir -p "$BACKUP_DIR/infrastructure/lib"
cp "$PROJECT_ROOT/infrastructure/lib/config.ts" "$BACKUP_DIR/infrastructure/lib/" 2>/dev/null || echo "  - config.ts not found"
cp "$PROJECT_ROOT/infrastructure/lib/dns-stack.ts" "$BACKUP_DIR/infrastructure/lib/" 2>/dev/null || echo "  - dns-stack.ts not found"
cp "$PROJECT_ROOT/infrastructure/lib/certificate-stack.ts" "$BACKUP_DIR/infrastructure/lib/" 2>/dev/null || echo "  - certificate-stack.ts not found"
cp "$PROJECT_ROOT/infrastructure/lib/storage-stack.ts" "$BACKUP_DIR/infrastructure/lib/" 2>/dev/null || echo "  - storage-stack.ts not found"
cp "$PROJECT_ROOT/infrastructure/lib/api-gateway-stack.ts" "$BACKUP_DIR/infrastructure/lib/" 2>/dev/null || echo "  - api-gateway-stack.ts not found"
cp "$PROJECT_ROOT/infrastructure/lib/cognito-stack.ts" "$BACKUP_DIR/infrastructure/lib/" 2>/dev/null || echo "  - cognito-stack.ts not found"
cp "$PROJECT_ROOT/infrastructure/lib/api-lambda-stack.ts" "$BACKUP_DIR/infrastructure/lib/" 2>/dev/null || echo "  - api-lambda-stack.ts not found"

# 2. Environment files
echo "✓ 環境変数ファイルをバックアップ中..."
cp "$PROJECT_ROOT/.env.example" "$BACKUP_DIR/" 2>/dev/null || echo "  - .env.example not found"
cp "$PROJECT_ROOT/.env.local" "$BACKUP_DIR/" 2>/dev/null || echo "  - .env.local not found (OK if not exists)"
cp "$PROJECT_ROOT/infrastructure/.env" "$BACKUP_DIR/infrastructure/" 2>/dev/null || echo "  - infrastructure/.env not found"
mkdir -p "$BACKUP_DIR/apps/web"
cp "$PROJECT_ROOT/apps/web/.env.local.example" "$BACKUP_DIR/apps/web/" 2>/dev/null || echo "  - apps/web/.env.local.example not found"
cp "$PROJECT_ROOT/apps/web/.env.local" "$BACKUP_DIR/apps/web/" 2>/dev/null || echo "  - apps/web/.env.local not found (OK if not exists)"

# 3. Documentation
echo "✓ ドキュメントをバックアップ中..."
mkdir -p "$BACKUP_DIR/docs"
cp -r "$PROJECT_ROOT/docs" "$BACKUP_DIR/" 2>/dev/null || echo "  - docs directory not found"
mkdir -p "$BACKUP_DIR/infrastructure/docs"
cp -r "$PROJECT_ROOT/infrastructure/docs" "$BACKUP_DIR/infrastructure/" 2>/dev/null || echo "  - infrastructure/docs directory not found"

# 4. START_HERE.md and CLAUDE.md
echo "✓ プロジェクトドキュメントをバックアップ中..."
cp "$PROJECT_ROOT/START_HERE.md" "$BACKUP_DIR/" 2>/dev/null || echo "  - START_HERE.md not found"
cp "$PROJECT_ROOT/CLAUDE.md" "$BACKUP_DIR/" 2>/dev/null || echo "  - CLAUDE.md not found"

# 5. CDK context
echo "✓ CDKコンテキストをバックアップ中..."
cp "$PROJECT_ROOT/infrastructure/cdk.context.json" "$BACKUP_DIR/infrastructure/" 2>/dev/null || echo "  - cdk.context.json not found"

echo ""
echo "======================================"
echo "✅ バックアップ完了"
echo "======================================"
echo ""
echo "バックアップ場所: $BACKUP_DIR"
echo ""
echo "次のステップ:"
echo "  1. Route 53でHosted Zoneを作成"
echo "  2. お名前.comでNSレコードを設定"
echo "  3. DNS伝播確認 (10分〜1時間)"
echo "  4. Phase 1スクリプト実行: ./scripts/domain-migration/01-update-config.sh"
echo ""
