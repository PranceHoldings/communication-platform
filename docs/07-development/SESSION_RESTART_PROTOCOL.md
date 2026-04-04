# セッション再開プロトコル

**バージョン:** 1.0
**作成日:** 2026-03-19
**ステータス:** 🔴 必須遵守

---

## 📋 目的

このドキュメントは、開発セッションを再開する際に**必ず**実行すべき手順を定義します。
これにより、過去の設定や成功事例を忘れることなく、スムーズに開発を再開できます。

---

## 🚀 セッション再開の標準手順

### Phase 1: 環境状態の確認（自動化）

**実行コマンド:**
```bash
bash scripts/verify-environment.sh
```

**検証内容:**
1. ✅ Git作業ディレクトリがクリーンか
2. ✅ Node.js/npmバージョン確認
3. ✅ 環境変数ファイル（`.env.local`）の存在確認
4. ✅ 必須環境変数の設定確認
5. ✅ データベース接続確認
6. ✅ 開発サーバーの状態確認

**期待される出力:**
```
✅ All environment checks passed
- Git: Clean working directory
- Node.js: v22.22.1
- npm: 10.9.4
- Environment: .env.local found (22 variables)
- Database: Connected to prance-dev-database
- Dev Server: Not running (will start automatically)
```

### Phase 2: 前回セッションの状態確認

**実行コマンド:**
```bash
bash scripts/show-last-session-state.sh
```

**表示内容:**
1. 最終コミット情報
2. 最終デプロイ時刻
3. 最終テスト実行結果
4. 既知の問題リスト
5. 次回優先タスク

**例:**
```
=== Last Session State ===
Last Commit: 3e140de fix(e2e): improve test robustness
Last Deploy: 2026-03-18 18:00 JST (Dev environment)
Last Test Run: Stage 1-3: 97.1% (34/35 passed)
Known Issues:
  - Stage 4-5 not executed yet
  - API Gateway requires correct .env.local configuration
Next Priority: Execute Stage 4-5 E2E tests
```

### Phase 3: 開発サーバー起動

**自動起動:**
```bash
pnpm run dev:auto
```

**手動起動（デバッグ時）:**
```bash
pnpm run dev
```

**検証:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

### Phase 4: 既知の問題チェック

**確認ファイル:**
- `docs/07-development/KNOWN_ISSUES.md`
- `memory/known-issues.md`

**内容:**
- 現在発生中の問題
- 回避策
- 修正予定

### Phase 5: タスク実行

**START_HERE.md の指示に従ってタスクを実行**

---

## 🔴 重要な原則

### 原則1: 推測禁止

**❌ やってはいけないこと:**
- 環境変数がないと**推測**して、新しいファイルを作成する
- API URLを**推測**して、設定を変更する
- 過去に動いていたものを確認せずに、新しい方法を試す

**✅ 正しいアプローチ:**
1. **確認**: 過去のセッションで何が動いていたか確認
2. **比較**: 現在の環境と過去の環境の差分を特定
3. **修正**: 差分を解消する最小限の変更を実施
4. **検証**: 動作確認

### 原則2: 最小変更の原則

**❌ やってはいけないこと:**
- 「ついでに」他の設定も変更する
- 「こっちの方が良いから」と設計を変更する
- 複数の変更を同時に実施する

**✅ 正しいアプローチ:**
1. 問題を特定
2. 最小限の変更で修正
3. 動作確認
4. 次の問題に移る

### 原則3: 記録の原則

**✅ 必須記録:**
- 環境変数の変更履歴
- API URLの変更履歴
- テスト実行結果
- デプロイ結果

**記録場所:**
- `docs/09-progress/SESSION_HISTORY.md` - 詳細履歴
- `docs/09-progress/archives/SESSION_YYYY-MM-DD_*.md` - 個別セッション記録
- `memory/session-state.md` - Claude Code メモリ

---

## 📝 チェックリスト（セッション開始時）

```bash
# 自動検証スクリプト実行
bash scripts/session-start-checklist.sh
```

**手動チェックリスト:**

- [ ] START_HERE.md を読んだ
- [ ] 環境検証スクリプトを実行した
- [ ] 前回セッション状態を確認した
- [ ] 既知の問題を確認した
- [ ] 開発サーバーが起動している
- [ ] データベースに接続できる
- [ ] 環境変数が正しく読み込まれている

---

## 🔧 トラブルシューティング

### 問題: E2Eテストが失敗する

**手順:**
1. 前回成功したテストの実行記録を確認
   ```bash
   git log --grep="e2e\|test" --oneline -10
   ```

2. その時の環境設定を確認
   ```bash
   git show <commit-hash>:.env.local
   ```

3. 現在の環境と比較
   ```bash
   diff <(git show <commit-hash>:.env.local) .env.local
   ```

4. 差分を解消

### 問題: 開発サーバーが起動しない

**手順:**
1. ポート使用状況確認
   ```bash
   lsof -ti:3000
   ```

2. 既存プロセスを停止
   ```bash
   pkill -f "next dev"
   ```

3. ビルドキャッシュクリア
   ```bash
   rm -rf apps/web/.next
   ```

4. 再起動
   ```bash
   pnpm run dev
   ```

---

## 📚 関連ドキュメント

- [開発ワークフロー](DEVELOPMENT_WORKFLOW.md)
- [環境変数管理](../02-architecture/ENVIRONMENT_ARCHITECTURE.md)
- [既知の問題](KNOWN_ISSUES.md)
- [トラブルシューティング](../01-getting-started/FAQ.md)

---

**最終更新:** 2026-03-19
**次回レビュー:** 次回セッション再開時
