# Prance Communication Platform - プロジェクト概要

**バージョン:** 2.1
**作成日:** 2026-02-26
**最終更新:** 2026-03-06
**ステータス:** Phase 1 完了 (100%) ・ Phase 2 準備中

---

## 📋 目次

このドキュメントはプロジェクト全体の概要と重要な方針を記載したマスターファイルです。
詳細な設計・実装情報は以下のドキュメントを参照してください。

### 📚 ドキュメント構成

```
START_HERE.md                      ← 次回セッション開始（唯一のエントリーポイント）
CLAUDE.md (このファイル)           ← プロジェクト概要・重要方針
├── docs/progress/                 ← セッション進捗記録
│   ├── SESSION_HISTORY.md         - 全セッション詳細履歴
│   └── ARCHIVE_*.md               - 各セッション詳細
├── docs/architecture/             ← アーキテクチャ設計
│   ├── SYSTEM_ARCHITECTURE.md     - システム全体構成
│   └── MULTITENANCY.md            - マルチテナント設計
├── docs/modules/                  ← 各モジュール詳細設計
│   ├── AI_MANAGEMENT.md           - AIプロンプト・プロバイダ管理
│   ├── AVATAR_MODULE.md           - アバター管理
│   ├── BENCHMARK_SYSTEM.md        - ベンチマークシステム
│   ├── EXTERNAL_API.md            - 外部連携API
│   └── ... (15モジュール)
├── docs/infrastructure/           ← インフラ構成
│   └── AWS_SERVERLESS.md          - AWSサーバーレス詳細
├── docs/development/              ← 開発関連
│   ├── API_DESIGN.md              - API設計
│   ├── DATABASE_DESIGN.md         - データベース設計
│   └── IMPLEMENTATION_PHASES.md   - 実装フェーズ
└── docs/reference/                ← リファレンス
    ├── TECH_STACK.md              - 技術スタック詳細
    ├── FAQ.md                     - よくある質問
    └── GLOSSARY.md                - 用語集
```

---

## 1. プロジェクト概要

### コンセプト

**AIアバター**がユーザーとリアルタイムでインタラクティブな会話を行う**マルチテナント型SaaS**プラットフォーム。事前設定された**シナリオ**に基づき、AIアバターが自律的に会話を進め、その様子を録画・解析・レポーティングする。

### 主要機能（サマリー）

| カテゴリ             | 主要機能                                                       |
| -------------------- | -------------------------------------------------------------- |
| **アーキテクチャ**   | マルチテナント型SaaS、3階層ユーザーロール、AWSサーバーレス     |
| **サブスクリプション** | プラン管理（Free/Pro/Enterprise）、Stripe統合準備              |
| **アバター**         | 2D/3Dプリセット、ユーザー画像からの生成、UI選択システム        |
| **音声**             | TTS/STT、音声クローニング、リアルタイム処理                    |
| **会話AI**           | シナリオベース自律会話、マルチプロバイダ対応                   |
| **AI管理**           | プロンプトテンプレート管理、プロバイダ切り替え（管理者専用）   |
| **録画**             | アバター映像＋ユーザーカメラの同時録画・合成・再生             |
| **解析**             | 表情・感情・非言語行動解析、音声特徴解析                       |
| **レポート**         | カスタマイズ可能なテンプレートによる自動レポート生成           |
| **ベンチマーク**     | プロファイル比較、成長トラッキング、パーソナライズド改善提案   |
| **外部連携API**      | APIキー管理、階層的レート制限、Webhook、OpenAPI仕様            |
| **多言語対応**       | 日本語・英語（初期）、将来的に多言語拡張                       |
| **ATS連携**          | 国内外主要6社対応、候補者同期、結果エクスポート                |
| **プラグインシステム** | 拡張可能なアーキテクチャ、SDK提供                              |

> 詳細: [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)

### ターゲット市場

- **就職・採用支援:** 面接練習、採用プロセスの標準化、候補者評価の定量化
- **語学学習:** 会話練習、発音・表現フィードバック
- **企業研修:** カスタマーサービス、営業、クレーム対応トレーニング
- **リサーチ:** アンケート、市場調査、ユーザーインタビュー自動化
- **教育機関:** 複数学校・学科での統一プラットフォーム利用
- **採用代行・人材企業:** 複数クライアント管理、標準化された評価基準

---

## 2. 基本アーキテクチャ

### 全体構成（概要）

