# 実装フェーズ

実装容易度と依存関係を考慮した段階的な開発計画。各フェーズは並行開発可能なタスクに分解されています。

## 目次

- [実装の原則](#実装の原則)
- [Phase 0: 基盤構築](#phase-0-基盤構築2週間)
- [Phase 1: MVP - コア会話機能](#phase-1-mvp---コア会話機能6週間)
- [Phase 2: AI管理・アバター拡充](#phase-2-ai管理アバター拡充5週間)
- [Phase 3: 解析・レポート](#phase-3-解析レポート5週間)
- [Phase 4: SaaS完成・Enterprise対応](#phase-4-saas完成enterprise対応6週間)
- [Phase 5: 拡張機能・多言語](#phase-5-拡張機能多言語4週間)
- [Phase 6: 最適化・スケール](#phase-6-最適化スケール3週間)
- [チーム構成推奨](#チーム構成推奨)
- [実装スケジュール](#実装スケジュール)

---

## 実装の原則

### Claude Code開発前提

- **モジュール独立性**: 各機能は独立したモジュールとして実装
- **明確なインターフェース**: モジュール間は型定義されたインターフェースで接続
- **並行開発可能**: チームメンバーが同時に異なる機能を開発可能
- **段階的統合**: 各フェーズ完了時に統合テスト

### 優先順位の基準

1. **依存関係**: 他機能の前提となるもの
2. **ビジネス価値**: MVPに必須の機能
3. **実装容易度**: 複雑度が低いもの
4. **リスク**: 技術的不確実性が高いもの

### 実装容易度の指標

- ⭐ (低): 1-2日、標準的な実装
- ⭐⭐ (中): 3-5日、複雑な統合を含む
- ⭐⭐⭐ (高): 1-2週間、技術的課題あり
- ⭐⭐⭐⭐ (非常に高): 2週間以上、R&D必要

---

## Phase 0: 基盤構築（2週間）

**目標**: 開発環境とインフラ基盤の確立

**ステータス**: ✅ 完了 (2026-03-05)

### 0.1 プロジェクトセットアップ（3日）

**担当**: DevOps Engineer
**実装容易度**: ⭐⭐（中）

#### タスク

- [x] Monorepoセットアップ（Turborepo）
- [x] TypeScript設定（strict mode）
- [x] ESLint + Prettier設定
- [x] Git hooks（Husky + lint-staged）
- [x] VS Code推奨設定

#### 成果物

- `package.json` (root)
- `turbo.json`
- `.eslintrc.js`
- `.prettierrc`
- `.husky/`

#### Claude Codeプロンプト例

```
MonorepoをTurborepoでセットアップしてください。
apps/web（Next.js 15）、apps/api（Lambda関数）、packages/shared、packages/database を作成。
TypeScript strict mode、ESLint、Prettierを設定。
```

---

### 0.2 AWS CDK基盤（5日）

**担当**: DevOps Engineer
**実装容易度**: ⭐⭐⭐（高）
**依存関係**: なし

#### タスク

- [x] CDKプロジェクト初期化
- [x] VPC・ネットワーク設定
- [x] Aurora Serverless v2クラスター
- [x] DynamoDBテーブル
- [x] S3バケット（録画・アバター・レポート）
- [x] CloudFront distributions
- [x] Cognito User Pool
- [x] API Gateway（REST/WebSocket）
- [x] Lambda基本関数（Health Check、Auth、DBマイグレーション）

#### 成果物

- `infrastructure/lib/network-stack.ts`
- `infrastructure/lib/database-stack.ts`
- `infrastructure/lib/storage-stack.ts`
- `infrastructure/lib/api-gateway-stack.ts`
- `infrastructure/lib/cognito-stack.ts`
- `infrastructure/lib/lambda-stack.ts`

#### 構築済みインフラ (AWS us-east-1)

1. ✅ NetworkStack - VPC、Subnets、NAT Gateway、Security Groups
2. ✅ CognitoStack - User Pool、認証・認可
3. ✅ DatabaseStack - Aurora Serverless v2 (PostgreSQL 15.4)
4. ✅ StorageStack - S3 Buckets、CloudFront CDN
5. ✅ DynamoDBStack - セッション状態、WebSocket接続、ベンチマーク、レート制限
6. ✅ ApiGatewayStack - REST API、WebSocket API、Cognito Authorizer
7. ✅ ApiLambdaStack - Lambda関数（Health Check、JWT Authorizer、Register/Login/Me、DBマイグレーション）

#### 検証済みAPI

- ✅ POST /api/v1/auth/register (ユーザー登録)
- ✅ POST /api/v1/auth/login (ログイン)
- ✅ GET /api/v1/users/me (認証済みユーザー情報取得)

**API Base URL**: `https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/`

---

### 0.3 Prismaスキーマ設計（3日）

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**依存関係**: 0.2（Aurora）

#### タスク

- [x] Prismaプロジェクト初期化
- [x] スキーマ定義（全テーブル）
- [x] マイグレーションファイル作成
- [x] Prisma Client生成
- [x] Seed データ作成

#### 成果物

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/`
- `packages/database/prisma/seed.ts`

#### Claude Codeプロンプト例

```
Prismaスキーマを作成してください。
以下のテーブルを含む:
- organizations, users, avatars, voices, scenarios
- sessions, recordings, transcripts
- plans, subscriptions
DATABASE_DESIGN.mdのデータベース設計を参照。
```

---

### 0.4 CI/CDパイプライン（3日）

**担当**: DevOps Engineer
**実装容易度**: ⭐⭐（中）
**依存関係**: 0.1, 0.2

#### タスク

- [ ] GitHub Actions ワークフロー
  - [ ] PR: Lint + Test
  - [ ] main: ステージング自動デプロイ
  - [ ] tag: プロダクションデプロイ
- [ ] デプロイスクリプト（ワンクリック）
- [ ] 環境変数管理（AWS Secrets Manager）

#### 成果物

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `scripts/deploy.sh`

---

## Phase 1: MVP - コア会話機能（6週間）

**目標**: AIアバターとの基本的な会話セッションが動作

**ステータス**: 🔄 準備中

### 1.1 認証・ユーザー管理（1週間）

#### 1.1.1 Cognito認証統合

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] Amplify Auth設定
- [ ] サインアップ/ログインAPI
- [ ] JWT検証ミドルウェア
- [ ] Cognito Trigger（PreSignUp, PostConfirmation）
- [ ] ユーザープロフィールCRUD API

##### ファイル

- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/users/users.module.ts`

---

#### 1.1.2 フロントエンド認証UI

**担当**: Frontend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

##### タスク

- [ ] ログイン画面
- [ ] サインアップ画面
- [ ] パスワードリセット
- [ ] MFA設定（オプション）
- [ ] 認証状態管理（Zustand）

##### ファイル

- `apps/web/app/[locale]/(auth)/login/page.tsx`
- `apps/web/app/[locale]/(auth)/signup/page.tsx`
- `apps/web/lib/auth/auth-store.ts`
- `apps/web/lib/auth/auth-api.ts`

---

### 1.2 アバター表示（1週間）

#### 1.2.1 3Dアバター（Ready Player Me）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

##### タスク

- [ ] Three.js + React Three Fiberセットアップ
- [ ] Ready Player Me GLBモデル読み込み
- [ ] ARKit Blendshapes実装
- [ ] リップシンク（Viseme → Blendshape）
- [ ] カメラ・ライティング設定

##### ファイル

- `apps/web/components/avatar/ThreeAvatar.tsx`
- `apps/web/lib/avatar/rpm-loader.ts`
- `apps/web/lib/avatar/lipsync.ts`

---

#### 1.2.2 アバター管理API

**担当**: Backend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

##### タスク

- [ ] アバターCRUD API
- [ ] S3アップロード（署名付きURL）
- [ ] RPM Photo Capture API統合
- [ ] プリセットアバター管理

##### ファイル

- `apps/api/src/avatars/avatars.module.ts`
- `apps/api/src/avatars/avatars.service.ts`
- `apps/api/src/avatars/avatars.controller.ts`

---

### 1.3 音声システム（1.5週間）

#### 1.3.1 TTS統合（ElevenLabs）

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] ElevenLabs APIクライアント
- [ ] テキスト→音声変換
- [ ] Visemeデータ抽出
- [ ] ストリーミング対応
- [ ] Lambda関数実装

##### ファイル

- `apps/api/src/voice/tts/elevenlabs.service.ts`
- `apps/api/src/voice/tts/tts.interface.ts`
- `apps/workers/src/functions/tts-worker.ts`

---

#### 1.3.2 STT統合（Azure Speech）

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] Azure Speech SDKセットアップ
- [ ] リアルタイムストリーミング認識
- [ ] WebSocket経由で音声受信
- [ ] 字幕データ配信

##### ファイル

- `apps/api/src/voice/stt/azure-speech.service.ts`
- `apps/api/src/websocket/audio-handler.ts`

---

### 1.4 シナリオエンジン（1週間）

#### 1.4.1 シナリオCRUD

**担当**: Backend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

##### タスク

- [ ] シナリオCRUD API
- [ ] シナリオバリデーション（Zod）
- [ ] システムプロンプト生成ロジック
- [ ] シナリオ共有機能

##### ファイル

- `apps/api/src/scenarios/scenarios.module.ts`
- `apps/api/src/scenarios/scenarios.service.ts`
- `apps/api/src/scenarios/dto/create-scenario.dto.ts`

---

#### 1.4.2 会話AI統合（Claude Sonnet 4.6）

**担当**: Backend/AI Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] AWS Bedrock Claude APIクライアント
- [ ] 会話履歴管理（DynamoDB）
- [ ] システムプロンプト構築
- [ ] ストリーミングレスポンス

##### ファイル

- `apps/api/src/conversation/bedrock-claude.service.ts`
- `apps/api/src/conversation/conversation.service.ts`
- `apps/api/src/conversation/conversation-context.ts`

##### Claude Codeプロンプト例

```
AWS Bedrock Claude APIの会話サービスを実装してください。
- AWS SDK v3使用（@aws-sdk/client-bedrock-runtime）
- Model ID: us.anthropic.claude-sonnet-4-6
- ストリーミングレスポンス対応
- 会話履歴をDynamoDBに保存
- システムプロンプトとユーザーメッセージの組み立て
```

---

### 1.5 セッション実行（1.5週間）

#### 1.5.1 WebSocket通信

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 一部可能

##### タスク

- [ ] AWS IoT Core WebSocketセットアップ
- [ ] 接続管理Lambda
- [ ] メッセージルーティング
- [ ] セッション状態管理（DynamoDB）

##### ファイル

- `apps/api/src/websocket/websocket.gateway.ts`
- `apps/api/src/websocket/connection.service.ts`
- `apps/api/src/websocket/message-handler.ts`

---

#### 1.5.2 録画システム

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] MediaRecorder API統合
- [ ] ユーザーカメラ録画
- [ ] アバターCanvas録画
- [ ] S3アップロード（署名付きURL）
- [ ] 録画プレビュー

##### ファイル

- `apps/web/components/session/RecordingManager.tsx`
- `apps/web/lib/recording/media-recorder.ts`
- `apps/web/lib/recording/upload.ts`

---

#### 1.5.3 セッション画面（3要素統合UI）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 依存あり（1.2, 1.3完了後）

##### タスク

- [ ] セッションレイアウト（3要素統合）
  - [ ] ユーザーカメラ映像表示エリア（右側）
  - [ ] AIアバター映像表示エリア（左側）
  - [ ] リアルタイム文字起こし表示エリア（下部）
- [ ] ユーザーカメラ統合
  - [ ] getUserMedia API実装
  - [ ] カメラON/OFF切り替え
  - [ ] デバイス選択UI
  - [ ] プレビュー表示
- [ ] アバター表示統合
  - [ ] Three.js/Live2Dレンダリング統合
  - [ ] リップシンク（Viseme連動）
  - [ ] 60fps維持
- [ ] 音声入出力制御
  - [ ] マイクON/OFF切り替え
  - [ ] 音量調整
  - [ ] デバイス選択UI
- [ ] リアルタイム文字起こし表示
  - [ ] Azure STT統合（ストリーミング認識）
  - [ ] 認識中テキスト表示（暫定、グレー）
  - [ ] 確定テキスト表示（通常色）
  - [ ] 話者別色分け（AI: 青、USER: 緑）
  - [ ] タイムスタンプ表示
  - [ ] 自動スクロール
  - [ ] 手動スクロール対応
- [ ] 同時録画
  - [ ] ユーザーカメラ録画（MediaRecorder）
  - [ ] アバターCanvas録画（captureStream）
  - [ ] 録画状態表示
- [ ] セッション制御
  - [ ] セッション開始/終了
  - [ ] トピック進捗表示
  - [ ] 経過時間表示

##### ファイル

- `apps/web/app/[locale]/session/[id]/page.tsx`
- `apps/web/components/session/SessionPlayer.tsx`
- `apps/web/components/session/UserCameraView.tsx`
- `apps/web/components/session/AvatarView.tsx`
- `apps/web/components/session/RealtimeTranscript.tsx`
- `apps/web/components/session/AudioController.tsx`
- `apps/web/hooks/useRealtimeSession.ts`
- `apps/web/hooks/useRealtimeTranscription.ts`

---

### 1.6 基本トランスクリプト・再生（1週間）

#### 1.6.1 トランスクリプトAPI

**担当**: Backend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

##### タスク

- [ ] トランスクリプトCRUD API
- [ ] Whisper API統合（再トランスクリプト）
- [ ] タイムスタンプ管理

##### ファイル

- `apps/api/src/transcripts/transcripts.module.ts`
- `apps/api/src/transcripts/transcripts.service.ts`

---

#### 1.6.2 録画再生プレイヤー

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] Video.jsセットアップ
- [ ] サイドバイサイド表示
- [ ] 再生コントロール
- [ ] トランスクリプト同期表示（基本版）

##### ファイル

- `apps/web/components/player/VideoPlayer.tsx`
- `apps/web/components/player/TranscriptPanel.tsx`

---

## Phase 2: AI管理・アバター拡充（5週間）

**目標**: 管理者によるAI制御とアバターカスタマイズ

### 2.1 AIプロンプト管理（2週間）

#### 2.1.1 プロンプトテンプレートAPI

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] プロンプトテンプレートCRUD
- [ ] バージョン管理
- [ ] 変数システム実装
- [ ] テスト実行API

##### ファイル

- `apps/api/src/prompts/prompt-templates.module.ts`
- `apps/api/src/prompts/prompt-templates.service.ts`
- `apps/api/src/prompts/version.service.ts`

---

#### 2.1.2 プロンプト管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 依存あり（2.1.1完了後）

##### タスク

- [ ] プロンプト編集画面
- [ ] 変数マッピングUI
- [ ] リアルタイムプレビュー
- [ ] バージョン履歴表示
- [ ] エクスポート/インポート

##### ファイル

- `apps/web/app/[locale]/admin/prompts/page.tsx`
- `apps/web/components/admin/PromptEditor.tsx`
- `apps/web/components/admin/VariableMapper.tsx`

---

### 2.2 AIプロバイダ管理（1週間）

#### 2.2.1 プロバイダ抽象化レイヤー

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

##### タスク

- [ ] プロバイダインターフェース定義
- [ ] AWS Bedrock Claude, GPT-4, Geminiアダプター
- [ ] プロバイダ切り替えロジック
- [ ] フォールバック実装
- [ ] 使用量トラッキング

##### ファイル

- `packages/shared/src/providers/ai-provider.interface.ts`
- `packages/shared/src/providers/bedrock-claude-adapter.ts`
- `packages/shared/src/providers/openai-adapter.ts`
- `apps/api/src/providers/provider-manager.service.ts`

---

#### 2.2.2 プロバイダ管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] プロバイダ設定画面
- [ ] 接続テスト機能
- [ ] 使用量ダッシュボード
- [ ] コスト管理UI

##### ファイル

- `apps/web/app/[locale]/admin/providers/page.tsx`
- `apps/web/components/admin/ProviderConfig.tsx`
- `apps/web/components/admin/UsageDashboard.tsx`

---

### 2.3 アバターカスタマイズ（2週間）

#### 2.3.1 2Dアバター（Live2D）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐⭐（非常に高）
**並行開発**: 可能

##### タスク

- [ ] Live2D Cubism SDKセットアップ
- [ ] モデル読み込み
- [ ] パラメータ制御
- [ ] リップシンク

##### ファイル

- `apps/web/components/avatar/Live2DAvatar.tsx`
- `apps/web/lib/avatar/live2d-loader.ts`

---

#### 2.3.2 画像からアバター生成

**担当**: Backend Engineer + AI Engineer
**実装容易度**: ⭐⭐⭐⭐（非常に高）
**並行開発**: 可能

##### タスク

- [ ] AnimeGANv2統合（Lambda Container）
- [ ] RPM Photo Capture API統合
- [ ] 顔検出（MediaPipe）
- [ ] 背景除去（Remove.bg）
- [ ] 生成パイプライン

##### ファイル

- `apps/workers/src/functions/avatar-generator.ts`
- `apps/api/src/avatars/generation.service.ts`

---

#### 2.3.3 アバター選択UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] アバターライブラリ表示
- [ ] フィルタリング機能
- [ ] プレビュー機能
- [ ] カスタムアバター作成フロー

##### ファイル

- `apps/web/components/avatar/AvatarSelector.tsx`
- `apps/web/components/avatar/AvatarPreview.tsx`
- `apps/web/components/avatar/CustomAvatarWizard.tsx`

---

## Phase 3: 解析・レポート（5週間）

**目標**: 会話セッションの解析とレポート生成

### 3.1 非同期処理基盤（1.5週間）

#### 3.1.1 Step Functionsワークフロー

**担当**: DevOps + Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 一部可能

##### タスク

- [ ] CDKでStep Functions定義
- [ ] ワークフローステート定義
- [ ] エラーハンドリング・リトライ
- [ ] DLQ設定

##### ファイル

- `infrastructure/lib/workflow-stack.ts`
- `apps/workers/src/workflows/session-processing.asl.json`

---

#### 3.1.2 MediaConvert動画合成

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] MediaConvertジョブ設定
- [ ] サイドバイサイドレイアウト
- [ ] Lambda トリガー実装

##### ファイル

- `apps/workers/src/functions/video-composer.ts`
- `apps/api/src/media/mediaconvert.service.ts`

---

### 3.2 感情・音声解析（1.5週間）

#### 3.2.1 AWS Rekognition統合

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] AWS Rekognition APIクライアント
- [ ] フレーム抽出（FFmpeg）
- [ ] バッチ処理
- [ ] 感情データ保存

##### ファイル

- `apps/workers/src/functions/emotion-analyzer.ts`
- `apps/api/src/analysis/aws-rekognition.service.ts`

---

#### 3.2.2 音声解析

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] Azure Speech Analytics統合
- [ ] WPM計算
- [ ] ピッチ分析
- [ ] フィラーワード検出

##### ファイル

- `apps/workers/src/functions/audio-analyzer.ts`
- `apps/api/src/analysis/audio-analysis.service.ts`

---

### 3.3 レポート生成（2週間）

#### 3.3.1 レポート生成API

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

##### タスク

- [ ] Claude APIでフィードバック生成
- [ ] スコア計算ロジック
- [ ] ハイライト抽出
- [ ] レポートテンプレート処理

##### ファイル

- `apps/workers/src/functions/report-generator.ts`
- `apps/api/src/reports/reports.service.ts`
- `apps/api/src/reports/scoring.service.ts`

---

#### 3.3.2 PDF生成

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] Puppeteer Lambda Layer
- [ ] HTMLテンプレート
- [ ] PDF生成
- [ ] S3保存

