# 環境アーキテクチャ定義

**作成日:** 2026-03-06
**重要度:** 🔴 最重要

---

## 📋 現在の環境構成

### 環境A: ローカル開発環境（現在使用中）

```
┌─────────────────────────────────────────────────────────────┐
│ ローカルマシン                                                │
│                                                               │
│  ブラウザ (Chrome/Firefox)                                    │
│    ↓ http://localhost:3000                                   │
│  Next.js Dev Server                                          │
│    - ポート: 3000                                            │
│    - 実行場所: /workspaces/prance-communication-platform/   │
│                apps/web                                       │
│    - プロセス: npm run dev                                    │
└─────────────────────────────────────────────────────────────┘
                    ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│ AWS us-east-1                                                │
│                                                               │
│  API Gateway (REST API)                                      │
│    - URL: https://ffypxkomg1.execute-api.us-east-1.        │
│           amazonaws.com/dev/                                 │
│    - Stage: dev                                              │
│    ↓                                                         │
│  Lambda Functions (Node.js 20, ARM64)                       │
│    - prance-auth-login-dev                                   │
│    - prance-auth-register-dev                                │
│    - prance-users-me-dev                                     │
│    - prance-sessions-*-dev                                   │
│    - prance-scenarios-*-dev                                  │
│    - prance-avatars-*-dev                                    │
│    - prance-db-migration-dev                                 │
│    ↓                                                         │
│  RDS Aurora Serverless v2 (PostgreSQL 15.4)                 │
│    - Cluster: prance-dev-database                            │
│    - Endpoint: *.cluster-*.us-east-1.rds.amazonaws.com      │
│    - Database: prance                                        │
│    - VPC: Private Subnets                                    │
│                                                               │
│  AWS Cognito User Pool                                       │
│    - Pool ID: us-east-1_*                                    │
│    - 認証フロー: JWT                                          │
│                                                               │
│  DynamoDB Tables                                             │
│    - WebSocketConnections                                    │
│    - SessionStates                                           │
│    - BenchmarkCache                                          │
│                                                               │
│  S3 Buckets + CloudFront                                     │
│    - Recordings Bucket                                       │
│    - CDN配信                                                  │
└─────────────────────────────────────────────────────────────┘
```

**特徴:**
- ✅ フロントエンドのみローカル（高速なHMR）
- ✅ バックエンドは完全にAWS（本番同等の動作）
- ✅ データベースは共有（AWS Aurora）
- ❌ オフライン開発不可
- ❌ Lambda コールドスタート発生

**使用する環境変数:**
```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
```

**起動方法:**
```bash
cd /workspaces/prance-communication-platform/apps/web
npm run dev
# → http://localhost:3000
```

---

### 環境B: 本番デプロイ環境（未実装）

```
┌─────────────────────────────────────────────────────────────┐
│ エンドユーザー                                                │
│                                                               │
│  ブラウザ                                                     │
│    ↓ HTTPS                                                   │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ AWS us-east-1                                                │
│                                                               │
│  【未実装】Next.js デプロイ先（検討中）                      │
│    オプション1: AWS Amplify Hosting                          │
│    オプション2: Vercel                                        │
│    オプション3: EC2 + Docker                                 │
│    ↓                                                         │
│  API Gateway (REST API) ← 環境Aと同じ                       │
│    ↓                                                         │
│  Lambda Functions ← 環境Aと同じ                             │
│    ↓                                                         │
│  RDS Aurora Serverless v2 ← 環境Aと同じ                     │
└─────────────────────────────────────────────────────────────┘
```

**特徴:**
- ⏳ フロントエンドのデプロイ先未決定
- ✅ バックエンドは環境Aと同じインフラを共有
- ✅ データベースは同じAurora

**注意:**
- 現時点では環境Aのみ実装済み
- フロントエンドの本番デプロイは Phase 2 以降

---

## 🗄️ データベース構成

### AWS RDS Aurora Serverless v2

**スペック:**
- エンジン: PostgreSQL 15.4
- ACU範囲: 0.5 - 1.0（開発環境）
- ストレージ: 自動スケーリング
- バックアップ: 7日間保持

**接続情報:**
```
Endpoint: prance-dev-database-*.cluster-*.us-east-1.rds.amazonaws.com
Port: 5432
Database: prance
Username: postgres (Secrets Manager経由)
Password: (Secrets Manager経由)
```

**重要:**
- ✅ Lambda関数からVPC経由で接続
- ❌ ローカルマシンから直接接続不可（セキュリティグループで制限）
- ✅ 開発・本番で同じデータベースを使用（スキーマは別テーブル/DBで分離予定）

**現在のユーザーデータ:**
```sql
-- 組織
- Platform Administration (8d4cab88-ab01-41e0-a59c-b93aeabfdbe6)
- Test Organization (c3c1336a-ebb8-4536-8396-2ac24bda3c1e)

-- ユーザー
1. admin@prance.com / Admin2026!Prance (SUPER_ADMIN)
2. test@example.com / Test2026! (CLIENT_ADMIN)
```

---

## 🔑 ローカルPostgreSQL（未使用）

