# 外部ツール・サービスセットアップガイド

実装開始前に必要な外部サービスのアカウント作成、APIキー取得、初期設定の完全ガイド。

## 目次

1. [AI・会話サービス](#1-ai会話サービス)
2. [音声サービス](#2-音声サービス)
3. [画像・感情解析サービス](#3-画像感情解析サービス)
4. [アバター生成サービス](#4-アバター生成サービス)
5. [AWSサービス](#5-awsサービス)
6. [決済サービス](#6-決済サービス)
7. [ATS連携サービス](#7-ats連携サービス)
8. [開発ツール](#8-開発ツール)
9. [セットアップチェックリスト](#9-セットアップチェックリスト)

---

## 1. AI・会話サービス

### 1.1 AWS Bedrock (Claude) ⭐ 必須（Alpha版から）

**用途**: メインの会話AI（Claude on AWS Bedrock）

**重要**: Anthropic APIは使用せず、AWS Bedrock経由でClaudeモデルを利用します。

#### AWS Bedrockでのモデルアクセス有効化

1. **AWS Consoleにログイン**
   - 既存のAWSアカウントを使用（セクション5参照）
   - リージョン: **us-east-1** を推奨

2. **Amazon Bedrockサービスを開く**
   - AWS Console → 「Amazon Bedrock」を検索
   - 左メニュー → 「Model access」

3. **Claudeモデルを有効化**
   ```bash
   1. 「Manage model access」をクリック
   2. Anthropic セクションを展開
   3. 以下のモデルにチェック:
      ☑ Claude Sonnet 4.6 (推奨)
      ☑ Claude 3 Opus (必要に応じて)
   4. 「Request model access」をクリック
   5. 承認完了（通常は即座、初回は数分かかる場合あり）
   ```

#### IAM権限設定

Bedrockを使用するには、以下のIAM権限が必要です：

**開発環境（ローカル）**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*"
    }
  ]
}
```

**適用方法**:

```bash
# aws configure で設定したIAMユーザーにポリシーをアタッチ
aws iam attach-user-policy \
  --user-name your-user-name \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

# または、カスタムポリシーを作成して最小権限を付与
```

**本番環境（Lambda）**:
Lambda実行ロールに上記権限を自動付与（CDKで設定予定）

#### 料金プラン（AWS Bedrock価格）

| モデル            | Input           | Output          | コンテキスト |
| ----------------- | --------------- | --------------- | ------------ |
| Claude 3 Opus     | $15/1M tokens   | $75/1M tokens   | 200K tokens  |
| Claude Sonnet 4.6 | $3/1M tokens    | $15/1M tokens   | 200K tokens  |
| Claude 3 Haiku    | $0.25/1M tokens | $1.25/1M tokens | 200K tokens  |

**推奨**: Alpha版では Sonnet 3.5、品質重視の場面でOpus 3

**利点**:

- ✅ AWS統合請求（他のAWSサービスと同じ請求書）
- ✅ 個別のAPIキー管理不要（IAM認証）
- ✅ VPC内からの低レイテンシアクセス
- ✅ AWS組織全体でのコスト管理・予算アラート

#### 環境変数設定

```bash
# .env.local
# AWS認証情報（aws configureで設定済みの場合は不要）
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
BEDROCK_MAX_TOKENS=2000
```

#### SDK インストール

```bash
npm install @aws-sdk/client-bedrock-runtime
```

#### サンプルコード

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
});

async function invokeClaude(systemPrompt: string, userMessage: string) {
  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-6',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: parseInt(process.env.BEDROCK_MAX_TOKENS || '2000'),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}

// 使用例
const result = await invokeClaude('あなたは採用担当者です。', '自己紹介をお願いします。');
console.log(result);
```

#### ストリーミングレスポンス（リアルタイム会話用）

```typescript
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

async function invokeClaudeStream(systemPrompt: string, userMessage: string) {
  const command = new InvokeModelWithResponseStreamCommand({
    modelId: 'us.anthropic.claude-sonnet-4-6',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const response = await bedrockClient.send(command);

  // ストリーミングレスポンスの処理
  for await (const event of response.body!) {
    if (event.chunk) {
      const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
      if (chunk.type === 'content_block_delta') {
        process.stdout.write(chunk.delta.text);
      }
    }
  }
}
```

#### レート制限

AWS Bedrockのレート制限はリージョン・アカウント単位で管理されます：

| デフォルト制限      | 値        |
| ------------------- | --------- |
| リクエスト/分 (RPM) | 10,000    |
| トークン/分 (TPM)   | 4,000,000 |

**注**: 制限値は AWS Service Quotas で確認・引き上げ申請可能

**対策**:

- AWS Service Quotas コンソールで現在の制限を確認
- 必要に応じて引き上げリクエスト（通常24時間以内に承認）
- リトライロジック実装（指数バックオフ）

#### ドキュメント

- AWS Bedrock公式: https://docs.aws.amazon.com/bedrock/
- Claude on Bedrock: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude.html
- AWS SDK v3 (JavaScript): https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/
- Claudeプロンプトエンジニアリング: https://docs.anthropic.com/en/docs/prompt-engineering

#### トラブルシューティング

**問題**: `AccessDeniedException`

- **原因**: IAM権限が不足
- **解決策**: 上記のポリシーをIAMユーザー/ロールにアタッチ
- **確認**: `aws sts get-caller-identity` でIAMユーザーを確認

**問題**: `ThrottlingException`

- **原因**: レート制限超過
- **解決策**:
  1. リトライロジック実装（指数バックオフ）
  2. Service Quotas で制限引き上げ申請
  3. リクエストを分散（複数Lambda関数等）

**問題**: `ValidationException: Model not found`

- **原因**: モデルIDが正しくない、またはリージョンで未対応
- **解決策**:
  1. モデルIDを確認: `us.anthropic.claude-sonnet-4-6`
  2. リージョンを確認（us-east-1推奨）
  3. Bedrock Console → Model access で有効化確認

**問題**: `ResourceNotFoundException: Could not find foundation model`

- **原因**: モデルアクセスが未承認
- **解決策**: Bedrock Console → Model access → Manage model access で承認

---

## 2. 音声サービス

[以降のセクションは変更なし - ElevenLabs, Azure Speech Services等]