##### ファイル

- `apps/workers/src/functions/pdf-generator.ts`
- `apps/api/src/reports/templates/default-template.html`

---

#### 3.3.3 レポートUI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] レポート表示画面
- [ ] 感情グラフ（Recharts）
- [ ] ハイライトセクション
- [ ] PDF ダウンロード

##### ファイル

- `apps/web/app/[locale]/reports/[id]/page.tsx`
- `apps/web/components/reports/ReportView.tsx`
- `apps/web/components/reports/EmotionChart.tsx`

---

### 3.4 トランスクリプト同期プレイヤー完成版（1週間）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] トランスクリプト ↔ 動画同期
- [ ] クリック可能なトランスクリプト
- [ ] ハイライト表示
- [ ] スクロール同期

##### ファイル

- `apps/web/components/player/SyncedTranscript.tsx`
- `apps/web/lib/player/sync-manager.ts`

---

## Phase 4: SaaS完成・Enterprise対応（6週間）

**目標**: マルチテナント、課金、ベンチマーク、外部API

### 4.1 マルチテナント・課金（2週間）

#### 4.1.1 プラン管理システム

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] プランCRUD API
- [ ] サブスクリプション管理
- [ ] クォータ管理
- [ ] 使用量監視
- [ ] Stripe統合準備

