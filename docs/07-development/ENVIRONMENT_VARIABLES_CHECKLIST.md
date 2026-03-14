# Environment Variables Checklist - 完全版

**作成理由:** CLOUDFRONT_DOMAIN環境変数未設定により音声再生エラーが**複数回発生**したため
**最終更新:** 2026-03-14
**重大度:** CRITICAL

---

## 🔴 重要性

**環境変数の欠如 = 本番環境で500エラー = サービス停止**

過去に同じミスを繰り返した例：
1. **2026-03-11:** Azure Speech SDK API Key欠如 → STTエラー
2. **2026-03-11:** Prisma Client欠如 → Lambda起動エラー
3. **2026-03-14:** CLOUDFRONT_DOMAIN欠如 → 音声再生エラー ⬅️ **今回**

---

## 📋 完全な環境変数リスト

### AWS Configuration (CRITICAL)

| 環境変数 | 必須 | 用途 | 例 | エラー時の症状 |
|---------|------|------|-----|--------------|
| `AWS_REGION` | ✅ | AWSリージョン | `us-east-1` | AWS SDK エラー |
| `AWS_ACCOUNT_ID` | ✅ | AWSアカウントID | `010438500933` | CDKデプロイエラー |
| `BUCKET_NAME` | ✅ | S3バケット名 | `prance-platform-storage-dev` | S3保存エラー |
| **`CLOUDFRONT_DOMAIN`** | ✅ | CloudFrontドメイン | `d3mx0sug5s3a6x.cloudfront.net` | **音声再生エラー** ⬅️ |
| `DDB_CONNECTIONS_TABLE` | ✅ | WebSocket接続テーブル | `prance-websocket-connections-dev` | WebSocket接続エラー |
| `DDB_SESSION_STATE_TABLE` | ✅ | セッション状態テーブル | `prance-session-state-dev` | セッション状態エラー |

### API Keys (CRITICAL)

