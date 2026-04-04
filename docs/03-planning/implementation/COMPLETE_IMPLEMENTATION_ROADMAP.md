# 完全実装ロードマップ - Prance Communication Platform

**作成日:** 2026-03-09
**バージョン:** 2.1（Phase 1.5-1.6追加）
**ステータス:** 最新版・全機能包括

---

## 🔴 CRITICAL WARNING - 最優先対応事項

### Phase 1が実用レベルでない問題

**Phase 1の重大な問題:**

- ❌ **Phase 1の音声会話は技術的に動作しますが、実用レベルではありません**
- ❌ **ユーザーが話した後、セッション終了まで文字起こし・AI応答が返ってきません（バッチ処理）**
- ❌ **リアルタイム会話が実現できていません**

**最優先対応: Phase 1.5-1.6（Week 0.5-3.5）**

Phase 2以降を実装する前に、Phase 1.5-1.6を完了してください。

**詳細ドキュメント:**
→ [`PRODUCTION_READY_ROADMAP.md`](./PRODUCTION_READY_ROADMAP.md)

**このドキュメント内の週数:**
- このドキュメントの Week 数は Phase 1.5-1.6 完了後の週数です
- 実際の Week 数 = 記載された Week + 2週間

---


## エグゼクティブサマリー

### 重要な発見

全17モジュールドキュメントを精査した結果、**8つの主要機能が実装計画から完全に抜けている**ことが判明しました：

1. カスタムアバター生成（画像→2D/3Dアバター）
2. 音声クローニング（ユーザー音声の複製）
3. ノーコードシナリオビルダー（ビジュアル編集）
4. プラグインシステム（詳細実装）
5. 管理者UI設定（環境変数のUI化）
6. 非言語行動解析（アイコンタクト・姿勢・ジェスチャー）
7. 高度なトランスクリプトプレイヤー（ハイライト・検索）
8. カスタムレポートテンプレート（組織専用テンプレート）

### 改訂後のスケジュール

```
旧計画: 34週間（Phase 0-6）
新計画: 41週間（Phase 0-7）
追加: Phase 7（15週間）- 高度な機能拡張
```

---

## 目次