##### ファイル

- `apps/api/src/billing/plans.module.ts`
- `apps/api/src/billing/plans.service.ts`
- `apps/api/src/billing/subscriptions.service.ts`
- `apps/api/src/billing/quota.service.ts`

---

#### 4.1.2 プラン管理UI（スーパー管理者）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] プラン設定画面
- [ ] クォータ設定UI
- [ ] 価格設定
- [ ] プラン比較ページ

##### ファイル

- `apps/web/app/[locale]/super-admin/plans/page.tsx`
- `apps/web/components/super-admin/PlanEditor.tsx`

---

#### 4.1.3 管理者ダッシュボード

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] 組織分析ダッシュボード
- [ ] ユーザー管理
- [ ] セッション統計
- [ ] コストダッシュボード

##### ファイル

- `apps/web/app/[locale]/admin/dashboard/page.tsx`
- `apps/web/components/admin/Analytics.tsx`

---

### 4.2 ベンチマーク（1.5週間）

#### 4.2.1 ベンチマーク計算

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

##### タスク

- [ ] プロファイル算出ロジック
- [ ] パーセンタイル計算
- [ ] クラスタリング（K-means）
- [ ] 日次バッチ処理
- [ ] DynamoDBキャッシュ

##### ファイル

- `apps/workers/src/functions/benchmark-aggregator.ts`
- `apps/api/src/benchmark/benchmark.service.ts`
- `apps/api/src/benchmark/clustering.service.ts`

