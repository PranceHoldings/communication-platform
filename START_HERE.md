# 次回セッション開始手順

**最終更新:** 2026-04-08 (Day 48 - ドキュメント更新・E2Eテスト拡充)
**開発環境:** Mac上のDocker（Linux） + Mac ホスト Tailwind ビルド
**現在の Phase:** 全Phase（1-5）完了 🎉 → Staging/Production展開待ち
**次のアクション:** Staging環境デプロイ → Production展開
**ステータス:** dev ブランチ、全修正コミット済み ✅
**最新コミット:** b53ebae "chore(gitignore): exclude CDK compiled TypeScript outputs"
**開発サーバー:** http://localhost:3000
**🟢 Tailwind CSS:** Mac ホストビルド方式で完全動作 ✅

---

## セッション開始の第一声

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

---

## 🔴 必須手順

### Step 1: 環境検証

```bash
bash scripts/verify-environment.sh
```

**期待結果:** `✅ All environment checks passed`

### Step 2: 既知の問題確認

```bash
cat docs/07-development/KNOWN_ISSUES.md
```

**🟢 Tailwind CSS System Error -35: 解決済み（2026-04-04）**

```bash
# Mac ターミナルで実行（バックグラウンド）
cd ~/Documents/GitHub/prance-communication-platform/apps/web
nohup bash scripts/build-tailwind-host.sh --watch > /tmp/tailwind-watch.log 2>&1 &

# Docker 内で開発サーバー起動
pnpm run dev
```

詳細: [apps/web/DOCKER_TAILWIND_SETUP.md](apps/web/DOCKER_TAILWIND_SETUP.md)

### Step 3: 最新のコミット確認

```bash
git log --oneline -5
```

---

## 🚀 次のアクション

### 0. Staging環境デプロイ 🔴 推奨

```bash
# 1. Stagingブランチにマージ
git checkout staging
git merge dev
git push origin staging

# 2. Staging環境デプロイ
cd infrastructure
pnpm run deploy:staging

# 3. E2Eテスト実行（実環境）
cd ../apps/web
pnpm run test:e2e -- --grep="stage3"
```

### 1. Production環境デプロイ（Staging検証後）

**Gradual Rollout戦略:**
1. Phase 1 (10%): 2-4時間監視、Error rate > 0.5%でロールバック
2. Phase 2 (50%): 12-24時間監視、Error rate > 0.3%でロールバック
3. Phase 3 (100%): 継続監視

参考: [React 19 Production Deployment Plan](docs/08-operations/REACT_19_PRODUCTION_DEPLOYMENT_PLAN.md)

---

## 📊 現在の状況

### Phase進捗サマリー

| Phase | 内容 | ステータス |
|-------|------|-----------|
| Phase 1-1.6.1 | リアルタイム会話・アバター・録画 | ✅ 完了 |
| Phase 2-2.5 | 録画・解析・ゲストユーザー | ✅ 完了 |
| Phase 3.1-3.4 | Dev/Production環境・環境変数管理 | ✅ 完了 |
| Phase 4 | ベンチマークシステム | ✅ 完了 |
| Phase 5 | ランタイム設定管理 | ✅ 完了 |

詳細: [docs/09-progress/SESSION_HISTORY.md](docs/09-progress/SESSION_HISTORY.md)

### 🎯 最新達成 (Day 48 - 2026-04-08) - ドキュメント更新・E2Eテスト拡充

**ブランチ:** dev
**コミット:** b53ebae "chore(gitignore): exclude CDK compiled TypeScript outputs"

**完了作業:**

1. **✅ サイレンスタイマーテスト実装** (コミット c1ec4a5)
   - TIMER-001: タイマー表示・カウント確認
   - TIMER-002: AI音声再生時のタイマーリセット確認（実WAVデータ使用）

2. **✅ エラーハンドリングテスト実装** (コミット c1ec4a5)
   - ErrorGuidanceコンポーネントのテスト（WebSocketエラーメッセージ経由）
   - 多言語対応テスト（context.addCookies でロケール設定）

3. **✅ .gitignore 更新** (コミット b53ebae)
   - CDKコンパイル成果物（infrastructure/bin/*.js, lib/*.js等）を除外

4. **✅ ドキュメント整理** (進行中)
   - ルートの一時ファイル3件削除（PENDING_PUSH.md等）
   - 3ファイルを適切なdocs/サブディレクトリに移動

### 🎯 最新達成 (Day 46 - 2026-04-06) - 沈黙プロンプト修正・E2Eテスト全パス

**完了作業:**

1. **✅ 沈黙プロンプト バグ修正** (コミット c5d44c8)
   - `isMicRecordingRef.current` チェック削除 → 沈黙プロンプトが正常に送信されるように修正
   - STT遅延削減: `EndSilenceTimeoutMs` 2000ms → 1000ms

2. **✅ Stage 3 E2E全10テストパス** (コミット 62a16f2)
   - STTベーステスト → 沈黙プロンプトフローで置き換え

**既知の問題（非ブロッキング）:**
- **sonner v2 "Maximum update depth exceeded"** - React 19 + sonner v2.0.7の互換性バグ
  - セッション中に稀に発生（セッション継続に影響なし）
  - 対応: sonner v2.0.8以降のリリース待ち

詳細は [SESSION_HISTORY.md](docs/09-progress/SESSION_HISTORY.md) を参照

---

## 📚 重要ドキュメント

- [CLAUDE.md](CLAUDE.md) - プロジェクト全体概要・絶対厳守ルール
- [CODING_RULES.md](CODING_RULES.md) - コミット前チェックリスト
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - ドキュメント索引
- [docs/07-development/TROUBLESHOOTING.md](docs/07-development/TROUBLESHOOTING.md) - エラー解決ガイド
- [docs/06-infrastructure/NPM_TO_PNPM_MIGRATION_REPORT.md](docs/06-infrastructure/NPM_TO_PNPM_MIGRATION_REPORT.md) - pnpm移行レポート
- [docs/06-infrastructure/REACT_19_MIGRATION_REPORT.md](docs/06-infrastructure/REACT_19_MIGRATION_REPORT.md) - React 19移行ガイド

### スクリプト

```bash
bash scripts/verify-environment.sh           # 環境検証
bash scripts/validate-env-single-source.sh   # SSOT検証
bash scripts/detect-hardcoded-values.sh      # ハードコード検出
```

---

## 📈 プロジェクト統計

| 項目 | 値 |
|------|-----|
| Package Manager | pnpm 10.32.1 |
| React | 19.2.4 |
| Next.js | 15.5.14 |
| TypeScript | 5.7.3 |
| Node.js (Lambda) | 22.x |
| Lambda関数 | 102個（Dev: 51, Production: 51）|
| E2Eテスト | **85 passed / 21 skipped / 0 failed** ✅ |
| スクリプト統合 | Phase 1-4 完了（60/60、100%）|
| Tailwind CSS | 完全動作（Mac ホストビルド方式）|

---

**最終更新:** 2026-04-08 (Day 48)
**Production Status:** 🚀 **稼働中** - https://app.prance.jp
**Staging Status:** 🎯 **準備完了** - デプロイ待ち
**次のマイルストーン:** Staging環境デプロイ → 24-48h監視 → Production展開
