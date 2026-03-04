# 実装プラン

実装容易度と依存関係を考慮した段階的な開発計画。各フェーズは並行開発可能なタスクに分解されています。

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

---

## Phase 0: 基盤構築（2週間）

**目標**: 開発環境とインフラ基盤の確立

### 0.1 プロジェクトセットアップ（3日）

**担当**: DevOps Engineer
**実装容易度**: ⭐⭐（中）

```bash
# タスク
- [ ] MonorepoセットアップQuerst（Turborepo）
- [ ] TypeScript設定（strict mode）
- [ ] ESLint + Prettier設定
- [ ] Git hooks（Husky + lint-staged）
- [ ] VS Code推奨設定
```

**成果物**:
- `package.json` (root)
- `turbo.json`
- `.eslintrc.js`
- `.prettierrc`
- `.husky/`

**Claude Codeプロンプト例**:
```
MonorepoをTurborepoでセットアップしてください。
apps/web（Next.js 15）、apps/api（NestJS）、packages/shared を作成。
TypeScript strict mode、ESLint、Prettierを設定。
```

---

### 0.2 AWS CDK基盤（5日）

**担当**: DevOps Engineer
**実装容易度**: ⭐⭐⭐（高）
**依存関係**: なし

```bash
# タスク
- [ ] CDKプロジェクト初期化
- [ ] VPC・ネットワーク設定
- [ ] Aurora Serverless v2クラスター
- [ ] DynamoDBテーブル
- [ ] S3バケット（録画・アバター・レポート）
- [ ] CloudFront distributions
- [ ] Cognito User Pool
- [ ] API Gateway（REST/WebSocket）
- [ ] Lambda Layer（共通ライブラリ）
```

**成果物**:
- `infrastructure/lib/network-stack.ts`
- `infrastructure/lib/database-stack.ts`
- `infrastructure/lib/storage-stack.ts`
- `infrastructure/lib/api-stack.ts`
- `infrastructure/lib/auth-stack.ts`

**Claude Codeプロンプト例**:
```
AWS CDKでNetworkStackを実装してください。
- VPC（2 AZ、public/privateサブネット）
- Security Groups（Aurora用、Lambda用）
- VPC Endpoints（S3、DynamoDB）
TypeScriptで、環境変数で設定変更可能に。
```

---

### 0.3 Prismaスキーマ設計（3日）

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**依存関係**: 0.2（Aurora）

```bash
# タスク
- [ ] Prismaプロジェクト初期化
- [ ] スキーマ定義（全テーブル）
- [ ] マイグレーションファイル作成
- [ ] Prisma Client生成
- [ ] Seed データ作成
```

**成果物**:
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/`
- `packages/database/prisma/seed.ts`

**Claude Codeプロンプト例**:
```
Prismaスキーマを作成してください。
以下のテーブルを含む:
- organizations, users, avatars, voices, scenarios
- sessions, recordings, transcripts
- plans, subscriptions
CLAUDE.mdのデータベース設計を参照。
```

---

### 0.4 CI/CDパイプライン（3日）

**担当**: DevOps Engineer
**実装容易度**: ⭐⭐（中）
**依存関係**: 0.1, 0.2

```bash
# タスク
- [ ] GitHub Actions ワークフロー
  - [ ] PR: Lint + Test
  - [ ] main: ステージング自動デプロイ
  - [ ] tag: プロダクションデプロイ
- [ ] デプロイスクリプト（ワンクリック）
- [ ] 環境変数管理（AWS Secrets Manager）
```

**成果物**:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `scripts/deploy.sh`

**Claude Codeプロンプト例**:
```
GitHub Actions CIワークフローを作成してください。
PR時: Lint、TypeScriptチェック、テスト実行
main push時: ステージング環境へ自動デプロイ
AWS CDK deployを使用。
```

---

## Phase 1: MVP - コア会話機能（6週間）

**目標**: AIアバターとの基本的な会話セッションが動作

### 1.1 認証・ユーザー管理（1週間）

#### 1.1.1 Cognito認証統合

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] Amplify Auth設定
- [ ] サインアップ/ログインAPI
- [ ] JWT検証ミドルウェア
- [ ] Cognito Trigger（PreSignUp, PostConfirmation）
- [ ] ユーザープロフィールCRUD API
```

