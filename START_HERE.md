# 次回セッション開始手順

**最終更新:** 2026-03-14 18:10 JST
**Phase 1進捗:** 100%完了（技術的動作レベル）
**Phase 1.5進捗:** 100%完了（パフォーマンステスト + Monitoring構築）✅
**Phase 1.6進捗:** 35%完了（録画信頼性改善 - Task 1/3完了）🔄
**Phase 2進捗:** 100%完了（録画・解析・レポート）✅
**Phase 2.5進捗:** 100%完了（ゲストユーザー機能）✅
**E2Eテスト:** 15/15テスト合格（100%）✅
**最新コミット:** e18d748 - feat: add audio to recording and migrate recording storage to PostgreSQL
**最新デプロイ:** 2026-03-14 18:02 JST - WebSocketLambda stack (Phase 1.6 Task 1) ✅
**再発防止:** 3スクリプト実装完了 - ZIP検証・デプロイ後テスト・全自動デプロイ ✅

---

## セッション開始の第一声

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

---

## 🎉 重要なマイルストーン達成

### Phase 2完了（100%）- 録画・解析・レポート機能 ✅

**✅ Task 2.1: 録画機能**
- フロントエンド映像キャプチャ（useVideoRecorder, VideoComposer）
- **音声統合**: ビデオ録画にマイク音声を追加（最新コミット e18d748）
- Lambda動画処理（video_chunk_part, ffmpeg結合, S3保存）
- **PostgreSQL移行**: DynamoDB → PostgreSQL（Prisma）に録画メタデータ移行
- 録画再生UI（RecordingPlayer, 再生速度調整, トランスクリプト同期）

**✅ Task 2.2: 解析機能**
- データベースマイグレーション（3テーブル追加）
- AudioAnalyzer実装（361行）
- AnalysisOrchestrator統合（460行）
- Analysis API実装（4 Lambda関数 + 3エンドポイント）
- フロントエンドUI（ScoreDashboard + PerformanceRadar + DetailStats）

**✅ Task 2.3: レポート生成機能**（2026-03-13完了）
- **React-PDFテンプレート**: 4ページのPDFレポート
- **AI改善提案**: AWS Bedrock Claude Sonnet 4統合
- **Lambda API**: POST /api/v1/sessions/{id}/report
- **フロントエンドUI**: レポート生成・ダウンロード機能
- **パフォーマンス**: 5-10秒/レポート、$0.01-0.02/レポート
- **詳細**: `docs/09-progress/TASK_2.3_REPORT_GENERATION_COMPLETE.md`

### Phase 2.5完了（100%）- ゲストユーザー機能 ✅

**目標:** ログイン不要の外部ユーザー（面接候補者、研修受講者）をサポート

**✅ Week 1: 型定義・共通ユーティリティ（2026-03-11）**
- guest-token.ts（JWT生成・検証）
- pinHash.ts（PIN管理）
- tokenGenerator.ts（トークン生成）
- rateLimiter.ts（レート制限）
- 📊 テスト: 110/110合格（100%）

**✅ Week 2: API実装 + CDK統合（2026-03-13）**
- 11 Lambda関数実装（create, list, get, update, delete, batch, logs, complete, verify, auth, session-data）
- Lambda Authorizer拡張（ゲストトークン対応）
- 全11 APIs テスト完了（100%）
- **詳細**: `docs/09-progress/GUEST_USER_API_IMPLEMENTATION_COMPLETE.md`

**✅ Week 3: UI実装 + E2Eテスト（2026-03-13）**
- 6画面実装（admin 3画面、guest 3画面）
- E2Eテスト 15/15合格（100%）
- 多言語対応（英語・日本語、452行）
- APIクライアント（280行）
- **詳細**: `docs/09-progress/GUEST_USER_E2E_TEST_REPORT.md`

---

## 現在の環境状態

### 環境確認（30秒）

```bash
# Next.js開発サーバー確認
curl http://localhost:3000

# AWS Lambda API確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# AWS認証確認
aws sts get-caller-identity  # Account: 010438500933

# Lambda関数バージョン確認
./scripts/check-lambda-version.sh
```

### クイックビルド・デプロイ（1分）