---

#### 4.2.2 ベンチマークUI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] プロファイル表示
- [ ] ベンチマーク比較
- [ ] 成長グラフ
- [ ] 改善提案表示

##### ファイル

- `apps/web/app/[locale]/profile/benchmark/page.tsx`
- `apps/web/components/profile/BenchmarkView.tsx`
- `apps/web/components/profile/GrowthChart.tsx`

---

### 4.3 外部連携API（1.5週間）

#### 4.3.1 APIキー管理

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] APIキーCRUD
- [ ] キー生成・ハッシュ化
- [ ] スコープ管理
- [ ] レート制限（Redis）
- [ ] 使用量トラッキング

##### ファイル

- `apps/api/src/api-keys/api-keys.module.ts`
- `apps/api/src/api-keys/api-keys.service.ts`
- `apps/api/src/api-keys/rate-limiter.service.ts`

---

#### 4.3.2 APIキー管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

##### タスク

- [ ] APIキー一覧
- [ ] キー作成フォーム
- [ ] 使用状況ダッシュボード
- [ ] ドキュメント表示

##### ファイル

- `apps/web/app/[locale]/admin/api-keys/page.tsx`
- `apps/web/components/admin/ApiKeyManager.tsx`

---

### 4.4 セキュリティ・SSO（1週間）