**ファイル**:
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/users/users.module.ts`

**Claude Codeプロンプト例**:
```
NestJSでCognito認証モジュールを実装してください。
- PassportJSでJWT戦略
- CognitoのJWK検証
- デコレータ @CurrentUser()
- ガード @UseGuards(JwtAuthGuard)
```

---

#### 1.1.2 フロントエンド認証UI

**担当**: Frontend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

```bash
# タスク
- [ ] ログイン画面
- [ ] サインアップ画面
- [ ] パスワードリセット
- [ ] MFA設定（オプション）
- [ ] 認証状態管理（Zustand）
```

**ファイル**:
- `apps/web/app/[locale]/(auth)/login/page.tsx`
- `apps/web/app/[locale]/(auth)/signup/page.tsx`
- `apps/web/lib/auth/auth-store.ts`
- `apps/web/lib/auth/auth-api.ts`

**Claude Codeプロンプト例**:
```
Next.js 15でログインページを作成してください。
- shadcn/ui使用
- Amplify Authライブラリ統合
- フォームバリデーション（Zod + React Hook Form）
- エラーハンドリング
```

---

### 1.2 アバター表示（1週間）

#### 1.2.1 3Dアバター（Ready Player Me）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

```bash
# タスク
- [ ] Three.js + React Three Fiberセットアップ
- [ ] Ready Player Me GLBモデル読み込み
- [ ] ARKit Blendshapes実装
- [ ] リップシンク（Viseme → Blendshape）
- [ ] カメラ・ライティング設定
```

**ファイル**:
- `apps/web/components/avatar/ThreeAvatar.tsx`
- `apps/web/lib/avatar/rpm-loader.ts`
- `apps/web/lib/avatar/lipsync.ts`

**Claude Codeプロンプト例**:
```
React Three FiberでReady Player Meアバターを表示してください。
- GLBローダー
- ARKit 52 Blendshapes制御
- Visemeデータから口パクアニメーション
- TypeScriptで型安全に
```

---

#### 1.2.2 アバター管理API

**担当**: Backend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

```bash
# タスク
- [ ] アバターCRUD API
- [ ] S3アップロード（署名付きURL）
- [ ] RPM Photo Capture API統合
- [ ] プリセットアバター管理
```

**ファイル**:
- `apps/api/src/avatars/avatars.module.ts`
- `apps/api/src/avatars/avatars.service.ts`
- `apps/api/src/avatars/avatars.controller.ts`

---

### 1.3 音声システム（1.5週間）

#### 1.3.1 TTS統合（ElevenLabs）

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] ElevenLabs APIクライアント
- [ ] テキスト→音声変換
- [ ] Visemeデータ抽出
- [ ] ストリーミング対応
- [ ] Lambda関数実装
```

**ファイル**:
- `apps/api/src/voice/tts/elevenlabs.service.ts`
- `apps/api/src/voice/tts/tts.interface.ts`
- `apps/workers/src/functions/tts-worker.ts`

**Claude Codeプロンプト例**:
```
ElevenLabsのTTSサービスクラスを実装してください。
- text-to-speechエンドポイント呼び出し
- ストリーミングレスポンス対応
- Alignment データからViseme抽出
- エラーハンドリング、リトライロジック
```

---

