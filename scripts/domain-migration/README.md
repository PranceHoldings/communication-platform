# Domain Migration Scripts

**目的:** `prance.co.jp` から `prance.jp` へのドメイン移行を自動化

---

## スクリプト一覧

| スクリプト | 用途 | 推定時間 |
|----------|------|---------|
| `00-backup.sh` | 全設定ファイルのバックアップ | 1分 |
| `01-update-config.sh` | config.tsとCDK設定の更新 | 2分 |
| `02-update-docs.sh` | ドキュメントの一括更新 | 3分 |
| `03-update-env.sh` | 環境変数ファイルの更新 | 1分 |
| `99-rollback.sh` | 緊急ロールバック（元に戻す） | 2分 |

---

## 実行手順

### 前提条件

✅ Route 53でHosted Zone作成済み (`app.prance.jp`)
✅ お名前.comでNSレコード設定済み
✅ DNS伝播確認済み (`dig app.prance.jp NS +short`)

### Phase 0: バックアップ

```bash
cd /workspaces/prance-communication-platform/scripts/domain-migration
./00-backup.sh
```

**確認:**
- バックアップディレクトリが作成される: `backups/domain-migration-YYYYMMDD-HHMMSS/`
- 全設定ファイルがコピーされる

---

### Phase 1: Config更新

```bash
./01-update-config.sh
```

**自動更新されるファイル:**
- `infrastructure/lib/config.ts`
  - `ROOT_DOMAIN = 'prance.jp'`
  - `PLATFORM_DOMAIN = 'app.prance.jp'`
  - 全環境のdomain設定
- `infrastructure/lib/dns-stack.ts`
  - コメント内のドメイン名

**⚠️ 手動編集が必要:**

#### 1. `infrastructure/lib/api-lambda-stack.ts`

Lambda環境変数に `FRONTEND_URL` を追加:

```typescript
const commonEnv = {
  ENVIRONMENT: config.environment,
  AWS_REGION: this.region,
  DATABASE_URL: dbSecret.secretValueFromJson('host').toString(),
  BEDROCK_REGION: 'us-east-1',
  // ... 他の環境変数

  // ✅ 追加
  FRONTEND_URL: `https://${config.domain.fullDomain}`,
};
```

#### 2. `infrastructure/lib/cognito-stack.ts`

User Pool ClientにCallbackURLsを追加:

```typescript
this.userPoolClient = new cognito.UserPoolClient(this, 'PranceUserPoolClient', {
  userPool: this.userPool,
  userPoolClientName: `prance-web-${props.environment}`,
  authFlows: {
    userPassword: true,
    userSrp: true,
    custom: false,
  },
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
    // ✅ 追加
    callbackUrls: [
      `https://${props.environment === 'production' ? '' : `${props.environment}.`}app.prance.jp/auth/callback`,
      'http://localhost:3000/auth/callback', // 開発用
    ],
    logoutUrls: [
      `https://${props.environment === 'production' ? '' : `${props.environment}.`}app.prance.jp/auth/logout`,
      'http://localhost:3000/auth/logout', // 開発用
    ],
  },
  preventUserExistenceErrors: true,
  refreshTokenValidity: cdk.Duration.days(30),
  accessTokenValidity: cdk.Duration.hours(1),
  idTokenValidity: cdk.Duration.hours(1),
});
```

**注意:** 上記のコードでは環境に応じて自動的にURLが生成されます:
- 開発: `https://dev.app.prance.jp/auth/callback`
- ステージング: `https://staging.app.prance.jp/auth/callback`
- 本番: `https://app.prance.jp/auth/callback`

#### 3. 本番環境のCORS制限（オプション）

**`infrastructure/lib/storage-stack.ts`:**