**状態:**
- ✅ Dockerコンテナで起動中（prance-postgres）
- ❌ 実際には使用していない
- ❌ .env.localがAWS Lambda APIを指しているため

**接続情報:**
```
Host: localhost
Port: 5432
Database: prance_dev
Username: postgres
Password: password
```

**用途:**
- テストデータの一時保存
- スキーマ確認
- 将来的な完全ローカル開発環境の構築（Phase 2以降）

**起動確認:**
```bash
docker ps | grep prance-postgres
docker exec prance-postgres psql -U postgres -d prance_dev -c "\dt"
```

---

## 📁 環境変数の管理

### 単一の真実の情報源（SSOT）

```
/workspaces/prance-communication-platform/
  └── .env.local  ← 全てのAPIキーをここで一元管理
```

**内容:**
```bash
#############################################
# AWS Configuration
#############################################
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=010438500933

#############################################
# Frontend Configuration
#############################################
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1

#############################################
# Database (Lambda経由で使用)
#############################################
DATABASE_URL="postgresql://postgres:****@prance-dev-database-*.us-east-1.rds.amazonaws.com:5432/prance"

#############################################
# API Keys
#############################################
AZURE_SPEECH_KEY=****
ELEVENLABS_API_KEY=****
JWT_SECRET=****

#############################################
# AWS Bedrock
#############################################
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
```

### デプロイ時の自動同期

```bash
# デプロイ前に自動実行
infrastructure/scripts/sync-env.js
  ↓
.env.local → infrastructure/.env にコピー
  ↓
CDK デプロイ時にLambda環境変数として設定
```

---

## 🔄 開発フロー

### フロントエンド開発

```bash
# 1. 開発サーバー起動
cd /workspaces/prance-communication-platform/apps/web
npm run dev

# 2. ブラウザでアクセス
open http://localhost:3000

# 3. コード編集
# apps/web/app/**/*.tsx
# apps/web/components/**/*.tsx

# 4. HMR（Hot Module Replacement）で即座に反映
```

### バックエンド（Lambda）開発

```bash
# 1. Lambda関数を編集
# infrastructure/lambda/**/*.ts

# 2. デプロイ
cd /workspaces/prance-communication-platform/infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# 3. CloudWatch Logsで確認
aws logs tail /aws/lambda/prance-auth-login-dev --follow
```

### データベーススキーマ変更

```bash
# 1. Prismaスキーマ編集
# packages/database/prisma/schema.prisma

# 2. マイグレーションSQL生成
cd packages/database
npx prisma migrate dev --name your_migration_name

# 3. AWS Auroraに適用（Migration Lambda経由）
cd infrastructure
# migration.sqlを作成
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"your_migration.sql"}' \
  /tmp/result.json
```

---

## 🎯 環境の確認方法

### フロントエンド

```bash
# 開発サーバーが起動しているか
curl http://localhost:3000/api/health

# 環境変数の確認
cat apps/web/.env.local | grep NEXT_PUBLIC_API_URL
```

### バックエンド（AWS Lambda）

```bash
# API Gatewayへの接続確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# Lambda関数の確認
aws lambda list-functions --query "Functions[?contains(FunctionName, 'prance')].FunctionName"

# CloudWatch Logs確認
aws logs tail /aws/lambda/prance-auth-login-dev --since 5m
```

### データベース（AWS Aurora）

```bash
# Lambda経由でクエリ実行（直接接続は不可）
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"check-users.sql"}' \
  /tmp/result.json
```

---

## ⚠️ 重要な制約事項

### 1. データベースはAWS Auroraのみ

**理由:**
- .env.localがAWS Lambda APIを指している
- Lambda関数がAWS Auroraに接続
- ローカルPostgreSQLは使用していない

**影響:**
- オフライン開発不可
- データベース変更はLambda経由のみ
- 開発中もAWSコスト発生

### 2. Lambda コールドスタート

**現象:**
- 初回APIコール時に2-5秒の遅延
- 頻繁にアクセスすれば緩和される

**対策:**
- Provisioned Concurrency（本番環境で検討）
- Keep-Alive リクエスト（実装予定）

### 3. フロントエンドのみローカル

**現状:**
- Next.jsはローカルで実行
- 全てのAPI呼び出しはAWS Lambda経由

**将来の改善（Phase 2）:**
- Next.js API Routesの実装
- 完全ローカル開発環境の構築
- 環境切り替えスクリプト

---

## 📝 次のステップ

### Phase 1: 現在の環境で開発継続

- ✅ AWS Auroraにユーザーデータ作成済み
- ✅ ログイン機能確認
- ⏳ セッション管理UI実装
- ⏳ アバター・シナリオ管理UI実装

### Phase 2: ローカル開発環境の完全化

- ⏳ Next.js API Routesの実装
- ⏳ ローカルPostgreSQLの活用
- ⏳ 環境切り替えスクリプト作成

### Phase 3: 本番環境へのデプロイ

- ⏳ フロントエンドのデプロイ先決定
- ⏳ CI/CDパイプライン構築
- ⏳ 本番用データベースの分離

---

**最終更新:** 2026-03-06
**確認者:** Claude Code
**次回レビュー:** Phase 1完了時
