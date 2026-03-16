# Phase 3.1: Custom Domains Implementation Summary

**Created:** 2026-03-17 00:05 JST
**Status:** ✅ Implementation Complete (Pending Deployment)
**Priority:** 🔴 High

---

## 📊 Implementation Overview

### Goals
カスタムドメインを使用して、本番環境レベルのURL構造を実現：

| Component | Before | After |
|-----------|--------|-------|
| Frontend | Vercel (手動設定) | **AWS Amplify Hosting** + `dev.app.prance.jp` |
| REST API | `ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev` | **`api.dev.app.prance.jp`** |
| WebSocket | `bu179h4agh.execute-api.us-east-1.amazonaws.com/dev` | **`ws.dev.app.prance.jp`** |
| CloudFront | `d3mx0sug5s3a6x.cloudfront.net` (dev.app.prance.jpにマッピング) | **S3アセット配信専用** |

---

## 🔧 Changes Made

### 1. New Infrastructure Stacks

#### **AmplifyStack** (`infrastructure/lib/amplify-stack.ts`) - 239 lines

**Purpose:** AWS Amplify HostingでNext.js SSRアプリをホスト

**Key Features:**
- **Platform:** `WEB_COMPUTE` (Next.js SSR対応)
- **Monorepo Support:** `appRoot: apps/web`
- **Custom Domain:** `dev.app.prance.jp`
- **SSL/TLS:** ACM証明書統合
- **CI/CD:** GitHub連携（自動ビルド・デプロイ）
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp`
  - `NEXT_PUBLIC_WS_URL=wss://ws.dev.app.prance.jp/dev`
  - `NEXT_PUBLIC_CLOUDFRONT_DOMAIN`

**BuildSpec:**
```yaml
version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
            - cd apps/web && npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
```

**Outputs:**
- App ID, ARN, Default Domain
- Custom Domain: `dev.app.prance.jp`
- Console URL

---

#### **ApiGatewayDomainStack** (`infrastructure/lib/api-gateway-domain-stack.ts`) - 120 lines

**Purpose:** API Gateway用カスタムドメイン設定

**Components:**

**1. REST API Domain (`api.dev.app.prance.jp`):**
- `apigateway.DomainName` with ACM certificate
- `apigateway.BasePathMapping` to REST API
- Route 53 A Record (Alias to API Gateway)

**2. WebSocket API Domain (`ws.dev.app.prance.jp`):**
- `apigatewayv2.CfnDomainName` with ACM certificate
- `apigatewayv2.CfnApiMapping` to WebSocket API
- Route 53 A Record (Alias to WebSocket API)

**Outputs:**
- REST API URL: `https://api.dev.app.prance.jp`
- WebSocket URL: `wss://ws.dev.app.prance.jp`
- Regional Domain Names (for DNS)

---

### 2. Modified Infrastructure Files

#### **`infrastructure/lib/api-lambda-stack.ts`** (2 changes)

**Change 1:** Export WebSocket Stage

```typescript
// Before:
const _wsStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', { ... });

// After:
public readonly webSocketStage: apigatewayv2.CfnStage;
// ...
this.webSocketStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', { ... });
```

**Reason:** ApiGatewayDomainStackがWebSocket Stage参照を必要とする

---

#### **`infrastructure/lib/storage-stack.ts`** (2 changes)

**Change 1:** CloudFrontからカスタムドメイン削除

```typescript
// Before:
domainNames: certificate && hostedZone ? [config.domain.fullDomain] : undefined,
certificate: certificate,

// After:
// Note: カスタムドメインは設定しない（S3アセット配信専用）
// フロントエンドは Amplify Hosting で dev.app.prance.jp を使用
```

**Change 2:** Route 53 Alias レコード削除

```typescript
// Before:
if (certificate && hostedZone) {
  new route53.ARecord(this, 'CDNAliasRecord', { ... });
}

// After:
// (削除 - AmplifyStackがフロントエンドのDNSレコードを管理)
```