```
┌───────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 15)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Avatar   │ │ Scenario │ │ Session  │ │ Report   │        │
│  │ Selector │ │ Builder  │ │ Player   │ │ Viewer   │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└────────────────┬──────────────────────┬───────────────────────┘
                 │                      │
                 │ REST API             │ WebSocket (IoT Core)
                 ▼                      ▼
┌────────────────────────────┐ ┌────────────────────────────┐
│   API Gateway (REST)       │ │   AWS IoT Core             │
└──────────┬─────────────────┘ └───────────┬────────────────┘
           │                               │
           ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│              Amazon Cognito (認証・認可)                       │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                     AWS Lambda Functions                      │
└────┬───────────────────────────────────────────┬─────────────┘
     │                                           │
     ▼                                           ▼
┌────────────────────┐              ┌────────────────────────┐
│ Aurora Serverless  │              │     DynamoDB           │
│ v2 (PostgreSQL)    │              │  - セッション状態      │
└────────────────────┘              └────────────────────────┘
```

> 詳細: [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)

### マルチテナント・権限設計

**3階層ユーザーロール:**

1. **スーパー管理者（管理プロバイダ）**
   - プラットフォーム全体の運営・管理
   - 全テナント管理、グローバルAPI制限設定、プラン管理

2. **クライアント管理者（組織管理者）**
   - 自組織（テナント）内の管理・運用
   - ユーザー管理、AIプロンプト管理、APIキー発行

3. **クライアントユーザー（一般ユーザー）**
   - セッション実行・自己データ管理
   - シナリオ作成、レポート閲覧、ベンチマーク比較

> 詳細: [docs/architecture/MULTITENANCY.md](docs/architecture/MULTITENANCY.md)

---

## 3. 技術スタック（概要）

### フロントエンド

- **Next.js 15** (App Router, SSR/SSG)
- **Three.js** (3Dアバターレンダリング)
- **Live2D Cubism SDK 5** (2Dアニメアバター)
- **AWS Amplify Hosting** (CI/CD統合)
- **shadcn/ui + Tailwind CSS** (UIコンポーネント)
- **next-intl** (多言語対応)

### バックエンド (サーバーレス)

- **AWS Lambda** (Node.js 20 Runtime, ARM64)
- **AWS API Gateway** (REST/WebSocket)
- **AWS IoT Core** (リアルタイムWebSocket、100万同時接続対応)
- **Prisma ORM** (TypeScript型安全)
- **AWS Step Functions** (非同期処理オーケストレーション)

### AI・音声サービス

- **AWS Bedrock (Claude Sonnet 4.6)** - 会話AI
- **ElevenLabs API** - TTS（プライマリ）
- **Azure Speech Services** - STT
- **AWS Rekognition** - 感情解析

### データストア

- **Amazon Aurora Serverless v2** (PostgreSQL)
- **Amazon DynamoDB** (セッション状態、ベンチマークキャッシュ、APIレート制限)
- **Amazon ElastiCache Serverless** (Redis)
- **Amazon S3 + CloudFront** (ストレージ・CDN)

> 詳細: [docs/reference/TECH_STACK.md](docs/reference/TECH_STACK.md)

---

## 4. 開発ガイドライン

### 重要な設計原則

#### 1. コード品質

- **型安全性**: TypeScript厳密モード使用
- **テスト**: 単体テスト（Jest）、E2Eテスト（Playwright）
- **Linting**: ESLint + Prettier、一貫したコードスタイル
- **セキュリティ**: OWASP Top 10対策、入力バリデーション必須

#### 2. サーバーレス最適化

- **コールドスタート対策**: Provisioned Concurrency（重要API）
- **Lambda最適化**: メモリ適正化、ARM64 (Graviton2) 使用
- **非同期処理**: Step Functionsで長時間処理を分割
- **コスト最適化**: 使用量ベース課金、アイドル時コスト最小化

#### 3. セキュリティ

- **認証・認可**: Cognito + Lambda Authorizer、RBAC
- **データ暗号化**: S3 (SSE-KMS), Aurora (暗号化DB)
- **最小権限の原則**: IAMロール、Secrets Manager
- **監査ログ**: CloudTrail、アクセスログ保持

#### 4. 多言語対応

**URL設計**: 全言語で共通URL（ロケールプレフィックスなし）
- ✅ 正しい: `/dashboard`, `/sessions`
- ❌ 使用しない: `/en/dashboard`, `/ja/dashboard`

**言語検出（優先順位）**:
1. **Cookie** (`NEXT_LOCALE`)
2. **Accept-Language** ヘッダー（ブラウザ設定）
3. **デフォルト言語**（英語: en）

**言語切り替え**:
- ユーザーがUI上で言語を選択 → Cookieに保存
- 次回アクセス時に自動的に選択した言語で表示
- 明示的にUI上で変更するまでCookieを保持

