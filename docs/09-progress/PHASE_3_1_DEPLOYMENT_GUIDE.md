# Phase 3.1: Custom Domains Deployment Guide

**Created:** 2026-03-16 23:55 JST
**Status:** 🟡 In Progress
**Priority:** 🔴 High

---

## 📋 Overview

Phase 3.1では、以下のカスタムドメインを設定します：

| Component | Custom Domain | Purpose |
|-----------|---------------|---------|
| Frontend (Amplify) | `dev.app.prance.jp` | Next.js SSR アプリケーション |
| REST API | `api.dev.app.prance.jp` | REST API エンドポイント |
| WebSocket API | `ws.dev.app.prance.jp` | WebSocket接続 |
| CloudFront CDN | `d3mx0sug5s3a6x.cloudfront.net` | S3アセット配信（カスタムドメインなし） |

---

## 🔧 Prerequisites

### 1. GitHub Personal Access Token作成

Amplify HostingがGitHubリポジトリにアクセスするために必要です。

**手順:**

1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" をクリック
3. 以下の権限を付与:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Full control of repository hooks)
4. トークンを生成してコピー

**セキュリティ:**
- トークンは一度しか表示されません
- AWS Secrets Managerに保存推奨

### 2. 環境変数の設定

`infrastructure/.env` に以下を追加:

```bash
# GitHub Configuration (for Amplify Hosting)
GITHUB_REPO_URL=https://github.com/YOUR_ORG/prance-communication-platform
GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email for CloudWatch Alarms (optional)
ALERT_EMAIL=your-email@example.com
```

**注意:** `.env` ファイルは `.gitignore` で除外されています。絶対にコミットしないでください。

---

## 🚀 Deployment Steps

### Step 1: Vercel DNS レコードの削除

**現在の問題:**
- Route 53に手動で作成された `dev.app.prance.jp` → Vercel のCNAMEレコードが存在
- CDKが管理するAレコードに戻す必要がある

**手順:**

```bash
# 1. 現在のDNSレコードを確認
aws route53 list-resource-record-sets \
  --hosted-zone-id Z061444035YYGCPJ5IJT0 \
  --query 'ResourceRecordSets[?Name==`dev.app.prance.jp.`]' \
  --output table

# 2. Vercel CNAMEレコードを削除
# AWS Console → Route 53 → Hosted zones → prance.jp → dev.app.prance.jp
# または、次のコマンドで削除（change-batch.jsonを作成）:

cat > /tmp/delete-vercel-record.json <<EOF
{
  "Changes": [
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "dev.app.prance.jp",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "1154c65973607637.vercel-dns-016.com"
          }
        ]
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id Z061444035YYGCPJ5IJT0 \
  --change-batch file:///tmp/delete-vercel-record.json
```

### Step 2: Infrastructure Deployment

**デプロイ順序（依存関係により自動的に実行）:**

1. Certificate Stack (既にデプロイ済み)
2. API Lambda Stack (既にデプロイ済み)
3. **API Gateway Domain Stack (新規)** ← API/WSカスタムドメイン
4. **Amplify Stack (新規)** ← フロントエンドホスティング

**実行コマンド:**

```bash
cd infrastructure

# 1. 環境変数確認
cat .env | grep -E "GITHUB_REPO_URL|GITHUB_ACCESS_TOKEN"

# 2. CDK Bootstrap（初回のみ）
pnpm run cdk -- bootstrap

# 3. API Gateway Domain Stack デプロイ
pnpm run cdk -- deploy Prance-dev-ApiDomains --require-approval never

# 4. Amplify Stack デプロイ
pnpm run cdk -- deploy Prance-dev-Amplify --require-approval never

# 5. Storage Stack 再デプロイ（CloudFrontからカスタムドメイン削除）
pnpm run cdk -- deploy Prance-dev-Storage --require-approval never
```

**推定時間:** 15-20分
- API Gateway Domain: 5-10分
- Amplify: 10-15分（初回ビルド含む）

### Step 3: Amplify初回ビルドのトリガー

Amplify Hostingは初回デプロイ後、手動でビルドをトリガーする必要があります。

**手順:**

1. AWS Console → Amplify → prance-web-dev
2. "Hosting environments" タブで "dev" ブランチを選択
3. "Redeploy this version" をクリック

または、CLIで:

```bash
# App IDを取得
APP_ID=$(aws cloudformation describe-stacks \
  --stack-name Prance-dev-Amplify \
  --query 'Stacks[0].Outputs[?OutputKey==`AppId`].OutputValue' \
  --output text)

# ビルドをトリガー
aws amplify start-job \
  --app-id $APP_ID \
  --branch-name dev \
  --job-type RELEASE
```

**ビルド確認:**

```bash
# ビルド状況確認
aws amplify list-jobs \
  --app-id $APP_ID \
  --branch-name dev \
  --max-results 5
```

### Step 4: DNS 伝播確認

**DNS確認コマンド:**

```bash
# 1. Amplify フロントエンド
dig dev.app.prance.jp +short
nslookup dev.app.prance.jp

# 2. REST API
dig api.dev.app.prance.jp +short

# 3. WebSocket API
dig ws.dev.app.prance.jp +short

# 4. DNS伝播確認
curl -I https://dev.app.prance.jp
curl -I https://api.dev.app.prance.jp/health
```

**期待される結果:**
- `dev.app.prance.jp` → Amplify CloudFront distribution
- `api.dev.app.prance.jp` → API Gateway regional endpoint
- `ws.dev.app.prance.jp` → API Gateway WebSocket endpoint

**DNS伝播時間:** 5-30分（TTL 300秒）

### Step 5: Frontend 環境変数の更新

