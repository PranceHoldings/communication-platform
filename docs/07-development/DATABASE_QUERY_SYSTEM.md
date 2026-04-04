# データベースクエリシステム - 開発ガイド

**作成日**: 2026-03-15
**ステータス**: ✅ 実装完了

---

## 📋 概要

AWS Aurora RDS（VPC内）へ外部からアクセスするための標準化されたシステム。
Lambda関数経由でSQLクエリを実行し、結果を取得します。

---

## 🏗️ アーキテクチャ

```
┌─────────────────────┐
│ ローカル開発環境     │
│ (外部アクセス不可)   │
└──────────┬──────────┘
           │
           │ 1. SQLクエリ送信
           │    (直接 or S3経由)
           ▼
┌─────────────────────┐
│ S3 Bucket           │
│ prance-db-queries-* │  ← オプション: 大きなSQL用
└──────────┬──────────┘
           │
           │ 2. Lambda読み込み
           ▼
┌─────────────────────┐
│ Lambda Function     │
│ prance-db-query-*   │  ← VPC内で実行
│                     │     - SQL実行
│                     │     - 結果返却
└──────────┬──────────┘
           │
           │ 3. データベースアクセス
           ▼
┌─────────────────────┐
│ Aurora RDS          │
│ (VPC内のみアクセス可)│
└─────────────────────┘
```

---

## 🚀 使用方法

### 方法 1: 直接SQLクエリ実行 (推奨)

小さなクエリ（数KB以下）に最適。

```bash
# 基本的なSELECTクエリ
bash scripts/db-query.sh "SELECT id, title FROM scenarios LIMIT 5"

# 複雑なクエリ（ヒアドキュメント）
bash scripts/db-query.sh "
SELECT
  id,
  title,
  \"silencePromptTimeout\",
  \"enableSilencePrompt\"
FROM scenarios
WHERE \"silencePromptTimeout\" IS NOT NULL
ORDER BY \"createdAt\" DESC
LIMIT 10
"

# 書き込み操作（--write フラグ必須）
bash scripts/db-query.sh --write "UPDATE scenarios SET title='New Title' WHERE id='xxx'"

# 最大結果数指定
bash scripts/db-query.sh --max-results 100 "SELECT * FROM users"
```

### 方法 2: SQLファイル経由実行

大きなクエリやマイグレーションに最適。

```bash
# ファイルから読み込み（read-only）
bash scripts/db-query.sh --file scripts/queries/phase6-verification.sql

# ファイルから書き込み
bash scripts/db-exec.sh --write scripts/queries/migration.sql
```

---

## 📂 ディレクトリ構造

```
/workspaces/prance-communication-platform/
├── infrastructure/
│   └── lambda/
│       └── db-query/
│           ├── index.ts          ← Lambda関数
│           └── package.json
├── scripts/
│   ├── db-query.sh               ← 直接実行スクリプト
│   ├── db-exec.sh                ← S3経由実行スクリプト
│   └── queries/
│       └── phase6-verification.sql  ← サンプルクエリ
└── docs/
    └── 07-development/
        └── DATABASE_QUERY_SYSTEM.md  ← このファイル
```

---

## 🔒 セキュリティ

### Read-Only モード（デフォルト）

- **デフォルトで有効**: 全てのクエリはread-onlyモードで実行
- **許可**: SELECT, WITH句
- **拒否**: INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, GRANT, REVOKE

```bash
# Read-only (安全)
bash scripts/db-query.sh "SELECT * FROM users"

# Write操作は明示的に--writeフラグが必要
bash scripts/db-query.sh --write "UPDATE users SET name='New' WHERE id='xxx'"
```

### VPC内実行

- Lambda関数はVPC内で実行
- セキュリティグループで制限
- 外部から直接RDSアクセス不可

### 自動クリーンアップ

- S3バケット: 7日後に自動削除
- Lambda実行後: 即座にS3から削除

---

## 📊 Lambda関数仕様

### 関数名
- `prance-db-query-dev`
- `prance-db-query-staging`
- `prance-db-query-production`

### イベントペイロード

```json
{
  "queryId": "optional-s3-key",
  "sql": "optional-direct-sql",
  "readOnly": true,
  "params": {},
  "maxResults": 1000
}
```

### レスポンス形式

```json
{
  "success": true,
  "data": [...],
  "rowCount": 10,
  "executionTime": 156,
  "query": "SELECT ..."
}
```

### エラーレスポンス

```json
{
  "success": false,
  "error": "Only SELECT queries are allowed in read-only mode",
  "executionTime": 5,
  "query": "UPDATE ..."
}
```

---

## 🧪 テスト

### Phase 6検証クエリ実行

```bash
# Phase 6のsilencePromptTimeout階層的フォールバック検証
bash scripts/db-query.sh --file scripts/queries/phase6-verification.sql
```

**期待される出力**:

```
Check: Test Scenario
  id: 6f7f02c2-624e-41a2-b7ba-c0bc683584e5
  title: Test Hierarchical Fallback
  silencePromptTimeout: null
  Status: null (組織設定を使用)

Check: Organization Settings
  silencePromptTimeout: 25
  Status: 25秒

Check: Hierarchical Fallback
  Scenario Value: null
  Organization Value: 25
  System Default: 15
  Resolved Value: 25
  Verification: ✓ 正常
```

### 基本的な動作確認

```bash
# 1. シナリオ一覧取得
bash scripts/db-query.sh "SELECT id, title, \"silencePromptTimeout\" FROM scenarios LIMIT 5"

# 2. 組織設定確認
bash scripts/db-query.sh "SELECT * FROM organization_settings LIMIT 1"

# 3. ユーザー一覧
bash scripts/db-query.sh "SELECT id, email, role FROM users LIMIT 5"
```

---

## 🔧 デプロイ

### 初回デプロイ

```bash
# CDKで全スタックをデプロイ
cd infrastructure
pnpm exec cdk deploy Prance-dev-Storage --require-approval never  # S3バケット
pnpm exec cdk deploy Prance-dev-ApiLambda --require-approval never  # Lambda関数
```

### Lambda関数のみ更新

```bash
# Lambda関数コード変更後
cd infrastructure
pnpm exec cdk deploy Prance-dev-ApiLambda --require-approval never
```

---

## 🐛 トラブルシューティング

### エラー: "Function not found"

```bash
# Lambda関数がデプロイされているか確認
aws lambda get-function --function-name prance-db-query-dev

# デプロイされていない場合
cd infrastructure
pnpm exec cdk deploy Prance-dev-ApiLambda --require-approval never
```

### エラー: "Bucket not found"

```bash
# S3バケットが存在するか確認
aws s3 ls | grep prance-db-queries

# 存在しない場合
cd infrastructure
pnpm exec cdk deploy Prance-dev-Storage --require-approval never
```

### エラー: "Can't reach database server"

- Lambda関数がVPC内にあることを確認
- セキュリティグループの設定を確認
- RDSが起動していることを確認

```bash
# RDSクラスターの状態確認
aws rds describe-db-clusters --db-cluster-identifier prance-dev-database-auroracluster* --query 'DBClusters[0].Status'
```

### エラー: "Only SELECT queries are allowed in read-only mode"

- 書き込み操作には `--write` フラグが必要

```bash
# ❌ エラー
bash scripts/db-query.sh "UPDATE scenarios SET ..."

# ✅ 正しい
bash scripts/db-query.sh --write "UPDATE scenarios SET ..."
```

---

## 📝 ベストプラクティス

### 1. 常にread-onlyモードで開始

```bash
# まずSELECTで確認
bash scripts/db-query.sh "SELECT * FROM scenarios WHERE id='xxx'"

# 確認後に更新
bash scripts/db-query.sh --write "UPDATE scenarios SET ... WHERE id='xxx'"
```

### 2. 大きなクエリはファイル経由

```bash
# ❌ 複雑なクエリをコマンドラインに直接記述
bash scripts/db-query.sh "SELECT ... 100行のSQL ..."

# ✅ ファイルに保存して実行
echo "SELECT ... 100行のSQL ..." > scripts/queries/complex.sql
bash scripts/db-query.sh --file scripts/queries/complex.sql
```

### 3. クエリを保存して再利用

```bash
# よく使うクエリはscripts/queries/に保存
scripts/queries/
├── phase6-verification.sql
├── list-scenarios.sql
├── list-users.sql
└── organization-settings.sql
```

### 4. 結果をパイプで処理

```bash
# JSON出力をjqでフィルタ
bash scripts/db-query.sh "SELECT * FROM scenarios" | jq '.data[].title'

# CSVに変換
bash scripts/db-query.sh "SELECT id, title FROM scenarios" | jq -r '.data[] | [.id, .title] | @csv'
```

---

## 🔄 既存システムとの比較

### 旧: db-migration Lambda

- **用途**: Prisma migrationファイルの順次実行のみ
- **制限**: 固定ディレクトリ(`infrastructure/lambda/migrations/`)のSQLのみ
- **柔軟性**: ❌ 動的なクエリ実行不可

### 新: db-query Lambda

- **用途**: 任意のSQLクエリ実行
- **制限**: Read-onlyモード（デフォルト）、書き込みは明示的フラグ
- **柔軟性**: ✅ 動的なクエリ実行可能、S3経由も対応

---

## 📚 関連ドキュメント

- [DATABASE_MIGRATION_CHECKLIST.md](./DATABASE_MIGRATION_CHECKLIST.md) - Prismaマイグレーションチェックリスト
- [ENVIRONMENT_ARCHITECTURE.md](../02-architecture/ENVIRONMENT_ARCHITECTURE.md) - 環境アーキテクチャ

---

**最終更新**: 2026-03-15
**作成者**: Claude Code (Automated System)