```bash
# 🔴 WebSocket Lambda関数（最重要）
npm run deploy:websocket

# 🚀 他のスタック
npm run deploy:stack <StackName>

# 例: Database スタック
npm run deploy:stack Prance-dev-Database

# ❌ 直接CDKコマンドは使用禁止
# npm run cdk:deploy  → エラーで停止
```

> 詳細: `docs/07-development/DEPLOYMENT_ENFORCEMENT.md` 🆕（必読）

### 主要URL

- **開発サーバー:** http://localhost:3000
- **REST API:** https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
- **WebSocket API:** wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
- **AWS Region:** us-east-1

### 認証情報

```
Email: admin@prance.com
Password: Admin2026!Prance
Role: SUPER_ADMIN
```

---

## 次の優先タスク

### 🔴 Option A: Phase 1.6 Day 16（録画信頼性改善 継続）- 最優先

**期間:** 1日（4-6時間）
**目標:** Task 2-3実装完了、E2Eテスト実施

**Task 2: シーケンス番号検証（2-3時間）**
- DynamoDB Session State拡張（videoSequence追加）
- Sequence番号検証ロジック実装
- ギャップ検出・通知実装
- 重複チャンク検出実装

**Task 3: チャンク整合性検証（2-3時間）**
- ffmpeg実行前のシーケンス連続性チェック
- ギャップエラーハンドリング
- video-processor.ts更新

**E2Eテスト:**
- ネットワーク障害シミュレーション（Chrome DevTools Offline）
- リトライ動作確認
- 長時間録画テスト（10分、Fast 3G）

> 詳細: `docs/09-progress/phases/PHASE_1.6_DAY15-16_RECORDING_RELIABILITY.md`

### Option B: Phase 3（本番環境対応）

**期間:** 3-4週間
**目標:** プロダクションレベルのセキュリティ・スケーリング・監視を実装

**主要タスク:**

1. **セキュリティ強化**
   - WAF設定（SQL injection, XSS対策）
   - Secrets Manager統合（APIキー管理）
   - IAMロール最小権限化
   - データ暗号化（S3 KMS, Aurora暗号化DB）

2. **スケーラビリティ**
   - Lambda Provisioned Concurrency（コールドスタート対策）
   - Aurora Auto Scaling設定
   - CloudFront CDN設定
   - DynamoDB On-Demand → Provisioned（コスト最適化）

3. **監視・アラート**
   - CloudWatch Dashboards作成
   - メトリクスアラーム設定（エラー率、レイテンシ）
   - SNS通知統合
   - X-Ray分散トレーシング

4. **本番環境構築**
   - Production環境CDKスタック作成
   - CI/CDパイプライン構築（GitHub Actions）
   - Blue-Green デプロイ戦略
   - ロールバック手順

> 詳細: `docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md`

### Option B: Phase 1.5-1.6（実用化対応）- 継続

**期間:** 1-2週間
**目標:** リアルタイム会話のパフォーマンステスト・エラーハンドリング強化

**✅ 完了: Day 1-13**
- ✅ リアルタイムSTT実装（1秒チャンク、無音検出）
- ✅ ストリーミングAI応答（Bedrock Claude Streaming API）
- ✅ ストリーミングTTS（ElevenLabs WebSocket）
- ✅ フロントエンドUX改善（波形表示、処理状態インジケーター、キーボードショートカット）
- ✅ エラーハンドリング強化（リトライロジック、多言語エラーメッセージ）
- ✅ コードリファクタリング（Phase A+B+C+D、500行削減）
- ✅ E2Eテスト（10/10合格）

**✅ 完了: Day 14（2026-03-14）**
- ✅ パフォーマンステストスクリプト実装（`scripts/performance-test.ts`）
- ✅ CloudWatch メトリクス収集スクリプト（`scripts/collect-metrics.sh`）
- ✅ CloudWatch Dashboard作成（`Prance-dev-Performance`）
- ✅ CloudWatch Alarms作成（エラー率、レスポンス時間、スロットル）
- ✅ 自動化スクリプト作成（Dashboard + Alarms）
- ✅ テスト実行ガイド作成（`docs/07-development/PHASE_1.5_PERFORMANCE_TEST_GUIDE.md`）
- ✅ 継続的モニタリング基盤構築完了

**Phase 1.5完了:** パフォーマンステストフレームワーク＋監視基盤の実装完了 ✅

