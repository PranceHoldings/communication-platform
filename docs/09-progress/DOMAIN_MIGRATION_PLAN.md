# Domain Migration Plan: prance.jp → prance.jp

**作成日:** 2026-03-13 00:30 JST
**ステータス:** 計画段階
**目的:** ドメインを prance.jp から prance.jp に移行し、URL構造を簡素化

---

## 変更サマリー

### 現在のドメイン構造

| 環境 | 現在のURL |
|------|----------|
| 開発 | `dev.app.prance.jp` |
| ステージング | `staging.app.prance.jp` |
| 本番 | `platform.prance.jp` |

### 新しいドメイン構造

| 環境 | 新しいURL | 用途 |
|------|----------|------|
| 開発 | `dev.app.prance.jp` | フロントエンドアプリケーション |
| ステージング | `staging.app.prance.jp` | フロントエンドアプリケーション |
| 本番 | `app.prance.jp` | フロントエンドアプリケーション |

**サブドメイン構造:**
- `app.prance.jp` - メインアプリケーション
- `api.prance.jp` - REST API（将来的にカスタムドメイン設定時）
- `ws.prance.jp` - WebSocket API（将来的にカスタムドメイン設定時）

---

## 影響範囲分析

### 1. インフラストラクチャ（CDK）

#### 1.1 `infrastructure/lib/config.ts` ✅ 最重要

**現在:**
```typescript
export const ROOT_DOMAIN = 'prance.jp';
export const PLATFORM_DOMAIN = 'platform.prance.jp';

dev: {
  domain: {
    root: 'prance.jp',
    platform: 'platform.prance.jp',
    subdomain: 'dev.platform',
    fullDomain: 'dev.app.prance.jp',
  },
}
```

**変更後:**
```typescript
export const ROOT_DOMAIN = 'prance.jp';
export const PLATFORM_DOMAIN = 'app.prance.jp';

dev: {
  domain: {
    root: 'prance.jp',
    platform: 'app.prance.jp',
    subdomain: 'dev.app',
    fullDomain: 'dev.app.prance.jp',
  },
}

staging: {
  domain: {
    root: 'prance.jp',
    platform: 'app.prance.jp',
    subdomain: 'staging.app',
    fullDomain: 'staging.app.prance.jp',
  },
}

production: {
  domain: {
    root: 'prance.jp',
    platform: 'app.prance.jp',
    subdomain: 'app',
    fullDomain: 'app.prance.jp',
  },
}
```

**影響を受けるスタック:**
- `DnsStack` - Route 53 Hosted Zone設定
- `CertificateStack` - SSL/TLS証明書（ACM）
- `StorageStack` - CloudFrontカスタムドメイン
- `ApiGatewayStack` - CORS設定（将来的にカスタムドメイン）

#### 1.2 `infrastructure/lib/dns-stack.ts`

**変更内容:**
- Hosted Zoneの参照先を `platform.prance.jp` → `app.prance.jp` に変更
- コメント・説明文の更新

**注意事項:**
- Route 53で新しいHosted Zoneを作成する必要がある
- お名前.comでNSレコードを設定する必要がある

#### 1.3 `infrastructure/lib/certificate-stack.ts`

**変更内容:**
- 証明書ドメインが自動的に新しいドメインに変更される（config.domain.fullDomainを使用）
- SubjectAlternativeNames: `api.{domain}`, `ws.{domain}`, `*.{domain}`

**注意事項:**
- 新しい証明書が発行されるまで5-30分かかる
- DNS検証が必要（自動）

#### 1.4 `infrastructure/lib/storage-stack.ts`

**変更内容:**
- CloudFrontのカスタムドメイン設定が自動的に更新される
- CORS設定は `allowedOrigins: ['*']` のまま（開発環境）