```typescript
cors: [
  {
    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
    allowedOrigins: config.environment === 'production'
      ? [`https://${config.domain.fullDomain}`]
      : ['*'], // 開発環境は全許可
    allowedHeaders: ['*'],
    exposedHeaders: ['ETag'],
    maxAge: 3000,
  },
]
```

**`infrastructure/lib/api-gateway-stack.ts`:**

```typescript
defaultCorsPreflightOptions: {
  allowOrigins: config.environment === 'production'
    ? [`https://${config.domain.fullDomain}`]
    : apigateway.Cors.ALL_ORIGINS, // 開発環境は全許可
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  allowCredentials: true,
}
```

---

### Phase 2: ドキュメント更新

```bash
./02-update-docs.sh
```

**自動更新されるファイル:**
- `docs/` 配下の全Markdownファイル
- `infrastructure/docs/` 配下の全Markdownファイル
- `START_HERE.md`
- `CLAUDE.md`

**置換内容:**
- `prance.co.jp` → `prance.jp`
- `platform.prance.co.jp` → `app.prance.jp`
- `dev.platform.prance.jp` → `dev.app.prance.jp`
- `staging.platform.prance.jp` → `staging.app.prance.jp`

---

### Phase 3: 環境変数更新

```bash
./03-update-env.sh
```

**自動更新されるファイル:**
- `.env.example`
- `infrastructure/.env`
- `apps/web/.env.local.example`

**⚠️ 手動編集が必要:**

#### 1. `.env.local` (存在する場合)

```bash
FRONTEND_URL=https://dev.app.prance.jp
```

#### 2. `apps/web/.env.local` (存在する場合)

```bash
NEXT_PUBLIC_APP_URL=https://dev.app.prance.jp

# 注: 以下はカスタムドメイン設定時のみ
# NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp/api/v1
# NEXT_PUBLIC_WS_ENDPOINT=wss://ws.dev.app.prance.jp
```

---

### Phase 4: 変更内容の確認

```bash
cd /workspaces/prance-communication-platform

# 変更されたファイル一覧
git status

# 変更内容の詳細
git diff infrastructure/lib/config.ts
git diff infrastructure/lib/cognito-stack.ts
git diff infrastructure/lib/api-lambda-stack.ts

# 全ての変更を確認
git diff
```

---

### Phase 5: コミット

```bash
git add .
git commit -m "chore: migrate domain from prance.co.jp to prance.jp

- Update ROOT_DOMAIN: prance.co.jp → prance.jp
- Update PLATFORM_DOMAIN: platform.prance.co.jp → app.prance.jp
- Add FRONTEND_URL to Lambda environment variables
- Add Cognito OAuth callback URLs
- Update all documentation

Affected files:
- infrastructure/lib/config.ts
- infrastructure/lib/api-lambda-stack.ts
- infrastructure/lib/cognito-stack.ts
- infrastructure/lib/dns-stack.ts
- docs/**/*.md
- Environment files

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Phase 6: CDKデプロイ

#### 6.1 DNS Stack

```bash
cd infrastructure
pnpm run cdk -- deploy Prance-dev-Dns --require-approval never
```

**確認:**
- ✅ Hosted Zone ID出力
- ✅ Application Domain出力: `dev.app.prance.jp`

#### 6.2 Certificate Stack（us-east-1）

```bash
pnpm run cdk -- deploy Prance-dev-Certificate \
  --require-approval never \
  --region us-east-1
```

**確認:**
- ✅ 証明書ARN出力
- ✅ DNS検証レコード自動作成
- ⏳ 証明書ステータス確認（5-30分）:

```bash
aws acm describe-certificate \
  --certificate-arn <ARN> \
  --region us-east-1 \
  --query 'Certificate.Status'

# 期待: "ISSUED"
```

#### 6.3 Storage Stack（CloudFront）

```bash
pnpm run cdk -- deploy Prance-dev-Storage --require-approval never
```

**確認:**
- ✅ CloudFront Distribution作成
- ✅ カスタムドメイン設定
- ✅ A Record自動作成

#### 6.4 API Lambda Stack

```bash
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

**確認:**
- ✅ Lambda環境変数に `FRONTEND_URL` 設定

#### 6.5 Cognito Stack

```bash
pnpm run cdk -- deploy Prance-dev-Cognito --require-approval never
```

**確認:**
- ✅ User Pool Client CallbackURLs設定

---

### Phase 7: 動作確認

#### 7.1 DNS確認

```bash
# A Record確認
dig dev.app.prance.jp A +short