#### 4.4.1 SAML SSO統合

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

##### タスク

- [ ] Cognito SAML設定
- [ ] IdPメタデータ処理
- [ ] 属性マッピング

##### ファイル

- `infrastructure/lib/cognito-stack.ts` (更新)
- `apps/api/src/auth/saml.service.ts`

---

## Phase 5: 拡張機能・多言語（4週間）

**目標**: 多言語対応、ATS連携、プラグインシステム

### 5.1 多言語対応（2週間）

#### 5.1.1 i18nセットアップ

**担当**: Frontend + Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] next-intl設定
- [ ] i18next設定（API）
- [ ] 翻訳ファイル構造
- [ ] 言語切り替えUI
- [ ] 日本語・英語翻訳

##### ファイル

- `apps/web/i18n.ts`
- `apps/web/locales/ja/*.json`
- `apps/web/locales/en/*.json`
- `apps/api/src/i18n/i18n.module.ts`

---

#### 5.1.2 多言語コンテンツ

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] UI文言翻訳
- [ ] シナリオ多言語対応
- [ ] レポートテンプレート多言語化
- [ ] メール通知多言語化

---

### 5.2 ATS連携（1週間）

#### 5.2.1 ATSアダプター実装

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能（各ATS独立）

##### タスク

- [ ] ATSアダプターインターフェース
- [ ] Greenhouseアダプター
- [ ] Leverアダプター
- [ ] Workdayアダプター
- [ ] 国内ATS 3社アダプター