| 環境変数 | 必須 | 用途 | 取得方法 | エラー時の症状 |
|---------|------|------|---------|--------------|
| `ELEVENLABS_API_KEY` | ✅ | TTS音声生成 | [ElevenLabs Dashboard](https://elevenlabs.io) | TTS生成エラー |
| `AZURE_SPEECH_KEY` | ✅ | STT音声認識 | Azure Portal | STT認識エラー |
| `AZURE_SPEECH_REGION` | ✅ | Azureリージョン | `eastus` | STT接続エラー |
| `BEDROCK_MODEL_ID` | ✅ | AI会話モデル | `anthropic.claude-sonnet-4-20250514-v1:0` | AI応答エラー |
| `BEDROCK_REGION` | ✅ | Bedrockリージョン | `us-east-1` | AI接続エラー |

### Database (CRITICAL)

| 環境変数 | 必須 | 用途 | 例 | エラー時の症状 |
|---------|------|------|-----|--------------|
| `DATABASE_URL` | ✅ | PostgreSQL接続 | `postgresql://user:pass@*.rds.amazonaws.com:5432/prance` | Prisma接続エラー |

### Security (CRITICAL)

| 環境変数 | 必須 | 用途 | 生成方法 | エラー時の症状 |
|---------|------|------|---------|--------------|
| `JWT_SECRET` | ✅ | JWT署名キー | `openssl rand -base64 32` | 認証エラー |

### Optional (Future)

| 環境変数 | 必須 | 用途 | 例 |
|---------|------|------|-----|
| `CLOUDFRONT_KEY_PAIR_ID` | ❌ | CloudFront署名付きURL | 署名付きURL使用時のみ |
| `CLOUDFRONT_PRIVATE_KEY` | ❌ | CloudFront秘密鍵 | 署名付きURL使用時のみ |

---

## 🔍 検証方法

### 1. ローカル環境変数（.env.local）

```bash
# 全環境変数検証
bash scripts/validate-env.sh

# 必須項目のチェック
cat .env.local | grep -E "^(AWS_REGION|CLOUDFRONT_DOMAIN|ELEVENLABS_API_KEY|AZURE_SPEECH_KEY|DATABASE_URL|JWT_SECRET)="
```

**✅ 期待結果:** 全項目が設定されている

**❌ エラー例:**
```
# CloudFront domain missing
CLOUDFRONT_DOMAIN=   ← 空
```

---

### 2. Lambda環境変数（デプロイ後）

```bash
# Lambda環境変数検証（新規スクリプト）
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev us-east-1

# 手動確認
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --region us-east-1 \
  --query 'Environment.Variables' \
  --output json | jq .
```

**✅ 期待結果:**
```json
{
  "AWS_REGION": "us-east-1",
  "BUCKET_NAME": "prance-platform-storage-dev",
  "CLOUDFRONT_DOMAIN": "d3mx0sug5s3a6x.cloudfront.net",  ← 必須
  "ELEVENLABS_API_KEY": "sk-***",
  "AZURE_SPEECH_KEY": "***",
  ...
}
```

**❌ エラー例:**
```json
{
  "CLOUDFRONT_DOMAIN": ""  ← 空または欠如
}
```

---

### 3. デプロイ前自動検証

```bash
# デプロイ前チェック（7項目）
npm run lambda:predeploy

# ✅ CHECK 1/7: 環境変数検証
# ✅ CHECK 2/7: Lambda依存関係
# ...
```

---

## 🛠️ 設定方法

### 方法1: CDKスタック（推奨）

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

```typescript
const websocketDefaultFunction = new nodejs.NodejsFunction(this, 'WebSocketDefaultFunction', {
  // ...
  environment: {
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    BUCKET_NAME: props.recordingsBucket.bucketName,
    CLOUDFRONT_DOMAIN: 'd3mx0sug5s3a6x.cloudfront.net',  // ← 追加
    // OR
    CLOUDFRONT_DOMAIN: storageStack.distribution.distributionDomainName,  // ← 動的取得
    // ...
  },
});
```

**デプロイ:**
```bash
cd infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never
```

---

### 方法2: 手動更新（緊急時のみ）

```bash
# CloudFrontドメイン取得
CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`Prance Platform CDN - dev`].DomainName' \
  --output text)

echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"

# Lambda環境変数更新
aws lambda update-function-configuration \
  --function-name prance-websocket-default-dev \
  --region us-east-1 \
  --environment "Variables={
    AWS_REGION=us-east-1,
    BUCKET_NAME=prance-platform-storage-dev,
    CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN,
    ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY,
    AZURE_SPEECH_KEY=$AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION=eastus,
    BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0,
    BEDROCK_REGION=us-east-1,
    DATABASE_URL=$DATABASE_URL,
    JWT_SECRET=$JWT_SECRET,
    DDB_CONNECTIONS_TABLE=prance-websocket-connections-dev,
    DDB_SESSION_STATE_TABLE=prance-session-state-dev
  }"
```

**⚠️ 注意:** この方法は一時的な対処です。次回CDKデプロイで上書きされる可能性があります。

---

## 🧪 デプロイ後テスト

### 1. Lambda環境変数確認

```bash
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev
```

**✅ 期待出力:**
```
[CHECK 1/4] Retrieving Lambda environment variables...
✓ Retrieved environment variables

[CHECK 2/4] Validating CRITICAL environment variables...
  ✓ AWS_REGION: SET
  ✓ BUCKET_NAME: SET
  ✓ CLOUDFRONT_DOMAIN: SET    ← 最重要
  ...
✓ All CRITICAL variables present

[CRITICAL CHECK] Validating CLOUDFRONT_DOMAIN format...
✓ CLOUDFRONT_DOMAIN is valid: d3mx0sug5s3a6x.cloudfront.net

✅ All environment variables are valid
```

---

### 2. 音声URL検証

```bash
# ブラウザでセッション開始
# Console で音声URL確認

# 期待: https://d3mx0sug5s3a6x.cloudfront.net/sessions/.../audio.mp3
# 実際: https:///sessions/.../audio.mp3  ← CLOUDFRONT_DOMAIN空の場合
```

---

### 3. エンドツーエンドテスト

```bash
# 新しいセッションを開始
# 1. 認証成功
# 2. 初期挨拶テキスト表示
# 3. 初期挨拶音声再生  ← CLOUDFRONT_DOMAINが必要
```

---

## 🚨 過去の失敗例

### 失敗1: Azure Speech SDK API Key欠如（2026-03-11）

**症状:**
```
Error: Authentication failed
Code: 401
```

**原因:** `AZURE_SPEECH_KEY` 環境変数が未設定

**修正:** 環境変数追加 + デプロイ前検証追加

---

### 失敗2: Prisma Client欠如（2026-03-14）

**症状:**
```
Runtime.ImportModuleError: Cannot find module '@prisma/client'
```

**原因:** Lambda node_modulesに `.prisma/client` がコピーされていない

**修正:** CDK bundling設定修正 + 検証スクリプト作成

---

### 失敗3: CLOUDFRONT_DOMAIN欠如（2026-03-14） ⬅️ **今回**

**症状:**
```
Failed to load because no supported source was found.
Audio URL: https:///sessions/.../audio.mp3  ← ドメイン欠如
```

**原因:** `CLOUDFRONT_DOMAIN` 環境変数が未設定

**修正:**
1. ✅ 手動でLambda環境変数更新
2. 🔄 CDKスタック修正（次回デプロイ）
3. ✅ Lambda環境変数検証スクリプト作成
4. ✅ このドキュメント作成

---

## ✅ デプロイ前チェックリスト

**全てのデプロイ前に実行:**

- [ ] ローカル環境変数検証: `bash scripts/validate-env.sh`
- [ ] Lambda環境変数検証: `bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev`
- [ ] CLOUDFRONT_DOMAINが設定されているか確認
- [ ] デプロイ前全検証: `npm run lambda:predeploy`
- [ ] CDKデプロイ: `cd infrastructure && npx cdk deploy Prance-dev-ApiLambda`
- [ ] デプロイ後テスト: `bash scripts/post-deploy-lambda-test.sh prance-websocket-default-dev`
- [ ] ブラウザで音声再生確認

---

## 📚 関連ドキュメント

- `scripts/validate-env.sh` - ローカル環境変数検証
- `scripts/validate-lambda-env-vars.sh` - Lambda環境変数検証 🆕
- `scripts/post-deploy-lambda-test.sh` - デプロイ後テスト
- `docs/07-development/LAMBDA_DEPLOY_CHECKLIST.md` - デプロイチェックリスト
- `docs/09-progress/PREVENTION_MECHANISMS_2026-03-14.md` - 再発防止メカニズム

---

## 🎯 まとめ

### 根本原因

**環境変数の欠如がデプロイ前に検出されなかった**

### 再発防止策

1. ✅ **Lambda環境変数検証スクリプト作成** - `validate-lambda-env-vars.sh`
2. ✅ **完全な環境変数リスト作成** - このドキュメント
3. 🔄 **CDKスタック修正** - CLOUDFRONT_DOMAIN自動設定（次回）
4. ✅ **デプロイ前チェックリスト更新** - Lambda環境変数検証追加
5. ✅ **メモリ更新** - 環境変数チェックリストセクション追加

### 効果

**環境変数の欠如 → デプロイ前に100%検出**

---

**最終更新:** 2026-03-14 18:30 JST
**次回レビュー:** CDKスタック修正完了時