**リソース管理**:
- **文字列ハードコード禁止**: 全ての表示テキストは言語リソースファイルから読み込み
- **集中管理**: 言語取得はMiddlewareで一元管理（分散させない）
- **コード変更不要**: 新言語追加時はリソースファイルのみ変更
- **ホットデプロイ**: スーパー管理者がUIからアップロード → 1-5分で反映（リビルド不要）
- **フォールバック**: リソースがない場合は英語にフォールバック

> 詳細: [docs/modules/MULTILINGUAL_SYSTEM.md](docs/modules/MULTILINGUAL_SYSTEM.md)

### 開発ワークフロー

```bash
# 1. ローカル開発
npm install
npm run dev

# 2. ビルド・テスト
npm run build
npm run test
npm run lint

# 3. インフラデプロイ (CDK)
cd infrastructure
npm run deploy:dev

# 4. コミット・プッシュ
git add .
git commit -m "feat: ..."
git push origin main
```

---

## 5. プロジェクトステータス

### Phase 0: インフラ基盤構築 ✅ 完了 (2026-03-05)

**構築済みインフラ (AWS us-east-1):**
- NetworkStack - VPC、Subnets、NAT Gateway、Security Groups
- CognitoStack - User Pool、認証・認可
- DatabaseStack - Aurora Serverless v2 (PostgreSQL 15.4)
- StorageStack - S3 Buckets、CloudFront CDN
- DynamoDBStack - セッション状態、WebSocket接続
- ApiGatewayStack - REST API、WebSocket API
- ApiLambdaStack - Lambda関数（20+ functions）

### Phase 1: MVP開発 ✅ 完了 (2026-03-06)

**実装完了機能:**
- ✅ 認証システム (JWT, Register/Login/Me)
- ✅ シナリオ管理 (CRUD + Clone)
- ✅ アバター管理 (CRUD + Clone)
- ✅ セッション管理 (Create/List/Detail)
- ✅ 音声会話パイプライン (STT → AI → TTS)
- ✅ リアルタイムWebSocket通信
- ✅ 多言語対応 (英語・日本語)

**音声処理フロー:**
```
Browser → WebSocket → Lambda → Azure STT → AWS Bedrock Claude
→ ElevenLabs TTS → WebSocket → Browser
```

**技術スタック:**
- Azure Speech Services (STT)
- AWS Bedrock Claude Sonnet 4.6 (AI)
- ElevenLabs eleven_flash_v2_5 (TTS)
- ffmpeg (WebM→WAV変換)

> 詳細: [docs/progress/ARCHIVE_2026-03-06_Phase1_Completion.md](docs/progress/ARCHIVE_2026-03-06_Phase1_Completion.md)

### 次のステップ: Phase 2 (録画・解析・レポート)

**目標:** セッション録画・解析・レポート生成機能の実装

**主要タスク:**
1. **録画機能** - Canvas API映像合成、MediaRecorder、S3保存
2. **解析機能** - AWS Rekognition（表情・感情）、音声特徴解析
3. **レポート生成** - PDFテンプレート、AI改善提案

**推定期間:** 4-6週間

> 詳細: [docs/progress/PHASE_2_PLAN.md](docs/progress/PHASE_2_PLAN.md)

---

## 6. 重要な設計判断

### なぜサーバーレスアーキテクチャを採用したか？

**理由:**

1. **自動スケーラビリティ** - 10ユーザー → 10万ユーザーまで自動対応
2. **コスト効率** - 使用量ベース課金、アイドル時コスト最小化（月間1000セッション: $500-800）
3. **高可用性** - マネージドサービス99.9% SLA、自動フェイルオーバー
4. **メンテナンス不要** - サーバー管理・パッチ適用・OS更新自動

**トレードオフ:**

- コールドスタート → Provisioned Concurrencyで対応
- 15分実行時間制限 → Step Functionsで長時間処理分割
- ベンダーロックイン → 抽象化レイヤーで緩和

> 詳細: [docs/reference/FAQ.md](docs/reference/FAQ.md)

### なぜAIプロンプト・プロバイダ管理を管理者UIに実装したか？

**理由:**

1. **ビジネスの柔軟性** - コード変更なしでプロンプト最適化、開発サイクル短縮
2. **顧客要望への対応** - Enterprise顧客が独自プロンプトで差別化
3. **リスク管理** - プロバイダ障害時の自動フォールバック、コスト管理

> 詳細: [docs/modules/AI_MANAGEMENT.md](docs/modules/AI_MANAGEMENT.md)

---

## 7. ドキュメント索引

### アーキテクチャ

