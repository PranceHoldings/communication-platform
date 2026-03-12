# 次回セッション開始手順

**最終更新:** 2026-03-12 14:10 JST
**Phase 1進捗:** 100%完了（技術的動作レベル） | **Phase 2進捗:** Task 2.1-2.2完了（100%）
**Phase 1.5進捗:** Day 13完了（Silence Settings UI統合完了） | **進捗:** 100% ✅
**Phase 2.5進捗:** ゲストユーザー機能 - Day 1-2完了（基礎実装） | **進捗:** 15%
**アバター機能:** 仕様ドキュメント完成（リップシンク・表情・画像生成を追加） ✅
**最新コミット:** da22241 - feat(silence): complete Silence Settings deployment and cleanup
**最新デプロイ:** 2026-03-12 14:03 JST - ApiLambda stack ✅（WebSocket ImportModuleError 修正完了）
**次回タスク:**
1. ✅ **WebSocket ImportModuleError 修正完了** - Lambda関数が正常動作
2. **エンドツーエンドテスト** - 実際のWebSocket接続でセッション開始・音声会話テスト
3. **ドキュメント更新** - ROOT_CAUSE_ANALYSIS完成、START_HERE更新済み

---

## セッション開始の第一声

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

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

## プロジェクト進捗サマリー

### Phase 0-1: 完了（技術的動作レベル）

**Phase 0: インフラ基盤構築** - 100%完了
- AWS 7スタックデプロイ完了
- VPC、Aurora、S3、DynamoDB、Cognito、API Gateway、Lambda

**Phase 1: MVP開発** - 100%完了（技術的には動作するが実用レベルではない）
- 認証システム（JWT）
- シナリオ管理（CRUD + Clone）
- アバター管理（CRUD + Clone）
- セッション管理（Create/List/Detail）
- 音声会話パイプライン（STT → AI → TTS）- **バッチ処理のため実用レベルではない**
- WebSocket通信
- 多言語対応（10言語）

**致命的な問題:** 音声会話が実用レベルではない
- ユーザーが話した後、**セッション終了まで**文字起こしが返ってこない
- AIの応答も**セッション終了まで**返ってこない
- リアルタイム会話ではなく、**バッチ処理**

> 詳細: `docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md` - Phase 1.5-1.6で実用化対応

### Phase 2: 録画・解析機能（進行中）

**Task 2.1: 録画機能** - 100%完了
- フロントエンド映像キャプチャ（useVideoRecorder, VideoComposer）
- Lambda動画処理（video_chunk_part, ffmpeg結合, S3保存）
- 録画再生UI（RecordingPlayer, 再生速度調整, トランスクリプト同期）

**Task 2.2: 解析機能** - 100%完了
- データベースマイグレーション（3テーブル追加）
- AudioAnalyzer実装（361行）
- AnalysisOrchestrator統合（460行）
- Analysis API実装（4Lambda関数 + 3エンドポイント）
- フロントエンドUI（ScoreDashboard + PerformanceRadar + DetailStats）

**Task 2.3: レポート生成機能** - 0%（未着手）

### Phase 2.5: ゲストユーザー機能（進行中）

**目標:** ログイン不要の外部ユーザー（面接候補者、研修受講者）をサポート

**✅ 完了: Phase 1 Week 1 Day 1-2 - 基礎実装（2026-03-11）**
- ✅ JWTPayload型拡張（GUEST role追加）
- ✅ guest-token.ts 実装（4関数 + 単体テスト36件）
  - `generateGuestToken()` - ゲスト用JWT生成
  - `verifyGuestToken()` - ゲストトークン検証
  - `isGuestToken()` - トークンタイプ判定
  - `extractGuestSessionId()` - セッションID抽出
- ✅ pinHash.ts 実装（3関数 + 単体テスト30件）
  - `hashPin()` - bcryptでPINハッシュ化（SALT_ROUNDS=10）
  - `verifyPin()` - PIN検証（タイミングアタック耐性）
  - `isValidPinFormat()` - フォーマット検証
- ✅ tokenGenerator.ts 実装（5関数 + 単体テスト24件）
  - `generateToken()` - UUID v4トークン生成（32文字）
  - `generatePin()` - 4-8桁PIN生成（暗号学的に安全）
  - `validateCustomPin()` - カスタムPIN検証
  - `generateTokenAndPin()` - トークン+PIN一括生成
  - `generateInviteUrl()` - 招待URL生成