**Reason:** フロントエンドはAmplify、CloudFrontはS3アセット配信のみ

---

#### **`infrastructure/bin/app.ts`** (3 changes)

**Change 1:** Import新スタック

```typescript
import { AmplifyStack } from '../lib/amplify-stack';
import { ApiGatewayDomainStack } from '../lib/api-gateway-domain-stack';
```

**Change 2:** スタックインスタンス化

```typescript
// API Gateway Custom Domains Stack (Phase 3.1)
const apiGatewayDomainStack = new ApiGatewayDomainStack(app, `${stackPrefix}-ApiDomains`, {
  env,
  config,
  certificate: certificateStack.certificate,
  hostedZone: dnsStack.hostedZone,
  restApi: apiLambdaStack.restApi,
  webSocketApi: apiLambdaStack.webSocketApi,
  webSocketStage: apiLambdaStack.webSocketStage,
  description: 'Prance Platform - API Gateway Custom Domains',
  crossRegionReferences: true,
});

// Amplify Hosting Stack (Phase 3.1)
const amplifyStack = new AmplifyStack(app, `${stackPrefix}-Amplify`, {
  env,
  config,
  certificate: certificateStack.certificate,
  hostedZone: dnsStack.hostedZone,
  description: 'Prance Platform - Amplify Hosting (Next.js SSR)',
  crossRegionReferences: true,
});
```

**Change 3:** スタック依存関係追加

```typescript
apiGatewayDomainStack.addDependency(apiLambdaStack);
apiGatewayDomainStack.addDependency(certificateStack);
amplifyStack.addDependency(certificateStack);
amplifyStack.addDependency(apiGatewayDomainStack); // API URLsが先に必要
```

---

### 3. Frontend Configuration Changes

#### **`apps/web/middleware.ts`** (No changes required)

**Current:**
```typescript
matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
```

**Note:** `_vercel` exclusionは残すが、Vercel特有の動作ではないので削除しても問題ない

---

### 4. Environment Variables

#### **`infrastructure/.env`** (To be added by user)

```bash
# GitHub Configuration (for Amplify Hosting)
GITHUB_REPO_URL=https://github.com/YOUR_ORG/prance-communication-platform
GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Security:**
- `.gitignore` で除外済み
- Secrets Managerに保存推奨

---

### 5. Documentation

#### **New Files:**

1. **`docs/09-progress/PHASE_3_1_DEPLOYMENT_GUIDE.md`** (485 lines)
   - 完全なデプロイ手順
   - Prerequisites（GitHub Token取得）
   - 6ステップのデプロイフロー
   - トラブルシューティング
   - チェックリスト

2. **`docs/09-progress/PHASE_3_1_IMPLEMENTATION_SUMMARY.md`** (This file)
   - 実装内容サマリー
   - 変更ファイル一覧
   - デプロイ前確認事項

#### **Updated Files:**

1. **`START_HERE.md`**
   - Phase 3.1進捗: 75%完了
   - ステータス: 実装完了、デプロイ待ち

2. **`docs/09-progress/PRODUCTION_READINESS_STATUS.md`**
   - 既に作成済み（Phase 3全体の状況分析）

---

## 📋 Files Changed Summary

| File | Lines | Type | Status |
|------|-------|------|--------|
| `infrastructure/lib/amplify-stack.ts` | +239 | New | ✅ |
| `infrastructure/lib/api-gateway-domain-stack.ts` | +120 | New | ✅ |
| `infrastructure/lib/api-lambda-stack.ts` | +1/-1 | Modified | ✅ |
| `infrastructure/lib/storage-stack.ts` | -12/+3 | Modified | ✅ |
| `infrastructure/bin/app.ts` | +28 | Modified | ✅ |
| `docs/09-progress/PHASE_3_1_DEPLOYMENT_GUIDE.md` | +485 | New | ✅ |
| `docs/09-progress/PHASE_3_1_IMPLEMENTATION_SUMMARY.md` | +XXX | New | ✅ |
| `START_HERE.md` | Modified | Modified | ✅ |

**Total:** 2 new stacks, 3 modified stacks, 3 new docs, 1 updated doc

---

## ✅ Pre-Deployment Checklist

### Code Review
- [ ] AmplifyStack buildSpec正しい？（Monorepo対応）
- [ ] ApiGatewayDomainStack DNS設定正しい？
- [ ] StorageStack CloudFront設定変更確認？
- [ ] app.ts スタック依存関係正しい？

### Environment Variables
- [ ] `infrastructure/.env` にGITHUB_REPO_URL追加？
- [ ] `infrastructure/.env` にGITHUB_ACCESS_TOKEN追加？
- [ ] GitHub Personal Access Tokenの権限確認？（repo, admin:repo_hook）

### DNS Preparation
- [ ] Route 53でVercel CNAMEレコード削除？
- [ ] `dev.app.prance.jp` が空いている？

### AWS Resources
- [ ] ACM証明書がus-east-1に存在？ ✅ (既に確認済み)
- [ ] Route 53 Hosted Zoneが存在？ ✅ (既に確認済み)
- [ ] API Gateway REST/WebSocket APIが存在？ ✅ (既に確認済み)

### Testing Plan
- [ ] デプロイ後のDNS伝播確認方法？
- [ ] E2Eテスト実行計画？
- [ ] ロールバック計画？

---

## 🚀 Next Steps

### 1. Commit Implementation (Now)

```bash
git add infrastructure/lib/amplify-stack.ts
git add infrastructure/lib/api-gateway-domain-stack.ts
git add infrastructure/lib/api-lambda-stack.ts
git add infrastructure/lib/storage-stack.ts
git add infrastructure/bin/app.ts
git add docs/09-progress/PHASE_3_1_*.md
git add START_HERE.md

