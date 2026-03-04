#!/bin/bash
# deploy.sh - Prance Platform AWS デプロイスクリプト
# 使用方法: ./deploy.sh [環境名]
# 例: ./deploy.sh dev

set -e

# 色付き出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Prance Platform - AWS デプロイスクリプト${NC}"
echo "=============================================="

# 環境名の取得（デフォルト: dev）
ENVIRONMENT="${1:-dev}"
echo -e "${BLUE}📍 環境: ${ENVIRONMENT}${NC}\n"

# 1. 前提条件チェック
echo -e "${YELLOW}📋 前提条件をチェック中...${NC}"

# AWS CLI確認
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI がインストールされていません${NC}"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI インストール確認${NC}"

# Node.js確認
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js がインストールされていません${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION}${NC}"

# npm確認
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm がインストールされていません${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm ${NPM_VERSION}${NC}"

# AWS認証確認
echo -e "\n${YELLOW}🔑 AWS認証を確認中...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS認証が設定されていません${NC}"
    echo "   以下のコマンドで設定してください:"
    echo "   aws configure"
    exit 1
fi

echo -e "${GREEN}✅ AWS認証確認完了${NC}"
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo -e "   アカウント: ${AWS_ACCOUNT}"
echo -e "   リージョン: ${AWS_REGION}"

# ドメイン設定の確認
echo -e "\n${YELLOW}🌐 ドメイン設定:${NC}"
case ${ENVIRONMENT} in
  dev)
    DOMAIN="dev.platform.prance.co.jp"
    ;;
  staging)
    DOMAIN="staging.platform.prance.co.jp"
    ;;
  production)
    DOMAIN="platform.prance.co.jp"
    ;;
  *)
    DOMAIN="未設定"
    ;;
esac
echo -e "   ドメイン: ${DOMAIN}"

# Route 53 ホストゾーンの確認
echo -e "\n${YELLOW}🔍 Route 53 ホストゾーンを確認中...${NC}"
if aws route53 list-hosted-zones-by-name --dns-name prance.co.jp --query 'HostedZones[0].Id' --output text 2>/dev/null | grep -q "/hostedzone/"; then
    echo -e "${GREEN}✅ Route 53 ホストゾーン確認完了${NC}"
else
    echo -e "${YELLOW}⚠️  Route 53 ホストゾーンが見つかりません${NC}"
    echo -e "   初回セットアップが必要な場合があります"
    echo -e "   詳細: docs/DOMAIN_SETUP.md"
fi

# 確認プロンプト
echo -e "\n${YELLOW}⚠️  以下の環境にデプロイします:${NC}"
echo -e "   環境: ${ENVIRONMENT}"
echo -e "   AWS Account: ${AWS_ACCOUNT}"
echo -e "   AWS Region: ${AWS_REGION}"
echo -e "   ドメイン: ${DOMAIN}"
echo -e "\n${YELLOW}デプロイを続行しますか? (yes/no)${NC}"
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}❌ デプロイをキャンセルしました${NC}"
    exit 0
fi

# 2. 依存関係インストール
echo -e "\n${YELLOW}📦 依存関係をインストール中...${NC}"
npm ci
echo -e "${GREEN}✅ 依存関係インストール完了${NC}"

# 3. TypeScriptビルド
echo -e "\n${YELLOW}🔨 TypeScriptをビルド中...${NC}"
npm run build
echo -e "${GREEN}✅ ビルド完了${NC}"

# 4. CDK Synth（確認）
echo -e "\n${YELLOW}🔍 CloudFormationテンプレートを生成中...${NC}"
npm run synth -- --context environment=${ENVIRONMENT}
echo -e "${GREEN}✅ Synth完了${NC}"

# 5. CDK Bootstrap（初回のみ）
echo -e "\n${YELLOW}🔧 CDK Bootstrap をチェック中...${NC}"
BOOTSTRAP_STACK_NAME="CDKToolkit"

if aws cloudformation describe-stacks --stack-name ${BOOTSTRAP_STACK_NAME} --region ${AWS_REGION} &> /dev/null; then
    echo -e "${GREEN}✅ CDK Bootstrap 済み${NC}"
else
    echo -e "${YELLOW}📦 CDK Bootstrap を実行中...${NC}"
    npm run bootstrap -- --context environment=${ENVIRONMENT}
    echo -e "${GREEN}✅ Bootstrap完了${NC}"
fi

# 6. 全スタックデプロイ
echo -e "\n${YELLOW}🚢 全スタックをデプロイ中...${NC}"
echo -e "${BLUE}   これには数分かかる場合があります...${NC}"

npm run deploy -- \
  --context environment=${ENVIRONMENT} \
  --require-approval never \
  --progress events

# 7. デプロイ結果の取得
echo -e "\n${YELLOW}📊 デプロイされたスタック一覧:${NC}"
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?starts_with(StackName, 'Prance-${ENVIRONMENT}')].{Name:StackName,Status:StackStatus,Created:CreationTime}" \
  --output table \
  --region ${AWS_REGION}

# 8. 完了メッセージ
echo -e "\n${GREEN}✅ デプロイ完了！${NC}"
echo -e "${BLUE}=============================================="
echo -e "🎉 Prance Platform が正常にデプロイされました"
echo -e "=============================================="
echo -e "${NC}"

echo -e "${YELLOW}📝 次のステップ:${NC}"
echo ""
echo "1. AWS Console でスタックの状態を確認"
echo "   https://console.aws.amazon.com/cloudformation"
echo ""
echo "2. カスタムドメインの設定確認"
echo "   curl -I https://${DOMAIN}"
echo ""
echo "3. SSL証明書のステータス確認"
echo "   aws acm list-certificates --region us-east-1"
echo ""
echo "4. API Gateway エンドポイントを確認"
echo "   aws cloudformation describe-stacks --stack-name Prance-${ENVIRONMENT}-ApiGateway --query 'Stacks[0].Outputs'"
echo ""
echo "5. フロントエンド (Next.js) に環境変数を設定"
echo "   - NEXT_PUBLIC_APP_URL=https://${DOMAIN}"
echo "   - API_GATEWAY_URL"
echo "   - USER_POOL_ID"
echo "   - USER_POOL_CLIENT_ID"
echo ""
echo -e "${BLUE}📖 ドメイン設定の詳細: docs/DOMAIN_SETUP.md${NC}"
echo -e "${GREEN}Happy coding! 🚀${NC}"
