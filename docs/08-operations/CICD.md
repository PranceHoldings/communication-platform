# CI/CD パイプライン

GitHub ActionsとAWS CDKによる自動化されたCI/CDパイプライン。

## パイプライン構成

```
Pull Request
   ↓
┌─────────────────────────────────┐
│ CI: Lint + Test + Build         │
│ (.github/workflows/ci.yml)      │
└─────────────────────────────────┘
   ↓ (承認後)
Main Branch Merge
   ↓
┌─────────────────────────────────┐
│ CD: Deploy to Staging           │
│ (.github/workflows/deploy-      │
│  staging.yml)                   │
└─────────────────────────────────┘
   ↓ (テスト後)
Tag Push (v*.*.*)
   ↓
┌─────────────────────────────────┐
│ CD: Deploy to Production        │
│ (.github/workflows/deploy-      │
│  production.yml)                │
└─────────────────────────────────┘
```

---

## CI ワークフロー

### .github/workflows/ci.yml

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm run lint

      - name: TypeScript check
        run: pnpm run type-check

      - name: Unit tests
        run: pnpm run test:ci

      - name: E2E tests
        run: pnpm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Build
        run: pnpm run build

  security-scan:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
```

---

## CD ワークフロー（ステージング）

### .github/workflows/deploy-staging.yml

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_STAGING }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_STAGING }}
          aws-region: us-east-1

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build

      - name: Run tests
        run: pnpm run test:ci

      - name: Database migration
        run: pnpm run db:migrate:deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_STAGING }}

      - name: Deploy infrastructure
        working-directory: infrastructure
        run: |
          pnpm exec cdk deploy \
            --context environment=staging \
            --all \
            --require-approval never

      - name: Health check
        run: |
          sleep 30
          ./scripts/health-check.sh staging

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Staging deployment ${{ job.status }}
            Commit: ${{ github.sha }}
            Author: ${{ github.actor }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## CD ワークフロー（プロダクション）

### .github/workflows/deploy-production.yml

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://prance.com

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.version || github.ref }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_PRODUCTION }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_PRODUCTION }}
          aws-region: us-east-1
          role-to-assume: arn:aws:iam::123456789012:role/GithubActionsDeployRole
          role-duration-seconds: 3600

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build

      - name: Run full test suite
        run: |
          pnpm run test:ci
          pnpm run test:e2e

      - name: Create backup
        run: |
          aws rds create-db-cluster-snapshot \
            --db-cluster-identifier prance-production-cluster \
            --db-cluster-snapshot-identifier backup-$(date +%Y%m%d%H%M%S)

      - name: Database migration (dry-run)
        run: pnpm run db:migrate:deploy -- --dry-run
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}

      - name: Database migration
        run: pnpm run db:migrate:deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}

      - name: Deploy infrastructure (Canary)
        working-directory: infrastructure
        run: |
          pnpm exec cdk deploy \
            --context environment=production \
            --context deploymentStrategy=canary \
            --all \
            --require-approval never

      - name: Wait for canary validation
        run: sleep 300

      - name: Promote canary
        run: |
          aws lambda update-alias \
            --function-name prance-api-function \
            --name production \
            --function-version ${{ steps.deploy.outputs.version }}

      - name: Run smoke tests
        run: pnpm run test:smoke -- --env=production

      - name: Health check
        run: ./scripts/health-check.sh production

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          body: |
            ## Changes in this Release
            ${{ github.event.head_commit.message }}

            ## Deployment Info
            - Environment: Production
            - Deployed at: ${{ github.event.repository.updated_at }}
            - Deployed by: ${{ github.actor }}

      - name: Notify Slack (Success)
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              "text": ":rocket: Production deployment successful!",
              "attachments": [{
                "color": "good",
                "fields": [
                  { "title": "Version", "value": "${{ github.ref }}", "short": true },
                  { "title": "Author", "value": "${{ github.actor }}", "short": true },
                  { "title": "URL", "value": "https://prance.com", "short": false }
                ]
              }]
            }
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

      - name: Notify Slack (Failure)
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              "text": ":fire: Production deployment FAILED!",
              "attachments": [{
                "color": "danger",
                "fields": [
                  { "title": "Version", "value": "${{ github.ref }}", "short": true },
                  { "title": "Author", "value": "${{ github.actor }}", "short": true },
                  { "title": "Action", "value": "Immediate rollback required", "short": false }
                ]
              }]
            }
          webhook_url: ${{ secrets.SLACK_WEBHOOK_CRITICAL }}

      - name: Rollback on failure
        if: failure()
        run: |
          PREVIOUS_VERSION=$(git describe --tags --abbrev=0 HEAD^)
          ./scripts/rollback.sh production $PREVIOUS_VERSION
```

---

## GitHub Secrets 設定

### 必要なシークレット

```bash
# AWS認証情報（ステージング）
AWS_ACCESS_KEY_ID_STAGING
AWS_SECRET_ACCESS_KEY_STAGING

# AWS認証情報（プロダクション）
AWS_ACCESS_KEY_ID_PRODUCTION
AWS_SECRET_ACCESS_KEY_PRODUCTION

# データベース
DATABASE_URL_STAGING
DATABASE_URL_PRODUCTION
TEST_DATABASE_URL

# 外部サービス
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
AZURE_SPEECH_KEY
AZURE_FACE_KEY

# 通知
SLACK_WEBHOOK
SLACK_WEBHOOK_CRITICAL

# セキュリティスキャン
SNYK_TOKEN
CODECOV_TOKEN
```

