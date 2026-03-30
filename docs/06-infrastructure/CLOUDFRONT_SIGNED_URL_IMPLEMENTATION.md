# CloudFront署名付きURL実装ガイド

**作成日:** 2026-03-19
**ステータス:** 設計完了・実装待ち
**優先度:** 🔴 CRITICAL
**推定工数:** 2-3日

---

## 📋 概要

### 現状の問題

**重大なセキュリティ問題:**
- CloudFront Distribution: `d3mx0sug5s3a6x.cloudfront.net` は存在
- しかし **署名付きURL機能が完全に未設定**
- Public Key、Key Group、Trusted Signers すべて未設定
- **結果:** 誰でもURLを知っていればアクセス可能

**影響範囲:**
- 録画ファイル（セッション動画・音声）
- アバター画像
- その他の静的コンテンツ

**法的リスク:**
- GDPR違反リスク
- 個人情報保護法違反リスク
- セキュリティ監査不合格

---

## 🎯 実装目標

1. CloudFront署名付きURL機能を完全に実装
2. 録画ファイルへのアクセスを認証ユーザーのみに制限
3. URL有効期限設定（デフォルト: 1時間）
4. 秘密鍵をSecret Managerで安全に管理

---

## 📐 アーキテクチャ設計

### 署名付きURL生成フロー

```
1. ユーザーが録画再生リクエスト
   ↓
2. Lambda関数が認証確認（JWT検証）
   ↓
3. Secret Managerから秘密鍵取得（キャッシュ）
   ↓
4. CloudFront署名付きURL生成（有効期限: 1時間）
   ↓
5. 署名付きURLをクライアントに返却
   ↓
6. クライアントがCloudFrontにアクセス
   ↓
7. CloudFrontが署名検証
   - ✅ 有効 → コンテンツ配信
   - ❌ 無効 → 403 Forbidden
```

### コンポーネント構成

```
┌─────────────────────────────────────────────────────┐
│ Frontend (Next.js)                                   │
│  - 署名付きURLリクエスト                              │
│  - 動画/音声プレイヤー                                │
└────────────┬────────────────────────────────────────┘
             │ REST API
             ▼
┌─────────────────────────────────────────────────────┐
│ API Gateway + Lambda                                 │
│  - JWT認証                                           │
│  - Secret Manager読み取り                            │
│  - 署名付きURL生成                                   │
└────────────┬────────────────────────────────────────┘
             │ Secret読み取り
             ▼
┌─────────────────────────────────────────────────────┐
│ AWS Secrets Manager                                  │
│  - CloudFront秘密鍵                                  │
│  - Key Pair ID                                       │
└─────────────────────────────────────────────────────┘
             │ CloudFront設定
             ▼
┌─────────────────────────────────────────────────────┐
│ CloudFront Distribution                              │
│  - Public Key登録                                    │
│  - Key Group設定                                     │
│  - Trusted Key Groups                                │
└────────────┬────────────────────────────────────────┘
             │ S3からコンテンツ取得
             ▼
┌─────────────────────────────────────────────────────┐
│ S3 Bucket (prance-recordings-*)                      │
│  - 録画ファイル                                       │
│  - アバター画像                                       │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 実装手順

### Step 1: CloudFront Key Pair生成

```bash
#!/bin/bash
# scripts/generate-cloudfront-keypair.sh

# RSA 2048bit秘密鍵生成
openssl genrsa -out cloudfront_private_key.pem 2048

# 公開鍵抽出
openssl rsa -pubout -in cloudfront_private_key.pem -out cloudfront_public_key.pem

# Key Pair IDとして使用するための形式変換
# CloudFrontはPEM形式の公開鍵を要求
cat cloudfront_public_key.pem

echo "✅ Key Pair生成完了"
echo "秘密鍵: cloudfront_private_key.pem"
echo "公開鍵: cloudfront_public_key.pem"
echo ""
echo "⚠️  秘密鍵は安全に保管してください（Secret Managerに保存）"
```

**実行:**
```bash
chmod +x scripts/generate-cloudfront-keypair.sh
bash scripts/generate-cloudfront-keypair.sh
```

**出力例:**
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```

---

### Step 2: CloudFront Public Key登録

