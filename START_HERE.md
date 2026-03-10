# 次回セッション開始手順

**最終更新:** 2026-03-11 00:00 JST
**Phase 1進捗:** 100%完了（技術的動作レベル） | **Phase 2進捗:** Task 2.1-2.2完了（100%）
**Phase 1.5進捗:** Day 1-11ほぼ完了（リアルタイムSTT + AI + TTS + エラーハンドリング + UX改善） | **進捗:** 86%
**最新コミット:** 未コミット - Day 11 keyboard shortcuts
**最新デプロイ:** 2026-03-10 21:29 JST - ApiLambda stack deployed successfully (要再デプロイ)

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

**🚀 進行中: Day 11-12 - UX改善（推定2日）**
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
- ⏳ アクセシビリティ改善

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

**次のマイルストーン:**
1. Phase 1.5-1.6（実用化対応）- 2週間
2. Phase 2.3（レポート生成）- 1-2週間
3. Phase 2.5（ゲストユーザー）- 3週間

---

**次回セッションで「前回の続きから始めます」と伝えてください。**