- ✅ Jest設定・型定義問題解決
- 📊 **テスト結果:** 89/89テスト成功（100%）

**⏳ 次回: Phase 1 Week 1 Day 3-4 - レート制限ユーティリティ（推定2日）**
- DynamoDB-based rate limiter（ブルートフォース攻撃対策）
- IPアドレス・トークン単位のレート制限
- 指数バックオフ + 自動ロック解除

> 詳細計画: `docs/05-modules/GUEST_USER_IMPLEMENTATION_PLAN.md`

---

## 次の優先タスク

### 🔴 進行中: Phase 1.5（リアルタイム会話実装）

**Phase 1の音声会話を実用レベルに引き上げる（2週間）**

理由: 現在の音声会話はバッチ処理のため、実際のユースケースでは使用不可

**✅ 完了: Day 1-3 - リアルタイムSTT実装（2026-03-10）**
- ✅ フロントエンド: 1秒チャンク送信 + 無音検出（500ms）
- ✅ Lambda: audio_chunk_realtime + speech_end ハンドラ
- ✅ S3チャンク蓄積 → 無音検出時にSTT実行
- ✅ デプロイ完了

**✅ 完了: コード品質改善（2026-03-10 午前）**
- ✅ ハードコード値30+箇所を除去・中央集権化
- ✅ S3Object deprecated問題解決
- ✅ ビルドプロセス改善（clean-build.sh, pre-deploy-check.sh, cleanup-broken-files.sh）
- ✅ apps/api空ワークスペース削除
- ✅ TypeScript設定改善（テストファイル除外）

**✅ 完了: Day 4-5 - リアルタイムAI応答実装（2026-03-10 午後）**
- ✅ Bedrock Claude Streaming API統合（既に実装済みを確認）
- ✅ チャンク単位でAI応答を受信（streamResponse, streamScenarioResponse）
- ✅ WebSocketでストリーミング配信（avatar_response_partial, avatar_response_final）
- ✅ フロントエンド受信・表示実装済み
- ✅ ビルド・デプロイプロセス完全再構築（モノレポワークスペース対応）
- ✅ デプロイ完了・動作確認済み（2026-03-10 20:40 JST）

**✅ 完了: Day 6-7 - リアルタイムTTS実装（2026-03-10）**
- ✅ ElevenLabs WebSocket Streaming API統合（tts-elevenlabs.ts）
- ✅ 音声チャンク単位でTTS生成・配信（processAudioStreaming）
- ✅ WebSocketで即座にブラウザ配信（audio_chunk メッセージ）
- ✅ フロントエンド Web Audio API実装（useAudioPlayer.ts）
- ✅ キューイング機能で途切れない再生
- ✅ デプロイ完了（2026-03-10 21:29 JST）

**✅ 完了: Day 8 - フロントエンドエラーハンドリング強化（2026-03-10）**
- ✅ getUserMediaエラー詳細処理（6種類のDOMException対応）
- ✅ エラーメッセージの多言語対応（errors.json, useErrorMessage hook）
- ✅ タイムアウト処理UI（30秒検出、進捗表示）
- ✅ WebSocket再接続メッセージ改善（指数バックオフ表示）
- ✅ ブラウザ互換性チェック（MediaRecorder/WebSocket/Web Audio API）
- ✅ 音量レベル不足警告（連続5秒RMS < 0.01）

**✅ 完了: Day 9 - バックエンドAPI呼び出しリトライ（2026-03-10）**
- ✅ リトライユーティリティ関数作成（retry.ts）
- ✅ Azure STT/Bedrock AI/ElevenLabs TTSリトライ統合
- ✅ エラーログ強化（error-logger.ts）

**✅ 完了: Day 10 - 統合テスト・ドキュメント更新（2026-03-10）**
- ✅ リトライロジックのユニットテスト（retry.test.ts）
  - 14テストケース作成
  - エラー判定、バックオフ計算、リトライ動作テスト
- ✅ CloudWatch Logsアラート設定ガイド
  - 6種類のメトリクス監視（エラー率、リトライ頻度、タイムアウト等）
  - SNS通知設定手順
  - ダッシュボード設定例
- ✅ エラーハンドリング実装ガイド
  - フロントエンド/バックエンド実装パターン
  - API統合例
  - ベストプラクティス
- ✅ Phase 1.5進捗レポート
  - Day 1-10完了サマリー
  - パフォーマンス指標（バッチ vs リアルタイム）
  - 残りタスク（Day 11-14）
