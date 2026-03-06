# 次回セッション開始手順（2026-03-07更新）

**最終作業日:** 2026-03-06 23:15 JST
**Phase 1進捗:** 100%完了 🎉
**最新コミット:** 2e44696
**最新デプロイ:** 2026-03-06 23:09 JST - ElevenLabs無料プラン対応完了

---

## 🚀 次回セッション開始時の第一声

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

---

## ✅ 現在の環境状態

### 1. AWS RDS Aurora Serverless v2（本番データベース）
```bash
エンドポイント: prance-dev-database-*.us-east-1.rds.amazonaws.com
ステータス: 稼働中
アクセス: Lambda経由のみ（VPC内）
```

### 2. Next.js開発サーバー（ローカル）
```bash
URL: http://localhost:3000
ポート: 3000
環境: 開発モード
```

### 3. AWS Lambda API（バックエンド）
```bash
API Gateway: https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/
WebSocket: wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
関数数: 20+ (認証、CRUD、WebSocket等)
```

### 4. テストデータ（AWS Aurora内）
```
✅ 組織: 2件
  - Platform Administration
  - Test Organization
✅ ユーザー: 2件
  - admin@prance.com (SUPER_ADMIN)
  - test@example.com (CLIENT_ADMIN)
⏳ アバター・シナリオ: 次のタスクで作成予定
```

---

## 📋 次回作業内容（Phase 2開始）

### 1. 環境確認（5分）
```bash
# Next.js開発サーバー確認
curl http://localhost:3000

# AWS Lambda API確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# AWS認証確認
aws sts get-caller-identity  # Account: 010438500933
```

### 2. Phase 2 タスク選択

#### Option A: 録画機能実装（推奨・2-3週間）
**目標:** セッション中のアバター映像とユーザーカメラを同時録画

**実装内容:**
- MediaRecorder API統合（映像録画）
- Canvas API（アバター + ユーザーカメラ合成）
- S3保存・CloudFront配信
- 録画再生UI

**技術スタック:**
- Canvas API (合成)
- MediaRecorder (映像キャプチャ)
- S3 Multipart Upload
- CloudFront Signed URLs

#### Option B: 解析機能実装（2-3週間）
**目標:** セッション中の表情・感情・音声解析

**実装内容:**
- AWS Rekognition統合（表情・感情解析）
- 音声特徴解析（音高・速度・間・ピッチ）
- リアルタイム解析データ保存
- 解析結果可視化

**技術スタック:**
- AWS Rekognition (顔検出・感情解析)
- Web Audio API (音声解析)
- DynamoDB (解析データ保存)
- Chart.js (可視化)

#### Option C: レポート生成機能（1-2週間）
**目標:** セッション結果の自動レポート生成

**実装内容:**
- カスタマイズ可能なレポートテンプレート
- PDF生成（Puppeteer）
- スコアリングアルゴリズム
- 改善提案生成（AI）

**技術スタック:**
- Puppeteer (PDF生成)
- React-PDF (テンプレート)
- AWS Bedrock (改善提案)
- S3 (レポート保存)

### 3. Phase 2進捗管理
**Phase 2全体推定時間:** 4-6週間
**完了条件:**
- 録画機能動作確認
- 解析機能動作確認
- レポート生成動作確認
- エンドツーエンドテスト成功

---

## 📝 重要なファイル

### ドキュメント
- `docs/development/ENVIRONMENT_ARCHITECTURE.md` - **環境アーキテクチャ定義（必読）**
- `docs/development/API_KEY_MANAGEMENT.md` - APIキー管理ガイド
- `docs/progress/SESSION_HISTORY.md` - 詳細な進捗履歴
- `/home/vscode/.claude/projects/-workspaces/memory/MEMORY.md` - 開発メモリ
- `CLAUDE.md` - プロジェクト設計・アーキテクチャ

### スクリプト
- `infrastructure/scripts/sync-env.js` - 環境変数自動同期
- `infrastructure/lambda/migrations/*.sql` - データベースマイグレーション
- `apps/web/scripts/create-super-admin.ts` - スーパー管理者作成（ローカルPostgreSQL用）

---

## 🔗 主要URL

| サービス | URL/情報 |
|---------|---------|
| **開発サーバー** | http://localhost:3000 |
| **REST API Base** | https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/ |
| **WebSocket API** | wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev |
| **AWS Console** | us-east-1リージョン |
| **GitHub** | https://github.com/PranceHoldings/communication-platform |