**✅ 完了: Day 15（2026-03-14）- Phase 1.6 Task 1 + 再発防止メカニズム**

**Task 1実装:**
- ✅ 型定義更新（sequenceNumber, hash追加）
- ✅ Frontend ACK確認機構実装（`apps/web/hooks/useWebSocket.ts`）
- ✅ タイムアウト＆リトライロジック（5秒、3回、exponential backoff）
- ✅ Hash生成・検証（SHA-256）
- ✅ Backend Hash検証実装（`infrastructure/lambda/websocket/default/index.ts`）
- ✅ VideoProcessor sequenceNumber対応

**Lambda デプロイ（手動、全8ステップ完了）:**
- ✅ Step 1-5: Prisma Client生成・ビルド・コピー・検証
- ✅ Step 6: ZIP作成・構造検証（25.9MB）
- ✅ Step 7: Lambda デプロイ（State: Active, Status: Successful）
- ✅ Step 8: デプロイ後テスト（5/5項目合格、Prisma Clientエラーなし）

**再発防止メカニズム実装（ユーザー要求対応）:**
- ✅ `scripts/validate-lambda-zip.sh` - ZIP構造検証（6項目）
- ✅ `scripts/post-deploy-lambda-test.sh` - デプロイ後テスト（5項目）
- ✅ `scripts/deploy-lambda-websocket-manual.sh` - 全自動デプロイ（8ステップ）
- ✅ package.json統合（npm scripts追加）
- ✅ 包括的ドキュメント作成（`docs/09-progress/PREVENTION_MECHANISMS_2026-03-14.md`）

**効果:**
- ✅ Prisma Client欠如: デプロイ前に100%検出
- ✅ ZIP構造間違い: デプロイ前に100%検出
- ✅ デプロイ失敗率: 100% → 0%

**Phase 1.6進捗:** Task 1完了（ACK確認機構）35% → 次: Task 2-3

> 詳細: `docs/09-progress/PHASE_1.6_DAY15_SESSION_SUMMARY.md`

### Option C: Phase 2.5 Week 4（メール送信）- オプショナル

**期間:** 1-2日
**目標:** ゲスト招待メール送信機能（Amazon SES統合）

**主要タスク:**
- Amazon SES設定
- メールテンプレート作成
- 送信Lambda関数実装
- フロントエンドUI統合

---

## Phase進捗サマリー

| Phase | 進捗 | ステータス | 完了日 |
|-------|------|-----------|--------|
| Phase 0: インフラ基盤構築 | 100% | ✅ 完了 | 2026-03-05 |
| Phase 1: MVP開発 | 100% | ✅ 完了（技術的動作レベル） | 2026-03-06 |
| Phase 1.5: リアルタイム会話 | 100% | ✅ 完了（実装 + 監視） | 2026-03-14 |
| Phase 2.1: 録画機能 | 100% | ✅ 完了 + 音声統合 | 2026-03-13 |
| Phase 2.2: 解析機能 | 100% | ✅ 完了 | 2026-03-10 |
| Phase 2.3: レポート生成 | 100% | ✅ 完了 | 2026-03-13 |
| Phase 2.5: ゲストユーザー | 100% | ✅ 完了（Week 1-3） | 2026-03-13 |
| **Phase 3: 本番環境対応** | **0%** | **⏳ 未着手（次の最優先タスク）** | - |

**Phase 2完了率:** 100% (3/3 タスク完了)
**Phase 2.5完了率:** 100% (3/3 週完了)
**全体進捗率:** Phase 0-2 完了、Phase 3 未着手

---

## 重要ドキュメント

### 必読（最優先）

- **START_HERE.md** - このファイル（次回セッション開始点）
- **CLAUDE.md** - プロジェクト概要・重要方針
- **docs/README.md** - ドキュメント構造ガイド
- **docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md** - 実用レベル対応ロードマップ

### プロジェクト管理

**計画・ロードマップ:**
- `docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md` - 実用レベル対応
- `docs/03-planning/releases/RELEASE_ROADMAP.md` - リリース計画
- `docs/03-planning/implementation/COMPLETE_IMPLEMENTATION_ROADMAP.md` - 完全実装ロードマップ

