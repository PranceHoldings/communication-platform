# CDK CLOUDFRONT_DOMAIN 自動設定 - 実装ガイド

**作成日:** 2026-03-14
**重大度:** HIGH
**目的:** CDKデプロイ時にCLOUDFRONT_DOMAIN環境変数を自動設定し、手動更新を不要にする

---

## 問題の概要

### 現在の問題

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

**Line 1172:**
```typescript
CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN || '',  // 空文字になる
```

**問題点:**
- `.env` ファイルに `CLOUDFRONT_DOMAIN` を設定しても、CDKデプロイ時に反映されない
- 空文字 `''` になると、音声URLが不正になる（`https:///sessions/.../audio.mp3`）
- 毎回デプロイ後に手動で環境変数を更新する必要がある

### 影響

- ❌ 音声再生エラー（ブラウザで音声が再生されない）
- ❌ 手動作業の増加（デプロイ後に毎回AWS CLIで更新）
- ❌ 本番環境で問題発生のリスク

---

## 解決策

### Option 1: ハードコード（簡単・推奨 for Dev環境）

**メリット:**
- 実装が簡単（1行変更）
- 確実に動作する
- 開発環境では十分

**デメリット:**
- 環境ごとに異なるCloudFrontドメインを使う場合に不便
- コードに環境依存の値が含まれる

**実装:**

```typescript
// infrastructure/lib/api-lambda-stack.ts
// Line 1172を以下に変更:

// Before (問題のあるコード)
CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN || '',

// After (ハードコード)
CLOUDFRONT_DOMAIN: 'd3mx0sug5s3a6x.cloudfront.net',
```

**適用方法:**
```bash
# 1. api-lambda-stack.ts を編集
vim infrastructure/lib/api-lambda-stack.ts

# 2. デプロイ
cd infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never

# 3. 環境変数確認
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev
```

---

### Option 2: StorageStackから動的取得（推奨 for Production）

**メリット:**
- 環境ごとに自動的に正しいドメインを取得
- コードに環境依存の値がない
- 保守性が高い

**デメリット:**
- 実装がやや複雑
- StorageStackとApiLambdaStackの依存関係を管理する必要がある

**実装手順:**

#### Step 1: StorageStack修正

**ファイル:** `infrastructure/lib/storage-stack.ts`

**追加:** CloudFront Distributionをエクスポート

```typescript
export class StorageStack extends cdk.Stack {
  public readonly recordingsBucket: s3.Bucket;
  public readonly avatarsBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;  // ← 追加

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // ... 既存のコード ...

    // CloudFront Distribution作成（既存）
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      // ...
    });

    // 既存のOutputs（変更なし）
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });
  }
}
```

#### Step 2: app.ts修正

**ファイル:** `infrastructure/bin/app.ts`

**修正:** StorageStackのdistributionをApiLambdaStackに渡す

```typescript
// StorageStack作成（既存）
const storageStack = new StorageStack(app, `${stackPrefix}-Storage`, {
  env,
  environment,
  orgId,
});

// ApiLambdaStack作成（修正）
const apiLambdaStack = new ApiLambdaStack(app, `${stackPrefix}-ApiLambda`, {
  env,
  environment,
  table,
  recordingsBucket: storageStack.recordingsBucket,
  avatarsBucket: storageStack.avatarsBucket,
  userPool,
  orgId,
  cloudFrontDistribution: storageStack.distribution,  // ← 追加
});
```

#### Step 3: ApiLambdaStackProps修正

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

**Line 20-30付近 - interface修正:**

```typescript
export interface ApiLambdaStackProps extends cdk.StackProps {
  environment: string;
  table: dynamodb.ITable;
  recordingsBucket: s3.IBucket;
  avatarsBucket: s3.IBucket;
  userPool: cognito.IUserPool;
  orgId: string;
  cloudFrontDistribution: cloudfront.IDistribution;  // ← 追加
}
```

#### Step 4: Lambda環境変数修正

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

