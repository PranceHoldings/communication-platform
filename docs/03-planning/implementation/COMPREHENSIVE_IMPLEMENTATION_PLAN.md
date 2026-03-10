# 包括的実装計画 - Prance Communication Platform

**作成日:** 2026-03-09
**バージョン:** 1.0
**ステータス:** 最新版（全モジュール統合）

---

## 📋 エグゼクティブサマリー

### 目的

本ドキュメントは、Pranceプラットフォームの**全機能**を網羅した包括的な実装計画です。既存の`IMPLEMENTATION_PHASES.md`が基本機能のみをカバーしていたのに対し、本計画では以下を含みます：

- ✅ 基本機能（Phase 0-2）
- 🆕 エンタープライズ機能（Phase 3）
- 🆕 ゲストユーザーシステム（Phase 2.5）
- 🆕 高度な分析・レポート機能
- 🆕 ブランディング・カスタマイズ
- 🆕 管理者向け高度な設定UI

### 現在の状況

**完了済み:**
- ✅ Phase 0: インフラ基盤（100%）
- ✅ Phase 1: MVP - コア会話機能（100%）
- ✅ Phase 2.1: 録画機能（100%）
- ✅ Phase 2.2.1: データベースマイグレーション（表情・音声解析テーブル）（100%）

**進行中:**
- 🔄 Phase 2.2: 解析機能実装（30%完了）

**未実装（実装計画なし）:**
- ❌ Phase 2.5: ゲストユーザーシステム
- ❌ Phase 3: エンタープライズ機能
  - XLSX一括登録システム
  - ATS連携（詳細実装）
  - AIプロンプト・プロバイダ管理UI
  - 高度なレポート・分析・検索機能
  - データ管理・アーカイブ機能
  - ブランディング・カスタマイズ
- ❌ Phase 4の一部（サブスクリプション統合の詳細）
- ❌ Phase 5の一部（プラグインシステムの詳細）

---

## 🎯 リリースフェーズ戦略

### リリースフェーズ定義

本プロジェクトは以下の4段階でリリースします：

```
MVP Release (Phase 0-2)
    ↓
Beta Release (Phase 2.5-3)
    ↓
V1.0 General Availability (Phase 4)
    ↓
V2.0 Enterprise Edition (Phase 5-6)
```

---

## 📦 MVP Release - 基本会話・録画・解析機能

**目標:** AIアバターとの会話セッション、録画、基本解析が動作する最小限の製品

**リリース時期:** 2026年4月末（Phase 2完了時）

**対象ユーザー:** 内部ユーザー（CLIENT_ADMIN, CLIENT_USER）のみ

### 含まれる機能

#### Phase 0: インフラ基盤 ✅ 完了
- AWS CDK インフラ構築
- Aurora Serverless v2（PostgreSQL）
- S3 + CloudFront
- Cognito認証
- API Gateway（REST/WebSocket）

#### Phase 1: コア会話機能 ✅ 完了
- ユーザー認証（JWT）
- シナリオ管理（CRUD + Clone）
- アバター管理（CRUD + Clone）
- セッション管理（Create/List/Detail）
- 音声会話パイプライン（STT → AI → TTS）
- WebSocketリアルタイム通信
- 多言語対応（10言語）

#### Phase 2: 録画・解析・レポート（進行中）

**Phase 2.1: 録画機能** ✅ 完了
- フロントエンド映像キャプチャ（Canvas API合成）
- Lambda動画処理（ffmpeg結合）
- 録画再生UI

**Phase 2.2: 解析機能** 🔄 進行中（30%）
- 2.2.1 ✅ データベースマイグレーション（EmotionAnalysis, AudioAnalysis, SessionScore）
- 2.2.2 ⏸️ 音声解析（AudioAnalyzer実装）
- 2.2.3 ⏸️ 統合処理（AnalysisOrchestrator）
- 2.2.4 ⏸️ Analysis API実装
- 2.2.5 ⏸️ フロントエンドUI（スコア表示、グラフ）

**Phase 2.3: レポート生成** 🔜 未着手
- レポートテンプレート（React-PDF）
- AI改善提案（Claude API）
- レポート管理UI
- PDF生成・ダウンロード

**推定期間:** Phase 2全体で4-6週間（残り3-4週間）

---

## 🎭 Beta Release - ゲストユーザー・基本Enterprise機能

**目標:** 外部ユーザー（候補者）のアクセス、基本的なEnterprise機能の追加

**リリース時期:** 2026年6月末（Phase 2.5-3.1完了時）

**対象ユーザー:** 内部ユーザー + ゲストユーザー + 小規模Enterprise顧客

### 含まれる機能

#### Phase 2.5: ゲストユーザーシステム 🆕

**目的:** ログイン不要の外部ユーザー（候補者・受講者）アクセス

**実装期間:** 2-3週間

**主要機能:**

1. **ゲストセッション作成UI**
   - 内部ユーザーがゲストセッションを作成
   - URL + 簡易パスワード自動生成
   - 有効期限設定（デフォルト7日）
   - メール送信オプション