##### ファイル

- `packages/shared/src/ats/ats-adapter.interface.ts`
- `packages/shared/src/ats/greenhouse-adapter.ts`
- `packages/shared/src/ats/lever-adapter.ts`
- `apps/api/src/ats/ats-manager.service.ts`

---

#### 5.2.2 ATS管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

##### タスク

- [ ] ATS連携設定画面
- [ ] フィールドマッピングUI
- [ ] 同期ログ表示
- [ ] 接続テスト機能

##### ファイル

- `apps/web/app/[locale]/admin/ats/page.tsx`
- `apps/web/components/admin/AtsConfig.tsx`

---

### 5.3 プラグインシステム（1週間）

#### 5.3.1 プラグインSDK

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐⭐（非常に高）
**並行開発**: 可能

##### タスク

- [ ] プラグインSDK設計
- [ ] マニフェスト仕様
- [ ] エクステンションポイント
- [ ] サンドボックス実行
- [ ] プラグインマネージャー

##### ファイル

- `packages/plugins/src/plugin.interface.ts`
- `packages/plugins/src/plugin-context.ts`
- `apps/api/src/plugins/plugin-manager.service.ts`

---

#### 5.3.2 公式プラグイン開発

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能（各プラグイン独立）

##### タスク

- [ ] Greenhouseプラグイン
- [ ] HRMOS採用プラグイン
- [ ] ジョブカンプラグイン