#### 1.3.2 STT統合（Azure Speech）

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] Azure Speech SDKセットアップ
- [ ] リアルタイムストリーミング認識
- [ ] WebSocket経由で音声受信
- [ ] 字幕データ配信
```

**ファイル**:
- `apps/api/src/voice/stt/azure-speech.service.ts`
- `apps/api/src/websocket/audio-handler.ts`

---

### 1.4 シナリオエンジン（1週間）

#### 1.4.1 シナリオCRUD

**担当**: Backend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

```bash
# タスク
- [ ] シナリオCRUD API
- [ ] シナリオバリデーション（Zod）
- [ ] システムプロンプト生成ロジック
- [ ] シナリオ共有機能
```

**ファイル**:
- `apps/api/src/scenarios/scenarios.module.ts`
- `apps/api/src/scenarios/scenarios.service.ts`
- `apps/api/src/scenarios/dto/create-scenario.dto.ts`

---

#### 1.4.2 会話AI統合（Claude）

**担当**: Backend/AI Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] Claude APIクライアント
- [ ] 会話履歴管理（DynamoDB）
- [ ] システムプロンプト構築
- [ ] ストリーミングレスポンス
```

**ファイル**:
- `apps/api/src/conversation/claude.service.ts`
- `apps/api/src/conversation/conversation.service.ts`
- `apps/api/src/conversation/conversation-context.ts`

**Claude Codeプロンプト例**:
```
Claude APIの会話サービスを実装してください。
- Anthropic SDK使用
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

```bash
# タスク
- [ ] IoT Core WebSocketセットアップ
- [ ] 接続管理Lambda
- [ ] メッセージルーティング
- [ ] セッション状態管理（DynamoDB）
```

**ファイル**:
- `apps/api/src/websocket/websocket.gateway.ts`
- `apps/api/src/websocket/connection.service.ts`
- `apps/api/src/websocket/message-handler.ts`

---

#### 1.5.2 録画システム

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] MediaRecorder API統合
- [ ] ユーザーカメラ録画
- [ ] アバターCanvas録画
- [ ] S3アップロード（署名付きURL）
- [ ] 録画プレビュー
```

**ファイル**:
- `apps/web/components/session/RecordingManager.tsx`
- `apps/web/lib/recording/media-recorder.ts`
- `apps/web/lib/recording/upload.ts`

---

#### 1.5.3 セッション画面（3要素統合UI）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 依存あり（1.2, 1.3完了後）

```bash
# タスク
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
```

**ファイル**:
- `apps/web/app/[locale]/session/[id]/page.tsx`
- `apps/web/components/session/SessionPlayer.tsx`
- `apps/web/components/session/UserCameraView.tsx`
- `apps/web/components/session/AvatarView.tsx`
- `apps/web/components/session/RealtimeTranscript.tsx`
- `apps/web/components/session/AudioController.tsx`
- `apps/web/hooks/useRealtimeSession.ts`
- `apps/web/hooks/useRealtimeTranscription.ts`
- `apps/web/styles/transcript.css`

**Claude Codeプロンプト例**:
```
セッション実行画面を実装してください。3要素統合UI:
1. ユーザーカメラ映像（getUserMedia、右側表示）
2. AIアバター映像（Three.js、左側表示、リップシンク）
3. リアルタイム文字起こし（Azure STT、下部表示）

要件:
- Azure STTのストリーミング認識（recognizing/recognized イベント）
- 認識中テキスト（グレー、💭認識中）と確定テキストの区別
- 話者別色分け（AI: 青背景、USER: 緑背景）
- タイムスタンプ付き表示、自動スクロール
- ユーザーカメラ + アバターCanvas の同時録画（MediaRecorder）
```

---

### 1.6 基本トランスクリプト・再生（1週間）

#### 1.6.1 トランスクリプトAPI

**担当**: Backend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

```bash
# タスク
- [ ] トランスクリプトCRUD API
- [ ] Whisper API統合（再トランスクリプト）
- [ ] タイムスタンプ管理
```

**ファイル**:
- `apps/api/src/transcripts/transcripts.module.ts`
- `apps/api/src/transcripts/transcripts.service.ts`

---