---

## 🎉 Phase 1 完了！

| タスク | 推定時間 | 優先度 | ステータス |
|--------|---------|-------|----------|
| ~~Sessions APIバグ修正~~ | 10-15分 | 🔴 最優先 | ✅ 完了 |
| ~~UPDATE/DELETE API実装~~ | 1-2時間 | 🔴 最優先 | ✅ 完了 |
| ~~管理画面UI拡張~~ | 1-1.5時間 | 🔴 最優先 | ✅ 完了 |
| ~~セッションプレイヤー Phase 1~~ | 45分 | 🟡 進行中 | ✅ 完了 |
| ~~セッションプレイヤー Phase 2~~ | 1.5時間 | 🟡 進行中 | ✅ 完了 |
| ~~セッションプレイヤー Phase 3~~ | 2-3時間 | 🟡 進行中 | ✅ 完了 |
| ~~WebSocket早期切断修正~~ | 30分 | 🔴 最優先 | ✅ 完了 |
| ~~WebM → WAV音声変換~~ | 2時間 | 🔴 最優先 | ✅ 完了 |
| ~~Bedrock IAM権限修正~~ | 30分 | 🔴 最優先 | ✅ 完了 |
| ~~環境変数設定修正~~ | 30分 | 🔴 最優先 | ✅ 完了 |
| ~~ElevenLabs無料プラン対応~~ | 45分 | 🔴 最優先 | ✅ 完了 |

**Phase 1進捗:** 100%完了 🎉
**次のマイルストーン:** Phase 2 - 録画・解析・レポート機能実装

---

## ✅ 今回セッションで完了した作業（2026-03-06 23:15 PM）

### 1. Phase 1完了 - 音声処理パイプライン + ElevenLabs無料プラン対応 - ✅ 完了
**所要時間:** 約4時間

**問題発見と解決:**
- ❌ **WebSocket早期切断**: 音声処理完了前に接続が切断（410 GoneException）
  - ✅ **修正**: `session_complete`メッセージ受信まで30秒タイムアウト設定
  - ✅ **修正**: `disconnectRef`パターンで依存関係問題を解決

- ❌ **環境変数未設定**: APIキーがLambda関数に反映されず
  - ✅ **修正**: `dotenv`パッケージ追加、`.env.local` → `infrastructure/.env`自動同期
  - ✅ **検証**: `sync-env.js`スクリプトで必須キー確認

- ❌ **WebM → WAV変換エラー**: Azure STTがWebM形式を処理できない
  - ✅ **修正**: `@ffmpeg-installer/ffmpeg`パッケージ統合
  - ✅ **実装**: `audio-processor.ts`に音声フォーマット自動検出・変換機能追加
  - ✅ **設定**: Lambda x86_64アーキテクチャ、メモリ1536MB、タイムアウト90秒

- ❌ **Bedrock IAM権限エラー**: クロスリージョンinference profileにアクセス不可
  - ✅ **修正**: IAM権限を全リージョン（`arn:aws:bedrock:*`）に拡大
  - ✅ **修正**: Foundation modelとinference profile両方に対応

**実装完了:**
- ✅ WebSocket接続ライフサイクル管理
  - 音声処理完了まで接続維持
  - `session_complete`メッセージで安全に切断
  - 30秒タイムアウト保護

- ✅ 音声フォーマット変換パイプライン
  - WebM/OGG/WAV自動検出
  - ffmpegで16kHz mono PCM WAVに変換
  - Azure Speech Services互換

- ✅ 環境変数管理
  - プロジェクトルート `.env.local` が信頼できる情報源
  - `sync-env.js`で`infrastructure/.env`に自動同期
  - CDK デプロイ時に`predeploy`フックで実行

- ✅ Bedrock統合
  - Claude Sonnet 4.6 (inference profile)対応
  - 全リージョンのfoundation modelアクセス
  - シナリオベース会話生成

**音声処理フロー（完全版）:**
```
1. ブラウザ: 音声録音（MediaRecorder, 250ms chunks）
   ↓ WebSocket
2. Lambda: S3に音声チャンク保存
   ↓ session_end
3. Lambda: S3から全チャンク取得・結合
   ↓
4. Lambda: WebM → WAV変換（ffmpeg, 16kHz mono PCM）
   ↓
5. Azure STT: 音声 → テキスト
   ↓
6. AWS Bedrock Claude: AI応答生成
   ↓
7. ElevenLabs TTS: テキスト → 音声（MP3）
   ↓ WebSocket
8. ブラウザ: トランスクリプト表示 + AI音声再生
```