2. **ゲストアクセス画面**
   - パスワード入力画面
   - セッション直接開始（ダッシュボード不要）
   - 録画・評価自動実行

3. **データアクセス制限**
   - ゲストは自己データ閲覧不可
   - 内部ユーザーのみ録画・評価閲覧可能

4. **セキュリティ機能**
   - セッション終了後のURL無効化（オプション）
   - 自動削除（設定期間経過後）

**データモデル追加:**
```prisma
model GuestSession {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  accessUrl       String   @unique
  password        String   // ハッシュ化
  guestName       String?
  guestEmail      String?
  expiresAt       DateTime
  accessCount     Int      @default(0)
  isExpired       Boolean  @default(false)
  // ... その他
}
```

**API実装:**
- `POST /api/v1/guest-sessions` - ゲストセッション作成
- `POST /api/v1/guest/verify` - パスワード検証
- `GET /api/v1/guest/session/:token` - セッション情報取得

**ドキュメント:** `docs/modules/GUEST_USER_SYSTEM.md`

---

#### Phase 3.1: Enterprise基本機能 🆕

**目的:** 大規模運用の基本的な効率化

**実装期間:** 4-5週間

##### 3.1.1 XLSX一括登録システム（2週間）

**目的:** 数百〜数千人の候補者を5分で一括登録

**主要機能:**

1. **XLSXテンプレート提供**
   - ダウンロード可能なテンプレート（.xlsx）
   - データ検証ルール組み込み（Email形式、ドロップダウン等）
   - 記入例シート付き

2. **アップロード・バリデーション**
   - ブラウザでXLSXファイルアップロード
   - クライアント側バリデーション（SheetJS/xlsx）
   - サーバー側再検証
   - エラーレポート生成（行番号付き）

3. **バッチ処理**
   - Lambda + Step Functionsで大量処理
   - 1000件を5分で処理（目標）
   - 進捗状況リアルタイム表示
   - 部分失敗時の継続処理

4. **自動メール送信**
   - SES経由で招待メール一斉送信
   - カスタムメールテンプレート
   - 送信ログ・エラー追跡

**データモデル:**
```prisma
model BulkInvitation {
  id              String   @id @default(cuid())
  fileName        String
  fileUrl         String   // S3 URL
  status          BulkInvitationStatus
  totalRows       Int
  successCount    Int      @default(0)
  failureCount    Int      @default(0)
  errors          Json?    // エラー詳細
  // ... その他
}

enum BulkInvitationStatus {
  PENDING
  VALIDATING
  PROCESSING
  SENDING_EMAILS
  COMPLETED
  FAILED
  PARTIALLY_FAILED
}
```

**技術スタック:**
- フロントエンド: SheetJS (xlsx) - XLSXパース
- バックエンド: xlsx (Node.js) - サーバー側パース
- AWS: Step Functions（バッチ処理オーケストレーション）
- AWS SES: メール送信

**API実装:**
- `POST /api/v1/bulk-invitations/upload` - XLSXアップロード
- `POST /api/v1/bulk-invitations/:id/process` - 処理開始
- `GET /api/v1/bulk-invitations/:id/status` - 進捗状況
- `GET /api/v1/bulk-invitations/:id/errors` - エラーレポート

**UI実装:**
- `apps/web/app/[locale]/admin/bulk-invitations/page.tsx`
- `apps/web/components/admin/BulkInvitationUploader.tsx`
- `apps/web/components/admin/BulkInvitationProgress.tsx`

**ドキュメント:** `docs/modules/ENTERPRISE_FEATURES.md` (Section 2)

---

##### 3.1.2 基本ATS連携（1.5週間）

**目的:** 主要ATS（Greenhouse, Lever, Workday）との基本同期

**主要機能:**

1. **ATS認証設定UI**
   - OAuth2.0フロー（Greenhouse, Lever）
   - APIキー設定（Workday, HRMOS等）
   - 接続テスト機能

2. **候補者同期（ATS → Prance）**
   - 手動同期トリガー
   - 候補者情報の取得・保存
   - ゲストセッション自動作成
   - マッピング管理

3. **結果エクスポート（Prance → ATS）**
   - 面接結果のエクスポート
   - ステージ変更（例: "AI Interview Complete"）
   - スコア・レポート添付

**対応ATS（Phase 3.1）:**
- Greenhouse（グローバルシェア1位）
- Lever（グローバルシェア2位）
- Workday（大企業向け）

**データモデル:**
```prisma
model ATSIntegration {
  id              String   @id @default(cuid())
  orgId           String
  provider        ATSProvider
  apiKey          String   // 暗号化
  oauthToken      String?  // 暗号化
  refreshToken    String?  // 暗号化
  isActive        Boolean  @default(true)
  lastSyncAt      DateTime?
  // ... その他
}

model CandidateATSMapping {
  id              String   @id @default(cuid())
  guestSessionId  String   @unique
  atsProvider     ATSProvider
  atsCandidateId  String
  atsApplicationId String?
  // ... その他
}

enum ATSProvider {
  GREENHOUSE
  LEVER
  WORKDAY
  HRMOS
  JOBKAN
  TALENTIO
}
```

