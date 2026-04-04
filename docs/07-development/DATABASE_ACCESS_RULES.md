# Database Access Rules

**作成日:** 2026-03-22
**ステータス:** 🔴 CRITICAL - 全開発者必読

---

## 🔴 最重要原則

### Rule 0: データベースアクセスは必ずLambda経由

**このプロジェクトではAWS RDS Aurora Serverless v2への直接接続は一切禁止されています。**

**理由:**
1. **セキュリティ**: RDSはVPC内に配置、外部からの直接接続は不可
2. **監査**: すべてのクエリがLambda経由でログに記録される
3. **アクセス制御**: IAMロールによる細かい権限管理
4. **環境一貫性**: ローカル/dev/stagingで同じアクセス方法を使用

---

## ✅ 正しいデータベースアクセス方法

### 1. Lambda関数内でPrisma Client使用（推奨）

```typescript
// infrastructure/lambda/scenarios/get/index.ts
import { prisma } from '../../shared/database/prisma';

export const handler = async (event) => {
  try {
    const scenarios = await prisma.scenario.findMany({
      where: { orgId: 'org-123' },
      select: { id: true, title: true },
    });

    return {
      statusCode: 200,
      body: JSON.stringify(scenarios),
    };
  } finally {
    await prisma.$disconnect();
  }
};
```

### 2. db-query.sh スクリプト使用（開発・検証時）

```bash
# 標準的なSELECTクエリ
bash scripts/db-query.sh "SELECT id, title FROM scenarios LIMIT 5"

# 複雑なクエリ
bash scripts/db-query.sh "
SELECT
  s.id,
  s.title,
  u.name as creator_name
FROM scenarios s
JOIN users u ON s.user_id = u.id
WHERE s.org_id = 'xxx'
"

# ファイル経由（大きなクエリ）
bash scripts/db-query.sh --file scripts/queries/verification.sql

# 書き込み操作（--write フラグ必須、確認プロンプト表示）
bash scripts/db-query.sh --write "UPDATE scenarios SET title='New' WHERE id='xxx'"
```

**オプション:**
- `--file FILE` - SQLファイルから読み込み
- `--write` - 書き込み操作を許可（デフォルトはread-only）
- `--max-results N` - 最大結果数（デフォルト: 1000）
- `--env ENV` - 環境指定（dev/staging/production）

### 3. db-exec.sh スクリプト使用（大きなSQLファイル）

```bash
# S3経由でSQLファイルを実行
bash scripts/db-exec.sh scripts/queries/large-migration.sql

# 書き込み操作
bash scripts/db-exec.sh --write scripts/queries/update.sql
```

**処理フロー:**
1. SQLファイルをS3にアップロード
2. Lambda関数にqueryIdを渡して実行
3. 結果取得・表示
4. S3から自動削除（クリーンアップ）

---

## ❌ 禁止されているアクセス方法

### 1. ローカルPostgreSQLへの接続（絶対禁止）

```bash
# ❌ 絶対にやってはいけない
psql postgresql://postgres:password@localhost:5432/prance_dev

# ❌ DATABASE_URLをlocalhostに変更
DATABASE_URL="postgresql://postgres:password@localhost:5432/prance"
```

**理由:**
- このプロジェクトはAWS RDS専用
- ローカルPostgreSQLは一切使用しない
- 環境差異によるバグを防ぐため

### 2. RDSへの直接接続（物理的に不可能）

```bash
# ❌ VPCでブロックされているため接続不可
psql postgresql://pranceadmin:xxx@xxx.rds.amazonaws.com:5432/prance

# ❌ pgAdminなどのGUIツールでの直接接続も不可
```

**理由:**
- RDSはVPC内のプライベートサブネットに配置
- セキュリティグループで外部アクセスをブロック
- Lambda関数のみがアクセス可能

### 3. Prisma Migrateの直接実行（条件付き禁止）

```bash
# ❌ ローカル環境から直接実行（接続できない）
cd packages/database
pnpm exec prisma migrate dev

# ❌ Prisma Studioの起動（接続できない）
pnpm exec prisma studio
```

**正しい方法:**

```bash
# ✅ 統合デプロイスクリプト使用（推奨）
cd infrastructure
pnpm run deploy:dev-migration

# ✅ または手動実行
cd packages/database
pnpm exec prisma migrate dev --name description  # マイグレーションファイル生成のみ
pnpm exec prisma generate                         # Prisma Client再生成

cd ../../infrastructure
pnpm run deploy:lambda                       # Lambda関数デプロイ

aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{}' /tmp/result.json          # マイグレーション実行
```

---

## 🛡️ セキュリティ機能

### 1. Read-Only Mode（デフォルト）

