# Prance Platform - セットアップガイド

このガイドでは、Pranceプラットフォームの開発環境をゼロからセットアップする手順を説明します。

## 📋 前提条件

以下がインストールされていることを確認してください：

```bash
# Node.js 20.x
node --version  # v20.x.x

# npm 10.x
npm --version   # 10.x.x

# Git
git --version   # 2.x.x

# AWS CLI v2
aws --version   # aws-cli/2.x.x

# Docker (CDKデプロイ時のビルドに使用)
docker --version
```

## 🔑 ステップ1: 外部サービスアカウント作成

詳細は [docs/ALPHA_DEVELOPMENT.md](docs/ALPHA_DEVELOPMENT.md#必要なアカウントapiキー) を参照してください。

### 必須サービス

1. **AWS** - https://aws.amazon.com/
   - メインインフラ（Lambda、Aurora、S3、Cognito等）
   - **AWS Bedrock** でClaudeモデルを有効化（AI会話エンジン）
   - **AWS Rekognition** 感情解析（顔ランドマーク100点）
   - **AWS Polly** 音声合成フォールバック（Neural TTS）
2. **ElevenLabs** - https://elevenlabs.io/
   - 音声合成（プライマリ、高品質）
3. **Azure (Speech Services)** - https://portal.azure.com/
   - 音声認識（低レイテンシ）
4. **Ready Player Me** - https://readyplayer.me/developers
   - 3Dアバター生成

**AWS統合度**: 約70%（Bedrock, Rekognition, Polly, Lambda, Aurora, S3等がAWS）

## 🚀 ステップ2: プロジェクトセットアップ

### 2.1 リポジトリクローン

```bash
git clone https://github.com/PranceHoldings/communication-platform.git
cd communication-platform
```

### 2.2 依存関係インストール

```bash
# ルートの依存関係 + 全ワークスペース
npm install

# CDK CLI (グローバル)
npm install -g aws-cdk

# Prisma CLI (グローバル)
npm install -g prisma
```

### 2.3 環境変数設定

```bash
# .env.localファイル作成（ルート）
cp .env.example .env.local

# エディタで編集
vim .env.local  # または code .env.local
```

`.env.local` に以下を設定：

```bash
# AWS
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=<YOUR_AWS_ACCOUNT_ID>

# AWS Bedrock (Claude API)
# Bedrockは AWS SDK が自動的にIAM認証を使用するため、
# 個別のAPIキーは不要です。AWS認証情報（aws configure）を使用します。
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6

# ElevenLabs
ELEVENLABS_API_KEY=<YOUR_ELEVENLABS_KEY>

# Azure Speech
AZURE_SPEECH_KEY=<YOUR_AZURE_KEY>
AZURE_SPEECH_REGION=eastus

# Ready Player Me
READY_PLAYER_ME_APP_ID=<YOUR_RPM_APP_ID>

# フロントエンド設定（ローカル開発）
NEXT_PUBLIC_API_URL=https://YOUR_API_GATEWAY_URL/dev/api/v1

# Database (Lambda関数用 - CDKデプロイ後に設定)
DATABASE_URL="postgresql://postgres:****@YOUR_RDS_ENDPOINT:5432/prance"
```

**重要:** ローカル開発環境では、データベースはAWS RDS Aurora Serverless v2を使用します。
ローカルPostgreSQLは使用しません。

## 🗄️ ステップ3: データベース確認

**注意:** データベースはAWS RDS Aurora Serverless v2です。
ローカルPostgreSQLのセットアップは不要です。

### Prisma Client生成

```bash
cd packages/database

# Prisma Clientを生成（型定義のため）
npx prisma generate
```

### データベース接続テスト

データベースはVPC内にあるため、直接接続できません。
Lambda経由でテストします：

```bash
# AWS CLIでLambda関数を使用
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"migration.sql"}' \
  /tmp/result.json

# 結果確認
cat /tmp/result.json
```

## ☁️ ステップ4: AWS CDKセットアップ

### 4.1 AWS認証情報設定

```bash
# AWS CLIの設定
aws configure

# 入力:
# AWS Access Key ID: <YOUR_ACCESS_KEY>
# AWS Secret Access Key: <YOUR_SECRET_KEY>
# Default region name: us-east-1
# Default output format: json

# 確認
aws sts get-caller-identity
```

### 4.2 CDK Bootstrap

```bash
cd infrastructure

# 初回のみ: CDK Bootstrap実行
npx cdk bootstrap

# 出力例:
# ✅  Bootstrapping environment aws://123456789012/us-east-1...
```

### 4.3 CDKスタックデプロイ

```bash
# すべてのスタックをデプロイ
npx cdk deploy --all

# または個別にデプロイ
npx cdk deploy Prance-dev-Network
npx cdk deploy Prance-dev-Cognito
npx cdk deploy Prance-dev-Database
npx cdk deploy Prance-dev-Storage
```

デプロイ完了まで10-15分かかります。

### 4.4 デプロイ後の設定

デプロイが完了したら、CDKのOutputsをメモしてください：

```bash
# Outputs確認
npx cdk list
```

以下の値を `.env.local` に追加：

```bash
# Cognito
NEXT_PUBLIC_USER_POOL_ID=<UserPoolId>
NEXT_PUBLIC_USER_POOL_CLIENT_ID=<UserPoolClientId>
NEXT_PUBLIC_IDENTITY_POOL_ID=<IdentityPoolId>

# Aurora
DATABASE_URL="postgresql://pranceadmin:<PASSWORD>@<ClusterEndpoint>:5432/prance"

# S3
RECORDINGS_BUCKET_NAME=<RecordingsBucketName>
AVATARS_BUCKET_NAME=<AvatarsBucketName>

# CloudFront
NEXT_PUBLIC_CDN_URL=https://<CDNDomainName>
```

**注意**: Aurora パスワードはSecrets Managerから取得：

```bash
aws secretsmanager get-secret-value \
  --secret-id prance/aurora/dev \
  --query SecretString \
  --output text | jq -r .password
```

## 🎨 ステップ5: フロントエンド開発サーバー起動

```bash
# ルートディレクトリで
npm run dev

# または apps/web で直接
cd apps/web
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

## ✅ セットアップ完了チェックリスト

- [ ] Node.js 20.x インストール確認
- [ ] 外部サービスアカウント作成（5サービス）
- [ ] `.env.local` ファイル作成・設定
- [ ] `npm install` 完了
- [ ] PostgreSQL起動確認
- [ ] Prismaマイグレーション実行
- [ ] AWS CLI設定完了
- [ ] CDK Bootstrap完了
- [ ] CDKスタック全デプロイ完了
- [ ] CDK Outputsを `.env.local` に反映
- [ ] フロントエンド開発サーバー起動確認

## 🐛 トラブルシューティング

### エラー: "Module not found"

```bash
# node_modulesを削除して再インストール
rm -rf node_modules
npm install
```

### エラー: "CDK bootstrap required"

```bash
cd infrastructure
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

### エラー: Prisma migration failed

```bash
# マイグレーションリセット
cd packages/database
npx prisma migrate reset
npx prisma migrate dev --name init
```

### エラー: AWS credentials not found

```bash
# AWS認証情報を再設定
aws configure

# または環境変数で設定
export AWS_ACCESS_KEY_ID=xxxxx
export AWS_SECRET_ACCESS_KEY=xxxxx
```

## 📚 次のステップ

1. [docs/ALPHA_DEVELOPMENT.md](docs/ALPHA_DEVELOPMENT.md) - Alpha版開発ガイド
2. [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) - 開発ガイドライン
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - アーキテクチャ詳細

## 🆘 サポート

質問・問題がある場合：

- GitHub Issues: https://github.com/PranceHoldings/communication-platform/issues
- ドキュメント: [docs/](docs/)

---

**Happy Coding! 🚀**
