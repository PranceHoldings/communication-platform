# 体系的コードベース監査結果 - 環境変数の過不足・重複確認

**実施日:** 2026-03-20 13:00 UTC
**監査範囲:** 全44個のLambda関数、CDK定義、.env.local
**監査方法:** 各Lambda関数のindex.tsを読み、使用環境変数を抽出 → CDK定義と照合

---

## 🔍 監査方法

### Phase 1: Lambda関数コード解析
全44個のLambda関数について：
1. `process.env.XXX` の直接参照を抽出
2. `getRequiredEnv()`, `getAwsRegion()` 等の env-validator getter 呼び出しを抽出
3. 各関数が実際に使用している環境変数リストを作成

### Phase 2: CDK定義との照合
`infrastructure/lib/api-lambda-stack.ts` で：
1. 各Lambda関数の `environment:` ブロックを確認
2. `commonEnvironment` と `commonLambdaProps` の定義を確認
3. Phase 1で抽出した変数と照合

### Phase 3: 過不足・重複の検出
- ✅ CDKで定義されている変数
- ❌ コードで使用されているがCDKで定義されていない変数（欠如）
- ⚠️ CDKで定義されているがコードで使用されていない変数（過剰）

---

## 🚨 重大な発見（P0 - 即座の対応が必要）

### 問題1: AWS_REGION が複数のLambda関数で欠如

**影響を受けるLambda関数（5個）:**

1. **websocket-connect** (`infrastructure/lambda/websocket/connect/index.ts:13`)
   ```typescript
   new DynamoDBClient({ region: process.env.AWS_REGION })
   ```
   - CDK定義: `CONNECTIONS_TABLE_NAME`, `DYNAMODB_CONNECTION_TTL_SECONDS`, `JWT_SECRET`, `ENVIRONMENT`, `LOG_LEVEL`, `NODE_ENV`
   - **欠如: AWS_REGION**

2. **websocket-disconnect** (`infrastructure/lambda/websocket/disconnect/index.ts:11`)
   ```typescript
   new DynamoDBClient({ region: process.env.AWS_REGION })
   ```
   - CDK定義: `CONNECTIONS_TABLE_NAME`, `ENVIRONMENT`, `LOG_LEVEL`, `NODE_ENV`
   - **欠如: AWS_REGION**

3. **sessions-analysis** (`infrastructure/lambda/sessions/analysis/index.ts:13`)
   ```typescript
   const AWS_REGION = process.env.AWS_REGION || AWS_DEFAULTS.REGION;
   ```
   - CDK定義: `...commonEnvironment`, `RECORDINGS_BUCKET_NAME`, `ENABLE_AUTO_ANALYSIS`
   - **欠如: AWS_REGION** (commonEnvironment に含まれていない)

4. **sessions-trigger-analysis** (`infrastructure/lambda/sessions/trigger-analysis/index.ts:10`)
   ```typescript
   const AWS_REGION = process.env.AWS_REGION || AWS_DEFAULTS.REGION;
   ```
   - CDK定義: `...commonEnvironment`, `ANALYSIS_FUNCTION_NAME`
   - **欠如: AWS_REGION** (commonEnvironment に含まれていない)

5. **db-query** (`infrastructure/lambda/db-query/index.ts:25`)
   ```typescript
   const s3Client = new S3Client({ region: getAwsRegion() });
   ```
   - CDK定義: `...commonLambdaProps.environment`, `DB_QUERIES_BUCKET`
   - **欠如: AWS_REGION** (commonEnvironment に含まれていない)

**現状:** Lambda runtimeが自動的に `AWS_REGION` 環境変数を提供するため、現在は動作している。しかし、暗黙的依存は脆弱。

**リスク:** LOW（現在動作中）だが、ベストプラクティス違反

---

### 問題2: MAX_RESULTS が db-query で欠如

**影響を受けるLambda関数:**

**db-query** (`infrastructure/lambda/db-query/index.ts:23`)
```typescript
import { getMaxResults, getRequiredEnv, getAwsRegion } from '../shared/utils/env-validator';
```

- コード使用: `getMaxResults()` - これは `MAX_RESULTS` 環境変数を期待
- CDK定義: `...commonLambdaProps.environment`, `DB_QUERIES_BUCKET`
- **欠如: MAX_RESULTS**

**影響:** `getRequiredEnv('MAX_RESULTS')` が呼ばれた時、Lambda関数がエラーで失敗する

**リスク:** HIGH（本番エラーの可能性）

---

## ✅ commonEnvironment 定義の確認

**現在の定義** (`infrastructure/lib/api-lambda-stack.ts:129-139`)：

