# 優先度ベース実装計画 - Prance Communication Platform

**作成日:** 2026-03-09
**バージョン:** 1.1
**ステータス:** 最新版（Phase 1.5-1.6追加）

---

## 🔴 CRITICAL WARNING - 最優先対応事項

### Phase 1が実用レベルでない問題

**重大な問題が発見されました:**

- ❌ **Phase 1の音声会話機能は技術的に動作しますが、実際に使えるレベルではありません**
- ❌ **ユーザーが話した後、セッション終了まで文字起こしが返ってきません（バッチ処理）**
- ❌ **AIの応答もセッション終了まで返ってきません**
- ❌ **リアルタイム会話ではなく、セッション終了後に一括処理される仕組みです**

**結論:**
**Phase 1は「完了」ではなく、「技術的に動作する」状態に過ぎません。実用レベルにするためには、Phase 1.5-1.6の実装が必須です。**

### 最優先対応: Phase 1.5-1.6（Week 0.5-3.5）

**このドキュメントに記載された全てのタスクを開始する前に、Phase 1.5-1.6を完了する必要があります。**

#### Phase 1.5: リアルタイム会話実装（Week 0.5-2.5）

- リアルタイムSTT（1秒チャンク、無音検出）
- ストリーミングAI応答（Bedrock Claude Streaming API）
- ストリーミングTTS（ElevenLabs Streaming API）
- 目標: 2-5秒の応答時間

#### Phase 1.6: 既存機能の実用レベル化（Week 2.5-3.5）

- エラーハンドリング、リトライロジック
- レート制限、パフォーマンス最適化
- 監視、分析、アラート

**詳細ドキュメント:**
→ [`PRODUCTION_READY_ROADMAP.md`](./PRODUCTION_READY_ROADMAP.md) を参照してください

### このドキュメントの読み方

**重要:** このドキュメント内の全ての「Week X」表記は、**Phase 1.5-1.6が完了した後**の週数を示しています。

実際のスケジュール換算:
- このドキュメントの "Week 1" = 実際の Week 3.5
- このドキュメントの "Week 5" = 実際の Week 7.5
- このドキュメントの "Week 13" (Beta Release) = 実際の Week 15.5

**まず `PRODUCTION_READY_ROADMAP.md` を読んで Phase 1.5-1.6 を実装してから、このドキュメントに戻ってください。**

---

## エグゼクティブサマリー

### 優先度の再調整

ユーザーの要求に基づき、以下の優先度で実装を進めます：

**P0（最優先・immediate）:**
1. **Phase 2.2-2.3完了** - 解析・レポート機能（MVP Release必須）
2. **Phase 2.5: ゲストユーザーシステム** - 外部候補者アクセス（最重要差別化）
3. **Phase 3.1.1: XLSX一括登録システム** - 大規模運用効率化（90%時間削減）

**P1（高優先・short-term）:**
4. **Phase 3.1.2: 基本ATS連携** - 既存ワークフロー統合
5. **Phase 3.1.3: 基本レポート・分析** - データドリブン意思決定

**P2-P3（中・低優先・mid/long-term）:**
6. Phase 4-6: SaaS機能、Enterprise高度機能、最適化

### 実装期間（優先度調整後）

```
Week 1-2:   Phase 2.2完了（解析機能）           ████████░░░░░░░░  P0
Week 3-4:   Phase 2.3完了（レポート生成）       ████████░░░░░░░░  P0
Week 5-7:   Phase 2.5実装（ゲストユーザー）     ████████████░░░░  P0
Week 8-9:   Phase 3.1.1実装（XLSX一括登録）     ████████░░░░░░░░  P0
Week 10-11: Phase 3.1.2実装（基本ATS連携）      ████████░░░░░░░░  P1
Week 12-13: Phase 3.1.3実装（基本レポート分析） ████████░░░░░░░░  P1
─────────────────────────────────────────────────────────────
                                    ↑ Beta Release (Week 13)
```

---

## 目次