**API実装:**
- `POST /api/v1/ats/connect` - ATS認証設定
- `POST /api/v1/ats/sync` - 候補者同期
- `POST /api/v1/ats/export/:sessionId` - 結果エクスポート
- `GET /api/v1/ats/status` - 同期ステータス

**実装ファイル:**
- `packages/shared/src/ats/ats-adapter.interface.ts` - アダプターインターフェース
- `packages/shared/src/ats/greenhouse-adapter.ts` - Greenhouseアダプター
- `packages/shared/src/ats/lever-adapter.ts` - Leverアダプター
- `packages/shared/src/ats/workday-adapter.ts` - Workdayアダプター

**ドキュメント:** `docs/modules/ATS_INTEGRATION.md`

---

##### 3.1.3 基本レポート・分析機能（1.5週間）

**目的:** 候補者データの検索・フィルタ・Excelエクスポート

**主要機能:**

1. **候補者検索・フィルタUI**
   - 名前・メール・ポジションでの検索
   - 複数条件フィルタ（スコア範囲、日付範囲、ステータス）
   - ソート機能（スコア、日付、名前）
   - ページネーション

2. **Excelエクスポート**
   - 選択した候補者をExcel形式でエクスポート
   - カスタムカラム選択
   - スコア詳細・ハイライト含む

3. **基本分析ダッシュボード**
   - 候補者総数
   - 平均スコア
   - 合格率（閾値ベース）
   - 時系列グラフ（日別セッション数）

**技術スタック:**
- ExcelJS (Node.js) - Excelファイル生成
- Recharts - グラフ表示

**API実装:**
- `GET /api/v1/candidates/search` - 候補者検索
- `POST /api/v1/reports/export` - Excelエクスポート
- `GET /api/v1/analytics/dashboard` - ダッシュボードデータ

**UI実装:**
- `apps/web/app/[locale]/admin/candidates/page.tsx`
- `apps/web/components/admin/CandidateSearch.tsx`
- `apps/web/components/admin/ExcelExportDialog.tsx`
- `apps/web/components/admin/AnalyticsDashboard.tsx`

**ドキュメント:** `docs/modules/ENTERPRISE_FEATURES.md` (Section 4)

---

## 🚀 V1.0 General Availability - 完全なSaaS機能

**目標:** マルチテナント、サブスクリプション課金、APIエコシステムの完成

**リリース時期:** 2026年8月末（Phase 4完了時）

**対象ユーザー:** すべてのユーザー（Free/Pro/Enterprise）

### 含まれる機能

#### Phase 4.1: サブスクリプション・課金（2週間）

**実装詳細:**

1. **プラン管理システム**
   - Free/Pro/Enterprise プラン定義
   - クォータ管理（セッション数、ストレージ、API呼び出し）
   - 使用量監視・アラート

2. **Stripe統合**
   - Stripe Checkout統合
   - サブスクリプション作成・変更・キャンセル
   - Webhook処理（payment_succeeded, subscription_deleted等）
   - 請求書自動生成

3. **プラン管理UI（スーパー管理者）**
   - プラン作成・編集
   - 価格設定
   - クォータ設定

4. **サブスクリプション管理UI（組織管理者）**
   - 現在のプラン表示
   - アップグレード・ダウングレード
   - 請求履歴
   - 使用量ダッシュボード

**データモデル:**
```prisma
model Plan {
  id              String   @id @default(cuid())
  name            String   @unique // "Free", "Pro", "Enterprise"
  displayName     Json     // 多言語対応
  priceMonthly    Int      // セント単位
  priceYearly     Int
  features        Json     // 機能リスト
  quotas          Json     // クォータ設定
  stripeProductId String?
  stripePriceId   String?
  isActive        Boolean  @default(true)
  // ... その他
}

model Subscription {
  id              String   @id @default(cuid())
  orgId           String   @unique
  planId          String
  status          SubscriptionStatus
  stripeSubscriptionId String?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean @default(false)
  // ... その他
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  INCOMPLETE
}
```

**API実装:**
- `GET /api/v1/plans` - プラン一覧
- `POST /api/v1/subscriptions/checkout` - Stripe Checkout作成
- `POST /api/v1/subscriptions/webhook` - Stripe Webhook
- `GET /api/v1/subscriptions/current` - 現在のサブスクリプション
- `POST /api/v1/subscriptions/cancel` - サブスクリプションキャンセル

**ドキュメント:** `docs/modules/SUBSCRIPTION_PLANS.md`

---

#### Phase 4.2: ベンチマークシステム（1.5週間）

**実装詳細:**

1. **プロファイル算出**
   - 過去セッションからユーザープロファイル生成
   - カテゴリ別スコア集計
   - K-means クラスタリング（初級・中級・上級等）

2. **パーセンタイル計算**
   - 同シナリオの全ユーザーとの比較
   - 業界別・ポジション別ベンチマーク

3. **成長トラッキング**
   - 時系列スコア変化
   - 改善率計算
   - マイルストーン達成