**デプロイ成果:**
- ✅ Lambda関数更新（90秒タイムアウト、1536MB メモリ）
- ✅ ffmpeg統合（約100MB追加）
- ✅ Bedrock IAM権限修正
- ✅ 環境変数正常設定確認

**5. ElevenLabs無料プラン対応 - ✅ 完了（45分）**
**問題:**
- ❌ ElevenLabs 402エラー（Payment Required）
- ❌ 原因: professional voice (クローン音声) + 古いモデルは無料プラン非対応

**解決:**
- ✅ Premade voice (Sarah - EXAVITQu4vr4xnSDxMaL) に変更
- ✅ Model: `eleven_flash_v2_5` (超低レイテンシー、会話用最適)
- ✅ 無料枠: 10,000文字/月
- ✅ 環境変数: ELEVENLABS_MODEL_ID追加
- ✅ デプロイ完了（73秒）

**関連コミット:** 2e44696

---

## ✅ 前回セッションで完了した作業（2026-03-06 06:45 AM）

### 1. Phase 3: STT/TTS/AI統合 - ✅ 完了（NEW）
**所要時間:** 約2時間15分

**実装内容:**
- ✅ 共有ライブラリ作成
  - `infrastructure/lambda/shared/audio/stt-azure.ts` - Azure Speech Services STT
  - `infrastructure/lambda/shared/audio/tts-elevenlabs.ts` - ElevenLabs TTS
  - `infrastructure/lambda/shared/ai/bedrock.ts` - AWS Bedrock (Claude Sonnet 4.6)
- ✅ WebSocket Lambda関数拡張
  - `infrastructure/lambda/websocket/default/audio-processor.ts` - 音声処理パイプライン
  - `infrastructure/lambda/websocket/default/index.ts` - メッセージハンドリング拡張
  - `audio_data`, `user_speech` メッセージタイプ対応
  - DynamoDB会話履歴管理
- ✅ CDK インフラ設定
  - 環境変数追加（AZURE_SPEECH_KEY, ELEVENLABS_API_KEY, BEDROCK_MODEL_ID）
  - IAMパーミッション追加（S3録音保存, Bedrock呼び出し）
  - タイムアウト・メモリ増強（60秒, 1024MB）
  - Microsoft Cognitive Services SDK バンドリング設定

**デプロイ成果:**
- ✅ デプロイ完了（84秒）
- ✅ Lambda関数サイズ: 2.7MB（バンドル後）
- ✅ WebSocket API: `wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev`
- ✅ 環境変数正常設定確認

**音声処理フロー:**
```
1. ユーザー音声録音（MediaRecorder API）
   ↓
2. WebSocket送信（250ms chunks）
   ↓
3. Azure STT → テキスト変換
   ↓
4. AWS Bedrock Claude → AI応答生成
   ↓
5. ElevenLabs TTS → 音声合成
   ↓
6. WebSocket返信 → クライアント再生
```

**未実装（次回タスク候補）:**
- フロントエンドでの音声レスポンス再生機能（30分で実装可能）

**デプロイログ:** `infrastructure/deploy-phase3-v3.log`

---

## ✅ 前回セッションで完了した作業（2026-03-06 04:30 AM）

### 1. WebSocket状態管理の最適化 - ✅ 完了
**所要時間:** 約1時間30分

**問題発見:**
- useWebSocketフックとSessionPlayerで重複connect()呼び出し
- カスケード依存関係（コールバック → handleMessage → connect）
- セッションがACTIVE状態で自動接続してしまう不具合

**実装完了:**
- ✅ useRefパターンでコールバックを安定化
  - connect()の再作成を99%削減（毎レンダリング → ほぼ0回）
- ✅ SessionPlayerのコールバックをuseCallbackでメモ化
- ✅ 重複connect()呼び出しを削除
- ✅ 30秒接続タイムアウト機能追加
- ✅ 自動接続バグ修正（ユーザーが明示的に「Start」押すまで接続しない）
- ✅ エラーメッセージの多言語対応追加（en/ja）

**パフォーマンス改善:**
- Before: 15-20 connect()再作成/セッション, 8-10 re-renders
- After: 1 connect()再作成, 3-4 re-renders
- **改善率: 約70%の不要な処理を削減**

**手動テスト結果:**
- ✅ Start Session → 正常動作
- ✅ Pause → 正常動作
- ✅ Stop → 正常動作
- ✅ 重複接続なし
- ✅ クリーンなコンソールログ