##### ファイル

- `plugins/greenhouse/plugin.yaml`
- `plugins/greenhouse/src/index.ts`

---

## Phase 6: 最適化・スケール（3週間）

**目標**: パフォーマンス最適化、コスト削減、監視強化

### 6.1 パフォーマンス最適化（1週間）

#### タスク

- [ ] Lambda最適化（メモリ・タイムアウト調整）
- [ ] Provisioned Concurrency設定
- [ ] DynamoDB オンデマンド → プロビジョンド移行判断
- [ ] CloudFront キャッシュ戦略最適化
- [ ] 画像最適化（WebP、AVIF）

---

### 6.2 監視・アラート（1週間）

#### タスク

- [ ] CloudWatch Dashboards作成
- [ ] カスタムメトリクス追加
- [ ] アラート設定（Error Rate、Latency、Cost）
- [ ] X-Ray トレース分析
- [ ] ログ集約・分析（CloudWatch Logs Insights）

---

### 6.3 コスト最適化（1週間）

#### タスク

- [ ] Cost Explorer分析
- [ ] S3 ライフサイクルポリシー設定
- [ ] Aurora Serverless v2スケール調整
- [ ] Lambda メモリ最適化
- [ ] CloudFront レート調整

---

## チーム構成推奨

### 小規模チーム（4-6名）

```
Frontend Team (2名):
  - Engineer A: 認証UI、アバター表示、セッション画面
  - Engineer B: プレイヤー、管理画面、レポートUI

Backend Team (2名):
  - Engineer C: 認証、API、WebSocket
  - Engineer D: 音声、解析、ワーカー

DevOps (1名):
  - インフラ、CI/CD、監視

AI/ML Engineer (1名):
  - AI統合、プロンプト最適化、解析
```

### 大規模チーム（8-12名）

```
Frontend Team (4名):
  - UI Engineer A: 認証、ダッシュボード
  - UI Engineer B: セッション画面、アバター
  - UI Engineer C: 管理画面、レポート
  - UI Engineer D: プレイヤー、ベンチマーク

Backend Team (4名):
  - API Engineer A: 認証、ユーザー管理
  - API Engineer B: セッション、WebSocket
  - API Engineer C: 解析、レポート
  - API Engineer D: 外部連携、プラグイン

Infrastructure Team (2名):
  - DevOps Engineer: AWS CDK、CI/CD
  - SRE: 監視、パフォーマンス最適化

AI/ML Team (2名):
  - AI Engineer A: 会話AI、プロンプト
  - AI Engineer B: 解析、ベンチマーク
```

---

## 実装スケジュール

### ガントチャート（概要）