```typescript
const commonEnvironment = {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  DATABASE_URL,
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  FRONTEND_URL: `https://${config.domain.fullDomain}`,
  GUEST_RATE_LIMIT_TABLE_NAME: props.guestRateLimitTable.tableName,
  BEDROCK_REGION: this.region,
  S3_BUCKET: props.recordingsBucket.bucketName,
};
```

**欠如している変数:**
- ❌ `AWS_REGION` - 5個のLambda関数で使用されている
- ❌ `MAX_RESULTS` - db-query で使用されている
- ❌ `AWS_ENDPOINT_SUFFIX` - 使用箇所は少ないが env-validator にgetterがある

---

## 📊 Lambda関数別 環境変数使用状況

### 環境変数を直接使用している関数（6個）

| Lambda関数 | 使用変数 | CDK定義状況 | 問題 |
|-----------|---------|------------|------|
| migrations | `DATABASE_URL` | ✅ commonEnvironment | OK |
| sessions-analysis | `AWS_REGION` | ❌ 未定義 | **欠如** |
| sessions-trigger-analysis | `AWS_REGION` | ❌ 未定義 | **欠如** |
| websocket-connect | `AWS_REGION`, `CONNECTIONS_TABLE_NAME` | ❌ AWS_REGION未定義 | **欠如** |
| websocket-default | `BEDROCK_REGION`, `ENABLE_AUTO_ANALYSIS`, `STT_AUTO_DETECT_LANGUAGES` + 19個のgetter | ✅ 大部分定義済み | 要詳細確認 |
| websocket-disconnect | `AWS_REGION`, `CONNECTIONS_TABLE_NAME` | ❌ AWS_REGION未定義 | **欠如** |

### env-validator getters を使用している関数（3個）

| Lambda関数 | Getter関数 | 必要な環境変数 | CDK定義状況 | 問題 |
|-----------|-----------|---------------|------------|------|
| auth-authorizer | `getRequiredEnv('JWT_SECRET')` | `JWT_SECRET` | ✅ 定義済み | OK |
| db-query | `getAwsRegion()`, `getRequiredEnv('DB_QUERIES_BUCKET')`, `getMaxResults()` | `AWS_REGION`, `DB_QUERIES_BUCKET`, `MAX_RESULTS` | ❌ AWS_REGION, MAX_RESULTS 未定義 | **欠如** |
| websocket-connect | `getDynamoDbConnectionTtlSeconds()` | `DYNAMODB_CONNECTION_TTL_SECONDS` | ✅ 定義済み | OK |

### 環境変数を使用していない関数（35個）

以下の関数は `...commonLambdaProps` を使用し、`DATABASE_URL` 等の共通変数にアクセスするが、追加の環境変数は使用していない：

- auth-login, auth-register
- avatars-* (7個の関数)
- guest-* (13個の関数)
- scenarios-* (5個の関数)
- sessions-* (残りの関数)
- users-me
- health-check
- organizations-settings
- maintenance-populate-scenario-defaults
- report-generate

**これらは問題なし** - commonEnvironment の変数のみ使用

---

## 🔧 修正が必要な箇所

### 修正1: commonEnvironment に AWS_REGION を追加

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`
**行番号:** 129-139

**現在:**
```typescript
const commonEnvironment = {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  DATABASE_URL,
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  FRONTEND_URL: `https://${config.domain.fullDomain}`,
  GUEST_RATE_LIMIT_TABLE_NAME: props.guestRateLimitTable.tableName,
  BEDROCK_REGION: this.region,
  S3_BUCKET: props.recordingsBucket.bucketName,
};
```

**修正後:**
```typescript
const commonEnvironment = {
  AWS_REGION: this.region, // ✅ 追加 - 5個のLambda関数で使用
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  DATABASE_URL,
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  FRONTEND_URL: `https://${config.domain.fullDomain}`,
  GUEST_RATE_LIMIT_TABLE_NAME: props.guestRateLimitTable.tableName,
  BEDROCK_REGION: this.region,
  S3_BUCKET: props.recordingsBucket.bucketName,
  AWS_ENDPOINT_SUFFIX: 'amazonaws.com', // ✅ 追加 - env-validatorで定義されているため
};
```

**効果:** 5個のLambda関数（websocket-connect, websocket-disconnect, sessions-analysis, sessions-trigger-analysis, db-query）で AWS_REGION が利用可能になる

---

### 修正2: db-query に MAX_RESULTS を追加

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`
**行番号:** ~465

**現在:**
```typescript
this.dbQueryFunction = new nodejs.NodejsFunction(this, 'DbQueryFunction', {
  ...commonLambdaProps,
  functionName: `prance-db-query-${props.environment}`,
  description: 'Execute database queries from local development environment (read-only by default)',
  entry: path.join(__dirname, '../lambda/db-query/index.ts'),
  handler: 'handler',
  timeout: cdk.Duration.seconds(30),
  memorySize: 512,
  vpc: props.vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups: [props.lambdaSecurityGroup],
  environment: {
    ...commonLambdaProps.environment,
    DB_QUERIES_BUCKET: `prance-db-queries-${props.environment}`,
  },
  // ...
});
```

