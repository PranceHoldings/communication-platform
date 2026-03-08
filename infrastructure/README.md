# Prance Platform - Infrastructure (AWS CDK)

AWS Cloud Development Kit (CDK) を使用したPranceプラットフォームのインフラストラクチャコード。

## 📋 概要

このディレクトリには、Pranceプラットフォームのすべての AWS インフラストラクチャをコード（IaC）として定義しています。

### スタック構成

| スタック名                  | 説明                  | 主要リソース                                                                     |
| --------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| **DnsStack** ★NEW           | DNSホストゾーン       | Route 53 Hosted Zone                                                             |
| **CertificateStack** ★NEW   | SSL/TLS証明書         | ACM Certificate (us-east-1)                                                      |
| **NetworkStack**            | VPC・ネットワーク基盤 | VPC, Subnets, NAT Gateway, VPC Endpoints                                         |
| **CognitoStack**            | 認証・認可            | User Pool, User Pool Client, Identity Pool                                       |
| **DatabaseStack**           | データベース          | Aurora Serverless v2 (PostgreSQL)                                                |
| **StorageStack**            | ストレージ・CDN       | S3 Buckets, CloudFront Distribution, Custom Domain                               |
| **DynamoDBStack**           | NoSQLデータストア     | セッション状態、WebSocket接続、ベンチマークキャッシュ、APIレート制限             |
| **ApiGatewayStack**         | API Gateway           | REST API, WebSocket API, Cognito Authorizer                                      |
| **ApiLambdaStack** ★UPDATED | Lambda関数            | ヘルスチェック、JWT Authorizer、認証API（Register/Login/Me）、DBマイグレーション |

## 🌐 ドメイン設定

本プラットフォームは、お名前.comで取得したルートドメイン `prance.co.jp` を使用します。

| 環境             | ドメイン                        | 説明             |
| ---------------- | ------------------------------- | ---------------- |
| **開発**         | `dev.platform.prance.co.jp`     | 開発環境         |
| **ステージング** | `staging.platform.prance.co.jp` | ステージング環境 |
| **本番**         | `platform.prance.co.jp`         | 本番環境         |

**📖 詳細な設定手順:** [docs/DOMAIN_SETUP.md](docs/DOMAIN_SETUP.md)

### 初回セットアップ（1回のみ）

1. **Route 53 ホストゾーン作成:**

   ```bash
   aws route53 create-hosted-zone --name prance.co.jp --caller-reference "prance-$(date +%s)"
   ```

2. **お名前.comでネームサーバー変更:**
   - Route 53から取得した4つのネームサーバーを設定
   - 反映まで24-48時間待機

3. **デプロイ:**
   ```bash
   npm run deploy:dev
   ```

---

## ⚡ クイックスタート

**初めてデプロイする場合:**

```bash
# 1. AWS認証設定
aws configure

# 2. 依存関係インストール
npm install

# 3. 1発デプロイ（すべて自動）
npm run deploy:quick
```

これだけで完了です！🎉

---

## 🚀 使い方

### 前提条件

```bash
# AWS CLIの設定
aws configure

# AWS CDKの Bootstrap（初回のみ）
npm run bootstrap
```

### ビルド

```bash
# TypeScriptをコンパイル
npm run build

# ウォッチモード（開発時）
npm run watch
```

### デプロイ

#### 🚀 1発デプロイ（推奨）

前提条件チェック、ビルド、Bootstrap、デプロイを自動で実行：

```bash
# 開発環境にデプロイ（デフォルト）
npm run deploy:quick

# または環境を指定
npm run deploy:dev        # 開発環境
npm run deploy:staging    # ステージング環境
npm run deploy:production # 本番環境
```

**スクリプトの動作:**

1. ✅ AWS CLI・Node.js・npm確認
2. ✅ AWS認証確認
3. ✅ 依存関係インストール (npm ci)
4. ✅ TypeScriptビルド
5. ✅ CDK Synth
6. ✅ CDK Bootstrap（初回のみ）
7. ✅ 全スタックデプロイ
8. ✅ デプロイ結果表示

