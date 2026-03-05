# 次回セッション開始手順（2026-03-05終了時点）

**最終作業日:** 2026-03-05 5:45 PM
**Phase 1進捗:** 約55%完了
**最新コミット:** 02926a5

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

### 3. Sessions APIバグ修正デプロイ（10-15分） 🔴 **最優先**
**ステータス:** コード修正完了、デプロイ待ち

**問題:** セッション一覧/詳細でavatarがnullの場合に500エラー
**修正内容:**
- `infrastructure/lambda/sessions/list/index.ts` - null check追加
- `infrastructure/lambda/sessions/get/index.ts` - null check追加

**デプロイ手順:**
```bash
cd /workspaces/prance-communication-platform/infrastructure

# ⚠️ 重要: CDK bundling-temp問題の解決
# 前回のデプロイでbundling-tempディレクトリが残っているため、削除が必要
rm -rf cdk.out

# Lambda関数デプロイ
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# 動作確認
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/sessions
```

### 4. UPDATE/DELETE API実装（1-2時間）
**ステータス:** コード実装済み、デプロイ済み ✅

以下のAPI全てデプロイ完了:
- ✅ PUT /api/v1/scenarios/{id} - シナリオ更新
- ✅ DELETE /api/v1/scenarios/{id} - シナリオ削除
- ✅ PUT /api/v1/avatars/{id} - アバター更新
- ✅ DELETE /api/v1/avatars/{id} - アバター削除
- ✅ POST /api/v1/avatars/{id}/clone - アバタークローン

### 5. 管理画面UI拡張（1-1.5時間）
**残タスク:**
- シナリオ詳細ページに削除ボタン追加
- アバター詳細ページに削除ボタン追加
- アバター詳細ページにCloneボタン追加（allowCloning=trueのみ）
- ConfirmDialogコンポーネント統合

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

| タスク | 推定時間 | 優先度 | ステータス |
|--------|---------|-------|----------|
| Sessions APIバグ修正デプロイ | 10-15分 | 🔴 最優先 | コード完了 |
| 管理画面UI拡張 | 1-1.5時間 | 🟡 中 | 未着手 |
| セッションプレイヤー実装 | 1-2週間 | 🔵 将来 | 未着手 |

**Phase 1進捗:** 55%完了
**次のマイルストーン:** Sessions APIデプロイ完了後、60%達成

---

## ✅ 前回セッションで完了した作業（2026-03-05）

### 1. フロントエンドAPIクライアントのリファクタリング
- エラーハンドリング共通化（`unwrapResponse`/`unwrapVoidResponse`）
- クエリ文字列構築共通化（`buildQueryString`）
- 重複コード約110行削除、保守性向上

### 2. Sessions Lambda関数のnull avatarバグ修正
- `infrastructure/lambda/sessions/list/index.ts` - 修正完了
- `infrastructure/lambda/sessions/get/index.ts` - 修正完了
- **デプロイは次回セッションで実施** ← CDK bundling-temp問題により延期

### 3. カスタムドメイン機能の一時無効化
- Phase 1ではデフォルトAPI Gateway URLを使用
- Phase 2で再有効化予定（Task #1作成済み）

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

### CDK bundling-tempエラー
```bash
# エラー: ENOTEMPTY, Directory not empty: bundling-temp-*
# 原因: Dockerコンテナビルドの一時ディレクトリが残っている

cd /workspaces/prance-communication-platform/infrastructure
rm -rf cdk.out
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

---

**準備完了！次回セッションで「前回の続きから始めます」と伝えてください。**
