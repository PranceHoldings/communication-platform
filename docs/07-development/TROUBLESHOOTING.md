# トラブルシューティングガイド

**作成日:** 2026-03-31
**最終更新:** 2026-03-31

---

## 📋 目的

このドキュメントは、開発中に遭遇する一般的なエラーと解決策をまとめたものです。

---

## 🔴 データベースクエリ関連

### エラー: `scripts/db-query.sh: No such file or directory`

**症状:**
```bash
bash scripts/db-query.sh "SELECT * FROM users"
# → bash: scripts/db-query.sh: No such file or directory
```

**原因:**
- 作業ディレクトリが `infrastructure/` やサブディレクトリにいる
- 相対パスが解決できない

**解決策:**

```bash
# Option 1: プロジェクトルートに移動
cd /workspaces/prance-communication-platform
bash scripts/db-query.sh "SELECT * FROM users LIMIT 5"

# Option 2: 絶対パス使用
bash /workspaces/prance-communication-platform/scripts/db-query.sh "SELECT * FROM users"

# Option 3: 現在のディレクトリを確認
pwd  # プロジェクトルートにいることを確認
```

**予防策:**
- スクリプト実行前に必ず `pwd` で現在地を確認
- プロジェクトルートから実行することを習慣化

---

## 🔴 AWS Lambda呼び出し関連

### エラー: `Invalid base64` (AWS Lambda Invoke)

**症状:**
```bash
aws lambda invoke --function-name prance-db-query-dev \
  --payload '{"sql":"SELECT * FROM users"}' \
  result.json

# → aws: [ERROR]: Invalid base64: "{"sql":"SELECT * FROM users"}"
```

**原因:**
- AWS CLI v2ではデフォルトでpayloadがbase64エンコードを期待
- 生のJSON文字列を渡すと、base64として解釈されエラーになる

**解決策:**

```bash
# ✅ 推奨: 専用スクリプト使用
bash scripts/db-query.sh "SELECT * FROM users LIMIT 5"

# ✅ 直接呼び出す場合: 必須フラグを付ける
aws lambda invoke \
  --function-name prance-db-query-dev \
  --payload '{"sql":"SELECT * FROM users","readOnly":true}' \
  --cli-binary-format raw-in-base64-out \
  result.json

# 結果確認
cat result.json | jq '.'
```

**重要:**
- `--cli-binary-format raw-in-base64-out` は**必須**
- このフラグがないと常にbase64エラーになる

**予防策:**
- Lambda呼び出しは可能な限り専用スクリプト（`db-query.sh`, `db-exec.sh`）を使用
- 直接呼び出す場合はテンプレートを用意

**テンプレート:**
```bash
# テンプレート: Lambda呼び出し
aws lambda invoke \
  --function-name <FUNCTION_NAME> \
  --payload '<JSON_PAYLOAD>' \
  --cli-binary-format raw-in-base64-out \
  /tmp/result.json

cat /tmp/result.json | jq '.'
```

---

## 🔴 環境変数関連

### エラー: `DATABASE_URL` が見つからない

**症状:**
```bash
pnpm run dev
# → Error: DATABASE_URL is not defined
```

**原因:**
- `.env.local` ファイルが存在しない
- または環境変数がロードされていない

**解決策:**

```bash
# Step 1: .env.local が存在するか確認
ls -la .env.local

# Step 2: なければ .env.example からコピー
cp .env.example .env.local

# Step 3: 必要な値を設定
vim .env.local

# Step 4: 検証
bash scripts/validate-env.sh

# Step 5: Next.js再起動
pkill -f "next dev"
pnpm run dev
```

**予防策:**
- プロジェクトクローン直後に必ず `.env.local` を作成
- `validate-env.sh` を定期的に実行

---

## 🔴 Prisma関連

### エラー: `@prisma/client` が見つからない

**症状:**
```
Error: Cannot find module '@prisma/client'
```

**原因:**
- Prisma Clientが生成されていない
- node_modulesが壊れている

**解決策:**

```bash
# Step 1: Prisma Client再生成
cd packages/database
pnpm exec prisma generate

# Step 2: node_modules再インストール（必要に応じて）
cd ../..
pnpm install

# Step 3: Lambda依存関係修復（Lambda関数デプロイ時）
cd infrastructure
pnpm run lambda:fix
```

---

## 🔴 Lambda関数デプロイ関連

### エラー: `Runtime.ImportModuleError: Cannot find module 'index'`

**症状:**
```
Lambda実行時に以下のエラー:
Runtime.ImportModuleError: Cannot find module 'index'
```

**原因:**
- TypeScriptファイル（.ts）がトランスパイルされずにzipされた
- 手動zipアップロードを使用した（絶対禁止）