# CloudFront確認
curl -I https://dev.app.prance.jp

# 期待: 200 OK または CloudFront応答
```

#### 7.2 SSL証明書確認

```bash
echo | openssl s_client -connect dev.app.prance.jp:443 -servername dev.app.prance.jp 2>/dev/null | openssl x509 -noout -subject -dates

# 期待:
# subject=CN=dev.app.prance.jp
# notAfter=...
```

#### 7.3 ゲストセッション作成テスト

```bash
# 認証トークン取得
TOKEN=$(curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prance.com","password":"Admin2026!Prance"}' \
  | jq -r .accessToken)

# ゲストセッション作成
curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest-sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioId":"<YOUR_SCENARIO_ID>",
    "validUntil":"2026-12-31T23:59:59Z"
  }' | jq .

# 確認:
# "inviteUrl": "https://dev.app.prance.jp/guest/..."
```

---

## トラブルシューティング

### 問題1: DNS解決ができない

```bash
dig dev.app.prance.jp A
# → NXDOMAIN
```

**解決策:**
1. お名前.comでNSレコード確認
2. DNS伝播待機（10-60分）
3. `dig app.prance.jp NS +short` で確認

### 問題2: 証明書エラー

```bash
curl https://dev.app.prance.jp
# → SSL certificate problem
```

**解決策:**
```bash
# 証明書ステータス確認
aws acm describe-certificate \
  --certificate-arn <ARN> \
  --region us-east-1

# ステータスが PENDING_VALIDATION → 待機
# ステータスが ISSUED → CloudFront更新待機
```

### 問題3: CloudFrontが応答しない

```bash
curl -I https://dev.app.prance.jp
# → タイムアウト
```

**解決策:**
```bash
# CloudFront Distribution確認
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?contains(@, 'dev.app.prance.jp')]].{Id:Id,Status:Status}"

# ステータスが InProgress → 待機（10-15分）
```

### 問題4: inviteURLが古いドメイン

```json
{
  "inviteUrl": "http://localhost:3000/guest/..."
}
```

**解決策:**
```bash
# Lambda環境変数確認
aws lambda get-function-configuration \
  --function-name prance-guest-sessions-create-dev \
  --query 'Environment.Variables.FRONTEND_URL'

# 未設定の場合: api-lambda-stack.tsを確認・再デプロイ
```

---

## ロールバック

問題が発生した場合:

```bash
cd /workspaces/prance-communication-platform/scripts/domain-migration
./99-rollback.sh
```

**ロールバック後:**
```bash
cd infrastructure
pnpm run cdk -- deploy Prance-dev-Dns --require-approval never
pnpm run cdk -- deploy Prance-dev-Certificate --require-approval never --region us-east-1
pnpm run cdk -- deploy Prance-dev-Storage --require-approval never
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
pnpm run cdk -- deploy Prance-dev-Cognito --require-approval never
```

---

## 推定総時間

- Phase 0: バックアップ - 1分
- Phase 1: Config更新 - 2分 + 手動編集10分
- Phase 2: ドキュメント更新 - 3分
- Phase 3: 環境変数更新 - 1分 + 手動編集5分
- Phase 4: 確認 - 5分
- Phase 5: コミット - 2分
- Phase 6: CDKデプロイ - 15-30分（証明書発行待機含む）
- Phase 7: 動作確認 - 10分

**合計:** 約1-2時間（DNS伝播・証明書発行待機時間含む）

---

## 参考ドキュメント

- [Domain Migration Plan](../../docs/09-progress/DOMAIN_MIGRATION_PLAN.md) - 完全な移行計画書
- [DOMAIN_SETUP_SUMMARY.md](../../docs/06-infrastructure/DOMAIN_SETUP_SUMMARY.md) - ドメイン設定ガイド

---

**次回セッション開始時:**
「ドメイン移行を開始します。Phase 0のバックアップから実行してください。」
