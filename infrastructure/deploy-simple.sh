#!/bin/bash
# deploy-simple.sh - シンプルデプロイ（ビルド済み前提）
# 使用方法: ./deploy-simple.sh [環境名]
# 前提条件: prepare.sh または npm run build 実行済み

set -e

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Prance Platform - シンプルデプロイ${NC}"
echo "=============================================="

# 環境名の取得（デフォルト: dev）
ENVIRONMENT="${1:-dev}"
echo -e "${BLUE}📍 環境: ${ENVIRONMENT}${NC}\n"

# プロジェクトルートを取得
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. ビルド成果物の確認
echo -e "${YELLOW}🔍 ビルド成果物を確認中...${NC}"

if [ ! -f "$PROJECT_ROOT/infrastructure/lib/network-stack.js" ]; then
    echo -e "${RED}❌ エラー: CDK定義ファイルがビルドされていません${NC}"
    echo -e "${YELLOW}   以下のコマンドを実行してください:${NC}"
    echo -e "   ${BLUE}./prepare.sh${NC}"
    echo -e "   または"
    echo -e "   ${BLUE}cd .. && npm run build${NC}"
    exit 1
fi

echo -e "${GREEN}✅ ビルド成果物確認完了${NC}"

# 2. 環境変数同期
echo -e "\n${YELLOW}🔐 環境変数ファイルを同期中...${NC}"
ENV_LOCAL="${PROJECT_ROOT}/.env.local"
ENV_INFRA="$(dirname "$0")/.env"

if [ ! -f "$ENV_LOCAL" ]; then
    echo -e "${RED}❌ エラー: .env.local が見つかりません${NC}"
    exit 1
fi

cp "$ENV_LOCAL" "$ENV_INFRA"
echo -e "${GREEN}✅ 環境変数ファイル同期完了${NC}"

# 環境変数を読み込み
set -a
source "$ENV_INFRA"
set +a

# 3. AWS認証確認
echo -e "\n${YELLOW}🔑 AWS認証を確認中...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS認証が設定されていません${NC}"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo -e "${GREEN}✅ AWS認証確認完了${NC}"
echo -e "   アカウント: ${AWS_ACCOUNT}"
echo -e "   リージョン: ${AWS_REGION}"

# 4. Lambda Dependencies Validation (CRITICAL)
echo -e "\n${YELLOW}🔍 Lambda依存関係を検証中...${NC}"
if [ -f "$PROJECT_ROOT/scripts/validate-lambda-dependencies.sh" ]; then
    if "$PROJECT_ROOT/scripts/validate-lambda-dependencies.sh"; then
        echo -e "${GREEN}✅ Lambda依存関係検証完了${NC}"
    else
        echo -e "${RED}❌ Lambda依存関係検証失敗${NC}"
        echo -e "${YELLOW}必須SDKが欠けています。本番環境で500エラーが発生します。${NC}"
        echo ""
        read -p "自動修復を実行しますか？ (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}🔧 Lambda依存関係を修復中...${NC}"
            "$PROJECT_ROOT/scripts/fix-lambda-node-modules.sh"
            echo -e "${GREEN}✅ 修復完了。再検証します...${NC}"
            "$PROJECT_ROOT/scripts/validate-lambda-dependencies.sh" || {
                echo -e "${RED}❌ 修復後も検証失敗。手動確認が必要です。${NC}"
                exit 1
            }
        else
            echo -e "${RED}デプロイを中止します。${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠️  検証スクリプトが見つかりません（スキップ）${NC}"
fi

# 5. CDK Synth
echo -e "\n${YELLOW}🔍 CloudFormationテンプレートを生成中...${NC}"
cd "$PROJECT_ROOT/infrastructure"
npm run synth -- --context environment=${ENVIRONMENT} > /dev/null
echo -e "${GREEN}✅ Synth完了${NC}"

# 6. CDK Deploy
echo -e "\n${YELLOW}🚢 スタックをデプロイ中...${NC}"
npm run deploy -- \
  --context environment=${ENVIRONMENT} \
  --require-approval never \
  --progress events

echo -e "\n${GREEN}✅ デプロイ完了！${NC}"