**TODO:**
```typescript
// 本番環境ではCORS制限を追加
cors: [
  {
    allowedOrigins: [
      `https://${config.domain.fullDomain}`,
      `https://api.${config.domain.fullDomain}`,
    ],
    // ...
  },
]
```

#### 1.5 `infrastructure/lib/api-gateway-stack.ts`

**変更内容:**
- CORS設定: `allowOrigins: apigateway.Cors.ALL_ORIGINS`（開発環境）

**TODO:**
```typescript
// 本番環境ではCORS制限を追加
defaultCorsPreflightOptions: {
  allowOrigins: [
    `https://${config.domain.fullDomain}`,
  ],
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  allowCredentials: true,
}
```

#### 1.6 `infrastructure/lib/cognito-stack.ts`

**変更内容:**
- User Pool Clientに `callbackUrls` と `logoutUrls` を追加

**TODO:**
```typescript
this.userPoolClient = new cognito.UserPoolClient(this, 'PranceUserPoolClient', {
  // ... existing config
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
    callbackUrls: [
      `https://${config.domain.fullDomain}/auth/callback`,
      'http://localhost:3000/auth/callback', // 開発用
    ],
    logoutUrls: [
      `https://${config.domain.fullDomain}/auth/logout`,
      'http://localhost:3000/auth/logout', // 開発用
    ],
  },
});
```

---

### 2. Lambda環境変数

#### 2.1 `infrastructure/lambda/guest-sessions/create/index.ts`

**現在:**
```typescript
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const inviteUrl = `${FRONTEND_URL}/guest/${token}`;
```

**変更:**
- 環境変数 `FRONTEND_URL` を設定する必要がある
- 開発: `https://dev.app.prance.jp`
- ステージング: `https://staging.app.prance.jp`
- 本番: `https://app.prance.jp`

**影響を受けるファイル:**
- `infrastructure/lambda/guest-sessions/create/index.ts`
- `infrastructure/lambda/guest-sessions/batch/index.ts`
- `infrastructure/lambda/shared/utils/tokenGenerator.ts`

#### 2.2 `infrastructure/lib/api-lambda-stack.ts`

**TODO: 環境変数に追加**
```typescript
const commonEnv = {
  // ... existing env vars
  FRONTEND_URL: `https://${config.domain.fullDomain}`,
};
```

---

### 3. フロントエンド（Next.js）

#### 3.1 `apps/web/.env.local`

**現在:**
```bash
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
NEXT_PUBLIC_WS_ENDPOINT=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

**変更後（カスタムドメイン設定時）:**
```bash
NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp/api/v1
NEXT_PUBLIC_WS_ENDPOINT=wss://ws.dev.app.prance.jp
NEXT_PUBLIC_APP_URL=https://dev.app.prance.jp
```

**注意:**
- 現時点ではAPI GatewayのデフォルトURLを使用
- 将来的にカスタムドメインを設定する場合は更新

#### 3.2 `apps/web/.env.local.example`

**更新内容:**
- コメントに新しいドメイン構造を記載
- サンプルURLを更新

#### 3.3 `apps/web/next.config.js`

**変更不要** - 環境変数を使用しているため

---

### 4. ドキュメント

#### 4.1 更新が必要なドキュメント

検出されたドキュメント:
```
infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md
infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md
infrastructure/docs/DOMAIN_SETUP.md
```

**更新内容:**
- 全ての `prance.jp` → `prance.jp` に置換
- 全ての `platform.prance.jp` → `app.prance.jp` に置換
- URL例の更新
- スクリーンショット・図の更新（必要に応じて）

#### 4.2 新規ドキュメント

作成が必要:
- `docs/06-infrastructure/DOMAIN_MIGRATION_GUIDE.md` - 移行手順書
- `docs/09-progress/DOMAIN_MIGRATION_CHECKLIST.md` - 移行チェックリスト

---

### 5. 環境変数ファイル

#### 5.1 プロジェクトルート

**ファイル:**
- `.env.example` - サンプル更新
- `.env.local` - 開発環境設定（手動更新）