**Line 1172 - 環境変数設定:**

```typescript
// Before (問題のあるコード)
CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN || '',

// After (動的取得)
CLOUDFRONT_DOMAIN: props.cloudFrontDistribution.distributionDomainName,
```

**適用方法:**
```bash
# 1. storage-stack.ts を編集
# 2. app.ts を編集
# 3. api-lambda-stack.ts を編集（interface + 環境変数）

# 4. デプロイ
cd infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never

# 5. 環境変数確認
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev
```

---

## 推奨実装手順

### Phase 1: 即座に実装（Option 1 - ハードコード）

**理由:**
- 開発環境では十分
- 実装が簡単（5分）
- 即座に問題解決

**手順:**
```bash
# 1. api-lambda-stack.ts Line 1172を修正
CLOUDFRONT_DOMAIN: 'd3mx0sug5s3a6x.cloudfront.net',

# 2. デプロイ
cd infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never

# 3. 検証
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev
```

### Phase 2: 本番環境構築時（Option 2 - 動的取得）

**理由:**
- 本番・ステージング・開発環境で異なるドメインを使う
- 保守性が高い
- 環境依存のハードコードを排除

**手順:**
```bash
# 1. storage-stack.ts を修正（distributionエクスポート）
# 2. app.ts を修正（distributionを渡す）
# 3. api-lambda-stack.ts を修正（interface + 環境変数）

# 4. デプロイ
cd infrastructure
npx cdk deploy --all --require-approval never

# 5. 検証
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-prod
```

---

## テスト手順

### 1. デプロイ後の環境変数確認

```bash
# Lambda環境変数検証（13項目）
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev

# 期待結果:
# [CHECK 2/4] Validating CRITICAL environment variables...
#   ✓ CLOUDFRONT_DOMAIN: SET
# [CRITICAL CHECK] Validating CLOUDFRONT_DOMAIN format...
# ✓ CLOUDFRONT_DOMAIN is valid: d3mx0sug5s3a6x.cloudfront.net
```

### 2. 音声URL生成テスト

```bash
# 新しいセッションを開始
# 1. http://localhost:3000 にアクセス
# 2. ログイン（admin@prance.com / Admin2026!Prance）
# 3. 新しいセッションを開始
# 4. 初期挨拶の音声が再生されるか確認

# CloudWatch Logsで音声URL確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 1m | grep "audio-"

# 期待結果:
# [authenticate] Initial greeting audio saved to S3: sessions/.../audio-*.mp3
# 音声URL: https://d3mx0sug5s3a6x.cloudfront.net/sessions/.../audio-*.mp3
```

### 3. エンドツーエンドテスト

```bash
# 1. セッション開始
# 2. 初期挨拶テキスト表示確認
# 3. 初期挨拶音声再生確認
# 4. ユーザーが話す
# 5. AIの応答テキスト表示確認
# 6. AIの応答音声再生確認

# 全て成功すれば、CLOUDFRONT_DOMAIN設定完了
```

---

## トラブルシューティング

### Issue 1: デプロイ後もCLOUDFRONT_DOMAINが空

**確認:**
```bash
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables.CLOUDFRONT_DOMAIN' \
  --output text
```

**原因:**
- api-lambda-stack.tsの変更が反映されていない
- CDKデプロイが失敗している

**解決策:**
```bash
# 1. TypeScriptビルド
cd infrastructure
npm run build

# 2. CDK Synthesize確認
npx cdk synth Prance-dev-ApiLambda | grep CLOUDFRONT_DOMAIN

# 期待結果: d3mx0sug5s3a6x.cloudfront.net が表示される

# 3. 再デプロイ
npx cdk deploy Prance-dev-ApiLambda --require-approval never
```

### Issue 2: Option 2実装時にTypeScriptエラー

**エラー:**
```
Property 'cloudFrontDistribution' does not exist on type 'ApiLambdaStackProps'
```

