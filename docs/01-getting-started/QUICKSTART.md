# 🚀 次回セッション クイックスタートガイド

このファイルは次回Claude Code起動時に最初に確認してください。

---

## ⚡ 1分チェックリスト

```bash
# 1. Next.js開発サーバー確認
curl http://localhost:3000
# → HTML または JSON レスポンスが返ればOK

# 2. AWS Lambda API確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health
# → {"status":"ok"} が返ればOK

# 3. AWS認証確認
aws sts get-caller-identity
# → Account: 010438500933 が表示されればOK

# 4. データベース（AWS Aurora）接続確認
aws lambda list-functions --query "Functions[?contains(FunctionName, 'prance')].FunctionName" | head -5
# → Lambda関数リストが表示されればOK
```

**すべてOKなら開発継続可能！**

---

## 📖 詳細情報の場所

| 情報                     | ファイル                         |
| ------------------------ | -------------------------------- |
| **セッション進捗まとめ** | `SESSION_PROGRESS.md` ← 次に読む |
| プロジェクト企画書       | `CLAUDE.md`                      |
| Alpha開発計画            | `docs/ALPHA_DEVELOPMENT.md`      |

---

## 🎯 次の作業候補

### Option A: 開発環境整備（推奨）

```bash
# TypeScript, ESLint, Prettier設定
# → 開発体験を向上させる
```

### Option B: フロントエンド開始

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app
# → Next.js 15プロジェクト初期化
```

### Option C: インフラ構築開始

```bash
cd infrastructure
npx cdk init app --language typescript
# → AWS CDKプロジェクト初期化（Phase 0）
```

---

## 🔧 基本コマンド集

### よく使うコマンド

```bash
# フロントエンド開発
cd apps/web
npm run dev           # 開発サーバー起動
npm run build         # ビルド
npm run lint          # Lint実行

# データベース操作（Prisma型定義）
cd packages/database
npm run db:generate   # Prisma Client再生成

# バックエンド（Lambda）デプロイ
cd infrastructure
npm run deploy        # 全スタックデプロイ
npm run deploy:dev    # 開発環境のみデプロイ

# AWS Lambda操作
aws lambda list-functions --query "Functions[?contains(FunctionName, 'prance')].FunctionName"
aws logs tail /aws/lambda/prance-auth-login-dev --follow
```

---

## 🆘 トラブル時の対処

### ログインできない

```bash
# 1. Lambda APIの確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# 2. CloudWatch Logsでエラー確認
aws logs tail /aws/lambda/prance-auth-login-dev --since 5m

# 3. ユーザーデータの確認（Lambda経由）
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"check-users.sql"}' \
  /tmp/result.json && cat /tmp/result.json
```

### Lambda デプロイエラー

```bash
cd infrastructure
# cdk.outディレクトリをクリア
mv cdk.out cdk.out.old-$(date +%s)
# 再デプロイ
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### Prisma Clientエラー

```bash
cd packages/database
npm run db:generate
```

---

**準備完了！ 良い開発を！**
