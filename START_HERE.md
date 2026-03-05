# 次回セッション開始手順（2026-03-05終了時点）

**最終作業日:** 2026-03-05 11:32 PM
**Phase 1進捗:** 約60%完了
**最新コミット:** 02926a5
**最新デプロイ:** Sessions APIバグ修正完了

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

### ~~3. Sessions APIバグ修正デプロイ~~ ✅ **完了（2026-03-05 11:32 PM）**
**ステータス:** デプロイ完了

**修正内容:**
- `infrastructure/lambda/sessions/list/index.ts` - null check追加
- `infrastructure/lambda/sessions/get/index.ts` - null check追加
- デプロイ時間: 74秒
- 更新されたLambda関数: 18関数（UPDATE/DELETE API含む）

### 3. UPDATE/DELETE API実装 ✅ **完了（2026-03-05 11:32 PM）**
**ステータス:** デプロイ完了

以下のAPI全てデプロイ完了:
- ✅ PUT /api/v1/scenarios/{id} - シナリオ更新
- ✅ DELETE /api/v1/scenarios/{id} - シナリオ削除
- ✅ PUT /api/v1/avatars/{id} - アバター更新
- ✅ DELETE /api/v1/avatars/{id} - アバター削除
- ✅ POST /api/v1/avatars/{id}/clone - アバタークローン

### 4. 管理画面UI拡張（1-1.5時間） 🔴 **次回の優先タスク**
**残タスク:**
- シナリオ詳細ページに編集・削除ボタン追加
- アバター詳細ページに編集・削除ボタン追加
- アバター詳細ページにCloneボタン追加（allowCloning=trueのみ）
- ConfirmDialogコンポーネント統合
- 削除・クローン機能の動作確認

---

## 📝 重要なファイル

### ドキュメント
- `docs/progress/SESSION_HISTORY.md` - 詳細な進捗履歴（Phase 0から全て）
- `docs/progress/ARCHIVE_2026-03-05_session-complete.md` - 本日のセッション詳細
- `/home/vscode/.claude/projects/-workspaces/memory/MEMORY.md` - 開発メモリ
- `CLAUDE.md` - プロジェクト設計・アーキテクチャ

### テストデータ
- `apps/web/scripts/seed-test-data.ts` - テストデータ作成スクリプト

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
| ~~Sessions APIバグ修正~~ | 10-15分 | 🔴 最優先 | ✅ 完了 |
| ~~UPDATE/DELETE API実装~~ | 1-2時間 | 🔴 最優先 | ✅ 完了 |
| 管理画面UI拡張 | 1-1.5時間 | 🔴 最優先 | ⏳ 次回作業 |
| セッションプレイヤー実装 | 1-2週間 | 🔵 将来 | 未着手 |

**Phase 1進捗:** 60%完了
**次のマイルストーン:** 管理画面UI拡張完了後、65%達成

---

## ✅ 前回セッションで完了した作業（2026-03-05 11:32 PM）

### 1. ドキュメント構造の統一
- `START_HERE.md` - 唯一のエントリーポイント（簡潔、最新状態）
- `docs/progress/SESSION_HISTORY.md` - 詳細な履歴アーカイブ
- `docs/progress/ARCHIVE_2026-03-05_session-complete.md` - 本日のセッション詳細
- ドキュメント参照先の明確化

### 2. Sessions APIバグ修正デプロイ
- `infrastructure/lambda/sessions/list/index.ts` - null check追加
- `infrastructure/lambda/sessions/get/index.ts` - null check追加
- デプロイ完了（74秒）
- 18関数更新（UPDATE/DELETE API含む）

### 3. UPDATE/DELETE API実装デプロイ
- PUT /api/v1/scenarios/{id} - シナリオ更新
- DELETE /api/v1/scenarios/{id} - シナリオ削除
- PUT /api/v1/avatars/{id} - アバター更新
- DELETE /api/v1/avatars/{id} - アバター削除
- POST /api/v1/avatars/{id}/clone - アバタークローン
- 全API動作確認済み

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