4. **パーソナライズド改善提案**
   - AI駆動の改善提案（Claude API）
   - 弱点カテゴリの特定
   - 推奨トレーニングシナリオ

**データモデル:**
```prisma
model BenchmarkProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  scenarioType    String
  totalSessions   Int
  averageScore    Float
  categoryScores  Json     // カテゴリ別平均スコア
  percentile      Int      // 0-100
  cluster         String?  // "beginner", "intermediate", "advanced"
  lastUpdatedAt   DateTime
  // ... その他
}
```

**API実装:**
- `GET /api/v1/benchmark/profile` - ユーザープロファイル取得
- `GET /api/v1/benchmark/percentile` - パーセンタイル取得
- `GET /api/v1/benchmark/growth` - 成長データ取得
- `GET /api/v1/benchmark/suggestions` - 改善提案取得

**UI実装:**
- `apps/web/app/[locale]/profile/benchmark/page.tsx`
- `apps/web/components/profile/BenchmarkView.tsx`
- `apps/web/components/profile/GrowthChart.tsx`

**ドキュメント:** `docs/modules/BENCHMARK_SYSTEM.md`

---

#### Phase 4.3: 外部連携API（1.5週間）

**実装詳細:**

1. **APIキー管理**
   - APIキー生成・ハッシュ化
   - スコープ管理（read, write, admin）
   - 有効期限設定

2. **レート制限**
   - 階層的レート制限（Plan別）
   - Redis Cache使用
   - 429 Too Many Requests レスポンス

3. **Webhook設定**
   - イベント選択（session.completed, report.generated等）
   - Webhook URL設定
   - リトライ機能
   - 署名検証（HMAC）

4. **OpenAPI仕様**
   - Swagger UI提供
   - API ドキュメント自動生成

**データモデル:**
```prisma
model APIKey {
  id              String   @id @default(cuid())
  orgId           String
  name            String
  keyHash         String   @unique
  scopes          String[] // ["read:sessions", "write:sessions", "admin:*"]
  rateLimit       Int      // リクエスト/分
  expiresAt       DateTime?
  lastUsedAt      DateTime?
  isActive        Boolean  @default(true)
  // ... その他
}

model Webhook {
  id              String   @id @default(cuid())
  orgId           String
  url             String
  events          String[] // ["session.completed", "report.generated"]
  secret          String   // HMAC署名用
  isActive        Boolean  @default(true)
  // ... その他
}
```

**API実装:**
- `POST /api/v1/api-keys` - APIキー作成
- `GET /api/v1/api-keys` - APIキー一覧
- `DELETE /api/v1/api-keys/:id` - APIキー削除
- `POST /api/v1/webhooks` - Webhook設定
- `GET /api/v1/webhooks` - Webhook一覧

**外部API エンドポイント:**
- `GET /external/v1/sessions` - セッション一覧
- `GET /external/v1/sessions/:id` - セッション詳細
- `GET /external/v1/reports/:sessionId` - レポート取得
- `POST /external/v1/guest-sessions` - ゲストセッション作成

**ドキュメント:** `docs/modules/EXTERNAL_API.md`

---

#### Phase 4.4: セキュリティ・SSO（1週間）

**実装詳細:**

1. **SAML SSO統合**
   - Cognito SAML設定
   - IdPメタデータ処理
   - 属性マッピング
   - JIT（Just-In-Time）プロビジョニング

2. **SCIM プロビジョニング（オプション）**
   - ユーザー・グループ自動同期
   - Azure AD, Okta対応

**ドキュメント:** `docs/modules/ADMIN_CONFIGURABLE_SETTINGS.md`

---

## 🏢 V2.0 Enterprise Edition - 高度なEnterprise機能

**目標:** 大企業・採用代行企業向けの高度な運用機能

**リリース時期:** 2026年10月末（Phase 5-6完了時）

**対象ユーザー:** Enterprise顧客

### 含まれる機能

#### Phase 5.1: 高度なEnterprise機能 🆕（4週間）

##### 5.1.1 AIプロンプト・プロバイダ管理UI（1.5週間）

**目的:** コード変更なしでAI挙動を制御

**主要機能:**

1. **プロンプトテンプレート管理**
   - システムプロンプト編集
   - 変数システム（`{{candidateName}}`, `{{position}}`等）
   - バージョン管理（Git風の履歴）
   - A/Bテスト機能
   - ロールバック機能

2. **プロンプトテストUI**
   - リアルタイムプレビュー
   - テストケース実行
   - レスポンス比較

3. **AIプロバイダ管理**
   - プロバイダ切り替え（Bedrock Claude, GPT-4, Gemini）
   - APIキー設定
   - 使用量トラッキング
   - コストダッシュボード
   - フォールバック設定

