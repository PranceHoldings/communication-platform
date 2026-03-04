# Prance Alpha開発 - セッション進捗まとめ

**最終更新:** 2026-03-04
**セッション:** 初期セットアップ完了

---

## 📋 プロジェクト概要

**プロジェクト名:** Prance Communication Platform
**バージョン:** 0.1.0-alpha
**アーキテクチャ:** マルチテナント型SaaS、AWSサーバーレス
**主要技術:** Next.js 15, AWS Lambda, Aurora Serverless v2, Claude API

---

## ✅ 完了したセットアップ

### 1. 外部サービス設定

| サービス                 | ステータス | 詳細                                       |
| ------------------------ | ---------- | ------------------------------------------ |
| **AWS Bedrock (Claude)** | ✅ 完了    | Model ID: `us.anthropic.claude-sonnet-4-6` |
| **ElevenLabs (TTS)**     | ✅ 完了    | API Key設定済み                            |
| **Azure Speech (STT)**   | ✅ 完了    | API Key設定済み、リージョン: eastus        |
| **Ready Player Me**      | ⏸️ 保留    | Phase 1以降で設定予定                      |

**設定ファイル:** `/workspaces/prance-communication-platform/.env.local`

### 2. データベース設定

| 項目                 | 詳細                                                       |
| -------------------- | ---------------------------------------------------------- |
| **DBMS**             | PostgreSQL 15.17                                           |
| **稼働方法**         | Docker コンテナ                                            |
| **コンテナ名**       | `prance-postgres`                                          |
| **データベース名**   | `prance_dev`                                               |
| **接続情報**         | `postgresql://postgres:password@localhost:5432/prance_dev` |
| **Prisma**           | v5.22.0 (Client生成済み)                                   |
| **マイグレーション** | ✅ 実行済み（8テーブル作成）                               |

**作成されたテーブル:**

- organizations
- users (UserRole enum含む)
- avatars
- scenarios
- sessions
- recordings
- transcripts
- \_prisma_migrations

### 3. プロジェクト構造

```
prance-communication-platform/
├── .env.local                    # 環境変数（秘密情報含む、Git除外）
├── .env.example                  # 環境変数テンプレート
├── package.json                  # ルートパッケージ（workspace設定）
├── apps/                         # アプリケーション
│   ├── web/                      # Next.js 15 (未実装)
│   └── api/                      # Lambda関数 (未実装)
├── packages/
│   ├── shared/                   # 共通型定義
│   │   ├── src/types/index.ts   # TypeScript型定義（User, Session等）
│   │   └── src/index.ts
│   └── database/                 # Prisma設定
│       ├── prisma/
│       │   ├── schema.prisma    # データベーススキーマ（8モデル）
│       │   └── migrations/       # マイグレーション履歴
│       └── .env                  # Prisma用環境変数
├── infrastructure/               # AWS CDK (未実装)
├── docs/                         # ドキュメント
│   ├── ALPHA_DEVELOPMENT.md
│   ├── AZURE_SETUP_CHECKLIST.md
│   └── EXTERNAL_TOOLS_SETUP.md
└── CLAUDE.md                     # プロジェクト企画書（v2.0）
```

---

## 🔧 環境状態

### Docker コンテナ

```bash
# PostgreSQL コンテナ確認
docker ps | grep prance-postgres

# 期待される出力:
# CONTAINER ID   IMAGE         STATUS         PORTS                    NAMES
# 75b79a6ad544   postgres:15   Up XX minutes  0.0.0.0:5432->5432/tcp   prance-postgres
```

### データベース接続テスト

```bash
# 接続確認
docker exec prance-postgres psql -U postgres -d prance_dev -c "SELECT version();"

# テーブル一覧
docker exec prance-postgres psql -U postgres -d prance_dev -c "\dt"
```

### 環境変数

**`.env.local`（プロジェクトルート）:**

