# デプロイメントガイド

ワンクリックデプロイスクリプトとCI/CD自動化による効率的なデプロイ戦略。

## 目次

1. [デプロイ環境](#デプロイ環境)
2. [ワンクリックデプロイ](#ワンクリックデプロイ)
3. [手動デプロイ](#手動デプロイ)
4. [ロールバック](#ロールバック)
5. [環境変数管理](#環境変数管理)
6. [トラブルシューティング](#トラブルシューティング)

---

## デプロイ環境

### 環境構成

| 環境 | 用途 | デプロイトリガー | URL |
|------|------|------------------|-----|
| **Development** | ローカル開発 | 手動 | http://localhost:3000 |
| **Staging** | 統合テスト・QA | `main` ブランチマージ | https://staging.prance.com |
| **Production** | 本番環境 | `v*.*.*` タグプッシュ | https://prance.com |

### AWS アカウント構成

```
本番AWSアカウント (123456789012)
  ├─ Production環境
  └─ Staging環境 (分離VPC)

開発AWSアカウント (987654321098)
  └─ Development環境
```

---

## ワンクリックデプロイ

### クイックスタート

```bash
# ステージング環境にデプロイ
./scripts/deploy.sh staging

# プロダクション環境にデプロイ
./scripts/deploy.sh production

# 特定スタックのみデプロイ
./scripts/deploy.sh staging --stack DatabaseStack

# ドライラン（変更内容確認のみ）
./scripts/deploy.sh staging --dry-run
```

### デプロイスクリプト

**scripts/deploy.sh**:

```bash
#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 引数チェック
if [ -z "$1" ]; then
  echo -e "${RED}Error: Environment not specified${NC}"
  echo "Usage: ./scripts/deploy.sh [staging|production] [options]"
  exit 1
fi

ENVIRONMENT=$1
DRY_RUN=false
STACK=""

# オプション解析
shift
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true ;;
    --stack) STACK="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Prance Platform Deployment${NC}"
echo -e "${GREEN}  Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"

# 環境変数読み込み
if [ "$ENVIRONMENT" = "staging" ]; then
  export AWS_PROFILE=prance-staging
  export AWS_REGION=us-east-1
  CDK_CONTEXT="--context environment=staging"
elif [ "$ENVIRONMENT" = "production" ]; then
  export AWS_PROFILE=prance-production
  export AWS_REGION=us-east-1
  CDK_CONTEXT="--context environment=production"
else
  echo -e "${RED}Error: Invalid environment. Use 'staging' or 'production'${NC}"
  exit 1
fi

# プロダクション環境は確認プロンプト
if [ "$ENVIRONMENT" = "production" ] && [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}⚠️  WARNING: Deploying to PRODUCTION${NC}"
  echo -e "${YELLOW}⚠️  This will affect live users${NC}"
  read -p "Are you sure you want to continue? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment cancelled"
    exit 1
  fi
fi

# Step 1: 依存関係インストール
echo -e "\n${GREEN}Step 1/6: Installing dependencies...${NC}"
npm install

# Step 2: ビルド
echo -e "\n${GREEN}Step 2/6: Building applications...${NC}"
npm run build

# Step 3: テスト実行
echo -e "\n${GREEN}Step 3/6: Running tests...${NC}"
npm run test:ci

# Step 4: データベースマイグレーション
echo -e "\n${GREEN}Step 4/6: Running database migrations...${NC}"
if [ "$DRY_RUN" = false ]; then
  npm run db:migrate:deploy
fi

# Step 5: CDK デプロイ
echo -e "\n${GREEN}Step 5/6: Deploying infrastructure...${NC}"
cd infrastructure

if [ "$DRY_RUN" = true ]; then
  npx cdk diff $CDK_CONTEXT $STACK
else
  if [ -n "$STACK" ]; then
    npx cdk deploy $CDK_CONTEXT $STACK --require-approval never
  else
    npx cdk deploy $CDK_CONTEXT --all --require-approval never
  fi
fi

cd ..

# Step 6: ヘルスチェック
if [ "$DRY_RUN" = false ]; then
  echo -e "\n${GREEN}Step 6/6: Running health checks...${NC}"
  ./scripts/health-check.sh $ENVIRONMENT
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$ENVIRONMENT" = "staging" ]; then
  echo -e "\nStaging URL: https://staging.prance.com"
elif [ "$ENVIRONMENT" = "production" ]; then
  echo -e "\nProduction URL: https://prance.com"
fi

echo -e "\nView logs: npm run logs:$ENVIRONMENT"
```

### 権限設定

```bash
# スクリプトに実行権限付与
chmod +x scripts/*.sh
```

---

## 手動デプロイ

### Step-by-Step デプロイ

#### 1. 事前準備

```bash
# AWSプロファイル確認
aws sts get-caller-identity --profile prance-staging

# 環境変数設定
export AWS_PROFILE=prance-staging
export AWS_REGION=us-east-1
```

#### 2. ビルド

```bash
# 全パッケージビルド
npm run build

# ビルド確認
ls -la apps/web/.next
ls -la apps/api/dist
ls -la apps/workers/dist
```

#### 3. テスト

```bash
# 単体テスト
npm run test

# E2Eテスト
npm run test:e2e

# Lintチェック
npm run lint
```

#### 4. データベースマイグレーション

```bash
# マイグレーションファイル生成
npm run db:migrate:dev --name add_new_field

# ステージング適用
DATABASE_URL="postgresql://..." npm run db:migrate:deploy

# マイグレーション確認
npm run db:migrate:status
```

#### 5. CDKデプロイ

```bash
cd infrastructure

# 差分確認
npx cdk diff --context environment=staging

# デプロイ（全スタック）
npx cdk deploy --context environment=staging --all

# 特定スタックのみ
npx cdk deploy --context environment=staging DatabaseStack
npx cdk deploy --context environment=staging ApiStack
npx cdk deploy --context environment=staging FrontendStack

cd ..
```

#### 6. ヘルスチェック

```bash
# APIヘルスチェック
curl https://api.staging.prance.com/health

# フロントエンドアクセス確認
curl -I https://staging.prance.com
```

---

## ロールバック

### ワンクリックロールバック

```bash
# 直前のバージョンにロールバック
./scripts/rollback.sh production

# 特定バージョンにロールバック
./scripts/rollback.sh production v1.2.3
```

### ロールバックスクリプト

**scripts/rollback.sh**:

```bash
#!/bin/bash

set -e

ENVIRONMENT=$1
VERSION=$2

if [ -z "$ENVIRONMENT" ]; then
  echo "Error: Environment not specified"
  echo "Usage: ./scripts/rollback.sh [staging|production] [version]"
  exit 1
fi

echo "========================================="
echo "  Rollback to ${VERSION:-previous version}"
echo "  Environment: $ENVIRONMENT"
echo "========================================="

# プロダクション環境は確認
if [ "$ENVIRONMENT" = "production" ]; then
  echo "⚠️  WARNING: Rolling back PRODUCTION"
  read -p "Are you sure? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Rollback cancelled"
    exit 1
  fi
fi

# バージョン指定なしの場合、直前のバージョンを取得
if [ -z "$VERSION" ]; then
  VERSION=$(git describe --tags --abbrev=0 HEAD^)
  echo "Rolling back to: $VERSION"
fi

# バージョンチェックアウト
git fetch --tags
git checkout $VERSION

# デプロイ
./scripts/deploy.sh $ENVIRONMENT

echo "Rollback completed: $VERSION"
```

### 手動ロールバック手順

#### 1. Lambda関数ロールバック

```bash
# 関数のバージョン一覧
aws lambda list-versions-by-function \
  --function-name prance-api-function

# 特定バージョンにエイリアス変更
aws lambda update-alias \
  --function-name prance-api-function \
  --name production \
  --function-version 42
```

#### 2. フロントエンドロールバック

```bash
# Amplify Hostingのデプロイ履歴
aws amplify list-jobs --app-id <app-id> --branch-name main

# 特定デプロイに復元
aws amplify start-deployment \
  --app-id <app-id> \
  --branch-name main \
  --job-id <job-id>
```

#### 3. データベースロールバック

```bash
# マイグレーションを1つ戻す
npm run db:migrate:rollback

# 特定マイグレーションまで戻す
npm run db:migrate:rollback --to 20260304000000
```

---

## 環境変数管理

### AWS Secrets Manager

#### 環境変数の登録

```bash
# JSONファイルから一括登録
aws secretsmanager create-secret \
  --name prance/staging/env \
  --secret-string file://.env.staging

# 個別に登録
aws secretsmanager put-secret-value \
  --secret-id prance/staging/ANTHROPIC_API_KEY \
  --secret-string "sk-ant-xxxxx"
```

#### 環境変数の取得

```bash
# 全環境変数取得
aws secretsmanager get-secret-value \
  --secret-id prance/staging/env \
  --query SecretString \
  --output text > .env.staging

# 個別取得
aws secretsmanager get-secret-value \
  --secret-id prance/staging/ANTHROPIC_API_KEY \
  --query SecretString \
  --output text
```

#### Lambda関数への環境変数注入

```typescript
// infrastructure/lib/api-stack.ts
const secret = secretsmanager.Secret.fromSecretNameV2(
  this,
  'EnvSecret',
  'prance/staging/env'
);

const lambdaFunction = new lambda.Function(this, 'ApiFunction', {
  // ...
  environment: {
    NODE_ENV: 'production',
    DATABASE_URL: secret.secretValueFromJson('DATABASE_URL').toString(),
    ANTHROPIC_API_KEY: secret.secretValueFromJson('ANTHROPIC_API_KEY').toString()
  }
});

secret.grantRead(lambdaFunction);
```

---

## デプロイ戦略

### Blue-Green デプロイ

```bash
# 新バージョン（Green）をデプロイ
./scripts/deploy.sh staging

# トラフィック切り替え
aws lambda update-alias \
  --function-name prance-api-function \
  --name production \
  --function-version $NEW_VERSION \
  --routing-config AdditionalVersionWeights={$OLD_VERSION=0.1}

# 問題なければ完全切り替え
aws lambda update-alias \
  --function-name prance-api-function \
  --name production \
  --function-version $NEW_VERSION
```

### Canary デプロイ

```typescript
// infrastructure/lib/api-stack.ts
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';

new codedeploy.LambdaDeploymentGroup(this, 'DeploymentGroup', {
  alias: alias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES
});
```

---

## モニタリング

### デプロイ後の確認

```bash
# CloudWatch Logsストリーム
aws logs tail /aws/lambda/prance-api-function --follow

# メトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=prance-api-function \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# エラー率確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=prance-api-function \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### アラート設定

```typescript
// infrastructure/lib/monitoring-stack.ts
const errorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
  metric: apiFunction.metricErrors(),
  threshold: 10,
  evaluationPeriods: 2,
  datapointsToAlarm: 2,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
});

const snsAction = new cloudwatch_actions.SnsAction(alarmTopic);
errorAlarm.addAlarmAction(snsAction);
```

---

## トラブルシューティング

### 問題1: デプロイ失敗

```bash
# エラーログ確認
npx cdk deploy --verbose

# スタック削除（注意: データ消失の可能性）
npx cdk destroy --context environment=staging

# 再デプロイ
./scripts/deploy.sh staging
```

### 問題2: Lambda関数エラー

```bash
# 最新のエラーログ取得
aws logs filter-log-events \
  --log-group-name /aws/lambda/prance-api-function \
  --filter-pattern "ERROR" \
  --max-items 10

# Lambda設定確認
aws lambda get-function-configuration \
  --function-name prance-api-function
```

### 問題3: データベース接続エラー

```bash
# Auroraエンドポイント確認
aws rds describe-db-clusters \
  --db-cluster-identifier prance-staging-cluster

# セキュリティグループ確認
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx

# Lambda VPC設定確認
aws lambda get-function-configuration \
  --function-name prance-api-function \
  --query 'VpcConfig'
```

### 問題4: フロントエンドビルドエラー

```bash
# Next.jsビルドログ
cd apps/web
npm run build -- --debug

# Amplify Hostingログ確認
aws amplify get-job \
  --app-id <app-id> \
  --branch-name main \
  --job-id <job-id>
```

---

## デプロイチェックリスト

### プロダクションデプロイ前

- [ ] ステージング環境で動作確認
- [ ] 全テストが合格
- [ ] データベースマイグレーションテスト済み
- [ ] 負荷テスト実施
- [ ] ロールバック計画作成
- [ ] ステークホルダー承認
- [ ] メンテナンス通知（必要な場合）
- [ ] バックアップ取得

### デプロイ後

- [ ] ヘルスチェック確認
- [ ] 主要機能の動作確認
- [ ] エラーログ確認（30分間）
- [ ] メトリクス監視（1時間）
- [ ] ユーザーフィードバック確認
- [ ] デプロイログ記録

---

## 緊急対応

### サービス停止時の手順

```bash
# 1. 問題の特定
./scripts/health-check.sh production

# 2. ロールバック判断
# - クリティカルなバグ → 即座にロールバック
# - 軽微な問題 → ホットフィックスデプロイ

# 3. ロールバック実行
./scripts/rollback.sh production

# 4. 問題調査
aws logs tail /aws/lambda/prance-api-function --since 30m

# 5. 修正・再デプロイ
git checkout -b hotfix/critical-bug
# 修正...
git commit -m "fix: critical bug"
git push
./scripts/deploy.sh production
```

---

次のステップ: [CI/CD](CICD.md) → [運用ガイド](OPERATIONS_GUIDE.md)
