# 次回セッション開始手順（2026-03-05終了時点）

**最終作業日:** 2026-03-05 4:30 PM
**Phase 1進捗:** 約50%完了
**最新コミット:** f63825c

---

## 🚀 次回セッション開始時の第一声

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

---

## ✅ 現在の環境状態（起動中）

### 1. PostgreSQL（Docker）
```bash
コンテナ名: prance-postgres
ステータス: Up 27 hours
ポート: 5432
```

### 2. Next.js開発サーバー
```bash
URL: http://localhost:3000
ステータス: 起動中（PID: 31654）
ポート: 3000
```

### 3. テストデータ
```
✅ 組織: 1件（Test Organization）
✅ ユーザー: 1件（test@example.com）
✅ アバター: 2件（Emma, Yuki）
✅ シナリオ: 2件（Technical Interview, Customer Support）
```

---

## 📋 次回作業内容（優先順位順）

### 1. 環境確認（5分）
```bash
# PostgreSQL確認
docker ps | grep prance-postgres

# 開発サーバー確認
curl http://localhost:3000/api/health

# AWS認証確認
aws sts get-caller-identity
```

### 2. セッション作成フローの動作確認（10分）
```bash
# ブラウザで確認
http://localhost:3000/dashboard/sessions/new

# 期待される動作:
# - Step 1: シナリオ2件表示
# - Step 2: アバター2件表示
# - Step 3: セッション作成成功
```

### 3. UPDATE/DELETE API実装（1-2時間）
**未デプロイのLambda関数:**
- `infrastructure/lambda/scenarios/update/index.ts` ← 実装済み、未デプロイ
- `infrastructure/lambda/scenarios/delete/index.ts` ← 実装済み、未デプロイ
- `infrastructure/lambda/avatars/update/index.ts` ← 実装済み、未デプロイ
- `infrastructure/lambda/avatars/delete/index.ts` ← 実装済み、未デプロイ

**デプロイ手順:**
```bash
cd /workspaces/prance-communication-platform/infrastructure
npm run deploy
```

### 4. 削除UI実装（30-45分）
- シナリオ詳細ページに削除ボタン追加
- アバター詳細ページに削除ボタン追加
- ConfirmDialogコンポーネント統合

### 5. Clone Button UI実装（1時間）
- アバター詳細ページにCloneボタン追加
- allowCloning=trueのアバターのみ表示
- Clone API呼び出し

---

## 📝 重要なファイル

### ドキュメント
- `/workspaces/prance-communication-platform/NEXT_SESSION.md` - 詳細な作業ガイド
- `/workspaces/prance-communication-platform/SESSION_PROGRESS.md` - 進捗記録
- `/home/vscode/.claude/projects/-workspaces/memory/MEMORY.md` - 開発メモリ

### テストデータ
- `/workspaces/prance-communication-platform/apps/web/scripts/seed-test-data.ts`

### 未デプロイLambda関数
- `infrastructure/lambda/scenarios/update/index.ts`
- `infrastructure/lambda/scenarios/delete/index.ts`
- `infrastructure/lambda/avatars/update/index.ts`
- `infrastructure/lambda/avatars/delete/index.ts`
- `infrastructure/lambda/avatars/clone/index.ts`

---

## 🔗 主要URL

| サービス | URL/情報 |
|---------|---------|
| **開発サーバー** | http://localhost:3000 |
| **API Base URL** | https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/ |
| **AWS Console** | us-east-1リージョン |
| **GitHub** | https://github.com/PranceHoldings/communication-platform |

---

## 🎯 Phase 1 完了までの残タスク

| タスク | 推定時間 | 優先度 |
|--------|---------|-------|
| UPDATE/DELETE APIデプロイ | 1-2時間 | 🟡 中 |
| 削除UI実装 | 30-45分 | 🟢 低 |
| Clone Button UI実装 | 1時間 | 🟢 低 |
| セッションプレイヤー実装 | 1-2週間 | 🔵 将来 |

**Phase 1完了予定:** UPDATE/DELETE API実装完了後、約60%達成

---

## 💡 トラブルシューティング

### 開発サーバーが起動しない
```bash
# プロセス確認
ps aux | grep "next dev"

# 強制終了して再起動
pkill -f "next dev"
cd /workspaces/prance-communication-platform/apps/web
npm run dev
```

### PostgreSQLが起動しない
```bash
docker start prance-postgres
docker ps | grep prance-postgres
```

### ビルドキャッシュエラー
```bash
cd /workspaces/prance-communication-platform/apps/web
rm -rf .next
npm run dev
```

---

**準備完了！明日のセッションで「前回の続きから始めます」と伝えてください。**