**解決策:**

```bash
# ✅ 正しいデプロイ方法（唯一の方法）
cd infrastructure
pnpm run deploy:lambda

# CDKが自動実行する処理:
# 1. esbuildでトランスパイル (index.ts → index.js)
# 2. 依存関係のbundling
# 3. 最適化されたzipファイル生成
# 4. Lambda関数への自動アップロード
```

**❌ 絶対禁止:**
```bash
# 手動zipアップロード（絶対に実行してはいけない）
cd infrastructure/lambda/websocket/default
zip -r lambda-deployment.zip .
aws lambda update-function-code --function-name xxx --zip-file fileb://lambda-deployment.zip
```

**参照:** [infrastructure/CLAUDE.md - Rule 1](../../infrastructure/CLAUDE.md#rule-1-lambda関数デプロイメント原則)

---

## 🔴 Next.js関連

### エラー: Tailwind CSS Build Error - System Error -35

**症状:**
```
Module build failed (from postcss-loader):
Error: Unknown system error -35: Unknown system error -35, read
```

**原因:**
- CodeSpaces/Docker環境のファイルシステム競合
- 複数のNode.jsプロセスがファイルシステムにアクセス

**解決策:**

```bash
# Option 1: CodeSpaces再起動（最も確実）
# GitHub CodeSpaces UI → "Restart Codespace"

# Option 2: プロセス完全クリーンアップ
pkill -9 node
rm -rf apps/web/.next
cd apps/web && PORT=3000 pnpm exec next dev

# Option 3: 別のポートで起動
cd apps/web && PORT=3001 pnpm exec next dev
```

**参照:** [docs/07-development/KNOWN_ISSUES.md - Issue #6](KNOWN_ISSUES.md#issue-6-tailwind-css-build-error---system-error--35-resource-deadlock)

---

## 🔴 Git関連

### エラー: Pre-push hook failed

**症状:**
```bash
git push origin main
# → Pre-push hook failed: Lambda dependencies validation failed
```

**原因:**
- Lambda関数の依存関係が欠如している
- 環境変数が不正

**解決策:**

```bash
# Step 1: Lambda依存関係を修復
cd infrastructure
pnpm run lambda:fix

# Step 2: 環境変数を検証
bash scripts/validate-env.sh

# Step 3: 再度プッシュ
git push origin main
```

---

## 📚 よく使うコマンド一覧

### データベースクエリ

```bash
# ユーザー一覧取得
bash scripts/db-query.sh "SELECT id, email, name, role FROM users LIMIT 10"

# シナリオ一覧取得
bash scripts/db-query.sh "SELECT id, title, language FROM scenarios LIMIT 10"

# ファイル経由
bash scripts/db-query.sh --file scripts/queries/my-query.sql
```

### Lambda関数デプロイ

```bash
# 全Lambda関数デプロイ
cd infrastructure
pnpm run deploy:lambda

# 特定スタックのみ
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### 検証スクリプト

```bash
# 環境変数検証
bash scripts/validate-env.sh

# Lambda依存関係検証
cd infrastructure && pnpm run lambda:predeploy

# 言語同期検証
pnpm run validate:languages

# 全チェック
pnpm run pre-commit
```

---

## 🔍 デバッグTips

### Lambda関数のログ確認

```bash
# リアルタイムログ監視
aws logs tail /aws/lambda/prance-db-query-dev --follow

# エラーログのみ
aws logs tail /aws/lambda/prance-db-query-dev --filter-pattern "ERROR"

# 過去1時間のログ
aws logs tail /aws/lambda/prance-db-query-dev --since 1h
```

### Lambda関数の環境変数確認

```bash
aws lambda get-function-configuration \
  --function-name prance-db-query-dev \
  --query 'Environment.Variables'
```

### Lambda関数のテスト実行

```bash
# 簡単なテスト
aws lambda invoke \
  --function-name prance-health-check-dev \
  --cli-binary-format raw-in-base64-out \
  /tmp/result.json

cat /tmp/result.json
```

---

## 📚 関連ドキュメント

- [KNOWN_ISSUES.md](KNOWN_ISSUES.md) - 既知の問題リスト
- [SESSION_RESTART_PROTOCOL.md](SESSION_RESTART_PROTOCOL.md) - セッション再開手順
- [scripts/CLAUDE.md](../../scripts/CLAUDE.md) - スクリプト使用ガイド
- [infrastructure/CLAUDE.md](../../infrastructure/CLAUDE.md) - インフラ開発ガイド

---

**最終更新:** 2026-03-31
**次回レビュー:** 新規問題発生時
