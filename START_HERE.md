# 次回セッション開始手順

**最終更新:** 2026-04-26 (Day 53 - バグ修正5件・デプロイ設定整備)
**現在の Phase:** 全Phase（1-5）完了 🎉 → 商用品質改善中
**次のアクション:** Staging環境デプロイ → Production展開
**ステータス:** dev ブランチ、全修正コミット・プッシュ済み ✅
**最新コミット:** f0dc728 "chore: remove localhost references and clean up dev tooling"
**開発環境:** https://dev.app.prance.jp

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

### Step 3: 最新のコミット確認

```bash
git log --oneline -5
```

---

## 🚀 次のアクション

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

### 3. 未解決の技術的課題（中優先度）

- **WebSocket再接続後の conversationHistory 復元**: 再接続時にDynamoDBの既存 `connectionData` を `sessionId` で検索し、`conversationHistory` / `turnCount` を復元する仕組みが未実装。詳細: [SESSION_2026-04-26_Bug_Investigation_Report.md](docs/09-progress/archives/SESSION_2026-04-26_Bug_Investigation_Report.md)
- **ビデオチャンク数のポーリング確認**: 現状3秒固定待機 → S3実績値と `videoChunksCount` 照合に改善すると確実

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

### 🎯 最新達成 (Day 53 - 2026-04-26) - バグ修正5件・デプロイ設定整備

**ブランチ:** dev
**コミット:** 8717ca4, f0dc728（プッシュ済み）
**Lambda:** `prance-websocket-default-dev` 更新済み
**Next.js BUILD_ID:** `nTT4-Kz15OePJ49fjleF0`

**修正済みバグ:**

1. **✅ セッション録画が空（12KB/2秒）** — `session_end` がS3チャンクアップロード完了前に到着するレースコンディション。`combineChunks()` 前に3秒待機を追加
2. **✅ 文字起こしが1ターンのみ** — `initialGreeting` がWebSocket送信のみでDB未保存だった。`prisma.transcript.create` 追加
3. **✅ "Connection Error" 表示が消えない** — `authenticated` メッセージ受信時に `setError(null)` を追加
4. **✅ シナリオAPI型不整合** — `scenarios/get` が `CachedScenario`（狭い型）を返していた → `dbScenario`（フル形状）に修正
5. **✅ シナリオ編集ページのアクセス制御欠如** — 他組織のシナリオ編集URL直接アクセスを防ぐリダイレクト追加

**デプロイ設定整備（Day 53後半）:**
- localhost参照を全廃（CORS・Cognito OAuth・CDK・スクリプト）
- `start-dev-server.sh` / `stop-dev-server.sh` 削除
- E2EテストをデプロイされたDev環境のみ対象に変更
- `scenarioCacheTable` CDKスタック配線追加

### 🎯 前回達成 (Day 52 - 2026-04-24) - 商用品質音声改善

**コミット:** 538cfc7, 5e44362（Lambda v1.2.0デプロイ済み）

1. **✅ TTSストリーミングリアルタイム再生** — `audio_response` URL待ちなしで即時再生
2. **✅ バージイン** — AI発話中のユーザー割り込みでAI音声を即座に停止
3. **✅ ElevenLabs真のストリーミング** — queue+Promiseパターンで到着順即座yield
4. **✅ AI→TTSセンテンスレベルパイプライン** — 最初の音声レイテンシ〜1-3s削減

---

## 📚 重要ドキュメント

- [CLAUDE.md](CLAUDE.md) - プロジェクト全体概要・絶対厳守ルール
- [CODING_RULES.md](CODING_RULES.md) - コミット前チェックリスト
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - ドキュメント索引
- [docs/09-progress/archives/SESSION_2026-04-26_Bug_Investigation_Report.md](docs/09-progress/archives/SESSION_2026-04-26_Bug_Investigation_Report.md) - Day 53 バグ調査レポート

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

---

**最終更新:** 2026-04-26 (Day 53)
**Production Status:** 🚀 **稼働中** - https://app.prance.jp
**Staging Status:** 🎯 **準備完了** - デプロイ待ち
**次のマイルストーン:** Staging環境デプロイ → 24-48h監視 → Production展開
