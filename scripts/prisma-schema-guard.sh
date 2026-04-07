#!/bin/bash

##############################################################################
# Prisma Schema Change Guard
#
# このスクリプトはPrismaスキーマ変更時に必須手順を強制実行します。
# Git pre-commit hookとして自動実行されます。
#
# 必須手順:
#   1. マイグレーションファイル生成 (prisma migrate dev)
#   2. Prisma Client再生成 (prisma generate)
#   3. Lambda関数デプロイ (infrastructure deploy)
#   4. データベースマイグレーション実行 (Lambda invoke)
##############################################################################

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATABASE_DIR="${PROJECT_ROOT}/packages/database"
INFRASTRUCTURE_DIR="${PROJECT_ROOT}/infrastructure"

log_section "Prisma Schema Change Guard"

# Check if schema.prisma has changed
SCHEMA_CHANGED=false
if git diff --cached --name-only | grep -q "packages/database/prisma/schema.prisma"; then
    SCHEMA_CHANGED=true
    log_warning "Prismaスキーマファイルが変更されています"
fi

if [ "$SCHEMA_CHANGED" = false ]; then
    log_success "Prismaスキーマに変更はありません"
    exit 0
fi

echo ""
print_separator "━" 70
log_error "🔴 CRITICAL: Prismaスキーマ変更検出"
print_separator "━" 70
echo ""
log_warning "Prismaスキーマを変更した場合、以下の手順を必ず実行してください:"
echo ""
log_info "Step 1: マイグレーションファイル生成"
echo -e "    ${GREEN}cd packages/database && pnpm exec prisma migrate dev --name <変更内容>${NC}"
echo ""
log_info "Step 2: Prisma Client再生成"
echo -e "    ${GREEN}pnpm exec prisma generate${NC}"
echo ""
log_info "Step 3: Lambda関数デプロイ"
echo -e "    ${GREEN}cd infrastructure && pnpm run cdk -- deploy Prance-dev-ApiLambda${NC}"
echo ""
log_info "Step 4: データベースマイグレーション実行"
echo -e "    ${GREEN}aws lambda invoke --function-name prance-db-migration-dev --payload '{}' /tmp/result.json${NC}"
echo ""

# Auto-execution mode (if --auto flag is provided)
if [ "$1" = "--auto" ]; then
    log_section "自動実行モード"
    echo ""

    read -p "マイグレーション名を入力してください: " MIGRATION_NAME

    if [ -z "$MIGRATION_NAME" ]; then
        log_error "マイグレーション名が必要です"
        exit 1
    fi

    echo ""
    log_info "Step 1: マイグレーションファイル生成中..."
    cd "${DATABASE_DIR}"
    pnpm exec prisma migrate dev --name "${MIGRATION_NAME}"

    echo ""
    log_info "Step 2: Prisma Client再生成中..."
    pnpm exec prisma generate

    echo ""
    log_success "マイグレーション処理完了"
    echo ""
    log_warning "次のステップ:"
    echo -e "  1. ${GREEN}git add .${NC} - 生成されたマイグレーションファイルをステージング"
    echo -e "  2. ${GREEN}git commit${NC} - コミット"
    echo -e "  3. ${GREEN}cd infrastructure && pnpm run deploy:dev${NC} - Lambda関数デプロイ"
    echo -e "  4. ${GREEN}aws lambda invoke --function-name prance-db-migration-dev --payload '{}' /tmp/result.json${NC}"
    echo ""

    read -p "変更をステージングに追加しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add packages/database/prisma/migrations/
        git add packages/database/node_modules/.prisma/
        log_success "マイグレーションファイルをステージングに追加しました"
    fi

    exit 0
fi

# Interactive mode
log_warning "以下のオプションを選択してください:"
echo ""
echo -e "  ${GREEN}1)${NC} 自動実行 (マイグレーション生成 + Prisma Client再生成)"
echo -e "  ${GREEN}2)${NC} 手動で実行する (このコミットをブロック)"
echo -e "  ${GREEN}3)${NC} スキップ (非推奨: 本番環境で500エラーが発生します)"
echo ""

read -p "選択 (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        exec "$0" --auto
        ;;
    2)
        echo ""
        log_error "コミットをブロックしました"
        log_warning "上記の手順を手動で実行してから、再度コミットしてください"
        exit 1
        ;;
    3)
        echo ""
        print_separator "━" 70
        log_error "⚠️  警告: マイグレーション手順をスキップしました"
        print_separator "━" 70
        echo ""
        log_warning "スキップした場合の影響:"
        echo -e "  - デプロイ後に500エラーが発生します"
        echo -e "  - データベースとコードの不整合が発生します"
        echo -e "  - 本番環境でサービス停止につながります"
        echo ""
        log_warning "必ず以下の手順を後で実行してください:"
        echo -e "  1. マイグレーション生成"
        echo -e "  2. Prisma Client再生成"
        echo -e "  3. Lambda関数デプロイ"
        echo -e "  4. データベースマイグレーション実行"
        echo ""

        read -p "本当にスキップしますか? (yes/NO): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            log_error "コミットをブロックしました"
            exit 1
        fi

        log_warning "スキップが確認されました"
        exit 0
        ;;
    *)
        log_error "無効な選択です。コミットをブロックしました"
        exit 1
        ;;
esac