**データモデル:**
```prisma
model PromptTemplate {
  id              String   @id @default(cuid())
  orgId           String?  // null = グローバル（スーパー管理者用）
  name            String
  description     String?
  content         String   @db.Text
  variables       Json     // 変数定義
  version         Int      @default(1)
  isActive        Boolean  @default(false)
  parentId        String?  // バージョン管理用
  createdBy       String
  // ... その他
}

model AIProviderConfig {
  id              String   @id @default(cuid())
  orgId           String?  // null = グローバル
  provider        AIProvider
  apiKey          String   // 暗号化
  model           String   // "claude-sonnet-4-6", "gpt-4"
  priority        Int      @default(1)
  isActive        Boolean  @default(true)
  fallbackTo      String?  // フォールバック先のID
  costPerToken    Float?
  // ... その他
}

enum AIProvider {
  BEDROCK_CLAUDE
  OPENAI_GPT4
  GOOGLE_GEMINI
  ANTHROPIC_DIRECT
}
```

**API実装:**
- `GET /api/v1/admin/prompts` - プロンプトテンプレート一覧
- `POST /api/v1/admin/prompts` - プロンプト作成
- `PUT /api/v1/admin/prompts/:id` - プロンプト更新
- `POST /api/v1/admin/prompts/:id/test` - プロンプトテスト
- `POST /api/v1/admin/prompts/:id/activate` - プロンプト有効化
- `GET /api/v1/admin/ai-providers` - プロバイダ一覧
- `POST /api/v1/admin/ai-providers` - プロバイダ設定
- `GET /api/v1/admin/ai-providers/usage` - 使用量・コスト

**UI実装:**
- `apps/web/app/[locale]/admin/prompts/page.tsx`
- `apps/web/components/admin/PromptEditor.tsx`
- `apps/web/components/admin/PromptTestRunner.tsx`
- `apps/web/components/admin/AIProviderConfig.tsx`
- `apps/web/components/admin/UsageDashboard.tsx`

**ドキュメント:** `docs/modules/AI_MANAGEMENT.md`

---

##### 5.1.2 高度なレポート・分析機能（1.5週間）

**目的:** 経営層向けレポート・高度な分析

**主要機能:**

1. **高度なフィルタ・検索**
   - 複雑な条件組み合わせ（AND/OR/NOT）
   - スコア範囲、日付範囲、カスタムフィールド
   - 保存済みフィルタ
   - クイックフィルタ（今日、今週、今月）

2. **カスタムレポートビルダー**
   - ドラッグ&ドロップでレポート作成
   - カラム選択・並び替え
   - グループ化・集計機能
   - レポートテンプレート保存

3. **Excel高度エクスポート**
   - 複数シート（サマリー、詳細、グラフ）
   - 条件付き書式
   - ピボットテーブル
   - チャート埋め込み

4. **分析ダッシュボード（経営層向け）**
   - 合格率トレンド
   - ポジション別スコア分布
   - 応募経路別コンバージョン
   - 面接官（アバター）別評価
   - 予測分析（将来の合格率予測）

**技術スタック:**
- ExcelJS (高度な機能)
- Recharts/Victory（高度なグラフ）

**API実装:**
- `POST /api/v1/reports/advanced-search` - 高度な検索
- `GET /api/v1/reports/saved-filters` - 保存済みフィルタ
- `POST /api/v1/reports/custom` - カスタムレポート生成
- `POST /api/v1/reports/advanced-export` - 高度なExcelエクスポート
- `GET /api/v1/analytics/executive-dashboard` - 経営層ダッシュボード

**UI実装:**
- `apps/web/app/[locale]/admin/reports/advanced/page.tsx`
- `apps/web/components/admin/AdvancedSearch.tsx`
- `apps/web/components/admin/CustomReportBuilder.tsx`
- `apps/web/components/admin/ExecutiveDashboard.tsx`

**ドキュメント:** `docs/modules/ENTERPRISE_FEATURES.md` (Section 4)

---

##### 5.1.3 データ管理・アーカイブ機能（1週間）

**目的:** データライフサイクル管理、コンプライアンス対応

**主要機能:**

1. **ソフトデリート**
   - 論理削除（deleted_at フィールド）
   - ゴミ箱機能（30日間保持）
   - 復元機能

2. **アーカイブ機能**
   - 古いセッションの自動アーカイブ
   - S3 Glacier移行（コスト削減）
   - アーカイブ復元リクエスト

3. **データ保持ポリシー**
   - 保持期間設定（30日、90日、1年等）
   - 自動削除スケジュール
   - コンプライアンス対応（GDPR等）

4. **監査ログ**
   - すべての重要操作をログ記録
   - 誰が、いつ、何をしたか追跡
   - 検索・フィルタ機能

**データモデル:**
```prisma
// すべてのテーブルに追加
model Session {
  // ... 既存フィールド
  deletedAt       DateTime?
  deletedBy       String?
  archiveStatus   ArchiveStatus @default(ACTIVE)
  archivedAt      DateTime?
}

enum ArchiveStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

model AuditLog {
  id              String   @id @default(cuid())
  orgId           String
  userId          String
  action          String   // "create", "update", "delete", "restore"
  entityType      String   // "Session", "User", "Scenario"
  entityId        String
  changes         Json?    // 変更内容
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime @default(now())
  // ... その他
}
```

**API実装:**
- `DELETE /api/v1/sessions/:id` - ソフトデリート
- `POST /api/v1/sessions/:id/restore` - 復元
- `POST /api/v1/sessions/:id/archive` - アーカイブ
- `GET /api/v1/audit-logs` - 監査ログ取得

