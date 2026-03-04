# 🚀 次回セッション クイックスタートガイド

このファイルは次回Claude Code起動時に最初に確認してください。

---

## ⚡ 1分チェックリスト

```bash
# 1. PostgreSQL起動確認（最重要）
docker ps | grep prance-postgres
# → 起動していない場合: docker start prance-postgres

# 2. データベース接続確認
docker exec prance-postgres psql -U postgres -d prance_dev -c "SELECT COUNT(*) FROM users;"
# → 成功すればOK

# 3. AWS認証確認
aws sts get-caller-identity
# → Account: 010438500933 が表示されればOK
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
# データベース操作
npm run db:generate    # Prisma Client再生成
npm run db:migrate     # マイグレーション実行
npm run db:studio      # Prisma Studio起動

# Docker操作
docker start prance-postgres   # PostgreSQL起動
docker stop prance-postgres    # PostgreSQL停止
docker logs prance-postgres    # ログ確認

# プロジェクト操作
npm run dev           # 開発サーバー起動（実装後）
npm run build         # ビルド
npm run test          # テスト実行
```

---

## 🆘 トラブル時の対処

### PostgreSQLが起動しない

```bash
docker start prance-postgres
# それでもダメなら
docker rm -f prance-postgres
docker run -d --name prance-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=prance_dev \
  -p 5432:5432 postgres:15
npm run db:migrate  # テーブル再作成
```

### Prisma Clientエラー

```bash
npm run db:generate
```

---

**準備完了！ 良い開発を！**