#### 手動デプロイ

```bash
# すべてのスタックをデプロイ
npm run deploy

# 特定のスタックのみデプロイ
npm run cdk -- deploy Prance-dev-Network

# 複数スタックを指定
npm run cdk -- deploy Prance-dev-Network Prance-dev-Cognito

# 環境を指定してデプロイ
npm run cdk -- deploy --context environment=production
```

### 確認・テスト

```bash
# CloudFormationテンプレートの生成
npm run synth

# スタックのリスト表示
npm run cdk -- list

# 変更内容の確認（Diff）
npm run diff
```

### 削除

```bash
# すべてのスタックを削除
npm run destroy

# ⚠️ 警告: 本番環境では実行しないでください
```

## 🏗️ アーキテクチャ詳細

### Network Stack

- **VPC**: Multi-AZ構成（2つのAZ）
- **Subnets**: Public, Private (NAT経由), Isolated (完全プライベート)
- **NAT Gateway**: 1つ（コスト削減のため）
- **VPC Endpoints**: S3, DynamoDB（トラフィックコスト削減）
- **Security Groups**: Lambda用、Aurora用

### Cognito Stack

- **User Pool**: メール認証、MFA対応準備
- **Custom Attributes**: `orgId` (組織ID), `role` (ユーザーロール)
- **Password Policy**: 最小8文字、大小文字・数字必須
- **OAuth**: Authorization Code Grant対応

### Database Stack

- **Aurora Serverless v2**: PostgreSQL 15.4
- **Auto Scaling**: 0.5 ACU (最小) - 2 ACU (最大)
- **Backup**: 本番7日、開発1日
- **Secrets Manager**: 認証情報の安全な管理

### Storage Stack

- **Recordings Bucket**: 録画ファイル保存
  - Lifecycle: 本番90日、開発7日後削除
  - Intelligent Tiering: 30日後自動移行（本番のみ）
- **Avatars Bucket**: アバターモデル保存
  - Intelligent Tiering: 即時適用
- **CloudFront**: グローバルCDN配信
  - Price Class 100: 北米・ヨーロッパ（コスト最適化）

### DynamoDB Stack

- **Sessions State Table**: セッション実行中の状態管理
  - TTL: 24時間
  - Billing: オンデマンド
- **WebSocket Connections Table**: リアルタイム接続管理
  - GSI: `user_id-index`
  - TTL: 2時間
- **Benchmark Cache Table**: ベンチマークデータキャッシュ
  - TTL: 30日
- **API Rate Limit Table**: APIレート制限カウンター
  - TTL: 動的（1時間〜30日）

### API Gateway Stack

- **REST API**:
  - CORS有効化
  - Cognito認証統合
  - CloudWatch Logs統合
  - Usage Plan（レート制限）
- **WebSocket API**: リアルタイム通信用（基本設定）
  - 注: 本番環境ではAWS IoT Coreに移行予定

### Lambda Stack

- **Runtime**: Node.js 20.x
- **Architecture**: ARM64 (Graviton2 - コスト削減20%)
- **Tracing**: AWS X-Ray有効化
- **Log Retention**: 本番1ヶ月、開発1週間
- **Bundling**: esbuild（自動最適化）

## 📝 環境変数

CDKはコンテキスト変数を使用して環境を切り替えます。

```bash
# 開発環境（デフォルト）
npm run deploy

# ステージング環境
npm run cdk -- deploy --context environment=staging

# 本番環境
npm run cdk -- deploy --context environment=production
```

### 環境別の違い

| 設定項目       | 開発 (dev) | 本番 (production) |
| -------------- | ---------- | ----------------- |
| Aurora ACU     | 0.5-2      | 0.5-2             |
| Aurora Replica | なし       | あり（Reader）    |
| Backup保持     | 1日        | 7日               |
| 削除保護       | なし       | あり              |
| Removal Policy | DESTROY    | RETAIN/SNAPSHOT   |
| Log保持        | 1週間      | 1ヶ月             |