**変更内容:**
```bash
# Frontend
FRONTEND_URL=https://dev.app.prance.jp

# Backend
API_URL=https://api.dev.app.prance.jp
WS_URL=wss://ws.dev.app.prance.jp
```

#### 5.2 infrastructure/.env

**変更内容:**
```bash
ENVIRONMENT=dev
AWS_REGION=us-east-1
CDK_DEFAULT_ACCOUNT=010438500933
CDK_DEFAULT_REGION=us-east-1

# Domain Configuration
ROOT_DOMAIN=prance.jp
PLATFORM_DOMAIN=app.prance.jp
```

---

### 6. スクリプト

影響を受けるスクリプトは検出されませんでした。

---

## 移行手順

### Phase 1: Route 53セットアップ（事前準備）

**推定時間:** 1-2時間（DNS伝播含む）

#### Step 1.1: Route 53でHosted Zoneを作成

```bash
aws route53 create-hosted-zone \
  --name app.prance.jp \
  --caller-reference "prance-app-$(date +%s)"
```

**出力例:**
```json
{
  "HostedZone": {
    "Id": "/hostedzone/ZXXXXXXXXXXXXX",
    "Name": "app.prance.jp.",
    ...
  },
  "DelegationSet": {
    "NameServers": [
      "ns-1234.awsdns-00.com",
      "ns-5678.awsdns-00.co.uk",
      "ns-9012.awsdns-00.org",
      "ns-3456.awsdns-00.net"
    ]
  }
}
```

#### Step 1.2: お名前.comでNSレコードを設定

1. お名前.com Naviにログイン
2. `prance.jp` のDNS設定画面に移動
3. サブドメイン `app` のNSレコードを追加:
   ```
   app  NS  ns-1234.awsdns-00.com
   app  NS  ns-5678.awsdns-00.co.uk
   app  NS  ns-9012.awsdns-00.org
   app  NS  ns-3456.awsdns-00.net
   ```

#### Step 1.3: DNS伝播確認

```bash
# NSレコード確認
dig app.prance.jp NS +short

# 期待される出力: 上記4つのネームサーバー
```

**待機時間:** 10分〜1時間（DNS伝播）

---

### Phase 2: コード変更（開発環境）

**推定時間:** 30分

#### Step 2.1: config.tsを更新

```bash
# バックアップ作成
cp infrastructure/lib/config.ts infrastructure/lib/config.ts.backup

# 編集
code infrastructure/lib/config.ts
```

**変更内容:**
```typescript
export const ROOT_DOMAIN = 'prance.jp';
export const PLATFORM_DOMAIN = 'app.prance.jp';

// dev, staging, production の domain 設定を全て更新
```

#### Step 2.2: Lambda環境変数を追加

`infrastructure/lib/api-lambda-stack.ts`:
```typescript
const commonEnv = {
  // ... existing
  FRONTEND_URL: `https://${config.domain.fullDomain}`,
};
```

#### Step 2.3: Cognito CallbackURLを追加

`infrastructure/lib/cognito-stack.ts`:
```typescript
oAuth: {
  // ... existing
  callbackUrls: [
    `https://${config.domain.fullDomain}/auth/callback`,
    'http://localhost:3000/auth/callback',
  ],
  logoutUrls: [
    `https://${config.domain.fullDomain}/auth/logout`,
    'http://localhost:3000/auth/logout',
  ],
}
```

---

### Phase 3: CDKデプロイ（開発環境）

**推定時間:** 15-30分

#### Step 3.1: DNS Stackデプロイ

```bash
cd infrastructure
npm run cdk -- deploy Prance-dev-Dns --require-approval never
```

**確認:**
- Hosted Zone ID出力
- Application Domain出力

#### Step 3.2: Certificate Stackデプロイ（us-east-1）

```bash
# CloudFront用証明書はus-east-1に作成する必要がある
npm run cdk -- deploy Prance-dev-Certificate \
  --require-approval never \
  --region us-east-1