git commit -m "feat(phase3.1): implement custom domains (Amplify + API Gateway)

- Add AmplifyStack for Next.js SSR hosting (dev.app.prance.jp)
- Add ApiGatewayDomainStack for API/WS custom domains
- Update StorageStack to remove CloudFront custom domain
- Add comprehensive deployment guide
- Export WebSocket Stage from ApiLambdaStack

Phase 3.1 progress: 75% complete (CDK implementation done, deployment pending)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 2. Environment Setup (User Action Required)

```bash
# 1. GitHub Personal Access Token取得
# https://github.com/settings/tokens → Generate new token (classic)
# Permissions: repo, admin:repo_hook

# 2. infrastructure/.env に追加
echo "GITHUB_REPO_URL=https://github.com/YOUR_ORG/prance-communication-platform" >> infrastructure/.env
echo "GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" >> infrastructure/.env
```

### 3. DNS Preparation

```bash
# Vercel CNAMEレコード削除
# 手順: docs/09-progress/PHASE_3_1_DEPLOYMENT_GUIDE.md参照
```

### 4. Deploy (Follow PHASE_3_1_DEPLOYMENT_GUIDE.md)

```bash
cd infrastructure

# Step 1: API Gateway Domains
npm run cdk -- deploy Prance-dev-ApiDomains --require-approval never

# Step 2: Amplify Hosting
npm run cdk -- deploy Prance-dev-Amplify --require-approval never

# Step 3: Storage (CloudFront update)
npm run cdk -- deploy Prance-dev-Storage --require-approval never
```

---

## 📚 References

- **Deployment Guide:** `docs/09-progress/PHASE_3_1_DEPLOYMENT_GUIDE.md`
- **Production Readiness:** `docs/09-progress/PRODUCTION_READINESS_STATUS.md`
- **AWS Amplify SSR:** https://docs.aws.amazon.com/amplify/latest/userguide/server-side-rendering-amplify.html
- **API Gateway Custom Domains:** https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html

---

**Implementation Status:** ✅ Complete
**Next Action:** Commit code, setup environment variables, deploy
**Estimated Deployment Time:** 20-30 minutes
**Estimated DNS Propagation Time:** 5-30 minutes