**原因:**
- ApiLambdaStackPropsにcloudFrontDistributionプロパティが追加されていない
- app.tsでpropsを渡していない

**解決策:**
```bash
# 1. ApiLambdaStackProps interfaceを確認
grep -A 10 "export interface ApiLambdaStackProps" infrastructure/lib/api-lambda-stack.ts

# 2. cloudFrontDistribution: cloudfront.IDistribution が追加されているか確認
# 3. app.tsでcloudFrontDistribution: storageStack.distribution を渡しているか確認

# 4. TypeScriptビルド
cd infrastructure
npm run build
```

### Issue 3: StorageStackのdistributionが見つからない

**エラー:**
```
Property 'distribution' does not exist on type 'StorageStack'
```

**原因:**
- StorageStackでdistributionをpublic propertyとしてエクスポートしていない

**解決策:**
```bash
# 1. storage-stack.ts を確認
grep "public readonly distribution" infrastructure/lib/storage-stack.ts

# 2. 追加されていなければ、storage-stack.ts に追加:
#    public readonly distribution: cloudfront.Distribution;

# 3. TypeScriptビルド
cd infrastructure
npm run build
```

---

## チェックリスト

### Option 1実装チェックリスト

- [ ] `api-lambda-stack.ts` Line 1172を修正（ハードコード）
- [ ] TypeScriptビルド成功
- [ ] CDK Synthesize成功
- [ ] CDKデプロイ成功
- [ ] Lambda環境変数検証成功（`bash scripts/validate-lambda-env-vars.sh`）
- [ ] CLOUDFRONT_DOMAINが `d3mx0sug5s3a6x.cloudfront.net` と表示される
- [ ] ブラウザで音声再生成功

### Option 2実装チェックリスト

- [ ] `storage-stack.ts` に `public readonly distribution` 追加
- [ ] `app.ts` に `cloudFrontDistribution: storageStack.distribution` 追加
- [ ] `ApiLambdaStackProps` に `cloudFrontDistribution` プロパティ追加
- [ ] `api-lambda-stack.ts` Line 1172を修正（動的取得）
- [ ] TypeScriptビルド成功
- [ ] CDK Synthesize成功（全スタック）
- [ ] CDKデプロイ成功（全スタック）
- [ ] Lambda環境変数検証成功（全環境）
- [ ] 音声再生テスト成功（全環境）

---

## まとめ

### 推奨アプローチ

**開発環境（現在）:**
- ✅ **Option 1（ハードコード）** - 即座に実装、簡単、十分

**本番環境（将来）:**
- ✅ **Option 2（動的取得）** - 保守性高い、環境依存なし、スケーラブル

### 効果

**以前:**
- ❌ デプロイ後に毎回手動で環境変数更新
- ❌ 音声再生エラー発生リスク
- ❌ 手動作業の増加

**Option 1実装後:**
- ✅ デプロイ後の手動更新不要
- ✅ 音声再生エラーなし
- ✅ 開発環境で安定動作

**Option 2実装後:**
- ✅ 全環境で自動的に正しいドメイン設定
- ✅ 環境依存のハードコードなし
- ✅ 本番・ステージング・開発で統一されたコード

---

## 関連ドキュメント

- `docs/07-development/LAMBDA_DEPLOY_CHECKLIST.md` - デプロイチェックリスト（Lambda環境変数検証含む）
- `docs/07-development/ENVIRONMENT_VARIABLES_CHECKLIST.md` - 環境変数完全リスト
- `scripts/validate-lambda-env-vars.sh` - Lambda環境変数検証スクリプト
- `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-14_cloudfront_domain_missing.md` - 5 Whys根本原因分析
- `docs/09-progress/PREVENTION_MECHANISMS_2026-03-14.md` - 再発防止メカニズム実装完了

---

**作成日:** 2026-03-14
**最終更新:** 2026-03-14 18:55 JST
**次回実装:** Phase 3（本番環境構築）開始時、またはOption 1実装時