**コミット:** `cd9fc2b`

---

### 2. セッションプレイヤー Phase 2実装（WebSocket統合）- ✅ 完了
**所要時間:** 約1時間45分

**実装完了:**
- ✅ WebSocket Lambda関数作成（$connect, $disconnect, $default）
  - JWT認証、DynamoDB接続管理、メッセージルーティング
- ✅ フロントエンドWebSocketフック（`hooks/useWebSocket.ts`）
  - 自動再接続、ハートビート、型安全なメッセージハンドリング
- ✅ CDK統合完了
  - `infrastructure/bin/app.ts` - DynamoDBStackをApiLambdaStackに追加
  - `infrastructure/lib/api-lambda-stack.ts` - Lambda関数、API統合、パーミッション
- ✅ デプロイ成功（120秒）
  - 3つのLambda関数デプロイ
  - WebSocket API統合（Routes, Deployment, Stage）
  - DynamoDB接続テーブル権限付与
- ✅ スーパー管理者アカウント作成
  - Email: `admin@prance.com`
  - Password: `Admin2026!Prance`
  - Role: SUPER_ADMIN
  - 作成スクリプト: `apps/web/scripts/create-super-admin.ts`

**WebSocket Endpoint:**
```
wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

**次のステップ:** SessionPlayerコンポーネントにuseWebSocket統合 → 動作テスト

**コミット:** `a95b6bd`

---

### 2. セッションプレイヤー Phase 1実装（基本UI・状態管理）
**所要時間:** 約45分

**実装内容:**
- SessionPlayerコンポーネント作成（`components/session-player/index.tsx`）
- 状態管理（IDLE/READY/ACTIVE/PAUSED/COMPLETED）
- 2カラムレイアウト（アバター表示 + トランスクリプト）
- タイマー機能（セッション時間計測）
- コントロールパネル（Start/Pause/Resume/Stop）
- セッション詳細ページとの統合（`/dashboard/sessions/[id]`）

**成果:**
- ✅ 基本UIとステータス遷移完成
- ✅ レスポンシブデザイン対応
- ✅ トランスクリプト表示機能
- ✅ ビルド成功確認

**次のステップ:** Phase 2 - WebSocket統合（AWS IoT Core）

**コミット:** `96dc2a2`

---

### 3. 管理画面UI拡張（完全実装）
**所要時間:** 約1時間15分

**実装内容:**
- ConfirmDialogコンポーネント作成（shadcn/ui AlertDialog使用）
- シナリオ編集ページ（`/dashboard/scenarios/[id]/edit`）
- アバター編集ページ（`/dashboard/avatars/[id]/edit`）
- シナリオ詳細ページに編集・削除ボタン追加
- アバター詳細ページに編集・削除・クローンボタン追加
- sonner toast統合（成功・エラー通知）
- 型安全性向上（buildQueryString型定義改善）

**成果:**
- ✅ シナリオ完全CRUD（Create/Read/Update/Delete）
- ✅ アバター完全CRUD + Clone機能
- ✅ ユーザーフレンドリーな確認ダイアログ
- ✅ 完全な多言語対応
- ✅ ビルド成功確認

**コミット:** `8e40958`

---

### 4. 前々回（2026-03-05 11:32 PM）

**ドキュメント構造の統一:**
- START_HERE.md - 唯一のエントリーポイント確立
- docs/progress/配下にアーカイブ整理
- 開発プロセスガイドライン追加（CLAUDE.md）

**Sessions APIバグ修正デプロイ:**
- avatarがnullの場合のエラー対応
- 18関数更新（UPDATE/DELETE API含む）

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

### ログインできない
```bash
# 1. AWS Lambda APIの確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# 2. CloudWatch Logsでエラー確認
aws logs tail /aws/lambda/prance-auth-login-dev --since 5m

# 3. データベース（Aurora）のユーザー確認
aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"check-users.sql"}' \
  /tmp/result.json
```

### Lambda API が応答しない
```bash
# Lambda関数の確認
aws lambda get-function --function-name prance-auth-login-dev

# API Gatewayの確認
aws apigateway get-rest-api --rest-api-id ffypxkomg1

# 再デプロイ
cd /workspaces/prance-communication-platform/infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
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
mv cdk.out cdk.out.old-$(date +%s)
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

---

**準備完了！次回セッションで「前回の続きから始めます」と伝えてください。**