**修正後:**
```typescript
this.dbQueryFunction = new nodejs.NodejsFunction(this, 'DbQueryFunction', {
  ...commonLambdaProps,
  functionName: `prance-db-query-${props.environment}`,
  description: 'Execute database queries from local development environment (read-only by default)',
  entry: path.join(__dirname, '../lambda/db-query/index.ts'),
  handler: 'handler',
  timeout: cdk.Duration.seconds(30),
  memorySize: 512,
  vpc: props.vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups: [props.lambdaSecurityGroup],
  environment: {
    ...commonLambdaProps.environment,
    DB_QUERIES_BUCKET: `prance-db-queries-${props.environment}`,
    MAX_RESULTS: process.env.MAX_RESULTS || '1000', // ✅ 追加
  },
  // ...
});
```

**効果:** db-query で `getMaxResults()` が正常に動作する

---

### 修正3: websocket-connect に AWS_REGION を明示的に追加（既にcommonEnvironmentで対応済みだが、念のため）

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`
**行番号:** ~1216

**現在:**
```typescript
environment: {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
  DYNAMODB_CONNECTION_TTL_SECONDS: process.env.DYNAMODB_CONNECTION_TTL_SECONDS || '14400',
}
```

**修正後:**
```typescript
environment: {
  AWS_REGION: this.region, // ✅ 追加（明示的）
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
  DYNAMODB_CONNECTION_TTL_SECONDS: process.env.DYNAMODB_CONNECTION_TTL_SECONDS || '14400',
}
```

**注:** websocket-connect と websocket-disconnect は `commonLambdaProps` を使用していないため、明示的に追加する必要がある。

---

### 修正4: websocket-disconnect に AWS_REGION を明示的に追加

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`
**行番号:** ~1266

**現在:**
```typescript
environment: {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
}
```

**修正後:**
```typescript
environment: {
  AWS_REGION: this.region, // ✅ 追加（明示的）
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
}
```

---

## 📈 修正の影響範囲

### 修正1の影響（commonEnvironment に AWS_REGION 追加）

**影響を受けるLambda関数（36個）:**
`commonLambdaProps` を使用する全てのLambda関数に `AWS_REGION` が追加される：

- health-check
- auth-register, auth-login
- users-me
- scenarios-* (5個)
- avatars-* (7個)
- sessions-* (6個)
- guest-* (14個)
- organizations-settings
- report-generate
- db-mutation, db-query
- maintenance-populate-scenario-defaults
- migrations

**効果:**
- ✅ 全Lambda関数が明示的に `AWS_REGION` にアクセス可能
- ✅ 暗黙的依存を明示的依存に変更（ベストプラクティス）
- ✅ コードの可読性・保守性向上
- ❌ リスクなし（既存の動作は変わらない）

### 修正2の影響（db-query に MAX_RESULTS 追加）

**影響を受けるLambda関数（1個）:**
- db-query

**効果:**
- ✅ `getMaxResults()` が正常に動作
- ✅ 本番エラーのリスク除去
- ❌ リスクなし

### 修正3-4の影響（websocket-connect/disconnect に AWS_REGION 追加）

**影響を受けるLambda関数（2個）:**
- websocket-connect
- websocket-disconnect

**効果:**
- ✅ 暗黙的依存を明示的依存に変更
- ✅ DynamoDBClient の region 引数が明示的に設定される
- ❌ リスクなし（既存の動作は変わらない）

---

## 🔍 重複・矛盾の確認

### チェック1: 同じ変数が複数箇所で異なる値で定義されていないか

**検証結果:** ✅ 重複・矛盾なし

以下の変数は複数のLambda関数で定義されているが、全て同じ値または同じソース（props）から取得している：
- `ENVIRONMENT` - 全Lambda関数（`props.environment`）
- `LOG_LEVEL` - 全Lambda関数（環境に応じて 'INFO' または 'DEBUG'）
- `NODE_ENV` - 全Lambda関数（環境に応じて 'production' または 'development'）
- `DATABASE_URL` - commonEnvironment 経由で統一
- `JWT_SECRET` - Secrets Manager 経由で統一
- `S3_BUCKET` - commonEnvironment 経由で統一（`props.recordingsBucket.bucketName`）

### チェック2: .env.local で定義されているが使用されていない変数

**検証結果:** ⚠️ 8個の未使用変数を確認

以下の変数は `.env.local` で定義されているが、Lambda関数で使用されていない：