1. [Phase 7: 高度な機能拡張](#phase-7-高度な機能拡張)
   - [7.1: カスタムアバター生成 + 音声クローニング](#71-カスタムアバター生成--音声クローニング)
   - [7.2: ノーコードシナリオビルダー](#72-ノーコードシナリオビルダー)
   - [7.3: プラグインシステム](#73-プラグインシステム)
   - [7.4: 管理者UI設定](#74-管理者ui設定)
   - [7.5: 非言語行動解析](#75-非言語行動解析)
   - [7.6: 高度なトランスクリプトプレイヤー](#76-高度なトランスクリプトプレイヤー)
   - [7.7: カスタムレポートテンプレート](#77-カスタムレポートテンプレート)
2. [改訂された全体スケジュール](#改訂された全体スケジュール)
3. [リリースマイルストーン](#リリースマイルストーン)
4. [優先度マトリクス](#優先度マトリクス)

---

## Phase 7: 高度な機能拡張

**対象:** V2.5 Advanced Edition
**期間:** Week 27-41（15週間）
**目標:** Pro/Enterprise顧客向けの差別化機能を実装

---

### 7.1: カスタムアバター生成 + 音声クローニング

**期間:** Week 27-28（2週間）
**優先度:** P4
**対象:** Pro/Enterprise プラン

#### Week 27: カスタムアバター生成

**Day 1-2: 画像アップロード・前処理**

```typescript
// infrastructure/lambda/avatars/generate/upload/index.ts
// infrastructure/lambda/shared/avatar/validator.ts

タスク:
□ POST /api/v1/avatars/generate/upload 実装
  - multipart/form-data パース
  - 画像バリデーション
    - ファイルサイズ: 最大10MB
    - 形式: JPEG, PNG
    - 解像度: 最小512x512
  - S3アップロード（/avatars/generation/{userId}/{uuid}.jpg）

□ MediaPipe顔検出実装
  - Lambda Layer作成（MediaPipe）
  - 顔ランドマーク検出（468点）
  - 顔が1つのみ検出されることを確認
  - 顔が中央にあることを確認
  - バリデーション結果返却

□ エラーハンドリング
  - 顔が検出されない場合
  - 複数の顔が検出された場合
  - 顔が小さすぎる場合
```

**Day 3-4: 2Dアニメアバター生成**

```typescript
// infrastructure/lambda/avatars/generate/anime/index.ts

タスク:
□ AnimeGANv2 統合
  - SageMaker Endpoint作成
    - モデル: AnimeGANv2（事前学習済み）
    - インスタンス: ml.g4dn.xlarge
  - Lambda → SageMaker呼び出し
  - スタイル変換（写真→アニメ風）
  - 生成画像の保存（S3）

□ Live2D パラメータマッピング
  - MediaPipeランドマーク → Live2Dパラメータ
    - 目の開閉度
    - 口の開閉度
    - 眉の角度
    - 顔の向き（X, Y, Z回転）
  - パラメータファイル生成（.json）

□ Avatarレコード作成
  - Prisma: Avatar作成
    - type: TWO_D
    - source: USER_GENERATED
    - imageUrl: S3 URL
    - parametersUrl: パラメータファイルURL
    - status: PROCESSING → COMPLETED
```

**Day 5-6: 3Dリアルアバター生成**

```typescript
// infrastructure/lambda/avatars/generate/3d/index.ts

タスク:
□ Ready Player Me API統合
  - POST https://api.readyplayer.me/v1/avatars
  - Photo Capture API使用
  - アップロード画像送信
  - GLBファイル受信
  - S3保存

□ アバターカスタマイズ
  - 肌の色調整
  - 髪型選択（オプション）
  - 服装選択（ビジネススーツ、カジュアル等）

□ Avatarレコード作成
  - type: THREE_D
  - source: USER_GENERATED
  - modelUrl: GLB URL
  - status: PROCESSING → COMPLETED
```

**Day 7-9: フロントエンドUI**

```typescript
// apps/web/app/[locale]/avatars/generate/page.tsx
// apps/web/components/avatars/AvatarGenerator.tsx
// apps/web/components/avatars/AvatarPreview.tsx

タスク:
□ アバター生成画面実装
  - 画像アップロードUI
    - ドラッグ&ドロップ
    - プレビュー
    - クロップ機能
  - スタイル選択
    - 2Dアニメ / 3Dリアル
  - カスタマイズオプション
    - 髪型、服装、アクセサリー
  - "生成開始" ボタン

□ 生成進捗表示
  - WebSocketリアルタイム通知
  - プログレスバー
  - ステータスメッセージ
    - "画像解析中..."
    - "アバター生成中..."
    - "完成しました！"

□ プレビュー機能
  - 2Dアバター: Live2D Viewer
  - 3Dアバター: Three.js Viewer
  - リップシンクテスト
  - 表情テスト

□ ライブラリ保存
  - "保存" ボタン
  - 名前・説明入力
  - 可視性設定（Private/Organization）
```

**Day 10: テスト・デプロイ**

```typescript
タスク:
□ E2Eテスト
  - 2Dアバター生成フロー
  - 3Dアバター生成フロー
  - エラーケース（顔検出失敗等）

□ パフォーマンステスト
  - 生成時間測定
    - 目標: 2Dアニメ < 45秒
    - 目標: 3Dリアル < 60秒
  - SageMaker Endpoint負荷テスト
  - 並行生成（10ユーザー同時）

□ Lambda + SageMakerデプロイ
  - CDKスタック更新
  - SageMaker Endpoint作成
  - デプロイ確認
```

#### Week 28: 音声クローニング

**Day 11-12: 音声サンプル録音**

```typescript
// apps/web/app/[locale]/voices/clone/page.tsx
// apps/web/components/voices/VoiceRecorder.tsx

タスク:
□ 音声録音UI実装
  - MediaRecorder使用
  - 録音時間: 最低1分、推奨3分
  - リアルタイム波形表示
  - 録音プレビュー再生
  - "再録音" ボタン

□ 読み上げスクリプト表示
  - 音声品質向上のための原稿
  - 感情豊かなサンプル文
  - 日本語・英語両方

□ 音声アップロード
  - POST /api/v1/voices/clone/upload
  - WebM → WAV変換（ffmpeg）
  - S3保存
```

**Day 13-14: ElevenLabs Voice Cloning統合**

```typescript
// infrastructure/lambda/voices/clone/index.ts

タスク:
□ ElevenLabs API統合
  - POST /v1/voices/add
  - 音声サンプルファイル送信
  - VoiceID受信
  - 音声名・説明設定

□ クローン音声生成
  - 生成時間: 10-20分
  - Step Functions非同期処理
    1. 音声ファイル準備
    2. ElevenLabs API呼び出し
    3. ポーリング（完了待ち）
    4. VoiceID保存
  - WebSocket進捗通知

□ VoiceProfileレコード作成
  model VoiceProfile {
    id              String   @id @default(cuid())
    userId          String
    name            String
    elevenLabsVoiceId String @unique
    sampleUrl       String
    status          VoiceStatus
    createdAt       DateTime @default(now())
  }

  enum VoiceStatus {
    PROCESSING
    COMPLETED
    FAILED
  }
```

**Day 15: テスト音声合成**

```typescript
// infrastructure/lambda/voices/test/index.ts
// apps/web/components/voices/VoiceTest.tsx

タスク:
□ テスト音声生成API
  - POST /api/v1/voices/:id/test
  - テストテキスト送信
  - ElevenLabs TTS呼び出し
  - 音声ファイル返却

□ フロントエンドテストUI
  - テキスト入力
  - "音声を生成" ボタン
  - 音声再生プレイヤー
  - クオリティ評価（1-5星）

□ 音声プロファイルライブラリ
  - ユーザー作成音声リスト
  - 組織共有音声リスト
  - セッションで使用可能
```

**完了基準:**
- [ ] カスタムアバター生成機能が動作
- [ ] 2D/3D両方のアバター生成に成功
- [ ] 音声クローニング機能が動作
- [ ] 生成時間が目標内（アバター<60秒、音声<20分）
- [ ] E2Eテスト合格
- [ ] ドキュメント完成

---

### 7.2: ノーコードシナリオビルダー

**期間:** Week 29-31（3週間）
**優先度:** P4
**対象:** 全ユーザー

#### Week 29: ビジュアルエディター基盤

**Day 16-18: React Flow統合**

```typescript
// apps/web/components/scenarios/ScenarioBuilder.tsx
// apps/web/components/scenarios/nodes/*

タスク:
□ React Flow セットアップ
  - pnpm install reactflow
  - キャンバス実装
  - ズーム・パン機能
  - グリッド表示

□ ノードタイプ定義
  - StartNode: シナリオ開始
  - MessageNode: AIメッセージ
  - QuestionNode: 質問（ユーザー入力待ち）
  - BranchNode: 条件分岐
  - LoopNode: ループ処理
  - EndNode: シナリオ終了

□ エッジ（接続線）実装
  - ドラッグ&ドロップで接続
  - 条件ラベル表示
  - 削除機能
```

**Day 19-21: ノード編集UI**

```typescript
// apps/web/components/scenarios/NodeEditor.tsx

タスク:
□ MessageNode エディター
  - メッセージテキスト入力
  - 変数挿入（{{userName}}, {{position}}等）
  - 感情設定（neutral, happy, sad, angry）
  - 音声設定（VoiceProfile選択）

□ QuestionNode エディター
  - 質問テキスト入力
  - 期待される回答タイプ
    - 自由回答
    - 選択肢（複数選択可）
    - 数値入力
  - タイムアウト設定

□ BranchNode エディター
  - 条件式入力
    - {{userAnswer}} contains "はい"
    - {{score}} > 70
    - {{sessionTime}} > 300
  - 複数の分岐条件

□ LoopNode エディター
  - ループ条件
  - 最大ループ回数
```

#### Week 30: シナリオロジック実装

**Day 22-24: シナリオエンジン拡張**

```typescript
// infrastructure/lambda/shared/scenario/engine.ts

タスク:
□ ノードベース実行エンジン
  - ノードグラフの解析
  - 次のノード決定ロジック
  - 変数システム実装
    - {{userName}}: ユーザー名
    - {{position}}: ポジション
    - {{score}}: 現在スコア
    - {{sessionTime}}: 経過時間
    - カスタム変数

□ 条件分岐評価
  - 条件式パーサー
  - 演算子サポート
    - 比較: ==, !=, >, <, >=, <=
    - 論理: AND, OR, NOT
    - 文字列: contains, startsWith, endsWith
  - 安全な評価（サンドボックス）

□ ループ処理
  - ループカウンター
  - 無限ループ防止（最大10回）
  - Break条件
```

**Day 25-27: シナリオバリデーション**

```typescript
// infrastructure/lambda/scenarios/validate/index.ts

タスク:
□ シナリオグラフバリデーション
  - 開始ノードが1つのみ
  - すべてのノードが接続されている
  - 循環参照検出（ループノード以外）
  - 終了ノードへのパス存在確認

□ ノード設定バリデーション
  - 必須フィールドチェック
  - 条件式の構文チェック
  - 変数名の妥当性チェック

□ エラーレポート
  - エラー箇所の視覚的ハイライト
  - 修正方法の提案
```

#### Week 31: プリセットテンプレート・テスト

**Day 28-30: プリセットシナリオ作成**

```typescript
タスク:
□ プリセットシナリオテンプレート作成
  - エンジニア面接（技術質問、コード説明）
  - 営業面接（状況判断、交渉力）
  - デザイナー面接（ポートフォリオ説明、デザイン思考）
  - カスタマーサポート（クレーム対応、共感力）
  - ビジネス英語（プレゼンテーション、電話対応）
  - 日常英会話（自己紹介、趣味の話）

□ テンプレートライブラリUI
  - テンプレート一覧
  - プレビュー機能
  - "このテンプレートを使う" ボタン
  - カスタマイズして保存
```

**Day 31-33: E2Eテスト**

```typescript
タスク:
□ シナリオビルダーE2Eテスト
  - ノード作成・編集・削除
  - 接続・接続解除
  - 条件分岐テスト
  - ループ処理テスト
  - バリデーションテスト

□ 実行テスト
  - 作成したシナリオでセッション実行
  - 変数置換確認
  - 条件分岐動作確認

□ パフォーマンステスト
  - 100ノードのシナリオ
  - 複雑な条件分岐（10分岐）
```

**完了基準:**
- [ ] ビジュアルシナリオビルダーが動作
- [ ] 全ノードタイプが実装完了
- [ ] 条件分岐・ループが正常動作
- [ ] プリセットテンプレート6種類作成
- [ ] E2Eテスト合格
- [ ] ドキュメント完成

---

### 7.3: プラグインシステム

**期間:** Week 32-33（2週間）
**優先度:** P4
**対象:** 全ユーザー（利用）、開発者（作成）

#### Week 32: プラグインSDK・実行環境

**Day 34-36: プラグインSDK設計**

```typescript
// packages/plugin-sdk/src/index.ts

タスク:
□ プラグインインターフェース定義
  interface PrancePlugin {
    manifest: PluginManifest;
    onSessionStart?(context: SessionContext): Promise<void>;
    onSessionEnd?(context: SessionContext): Promise<void>;
    onAnalysisComplete?(context: AnalysisContext): Promise<void>;
    onReportGenerate?(context: ReportContext): Promise<ReportData>;
    onCustomScore?(context: ScoreContext): Promise<number>;
  }

  interface PluginManifest {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    permissions: string[];  // ["sessions:read", "reports:write"]
    extensionPoints: string[];  // ["session.start", "analysis.complete"]
  }

□ コンテキストオブジェクト定義
  interface SessionContext {
    session: Session;
    user: User;
    scenario: Scenario;
    avatar: Avatar;
    config: Record<string, any>;
  }

□ ヘルパー関数実装
  - API呼び出し: context.api.get/post/put/delete
  - ログ出力: context.logger.info/warn/error
  - 設定取得: context.config.get
```

**Day 37-38: サンドボックス実行環境**

```typescript
// infrastructure/lambda/plugins/execute/index.ts

タスク:
□ VM2 サンドボックス統合
  - pnpm install vm2
  - セキュア実行環境
  - タイムアウト設定（30秒）
  - メモリ制限（256MB）

□ プラグインローダー
  - S3からプラグインコード取得
  - コード検証（構文チェック）
  - 依存関係解決
  - 実行

□ 権限チェック
  - manifest.permissions検証
  - APIアクセス制限
  - リソースアクセス制限
```

**Day 39-40: プラグイン管理UI**

```typescript
// apps/web/app/[locale]/admin/plugins/page.tsx
// apps/web/components/admin/PluginManager.tsx

タスク:
□ プラグイン一覧画面
  - インストール済みプラグインリスト
  - 有効/無効ステータス
  - バージョン情報
  - 作者情報

□ プラグインアップロード
  - .zip ファイルアップロード
  - manifest.yaml検証
  - プラグインコード検証
  - S3保存

□ プラグイン設定
  - 設定項目表示（manifest.configから）
  - 設定値入力UI
  - 保存機能
```

#### Week 33: サンプルプラグイン・テスト

**Day 41-42: Slack通知プラグイン作成**

```typescript
// examples/plugins/slack-notification/index.ts

タスク:
□ Slack通知プラグイン実装
  - セッション完了時にSlack通知
  - Webhook URL設定
  - メッセージカスタマイズ
  - 添付ファイル（レポートPDF）

□ manifest.yaml作成
  id: slack-notification
  name: Slack通知プラグイン
  version: 1.0.0
  permissions: ["sessions:read", "reports:read"]
  extensionPoints: ["session.end"]
  config:
    - name: webhookUrl
      type: string
      required: true
```

**Day 43-44: カスタムスコアリングプラグイン作成**

```typescript
// examples/plugins/custom-scoring/index.ts

タスク:
□ カスタムスコアリングプラグイン実装
  - 独自のスコア計算ロジック
  - 業界別スコアリング
  - ポジション別スコアリング
  - スコアを標準レポートに追加

□ ドキュメント作成
  - プラグイン開発ガイド
  - API リファレンス
  - サンプルプラグインのコード説明
```

**Day 45: E2Eテスト**

```typescript
タスク:
□ プラグインシステムE2Eテスト
  - プラグインアップロード
  - プラグイン有効化・無効化
  - セッション実行時のプラグイン呼び出し
  - Slack通知テスト
  - カスタムスコアリングテスト

□ セキュリティテスト
  - サンドボックス脱出試行
  - 権限チェック
  - タイムアウトテスト
```

**完了基準:**
- [ ] プラグインSDKが動作
- [ ] サンドボックス実行環境が動作
- [ ] サンプルプラグイン2種類が動作
- [ ] プラグイン管理UIが動作
- [ ] セキュリティテスト合格
- [ ] プラグイン開発ガイド完成

---

### 7.4: 管理者UI設定

**期間:** Week 34-35（2週間）
**優先度:** P4
**対象:** スーパー管理者のみ

#### Week 34: 設定UI基盤

**Day 46-48: 設定データモデル**

```prisma
// packages/database/prisma/schema.prisma

model SystemSettings {
  id              String   @id @default(cuid())
  category        String   // "general", "email", "storage", "security"
  key             String   // "defaultLanguage", "smtpHost", "s3Bucket"
  value           String   // JSON形式で保存
  dataType        String   // "string", "number", "boolean", "json"
  description     String?
  isEncrypted     Boolean  @default(false)
  updatedBy       String
  updatedAt       DateTime @updatedAt
  @@unique([category, key])
  @@map("system_settings")
}
```

**タスク:**
```typescript
□ Prismaマイグレーション実行
□ SystemSettings CRUD API実装
  - GET /api/v1/admin/settings
  - GET /api/v1/admin/settings/:category
  - PUT /api/v1/admin/settings/:id
□ 設定値の暗号化実装（APIキー等）
```

**Day 49-51: 設定UI実装**

```typescript
// apps/web/app/[locale]/admin/settings/page.tsx
// apps/web/components/admin/SettingsEditor.tsx

タスク:
□ 設定画面実装
  - カテゴリタブ
    - 一般設定
    - メール設定
    - ストレージ設定
    - セキュリティ設定
    - セッション設定
    - 録画設定

□ 一般設定UI
  - デフォルト言語選択
  - タイムゾーン選択
  - 日付フォーマット選択
  - 通貨設定

□ メール設定UI
  - SMTP設定（ホスト、ポート、ユーザー、パスワード）
  - 送信元メールアドレス
  - 送信元名
  - テスト送信ボタン

□ ストレージ設定UI
  - S3バケット名
  - CloudFront Distribution ID
  - リージョン選択
  - 接続テストボタン
```

#### Week 35: 高度な設定・テスト

**Day 52-54: セキュリティ設定UI**

```typescript
タスク:
□ セキュリティ設定UI実装
  - パスワードポリシー
    - 最小長（デフォルト: 8）
    - 大文字必須
    - 数字必須
    - 特殊文字必須
  - セッションタイムアウト（分）
  - JWTトークン有効期限（時間）
  - 2FA有効化（将来実装）

□ セッション設定UI
  - デフォルトセッション時間（分）
  - 最大セッション時間（分）
  - アイドルタイムアウト（分）
  - 自動録画開始（オン/オフ）

□ 録画設定UI
  - デフォルト解像度（720p, 1080p）
  - ビデオビットレート（kbps）
  - オーディオビットレート（kbps）
  - フレームレート（fps）
```

**Day 55-56: 設定変更の適用**

```typescript
// infrastructure/lambda/settings/apply/index.ts

タスク:
□ 設定変更通知システム実装
  - EventBridge経由で通知
  - Lambda関数が設定を再読み込み
  - 5分以内に全Lambda関数に反映

□ 設定キャッシュ実装
  - DynamoDB/Redis使用
  - Lambda起動時に設定読み込み
  - 定期的にリフレッシュ（5分）

□ ロールバック機能
  - 設定変更履歴保存
  - ロールバックUI
  - 変更前の値を保持
```

**Day 57: E2Eテスト**

```typescript
タスク:
□ 設定UI E2Eテスト
  - 各設定の変更・保存
  - 設定の適用確認
  - ロールバック確認

□ 統合テスト
  - メール送信設定 → テストメール送信
  - ストレージ設定 → S3接続テスト
  - パスワードポリシー → 新規ユーザー登録テスト
```

**完了基準:**
- [ ] 管理者UI設定画面が動作
- [ ] 全設定カテゴリが実装完了
- [ ] 設定変更が5分以内に反映
- [ ] ロールバック機能が動作
- [ ] E2Eテスト合格

---

### 7.5: 非言語行動解析

**期間:** Week 36-37（2週間）
**優先度:** P4
**対象:** 全ユーザー

#### Week 36: MediaPipe統合

**Day 58-60: アイコンタクト検出**

```typescript
// infrastructure/lambda/shared/analysis/gaze-analyzer.ts

タスク:
□ MediaPipe Face Mesh統合
  - Lambda Layer作成（MediaPipe）
  - 顔ランドマーク検出（468点）
  - 目の位置特定

□ アイコンタクト判定ロジック
  - 視線方向推定
  - カメラ方向との角度計算
  - アイコンタクト判定（±15度以内）
  - フレームごとの判定
  - アイコンタクト率計算（%）

□ データベース保存
  model NonVerbalAnalysis {
    id              String   @id @default(cuid())
    sessionId       String   @unique
    eyeContactRatio Float    // 0.0-1.0
    eyeContactScore Int      // 0-100
    avgGazeDeviation Float   // 平均視線逸脱角度
    // ... 他のフィールド
  }
```

**Day 61-63: 姿勢分析**

```typescript
// infrastructure/lambda/shared/analysis/posture-analyzer.ts

タスク:
□ MediaPipe Pose統合
  - 体のランドマーク検出（33点）
  - 肩・背中・腰の位置

□ 姿勢評価ロジック
  - 前傾姿勢検出
  - 猫背検出
  - 左右傾斜検出
  - 姿勢スコア算出（0-100）

□ 時系列分析
  - 姿勢の変化追跡
  - 疲労度推定（姿勢悪化）
  - 緊張度推定（体の硬さ）
```

#### Week 37: ジェスチャー認識・統合

**Day 64-66: ジェスチャー認識**

```typescript
// infrastructure/lambda/shared/analysis/gesture-analyzer.ts

タスク:
□ MediaPipe Hands統合
  - 手のランドマーク検出（21点×2手）
  - 手の位置・角度

□ ジェスチャー分類
  - 自然なジェスチャー（Good）
  - 過度なジェスチャー（注意）
  - ジェスチャーなし（改善提案）
  - 不適切なジェスチャー（指摘）

□ ジェスチャーパターン分析
  - ジェスチャーの頻度
  - 多様性スコア
  - 適切性スコア
```

**Day 67-68: 統合・UI実装**

```typescript
// apps/web/components/sessions/NonVerbalAnalysisView.tsx

タスク:
□ 非言語行動解析結果表示UI
  - アイコンタクトグラフ
  - 姿勢評価グラフ
  - ジェスチャー分析
  - 総合スコア表示

□ タイムライン表示
  - 時系列でアイコンタクト率
  - 姿勢変化
  - ジェスチャーイベント

□ フィードバック生成
  - AIによる改善提案
  - 良い点の強調
  - 改善点の具体的アドバイス
```

**Day 69-70: E2Eテスト**

```typescript
タスク:
□ 非言語行動解析E2Eテスト
  - 各解析機能の動作確認
  - 精度検証
  - パフォーマンステスト

□ 統合テスト
  - 既存の表情解析との統合
  - レポートへの反映
```

**完了基準:**
- [ ] アイコンタクト検出が動作
- [ ] 姿勢分析が動作
- [ ] ジェスチャー認識が動作
- [ ] 解析結果が表示される
- [ ] E2Eテスト合格

---

### 7.6: 高度なトランスクリプトプレイヤー

**期間:** Week 38-39（2週間）
**優先度:** P4
**対象:** 全ユーザー

#### Week 38: ハイライト・検索機能

**Day 71-73: ハイライト機能**

```typescript
// infrastructure/lambda/transcripts/highlights/index.ts
// apps/web/components/transcripts/HighlightEditor.tsx

タスク:
□ 自動ハイライト検出
  - 重要キーワード検出
  - 感情的な発言検出
  - 長い沈黙後の発言
  - フィラーワードが少ない発言

□ マニュアルハイライト機能
  - ユーザーが時間範囲選択
  - ハイライト追加ボタン
  - ハイライトカテゴリ選択
    - 重要ポイント
    - 良い回答
    - 改善ポイント
    - その他

□ ハイライト管理
  - ハイライト一覧表示
  - 編集・削除機能
  - ハイライトジャンプ機能
```

**Day 74-76: 検索・ナビゲーション機能**

```typescript
// apps/web/components/transcripts/TranscriptSearch.tsx

タスク:
□ トランスクリプト検索実装
  - キーワード全文検索
  - ハイライト表示
  - 検索結果リスト
  - 検索結果ジャンプ機能

□ 高度な検索
  - フレーズ検索（" "で囲む）
  - 発話者フィルタ（AI/ユーザー）
  - 時間範囲フィルタ

□ ナビゲーション機能
  - 前の発言・次の発言ボタン
  - 発話者別ジャンプ
  - ハイライト別ジャンプ
  - タイムスタンプクリックでジャンプ
```

#### Week 39: 字幕・コメント機能

**Day 77-79: 字幕スタイル設定**

```typescript
// apps/web/components/transcripts/SubtitleSettings.tsx

タスク:
□ 字幕スタイル設定UI
  - フォントサイズ（小・中・大）
  - フォント色選択
  - 背景色選択
  - 不透明度調整
  - 位置設定（上・下）

□ 設定の保存
  - ローカルストレージに保存
  - ユーザープロファイルに保存（将来）

□ リアルタイム字幕表示
  - 設定変更後即座に反映
```

**Day 80-82: タイムスタンプコメント**

```typescript
// apps/web/components/transcripts/CommentThread.tsx

タスク:
□ コメント機能実装
  - タイムスタンプ付きコメント追加
  - コメント表示（タイムライン上）
  - コメント編集・削除
  - コメント返信（スレッド）

□ コメント表示UI
  - タイムライン上のマーカー
  - ホバーでコメント内容表示
  - クリックでコメント詳細
  - コメント一覧パネル

□ コメント通知（将来）
  - 新しいコメント通知
  - メンション機能
```

**Day 83-84: E2Eテスト**

```typescript
タスク:
□ トランスクリプトプレイヤーE2Eテスト
  - ハイライト作成・編集・削除
  - 検索機能
  - ナビゲーション機能
  - 字幕スタイル設定
  - コメント機能

□ パフォーマンステスト
  - 長時間セッション（60分）
  - 大量コメント（100件）
```

**完了基準:**
- [ ] ハイライト機能が動作
- [ ] 検索機能が動作
- [ ] 字幕スタイル設定が動作
- [ ] コメント機能が動作
- [ ] E2Eテスト合格

---

### 7.7: カスタムレポートテンプレート

**期間:** Week 40-41（2週間）
**優先度:** P4
**対象:** 組織管理者以上

#### Week 40: テンプレートビルダー

**Day 85-87: ドラッグ&ドロップビルダー**

```typescript
// apps/web/app/[locale]/admin/report-templates/builder/page.tsx
// apps/web/components/admin/ReportTemplateBuilder.tsx

タスク:
□ React DnD 統合
  - pnpm install react-dnd react-dnd-html5-backend
  - キャンバスエリア
  - コンポーネントパレット

□ レポートコンポーネント定義
  - テキストブロック
  - 画像ブロック（ロゴ等）
  - スコアカード
  - グラフ（レーダー、棒、折れ線）
  - テーブル
  - 改善提案

□ コンポーネント編集
  - プロパティパネル
  - テキスト編集
  - スタイル設定（色、サイズ）
  - データソース設定
```

**Day 88-90: テンプレートデータモデル**

```prisma
// packages/database/prisma/schema.prisma

model ReportTemplate {
  id              String   @id @default(cuid())
  orgId           String
  name            String
  description     String?
  layout          Json     // コンポーネント配置情報
  styles          Json     // スタイル設定
  variables       Json     // 変数定義
  isDefault       Boolean  @default(false)
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("report_templates")
}
```

**タスク:**
```typescript
□ ReportTemplate CRUD API実装
  - GET /api/v1/report-templates
  - POST /api/v1/report-templates
  - PUT /api/v1/report-templates/:id
  - DELETE /api/v1/report-templates/:id

□ テンプレート保存機能
  - レイアウトJSON保存
  - バージョン管理

□ テンプレートプレビュー
  - サンプルデータでプレビュー
  - PDF生成テスト
```

#### Week 41: レポート生成・承認ワークフロー

**Day 91-93: カスタムテンプレートでのレポート生成**

```typescript
// infrastructure/lambda/reports/generate-custom/index.ts

タスク:
□ カスタムテンプレートレンダリング実装
  - テンプレートJSON読み込み
  - データバインディング
  - React-PDF動的レンダリング
  - スタイル適用

□ 変数置換
  - {{candidateName}}: 候補者名
  - {{overallScore}}: 総合スコア
  - {{categoryScores}}: カテゴリ別スコア
  - カスタム変数

□ グラフ生成
  - Chart.js使用
  - グラフ画像生成
  - PDF埋め込み
```

**Day 94-96: レポート承認ワークフロー**

```prisma
model ReportApproval {
  id              String   @id @default(cuid())
  reportId        String   @unique
  status          ApprovalStatus
  submittedBy     String
  submittedAt     DateTime
  reviewedBy      String?
  reviewedAt      DateTime?
  comments        String?
  @@map("report_approvals")
}

enum ApprovalStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  REJECTED
  PUBLISHED
}
```

**タスク:**
```typescript
□ 承認ワークフローAPI実装
  - POST /api/v1/reports/:id/submit
  - POST /api/v1/reports/:id/approve
  - POST /api/v1/reports/:id/reject
  - POST /api/v1/reports/:id/publish

□ 承認UI実装
  - ドラフト一覧
  - 承認待ち一覧
  - レビュー画面
  - コメント機能

□ 通知機能
  - レビュー依頼通知
  - 承認/却下通知
```

**Day 97: E2Eテスト**

```typescript
タスク:
□ カスタムレポートE2Eテスト
  - テンプレート作成・編集
  - レポート生成
  - 承認ワークフロー
  - PDF品質確認

□ パフォーマンステスト
  - 複雑なテンプレート
  - 大量データ
  - 生成時間測定
```

**完了基準:**
- [ ] テンプレートビルダーが動作
- [ ] カスタムテンプレートでレポート生成可能
- [ ] 承認ワークフローが動作
- [ ] E2Eテスト合格
- [ ] ドキュメント完成

---

## 改訂された全体スケジュール

### タイムライン（41週間 = 約10ヶ月）

```
Week 1-4:   Phase 2.2-2.3 (解析・レポート)           P0 ████████
Week 5-7:   Phase 2.5 (ゲストユーザー)               P0 ████████
Week 8-9:   Phase 3.1.1 (XLSX一括登録)               P0 ████████
Week 10-11: Phase 3.1.2 (基本ATS連携)                P1 ████████
Week 12-13: Phase 3.1.3 (基本レポート・分析)         P1 ████████
            ↑ Beta Release (Week 13)
Week 14-15: Phase 4.1 (サブスクリプション・課金)     P2 ████████
Week 16-17: Phase 4.2 (ベンチマークシステム)         P2 ████████
Week 18-19: Phase 4.3 (外部連携API) + 4.4 (SSO)     P2 ████████
            ↑ V1.0 GA (Week 19)
Week 20-21: Phase 5.1.1 (AIプロンプト管理UI)         P3 ████████
Week 22:    Phase 5.1.2 (高度なレポート・分析)       P3 ████████
Week 23-24: Phase 5.1.3-5.1.4 (データ管理・ブランディング) P3 ████████
Week 25:    Phase 5.2 (高度なATS連携)                P3 ████████
Week 26:    Phase 6 (最適化・スケール)               P3 ████████
            ↑ V2.0 Enterprise (Week 26)
Week 27-28: Phase 7.1 (カスタムアバター + 音声クローン) P4 ████████
Week 29-31: Phase 7.2 (ノーコードシナリオビルダー)   P4 ████████
Week 32-33: Phase 7.3 (プラグインシステム)           P4 ████████
Week 34-35: Phase 7.4 (管理者UI設定)                 P4 ████████
Week 36-37: Phase 7.5 (非言語行動解析)               P4 ████████
Week 38-39: Phase 7.6 (高度なトランスクリプトプレイヤー) P4 ████████
Week 40-41: Phase 7.7 (カスタムレポートテンプレート) P4 ████████
            ↑ V2.5 Advanced (Week 41)
```

---

## リリースマイルストーン

| リリース | 時期 | Week | 含まれるPhase | 主要機能 |
|---------|------|------|--------------|---------|
| **MVP Release** | 2026年4月末 | 4 | Phase 0-2 | 基本会話・録画・解析・レポート |
| **Beta Release** | 2026年6月末 | 13 | Phase 2.5, 3.1 | ゲストユーザー、XLSX、ATS連携 |
| **V1.0 GA** | 2026年8月末 | 19 | Phase 4 | サブスクリプション、外部API、ベンチマーク |
| **V2.0 Enterprise** | 2026年10月末 | 26 | Phase 5-6 | AIプロンプト管理、高度分析、最適化 |
| **V2.5 Advanced** | 2026年12月末 | 41 | Phase 7 | カスタムアバター、音声クローン、シナリオビルダー、プラグイン |

---

## 優先度マトリクス

### P0（最優先・Week 1-9）

現行計画から変更なし。

### P1（高優先・Week 10-13）

現行計画から変更なし。

### P2（中優先・Week 14-19）

一部調整：
- Phase 4.2: 1.5週 → 2週に延長（ベンチマーク詳細化）

### P3（低優先・Week 20-26）

一部調整：
- Phase 5.1.4: 1週 → 1.5週に延長（ブランディング詳細化）

### P4（将来実装・Week 27-41）- **新規追加**

Phase 7全体を追加。

---

## まとめ

### 主要な成果

1. ✅ 全17モジュールドキュメントを精査
2. ✅ **8つの抜けている主要機能を特定**
3. ✅ Phase 7（15週間）を新規追加
4. ✅ **Day単位のステップバイステップ実装計画を策定**
5. ✅ 41週間（10ヶ月）の完全実装ロードマップを作成
6. ✅ V2.5 Advanced Editionのリリース計画を策定

### 次のアクション

**immediate（Day 1-2）:**
- Phase 2.2.2 AudioAnalyzer実装開始（変更なし）

**short-term（Week 1-26）:**
- 現行計画（P0-P3）を実行
- V2.0 Enterprise完成

**long-term（Week 27-41）:**
- Phase 7実装開始
- V2.5 Advanced完成

**決定ポイント（Week 26）:**
- V2.0 Enterprise完成後、Phase 7の優先順位を再評価
- 市場フィードバックに基づいて調整

---

**最終更新:** 2026-03-09
**次回レビュー:** Week 26（V2.0 Enterprise完成時）
