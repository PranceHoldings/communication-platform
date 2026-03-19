# 次回セッション開始手順

**最終更新:** 2026-03-19 (Day 26 - ドキュメント整理完了)
**現在の Phase:** Phase 3完了 (100%) - Phase 4移行準備完了
**E2Eテスト:** Stage 1-3: 97.1% (34/35) | Stage 4-5: 調査中
**ステータス:** ✅ ドキュメント整理完了、セッション再開プロセス確立

---

## セッション開始の第一声

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

---

## 🔴 セッション開始時の必須手順

### Step 1: 環境検証（自動）

```bash
bash scripts/verify-environment.sh
```

**検証内容:**
- Git作業ディレクトリ状態
- Node.js/npmバージョン (v22.x / 10.x)
- 環境変数ファイル (`.env.local`) 存在・設定確認
- データベース接続確認
- 開発サーバー状態確認

**期待結果:** `✅ All environment checks passed`

### Step 2: 既知の問題確認

```bash
cat docs/07-development/KNOWN_ISSUES.md
```

**現在の既知の問題:**
- ✅ Issue #1: Playwright/Next.js設定（修正完了）
- 🔄 Issue #2: API Gateway 403エラー（調査中）

### Step 3: タスク実行

**下記の「🎯 次のアクション」セクションの指示に従う**

---

## 📊 現在の状況

### Phase進捗

| Phase | 内容 | 進捗 | ステータス |
|-------|------|------|-----------|
| Phase 1-1.6 | MVP・実用レベル化 | 100% | ✅ 完了 |
| Phase 2-2.5 | 録画・解析・ゲストユーザー | 100% | ✅ 完了 |
| Phase 3.1-3.3 | Dev/Production環境・E2Eテスト | 100% | ✅ 完了 |
| **Phase 4** | **ベンチマークシステム** | 0% | ⏳ 次Phase |

### 最新達成

**✅ Phase 3完了（2026-03-18）:**
- Production環境デプロイ完了
- E2Eテスト実装完了（Stage 1-3: 97.1%成功率）
- Enum統一化完了（17箇所の重複定義削除）

**✅ ドキュメント整理完了（2026-03-19 - Day 26）:**
- 一時ファイルをアーカイブに移動（8ファイル）
- 誤配置ファイルを削除（infrastructure/apps/CLAUDE.md）
- セッション再開プロトコル確立
- 既知の問題リスト作成
- START_HERE.md簡素化（237行 → 148行、37.6%削減）
- CLAUDE.md環境URLセクション追加
- DOCUMENTATION_INDEX.md完成（全体ナビゲーション）

### 最新デプロイ

**Dev環境:**
- Lambda関数: 2026-03-18 18:00 JST
- Frontend: 起動待機

**Production環境:**
- 全スタック: 2026-03-17 22:30 JST
- Frontend: https://app.prance.jp ✅
- REST API: https://api.prance.jp ✅
- WebSocket: wss://ws.app.prance.jp ✅

---

## 🎯 次のアクション

### Option A: E2Eテスト Stage 4-5 実行（推奨・短期 - 1-2時間）
**目的:** API Gateway 403エラー調査、E2Eテスト100%達成
**詳細:** `docs/07-development/KNOWN_ISSUES.md` - Issue #2

### Option B: Phase 4移行（ベンチマークシステム - 2-3日）
**目的:** ベンチマークシステム実装開始
**詳細:** `docs/05-modules/BENCHMARK_SYSTEM.md`

### Option C: ドキュメント詳細整理（1-2時間）
**目的:** CLAUDE.md簡素化、サブディレクトリ統合

**推奨順:** Option A → Option B

---

## 📚 主要ドキュメント

**全ドキュメント索引:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) 参照

**必須:**
- [CLAUDE.md](CLAUDE.md) - プロジェクト概要・開発ガイドライン
- [CODING_RULES.md](CODING_RULES.md) - コミット前チェックリスト
- [docs/07-development/SESSION_RESTART_PROTOCOL.md](docs/07-development/SESSION_RESTART_PROTOCOL.md) - セッション再開手順
- [docs/07-development/KNOWN_ISSUES.md](docs/07-development/KNOWN_ISSUES.md) - 既知の問題

**サブシステム別:**
- [apps/CLAUDE.md](apps/CLAUDE.md) - フロントエンド
- [infrastructure/CLAUDE.md](infrastructure/CLAUDE.md) - インフラ・Lambda
- [scripts/CLAUDE.md](scripts/CLAUDE.md) - スクリプト

**環境URL:** `CLAUDE.md` の「2. 基本アーキテクチャ」参照

---

## 🔴 重要原則（クイックリマインダー）

**セッション再開:** 推測禁止・最小変更・記録必須
**コーディング:** 環境変数はルート`.env.local`のみ・型定義は`@prance/shared`・`useI18n()`のみ使用
**デプロイ:** Lambda=CDK経由のみ・Prisma変更=マイグレーション必須・環境変数検証必須

**詳細:** [CLAUDE.md](CLAUDE.md) - 「4. 開発ガイドライン」、[CODING_RULES.md](CODING_RULES.md)

---

## 💡 トラブルシューティング

**エラー発生時:**
1. `docs/07-development/KNOWN_ISSUES.md` - 既知の問題確認
2. `docs/09-progress/SESSION_HISTORY.md` - 過去の解決例
3. `bash scripts/verify-environment.sh` - 環境検証
4. `aws logs tail /aws/lambda/prance-*-dev --follow` - Lambdaログ

**ドキュメント検索:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - 目的別ナビゲーション

---

**最終更新:** 2026-03-19
**次回レビュー:** Option A完了時、またはPhase 4開始時
