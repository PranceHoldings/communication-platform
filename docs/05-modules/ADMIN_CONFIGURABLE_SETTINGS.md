# スーパー管理者UI 設定可能項目

**作成日:** 2026-03-08
**ステータス:** 設計中（将来実装予定）
**優先度:** Phase 3-4

---

## 概要

このドキュメントは、将来スーパー管理者UIで変更可能になる設定項目を定義します。
これらの設定は現在環境変数（.env）で管理されていますが、UI経由でリアルタイム変更できるようになります。

---

## 設定項目リスト

### 1. AWS リージョン設定

#### 1.1 デフォルトリージョン

- **項目名:** `AWS_REGION`
- **現在の値:** `us-east-1`
- **説明:** AWS リソースのデフォルトリージョン
- **制約:** CloudFront証明書は常にus-east-1（変更不可）
- **影響範囲:** Lambda関数、S3、DynamoDB等

#### 1.2 Bedrock リージョン

- **項目名:** `BEDROCK_REGION`
- **現在の値:** `us-east-1`
- **説明:** AWS Bedrock (Claude AI) のリージョン
- **制約:** Bedrockが利用可能なリージョンのみ
- **利用可能リージョン:** us-east-1, us-west-2, ap-southeast-1, ap-northeast-1, eu-west-1
- **影響範囲:** AI会話生成

#### 1.3 Rekognition リージョン

- **項目名:** `REKOGNITION_REGION`
- **現在の値:** `us-east-1`
- **説明:** AWS Rekognition (感情解析) のリージョン
- **制約:** Rekognitionが利用可能なリージョンのみ
- **影響範囲:** 表情・感情解析機能

#### 1.4 Polly リージョン

- **項目名:** `POLLY_REGION`
- **現在の値:** `us-east-1`
- **説明:** AWS Polly (TTS フォールバック) のリージョン
- **制約:** Pollyが利用可能なリージョンのみ
- **影響範囲:** 音声合成（フォールバック用）

---

### 2. AI/音声サービス設定

#### 2.1 Bedrock モデルID

- **項目名:** `BEDROCK_MODEL_ID`
- **現在の値:** `us.anthropic.claude-sonnet-4-6`
- **説明:** 使用するBedrockモデルID
- **選択肢:**
  - `us.anthropic.claude-sonnet-4-6` (推奨)
  - `us.anthropic.claude-opus-4-6`
  - `us.anthropic.claude-haiku-4-5`
- **影響範囲:** AI応答の品質・速度・コスト

#### 2.2 ElevenLabs モデルID

- **項目名:** `ELEVENLABS_MODEL_ID`
- **現在の値:** `eleven_flash_v2_5`
- **説明:** ElevenLabs TTSモデル
- **選択肢:**
  - `eleven_flash_v2_5` (高速・低コスト)
  - `eleven_multilingual_v2` (多言語対応)
  - `eleven_turbo_v2_5` (最速)
- **影響範囲:** 音声合成の品質・速度・コスト

#### 2.3 Azure Speech リージョン

- **項目名:** `AZURE_SPEECH_REGION`
- **現在の値:** `eastus`
- **説明:** Azure Speech Services のリージョン
- **利用可能リージョン:** eastus, westus, westeurope, southeastasia, japaneast等
- **影響範囲:** 音声認識の遅延・コスト

---

### 3. CloudFront 設定（動画配信）

#### 3.1 CloudFront ドメイン

- **項目名:** `CLOUDFRONT_DOMAIN`
- **現在の値:** （空）
- **説明:** CloudFront ディストリビューションのドメイン
- **例:** `d111111abcdef8.cloudfront.net`
- **影響範囲:** 録画動画の配信URL

#### 3.2 CloudFront キーペアID

- **項目名:** `CLOUDFRONT_KEY_PAIR_ID`
- **現在の値:** （空）
- **説明:** CloudFront署名付きURLのキーペアID
- **影響範囲:** 録画動画のセキュアアクセス

#### 3.3 CloudFront プライベートキー