## 🔒 セキュリティ

- **IAM**: 最小権限の原則
- **Secrets Manager**: 認証情報の暗号化保存
- **VPC**: プライベートサブネットでのリソース配置
- **Security Groups**: 厳密なインバウンドルール
- **Encryption**: S3 (SSE-S3), Aurora (暗号化DB)

## 💰 コスト最適化

- **Serverless**: 使用量ベース課金
- **ARM64**: Lambda実行コスト20%削減
- **Intelligent Tiering**: S3自動コスト最適化
- **NAT Gateway**: 1つのみ（開発環境）
- **VPC Endpoints**: データ転送コスト削減
- **Aurora Serverless v2**: アイドル時最小ACU (0.5)

### 概算コスト（月間1000セッション想定）

- **開発環境**: $50-100/月
- **本番環境**: $500-800/月

## 🛠️ トラブルシューティング

### ビルドエラー

```bash
# node_modulesを再インストール
rm -rf node_modules package-lock.json
npm install

# TypeScriptキャッシュをクリア
rm -rf cdk.out
npm run build
```

### デプロイエラー

```bash
# CDK Bootstrapが必要
npm run bootstrap

# スタック依存関係を確認
npm run cdk -- list

# デプロイ状態を確認
npm run status

# 特定のスタックを削除して再デプロイ
npm run cdk -- destroy Prance-dev-Lambda
npm run cdk -- deploy Prance-dev-Lambda
```

### AWS認証エラー

```bash
# AWS認証情報を確認
aws sts get-caller-identity

# 認証情報が設定されていない場合
aws configure

# プロファイルを使用する場合
export AWS_PROFILE=your-profile-name
npm run deploy:dev
```

### デプロイスクリプトエラー

```bash
# スクリプトに実行権限がない場合
chmod +x deploy.sh

# 直接実行
./deploy.sh dev

# またはBash経由で実行
bash deploy.sh dev
```

## 📚 参考資料

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK TypeScript API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [Prance Platform 企画書](../CLAUDE.md)

## 🔄 次のステップ

1. ✅ Phase 0: インフラ基盤構築（完了）
2. ✅ 認証API実装（完了）- Register、Login、/users/me、Lambda Authorizer
3. ⏭️ Phase 1: MVP開発（進行中）
   - フロントエンド開発（Next.js）
   - アバター・会話エンジン実装
   - 音声・セッション実行機能
4. ⏭️ Phase 2: Step Functions（非同期処理ワークフロー）
5. ⏭️ Phase 3: EventBridge統合（イベント駆動）

---

## 🎯 デプロイ済みAPI情報（2026-03-05）

**API Base URL:** `https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/`

**稼働中のエンドポイント:**

```bash
# ヘルスチェック
GET /api/v1/health

# 認証API
POST /api/v1/auth/register     # ユーザー登録
POST /api/v1/auth/login        # ログイン
GET  /api/v1/users/me          # 現在のユーザー情報取得（認証必要）
```

**動作確認:**

```bash
# API Base URL設定
API_URL="https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev"

# 1. ヘルスチェック
curl "$API_URL/api/v1/health"

# 2. ユーザー登録
curl -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123","name":"Test User"}'

# 3. ログイン
TOKEN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123"}' | jq -r '.data.tokens.accessToken')

# 4. 認証済みAPI呼び出し
curl -X GET "$API_URL/api/v1/users/me" \
  -H "Authorization: Bearer $TOKEN"
```

**Lambda関数一覧:**

- `prance-authorizer-dev` - JWT Token検証
- `prance-auth-register-dev` - ユーザー登録
- `prance-auth-login-dev` - ログイン
- `prance-users-me-dev` - ユーザー情報取得
- `prance-health-check-dev` - ヘルスチェック
- `prance-db-migration-dev` - DBマイグレーション

---

**最終更新**: 2026-03-05
**バージョン**: 0.1.0-alpha