- AWS_REGION=us-east-1
- BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
- ELEVENLABS_API_KEY=sk_*** (設定済み)
- AZURE_SPEECH_KEY=*** (設定済み)
- AZURE_SPEECH_REGION=eastus
- DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"

**`packages/database/.env`（Prisma用）:**

- DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"

---

## 🎯 次回セッション開始時の確認事項

### 1. Docker コンテナ起動確認

```bash
# コンテナが起動しているか確認
docker ps | grep prance-postgres

# 停止している場合は起動
docker start prance-postgres
```

### 2. データベース接続確認

```bash
# 接続テスト
docker exec prance-postgres psql -U postgres -d prance_dev -c "SELECT COUNT(*) FROM users;"
```

### 3. AWS認証確認

```bash
# AWS認証情報確認
aws sts get-caller-identity

# 期待される出力:
# Account: 010438500933
# UserId: kenwakasa
```

---

## 📊 タスク進捗状況

| ID  | タスク                             | ステータス | 詳細                                   |
| --- | ---------------------------------- | ---------- | -------------------------------------- |
| #2  | Alpha版開発タスク管理セットアップ  | ✅ 完了    | TaskCreateで管理                       |
| #3  | プロジェクト構造の初期化           | ✅ 完了    | workspace設定、基本ディレクトリ        |
| #4  | TypeScript設定とLinter設定         | ✅ 完了    | 全プロジェクトで設定完了               |
| #5  | データベーススキーマ設計（Prisma） | ✅ 完了    | PostgreSQL + Prisma + マイグレーション |
| #6  | Next.js 15 プロジェクト初期化      | ✅ 完了    | App Router、Tailwind CSS設定完了       |
| #7  | AWS CDK プロジェクト初期化         | ✅ 完了    | 7スタック構築完了、CDK Synth成功       |
| #8  | 開発環境ドキュメント作成           | ✅ 完了    | infrastructure/README.md作成完了       |

---

## 🎉 Phase 0: インフラ基盤構築（完了）

### 完了した作業

**Week 1: コアインフラ** ✅
- [x] AWS CDKプロジェクト初期化
- [x] Network Stack: VPC、Subnets、NAT Gateway、VPC Endpoints、Security Groups
- [x] Cognito Stack: User Pool、Custom Attributes、Password Policy、OAuth
- [x] Database Stack: Aurora Serverless v2 (PostgreSQL 15.4)、Auto Scaling、Secrets Manager
- [x] Storage Stack: S3 Buckets (Recordings/Avatars)、CloudFront CDN、Lifecycle Policies
- [x] DynamoDB Stack: 4テーブル（Sessions State、WebSocket、Benchmark Cache、Rate Limit）

**Week 2: API基盤** ✅
- [x] API Gateway Stack: REST API、WebSocket API、Cognito Authorizer、CloudWatch Logs
- [x] Lambda Stack: Health Check関数、ARM64 (Graviton2)、X-Ray Tracing
- [x] Lambda関数実装: health-check/index.ts
- [x] TypeScript設定: 厳密な型チェック、ESLint、Prettier
- [x] CDK Synth成功: 7スタック生成
- [x] 包括的ドキュメント: infrastructure/README.md

### 成果物

- ✅ インフラコードリポジトリ (AWS CDK TypeScript)
- ✅ 7つのCloudFormationスタック (cdk.out/ ディレクトリ)
- ✅ ドキュメント完備 (README.md)

## 🚀 次のステップ（Phase 1へ）

### Option A: AWSへデプロイ（推奨）

実際のAWS環境にインフラをデプロイ：

```bash
cd infrastructure

# AWS認証確認
aws sts get-caller-identity

# CDK Bootstrap（初回のみ）
npm run bootstrap

# 全スタックデプロイ
npm run deploy
```

### Option B: Phase 1開始（MVP開発）

Lambda関数の実装を開始：

```bash
# Lambda関数テンプレート作成
mkdir -p infrastructure/lambda/{auth,session,analysis,report}

# API実装開始
# - セッション管理API
# - アバター管理API
# - シナリオ管理API
```