```

**確認:**
- 証明書ARN出力
- DNS検証レコードが自動作成される
- 証明書ステータス: ISSUED（5-30分かかる場合あり）

```bash
# 証明書ステータス確認
aws acm describe-certificate \
  --certificate-arn <ARN> \
  --region us-east-1 \
  --query 'Certificate.Status'
```

#### Step 3.3: Storage Stack（CloudFront）デプロイ

```bash
npm run cdk -- deploy Prance-dev-Storage --require-approval never
```

**確認:**
- CloudFront Distribution作成
- カスタムドメイン設定
- A Recordが自動作成される

#### Step 3.4: API Lambda Stackデプロイ

```bash
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

**確認:**
- Lambda環境変数に `FRONTEND_URL` が設定される

#### Step 3.5: Cognito Stackデプロイ

```bash
npm run cdk -- deploy Prance-dev-Cognito --require-approval never
```

**確認:**
- User Pool Client設定更新
- CallbackURLs, LogoutURLs設定

---

### Phase 4: 動作確認

**推定時間:** 30分

#### Step 4.1: DNS確認

```bash
# A Record確認
dig dev.app.prance.jp A +short

# CloudFront確認
curl -I https://dev.app.prance.jp

# 期待: 200 OK または CloudFront応答
```

#### Step 4.2: SSL証明書確認

```bash
# 証明書情報確認
echo | openssl s_client -connect dev.app.prance.jp:443 -servername dev.app.prance.jp 2>/dev/null | openssl x509 -noout -subject -dates

# 期待:
# subject=CN=dev.app.prance.jp
# notAfter=...（有効期限）
```

#### Step 4.3: アプリケーション動作確認

1. **フロントエンド:**
   ```bash
   # 開発サーバー起動
   cd apps/web
   npm run dev

   # ブラウザでアクセス: http://localhost:3000
   ```

2. **ゲストセッション作成テスト:**
   ```bash
   TOKEN=$(curl -X POST https://API_URL/dev/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@prance.com","password":"Admin2026!Prance"}' \
     | jq -r .accessToken)

   curl -X POST https://API_URL/dev/api/v1/guest-sessions \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "scenarioId":"...",
       "validUntil":"2026-12-31T23:59:59Z"
     }' | jq .

   # 確認: inviteUrl が https://dev.app.prance.jp/guest/{token} になっている
   ```

3. **認証フロー確認:**
   - ログインページアクセス
   - Cognitoリダイレクト確認
   - CallbackURL確認

---

### Phase 5: ドキュメント更新

**推定時間:** 1時間

#### Step 5.1: ドキュメント一括置換

```bash
# バックアップ作成
cp -r docs docs.backup
cp -r infrastructure/docs infrastructure/docs.backup

# 置換実行
find docs infrastructure/docs -name "*.md" -type f -exec sed -i \
  -e 's/prance\.co\.jp/prance.jp/g' \
  -e 's/platform\.prance/app.prance/g' \
  {} +
```

#### Step 5.2: 個別ドキュメント確認

手動確認が必要なドキュメント:
- `infrastructure/docs/DOMAIN_SETUP.md`
- `infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md`
- `infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md`
- `START_HERE.md`
- `CLAUDE.md`

#### Step 5.3: 新規ドキュメント作成

- `docs/06-infrastructure/DOMAIN_MIGRATION_GUIDE.md` - この移行ガイドの最終版
- `docs/09-progress/DOMAIN_MIGRATION_COMPLETE.md` - 完了レポート

---

### Phase 6: ステージング・本番環境（将来）

**前提条件:**
- 開発環境での動作確認完了
- 全テスト合格

**手順:**
1. Phase 2-5をステージング環境で実行
2. E2Eテスト実行
3. Phase 2-5を本番環境で実行
4. 本番動作確認

---

## ロールバック計画

### 緊急時のロールバック手順