**ドキュメント:** `docs/modules/ENTERPRISE_FEATURES.md` (Section 5)

---

##### 5.1.4 ブランディング・カスタマイズ（1週間）

**目的:** Enterprise顧客のブランド体験統一

**主要機能:**

1. **ホワイトラベリング**
   - カスタムロゴアップロード
   - ブランドカラー設定（Primary, Secondary, Accent）
   - カスタムフォント
   - ファビコン設定

2. **候補者ページカスタマイズ**
   - ヘッダー・フッターテキスト編集
   - カスタムメッセージ
   - 利用規約・プライバシーポリシーリンク

3. **メールテンプレートカスタマイズ**
   - 招待メールのカスタマイズ
   - ブランドロゴ挿入
   - カスタムメッセージ

**データモデル:**
```prisma
model OrganizationBranding {
  id              String   @id @default(cuid())
  orgId           String   @unique
  logoUrl         String?
  faviconUrl      String?
  primaryColor    String?  // HEX
  secondaryColor  String?
  accentColor     String?
  customFont      String?
  headerText      Json?    // 多言語対応
  footerText      Json?
  welcomeMessage  Json?
  // ... その他
}
```

**API実装:**
- `GET /api/v1/admin/branding` - ブランディング設定取得
- `PUT /api/v1/admin/branding` - ブランディング設定更新
- `POST /api/v1/admin/branding/logo` - ロゴアップロード

**UI実装:**
- `apps/web/app/[locale]/admin/branding/page.tsx`
- `apps/web/components/admin/BrandingEditor.tsx`
- `apps/web/components/admin/ColorPicker.tsx`

**ドキュメント:** `docs/modules/ENTERPRISE_FEATURES.md` (Section 6)

---

#### Phase 5.2: 高度なATS連携（1週間）

**目的:** 国内ATS 3社追加、Webhook双方向連携

**追加ATS:**
- HRMOS採用（日本シェア1位）
- ジョブカン採用管理（日本中小企業向け）
- TALENTIO（日本スタートアップ向け）

**Webhook連携:**
- ATS側イベント → Pranceアクション
  - 候補者応募 → 自動セッション作成
  - ステージ変更 → メール送信
- Prance側イベント → ATSアクション
  - セッション完了 → ステージ更新
  - レポート生成 → ノート追加

**ドキュメント:** `docs/modules/ATS_INTEGRATION.md`

---

#### Phase 5.3: プラグインシステム（1週間）

**目的:** サードパーティ拡張機能の開発を可能に

**主要機能:**

1. **プラグインSDK**
   - プラグインインターフェース定義
   - マニフェスト仕様（plugin.yaml）
   - エクステンションポイント

2. **プラグインマーケットプレイス（将来）**
   - 公式・サードパーティプラグイン配布
   - インストール・アンインストール

3. **サンプルプラグイン**
   - Slack通知プラグイン
   - カスタムスコアリングプラグイン

**ドキュメント:** `docs/modules/PLUGIN_SYSTEM.md`

---

#### Phase 6: 最適化・スケール（3週間）

**主要タスク:**

1. **パフォーマンス最適化**
   - Lambda最適化（メモリ・タイムアウト調整）
   - Provisioned Concurrency設定
   - DynamoDB最適化
   - CloudFront キャッシュ戦略

2. **監視・アラート強化**
   - CloudWatch Dashboards作成
   - カスタムメトリクス追加
   - アラート設定（Error Rate、Latency、Cost）
   - X-Ray トレース分析

3. **コスト最適化**
   - Cost Explorer分析
   - S3 ライフサイクルポリシー設定
   - Aurora Serverless v2スケール調整

---

## 📅 実装スケジュール（全体）

### ガントチャート（26週間 = 約6ヶ月）