1. [P0実装計画（最優先）](#p0実装計画最優先)
   - [Phase 2.2-2.3: 解析・レポート機能](#phase-22-23-解析レポート機能)
   - [Phase 2.5: ゲストユーザーシステム](#phase-25-ゲストユーザーシステム)
   - [Phase 3.1.1: XLSX一括登録システム](#phase-311-xlsx一括登録システム)
2. [P1実装計画（高優先）](#p1実装計画高優先)
   - [Phase 3.1.2: 基本ATS連携](#phase-312-基本ats連携)
   - [Phase 3.1.3: 基本レポート・分析](#phase-313-基本レポート分析)
3. [P2-P3実装計画（中・低優先）](#p2-p3実装計画中低優先)
4. [依存関係マトリクス](#依存関係マトリクス)
5. [リソース配分](#リソース配分)
6. [リスク管理](#リスク管理)

---

## P0実装計画（最優先）

### Phase 2.2-2.3: 解析・レポート機能
### 📊 最新進捗状況（2026-03-09更新）

**Phase 2.2 進捗: 85%完了**

| Task | 計画 | 実績 | ステータス |
|------|------|------|----------|
| 2.2.1 データベース | Week 0 | ✅ 2026-03-09 | 完了 |
| 2.2.2 音声解析 | Day 1-2 | ✅ 2026-03-09 | 完了 |
| 2.2.3 統合処理 | Day 3-4 | ✅ 2026-03-09 | 完了 |
| 2.2.4 API実装 | Day 6-7 | 🔄 85% | ほぼ完了（CDK統合のみ残り） |
| 2.2.5 UI実装 | Day 8-10 | ⏸️ 0% | 次のタスク |

**詳細セッション記録:**
→ [`docs/progress/SESSION_2026-03-09_PHASE_2.2_INTEGRATION.md`](../progress/SESSION_2026-03-09_PHASE_2.2_INTEGRATION.md)

**完了した実装（2026-03-09）:**
- ✅ AudioAnalyzer単体テスト（200行）
- ✅ AnalysisOrchestrator統合処理（460行）
- ✅ 3つのAnalysis API実装（558行）
- ✅ WebSocket自動解析トリガー統合
- 🔄 CDK統合準備完了（バックアップ保存）

**次のマイルストーン:**
1. CDK統合完了（15分）
2. デプロイ・テスト（Day 1）
3. フロントエンドUI実装（Day 2-4）

---


**優先度:** P0（MVP Release必須）
**期間:** Week 1-4（4週間）
**理由:** MVP Releaseの完成に必須。解析・レポートがないとプロダクトとして成立しない。

#### Week 1: Phase 2.2.2-2.2.3実装（解析機能）

**Day 1-2: AudioAnalyzer実装**

```typescript
// infrastructure/lambda/shared/analysis/audio-analyzer.ts

タスク:
□ フィラーワード検出実装
  - 正規表現パターン定義（日本語: "えー", "あのー", "その"）
  - 正規表現パターン定義（英語: "um", "uh", "like")
  - トランスクリプトテキストから検出
  - カウント・頻度計算

□ 話速計算実装
  - 単語数 / (文字起こし時間 - 無音時間)
  - 理想値: 120-150語/分（英語）、300-350文字/分（日本語）

□ ピッチ・音量変動分析実装
  - AWS Rekognition音声メトリクスから取得
  - 標準偏差計算
  - スコアリング（0-100）

□ 単体テスト実装
  - テストケース: 10サンプル音声
  - カバレッジ: 80%以上
```

**Day 3-4: AnalysisOrchestrator実装**

```typescript
// infrastructure/lambda/shared/analysis/orchestrator.ts

タスク:
□ オーケストレーションロジック実装
  - RekognitionAnalyzer.analyze() 実行
  - FrameAnalyzer.analyze() 実行
  - AudioAnalyzer.analyze() 実行
  - 3つの結果を統合

□ エラーハンドリング実装
  - 部分的失敗時の処理（1つの解析失敗でも継続）
  - タイムアウト処理（30秒）
  - リトライロジック（3回）

□ 進捗追跡実装
  - DynamoDBに進捗状況を保存
  - WebSocketで進捗通知（0%, 33%, 66%, 100%）

□ 統合テスト実装
  - エンドツーエンドテスト（録画→解析→スコア）
```

**Day 5: ScoreCalculator統合とテスト**

```typescript
// infrastructure/lambda/shared/analysis/score-calculator.ts

タスク:
□ ScoreCalculatorとOrchestrator統合
  - 解析結果からスコア計算
  - カテゴリ別スコア（表情、音声、会話）
  - 総合スコア（重み付け平均）

□ データベース保存実装
  - EmotionAnalysis テーブルへ保存
  - AudioAnalysis テーブルへ保存
  - SessionScore テーブルへ保存

□ E2Eテスト実施
  - 実際のセッション録画を使用
  - 全パイプラインの動作確認
  - パフォーマンステスト（処理時間 < 60秒）
```

#### Week 2: Phase 2.2.4-2.2.5実装（API・UI）

**Day 6-7: Analysis API実装**

```typescript
// infrastructure/lambda/sessions/analysis-trigger/index.ts
// infrastructure/lambda/sessions/get-analysis/index.ts

タスク:
□ POST /sessions/:id/analyze 実装
  - セッション完了時に自動トリガー
  - AnalysisOrchestrator呼び出し
  - ステータス更新（PROCESSING → COMPLETED）

□ GET /sessions/:id/analysis 実装
  - 解析結果取得API
  - EmotionAnalysis + AudioAnalysis + SessionScore結合
  - レスポンス整形

□ WebSocket通知実装
  - 解析開始通知
  - 進捗通知（0%, 33%, 66%, 100%）
  - 完了通知

□ Lambda関数デプロイ
  - CDKスタック更新
  - デプロイ・動作確認
```

**Day 8-10: フロントエンドUI実装**

```typescript
// apps/web/app/[locale]/sessions/[id]/analysis/page.tsx
// apps/web/components/sessions/AnalysisView.tsx
// apps/web/components/sessions/ScoreChart.tsx

タスク:
□ 解析結果表示ページ実装
  - スコア表示（総合スコア、カテゴリ別スコア）
  - レーダーチャート（Recharts使用）
  - 時系列グラフ（表情変化、音量変化）

□ 詳細データ表示実装
  - 表情検出結果テーブル
  - フィラーワード一覧
  - ハイライトシーン表示

□ 解析トリガーボタン実装
  - "解析を開始" ボタン
  - 進捗バー（WebSocketリアルタイム更新）
  - 完了後の自動遷移

□ 統合テスト実施
  - ブラウザE2Eテスト（Playwright）
  - 全フロー確認（セッション→録画→解析→結果表示）
```

#### Week 3-4: Phase 2.3実装（レポート生成）

**Day 11-13: レポートテンプレート実装**

```typescript
// infrastructure/lambda/reports/generate/index.ts
// infrastructure/lambda/shared/reports/template.tsx

タスク:
□ React-PDF テンプレート実装
  - 表紙（組織ロゴ、候補者名、日付）
  - サマリーページ（総合スコア、カテゴリ別スコア）
  - 詳細ページ（解析結果、グラフ）
  - フィードバックページ（AI改善提案）

□ グラフ生成実装
  - レーダーチャート（Chart.js/Victory）
  - 時系列グラフ
  - スコア分布グラフ

□ スタイリング実装
  - 企業ブランディング対応
  - 多言語対応（日本語・英語）
```

**Day 14-15: AI改善提案実装**

```typescript
// infrastructure/lambda/shared/reports/ai-feedback.ts

タスク:
□ Claude API統合
  - AWS Bedrock Claude呼び出し
  - プロンプト設計（解析結果→改善提案）
  - レスポンス整形

□ 改善提案生成ロジック実装
  - 弱点カテゴリの特定
  - 具体的なアドバイス生成
  - 推奨トレーニングシナリオ提案

□ キャッシング実装
  - DynamoDBに改善提案をキャッシュ
  - 同じセッションの再生成を防止
```

**Day 16-18: レポート管理API・UI実装**

```typescript
// infrastructure/lambda/reports/create/index.ts
// infrastructure/lambda/reports/list/index.ts
// apps/web/app/[locale]/reports/page.tsx
// apps/web/components/reports/ReportViewer.tsx

タスク:
□ POST /reports 実装
  - レポート生成トリガー
  - PDF生成（Puppeteer or React-PDF）
  - S3保存、CloudFront URL生成

□ GET /reports/:id 実装
  - レポートメタデータ取得
  - PDF URL取得

□ フロントエンド実装
  - レポート一覧ページ
  - レポートビューア（PDF.js使用）
  - ダウンロードボタン

□ E2Eテスト実施
  - レポート生成フロー確認
  - PDF品質確認
  - パフォーマンステスト（生成時間 < 30秒）
```

**Phase 2.2-2.3 完了基準:**
- [ ] 全解析機能が動作（表情・音声・スコア）
- [ ] 解析処理時間 < 60秒（1分セッション）
- [ ] レポート生成時間 < 30秒
- [ ] E2Eテスト合格（録画→解析→レポート）
- [ ] ドキュメント更新（API仕様、ユーザーマニュアル）

---

### Phase 2.5: ゲストユーザーシステム

**優先度:** P0（最重要差別化機能）
**期間:** Week 5-7（3週間）
**理由:** 外部候補者アクセスを可能にし、採用面接の自動化を実現。市場での差別化ポイント。

#### Week 5: データモデル・認証実装

**Day 19-20: Prismaスキーマ拡張**

```prisma
// packages/database/prisma/schema.prisma

タスク:
□ GuestSession モデル定義
  model GuestSession {
    id              String   @id @default(cuid())
    accessToken     String   @unique  // URL用のランダムトークン
    password        String              // ハッシュ化パスワード
    sessionId       String   @unique
    session         Session  @relation(...)
    guestName       String?
    guestEmail      String?
    expiresAt       DateTime
    maxAccessCount  Int      @default(1)
    accessCount     Int      @default(0)
    isExpired       Boolean  @default(false)
    createdBy       String
    creator         User     @relation(...)
    orgId           String
    organization    Organization @relation(...)
    metadata        Json?
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
    @@index([accessToken])
    @@index([sessionId])
    @@map("guest_sessions")
  }

□ マイグレーション実行
  - npx prisma migrate dev --name add_guest_sessions
  - npx prisma generate
  - Lambda関数デプロイ（Prisma Client更新）
  - マイグレーション実行確認
```

**Day 21-22: ゲストセッションAPI実装**

```typescript
// infrastructure/lambda/guest-sessions/create/index.ts
// infrastructure/lambda/guest-sessions/verify/index.ts

タスク:
□ POST /api/v1/guest-sessions 実装
  - リクエストバリデーション
  - SessionレコードとGuestSessionレコード作成
  - アクセストークン生成（crypto.randomBytes(32)）
  - パスワードハッシュ化（bcrypt）
  - 有効期限設定（デフォルト7日）
  - アクセスURL生成

□ POST /api/v1/guest/verify 実装
  - アクセストークン検証
  - パスワード検証（bcrypt.compare）
  - 有効期限チェック
  - アクセスカウント更新
  - JWT発行（ゲスト専用、短期間有効）

□ GET /api/v1/guest/session/:token 実装
  - セッション情報取得
  - シナリオ・アバター情報取得
  - 認証済みゲストのみアクセス可能

□ 単体テスト実装
  - 正常系テスト
  - 異常系テスト（期限切れ、パスワード不一致）
```

**Day 23: Lambda Authorizer拡張**

```typescript
// infrastructure/lambda/authorizers/guest-authorizer/index.ts

タスク:
□ ゲスト用Lambda Authorizer実装
  - JWT検証（ゲスト専用トークン）
  - ゲストセッション情報抽出
  - アクセス可能リソースの制限
    - 許可: /guest/*, /sessions/:id/start, /websocket
    - 拒否: /admin/*, /users/*, /scenarios/*

□ API Gateway統合
  - ゲストエンドポイントにAuthorizer適用
  - 既存のユーザー認証と共存

□ テスト実施
  - 認証成功・失敗テスト
  - アクセス制限テスト
```

#### Week 6: フロントエンド実装

**Day 24-25: ゲストセッション作成UI**

```typescript
// apps/web/app/[locale]/sessions/[id]/invite-guest/page.tsx
// apps/web/components/sessions/GuestInviteForm.tsx

タスク:
□ ゲスト招待フォーム実装
  - 候補者名・メール入力
  - 有効期限選択（1日、3日、7日、14日、30日）
  - パスワード生成オプション
    - 自動生成（4-8桁PIN）
    - 手動入力
  - メール送信オプション（オン/オフ）

□ 招待URL・パスワード表示
  - コピー機能（navigator.clipboard）
  - QRコード生成（オプション）
  - メールプレビュー

□ バリデーション実装
  - メールアドレス検証
  - パスワード強度チェック
  - 有効期限範囲チェック

□ E2Eテスト実施
```

**Day 26-28: ゲストアクセス画面実装**

```typescript
// apps/web/app/[locale]/guest/[token]/page.tsx
// apps/web/components/guest/GuestLogin.tsx
// apps/web/components/guest/GuestSessionPlayer.tsx

タスク:
□ ゲストログイン画面実装
  - パスワード入力フォーム
  - "アクセス" ボタン
  - エラーメッセージ表示
  - 多言語対応

□ セッション開始画面実装
  - シナリオ・アバター情報表示
  - "面接を開始" ボタン
  - 注意事項表示（録画・評価について）

□ SessionPlayer統合
  - ゲスト専用SessionPlayer実装
  - 既存のSessionPlayerを再利用
  - ゲスト固有のUI調整
    - ナビゲーション非表示
    - 終了後のリダイレクト（Thank youページ）

□ Thank youページ実装
  - 完了メッセージ
  - 次のステップ案内
  - ウィンドウクローズボタン

□ E2Eテスト実施
  - ゲストアクセスフロー確認
  - セッション実行確認
  - 録画・評価確認
```

#### Week 7: セキュリティ強化・テスト

**Day 29-30: セキュリティ機能実装**

```typescript
タスク:
□ レート制限実装
  - ゲストアクセスAPIにレート制限適用
  - DynamoDB使用（トークンごとに10回/分）
  - ブルートフォース攻撃対策

□ アクセスログ実装
  - 全ゲストアクセスをログ記録
  - CloudWatch Logs
  - 監査用ログ（誰が、いつ、どのセッションに）

□ 自動削除機能実装
  - EventBridge定期実行（毎日）
  - 期限切れGuestSessionを自動削除
  - 関連Sessionデータの処理（オプション）

□ データ隔離検証
  - ゲストが他のゲストデータにアクセスできないことを確認
  - ゲストが内部データにアクセスできないことを確認
```

**Day 31-33: 統合テスト・ドキュメント**

```typescript
タスク:
□ E2Eテスト実施
  - シナリオ1: 採用面接（候補者アクセス）
  - シナリオ2: 研修評価（受講者アクセス）
  - シナリオ3: 期限切れアクセス（エラー確認）
  - シナリオ4: 不正アクセス試行（セキュリティ確認）

□ パフォーマンステスト
  - 100並行ゲストアクセス
  - Lambda Concurrency確認
  - DynamoDBスロットリング確認

□ ドキュメント作成
  - ユーザーマニュアル（ゲスト招待ガイド）
  - API仕様書更新
  - セキュリティガイドライン

□ デモビデオ作成
  - ゲストアクセスのデモ
  - 採用担当者向けチュートリアル
```

**Phase 2.5 完了基準:**
- [ ] ゲストユーザーがログインなしでセッション実行可能
- [ ] アクセスURL・パスワード生成機能が動作
- [ ] 自動録画・評価が正常動作
- [ ] セキュリティテスト合格（不正アクセス防止）
- [ ] E2Eテスト合格（全フロー）
- [ ] ドキュメント完成

---

### Phase 3.1.1: XLSX一括登録システム

**優先度:** P0（大規模運用の鍵）
**期間:** Week 8-9（2週間）
**理由:** 数百〜数千人の候補者を5分で登録。手動入力と比較して90%の時間削減。

#### Week 8: バックエンド実装

**Day 34-35: XLSXテンプレート生成**

```typescript
// infrastructure/lambda/bulk-invitations/template/index.ts

タスク:
□ XLSXテンプレート生成実装
  - ExcelJS使用
  - シート1: 候補者リスト（列定義）
    - Name (必須)
    - Email (必須、データ検証: メール形式)
    - Phone (任意)
    - Position (任意、ドロップダウン)
    - Source (任意、ドロップダウン)
    - University (任意)
    - Major (任意)
  - シート2: 設定（オプション）
  - シート3: 記入例

□ データ検証ルール追加
  - Email列: メール形式チェック
  - Position列: ドロップダウン（Engineer, Designer, Sales等）
  - Source列: ドロップダウン（LinkedIn, Indeed等）

□ GET /api/v1/bulk-invitations/template 実装
  - テンプレートファイル生成
  - S3一時保存
  - CloudFront URL返却

□ テスト実施
  - Excelで開いてデータ検証動作確認
```

**Day 36-38: XLSXアップロード・バリデーション実装**

```typescript
// infrastructure/lambda/bulk-invitations/upload/index.ts
// infrastructure/lambda/shared/xlsx/validator.ts

タスク:
□ POST /api/v1/bulk-invitations/upload 実装
  - multipart/form-data パース（busboy使用）
  - ファイルサイズ制限（最大10MB）
  - 拡張子チェック（.xlsxのみ）
  - S3アップロード
  - BulkInvitationレコード作成（status: PENDING）

□ XLSX バリデーター実装
  - ExcelJS使用
  - 必須列チェック（Name, Email）
  - データ型チェック
  - メールアドレス重複チェック
  - 最大行数チェック（1000行）
  - エラーレポート生成（行番号、エラー内容）

□ Step Functions ワークフロー定義
  ValidateTask:
    - Lambdaで XLSX バリデーション実行
    - エラーがある場合: FAILED状態、エラーレポート生成
    - エラーがない場合: 次のステップへ

  ProcessTask:
    - 各行をループ処理
    - GuestSession作成
    - Session作成
    - 進捗更新（DynamoDB）

  SendEmailsTask:
    - SESで招待メール一斉送信
    - バッチ処理（100件ずつ）
    - 送信ログ記録

  CompleteTask:
    - BulkInvitationステータス更新（COMPLETED）

□ Lambda関数デプロイ
  - CDKスタック更新
  - Step Functions定義
  - デプロイ・動作確認
```

**Day 39-40: バッチ処理実装**

```typescript
// infrastructure/lambda/bulk-invitations/process/index.ts
// infrastructure/lambda/bulk-invitations/send-emails/index.ts

タスク:
□ バッチ処理Lambda実装
  - XLSX解析（ExcelJS）
  - 各行からGuestSession + Session作成
  - トランザクション処理（部分失敗時の継続）
  - 進捗更新（DynamoDB、WebSocket通知）
  - エラーハンドリング

□ メール送信Lambda実装
  - SES統合
  - メールテンプレート（HTML）
  - バッチ送信（100件ずつ）
  - 送信失敗時のリトライ
  - 送信ログ記録

□ パフォーマンステスト
  - 1000行XLSXで処理時間測定
  - 目標: 5分以内
  - Lambda Concurrency調整
```

#### Week 9: フロントエンド実装・テスト

**Day 41-42: アップロードUI実装**

```typescript
// apps/web/app/[locale]/admin/bulk-invitations/page.tsx
// apps/web/components/admin/BulkInvitationUploader.tsx

タスク:
□ アップロード画面実装
  - ファイル選択（ドラッグ&ドロップ対応）
  - シナリオ・アバター選択
  - 有効期限設定
  - "アップロード" ボタン
  - バリデーション（クライアント側）

□ テンプレートダウンロードボタン
  - "テンプレートをダウンロード" ボタン
  - API呼び出し
  - ファイルダウンロード

□ 進捗表示UI実装
  - プログレスバー（WebSocketリアルタイム更新）
  - ステータス表示（VALIDATING → PROCESSING → SENDING_EMAILS → COMPLETED）
  - 成功・失敗カウント表示
  - 推定残り時間表示

□ エラーレポート表示
  - エラーがある場合、エラーリスト表示
  - エラーXLSXダウンロードボタン
  - 修正方法のガイド
```

**Day 43-45: 統合テスト・ドキュメント**

```typescript
タスク:
□ E2Eテスト実施
  - シナリオ1: 正常系（100件アップロード）
  - シナリオ2: バリデーションエラー（無効メール）
  - シナリオ3: 部分失敗（一部メール送信失敗）
  - シナリオ4: 大規模テスト（1000件アップロード）

□ パフォーマンステスト
  - 1000件処理時間測定（目標: 5分）
  - Lambda Concurrency確認
  - SES送信制限確認
  - Step Functions実行ログ確認

□ ドキュメント作成
  - XLSX一括登録ガイド
  - テンプレート記入方法
  - トラブルシューティング
  - API仕様書更新

□ デモビデオ作成
  - XLSX一括登録のデモ
  - 採用担当者向けチュートリアル
```

**Phase 3.1.1 完了基準:**
- [ ] XLSXテンプレート生成機能が動作
- [ ] XLSX アップロード・バリデーション機能が動作
- [ ] 1000件を5分以内で処理可能
- [ ] メール送信成功率 > 95%
- [ ] E2Eテスト合格
- [ ] ドキュメント完成

---

## P1実装計画（高優先）

### Phase 3.1.2: 基本ATS連携

**優先度:** P1（既存ワークフロー統合）
**期間:** Week 10-11（1.5週間）
**対象ATS:** Greenhouse, Lever, Workday

#### Week 10: Greenhouseアダプター実装

**Day 46-48: Greenhouseアダプター実装**

```typescript
// packages/shared/src/ats/greenhouse-adapter.ts
// infrastructure/lambda/ats/connect/index.ts
// infrastructure/lambda/ats/webhook/index.ts

タスク:
□ GreenhouseAdapter実装
  - OAuth2.0認証フロー
  - GET /candidates API統合
  - GET /candidate/:id API統合
  - POST /candidates/:id/scorecards API統合
  - Webhook署名検証
  - Webhookペイロード解析

□ Prismaスキーマ拡張
  model ATSConnection { ... }
  model ATSCandidate { ... }
  - マイグレーション実行

□ POST /api/v1/ats/connect 実装
  - OAuth2.0フロー開始
  - コールバック処理
  - アクセストークン保存（暗号化）

□ POST /api/v1/ats/webhook/:connectionId 実装
  - Webhook受信
  - 署名検証
  - イベント処理（candidate.stage_changed）
  - ゲストセッション自動作成

□ 単体テスト実装
```

**Day 49-50: Lever・Workdayアダプター実装**

```typescript
// packages/shared/src/ats/lever-adapter.ts
// packages/shared/src/ats/workday-adapter.ts

タスク:
□ LeverAdapter実装
  - OAuth2.0認証
  - 候補者取得API
  - スコアカード送信API
  - Webhook統合

□ WorkdayAdapter実装
  - OAuth2.0認証
  - 候補者取得API
  - スコアカード送信API
  - Webhook統合

□ 単体テスト実装
```

#### Week 11: フロントエンド・テスト

**Day 51-52: ATS設定UI実装**

```typescript
// apps/web/app/[locale]/admin/ats/page.tsx
// apps/web/components/admin/ATSConnection.tsx

タスク:
□ ATS設定画面実装
  - ATS選択（Greenhouse, Lever, Workday）
  - OAuth2.0認証ボタン
  - 接続テストボタン
  - 接続状態表示

□ 候補者同期UI実装
  - "同期を開始" ボタン
  - 同期進捗表示
  - 同期履歴表示

□ ジョブマッピング設定UI
  - 職種とシナリオのマッピング設定
  - ドラッグ&ドロップUI
```

**Day 53-54: 統合テスト・ドキュメント**

```typescript
タスク:
□ E2Eテスト実施
  - Greenhouse連携テスト（実際のGreenhouseアカウント使用）
  - Webhook受信テスト
  - 候補者同期テスト
  - 結果エクスポートテスト

□ ドキュメント作成
  - ATS連携ガイド（Greenhouse, Lever, Workday）
  - OAuth設定手順
  - トラブルシューティング
```

**Phase 3.1.2 完了基準:**
- [ ] Greenhouse, Lever, Workday連携が動作
- [ ] 候補者同期が正常動作
- [ ] 結果エクスポートが正常動作
- [ ] E2Eテスト合格
- [ ] ドキュメント完成

---

### Phase 3.1.3: 基本レポート・分析

**優先度:** P1（データドリブン意思決定）
**期間:** Week 12-13（1.5週間）

#### Week 12: 検索・フィルタ実装

**Day 55-57: 候補者検索API実装**

```typescript
// infrastructure/lambda/candidates/search/index.ts

タスク:
□ GET /api/v1/candidates/search 実装
  - クエリパラメータ解析
    - q: 名前・メール検索
    - scoreMin, scoreMax: スコア範囲
    - dateFrom, dateTo: 日付範囲
    - status: セッションステータス
    - position: ポジション
  - Prisma動的クエリ生成
  - ページネーション（limit, offset）
  - ソート（score, date, name）

□ 全文検索実装
  - PostgreSQL全文検索（tsvector）
  - マイグレーション実行

□ パフォーマンス最適化
  - インデックス追加
  - クエリチューニング
```

**Day 58-59: Excelエクスポート実装**

```typescript
// infrastructure/lambda/reports/export-excel/index.ts

タスク:
□ POST /api/v1/reports/export-excel 実装
  - 検索条件を受け取る
  - 候補者データ取得
  - ExcelJSでExcelファイル生成
    - シート1: サマリー（総数、平均スコア、合格率）
    - シート2: 候補者リスト（全カラム）
    - シート3: スコア分布（グラフ）
  - S3保存
  - ダウンロードURL返却

□ カラム選択機能実装
  - リクエストで選択カラムを指定
  - 動的にExcelカラム生成
```

#### Week 13: ダッシュボード・テスト

**Day 60-62: 分析ダッシュボード実装**

```typescript
// apps/web/app/[locale]/admin/analytics/page.tsx
// apps/web/components/admin/AnalyticsDashboard.tsx
// infrastructure/lambda/analytics/dashboard/index.ts

タスク:
□ GET /api/v1/analytics/dashboard 実装
  - 候補者総数
  - 平均スコア
  - 合格率（閾値ベース）
  - 時系列データ（日別セッション数）
  - スコア分布データ

□ ダッシュボードUI実装
  - KPIカード（総数、平均スコア、合格率）
  - 時系列グラフ（Recharts）
  - スコア分布ヒストグラム
  - ポジション別スコア比較
```

**Day 63-65: 検索・フィルタUI・テスト**

```typescript
// apps/web/app/[locale]/admin/candidates/page.tsx
// apps/web/components/admin/CandidateSearch.tsx

タスク:
□ 候補者検索UI実装
  - 検索ボックス（名前・メール）
  - フィルタパネル
    - スコア範囲スライダー
    - 日付範囲ピッカー
    - ステータス選択
    - ポジション選択
  - ソート選択（スコア、日付、名前）
  - ページネーション

□ Excelエクスポートボタン
  - "Excelエクスポート" ボタン
  - カラム選択ダイアログ
  - ダウンロード処理

□ E2Eテスト実施
  - 検索・フィルタ動作確認
  - Excelエクスポート確認
  - ダッシュボード表示確認

□ ドキュメント作成
  - レポート・分析機能ガイド
  - Excelエクスポート手順
```

**Phase 3.1.3 完了基準:**
- [ ] 候補者検索・フィルタが動作
- [ ] Excelエクスポートが動作
- [ ] 分析ダッシュボードが動作
- [ ] E2Eテスト合格
- [ ] ドキュメント完成

---

## P2-P3実装計画（中・低優先）

### Phase 4: SaaS機能

**優先度:** P2（V1.0 GA必須）
**期間:** Week 14-19（6週間）

**主要タスク:**
- 4.1: サブスクリプション・課金（Stripe統合）
- 4.2: ベンチマークシステム
- 4.3: 外部連携API
- 4.4: セキュリティ・SSO

**詳細:** `COMPREHENSIVE_IMPLEMENTATION_PLAN.md` Phase 4参照

---

### Phase 5: Enterprise高度機能

**優先度:** P3（V2.0 Enterprise必須）
**期間:** Week 20-23（4週間）

**主要タスク:**
- 5.1.1: AIプロンプト・プロバイダ管理UI
- 5.1.2: 高度なレポート・分析
- 5.1.3: データ管理・アーカイブ
- 5.1.4: ブランディング・カスタマイズ
- 5.2: 高度なATS連携（国内3社）
- 5.3: プラグインシステム

**詳細:** `COMPREHENSIVE_IMPLEMENTATION_PLAN.md` Phase 5参照

---

### Phase 6: 最適化・スケール

**優先度:** P3（継続改善）
**期間:** Week 24-26（3週間）

**主要タスク:**
- パフォーマンス最適化
- 監視・アラート強化
- コスト最適化

**詳細:** `COMPREHENSIVE_IMPLEMENTATION_PLAN.md` Phase 6参照

---

## 依存関係マトリクス

### P0タスク間の依存関係

```
Phase 2.2-2.3 (解析・レポート)
    ↓ 依存なし（並行可能）
Phase 2.5 (ゲストユーザー)
    ↓ Phase 2.5完了後に開始可能
Phase 3.1.1 (XLSX一括登録)
    ↓ ゲストセッションAPIに依存
Phase 3.1.2 (基本ATS連携)
    ↓ ゲストセッションAPIに依存
Phase 3.1.3 (基本レポート・分析)
    ↓ 解析機能に依存（Phase 2.2完了後）
```

### 技術的依存関係

| タスク | 依存先 | 理由 |
|--------|--------|------|
| Phase 2.5実装 | Phase 2.2-2.3完了 | 自動評価機能が必要 |
| Phase 3.1.1実装 | Phase 2.5完了 | GuestSession APIが必要 |
| Phase 3.1.2実装 | Phase 2.5完了 | GuestSession作成が必要 |
| Phase 3.1.3実装 | Phase 2.2完了 | 解析データが必要 |

### 並行実装可能なタスク

**Week 1-4:**
- Phase 2.2-2.3（解析・レポート） - Backend Engineer A, B
- 並行作業不可（他タスク待機）

**Week 5-7:**
- Phase 2.5（ゲストユーザー） - Backend Engineer A, B + Frontend Engineer A

**Week 8-11:**
- Phase 3.1.1（XLSX一括登録） - Backend Engineer A + Frontend Engineer A
- Phase 3.1.2（基本ATS連携） - Backend Engineer B + Frontend Engineer B
  （Week 10-11のみ並行）

**Week 12-13:**
- Phase 3.1.3（基本レポート・分析） - Backend Engineer A, B + Frontend Engineer A, B

---

## リソース配分

### チーム構成（推奨）

**フルタイムコア（6名）:**
- **Backend Engineer A** - Lambda関数、API実装
- **Backend Engineer B** - データモデル、Step Functions、ATS統合
- **Frontend Engineer A** - ゲストUI、管理画面
- **Frontend Engineer B** - 分析ダッシュボード、レポートUI
- **DevOps Engineer** - インフラ、デプロイ、監視
- **AI/ML Engineer** - 解析アルゴリズム、AI統合

**パートタイム（2名）:**
- **UI/UX Designer** - デザイン、プロトタイプ（週2-3日）
- **QA Engineer** - テスト、品質保証（週2-3日）

### 週別リソース配分

| Week | Phase | Backend A | Backend B | Frontend A | Frontend B | DevOps | AI/ML |
|------|-------|-----------|-----------|------------|------------|--------|-------|
| 1-2  | 2.2   | AudioAnalyzer, Orchestrator | API実装 | - | - | インフラ | ScoreCalculator |
| 3-4  | 2.3   | レポートAPI | PDF生成 | レポートUI | - | CDK更新 | AI改善提案 |
| 5-7  | 2.5   | ゲストAPI | Authorizer | ゲストUI | - | Lambda更新 | - |
| 8-9  | 3.1.1 | XLSXアップロード | Step Functions | アップロードUI | - | SES設定 | - |
| 10-11| 3.1.2 | - | ATS統合 | - | ATS設定UI | - | - |
| 12-13| 3.1.3 | 検索API | Excelエクスポート | 検索UI | ダッシュボード | - | - |

---

## リスク管理

### 高リスク項目

| リスク | 影響 | 確率 | 緩和策 | 担当者 |
|--------|------|------|--------|--------|
| Phase 2.2解析機能の遅延 | 高 | 中 | コア機能優先、高度な機能は後回し | AI/ML Engineer |
| XLSX処理の複雑性 | 中 | 高 | ExcelJS使用、PoC事前実施 | Backend B |
| ATS API仕様の複雑性 | 中 | 中 | モックAPI使用、段階的実装 | Backend B |
| Step Functions実装の困難さ | 中 | 中 | AWS公式例を参考、段階的実装 | Backend B |
| ゲストアクセスのセキュリティ | 高 | 低 | セキュリティレビュー、ペネトレーションテスト | DevOps |
| スケジュール遅延 | 高 | 中 | 2週間のバッファ確保、並行開発最大化 | PM |

### 技術的リスク

**Phase 2.2-2.3:**
- **リスク:** AudioAnalyzerのフィラーワード検出精度不足
- **緩和策:** 正規表現パターンを段階的に改善、多言語対応は後回し

**Phase 2.5:**
- **リスク:** ゲストアクセスのセキュリティ脆弱性
- **緩和策:** Lambda Authorizerで厳格なアクセス制限、レート制限実装

**Phase 3.1.1:**
- **リスク:** 1000件XLSX処理が5分を超える
- **緩和策:** Lambda Concurrency増加、Step Functions並列処理

**Phase 3.1.2:**
- **リスク:** ATS APIの仕様変更・制限
- **緩和策:** アダプターパターンで抽象化、バージョン管理

---

## 完了基準（Definition of Done）

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

**パフォーマンス:**
- [ ] 解析処理時間 < 60秒
- [ ] レポート生成時間 < 30秒
- [ ] XLSX処理時間 < 5分（1000件）
- [ ] API平均レスポンス時間 < 200ms

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

## まとめ

### 優先度調整後のスケジュール

```
Week 1-4:   Phase 2.2-2.3完了     P0 █████████░░░░░░░  MVP Release必須
Week 5-7:   Phase 2.5実装         P0 ████████████░░░░  最重要差別化
Week 8-9:   Phase 3.1.1実装       P0 ████████░░░░░░░░  大規模運用
Week 10-11: Phase 3.1.2実装       P1 ████████░░░░░░░░  既存統合
Week 12-13: Phase 3.1.3実装       P1 ████████░░░░░░░░  データドリブン
─────────────────────────────────────────────────────────
                           ↑ Beta Release (Week 13)
Week 14-19: Phase 4実装           P2 ████████████████  V1.0 GA
Week 20-23: Phase 5実装           P3 ████████████████  V2.0 Enterprise
Week 24-26: Phase 6実装           P3 ████████████████  最適化
```

### 次のアクション

**immediate（今すぐ）:**
- Day 1-2: AudioAnalyzer実装開始
- フィラーワード検出、話速計算実装

**short-term（Week 1-2）:**
- Phase 2.2.2-2.2.3完了（AudioAnalyzer + Orchestrator）
- 単体テスト・統合テスト実施

**mid-term（Week 1-4）:**
- Phase 2.2-2.3完了（解析・レポート機能）
- MVP Release準備完了

**long-term（Week 5-13）:**
- Phase 2.5-3.1完了（ゲストユーザー、XLSX、ATS、レポート）
- Beta Release達成

---

**最終更新:** 2026-03-09
**次回レビュー:** Week 4（Phase 2.2-2.3完了時）
**承認者:** プロジェクトマネージャー、技術リーダー