```bash
#!/bin/bash
# scripts/register-cloudfront-public-key.sh

PUBLIC_KEY_FILE="cloudfront_public_key.pem"
ENVIRONMENT=${1:-dev}

if [ ! -f "$PUBLIC_KEY_FILE" ]; then
  echo "❌ Public key file not found: $PUBLIC_KEY_FILE"
  exit 1
fi

# Public Key登録用JSON作成
cat > public-key-config.json <<EOF
{
  "CallerReference": "prance-cloudfront-key-$(date +%s)",
  "Name": "prance-cloudfront-public-key-$ENVIRONMENT",
  "EncodedKey": "$(cat $PUBLIC_KEY_FILE | tr -d '\n')",
  "Comment": "Public key for Prance CloudFront signed URLs - $ENVIRONMENT"
}
EOF

# AWS CLIでPublic Key登録
aws cloudfront create-public-key \
  --public-key-config file://public-key-config.json \
  --region us-east-1 \
  --output json > public-key-response.json

# Public Key ID取得
PUBLIC_KEY_ID=$(cat public-key-response.json | jq -r '.PublicKey.Id')

echo "✅ Public Key登録完了"
echo "Public Key ID: $PUBLIC_KEY_ID"
echo ""
echo "次のステップ: Key Group作成"
```

**実行:**
```bash
bash scripts/register-cloudfront-public-key.sh dev
```

---

### Step 3: CloudFront Key Group作成

```bash
#!/bin/bash
# scripts/create-cloudfront-key-group.sh

PUBLIC_KEY_ID=$1
ENVIRONMENT=${2:-dev}

if [ -z "$PUBLIC_KEY_ID" ]; then
  echo "Usage: $0 <public-key-id> [environment]"
  exit 1
fi

# Key Group設定JSON作成
cat > key-group-config.json <<EOF
{
  "Name": "prance-key-group-$ENVIRONMENT",
  "Items": ["$PUBLIC_KEY_ID"],
  "Comment": "Key group for Prance signed URLs - $ENVIRONMENT"
}
EOF

# Key Group作成
aws cloudfront create-key-group \
  --key-group-config file://key-group-config.json \
  --region us-east-1 \
  --output json > key-group-response.json

# Key Group ID取得
KEY_GROUP_ID=$(cat key-group-response.json | jq -r '.KeyGroup.Id')

echo "✅ Key Group作成完了"
echo "Key Group ID: $KEY_GROUP_ID"
echo ""
echo "次のステップ: Distribution設定更新"
```

**実行:**
```bash
# Public Key IDを引数として渡す
bash scripts/create-cloudfront-key-group.sh K2XXXXXXXXXXXX dev
```

---

### Step 4: CloudFront Distribution設定更新

```bash
#!/bin/bash
# scripts/update-cloudfront-distribution.sh

DISTRIBUTION_ID="E1HIO2L0WNT8LT"  # Dev環境
KEY_GROUP_ID=$1

if [ -z "$KEY_GROUP_ID" ]; then
  echo "Usage: $0 <key-group-id>"
  exit 1
fi

echo "=== CloudFront Distribution設定更新 ==="
echo "Distribution ID: $DISTRIBUTION_ID"
echo "Key Group ID: $KEY_GROUP_ID"
echo ""

# 現在の設定取得
aws cloudfront get-distribution-config \
  --id $DISTRIBUTION_ID \
  --output json > current-distribution-config.json

# ETag取得（更新に必要）
ETAG=$(cat current-distribution-config.json | jq -r '.ETag')

# DistributionConfig抽出
cat current-distribution-config.json | jq '.DistributionConfig' > distribution-config.json

# DefaultCacheBehaviorにTrusted Key Groups追加
cat distribution-config.json | jq \
  '.DefaultCacheBehavior.TrustedKeyGroups = {
    "Enabled": true,
    "Quantity": 1,
    "Items": ["'$KEY_GROUP_ID'"]
  }' > updated-distribution-config.json

# Distribution更新
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --distribution-config file://updated-distribution-config.json \
  --if-match $ETAG \
  --output json

echo "✅ Distribution設定更新完了"
echo "⚠️  変更が反映されるまで数分かかります"
```