```
Phase 0: 基盤構築                    [====]                                                 (2週間) ✅ 完了
Phase 1: MVP - コア会話機能              [==============]                                    (6週間) ✅ 完了
Phase 2: 録画・解析・レポート                     [==========]                             (5週間) 🔄 進行中（30%）
  - 2.1 録画機能                                  [====]                                   (1週間) ✅ 完了
  - 2.2 解析機能                                      [====]                               (2週間) 🔄 進行中
  - 2.3 レポート生成                                      [====]                           (2週間) 未着手
────────────────────────────────────────────────────────────────────────────────────────────────
           2週   4週   6週   8週  10週  12週  14週  16週  18週  20週  22週  24週  26週  28週  30週
                                               ↑ MVP Release
Phase 2.5: ゲストユーザーシステム                             [======]                      (3週間) 🆕 計画中
Phase 3: Enterprise基本機能                                       [==========]              (5週間) 🆕 計画中
  - 3.1.1 XLSX一括登録                                            [====]                    (2週間)
  - 3.1.2 基本ATS連携                                                 [===]                 (1.5週間)
  - 3.1.3 基本レポート・分析                                              [===]             (1.5週間)
────────────────────────────────────────────────────────────────────────────────────────────────
                                                         14週  16週  18週  20週  22週  24週  26週
                                                                    ↑ Beta Release
Phase 4: SaaS完成                                                          [============]   (6週間) 計画中
  - 4.1 サブスクリプション・課金                                            [====]          (2週間)
  - 4.2 ベンチマークシステム                                                    [===]       (1.5週間)
  - 4.3 外部連携API                                                             [===]       (1.5週間)
  - 4.4 セキュリティ・SSO                                                           [==]   (1週間)
────────────────────────────────────────────────────────────────────────────────────────────────
                                                                   20週  22週  24週  26週  28週
                                                                                 ↑ V1.0 GA
Phase 5: Enterprise高度機能                                                         [========] (4週間) 🆕 計画中
  - 5.1.1 AIプロンプト・プロバイダUI                                                [===]     (1.5週間)
  - 5.1.2 高度なレポート・分析                                                         [===] (1.5週間)
  - 5.1.3 データ管理・アーカイブ                                                           [==] (1週間)
  - 5.1.4 ブランディング                                                                 [==] (1週間)
  - 5.2 高度なATS連携                                                                    [==] (1週間)
  - 5.3 プラグインシステム                                                                [==] (1週間)
Phase 6: 最適化・スケール                                                                   [======] (3週間)
────────────────────────────────────────────────────────────────────────────────────────────────
                                                                         26週  28週  30週  32週
                                                                                         ↑ V2.0 Enterprise
```

### マイルストーン

| マイルストーン      | 週 | 累積週 | 目標                   | 成果物                                |
| ------------------- | -- | ------ | ---------------------- | ------------------------------------- |
| **Phase 0 完了** ✅ | 2  | 2      | インフラ基盤確立       | AWS環境、Prismaスキーマ、CI/CD        |
| **Phase 1 完了** ✅ | 6  | 8      | MVP動作                | 基本会話セッション実行可能            |
| **MVP Release** 🎯  | 5  | 13     | 録画・解析完成         | セッション録画・解析・レポート生成    |
| **Phase 2.5 完了**  | 3  | 16     | ゲストユーザー対応     | 外部ユーザーアクセス・自動評価        |
| **Phase 3 完了**    | 5  | 21     | 基本Enterprise機能     | XLSX一括登録、ATS連携、検索・分析     |
| **Beta Release** 🎯 | -  | 21     | Beta版リリース         | 内部＋外部ユーザー、小規模Enterprise  |
| **Phase 4 完了**    | 6  | 27     | SaaS完成               | サブスクリプション、API、ベンチマーク |
| **V1.0 GA** 🎯      | -  | 27     | 一般提供開始           | 完全なSaaSプラットフォーム            |
| **Phase 5 完了**    | 4  | 31     | Enterprise高度機能     | AI管理UI、高度分析、ブランディング    |
| **Phase 6 完了**    | 3  | 34     | 最適化                 | パフォーマンス改善、監視強化          |
| **V2.0 Enterprise** | -  | 34     | Enterprise Edition完成 | 大企業向け完全機能                    |

---

## 🎯 優先度マトリクス

### Phase 2.5-3: Beta Release向け（次の8週間）

| 優先度 | 機能                   | 理由                             | 期間     |
| ------ | ---------------------- | -------------------------------- | -------- |
| P0     | Phase 2.2完了          | MVP Release必須                  | 2週間    |
| P0     | Phase 2.3完了          | MVP Release必須                  | 2週間    |
| P1     | ゲストユーザーシステム | 外部候補者アクセス（最重要差別化）| 3週間    |
| P1     | XLSX一括登録           | 大規模運用効率化（90%時間削減）  | 2週間    |
| P2     | 基本ATS連携            | 既存ワークフロー統合             | 1.5週間  |
| P2     | 基本レポート・分析     | データドリブン意思決定           | 1.5週間  |

### Phase 4: V1.0 GA向け（次の14週間）

| 優先度 | 機能                   | 理由                       | 期間     |
| ------ | ---------------------- | -------------------------- | -------- |
| P0     | サブスクリプション課金 | 収益化必須                 | 2週間    |
| P1     | 外部連携API            | エコシステム構築           | 1.5週間  |
| P2     | ベンチマークシステム   | ユーザーエンゲージメント向上| 1.5週間  |
| P3     | セキュリティ・SSO      | Enterprise顧客要件         | 1週間    |

### Phase 5-6: V2.0 Enterprise向け（次の21週間）

| 優先度 | 機能                        | 理由                       | 期間     |
| ------ | --------------------------- | -------------------------- | -------- |
| P1     | AIプロンプト・プロバイダUI  | 差別化・カスタマイズ性     | 1.5週間  |
| P1     | 高度なレポート・分析        | 経営層向けインサイト       | 1.5週間  |
| P2     | データ管理・アーカイブ      | コンプライアンス対応       | 1週間    |
| P2     | ブランディング              | Enterprise体験向上         | 1週間    |
| P3     | 高度なATS連携               | 日本市場対応               | 1週間    |
| P3     | プラグインシステム          | 拡張性                     | 1週間    |