#### 1. config.tsを元に戻す

```bash
cp infrastructure/lib/config.ts.backup infrastructure/lib/config.ts
```

#### 2. CDKスタックを再デプロイ

```bash
npm run cdk -- deploy Prance-dev-Dns --require-approval never
npm run cdk -- deploy Prance-dev-Certificate --require-approval never --region us-east-1
npm run cdk -- deploy Prance-dev-Storage --require-approval never
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
npm run cdk -- deploy Prance-dev-Cognito --require-approval never
```

#### 3. DNS確認

```bash
dig dev.app.prance.jp A +short
```

---

## チェックリスト

### 事前準備

- [ ] Route 53でHosted Zone作成（`app.prance.jp`）
- [ ] お名前.comでNSレコード設定
- [ ] DNS伝播確認（10分〜1時間）
- [ ] バックアップ作成（config.ts, ドキュメント）

### コード変更

- [ ] `infrastructure/lib/config.ts` 更新
  - [ ] ROOT_DOMAIN = 'prance.jp'
  - [ ] PLATFORM_DOMAIN = 'app.prance.jp'
  - [ ] dev.domain 設定更新
  - [ ] staging.domain 設定更新
  - [ ] production.domain 設定更新
- [ ] `infrastructure/lib/api-lambda-stack.ts` 環境変数追加
  - [ ] FRONTEND_URL = `https://${config.domain.fullDomain}`
- [ ] `infrastructure/lib/cognito-stack.ts` CallbackURL追加
  - [ ] callbackUrls 設定
  - [ ] logoutUrls 設定
- [ ] `infrastructure/lib/storage-stack.ts` CORS更新（本番環境のみ）
- [ ] `infrastructure/lib/api-gateway-stack.ts` CORS更新（本番環境のみ）

### CDKデプロイ

- [ ] Dns Stack デプロイ
- [ ] Certificate Stack デプロイ（us-east-1）
- [ ] 証明書発行確認（5-30分）
- [ ] Storage Stack デプロイ
- [ ] API Lambda Stack デプロイ
- [ ] Cognito Stack デプロイ

### 動作確認

- [ ] DNS A Record確認
- [ ] SSL証明書確認
- [ ] フロントエンドアクセス確認
- [ ] ゲストセッション作成テスト
  - [ ] inviteUrl確認（新ドメイン）
- [ ] 認証フロー確認
  - [ ] ログイン
  - [ ] Cognitoリダイレクト
  - [ ] Callback

### ドキュメント更新

- [ ] ドキュメント一括置換実行
- [ ] 個別ドキュメント確認
- [ ] 新規ドキュメント作成
  - [ ] DOMAIN_MIGRATION_GUIDE.md
  - [ ] DOMAIN_MIGRATION_COMPLETE.md
- [ ] START_HERE.md 更新
- [ ] CLAUDE.md 更新

### 環境変数更新

- [ ] `.env.local` 更新
- [ ] `.env.example` 更新
- [ ] `infrastructure/.env` 更新
- [ ] `apps/web/.env.local` 更新
- [ ] `apps/web/.env.local.example` 更新

---

## 注意事項

### 重要な注意点

1. **DNS伝播時間**
   - NSレコード設定後、10分〜1時間の伝播時間が必要
   - 確認コマンド: `dig app.prance.jp NS +short`

2. **証明書発行時間**
   - ACM証明書の発行には5-30分かかる
   - DNS検証が自動的に行われる
   - 確認コマンド: `aws acm describe-certificate --certificate-arn <ARN> --region us-east-1`

3. **CloudFrontのデプロイ時間**
   - Distribution作成・更新には10-15分かかる
   - カスタムドメイン設定には追加時間が必要

4. **環境変数の反映**
   - Lambda関数: デプロイ後即座に反映
   - Next.js: 開発サーバー再起動が必要

5. **CORS設定**
   - 開発環境: `allowOrigins: ['*']`（全許可）
   - 本番環境: 特定ドメインに制限（セキュリティ強化）