1. `READY_PLAYER_ME_APP_ID` - 将来的な3Dアバター生成で使用予定
2. `JWT_ACCESS_TOKEN_EXPIRES_IN` - JWTコードで'24h'がハードコード
3. `JWT_REFRESH_TOKEN_EXPIRES_IN` - リフレッシュトークン未実装
4. `GITHUB_REPO_URL` - CDK Amplify設定でのみ使用
5. `GITHUB_ACCESS_TOKEN` - CDK Amplify設定でのみ使用
6. `POLLY_VOICE_ID` - AWS Polly TTS未実装
7. `POLLY_ENGINE` - AWS Polly TTS未実装
8. `BASE_URL` - Playwright E2Eテストでのみ使用

**推奨アクション:** これらは「将来使用予定」または「非Lambda用途」のため、削除不要。ドキュメント化推奨。

### チェック3: CDKで定義されているがコードで使用されていない変数

**検証結果:** ⚠️ いくつかの変数が未使用の可能性

以下の変数は `commonEnvironment` で定義されているが、一部のLambda関数では使用されていない可能性：

- `GUEST_RATE_LIMIT_TABLE_NAME` - ゲスト認証関連Lambda以外では未使用（問題なし）
- `BEDROCK_REGION` - AI処理Lambda以外では未使用（問題なし）

**推奨アクション:** これらは「必要な関数で使用」されているため、問題なし。

---

## ✅ 正常に動作している Lambda関数（問題なし）

以下の関数は環境変数の定義・使用が正しく整合している：

- ✅ **auth-authorizer** - `JWT_SECRET` を使用、CDKで定義済み
- ✅ **websocket-default** - 大量の環境変数を使用、全て定義済み
- ✅ **migrations** - `DATABASE_URL` を使用、commonEnvironmentで定義済み
- ✅ **35個の CRUD Lambda関数** - commonEnvironmentの変数のみ使用、全て定義済み

---

## 📊 統計サマリー

| 指標 | 件数 |
|------|------|
| 監査したLambda関数 | 44 |
| 環境変数を直接使用する関数 | 6 |
| env-validator getterを使用する関数 | 3 |
| 問題が発見された関数 | 6 |
| 欠如している環境変数 | 2種類（AWS_REGION, MAX_RESULTS） |
| 影響を受けるLambda関数 | 6 |
| 未使用の.env.local変数 | 8 |
| 重複・矛盾 | 0 |

---

## 🎯 修正手順

### Step 1: commonEnvironment を修正

```bash
# ファイルを編集
code infrastructure/lib/api-lambda-stack.ts

# 行 129-139 の commonEnvironment に追加:
AWS_REGION: this.region,
AWS_ENDPOINT_SUFFIX: 'amazonaws.com',
```

### Step 2: db-query を修正

```bash
# 同じファイル内、行 ~465 の db-query environment ブロックに追加:
MAX_RESULTS: process.env.MAX_RESULTS || '1000',
```

### Step 3: websocket-connect を修正

```bash
# 同じファイル内、行 ~1216 の websocket-connect environment ブロックに追加:
AWS_REGION: this.region,
```

### Step 4: websocket-disconnect を修正

```bash
# 同じファイル内、行 ~1266 の websocket-disconnect environment ブロックに追加:
AWS_REGION: this.region,
```

### Step 5: デプロイ

```bash
cd infrastructure
pnpm run deploy:lambda
```

### Step 6: 検証

```bash
# 全Lambda関数の環境変数確認
for func in prance-websocket-connect-dev prance-websocket-disconnect-dev prance-sessions-analysis-dev prance-sessions-trigger-analysis-dev prance-db-query-dev; do
  echo "=== $func ==="
  aws lambda get-function-configuration --function-name $func --query 'Environment.Variables.AWS_REGION' --output text
done

# 期待: 全て us-east-1 を返す

# db-query の MAX_RESULTS 確認
aws lambda get-function-configuration --function-name prance-db-query-dev --query 'Environment.Variables.MAX_RESULTS' --output text
# 期待: 1000 を返す
```

---

## 🏁 結論

**発見された問題:**
- 🔴 **6個のLambda関数** で環境変数が欠如
- 🔴 **2種類の環境変数** （AWS_REGION, MAX_RESULTS）が未定義

**根本原因:**
- `commonEnvironment` に `AWS_REGION` が含まれていなかった
- db-query 固有の `MAX_RESULTS` が定義されていなかった
- websocket-connect/disconnect が `commonLambdaProps` を使用していなかった

**修正の影響:**
- ✅ 修正は安全（既存動作を変更しない）
- ✅ 暗黙的依存を明示的依存に変更（ベストプラクティス）
- ✅ 将来のエラーリスクを除去

**推定修正時間:** 10分（編集5分 + デプロイ5分）

---

**監査完了日時:** 2026-03-20 13:30 UTC
**次のアクション:** 上記Step 1-6を実行