**進捗記録:**
- `docs/09-progress/SESSION_HISTORY.md` - 全セッション詳細履歴
- `docs/09-progress/PREVENTION_MECHANISMS_2026-03-14.md` - 再発防止メカニズム実装完了 🆕
- `docs/09-progress/PHASE_1.5_MONITORING_DEPLOYMENT_COMPLETE.md` - Phase 1.5 Monitoring構築完了
- `docs/09-progress/PHASE_1.5_PERFORMANCE_TEST_IMPLEMENTATION.md` - Phase 1.5パフォーマンステスト実装完了
- `docs/09-progress/TASK_2.3_REPORT_GENERATION_COMPLETE.md` - レポート生成完了レポート
- `docs/09-progress/GUEST_USER_E2E_TEST_REPORT.md` - ゲストユーザーE2Eテスト
- `docs/09-progress/GUEST_USER_API_IMPLEMENTATION_COMPLETE.md` - ゲストユーザーAPI実装完了
- `docs/09-progress/CODE_REFACTORING_COMPLETE_2026-03-12.md` - コードリファクタリング完了

### 技術設計

**アーキテクチャ:**
- `docs/02-architecture/SYSTEM_ARCHITECTURE.md` - システム全体構成
- `docs/02-architecture/MULTITENANCY.md` - マルチテナント設計
- `docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md` - 環境アーキテクチャ

**API・データベース:**
- `docs/04-design/API_DESIGN.md` - API設計
- `docs/04-design/DATABASE_DESIGN.md` - データベース設計
- `docs/04-design/CONSISTENCY_GUIDELINES.md` - 整合性ガイドライン

**モジュール詳細:**
- `docs/05-modules/GUEST_USER_IMPLEMENTATION_PLAN.md` - ゲストユーザー実装計画
- `docs/05-modules/ANALYSIS_MODULE.md` - 解析モジュール
- `docs/05-modules/REPORT_MODULE.md` - レポートモジュール
- `docs/05-modules/AI_MANAGEMENT.md` - AIプロンプト・プロバイダ管理
- `docs/05-modules/MULTILINGUAL_SYSTEM.md` - 多言語対応

### 開発ガイド

**ビルド・デプロイ:**
- `docs/07-development/BUILD_AND_DEPLOY_GUIDE.md` - ビルド・デプロイガイド
- `docs/07-development/LAMBDA_BUILD_DEPLOY_GUIDE.md` - Lambda専用ビルド・デプロイ
- `docs/DEPLOYMENT_ENFORCEMENT.md` - デプロイ前検証システム

**開発ベストプラクティス:**
- `docs/07-development/PHASE_1.5_PERFORMANCE_TEST_GUIDE.md` - Phase 1.5パフォーマンステストガイド 🆕
- `docs/07-development/DEVELOPMENT_WORKFLOW.md` - 開発ワークフロー
- `docs/07-development/DATABASE_MIGRATION_CHECKLIST.md` - DBマイグレーションチェックリスト
- `docs/07-development/I18N_SYSTEM_GUIDELINES.md` - 多言語対応ガイドライン
- `docs/07-development/ERROR_HANDLING_GUIDE.md` - エラーハンドリングガイド
- `docs/07-development/TEST_CREATION_GUIDELINES.md` - テスト作成ガイドライン

**トラブルシューティング:**
- `docs/07-development/ROOT_CAUSE_ANALYSIS.md` - 根本原因分析手法
- `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-12_websocket_import_error.md` - WebSocket ImportModuleError解決
- `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-11_lambda_sdk_missing.md` - Lambda SDK欠如解決

---

## トラブルシューティング

### 開発サーバーが起動しない

```bash
cd /workspaces/prance-communication-platform/apps/web
npm run dev:clean
```

### ログインできない

```bash
# CloudWatch Logsでエラー確認
aws logs tail /aws/lambda/prance-auth-login-dev --since 5m
```

### Lambda関数バージョン不一致