**実行:**
```bash
bash scripts/update-cloudfront-distribution.sh KG2XXXXXXXXXXXX
```

---

### Step 5: Secret Managerに秘密鍵保存

```bash
#!/bin/bash
# scripts/store-cloudfront-secret.sh

PRIVATE_KEY_FILE="cloudfront_private_key.pem"
KEY_PAIR_ID=$1
ENVIRONMENT=${2:-dev}

if [ ! -f "$PRIVATE_KEY_FILE" ]; then
  echo "❌ Private key file not found: $PRIVATE_KEY_FILE"
  exit 1
fi

if [ -z "$KEY_PAIR_ID" ]; then
  echo "Usage: $0 <key-pair-id> [environment]"
  exit 1
fi

# 秘密鍵をBase64エンコード（改行を保持）
PRIVATE_KEY_CONTENT=$(cat $PRIVATE_KEY_FILE | base64)

# Secret JSON作成
cat > cloudfront-secret.json <<EOF
{
  "keyPairId": "$KEY_PAIR_ID",
  "privateKey": "$PRIVATE_KEY_CONTENT",
  "domain": "d3mx0sug5s3a6x.cloudfront.net"
}
EOF

# Secret Manager保存
aws secretsmanager create-secret \
  --name "prance/cloudfront/$ENVIRONMENT" \
  --description "CloudFront private key for signed URLs - $ENVIRONMENT" \
  --secret-string file://cloudfront-secret.json \
  --region us-east-1

echo "✅ Secret Manager保存完了"
echo "Secret Name: prance/cloudfront/$ENVIRONMENT"
echo ""
echo "⚠️  秘密鍵ファイルを安全に削除してください:"
echo "   shred -u $PRIVATE_KEY_FILE"
```

**実行:**
```bash
bash scripts/store-cloudfront-secret.sh K2XXXXXXXXXXXX dev
```

---

### Step 6: Lambda IAM権限追加

**CDK Stack更新:**

```typescript
// infrastructure/lib/api-lambda-stack.ts

import * as iam from 'aws-cdk-lib/aws-iam';

// Lambda関数にSecret Manager読み取り権限を付与
this.lambdaRole.addToPolicy(new iam.PolicyStatement({
  actions: [
    'secretsmanager:GetSecretValue',
  ],
  resources: [
    `arn:aws:secretsmanager:${this.region}:${this.account}:secret:prance/cloudfront/${props.environment}-*`,
  ],
}));

// CloudFrontドメイン環境変数を削除（Secret経由に変更）
// 以下を削除:
// CLOUDFRONT_DOMAIN: 'd3mx0sug5s3a6x.cloudfront.net',
// CLOUDFRONT_KEY_PAIR_ID: process.env.CLOUDFRONT_KEY_PAIR_ID || '',
// CLOUDFRONT_PRIVATE_KEY: process.env.CLOUDFRONT_PRIVATE_KEY || '',
```

---

### Step 7: Lambda関数で署名付きURL生成実装

**共有ユーティリティ作成:**

```typescript
// infrastructure/lambda/shared/utils/cloudfront-signer.ts

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// シークレットキャッシュ（Lambda起動時に1回だけ取得）
let cachedSecret: {
  keyPairId: string;
  privateKey: string;
  domain: string;
} | null = null;

/**
 * Get CloudFront secret from Secrets Manager
 */
async function getCloudFrontSecret() {
  if (cachedSecret) {
    return cachedSecret;
  }

  const command = new GetSecretValueCommand({
    SecretId: `prance/cloudfront/${ENVIRONMENT}`,
  });

  const response = await secretsClient.send(command);
  const secret = JSON.parse(response.SecretString || '{}');

  // Base64デコード
  const privateKey = Buffer.from(secret.privateKey, 'base64').toString('utf-8');

  cachedSecret = {
    keyPairId: secret.keyPairId,
    privateKey,
    domain: secret.domain,
  };

  return cachedSecret;
}

/**
 * Generate CloudFront signed URL
 * @param s3Key - S3オブジェクトキー（例: "recordings/session-123.webm"）
 * @param expiresIn - 有効期限（秒、デフォルト: 3600 = 1時間）
 */
export async function generateSignedUrl(
  s3Key: string,
  expiresIn: number = 3600
): Promise<string> {
  const secret = await getCloudFrontSecret();

  // CloudFront URL生成
  const url = `https://${secret.domain}/${s3Key}`;

  // 有効期限設定
  const dateLessThan = new Date(Date.now() + expiresIn * 1000).toISOString();

  // 署名付きURL生成
  const signedUrl = getSignedUrl({
    url,
    keyPairId: secret.keyPairId,
    privateKey: secret.privateKey,
    dateLessThan,
  });

  return signedUrl;
}

