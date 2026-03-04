# Prance Alpha版 開発ワークスペース

**開始日**: 2026-03-04
**目標完了日**: 2026-04-29（6週間）
**ステータス**: 🚀 開発開始

---

## 目次

1. [アルファ版の範囲](#アルファ版の範囲)
2. [必要なアカウント・APIキー](#必要なアカウントapiキー)
3. [開発環境セットアップ](#開発環境セットアップ)
4. [開発フェーズ](#開発フェーズ)
5. [チェックリスト](#チェックリスト)

---

## アルファ版の範囲

### 提供機能

✅ **Phase 1: MVP - コア会話機能**

| 機能カテゴリ | 含む機能 | 含まない機能 |
|------------|---------|------------|
| **認証** | ・Cognito認証（Email/Password）<br>・JWT認証 | ・SSO/SAML<br>・MFA |
| **アバター** | ・3Dプリセットアバター（Ready Player Me）<br>・リップシンク | ・2Dアバター<br>・カスタムアバター生成 |
| **音声** | ・Azure STT（リアルタイム）<br>・ElevenLabs TTS<br>・プリセット音声 | ・音声クローニング<br>・カスタム音声 |
| **会話AI** | ・Claude API統合<br>・基本シナリオ | ・マルチプロバイダ<br>・プロンプト管理UI |
| **セッション** | ・リアルタイム会話<br>・WebSocket通信<br>・3要素統合UI | ・高度な分岐シナリオ |
| **録画** | ・ブラウザ録画（ユーザー+アバター）<br>・S3保存 | ・動画合成<br>・サムネイル生成 |
| **再生** | ・基本動画プレイヤー<br>・トランスクリプト表示 | ・同期プレイヤー<br>・ハイライト |
| **解析** | なし | ・感情解析<br>・音声解析 |
| **レポート** | なし | ・自動レポート生成<br>・PDF出力 |

### 技術スタック（Alpha版）

```yaml
Frontend:
  - Next.js 15 (App Router)
  - React 18
  - TypeScript
  - Three.js + React Three Fiber (3Dアバター)
  - Tailwind CSS + shadcn/ui
  - Zustand (状態管理)

Backend:
  - AWS Lambda (Node.js 20)
  - AWS API Gateway (REST + WebSocket)
  - AWS Cognito (認証)
  - Prisma (ORM)
  - NestJS風のモジュール構成

Database:
  - Aurora Serverless v2 (PostgreSQL)
  - DynamoDB (セッション状態)

Storage:
  - S3 (録画・アバター)
  - CloudFront (CDN)

External APIs:
  - AWS Bedrock (Claude on Bedrock)
  - ElevenLabs API (TTS)
  - Azure Speech Services (STT)
  - Ready Player Me (3Dアバター)
```

---

## 必要なアカウント・APIキー

### 🔴 必須（Alpha版で即座に必要）

#### 1. AWS アカウント

**用途**: メインインフラ（Lambda、Aurora、S3、Cognito等）

**取得手順**:
1. https://aws.amazon.com/ にアクセス
2. 「無料でアカウント作成」
3. クレジットカード登録必要（12ヶ月無料枠あり）

**必要な設定**:
```bash
# AWS CLI設定（ローカル開発用）
aws configure
# AWS Access Key ID: [入力]
# AWS Secret Access Key: [入力]
# Default region name: us-east-1
# Default output format: json
```

**コスト見積もり（Alpha版開発期間）**:
- 無料枠内: $0
- 超過時: 月額$50-100程度

---

#### 2. AWS Bedrock (Claude on Bedrock)

**用途**: AI会話エンジン（Claude API）

**取得手順**:
1. AWSアカウントでログイン（上記のAWSアカウントを使用）
2. AWS Console → Amazon Bedrock
3. 利用リージョン選択（推奨: us-east-1）
4. Model access → Manage model access
5. Anthropic Claude モデルを有効化
   - Claude 3.5 Sonnet
   - Claude 3 Opus（必要に応じて）

**必要な設定**:
```bash
# AWS認証情報（すでに設定済みの場合は不要）
# Bedrockは AWS SDK が自動的にIAM認証を使用
AWS_REGION=us-east-1

# IAM権限確認（Lambda実行ロール等）
# bedrock:InvokeModel 権限が必要
```

**コスト見積もり**:
- Claude 3.5 Sonnet: $3/1M input tokens, $15/1M output tokens
- Claude 3 Opus: $15/1M input tokens, $75/1M output tokens
- Alpha版開発期間: 約$10-30（AWSの統合請求）

**利点**:
- AWS課金の一本化
- IAM認証（APIキー管理不要）
- VPC内からの低レイテンシアクセス

---

#### 3. ElevenLabs (TTS)

**用途**: 音声合成（AIアバターの声）

**取得手順**:
1. https://elevenlabs.io/ にアクセス
2. Sign Up
3. Profile → API Keys

**必要な情報**:
```bash
ELEVENLABS_API_KEY=xxxxx...
```

**コスト見積もり**:
- Free Tier: 10,000文字/月
- Creator Plan: $22/月（100,000文字）
- Alpha版開発期間: Free Tierで十分（開発・テスト用）

---

#### 4. Azure (Speech Services)

**用途**: 音声認識（STT）

**取得手順**:
1. https://portal.azure.com/ にアクセス
2. Azure アカウント作成（Microsoft アカウント必要）
3. 「リソースの作成」→ "Speech Services" を検索
4. リージョン: East US, 価格レベル: Free F0

**必要な情報**:
```bash
AZURE_SPEECH_KEY=xxxxx...
AZURE_SPEECH_REGION=eastus
```

**コスト見積もり**:
- Free Tier: 5時間/月（音声認識）
- Alpha版開発期間: $0（Free Tier内）

---

#### 5. Ready Player Me

**用途**: 3Dアバターモデル

**取得手順**:
1. https://readyplayer.me/developers にアクセス
2. Sign Up
3. アプリケーション作成

**必要な情報**:
```bash
READY_PLAYER_ME_APP_ID=xxxxx...
```

**コスト**:
- 開発用: 無料
- 商用: 要問い合わせ（Alpha版は開発用で可）

---

#### 6. GitHub

**用途**: ソースコード管理

**取得手順**:
1. https://github.com/ でアカウント作成済み
2. リポジトリ: https://github.com/PranceHoldings/communication-platform

**必要な設定**:
```bash
# Git設定（既存）
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

### 🟡 推奨（Alpha版後半で必要）

#### 7. Sentry（エラートラッキング）

**用途**: エラー監視

**取得手順**:
1. https://sentry.io/ にアクセス
2. Sign Up（GitHub連携可）
3. プロジェクト作成

**コスト**: Developer Plan 無料（月間5,000エラー）

---

### 🟢 不要（Beta版以降）

- Azure Face API（感情解析）
- Stripe（決済）
- 追加のATSアカウント

---

## 開発環境セットアップ

### 前提条件

```bash
# インストール確認
node --version   # v20.x 必須
npm --version    # v10.x 推奨
git --version    # v2.x
aws --version    # v2.x
docker --version # (オプション)
```

### 環境変数設定

#### ルート `.env.local` ファイル作成

```bash
# /workspaces/prance-communication-platform/.env.local

#############################################
# AWS Configuration
#############################################
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012  # 実際のアカウントIDに置き換え

#############################################
# AWS Bedrock (Claude API)
#############################################
# Bedrockは AWS SDK が自動的にIAM認証を使用します
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

#############################################
# ElevenLabs (TTS)
#############################################
ELEVENLABS_API_KEY=xxxxx

#############################################
# Azure Speech Services (STT)
#############################################
AZURE_SPEECH_KEY=xxxxx
AZURE_SPEECH_REGION=eastus

#############################################
# Ready Player Me
#############################################
READY_PLAYER_ME_APP_ID=xxxxx

#############################################
# Database (設定後に自動生成)
#############################################
DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"

#############################################
# Next.js
#############################################
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001

#############################################
# Sentry (オプション)
#############################################
# SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

#### フロントエンド `.env.local`

```bash
# /workspaces/prance-communication-platform/apps/web/.env.local

NEXT_PUBLIC_AZURE_SPEECH_KEY=xxxxx
NEXT_PUBLIC_AZURE_SPEECH_REGION=eastus
NEXT_PUBLIC_READY_PLAYER_ME_APP_ID=xxxxx
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 依存関係インストール

```bash
# ルートディレクトリで実行
cd /workspaces/prance-communication-platform

# 依存関係インストール（すべてのパッケージ）
npm install

# CDK CLI インストール（グローバル）
npm install -g aws-cdk

# Prisma CLI インストール（グローバル）
npm install -g prisma
```

### データベース初期化（ローカル開発）

```bash
# Docker で PostgreSQL 起動（オプション）
docker run --name prance-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=prance_dev \
  -p 5432:5432 \
  -d postgres:15

# Prisma マイグレーション実行
cd packages/database
npx prisma migrate dev --name init
npx prisma generate
```

---

## 開発フェーズ

### Week 1: インフラ基盤 + 認証（完了目標: 3/11）

**インフラ（AWS CDK）**:
- [x] プロジェクト構造作成
- [ ] AWS CDK初期化
- [ ] VPC・ネットワークスタック
- [ ] Cognito User Pool作成
- [ ] Aurora Serverless v2スタック
- [ ] S3バケット作成
- [ ] CloudFront設定

**認証**:
- [ ] Cognitoログイン/サインアップAPI
- [ ] Next.js認証UI
- [ ] JWT検証ミドルウェア

**マイルストーン**: ユーザー登録・ログインが動作

---

### Week 2: アバター表示 + 基本UI（完了目標: 3/18）

**3Dアバター**:
- [ ] Three.js + React Three Fiberセットアップ
- [ ] Ready Player Meモデル読み込み
- [ ] 基本アニメーション（待機状態）
- [ ] リップシンク実装（Viseme対応）

**UI**:
- [ ] ダッシュボード画面
- [ ] アバター選択画面
- [ ] セッション画面レイアウト

**マイルストーン**: プリセットアバターが画面に表示される

---

### Week 3: 会話エンジン（完了目標: 3/25）

**AWS Bedrock (Claude) 統合**:
- [ ] Bedrock Lambdaラッパー (@aws-sdk/client-bedrock-runtime)
- [ ] システムプロンプト管理
- [ ] 会話コンテキスト管理（DynamoDB）

**シナリオ**:
- [ ] シナリオデータモデル
- [ ] 基本シナリオ3種類作成（面接・語学・接客）
- [ ] シナリオ選択UI

**マイルストーン**: Claudeとテキストベースで会話可能

---

### Week 4: 音声処理（完了目標: 4/1）

**TTS (ElevenLabs)**:
- [ ] ElevenLabs API統合
- [ ] 音声ストリーミング再生
- [ ] Visemeデータ取得・パース

**STT (Azure)**:
- [ ] Azure Speech SDKセットアップ
- [ ] リアルタイムストリーミング認識
- [ ] 認識中/確定テキスト処理

**マイルストーン**: 音声での双方向会話が動作

---

### Week 5: セッション実行・録画（完了目標: 4/8）

**WebSocket通信**:
- [ ] IoT Core WebSocketセットアップ
- [ ] Lambda WebSocketハンドラー
- [ ] 接続管理（DynamoDB）

**リアルタイムUI（3要素統合）**:
- [ ] ユーザーカメラ表示
- [ ] アバター映像表示
- [ ] リアルタイム文字起こし表示

**録画**:
- [ ] MediaRecorder統合（ユーザー+アバター）
- [ ] S3アップロード

**マイルストーン**: フル機能のセッション実行が動作

---

### Week 6: トランスクリプト・再生・最終調整（完了目標: 4/15）

**トランスクリプト**:
- [ ] トランスクリプトCRUD API
- [ ] トランスクリプト表示UI

**動画再生**:
- [ ] Video.js統合
- [ ] サイドバイサイド表示
- [ ] 基本トランスクリプト同期

**最終調整**:
- [ ] バグフィックス
- [ ] パフォーマンス最適化
- [ ] ドキュメント更新

**マイルストーン**: Alpha版リリース準備完了

---

## チェックリスト

### 📋 事前準備

- [ ] AWSアカウント作成・設定
- [ ] AWS Bedrock Claude モデル有効化（us-east-1）
- [ ] ElevenLabs APIキー取得
- [ ] Azure Speech Servicesキー取得
- [ ] Ready Player Meアプリ作成
- [ ] `.env.local` ファイル作成（ルート + apps/web）
- [ ] 依存関係インストール完了
- [ ] ローカルPostgreSQL起動（またはAurora接続）

### 🚀 Week 1 タスク

- [ ] AWS CDK初期化
- [ ] VPCスタックデプロイ
- [ ] Cognitoスタックデプロイ
- [ ] Auroraスタックデプロイ
- [ ] S3バケット作成
- [ ] Cognito認証API実装
- [ ] Next.jsログインUI実装
- [ ] 動作確認: ユーザー登録・ログイン

### 📝 開発ログ

#### 2026-03-04
- [x] Alpha版開発ワークスペースドキュメント作成
- [x] 必要アカウント・APIキーリスト整理
- [ ] プロジェクト構造セットアップ開始

---

## 次のステップ

### 即座に実行すべきこと

1. **外部サービスアカウント作成**（1-2時間）
   - AWS（Bedrock Claude モデル有効化含む）
   - ElevenLabs, Azure, Ready Player Me
   - APIキー取得
   - `.env.local` ファイルに記入

2. **ローカル環境セットアップ**（30分）
   - 依存関係インストール
   - PostgreSQL起動
   - Prismaマイグレーション実行

3. **AWS CDKデプロイ**（1時間）
   - CDKスタック作成
   - 初回デプロイ実行
   - 動作確認

### 並行作業可能

- フロントエンド: UIコンポーネント作成（認証不要部分）
- バックエンド: データモデル設計・Prismaスキーマ作成
- インフラ: CDKスタック作成（デプロイは後回し可）

---

## トラブルシューティング

### AWS CDKデプロイエラー

```bash
# CDK Bootstrap（初回のみ）
cdk bootstrap aws://ACCOUNT-ID/REGION

# スタック削除（やり直し時）
cdk destroy --all
```

### Prismaマイグレーションエラー

```bash
# マイグレーションリセット
npx prisma migrate reset

# スキーマ再生成
npx prisma generate
```

### Node.jsバージョン不一致

```bash
# nvmでNode 20インストール
nvm install 20
nvm use 20
```

---

## 参考ドキュメント

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - 詳細実装計画
- [ARCHITECTURE.md](ARCHITECTURE.md) - システムアーキテクチャ
- [EXTERNAL_TOOLS_SETUP.md](EXTERNAL_TOOLS_SETUP.md) - 外部ツール詳細手順
- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) - 開発ガイドライン

---

**最終更新**: 2026-03-04
**次回更新予定**: Week 1完了時（2026-03-11）