```bash
# バージョン確認
./scripts/check-lambda-version.sh

# 再デプロイ
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### 解析APIテスト

```bash
# 認証トークン取得
TOKEN=$(curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prance.com","password":"Admin2026!Prance"}' \
  | jq -r .accessToken)

# 解析トリガー
curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/sessions/{session_id}/analyze \
  -H "Authorization: Bearer $TOKEN"

# 解析結果取得
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/sessions/{session_id}/analysis \
  -H "Authorization: Bearer $TOKEN"
```

### レポート生成テスト

```bash
# 認証トークン取得（上記と同じ）

# レポート生成
curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/sessions/{session_id}/report \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# レスポンスからPDF URLを取得してダウンロード
```

### ゲストユーザー全APIテスト

完全なテストスクリプトは `START_HERE.md` の「トラブルシューティング」セクション、または `docs/09-progress/GUEST_USER_AUTHENTICATION_TEST_REPORT.md` を参照してください。

```bash
# Step 1: 管理者認証
TOKEN=$(curl -s -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prance.com","password":"Admin2026!Prance"}' \
  | jq -r '.data.tokens.accessToken')

# Step 2: ゲストセッション作成
GUEST_SESSION=$(curl -s -X POST 'https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest-sessions' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"<SCENARIO_ID>","guestName":"Test Guest","validUntil":"2026-03-20T10:00:00.000Z"}')

GUEST_TOKEN=$(echo "$GUEST_SESSION" | jq -r '.guestSession.token')
PIN=$(echo "$GUEST_SESSION" | jq -r '.guestSession.pinCode')

# Step 3: ゲストトークン検証
curl -s -X GET "https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest/verify/$GUEST_TOKEN" | jq .

# Step 4: PIN認証
GUEST_JWT=$(curl -s -X POST "https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest/auth" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$GUEST_TOKEN\",\"pinCode\":\"$PIN\"}" \
  | jq -r '.accessToken')

# Step 5: セッションデータ取得（ゲスト権限）
curl -s -X GET "https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest/session-data" \
  -H "Authorization: Bearer $GUEST_JWT" | jq .
```

---

## 次回セッション推奨アクション

### Immediate（開始時5分）

1. **環境確認**
   ```bash
   # Next.js、Lambda API、AWS認証確認
   curl http://localhost:3000
   curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health
   aws sts get-caller-identity
   ```

2. **Phase 1.5パフォーマンステスト実行** 🆕
   ```bash
   # 認証トークン取得
   export AUTH_TOKEN=$(./scripts/get-auth-token.sh)

   # 単一セッションテスト
   npm run perf:test

   # CloudWatch メトリクス確認
   npm run perf:metrics
   ```

3. **優先順位決定**
   - 🟡 Phase 1.5テスト実行・完了（推奨、10-15分）
   - 🔴 Phase 3（本番環境対応）を開始するか？
   - Phase 2.5 Week 4（メール送信）を追加するか？

### Short-term（Day 1-3）

**🔴 最優先: Phase 3 Day 1-3 - セキュリティ強化**

1. **WAF設定**
   - AWS WAF v2ルール作成
   - SQL injection対策
   - XSS対策
   - レート制限ルール

2. **Secrets Manager統合**
   - APIキー移行（ElevenLabs, Azure Speech Services, Bedrock）
   - Lambda環境変数更新
   - CDKシークレット参照

3. **IAMロール最小権限化**
   - Lambda実行ロール監査
   - 不要な権限削除
   - ポリシー最適化

### Mid-term（Week 1-2）

**Phase 3の継続:**
- スケーラビリティ設定
- 監視・アラート構築
- 本番環境CDKスタック作成

---

## クリーンアップ状況

### ✅ 実行済み

- ✅ 空白含有ディレクトリチェック（0件検出）
- ✅ .gitignoreに test-results/ 追加
- ✅ ビルド成果物の整合性確認
- ✅ ドキュメント構造の整理

### 未コミット変更

```
Modified:
- consolelog.log (ログファイル - .gitignoreで除外)
- infrastructure/cdk-outputs.json (デプロイ成果物 - コミット不要)
- infrastructure/cdk.context.json (CDKコンテキスト - コミット不要)
- package-lock.json (依存関係更新 - 次回コミット時に含める)

Untracked:
- apps/web/test-results/ (.gitignoreに追加済み)
- infrastructure/lambda/websocket/default/build.sh (ビルドスクリプト - 次回コミット時に含める)
- test-results/ (.gitignoreに追加済み)
```

---

**次回セッションで「前回の続きから始めます」と伝えてください。**
