# データベースマイグレーション チェックリスト

**作成日:** 2026-03-07
**目的:** Prismaスキーマ変更時のマイグレーション漏れを防止

---

## 🔴 事前確認（変更前）

### 1. 変更の影響範囲を確認

- [ ] 変更するテーブルを使用しているLambda関数をリストアップ
- [ ] フロントエンドで使用している箇所を特定
- [ ] 既存データへの影響を評価（破壊的変更の有無）

### 2. バックアップ確認

- [ ] AWS RDS自動バックアップが有効（確認コマンド下記）
  ```bash
  aws rds describe-db-clusters \
    --db-cluster-identifier <cluster-id> \
    --query 'DBClusters[0].BackupRetentionPeriod'
  ```

---

## ✅ 必須実行手順（変更時）

### Step 1: Prismaスキーマ変更

```bash
cd /workspaces/prance-communication-platform/packages/database
```

**変更内容:**
- [ ] `prisma/schema.prisma` を編集
- [ ] 変更内容をコミットメッセージに記載予定

### Step 2: マイグレーションファイル生成

```bash
npx prisma migrate dev --name <変更内容の簡潔な説明>
```

**例:**
```bash
npx prisma migrate dev --name add_recording_video_fields
npx prisma migrate dev --name add_user_profile_fields
npx prisma migrate dev --name rename_column_old_to_new
```

**確認事項:**
- [ ] `prisma/migrations/` に新しいディレクトリが作成された
- [ ] `migration.sql` が生成された
- [ ] SQLの内容を目視確認（破壊的変更がないか）

### Step 3: Prisma Client再生成

```bash
npx prisma generate
```

**確認事項:**
- [ ] `node_modules/.prisma/client/` が更新された
- [ ] TypeScript型定義が更新された

### Step 4: Lambda関数デプロイ

```bash
cd ../../infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

**⏱️ 所要時間:** 約60-90秒

**確認事項:**
- [ ] デプロイが成功（"✅ Prance-dev-ApiLambda"）
- [ ] エラーログがない

### Step 5: データベースマイグレーション実行

```bash
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{}' \
  /tmp/migration-result.json

cat /tmp/migration-result.json | jq '.'
```

**期待される出力:**
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Migration completed successfully\",\"statementsExecuted\":5}"
}
```

**確認事項:**
- [ ] `statusCode` が 200
- [ ] `success` が `true`
- [ ] エラーメッセージがない

### Step 6: 動作確認

#### 6-1. CloudWatch Logsで確認

```bash
aws logs tail /aws/lambda/prance-db-migration-dev \
  --since 5m \
  --format short \
  | grep -E "(completed|error|ERROR)"
```

#### 6-2. 実際のAPI呼び出しでテスト

```bash
# 影響を受けるAPI（例: sessions-get）を呼び出し
aws lambda invoke \
  --function-name prance-sessions-get-dev \
  --payload '{"pathParameters":{"id":"test-id"}}' \
  /tmp/test-result.json

cat /tmp/test-result.json
```

**確認事項:**
- [ ] 500エラーが発生しない
- [ ] "column does not exist" エラーがない

#### 6-3. データベーススキーマ直接確認

```bash
# Lambda経由でスキーマ確認
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"check-schema.sql"}' \
  /tmp/schema-check.json
```

---

## 📝 事後作業（変更後）

### 1. コミット

```bash
git add packages/database/prisma/schema.prisma
git add packages/database/prisma/migrations/
git commit -m "feat: <変更内容の説明>

- Prismaスキーマ変更: <詳細>
- マイグレーション: <マイグレーション名>
- 影響範囲: <Lambda関数名など>

Migration executed: ✅
Tested: ✅"
```

### 2. ドキュメント更新

- [ ] `docs/development/DATABASE_DESIGN.md` 更新（必要に応じて）
- [ ] API仕様書更新（新フィールド追加の場合）
- [ ] START_HERE.md の「最新コミット」を更新

### 3. 他の環境への適用計画

- [ ] ステージング環境への適用予定日
- [ ] 本番環境への適用予定日
- [ ] ロールバック手順の確認

---

## ❌ よくある失敗パターン

### パターン1: マイグレーション実行忘れ

**症状:**
```
ERROR: The column `recordings.s3_key` does not exist in the current database.
```

**原因:** Prismaスキーマは変更したが、`prisma migrate deploy` を実行していない

**対策:** このチェックリストの Step 5 を必ず実行

### パターン2: Lambda関数のPrisma Clientが古い

**症状:**
```
Lambda logs: "Unknown field: s3_key"
```

**原因:** Lambda関数が古いPrisma Clientを使用している

**対策:** Step 4 (Lambda関数デプロイ) を必ず実行

### パターン3: ローカルとAWS RDSの同期ずれ

**症状:** ローカルでは動作するが、AWS Lambda経由では500エラー

**原因:** ローカルPostgreSQLとAWS RDSのスキーマが異なる

**対策:** **このプロジェクトはローカルPostgreSQLを使用しません**。全てAWS RDS経由で操作します。

---

## 🚨 緊急時の対応（マイグレーション失敗時）

### 1. 即座の対応

```bash
# 1. Lambda関数で該当フィールドへのアクセスを一時的にコメントアウト
# 2. Lambda関数を緊急デプロイ
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --hotswap

# 3. CloudWatch Logsで確認
aws logs tail /aws/lambda/<function-name> --since 5m
```

### 2. ロールバック

```bash
# マイグレーションのロールバック（Prismaはサポートしていないため手動）
cd packages/database
# 最新マイグレーションのmigration.sqlを確認
cat prisma/migrations/<latest-migration>/migration.sql

# 逆の操作を手動で実行（例: ALTER TABLE DROP COLUMN）
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"rollback.sql"}' \
  /tmp/rollback-result.json
```

### 3. 根本原因分析

- このドキュメントの手順のどこでスキップしたか確認
- CLAUDE.md の「絶対厳守ルール」を再確認
- 再発防止策を追加

---

## 📚 関連ドキュメント

- [CLAUDE.md](../../CLAUDE.md) - 絶対厳守ルール
- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) - データベース設計
- [ENVIRONMENT_ARCHITECTURE.md](./ENVIRONMENT_ARCHITECTURE.md) - 環境アーキテクチャ
- [START_HERE.md](../../START_HERE.md) - セッション開始手順

---

**最終更新:** 2026-03-07
**更新理由:** recordingsテーブルマイグレーション漏れによる500エラー発生を受けて作成