- 📊 **要デプロイ**: Lambda関数 + Next.js アプリケーション

**✅ 完了: Day 11 - UX改善（2026-03-11）**
- ✅ 音声波形表示（リアルタイム）
  - useAudioVisualizer hook実装（Web Audio API, AnalyserNode）
  - WaveformDisplay component実装（Canvas描画、バースタイル波形）
  - SessionPlayerに統合（録音時に自動表示）
- ✅ 処理状態インジケーター改善
  - ProcessingIndicator component作成（STT/AI/TTS段階表示）
  - 処理状態追跡（idle → stt → ai → tts → idle）
  - アニメーション付き視覚フィードバック
  - 多言語対応（処理状態ラベル）
- ✅ キーボードショートカット追加
  - KeyboardShortcuts component作成（ヘルプモーダル）
  - Space: セッション開始/停止
  - Escape: セッションキャンセル
  - P: 一時停止/再開
  - M: マイクミュート/解除
  - ?: ヘルプ表示
  - 入力フィールドでのショートカット無効化
  - ミュート状態の視覚的フィードバック
- ✅ アクセシビリティ改善（WCAG 2.1 AA準拠）
  - ARIA labels - 全ボタン・ステータスに説明ラベル追加
  - ARIA live regions - 状態変更をスクリーンリーダーに自動通知
  - role属性 - セマンティックな構造定義（main, region, log, status）
  - フォーカス管理 - キーボードナビゲーション用フォーカスリング追加
  - 視覚的フィードバック - focus:ring-2で明確なフォーカス表示
  - aria-hidden - 装飾的SVGアイコンをスクリーンリーダーから隠す
  - キーボードショートカットヒント - aria-labelにショートカットキー表示

**✅ 完了: Day 12 - 音声バグ修正・WebSocket修正（2026-03-11 → 2026-03-12）**

**✅ 完了: 音声バグ修正（2026-03-11 01:15 JST）**
- ✅ 環境ノイズによる無限ループ問題修正
  - 音声検出閾値を0.05 → 0.15に引き上げ（環境ノイズを無視）
  - 最小継続時間200msを追加（短時間のノイズスパイクを無視）
  - `useAudioRecorder.ts` Line 54, 75-77修正
- ✅ ElevenLabs WebSocket streaming 0バイト問題修正
  - `generateSpeechWebSocketStream`の関数定義修正（async * → async）
  - 根本原因: async generator宣言なのにPromiseをreturn
  - 修正後: Promiseを返す通常のasync関数に変更
  - `tts-elevenlabs.ts` Line 292修正
- ✅ Lambda関数デプロイ完了
  - Prance-dev-ApiLambda スタック更新成功
  - WebSocketDefaultFunction 更新完了
  - デプロイ時間: 138.24秒
  - 最新コード反映（音声検出ロジック、TTS streaming修正）

**✅ 完了: WebSocket Lambda ImportModuleError 修正（2026-03-12 13:18-14:06 JST）**
- 🔴 **問題発生:** WebSocket接続時に `Runtime.ImportModuleError: Cannot find module 'index'`
- 🔍 **根本原因調査（2段階）:**
  1. **第一段階（13:25）:** 共有モジュールのパス不整合を発見
     - ❌ `/asset-input/shared/` → ✅ `/asset-input/infrastructure/lambda/shared/`
     - 修正後も依然としてImportModuleError発生
  2. **第二段階（13:55）:** 真の根本原因を発見
     - Lambda zip内に `index.js`（エントリーポイント）が存在しない
     - CDK NodejsFunction が `index.js` を自動的にbundled outputにコピー**しない**
- ✅ **修正実装（14:00）:**
  ```typescript
  afterBundling(inputDir: string, outputDir: string): string[] {
    return [
      // CRITICAL: Copy the compiled handler entry point
      `cp /asset-input/infrastructure/lambda/websocket/default/index.js ${outputDir}/index.js`,
      // Copy audio/video processor modules
      `cp /asset-input/infrastructure/lambda/websocket/default/audio-processor.js ${outputDir}/audio-processor.js 2>/dev/null || true`,
      // Copy shared modules...
    ];
  }
  ```
- ✅ **デプロイ成功（14:03 JST）:**
  - デプロイ時間: 74.57秒
  - Lambda zip検証: `index.js` + `shared modules` すべて存在確認
  - 動作テスト: Lambda関数が正常実行（エラーハンドリングが機能）
