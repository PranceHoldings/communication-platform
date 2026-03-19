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

**✅ ドキュメント整理完了（2026-03-19）:**
- 一時ファイルをアーカイブに移動（8ファイル）
- 誤配置ファイルを削除（infrastructure/apps/CLAUDE.md）
- セッション再開プロトコル確立
- 既知の問題リスト作成

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

### Option A: E2Eテスト Stage 4-5 実行（推奨・短期）

**目的:** API Gateway 403エラーを調査し、Stage 4-5テスト完走

**手順:**
1. Day 21（E2Eテスト97.1%成功時）の環境設定を確認
   ```bash
   git log --grep="e2e" --oneline -10
   git show d436baf:.env.local
   ```

2. Lambda Authorizerのログ確認
   ```bash
   aws logs tail /aws/lambda/prance-api-authorizer-dev --follow
   ```

3. 差分を特定し、修正

4. Stage 4-5テスト実行
   ```bash
   npm run test:e2e -- stage4-recording.spec.ts
   ```

**期待結果:** E2Eテスト 100%達成 🎯

**所要時間:** 1-2時間（調査含む）

**詳細:** `docs/07-development/KNOWN_ISSUES.md` - Issue #2

### Option B: Phase 4移行（ベンチマークシステム）

**理由:**
- Phase 3完了
- E2Eテストは一時保留可能
- Phase 4は独立した機能追加

**開始:** `docs/05-modules/BENCHMARK_SYSTEM.md` 参照

**所要時間:** 2-3日（設計 + 実装 + テスト）

### Option C: ドキュメント詳細整理

**目的:** CLAUDE.mdの簡素化、各サブディレクトリのドキュメント統合

**所要時間:** 1-2時間

**推奨:** Option A（E2Eテスト完走）→ Option B（Phase 4移行）

---

## 🌐 環境URL

### Development環境

- **Frontend (Local):** http://localhost:3000
- **REST API:** https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
- **WebSocket:** wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
- **CDN:** https://d3mx0sug5s3a6x.cloudfront.net

### Production環境

- **Frontend:** https://app.prance.jp
- **REST API:** https://api.app.prance.jp
- **WebSocket:** wss://ws.app.prance.jp
- **CDN:** https://cdn.app.prance.jp

---

## 📚 参照ドキュメント

### プロジェクト全体

- **[CLAUDE.md](CLAUDE.md)** - プロジェクト概要・重要方針（2000行）
- **[CODING_RULES.md](CODING_RULES.md)** - コミット前チェックリスト（888行）
- **[README.md](README.md)** - プロジェクト説明

### セッション再開

- **[docs/07-development/SESSION_RESTART_PROTOCOL.md](docs/07-development/SESSION_RESTART_PROTOCOL.md)** - セッション再開の標準手順
- **[docs/07-development/KNOWN_ISSUES.md](docs/07-development/KNOWN_ISSUES.md)** - 既知の問題と回避策

### サブシステム別ガイド

- **[apps/CLAUDE.md](apps/CLAUDE.md)** - フロントエンド開発ガイド（Next.js 15、多言語対応）
- **[infrastructure/CLAUDE.md](infrastructure/CLAUDE.md)** - インフラ・Lambda開発ガイド（AWS CDK、サーバーレス）
- **[scripts/CLAUDE.md](scripts/CLAUDE.md)** - スクリプト使用ガイド（検証、デプロイ）
- **[docs/CLAUDE.md](docs/CLAUDE.md)** - ドキュメント管理ガイド

### 詳細設計

- **[docs/02-architecture/](docs/02-architecture/)** - アーキテクチャ設計
- **[docs/04-design/](docs/04-design/)** - 技術設計
- **[docs/05-modules/](docs/05-modules/)** - 機能モジュール（17モジュール）
- **[docs/07-development/](docs/07-development/)** - 開発ガイド

### 進捗記録

- **[docs/09-progress/SESSION_HISTORY.md](docs/09-progress/SESSION_HISTORY.md)** - 全セッション履歴
- **[docs/09-progress/archives/](docs/09-progress/archives/)** - 個別セッション記録

---

## 🔴 重要原則（必ず遵守）

### セッション再開時

1. **推測禁止** - 過去に動いていた設定を確認してから変更
2. **最小変更** - 必要最小限の変更のみ実施
3. **記録** - 変更内容を必ず記録

### コーディング時

1. **環境変数は `.env.local`（ルート）で一元管理** - 個別ファイル作成禁止
2. **型定義は `@prance/shared` から import** - 重複定義禁止
3. **Prismaスキーマ準拠** - `orgId`、`userId`等のcamelCase使用
4. **多言語対応** - `useI18n()` のみ使用、next-intl禁止

### デプロイ時

1. **Lambda デプロイは CDK 経由のみ** - 手動zip禁止
2. **Prismaスキーマ変更時はマイグレーション必須** - 統合スクリプト使用
3. **デプロイ後は環境変数検証必須**

**詳細:** [CLAUDE.md](CLAUDE.md) の「4. 開発ガイドライン」参照

---

## 💡 困ったときは

### エラーが発生したら

1. **既知の問題を確認**: `docs/07-development/KNOWN_ISSUES.md`
2. **過去の解決例を検索**: `docs/09-progress/SESSION_HISTORY.md`
3. **Lambda ログ確認**: `aws logs tail /aws/lambda/prance-*-dev --follow`
4. **環境変数検証**: `bash scripts/verify-environment.sh`

### ドキュメントを探す

- **プロジェクト構造**: `CLAUDE.md` の「1. プロジェクト概要」
- **コミット前チェック**: `CODING_RULES.md`
- **セッション再開**: `docs/07-development/SESSION_RESTART_PROTOCOL.md`
- **特定機能**: `docs/05-modules/` 配下の該当モジュール

---

**最終更新:** 2026-03-19
**次回レビュー:** Option A完了時、またはPhase 4開始時