#### 1.6.2 録画再生プレイヤー

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] Video.jsセットアップ
- [ ] サイドバイサイド表示
- [ ] 再生コントロール
- [ ] トランスクリプト同期表示（基本版）
```

**ファイル**:
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

```bash
# タスク
- [ ] プロンプトテンプレートCRUD
- [ ] バージョン管理
- [ ] 変数システム実装
- [ ] テスト実行API
```

**ファイル**:
- `apps/api/src/prompts/prompt-templates.module.ts`
- `apps/api/src/prompts/prompt-templates.service.ts`
- `apps/api/src/prompts/version.service.ts`
- `apps/api/src/prompts/variable.service.ts`

---

#### 2.1.2 プロンプト管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 依存あり（2.1.1完了後）

```bash
# タスク
- [ ] プロンプト編集画面
- [ ] 変数マッピングUI
- [ ] リアルタイムプレビュー
- [ ] バージョン履歴表示
- [ ] エクスポート/インポート
```

**ファイル**:
- `apps/web/app/[locale]/admin/prompts/page.tsx`
- `apps/web/components/admin/PromptEditor.tsx`
- `apps/web/components/admin/VariableMapper.tsx`

---

### 2.2 AIプロバイダ管理（1週間）

#### 2.2.1 プロバイダ抽象化レイヤー

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

```bash
# タスク
- [ ] プロバイダインターフェース定義
- [ ] Claude, GPT-4, Geminiアダプター
- [ ] プロバイダ切り替えロジック
- [ ] フォールバック実装
- [ ] 使用量トラッキング
```

**ファイル**:
- `packages/shared/src/providers/ai-provider.interface.ts`
- `packages/shared/src/providers/claude-adapter.ts`
- `packages/shared/src/providers/openai-adapter.ts`
- `apps/api/src/providers/provider-manager.service.ts`

**Claude Codeプロンプト例**:
```
AIプロバイダの抽象化レイヤーを実装してください。
AIProviderインターフェース定義:
- generateResponse()
- streamResponse()
- estimateCost()

ClaudeAdapter, OpenAIAdapter実装。
プロバイダ切り替えとフォールバックロジック。
```

---

#### 2.2.2 プロバイダ管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] プロバイダ設定画面
- [ ] 接続テスト機能
- [ ] 使用量ダッシュボード
- [ ] コスト管理UI
```

**ファイル**:
- `apps/web/app/[locale]/admin/providers/page.tsx`
- `apps/web/components/admin/ProviderConfig.tsx`
- `apps/web/components/admin/UsageDashboard.tsx`

---

### 2.3 アバターカスタマイズ（2週間）

#### 2.3.1 2Dアバター（Live2D）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐⭐⭐（非常に高）
**並行開発**: 可能

```bash
# タスク
- [ ] Live2D Cubism SDKセットアップ
- [ ] モデル読み込み
- [ ] パラメータ制御
- [ ] リップシンク
```

**ファイル**:
- `apps/web/components/avatar/Live2DAvatar.tsx`
- `apps/web/lib/avatar/live2d-loader.ts`

---

#### 2.3.2 画像からアバター生成

**担当**: Backend Engineer + AI Engineer
**実装容易度**: ⭐⭐⭐⭐（非常に高）
**並行開発**: 可能

```bash
# タスク
- [ ] AnimeGANv2統合（Lambda Container）
- [ ] RPM Photo Capture API統合
- [ ] 顔検出（MediaPipe）
- [ ] 背景除去（Remove.bg）
- [ ] 生成パイプライン
```

**ファイル**:
- `apps/workers/src/functions/avatar-generator.ts`
- `apps/api/src/avatars/generation.service.ts`

---