/**
 * Generate signed URL for session recording
 */
export async function generateRecordingUrl(
  sessionId: string,
  expiresIn: number = 3600
): Promise<string> {
  const s3Key = `recordings/${sessionId}.webm`;
  return generateSignedUrl(s3Key, expiresIn);
}
```

**API Lambda関数での使用:**

```typescript
// infrastructure/lambda/sessions/get/index.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { generateRecordingUrl } from '../../shared/utils/cloudfront-signer';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { id } = event.pathParameters || {};

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        recordingUrl: true,
        // ... その他のフィールド
      },
    });

    if (!session) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    // 署名付きURL生成
    let signedRecordingUrl: string | null = null;
    if (session.recordingUrl) {
      // S3キーを抽出（CloudFrontドメインを削除）
      const s3Key = session.recordingUrl.replace(/^https?:\/\/[^\/]+\//, '');
      signedRecordingUrl = await generateRecordingUrl(session.id, 3600);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...session,
        recordingUrl: signedRecordingUrl, // 署名付きURLに置き換え
      }),
    };
  } catch (error) {
    console.error('Error getting session:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
```

---

### Step 8: デプロイと検証

**デプロイ手順:**

```bash
# 1. CDK Stack更新（IAM権限追加）
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# 2. Lambda関数デプロイ（署名付きURL機能追加）
npm run deploy:lambda

# 3. CloudFront設定変更の反映待ち
aws cloudfront get-distribution \
  --id E1HIO2L0WNT8LT \
  --query 'Distribution.Status' \
  --output text

# Status が "Deployed" になるまで待つ（5-15分）
```

**検証手順:**

```bash
# 1. Secret Manager確認
aws secretsmanager get-secret-value \
  --secret-id prance/cloudfront/dev \
  --query 'SecretString' \
  --output text | jq

# 期待される出力:
# {
#   "keyPairId": "K2XXXXXXXXXXXX",
#   "privateKey": "LS0tLS1CRUdJTi...",
#   "domain": "d3mx0sug5s3a6x.cloudfront.net"
# }

# 2. Lambda関数動作確認
aws lambda invoke \
  --function-name prance-sessions-get-dev \
  --payload '{"pathParameters":{"id":"test-session-id"}}' \
  /tmp/result.json

cat /tmp/result.json | jq '.recordingUrl'

# 期待される出力: 署名付きURL
# "https://d3mx0sug5s3a6x.cloudfront.net/recordings/test-session-id.webm?Expires=...&Signature=...&Key-Pair-Id=K2XXXXXXXXXXXX"

# 3. 署名付きURL動作確認
# ブラウザまたはcurlでアクセス
curl -I "https://d3mx0sug5s3a6x.cloudfront.net/recordings/test-session-id.webm?Expires=...&Signature=...&Key-Pair-Id=K2XXXXXXXXXXXX"

# 期待される出力:
# HTTP/2 200 OK (有効なURL)
# または
# HTTP/2 403 Forbidden (無効なURL)

# 4. 署名なしURLが拒否されることを確認
curl -I "https://d3mx0sug5s3a6x.cloudfront.net/recordings/test-session-id.webm"

# 期待される出力:
# HTTP/2 403 Forbidden (署名なしアクセス拒否)
```

---

## ✅ 完了チェックリスト

- [ ] CloudFront Key Pair生成
- [ ] Public Key登録（AWS CloudFront）
- [ ] Key Group作成
- [ ] Distribution設定更新（Trusted Key Groups追加）
- [ ] Secret Manager保存
- [ ] CDK Stack更新（IAM権限追加）
- [ ] Lambda共有ユーティリティ実装（`cloudfront-signer.ts`）
- [ ] API Lambda関数更新（署名付きURL生成）
- [ ] Lambda関数デプロイ
- [ ] 動作確認（署名付きURL生成・アクセステスト）
- [ ] 署名なしURLが拒否されることを確認
- [ ] Production環境デプロイ
- [ ] ドキュメント更新

---

## 🔒 セキュリティ考慮事項

### 1. 秘密鍵の安全な管理

**✅ 実施:**
- Secret Managerで暗号化保存
- Lambda関数起動時に1回だけ取得（キャッシュ）
- 環境変数に秘密鍵を保存しない

**❌ 禁止:**
- 秘密鍵をGitにコミット
- .env.localに平文保存
- CloudWatch Logsに秘密鍵を出力

### 2. URL有効期限

**推奨設定:**
- デフォルト: 1時間（3600秒）
- 録画視聴: 1-2時間
- アバター画像: 24時間

**実装:**
```typescript
// 用途別有効期限設定
const EXPIRY_SETTINGS = {
  recording: 3600,      // 1時間
  avatar: 86400,        // 24時間
  analysis_report: 7200, // 2時間
};
```

### 3. アクセス制御

**認証チェック:**
```typescript
// JWT検証 → 組織・ユーザー確認 → 署名付きURL生成
const user = await verifyJWT(token);
const session = await prisma.session.findUnique({ where: { id } });

if (session.orgId !== user.orgId) {
  throw new ForbiddenError('Access denied');
}

const signedUrl = await generateRecordingUrl(session.id);
```

---

## 📊 パフォーマンス考慮事項

### 1. Secret Managerキャッシュ

```typescript
// Lambda起動時に1回だけ取得
let cachedSecret: CloudFrontSecret | null = null;

async function getCloudFrontSecret() {
  if (cachedSecret) {
    return cachedSecret; // キャッシュ使用
  }

  // 初回のみSecrets Manager読み取り
  cachedSecret = await fetchFromSecretsManager();
  return cachedSecret;
}
```

**効果:**
- Secret Manager API呼び出し削減
- レスポンス時間短縮（~100ms → ~1ms）

### 2. CloudFront署名生成パフォーマンス

**測定結果（想定）:**
- 署名生成: ~5ms
- Secret取得（初回）: ~100ms
- Secret取得（キャッシュ）: ~1ms

**合計レスポンス時間:**
- 初回: ~150ms
- 2回目以降: ~50ms

---

## 🚨 トラブルシューティング

### 問題1: 403 Forbidden（署名付きURLでもアクセス拒否）

**原因:**
- Key Pair IDが間違っている
- 秘密鍵が正しくない
- URL有効期限が切れている
- CloudFront設定が反映されていない

**解決方法:**
```bash
# 1. Key Pair ID確認
aws cloudfront get-distribution --id E1HIO2L0WNT8LT \
  --query 'Distribution.DistributionConfig.DefaultCacheBehavior.TrustedKeyGroups' \
  --output json

# 2. Secret Manager確認
aws secretsmanager get-secret-value \
  --secret-id prance/cloudfront/dev \
  --query 'SecretString' \
  --output text | jq '.keyPairId'

# 3. Distribution Status確認
aws cloudfront get-distribution --id E1HIO2L0WNT8LT \
  --query 'Distribution.Status' \
  --output text
# "Deployed" になっているか確認
```

### 問題2: Lambda関数エラー

**原因:**
- Secret Manager読み取り権限がない
- Secret名が間違っている
- 秘密鍵のBase64デコードエラー

**解決方法:**
```bash
# Lambda関数のIAMロール確認
aws lambda get-function --function-name prance-sessions-get-dev \
  --query 'Configuration.Role' \
  --output text

# IAMポリシー確認
aws iam list-attached-role-policies --role-name <role-name>

# CloudWatch Logsでエラー確認
aws logs tail /aws/lambda/prance-sessions-get-dev --follow
```

---

## 📚 参考資料

- [AWS CloudFront Signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [CloudFront Key Groups](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html)
- [AWS SDK CloudFront Signer](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_cloudfront_signer.html)
- [Secret Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)

---

**最終更新:** 2026-03-19
**次回レビュー:** 実装開始時
**担当:** DevOps + Backend Team