---

## 📊 リソース配分推奨

### チーム構成（6-8名）

**フルタイムコアチーム:**
- Frontend Engineer x2（React/Next.js/Three.js）
- Backend Engineer x2（Lambda/Node.js/Prisma）
- DevOps Engineer x1（AWS CDK/CI/CD）
- AI/ML Engineer x1（AI統合/プロンプト最適化）

**パートタイム/コンサルタント:**
- UI/UX Designer（週2-3日）
- QA Engineer（週2-3日）

### 並行開発戦略

**Phase 2.5-3（Beta Release）:**
```
Week 1-2: Phase 2.2完了
  Frontend A: スコア表示UI
  Frontend B: グラフ表示UI
  Backend C: AnalysisOrchestrator
  Backend D: Analysis API
  AI Engineer: スコア計算アルゴリズム調整

Week 3-4: Phase 2.3完了
  Frontend A: レポート管理UI
  Frontend B: レポートビューア
  Backend C: レポート生成API
  Backend D: PDF生成（Puppeteer）
  AI Engineer: AI改善提案

Week 5-7: ゲストユーザーシステム（並行）
  Frontend A: ゲストアクセス画面
  Frontend B: ゲストセッション作成UI
  Backend C: ゲストセッションAPI
  Backend D: セキュリティ実装
  DevOps: Lambda Authorizer拡張

Week 8-9: XLSX一括登録（並行）
  Frontend A: アップロードUI
  Frontend B: 進捗表示UI
  Backend C: XLSXパース・バリデーション
  Backend D: Step Functions実装
  DevOps: SES設定

Week 10-11: 基本ATS連携（並行）
  Frontend A: ATS設定UI
  Backend C: Greenhouseアダプター
  Backend D: Leverアダプター
  AI Engineer: Workdayアダプター

Week 12-13: 基本レポート・分析（並行）
  Frontend A+B: 検索・フィルタUI
  Backend C+D: 検索API、Excelエクスポート
```

---

## 🔍 リスク管理

### 高リスク項目

| リスク                       | 影響 | 確率 | 緩和策                                      |
| ---------------------------- | ---- | ---- | ------------------------------------------- |
| Phase 2.2解析機能の遅延      | 高   | 中   | コア機能を優先、高度な機能は後回し          |
| XLSX処理の複雑性             | 中   | 高   | SheetJS（実績あるライブラリ）使用、PoC実施 |
| ATS API仕様の複雑性          | 中   | 中   | モックAPI使用、段階的実装                   |
| Step Functions実装の困難さ   | 中   | 中   | 既存の実装例を参考、段階的実装              |
| AI改善提案の品質             | 中   | 中   | プロンプト最適化、A/Bテスト                 |
| スケジュール遅延             | 高   | 中   | 2週間のバッファ確保、並行開発最大化         |

---

## 📝 Definition of Done（完了基準）

### 各フェーズ完了基準

**機能実装:**
- [ ] すべてのAPI実装完了
- [ ] すべてのUI実装完了
- [ ] TypeScript型エラーなし
- [ ] ESLint警告なし

**テスト:**
- [ ] 単体テスト作成・合格（カバレッジ70%以上）
- [ ] 統合テスト実行・合格
- [ ] E2Eテスト実行・合格（主要フロー）

**ドキュメント:**
- [ ] API仕様ドキュメント更新
- [ ] ユーザーマニュアル更新
- [ ] 管理者ガイド更新

**デプロイ:**
- [ ] ステージング環境デプロイ確認
- [ ] パフォーマンステスト合格
- [ ] セキュリティレビュー完了
- [ ] プロダクション環境デプロイ完了

---

## 🎉 まとめ

### 新たに追加された機能（計画にないもの）

1. **ゲストユーザーシステム**（Phase 2.5）- 3週間
2. **XLSX一括登録システム**（Phase 3.1.1）- 2週間
3. **基本ATS連携詳細実装**（Phase 3.1.2）- 1.5週間
4. **基本レポート・分析機能**（Phase 3.1.3）- 1.5週間
5. **AIプロンプト・プロバイダ管理UI**（Phase 5.1.1）- 1.5週間
6. **高度なレポート・分析機能**（Phase 5.1.2）- 1.5週間
7. **データ管理・アーカイブ機能**（Phase 5.1.3）- 1週間
8. **ブランディング・カスタマイズ**（Phase 5.1.4）- 1週間
9. **高度なATS連携（国内3社）**（Phase 5.2）- 1週間

**合計追加期間:** 約13週間

### 全体スケジュール

- **旧計画:** 31週間（Phase 0-6）
- **新計画:** 34週間（Phase 0-6 + Enterprise詳細機能）
- **追加期間:** 3週間

### 次回セッション開始時のアクション

```bash
# このドキュメントを確認
cat docs/development/COMPREHENSIVE_IMPLEMENTATION_PLAN.md

# 現在のタスク（Phase 2.2.2）を継続
# または、優先度に応じて調整
```

---

**最終更新:** 2026-03-09
**次回レビュー:** Phase 2完了時（MVP Release時）