Amplifyがデプロイされた後、フロントエンドの環境変数を更新:

**`apps/web/.env.local`:**

```bash
# 更新前（AWS直接URL）
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
NEXT_PUBLIC_WS_URL=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev

# 更新後（カスタムドメイン）
NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp/api/v1
NEXT_PUBLIC_WS_URL=wss://ws.dev.app.prance.jp/dev
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d3mx0sug5s3a6x.cloudfront.net
```

**Amplify環境変数も同期:**

```bash
# Amplify Console → App settings → Environment variables
# または、CLIで:

APP_ID=$(aws cloudformation describe-stacks \
  --stack-name Prance-dev-Amplify \
  --query 'Stacks[0].Outputs[?OutputKey==`AppId`].OutputValue' \
  --output text)

aws amplify update-app \
  --app-id $APP_ID \
  --environment-variables \
    NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp/api/v1 \
    NEXT_PUBLIC_WS_URL=wss://ws.dev.app.prance.jp/dev \
    NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d3mx0sug5s3a6x.cloudfront.net
```

### Step 6: 動作確認

**1. Frontend (Next.js SSR):**

```bash
curl -I https://dev.app.prance.jp
# Expected: 200 OK, HTML content

open https://dev.app.prance.jp
```

**2. REST API:**

```bash
curl https://api.dev.app.prance.jp/health
# Expected: {"status":"ok","timestamp":"..."}
```

**3. WebSocket API:**

```bash
# wscat インストール（未インストールの場合）
pnpm install -g wscat

# WebSocket接続テスト
wscat -c wss://ws.dev.app.prance.jp/dev
# Expected: Connected (press CTRL+C to quit)
```

**4. E2Eテスト実行:**

```bash
cd apps/web
pnpm run test:e2e -- stage1-basic-ui.spec.ts
```

---

## 🔍 Troubleshooting

### Issue 1: Amplify ビルドエラー

**症状:**
```
Build failed: Module not found: Can't resolve '@/lib/i18n/config'
```

**原因:** Monorepo構造でのパス解決エラー

**解決策:**

```bash
# buildSpecを修正
# preBuildで:
- pnpm install --frozen-lockfile
- cd apps/web && pnpm install --frozen-lockfile

# buildで:
- cd apps/web && pnpm run build
```

### Issue 2: DNS not resolving

**症状:**
```
curl: (6) Could not resolve host: api.dev.app.prance.jp
```

**原因:** DNS伝播未完了、またはRoute 53レコード未作成

**解決策:**

```bash
# 1. Route 53レコード確認
aws route53 list-resource-record-sets \
  --hosted-zone-id Z061444035YYGCPJ5IJT0 \
  --query 'ResourceRecordSets[?contains(Name, `api.dev`) || contains(Name, `ws.dev`)]'

# 2. DNS伝播確認
dig api.dev.app.prance.jp @8.8.8.8 +short

# 3. 待機（5-30分）
```

### Issue 3: API Gateway 403 Forbidden

**症状:**
```
{"message":"Forbidden"}
```

**原因:** カスタムドメインがAPI Gatewayにマッピングされていない

**解決策:**

```bash
# API Gateway マッピング確認
aws apigatewayv2 get-api-mappings \
  --domain-name api.dev.app.prance.jp

# 再デプロイ
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiDomains --require-approval never
```

### Issue 4: Amplify "Provisioning" stuck

**症状:** Amplify App Statusが "Provisioning" のまま進まない

**原因:** GitHub Access Token無効、またはリポジトリアクセス権限不足

**解決策:**

```bash
# 1. GitHub Access Token再生成
# 2. Secrets Managerに保存
aws secretsmanager create-secret \
  --name prance-github-token-dev \
  --secret-string "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 3. Amplify Stack再デプロイ
cd infrastructure
pnpm run cdk -- destroy Prance-dev-Amplify
pnpm run cdk -- deploy Prance-dev-Amplify --require-approval never
```

---

## 📊 Deployment Checklist

### Pre-Deployment
- [ ] GitHub Personal Access Token作成
- [ ] `infrastructure/.env` にGITHUB_REPO_URL, GITHUB_ACCESS_TOKEN追加
- [ ] Vercel DNSレコード削除確認

### Deployment
- [ ] API Gateway Domain Stack デプロイ完了
- [ ] Amplify Stack デプロイ完了
- [ ] Storage Stack 再デプロイ完了
- [ ] Amplify初回ビルドトリガー

### Post-Deployment
- [ ] DNS伝播確認（dev.app.prance.jp, api.dev.app.prance.jp, ws.dev.app.prance.jp）
- [ ] Frontend環境変数更新（.env.local, Amplify）
- [ ] Frontend動作確認（https://dev.app.prance.jp）
- [ ] REST API動作確認（https://api.dev.app.prance.jp/health）
- [ ] WebSocket接続確認（wss://ws.dev.app.prance.jp/dev）
- [ ] E2Eテスト実行（Stage 1-3）

### Documentation
- [ ] START_HERE.md更新（Phase 3.1完了、新しいURL）
- [ ] PRODUCTION_READINESS_STATUS.md更新（8/13 → 11/13）
- [ ] PHASE_3_1_DEPLOYMENT_GUIDE.md完成（このドキュメント）

---

## 📚 References

- [AWS Amplify Hosting - Next.js SSR](https://docs.aws.amazon.com/amplify/latest/userguide/server-side-rendering-amplify.html)
- [API Gateway Custom Domains](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)
- [Route 53 Alias Records](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html)

---

**Last Updated:** 2026-03-16 23:55 JST
**Status:** 🟡 Ready for deployment
**Next:** Execute deployment steps