### シークレット登録

```bash
# GitHub CLIを使用
gh secret set AWS_ACCESS_KEY_ID_STAGING --body "AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY_STAGING --body "xxx..."

# または、GitHub UIから設定
# Settings → Secrets and variables → Actions → New repository secret
```

---

## ブランチ保護ルール

### main ブランチ保護設定

```yaml
# Settings → Branches → Branch protection rules

Protection rules:
  ✅ Require pull request reviews before merging
     - Required approvals: 1
     - Dismiss stale reviews: yes
     - Require review from Code Owners: yes

  ✅ Require status checks to pass before merging
     - lint-and-test
     - security-scan

  ✅ Require branches to be up to date before merging

  ✅ Require conversation resolution before merging

  ✅ Include administrators

  ✅ Restrict who can push to matching branches
     - Teams: backend-team, frontend-team, devops-team
```

---

## 環境ごとの設定

### Environment設定（GitHub）

```yaml
# Settings → Environments

Staging:
  Environment protection rules:
    - Required reviewers: (none)
    - Wait timer: 0 minutes
  Environment secrets:
    - AWS_ACCESS_KEY_ID_STAGING
    - AWS_SECRET_ACCESS_KEY_STAGING
    - DATABASE_URL_STAGING
  Deployment branches:
    - main

Production:
  Environment protection rules:
    - Required reviewers: @devops-team, @tech-lead
    - Wait timer: 5 minutes
  Environment secrets:
    - AWS_ACCESS_KEY_ID_PRODUCTION
    - AWS_SECRET_ACCESS_KEY_PRODUCTION
    - DATABASE_URL_PRODUCTION
  Deployment branches:
    - Tags: v*.*.*
```

---

## デプロイ承認フロー

### プロダクションデプロイ

```
1. タグプッシュ (v1.2.3)
   ↓
2. GitHub Actions起動
   ↓
3. ビルド・テスト実行
   ↓
4. 承認待機 (Required reviewers)
   ├─ DevOpsチームリーダー承認
   └─ Tech Lead承認
   ↓
5. デプロイ実行 (Canary)
   ↓
6. Canary検証 (5分間)
   ↓
7. 全トラフィック切り替え
   ↓
8. スモークテスト
   ↓
9. 完了通知 (Slack)
```

---

## モニタリング・アラート

### CloudWatch Alarm → SNS → Slack

```typescript
// infrastructure/lib/monitoring-stack.ts
const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
  displayName: 'Prance Platform Alarms',
});

// Slack連携（Lambda + SNS Subscription）
const slackNotifier = new lambda.Function(this, 'SlackNotifier', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromInline(`
    const https = require('https');

    exports.handler = async (event) => {
      const message = JSON.parse(event.Records[0].Sns.Message);

      const slackMessage = {
        text: \`:warning: CloudWatch Alarm: \${message.AlarmName}\`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'Alarm', value: message.AlarmName, short: true },
            { title: 'State', value: message.NewStateValue, short: true },
            { title: 'Reason', value: message.NewStateReason, short: false }
          ]
        }]
      };

      const options = {
        hostname: 'hooks.slack.com',
        path: process.env.SLACK_WEBHOOK_PATH,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          resolve({ statusCode: res.statusCode });
        });
        req.on('error', reject);
        req.write(JSON.stringify(slackMessage));
        req.end();
      });
    };
  `),
  environment: {
    SLACK_WEBHOOK_PATH: process.env.SLACK_WEBHOOK_PATH!,
  },
});

new sns.Subscription(this, 'SlackSubscription', {
  topic: alarmTopic,
  protocol: sns.SubscriptionProtocol.LAMBDA,
  endpoint: slackNotifier.functionArn,
});
```

---

## パフォーマンス最適化

### ビルドキャッシュ

```yaml
# .github/workflows/ci.yml
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: |
      node_modules
      */*/node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Cache Turborepo
  uses: actions/cache@v3
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

### 並列実行

```yaml
jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      -  # ... test frontend

  test-backend:
    runs-on: ubuntu-latest
    steps:
      -  # ... test backend

  test-workers:
    runs-on: ubuntu-latest
    steps:
      -  # ... test workers

  deploy:
    needs: [test-frontend, test-backend, test-workers]
    runs-on: ubuntu-latest
    steps:
      -  # ... deploy
```

---

## トラブルシューティング

### 問題1: デプロイ失敗

```bash
# GitHub Actions ログ確認
gh run list
gh run view <run-id>

# 再実行
gh run rerun <run-id>
```

### 問題2: シークレット更新

```bash
# シークレット更新
gh secret set DATABASE_URL_STAGING --body "new-value"

# 確認
gh secret list
```

### 問題3: CDK デプロイエラー

```bash
# ローカルで再現
AWS_PROFILE=prance-staging pnpm exec cdk deploy --context environment=staging

# スタックイベント確認
aws cloudformation describe-stack-events \
  --stack-name PranceStack-Staging
```

---

次のステップ: [運用ガイド](OPERATIONS_GUIDE.md) → [セキュリティ](SECURITY.md)