#### 2.3.3 アバター選択UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] アバターライブラリ表示
- [ ] フィルタリング機能
- [ ] プレビュー機能
- [ ] カスタムアバター作成フロー
```

**ファイル**:
- `apps/web/components/avatar/AvatarSelector.tsx`
- `apps/web/components/avatar/AvatarPreview.tsx`
- `apps/web/components/avatar/CustomAvatarWizard.tsx`

---

## Phase 3: 解析・レポート（5週間）

### 3.1 非同期処理基盤（1.5週間）

#### 3.1.1 Step Functionsワークフロー

**担当**: DevOps + Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 一部可能

```bash
# タスク
- [ ] CDKでStep Functions定義
- [ ] ワークフローステート定義
- [ ] エラーハンドリング・リトライ
- [ ] DLQ設定
```

**ファイル**:
- `infrastructure/lib/workflow-stack.ts`
- `apps/workers/src/workflows/session-processing.asl.json`

---

#### 3.1.2 MediaConvert動画合成

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] MediaConvertジョブ設定
- [ ] サイドバイサイドレイアウト
- [ ] Lambda トリガー実装
```

**ファイル**:
- `apps/workers/src/functions/video-composer.ts`
- `apps/api/src/media/mediaconvert.service.ts`

---

### 3.2 感情・音声解析（1.5週間）

#### 3.2.1 Azure Face API統合

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] Azure Face APIクライアント
- [ ] フレーム抽出（FFmpeg）
- [ ] バッチ処理
- [ ] 感情データ保存
```

**ファイル**:
- `apps/workers/src/functions/emotion-analyzer.ts`
- `apps/api/src/analysis/azure-face.service.ts`

---

#### 3.2.2 音声解析

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] Azure Speech Analytics統合
- [ ] WPM計算
- [ ] ピッチ分析
- [ ] フィラーワード検出
```

**ファイル**:
- `apps/workers/src/functions/audio-analyzer.ts`
- `apps/api/src/analysis/audio-analysis.service.ts`

---

### 3.3 レポート生成（2週間）

#### 3.3.1 レポート生成API

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

```bash
# タスク
- [ ] Claude APIでフィードバック生成
- [ ] スコア計算ロジック
- [ ] ハイライト抽出
- [ ] レポートテンプレート処理
```

**ファイル**:
- `apps/workers/src/functions/report-generator.ts`
- `apps/api/src/reports/reports.service.ts`
- `apps/api/src/reports/scoring.service.ts`

---

#### 3.3.2 PDF生成

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] Puppeteer Lambda Layer
- [ ] HTMLテンプレート
- [ ] PDF生成
- [ ] S3保存
```

**ファイル**:
- `apps/workers/src/functions/pdf-generator.ts`
- `apps/api/src/reports/templates/default-template.html`

---

#### 3.3.3 レポートUI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] レポート表示画面
- [ ] 感情グラフ（Recharts）
- [ ] ハイライトセクション
- [ ] PDF ダウンロード
```

**ファイル**:
- `apps/web/app/[locale]/reports/[id]/page.tsx`
- `apps/web/components/reports/ReportView.tsx`
- `apps/web/components/reports/EmotionChart.tsx`

---

### 3.4 トランスクリプト同期プレイヤー完成版（1週間）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] トランスクリプト ↔ 動画同期
- [ ] クリック可能なトランスクリプト
- [ ] ハイライト表示
- [ ] スクロール同期
```

**ファイル**:
- `apps/web/components/player/SyncedTranscript.tsx`
- `apps/web/lib/player/sync-manager.ts`

---

## Phase 4: SaaS完成・Enterprise対応（6週間）

### 4.1 マルチテナント・課金（2週間）

#### 4.1.1 プラン管理システム

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] プランCRUD API
- [ ] サブスクリプション管理
- [ ] クォータ管理
- [ ] 使用量監視
- [ ] Stripe統合準備
```

**ファイル**:
- `apps/api/src/billing/plans.module.ts`
- `apps/api/src/billing/plans.service.ts`
- `apps/api/src/billing/subscriptions.service.ts`
- `apps/api/src/billing/quota.service.ts`

---