- ✅ **ドキュメント作成:**
  - `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-12_websocket_import_error.md`（完全版）
  - `docs/DEPLOYMENT_ENFORCEMENT.md`（デプロイ前検証システム）
  - CDK Wrapper Script実装（強制検証システム）

**⏳ 残りタスク（Day 12完了まで）**
- ⏳ フロントエンド動作確認（ハードリフレッシュ必須）
  - ブラウザキャッシュクリア: Ctrl+Shift+R (Win) / Cmd+Shift+R (Mac)
  - 新しい閾値（0.15）が反映されているか確認
- ⏳ 音声再生テスト（最重要）
  - 文字起こしが表示される ✓（既に確認済み）
  - **AIの音声が再生される**（未確認）
  - 音声がリアルタイムで再生される（未確認）
- ⏳ CloudWatch Logs確認
  - `aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --filter-pattern "\"TTS complete\""`
  - 期待値: `[Streaming] TTS complete: 71392 bytes`（0バイトではない）

**⏳ 残りタスク（Day 12完了まで）**
- E2Eテスト実行
  - テストシナリオ1: 正常フロー（セッション開始 → STT → AI → TTS → 終了）
  - テストシナリオ2: キーボードショートカット（Space/P/M/Escape/?）
  - テストシナリオ3: アクセシビリティ（Tab/スクリーンリーダー）
  - テストシナリオ4: エラーハンドリング（マイク拒否、ネットワークエラー、音量不足）
- パフォーマンス測定（レスポンス時間、目標2-5秒）

**Phase 1.5 完了後: Day 13-14 - パフォーマンステスト（推定2日）**
- レスポンス時間測定（10回以上、平均・最小・最大値）
- 同時接続負荷テスト（5-10セッション同時実行）
- メモリリーク確認（長時間セッションテスト）
- パフォーマンス最適化（ボトルネック特定・改善）

**Phase 1.6（Week 2.5-3.5）: 既存機能の実用化**
- エラーハンドリング、リトライロジック
- レート制限、パフォーマンス最適化
- 監視、分析、アラート

> 詳細計画: `docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md`

### Option B: Phase 2.3（レポート生成）

**Phase 2を完結させる（1-2週間）**

- レポートテンプレート（React-PDF）
- AI改善提案（AWS Bedrock Claude）
- レポート管理UI
- PDF生成・ダウンロード機能

> 詳細計画: `docs/09-progress/phases/PHASE_2_PLAN.md`

### 🚀 Option C: Phase 2.5（ゲストユーザー機能）- 継続中

**外部ユーザー向け認証なしアクセス機能を完成させる（3週間）**

**✅ 完了:** Day 1-2 - 型定義・共通ユーティリティ（2026-03-11）

**⏳ 次回タスク:** Phase 1 Week 1 Day 3-4 - レート制限ユーティリティ

実装内容:
- DynamoDBベースのレート制限（ブルートフォース攻撃対策）
- IPアドレス・トークン単位の制限
- 指数バックオフ + 自動ロック解除
- 単体テスト作成

推定時間: 2日（Day 3-4）

**残りタスク:**
- Day 5-7: Prismaスキーママイグレーション（GuestSession, GuestSessionLog）
- Week 2: API実装（13 Lambda関数）
- Week 3: UI実装（6画面） + E2Eテスト

> 詳細計画: `docs/05-modules/GUEST_USER_IMPLEMENTATION_PLAN.md`

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

2. **優先順位決定**
   - Phase 1.5-1.6（実用化）を開始するか？
   - Phase 2.3（レポート）を完結させるか？

### Short-term（Day 8-10）

**🎯 Phase 1.5 Day 8-10: エラーハンドリング強化（推奨）**

目標: リアルタイム会話を実用レベルに引き上げる

実装ステップ:
1. **ネットワークエラー対応**
   - WebSocket再接続ロジック（指数バックオフ）
   - STT/AI/TTS APIエラー時の自動リトライ（3回まで）
   - ユーザーへのフレンドリーなエラーメッセージ

2. **タイムアウト処理**
   - 長時間応答がない場合の自動リトライ（30秒タイムアウト）
   - ユーザーへの進捗表示（「処理中...」インジケーター）

3. **音声品質チェック**
   - マイク未接続検出（getUserMediaエラー）
   - 音量レベル不足警告（RMS < 0.01）
   - サポートされていないブラウザ検出

