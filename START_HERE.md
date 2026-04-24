# 次回セッション開始手順

**最終更新:** 2026-04-24 (Day 52 - 商用品質音声改善)
**開発環境:** Mac上のDocker（Linux） + Mac ホスト Tailwind ビルド
**現在の Phase:** 全Phase（1-5）完了 🎉 → 商用品質改善中
**次のアクション:** Staging環境デプロイ → Production展開
**ステータス:** dev ブランチ、全修正コミット済み（未プッシュ）
**最新コミット:** 5e44362 "perf(tts): real streaming WebSocket + sentence-level AI→TTS pipeline"
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

### 0. 商用品質音声改善 ✅ 完了 (Day 52)

**コミット:** 538cfc7, 5e44362（dev ブランチ、デプロイ済み）

1. **TTSストリーミングリアルタイム再生**: `useAudioPlayer.playChunk()` をSessionPlayerに接続。
   Lambda から届くMP3チャンクをWeb Audio APIで即座に再生（`audio_response` URLを待たずに再生開始）
2. **バージイン**: AI発話中のユーザー発話を検出してAI音声を即座に停止。
   `onBargeIn` コールバックでWeb Audio APIとHTMLAudioElement両方を停止
3. **ElevenLabs真のストリーミング**: WebSocketチャンクを収集後replay → 到着順即座yield に改善
4. **センテンス単位AI→TTSパイプライン**: AI生成完了を待たずにセンテンス区切りでTTS開始。
   Multi-sentenceレスポンスで最初の音声到着レイテンシ〜1-3s削減

### 1. Staging環境デプロイ 🔴 推奨

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

### 2. Production環境デプロイ（Staging検証後）

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

### 🎯 最新達成 (Day 52 - 2026-04-24) - 商用品質音声改善

**ブランチ:** dev
**コミット:** 538cfc7, 5e44362（Lambda v1.2.0 デプロイ済み）

**完了作業:**

1. **✅ TTSストリーミング再生有効化**
   - `handleTTSAudioChunk` を `useAudioPlayer.playChunk()` に接続
   - Lambda の `audio_chunk` メッセージをWeb Audio APIで即座に再生
   - `audio_response` URL重複再生を防止

2. **✅ バージイン実装**
   - `useAudioRecorder.onBargeIn`: AI発話中の確認済み発話でトリガー
   - `SessionPlayer.handleBargeIn`: Web Audio + HTMLAudioElement両方停止
   - `bargedInRef`: バージイン後の遅延 `audio_response` URL抑制

3. **✅ ElevenLabs TTS 真のストリーミング**
   - WebSocketチャンクをキュー+Promiseパターンで到着順即座yield

4. **✅ AI→TTSセンテンスレベルパイプライン**
   - センテンス区切り(. ! ? 。)でTTSを開始
   - Multi-sentenceで最初の音声まで〜1-3s削減

### 🎯 前回達成 (Day 50 - 2026-04-10) - 音声認識バグ2件修正

**ブランチ:** dev
**コミット:** 72198ea → e7af38a（プッシュ済み）
**Lambda:** v1.1.5 デプロイ済み（prance-websocket-default-v2-dev）

**完了作業:**

1. **✅ Bug 1: AI TTS再生中エコーによる誤restart** (コミット 72198ea)
   - `useAudioRecorder.ts`: `isAiRespondingRef.current === true` 時に `restartRecording()` を抑止
   - 原因: raw AudioContext analyser がスピーカーエコーを800ms発話と誤検知 → 無音MediaRecorder起動 → Azure STT InitialSilenceTimeout

2. **✅ Bug 2: チャンクファイル名とソート関数の不一致** (コミット 72198ea)
   - `getRealtimeChunkKey`: `chunk-000005.webm` → `{timestamp}-{seq}.webm` へ変更
   - sort関数の regex `/(\d+)-(\d+)\.\w+$/` と完全一致、warningも`validateChunkOrder`の誤動作も解消
   - video チャンクと同一フォーマットに統一

3. **✅ その他** (コミット e7af38a)
   - next.config.js: Lambda向け standalone output 設定
   - lambda.js: 静的ファイル配信追加
   - api-lambda-stack.ts: dev.app.prance.jp を CORS 許可オリジンに追加

4. **✅ E2E全35テスト合格** (Stage 0-5 全て ✅)

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
| E2Eテスト | **35+ passed / 0 failed** ✅ (Stage 0-5全合格) |
| スクリプト統合 | Phase 1-4 完了（60/60、100%）|
| Tailwind CSS | 完全動作（Mac ホストビルド方式）|

---

**最終更新:** 2026-04-10 (Day 50)
**Production Status:** 🚀 **稼働中** - https://app.prance.jp
**Staging Status:** 🎯 **準備完了** - デプロイ待ち
**次のマイルストーン:** Staging環境デプロイ → 24-48h監視 → Production展開