### Option C: 開発環境整備

Next.js開発サーバーとの統合：

```bash
cd apps/web

# 環境変数設定（AWS連携）
# - API Gateway URL
# - Cognito User Pool ID
# - WebSocket URL

# 開発サーバー起動
npm run dev
```

---

## ⚠️ 重要な注意事項

### 1. 本番環境との互換性

✅ **互換性確認済み:**

- PostgreSQL 15.17 → Aurora Serverless v2（完全互換）
- Prisma 5.22.0 → Aurora（完全互換）

⚠️ **Phase 0で対応必要:**

- AWS RDS Proxy設定（コネクションプーリング）
- CLAUDE.mdの「Prisma Data Proxy」記述修正（廃止済みサービス）

### 2. Git管理

**Git除外済み:**

- `.env.local`（秘密情報）
- `packages/database/.env`
- `node_modules/`

**Git管理対象:**

- `.env.example`（テンプレート）
- `prisma/schema.prisma`
- `prisma/migrations/`（マイグレーション履歴）

### 3. セキュリティ

🔒 **APIキーが設定済みのため、以下に注意:**

- `.env.local`を絶対にGitにコミットしない
- コード共有時は環境変数をマスク
- 本番環境ではAWS Secrets Managerを使用

---

## 📚 参考ドキュメント

| ドキュメント       | パス                            | 説明                           |
| ------------------ | ------------------------------- | ------------------------------ |
| プロジェクト企画書 | `CLAUDE.md`                     | v2.0、全体設計・アーキテクチャ |
| Alpha開発計画      | `docs/ALPHA_DEVELOPMENT.md`     | Phase 1-6実装計画              |
| Azure設定          | `docs/AZURE_SETUP_CHECKLIST.md` | Azure Speech Services設定手順  |
| 外部ツール設定     | `docs/EXTERNAL_TOOLS_SETUP.md`  | AWS Bedrock、ElevenLabs等      |

---

## 🔄 よくある操作コマンド

### データベース操作

```bash
# Prisma Client再生成
npm run db:generate

# マイグレーション実行
npm run db:migrate

# Prisma Studio起動（GUI）
npm run db:studio

# データベース接続確認
docker exec prance-postgres psql -U postgres -d prance_dev
```

### Docker操作

```bash
# PostgreSQL起動
docker start prance-postgres

# PostgreSQL停止
docker stop prance-postgres

# ログ確認
docker logs prance-postgres

# コンテナ削除（データも削除）
docker rm -f prance-postgres
```

### AWS操作

```bash
# 認証確認
aws sts get-caller-identity

# Bedrock利用可能モデル一覧
aws bedrock list-foundation-models --region us-east-1 --query 'modelSummaries[?contains(modelId, `claude`)].modelId'

# Bedrockテスト実行
aws bedrock-runtime invoke-model \
  --model-id us.anthropic.claude-sonnet-4-6 \
  --region us-east-1 \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}' \
  /tmp/response.json
```

---

## 🆘 トラブルシューティング

### PostgreSQLに接続できない

```bash
# 1. コンテナ起動確認
docker ps | grep prance-postgres

# 2. 停止している場合は起動
docker start prance-postgres

# 3. それでも接続できない場合は再作成
docker rm -f prance-postgres
docker run -d \
  --name prance-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=prance_dev \
  -p 5432:5432 \
  postgres:15
```

### Prisma Clientが見つからない

```bash
# 再生成
npm run db:generate
```

### AWS認証エラー

```bash
# 認証情報確認
aws configure list

# 再認証が必要な場合
aws configure
```

---

## 📝 メモ

- 開発環境はすべてローカル（Docker + localhost）
- 本番環境はAWSサーバーレス（Phase 0以降で構築）
- 現在はPhase 0準備段階（基本セットアップ完了）
- 次回から本格的な開発フェーズに入る準備が整った

---

**このドキュメントは次回セッション開始時に最初に確認してください。**