6. **ロールバック**
   - 問題が発生した場合は即座にロールバック可能
   - バックアップファイルを保持すること

---

## トラブルシューティング

### 問題1: DNS解決ができない

**症状:**
```bash
dig dev.app.prance.jp A
# → NXDOMAIN
```

**原因:**
- お名前.comでNSレコードが設定されていない
- DNS伝播が完了していない

**解決策:**
1. お名前.comでNSレコード確認
2. 10-60分待機
3. `dig app.prance.jp NS +short` で伝播確認

### 問題2: SSL証明書エラー

**症状:**
```bash
curl https://dev.app.prance.jp
# → SSL certificate problem
```

**原因:**
- 証明書がまだ発行されていない
- DNS検証が完了していない

**解決策:**
1. 証明書ステータス確認:
   ```bash
   aws acm describe-certificate --certificate-arn <ARN> --region us-east-1
   ```
2. ステータスが `PENDING_VALIDATION` の場合は待機（5-30分）
3. ステータスが `ISSUED` になるまで待つ

### 問題3: CloudFrontがカスタムドメインで応答しない

**症状:**
```bash
curl -I https://dev.app.prance.jp
# → タイムアウト または 403 Forbidden
```

**原因:**
- CloudFront Distributionの更新が完了していない
- A Recordが作成されていない

**解決策:**
1. CloudFront Distribution確認:
   ```bash
   aws cloudfront list-distributions \
     --query "DistributionList.Items[?Aliases.Items[?contains(@, 'dev.app.prance.jp')]].{Id:Id,Status:Status,DomainName:DomainName}"
   ```
2. ステータスが `Deployed` になるまで待機（10-15分）
3. A Record確認:
   ```bash
   aws route53 list-resource-record-sets \
     --hosted-zone-id <ZONE_ID> \
     --query "ResourceRecordSets[?Name=='dev.app.prance.jp.']"
   ```

### 問題4: ゲストセッションのinviteURLが古いドメイン

**症状:**
```json
{
  "inviteUrl": "http://localhost:3000/guest/..."
}
```

**原因:**
- Lambda環境変数 `FRONTEND_URL` が設定されていない
- Lambda関数が再デプロイされていない

**解決策:**
1. 環境変数確認:
   ```bash
   aws lambda get-function-configuration \
     --function-name prance-guest-sessions-create-dev \
     --query 'Environment.Variables.FRONTEND_URL'
   ```
2. 設定されていない場合は `api-lambda-stack.ts` を更新して再デプロイ

### 問題5: Cognito認証リダイレクトエラー

**症状:**
```
redirect_uri_mismatch
```

**原因:**
- User Pool ClientのCallbackURLが更新されていない

**解決策:**
1. User Pool Client設定確認:
   ```bash
   aws cognito-idp describe-user-pool-client \
     --user-pool-id <POOL_ID> \
     --client-id <CLIENT_ID> \
     --query 'UserPoolClient.CallbackURLs'
   ```
2. 新しいドメインが含まれていない場合は `cognito-stack.ts` を更新して再デプロイ

---

## まとめ

### 推定総時間

- **Phase 1（Route 53セットアップ）:** 1-2時間
- **Phase 2（コード変更）:** 30分
- **Phase 3（CDKデプロイ）:** 15-30分
- **Phase 4（動作確認）:** 30分
- **Phase 5（ドキュメント更新）:** 1時間

**合計:** 3-4.5時間（DNS伝播・証明書発行時間含む）

### 次のステップ

1. ✅ この計画書をレビュー
2. ⏳ Phase 1: Route 53セットアップ実行
3. ⏳ Phase 2: コード変更実行
4. ⏳ Phase 3-5: デプロイ・確認・ドキュメント更新

---

**次回セッション開始時:**
「ドメイン移行を開始します。Phase 1のRoute 53セットアップから実行してください。」