```
Phase 0: 基盤構築                    [====]                             (2週間) ✅ 完了
Phase 1: MVP - コア会話機能              [==============]                (6週間)
Phase 2: AI管理・アバター拡充                     [==========]         (5週間)
Phase 3: 解析・レポート                                  [==========]  (5週間)
Phase 4: SaaS完成・Enterprise対応                           [============] (6週間)
Phase 5: 拡張機能・多言語                                         [========] (4週間)
Phase 6: 最適化・スケール                                              [======] (3週間)
────────────────────────────────────────────────────────────────
           2週   4週   6週   8週  10週  12週  14週  16週  18週  20週  22週  24週  26週
```

### マイルストーン

| マイルストーン   | 期間    | 目標             | 成果物                         |
| ---------------- | ------- | ---------------- | ------------------------------ |
| **Phase 0 完了** | Week 2  | インフラ基盤確立 | AWS環境、Prismaスキーマ、CI/CD |
| **Phase 1 完了** | Week 8  | MVP動作          | 基本会話セッション実行可能     |
| **Phase 2 完了** | Week 13 | AI管理・アバター | プロンプト管理、2D/3Dアバター  |
| **Phase 3 完了** | Week 18 | 解析・レポート   | 感情解析、レポート生成         |
| **Phase 4 完了** | Week 24 | SaaS完成         | マルチテナント、課金、API      |
| **Phase 5 完了** | Week 28 | 拡張機能         | 多言語、ATS連携、プラグイン    |
| **Phase 6 完了** | Week 31 | 最適化           | パフォーマンス改善、監視強化   |

---

## 並行開発の最適化

### Phase 1 並行開発例

```
Week 1-2: 認証・基盤
  - Frontend A: 認証UI (1.1.2) ⭐
  - Frontend B: アバター表示準備 (1.2.1) ⭐⭐⭐
  - Backend C: 認証API (1.1.1) ⭐⭐
  - Backend D: TTS統合 (1.3.1) ⭐⭐
  - AI Engineer: Claude統合 (1.4.2) ⭐⭐

Week 3-4: アバター・音声
  - Frontend A: セッション画面レイアウト (1.5.3) ⭐⭐⭐
  - Frontend B: アバター表示完成 (1.2.1) ⭐⭐⭐
  - Backend C: WebSocket基盤 (1.5.1) ⭐⭐⭐
  - Backend D: STT統合 (1.3.2) ⭐⭐
  - AI Engineer: シナリオエンジン (1.4.1) ⭐

Week 5-6: 統合・テスト
  - Frontend A+B: セッション統合 (1.5.3) ⭐⭐⭐
  - Backend C+D: WebSocket完成 (1.5.1) ⭐⭐⭐
  - 全員: 統合テスト、バグ修正
```

---

## リスク管理

### 高リスクタスク

1. **WebSocket通信** (1.5.1) - 複雑度高、テスト困難
   - **緩和策**: 早期プロトタイプ、段階的実装、モック使用

2. **画像からアバター生成** (2.3.2) - 技術的不確実性
   - **緩和策**: PoC優先、代替案準備（プリセットのみ）

3. **プラグインシステム** (5.3.1) - アーキテクチャ複雑
   - **緩和策**: シンプルな設計から開始、段階的拡張

4. **ATS連携** (5.2) - 外部API依存
   - **緩和策**: モックAPI使用、早期連携テスト

---

## 実装完了の定義（Definition of Done）

各タスク完了時の基準:

- [ ] コード実装完了
- [ ] 単体テスト作成・合格
- [ ] 統合テスト実行
- [ ] TypeScript型エラーなし
- [ ] ESLint警告なし
- [ ] ドキュメント更新
- [ ] PRレビュー承認
- [ ] ステージング環境デプロイ確認

---

## 進捗トラッキング

### 推奨ツール

- **プロジェクト管理**: GitHub Projects
- **タスク管理**: GitHub Issues
- **ドキュメント**: GitHub Wiki / Notion
- **コミュニケーション**: Slack

### 進捗報告

**週次**:

- 完了タスク
- 進行中タスク
- ブロッカー
- 次週計画

**マイルストーン**:

- Phase完了時にデモ
- ステークホルダーレビュー
- Go/No-Go判断

---

**最終更新**: 2026-03-05
**次回レビュー**: Phase 1 完了時