#### 4.1.2 プラン管理UI（スーパー管理者）

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] プラン設定画面
- [ ] クォータ設定UI
- [ ] 価格設定
- [ ] プラン比較ページ
```

**ファイル**:
- `apps/web/app/[locale]/super-admin/plans/page.tsx`
- `apps/web/components/super-admin/PlanEditor.tsx`

---

#### 4.1.3 管理者ダッシュボード

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] 組織分析ダッシュボード
- [ ] ユーザー管理
- [ ] セッション統計
- [ ] コストダッシュボード
```

**ファイル**:
- `apps/web/app/[locale]/admin/dashboard/page.tsx`
- `apps/web/components/admin/Analytics.tsx`

---

### 4.2 ベンチマーク（1.5週間）

#### 4.2.1 ベンチマーク計算

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

```bash
# タスク
- [ ] プロファイル算出ロジック
- [ ] パーセンタイル計算
- [ ] クラスタリング（K-means）
- [ ] 日次バッチ処理
- [ ] DynamoDBキャッシュ
```

**ファイル**:
- `apps/workers/src/functions/benchmark-aggregator.ts`
- `apps/api/src/benchmark/benchmark.service.ts`
- `apps/api/src/benchmark/clustering.service.ts`

---

#### 4.2.2 ベンチマークUI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] プロファイル表示
- [ ] ベンチマーク比較
- [ ] 成長グラフ
- [ ] 改善提案表示
```

**ファイル**:
- `apps/web/app/[locale]/profile/benchmark/page.tsx`
- `apps/web/components/profile/BenchmarkView.tsx`
- `apps/web/components/profile/GrowthChart.tsx`

---

### 4.3 外部連携API（1.5週間）

#### 4.3.1 APIキー管理

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] APIキーCRUD
- [ ] キー生成・ハッシュ化
- [ ] スコープ管理
- [ ] レート制限（Redis）
- [ ] 使用量トラッキング
```

**ファイル**:
- `apps/api/src/api-keys/api-keys.module.ts`
- `apps/api/src/api-keys/api-keys.service.ts`
- `apps/api/src/api-keys/rate-limiter.service.ts`

---

#### 4.3.2 APIキー管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐（低）
**並行開発**: 可能

```bash
# タスク
- [ ] APIキー一覧
- [ ] キー作成フォーム
- [ ] 使用状況ダッシュボード
- [ ] ドキュメント表示
```

**ファイル**:
- `apps/web/app/[locale]/admin/api-keys/page.tsx`
- `apps/web/components/admin/ApiKeyManager.tsx`

---

### 4.4 セキュリティ・SSO（1週間）

#### 4.4.1 SAML SSO統合

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能

```bash
# タスク
- [ ] Cognito SAML設定
- [ ] IdPメタデータ処理
- [ ] 属性マッピング
```

**ファイル**:
- `infrastructure/lib/auth-stack.ts` (更新)
- `apps/api/src/auth/saml.service.ts`

---

## Phase 5: 拡張機能・多言語（4週間）

### 5.1 多言語対応（2週間）

#### 5.1.1 i18nセットアップ