- [システムアーキテクチャ](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [マルチテナント設計](docs/architecture/MULTITENANCY.md)

### モジュール詳細

- [AIプロンプト・プロバイダ管理](docs/modules/AI_MANAGEMENT.md)
- [アバターモジュール](docs/modules/AVATAR_MODULE.md)
- [ベンチマークシステム](docs/modules/BENCHMARK_SYSTEM.md)
- [外部連携API](docs/modules/EXTERNAL_API.md)
- [プラン管理](docs/modules/SUBSCRIPTION_PLANS.md)
- [多言語対応](docs/modules/MULTILINGUAL_SYSTEM.md)
- [ATS連携](docs/modules/ATS_INTEGRATION.md)
- [プラグインシステム](docs/modules/PLUGIN_SYSTEM.md)
- その他7モジュール ([docs/modules/](docs/modules/) 参照)

### インフラ・開発

- [AWSサーバーレス構成](docs/infrastructure/AWS_SERVERLESS.md)
- [データベース設計](docs/development/DATABASE_DESIGN.md)
- [API設計](docs/development/API_DESIGN.md)
- [実装フェーズ](docs/development/IMPLEMENTATION_PHASES.md)

### リファレンス

- [技術スタック詳細](docs/reference/TECH_STACK.md)
- [FAQ](docs/reference/FAQ.md)
- [用語集](docs/reference/GLOSSARY.md)

---

## 8. 開発プロセスガイドライン

### セッション管理ルール

**プライマリドキュメント:**
- **`START_HERE.md`** - 次回セッション開始の唯一のエントリーポイント
  - 簡潔（200行以内）
  - 常に最新状態を反映
  - 環境確認手順、最優先タスク（1-3項目）のみ記載

**アーカイブドキュメント:**
- **`docs/progress/SESSION_HISTORY.md`** - 全セッションの詳細履歴
- **`docs/progress/ARCHIVE_YYYY-MM-DD_*.md`** - 各セッションの詳細記録

### セッション終了時の記録手順

**1. START_HERE.md の更新（必須）**
```bash
# 以下を更新:
- 最終作業日時
- Phase進捗率
- 最新デプロイ情報
- 完了したタスク（取り消し線）
- 次回の優先タスク（3項目以内）
- 前回セッションで完了した作業
```

**2. セッション詳細のアーカイブ（推奨）**
- 詳細な作業内容は `docs/progress/ARCHIVE_YYYY-MM-DD_*.md` に保存
- コミットハッシュ、デプロイ時間、エラー対応履歴を記録

**3. 重要な発見・決定事項**
- 技術的な重要発見は `CLAUDE.md` の関連セクションに追加
- アーキテクチャ変更は該当するドキュメント（`docs/architecture/`, `docs/modules/`）を更新

### 次回セッション開始時の手順

**第一声:**
```
前回の続きから始めます。START_HERE.mdを確認してください。
```

**自動実行される内容:**
1. START_HERE.md の読み込み
2. 環境確認（Docker、PostgreSQL、開発サーバー）
3. 最優先タスクの開始

### ドキュメント更新ルール

**START_HERE.md の更新タイミング:**
- ✅ セッション終了時（最新状態を反映）
- ✅ 重要なマイルストーン達成時（Phase進捗、デプロイ完了）
- ❌ セッション途中の細かい変更（アーカイブに記録）

**CLAUDE.md の更新タイミング:**
- ✅ アーキテクチャ変更・重要な設計決定
- ✅ 新しいモジュール追加
- ✅ Phase完了時の総括
- ❌ 日常的な実装進捗（START_HERE.mdまたはアーカイブに記録）

**docs/ 配下の更新タイミング:**
- ✅ 技術仕様の変更
- ✅ API設計の追加・変更
- ✅ インフラ構成の変更
- ✅ 新しいモジュールの詳細設計

---

## 9. 貢献・サポート

### 開発チーム

| ロール               | 担当                           |
| -------------------- | ------------------------------ |
| フロントエンド開発   | Next.js, Three.js, UI/UX       |
| バックエンド開発     | Lambda, Step Functions, API設計 |
| インフラ/DevOps      | AWS CDK, CI/CD, 監視           |
| AI/ML エンジニア     | プロンプト最適化、解析         |
| プロダクトマネージャー | 要件定義、優先順位付け       |

### 問い合わせ

- **Issues**: GitHub Issues
- **Documentation**: このリポジトリの `docs/` ディレクトリ
- **Progress Tracking**: [START_HERE.md](START_HERE.md)（最新状態）、[docs/progress/](docs/progress/)（履歴）

---

**最終更新:** 2026-03-06
**次回レビュー予定:** Phase 2 完了時