- **項目名:** `CLOUDFRONT_PRIVATE_KEY`
- **現在の値:** （空）
- **説明:** CloudFront署名用プライベートキー
- **セキュリティ:** AWS Secrets Manager 推奨
- **影響範囲:** 録画動画のセキュアアクセス

---

## 実装アプローチ

### データベーススキーマ（案）

```prisma
model SystemSetting {
  id          String   @id @default(uuid())
  key         String   @unique // e.g., "AWS_REGION", "BEDROCK_MODEL_ID"
  value       String   // 設定値
  category    String   // "aws_region", "ai_model", "cloudfront"
  description String?  // 説明
  isSecret    Boolean  @default(false) // 機密情報かどうか
  updatedBy   String?  @map("updated_by") // 最終更新者
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}
```

### API エンドポイント（案）

```
GET    /api/v1/admin/settings          - 設定一覧取得
GET    /api/v1/admin/settings/:key     - 特定設定取得
PUT    /api/v1/admin/settings/:key     - 設定更新
POST   /api/v1/admin/settings/validate - 設定値検証
```

### スーパー管理者UI（案）

**画面:** `/dashboard/admin/settings`

**セクション:**

1. **AWS リージョン設定**
   - デフォルトリージョン（ドロップダウン）
   - Bedrock リージョン（ドロップダウン）
   - Rekognition リージョン（ドロップダウン）
   - Polly リージョン（ドロップダウン）

2. **AI/音声モデル設定**
   - Bedrock モデルID（ドロップダウン + プレビュー）
   - ElevenLabs モデルID（ドロップダウン + サンプル再生）
   - Azure Speech リージョン（ドロップダウン）

3. **CloudFront 設定**
   - CloudFront ドメイン（テキスト入力 + 検証）
   - CloudFront キーペアID（テキスト入力）
   - CloudFront プライベートキー（ファイルアップロード or テキスト入力）

**機能:**

- リアルタイムバリデーション
- 変更履歴表示
- デフォルト値への復元
- 設定のインポート/エクスポート（JSON）

---

## セキュリティ考慮事項

### 1. アクセス制御

- **SUPER_ADMIN** ロールのみアクセス可能
- 変更ログを完全記録（誰が・いつ・何を変更したか）
- 重要な変更は二段階認証を要求

### 2. 機密情報管理

- APIキーやプライベートキーは **AWS Secrets Manager** に保存
- UIには最後の4文字のみ表示（例: `****...5769`）
- 変更時のみ全文入力可能

### 3. バリデーション

- リージョン名の正当性チェック
- モデルIDの存在確認
- CloudFront設定の接続テスト

### 4. ロールバック機能

- 設定変更前に自動バックアップ
- ワンクリックで前の設定に復元
- 過去30日間の変更履歴保持

---

## マイグレーション戦略

### フェーズ1: データベース準備

1. `SystemSetting` モデル作成
2. マイグレーション実行
3. 既存の.env値をシードデータとして投入

### フェーズ2: API実装

1. 設定CRUD APIを実装
2. バリデーション機能実装
3. 変更ログ機能実装

### フェーズ3: UI実装

1. スーパー管理者設定画面作成
2. リアルタイムバリデーション統合
3. 変更履歴表示機能

### フェーズ4: Lambda統合

1. Lambda起動時にDB設定を読み込み
2. キャッシュ機構（DynamoDB/ElastiCache）
3. 設定変更時のLambda自動再起動

---

## 将来の拡張

### 1. 組織レベル設定

- テナントごとに異なるリージョン/モデルを使用
- コスト最適化のための自動リージョン選択

### 2. 自動最適化

- 使用状況に基づいた最適リージョン提案
- コスト vs パフォーマンスのトレードオフ分析

### 3. A/Bテスト

- 異なるモデル/リージョンのA/Bテスト機能
- パフォーマンス比較レポート

---

## 関連ドキュメント

- [API設計](../development/API_DESIGN.md)
- [データベース設計](../development/DATABASE_DESIGN.md)
- [マルチテナント設計](../architecture/MULTITENANCY.md)
- [セキュリティガイドライン](../SECURITY.md)

---

**最終更新:** 2026-03-08
**次回レビュー:** Phase 3開始時