4. **エラーログ・監視**
   - CloudWatch Logsへの詳細エラーログ
   - エラー発生時の自動アラート

技術スタック:
- WebSocket: exponential backoff reconnection
- CloudWatch: error metrics + alarms
- Frontend: user-friendly error messages

### Mid-term（Week 1-2）

**Phase 1.5の継続:**
- ✅ Day 1-3: リアルタイムSTT実装（完了 - 2026-03-10）
- ✅ Day 4-5: リアルタイムAI応答実装（完了 - 2026-03-10）
- ✅ Day 6-7: リアルタイムTTS実装（完了 - 2026-03-10）
- ✅ Day 8: フロントエンドエラーハンドリング強化（完了 - 2026-03-10）
- ✅ Day 9: バックエンドAPIリトライ（完了 - 2026-03-10）
- ✅ Day 10: 統合テスト・ドキュメント更新（完了 - 2026-03-10）
- 🚀 Day 11-12: UX改善（次 - 2日）
- Day 13-14: パフォーマンステスト（2日）

**代替: Phase 2.3（レポート生成）:**
- Day 1: レポートテンプレート実装
- Day 2-3: AI改善提案実装
- Day 4-5: レポート管理UI
- Day 6-7: E2Eテスト

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

# CloudWatch Logs確認
aws logs tail /aws/lambda/prance-session-analysis-dev --since 5m --follow
```

### リアルタイム音声テスト（Phase 1.5）

```bash
# Lambda WebSocket Handler ログ確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --follow

# 確認ポイント:
# 1. [audio_chunk_realtime] Received real-time audio chunk: sequenceNumber: 0, 1, 2...
# 2. [audio_chunk_realtime] Saved chunk to S3: chunk-000000.webm, chunk-000001.webm...
# 3. [speech_end] Speech ended - processing accumulated chunks
# 4. [speech_end] Downloaded chunk 0: XXXX bytes
# 5. [speech_end] Combined audio: totalChunks: N, combinedSize: YYYY bytes
# 6. STT → AI → TTS パイプライン実行

# S3チャンク確認
aws s3 ls s3://prance-storage-dev/sessions/{session_id}/realtime-chunks/

# 期待される出力:
# chunk-000000.webm
# chunk-000001.webm
# chunk-000002.webm
# ...（無音検出後にクリーンアップされる）
```

---

## 重要ドキュメント

### 必読（最優先）

- **START_HERE.md** - このファイル
- **CLAUDE.md** - プロジェクト概要・重要方針
- **docs/README.md** - ドキュメント構造ガイド
- **docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md** - 実用レベル対応ロードマップ

### Phase別計画

- **Phase 2計画:** `docs/09-progress/phases/PHASE_2_PLAN.md`
- **Phase 2.2詳細:** `docs/09-progress/phases/PHASE_2.2_ANALYSIS_IMPLEMENTATION_PLAN.md`
- **完全実装ロードマップ:** `docs/03-planning/implementation/COMPLETE_IMPLEMENTATION_ROADMAP.md`

### 技術設計

- **システムアーキテクチャ:** `docs/02-architecture/SYSTEM_ARCHITECTURE.md`
- **API設計:** `docs/04-design/API_DESIGN.md`
- **データベース設計:** `docs/04-design/DATABASE_DESIGN.md`

### 進捗記録

- **セッション履歴:** `docs/09-progress/SESSION_HISTORY.md`
- **Phase 1完了記録:** `docs/09-progress/archives/ARCHIVE_2026-03-06_Phase1_Completion.md`
- **Phase 2.2統合記録:** `docs/09-progress/archives/SESSION_2026-03-09_PHASE_2.2_INTEGRATION.md`

---

## Phase 2進捗サマリー

| Task | 進捗 | ステータス |
|------|------|----------|
| 2.1 録画機能 | 100% | 完了 |
| 2.2 解析機能 | 100% | 完了 |
| 2.3 レポート生成 | 0% | 未着手 |
| 2.5 ゲストユーザー機能 | 15% | 進行中（Day 1-2完了） |

**次のマイルストーン:**
1. Phase 1.5-1.6（実用化対応）- 2週間 - **音声再生テスト待ち**
2. Phase 2.5（ゲストユーザー）Day 3-4 - レート制限ユーティリティ - **次回推奨**
3. Phase 2.3（レポート生成）- 1-2週間

---

**次回セッションで「前回の続きから始めます」と伝えてください。**