**担当**: Frontend + Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] next-intl設定
- [ ] i18next設定（API）
- [ ] 翻訳ファイル構造
- [ ] 言語切り替えUI
- [ ] 日本語・英語翻訳
```

**ファイル**:
- `apps/web/i18n.ts`
- `apps/web/locales/ja/*.json`
- `apps/web/locales/en/*.json`
- `apps/api/src/i18n/i18n.module.ts`

**Claude Codeプロンプト例**:
```
Next.js 15でnext-intlをセットアップしてください。
- App Router対応
- locales/ja/, locales/en/に翻訳ファイル
- 言語切り替えミドルウェア
- useTranslations()フック使用例
```

---

#### 5.1.2 多言語コンテンツ

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] UI文言翻訳
- [ ] シナリオ多言語対応
- [ ] レポートテンプレート多言語化
- [ ] メール通知多言語化
```

---

### 5.2 ATS連携（1週間）

#### 5.2.1 ATSアダプター実装

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐（高）
**並行開発**: 可能（各ATS独立）

```bash
# タスク
- [ ] ATSアダプターインターフェース
- [ ] Greenhouseアダプター
- [ ] Leverアダプター
- [ ] Workdayアダプター
- [ ] 国内ATS 3社アダプター
```

**ファイル**:
- `packages/shared/src/ats/ats-adapter.interface.ts`
- `packages/shared/src/ats/greenhouse-adapter.ts`
- `packages/shared/src/ats/lever-adapter.ts`
- `apps/api/src/ats/ats-manager.service.ts`

**Claude Codeプロンプト例**:
```
ATSAdapterインターフェースを定義してください。
- getCandidates()
- getCandidate(id)
- createScorecard(data)
- addAttachment(file)
- handleWebhook(payload)

Greenhouseアダプターを実装。OAuth2認証、API呼び出し。
```

---

#### 5.2.2 ATS管理UI

**担当**: Frontend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能

```bash
# タスク
- [ ] ATS連携設定画面
- [ ] フィールドマッピングUI
- [ ] 同期ログ表示
- [ ] 接続テスト機能
```

**ファイル**:
- `apps/web/app/[locale]/admin/ats/page.tsx`
- `apps/web/components/admin/AtsConfig.tsx`

---

### 5.3 プラグインシステム（1週間）

#### 5.3.1 プラグインSDK

**担当**: Backend Engineer
**実装容易度**: ⭐⭐⭐⭐（非常に高）
**並行開発**: 可能

```bash
# タスク
- [ ] プラグインSDK設計
- [ ] マニフェスト仕様
- [ ] エクステンションポイント
- [ ] サンドボックス実行
- [ ] プラグインマネージャー
```

**ファイル**:
- `packages/plugins/src/plugin.interface.ts`
- `packages/plugins/src/plugin-context.ts`
- `apps/api/src/plugins/plugin-manager.service.ts`
- `apps/api/src/plugins/plugin-sandbox.service.ts`

---

#### 5.3.2 公式プラグイン開発

**担当**: Backend Engineer
**実装容易度**: ⭐⭐（中）
**並行開発**: 可能（各プラグイン独立）

```bash
# タスク
- [ ] Greenhouseプラグイン
- [ ] HRMOS採用プラグイン
- [ ] ジョブカンプラグイン
```

**ファイル**:
- `plugins/greenhouse/plugin.yaml`
- `plugins/greenhouse/src/index.ts`

---

---

## 並行開発の最適化

### チーム構成と担当フェーズ

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

### 並行開発可能なタスク

**Phase 1 並行開発例**:
- Frontend A: 認証UI (1.1.2)
- Frontend B: アバター表示 (1.2.1)
- Backend C: 認証API (1.1.1)
- Backend D: TTS統合 (1.3.1)
- DevOps: CDK継続改善
- AI Engineer: Claude統合 (1.4.2)

---

## ワンクリックデプロイ

### スクリプト使用方法

```bash
# ステージング環境デプロイ
./scripts/deploy.sh staging

# プロダクション環境デプロイ
./scripts/deploy.sh production

# 特定スタックのみデプロイ
./scripts/deploy.sh staging --stack DatabaseStack

# ロールバック
./scripts/rollback.sh production v1.2.3
```

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

## リスク管理

### 高リスクタスク

1. **WebSocket通信** (1.5.1) - 複雑度高、テスト困難
   - 緩和策: 早期プロトタイプ、段階的実装

2. **画像からアバター生成** (2.3.2) - 技術的不確実性
   - 緩和策: PoC優先、代替案準備

3. **プラグインシステム** (5.3.1) - アーキテクチャ複雑
   - 緩和策: シンプルな設計から開始、段階的拡張

4. **ATS連携** (5.2) - 外部API依存
   - 緩和策: モックAPI使用、早期連携テスト

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

次のステップ: [プロジェクト構造](PROJECT_STRUCTURE.md) → [開発ガイド](DEVELOPMENT_GUIDE.md)