```bash
# デフォルトはread-onlyモード（SELECT, WITH句のみ許可）
bash scripts/db-query.sh "SELECT * FROM scenarios"

# INSERT, UPDATE, DELETE, DROP等は自動的にブロック
bash scripts/db-query.sh "DELETE FROM scenarios"
# → Error: Only SELECT queries are allowed in read-only mode
```

### 2. Write Mode（明示的フラグ必須）

```bash
# --write フラグが必須
bash scripts/db-query.sh --write "UPDATE scenarios SET ..."

# 確認プロンプト表示
# ⚠️  WARNING: Write operations enabled
# Continue? (y/N):
```

### 3. Dangerous Operation Detection

```typescript
// Lambda関数内で危険な操作を検出
const dangerousPatterns = [
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /TRUNCATE\s+TABLE/i,
  /ALTER\s+TABLE.*DROP/i,
];

// マッチした場合は即座にエラー
// Error: Dangerous operation detected: DROP TABLE
```

### 4. Audit Logging

すべてのクエリがCloudWatch Logsに記録されます：

```json
{
  "timestamp": "2026-03-22T10:30:45.123Z",
  "environment": "dev",
  "mode": "direct",
  "executionMode": "execute",
  "queryPreview": "SELECT id, title FROM scenarios LIMIT 5",
  "rowsAffected": 5,
  "executionTime": 234,
  "success": true
}
```

---

## 📁 クエリファイル管理

よく使うクエリは `scripts/queries/` ディレクトリに保存して再利用します。

```
scripts/queries/
├── list-scenarios.sql         # シナリオ一覧取得
├── list-users.sql             # ユーザー一覧取得
├── organization-settings.sql  # 組織設定確認
├── verification.sql           # 検証クエリ
└── [カスタムクエリ]
```

**クエリファイルの作成例:**

```sql
-- scripts/queries/list-scenarios.sql
SELECT
  id,
  title,
  language,
  silence_prompt_timeout,
  enable_silence_prompt
FROM scenarios
WHERE org_id = 'YOUR_ORG_ID'
ORDER BY created_at DESC
LIMIT 20;
```

**実行:**

```bash
bash scripts/db-query.sh --file scripts/queries/list-scenarios.sql
```

---

## 🧪 検証方法

### 環境変数検証

```bash
# DATABASE_URLがAWS RDSを指しているか確認
bash scripts/validate-env.sh

# 期待される出力:
# ✅ .env.local: AWS RDS接続文字列を検出
# ✅ DATABASE_URL: postgresql://pranceadmin:xxx@*.rds.amazonaws.com:5432/prance
```

### Pre-commit Hook

```bash
# コミット前に自動検証
git commit -m "..."

# ローカルPostgreSQLが検出された場合:
# ❌ Error: Local PostgreSQL detected in DATABASE_URL
# Please use AWS RDS connection string
```

---

## 📚 関連ドキュメント

- [scripts/db-query.sh](../../scripts/db-query.sh) - データベースクエリスクリプト
- [scripts/db-exec.sh](../../scripts/db-exec.sh) - データベース実行スクリプト（S3経由）
- [infrastructure/lambda/db-query/index.ts](../../infrastructure/lambda/db-query/index.ts) - クエリLambda関数
- [infrastructure/lambda/db-mutation/index.ts](../../infrastructure/lambda/db-mutation/index.ts) - 変更Lambda関数
- [scripts/CLAUDE.md](../../scripts/CLAUDE.md) - スクリプト使用ガイド

---

## 🔍 トラブルシューティング

### Q: Prisma Migrateがローカルで実行できない

**A:** 正常な動作です。統合デプロイスクリプトを使用してください：

```bash
cd infrastructure
pnpm run deploy:dev-migration
```

### Q: pgAdminやTablePlusで接続したい

**A:** 接続できません。VPCでブロックされています。データベースアクセスは必ずLambda経由で行ってください。

### Q: 大量のデータをインポートしたい

**A:** db-exec.sh（S3経由）を使用してください：

```bash
# 1. SQLファイル作成（INSERT文等）
nano scripts/queries/import-data.sql

# 2. 実行
bash scripts/db-exec.sh --write scripts/queries/import-data.sql
```

### Q: クエリ結果をCSVにエクスポートしたい

**A:** jq コマンドを使用してJSON→CSV変換：

```bash
# クエリ実行
bash scripts/db-query.sh "SELECT * FROM scenarios LIMIT 100" > /tmp/result.json

# JSON→CSV変換
cat /tmp/result.json | jq -r '.data[] | [.id, .title, .language] | @csv' > scenarios.csv
```

---

**最終更新:** 2026-03-22
**次回レビュー:** 新しいデータベースアクセス方法追加時
