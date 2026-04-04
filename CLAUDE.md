# Prance Communication Platform - プロジェクト概要

**バージョン:** 3.2
**作成日:** 2026-02-26
**最終更新:** 2026-03-22
**ステータス:** 🚀 **Production稼働中** - Phase 1-5全完了・全機能デプロイ済み ✅

---

## 📋 目次

このドキュメントはプロジェクト全体の概要と重要な方針を記載したマスターファイルです。
詳細な設計・実装情報は以下のドキュメントを参照してください。

### 📚 ドキュメント構成（2026-03-19整理完了）

#### 最優先ドキュメント

```
START_HERE.md                            ← 次回セッション開始（唯一のエントリーポイント）
DOCUMENTATION_INDEX.md                   ← 全ドキュメントの索引・ナビゲーション 🆕
CLAUDE.md (このファイル)                 ← プロジェクト概要・重要方針
CODING_RULES.md                          ← コミット前チェックリスト
```

#### 階層化されたCLAUDE.mdファイル

```
├── apps/CLAUDE.md                        ← フロントエンド開発ガイド
├── infrastructure/CLAUDE.md              ← インフラ・Lambda開発ガイド
├── scripts/CLAUDE.md                     ← スクリプト使用ガイド
└── docs/CLAUDE.md                        ← ドキュメント管理ガイド
```

**各ファイルの役割:**

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - 全ドキュメントの索引、目的別ナビゲーション 🆕
- **[CODING_RULES.md](CODING_RULES.md)** - コミット前チェックリスト（クイックリファレンス）
- **[apps/CLAUDE.md](apps/CLAUDE.md)** - Next.js 15、多言語対応、UI開発ガイド
- **[infrastructure/CLAUDE.md](infrastructure/CLAUDE.md)** - AWS CDK、Lambda関数、サーバーレス開発ガイド
- **[scripts/CLAUDE.md](scripts/CLAUDE.md)** - 検証・デプロイ・データベーススクリプト使用ガイド
- **[docs/CLAUDE.md](docs/CLAUDE.md)** - ドキュメント管理・更新ルール

**ドキュメントが見つからない場合:**
→ **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** を参照してください

#### 詳細ドキュメント構造

```
docs/01-getting-started/             ← 初心者向けガイド
│   ├── README.md                        - プロジェクト概要
│   ├── QUICKSTART.md                    - クイックスタート
│   ├── SETUP.md                         - セットアップガイド
│   └── FAQ.md                           - よくある質問
├── docs/02-architecture/                ← アーキテクチャ設計
│   ├── SYSTEM_ARCHITECTURE.md           - システム全体構成
│   ├── MULTITENANCY.md                  - マルチテナント設計
│   └── ENVIRONMENT_ARCHITECTURE.md      - 環境アーキテクチャ
├── docs/03-planning/                    ← 計画・ロードマップ
│   ├── releases/                        - リリース計画
│   │   ├── PRODUCTION_READY_ROADMAP.md  - 実用レベル対応 🔴最優先
│   │   └── RELEASE_ROADMAP.md           - リリースロードマップ
│   ├── implementation/                  - 実装計画
│   │   ├── COMPLETE_IMPLEMENTATION_ROADMAP.md - 完全実装計画
│   │   ├── PRIORITY_BASED_IMPLEMENTATION_PLAN.md - 優先度ベース計画
│   │   ├── COMPREHENSIVE_IMPLEMENTATION_PLAN.md - 包括的実装計画
│   │   ├── IMPLEMENTATION_PHASES.md     - 実装フェーズ
│   │   └── IMPLEMENTATION_SUMMARY.md    - 実装計画サマリー
│   └── analysis/                        - 分析・ギャップ分析
│       ├── FEATURE_GAP_ANALYSIS.md      - 機能ギャップ分析
│       └── INCONSISTENCY_REPORT.md      - 不整合レポート
├── docs/04-design/                      ← 技術設計
│   ├── API_DESIGN.md                    - API設計
│   ├── DATABASE_DESIGN.md               - データベース設計
│   ├── API_KEY_MANAGEMENT.md            - APIキー管理
│   ├── CONSISTENCY_GUIDELINES.md        - 整合性ガイドライン
│   └── LOCK_MECHANISM_IMPROVEMENTS.md   - ロックメカニズム改善
├── docs/05-modules/                     ← 機能モジュール
│   ├── AI_MANAGEMENT.md                 - AIプロンプト・プロバイダ管理
│   ├── ANALYSIS_MODULE.md               - 解析モジュール
│   ├── AVATAR_MODULE.md                 - アバター管理
│   ├── BENCHMARK_SYSTEM.md              - ベンチマークシステム
│   ├── EXTERNAL_API.md                  - 外部連携API
│   ├── MULTILINGUAL_SYSTEM.md           - 多言語対応
│   └── ... (全17モジュール)
├── docs/06-infrastructure/              ← インフラ構成
│   ├── AWS_SERVERLESS.md                - AWSサーバーレス詳細
│   ├── DOMAIN_SETUP_SUMMARY.md          - ドメイン設定
│   └── NODE22_MIGRATION_REPORT.md       - Node.js 22移行記録
├── docs/07-development/                 ← 開発ガイド
│   ├── DEVELOPMENT_WORKFLOW.md          - 開発ワークフロー
│   ├── DATABASE_MIGRATION_CHECKLIST.md  - DBマイグレーションチェックリスト
│   ├── LAMBDA_VERSION_MANAGEMENT.md     - Lambdaバージョン管理
│   ├── SPACE_DIRECTORY_PREVENTION.md    - 空白ディレクトリ防止ガイド 🔴
│   └── LOCK_MECHANISM_ANALYSIS.md       - ロックメカニズム分析
├── docs/08-operations/                  ← 運用ガイド
│   ├── DEPLOYMENT.md                    - デプロイメント
│   ├── CICD.md                          - CI/CD
│   ├── OPERATIONS_GUIDE.md              - 運用ガイド
│   └── SECURITY.md                      - セキュリティ
├── docs/09-progress/                    ← 進捗記録
│   ├── SESSION_HISTORY.md               - 全セッション詳細履歴
│   ├── archives/                        - セッション記録
│   │   ├── ARCHIVE_2026-03-06_Phase1_Completion.md
│   │   └── SESSION_2026-03-09_*.md
│   ├── phases/                          - Phase計画
│   │   ├── PHASE_2_PLAN.md
│   │   └── PHASE_2.2_ANALYSIS_IMPLEMENTATION_PLAN.md
│   └── tasks/                           - タスク完了記録
│       └── TASK_2.2.*_COMPLETE.md
├── docs/10-reference/                   ← リファレンス
│   ├── TECH_STACK.md                    - 技術スタック詳細
│   ├── GLOSSARY.md                      - 用語集
│   └── CLAUDE.en.md                     - CLAUDE.md英語版
├── docs/archive/                        ← 削除・変更履歴
│   ├── DELETED_FILES_2026-03-09.md
│   └── DOCUMENTATION_CLEANUP_SUMMARY.md
└── apps/web/tests/e2e/                  ← E2Eテスト（システム全体） 🆕
    ├── README.md                        - テストガイド（レベル、実行方法）
    ├── fixtures/                        - テストフィクスチャ
    ├── page-objects/                    - Page Object Model
    ├── stage0-1/                        - UI Component Tests
    ├── stage2/                          - Integration Tests (Mock)
    └── stage3-5/                        - System E2E Tests（全スタック）
```

---

## 1. プロジェクト概要

### コンセプト

**AIアバター**がユーザーとリアルタイムでインタラクティブな会話を行う**マルチテナント型SaaS**プラットフォーム。事前設定された**シナリオ**に基づき、AIアバターが自律的に会話を進め、その様子を録画・解析・レポーティングする。

### 主要機能（サマリー）

| カテゴリ               | 主要機能                                                     |
| ---------------------- | ------------------------------------------------------------ |
| **アーキテクチャ**     | マルチテナント型SaaS、4階層ユーザーロール、AWSサーバーレス   |
| **ゲストアクセス** 🆕  | ログイン不要の外部ユーザー、URL+パスワード認証、自動評価     |
| **サブスクリプション** | プラン管理（Free/Pro/Enterprise）、Stripe統合準備            |
| **アバター**           | 2D/3Dプリセット、ユーザー画像からの生成、UI選択システム      |
| **音声**               | TTS/STT、音声クローニング、リアルタイム処理                  |
| **会話AI**             | シナリオベース自律会話、マルチプロバイダ対応                 |
| **AI管理**             | プロンプトテンプレート管理、プロバイダ切り替え（管理者専用） |
| **録画**               | アバター映像＋ユーザーカメラの同時録画・合成・再生           |
| **解析**               | 表情・感情・非言語行動解析、音声特徴解析                     |
| **レポート**           | カスタマイズ可能なテンプレートによる自動レポート生成         |
| **ベンチマーク**       | プロファイル比較、成長トラッキング、パーソナライズド改善提案 |
| **外部連携API**        | APIキー管理、階層的レート制限、Webhook、OpenAPI仕様          |
| **多言語対応**         | 10言語対応（日英中韓西葡仏独伊）、リソースファイルベース言語管理 |
| **ATS連携**            | 国内外主要6社対応、候補者同期、結果エクスポート              |
| **プラグインシステム** | 拡張可能なアーキテクチャ、SDK提供                            |

> 詳細: [docs/02-architecture/SYSTEM_ARCHITECTURE.md](docs/02-architecture/SYSTEM_ARCHITECTURE.md)

### ターゲット市場

- **就職・採用支援:**
  - **内部利用**: 社員の面接練習、採用プロセスの標準化
  - **外部候補者**: ゲストアクセスで候補者を自動評価、録画面接の一次スクリーニング 🆕
- **語学学習:** 会話練習、発音・表現フィードバック
- **企業研修:**
  - **内部研修**: カスタマーサービス、営業、クレーム対応トレーニング
  - **外部受講者**: 研修受講者をゲストアクセスで評価 🆕
- **リサーチ:**
  - アンケート、市場調査
  - **外部回答者**: ゲストアクセスでインタビュー自動化 🆕
- **教育機関:**
  - 複数学校・学科での統一プラットフォーム利用
  - **学生評価**: ゲストアクセスで模擬面接・プレゼン評価 🆕
- **採用代行・人材企業:**
  - 複数クライアント管理、標準化された評価基準
  - **大量候補者処理**: ゲストアクセスで候補者を効率的にスクリーニング 🆕

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

> 詳細: [docs/02-architecture/SYSTEM_ARCHITECTURE.md](docs/02-architecture/SYSTEM_ARCHITECTURE.md)

### マルチテナント・権限設計

**4階層ユーザーロール:**

1. **スーパー管理者（管理プロバイダ）**
   - プラットフォーム全体の運営・管理
   - 全テナント管理、グローバルAPI制限設定、プラン管理

2. **クライアント管理者（組織管理者）**
   - 自組織（テナント）内の管理・運用
   - ユーザー管理、AIプロンプト管理、APIキー発行
   - ゲストセッション作成・管理、候補者招待

3. **クライアントユーザー（一般ユーザー）**
   - セッション実行・自己データ管理
   - シナリオ作成、レポート閲覧、ベンチマーク比較
   - ゲストセッション作成・候補者招待

4. **ゲストユーザー（外部ユーザー・候補者）** 🆕
   - **ログイン不要** - URLと簡易パスワードでアクセス
   - **面接・面談参加のみ** - アバター面接官との会話セッション
   - **データ保存** - 動画・音声・文字起こしが自動保存
   - **評価対象** - 事前設定した判断基準に従って自動評価
   - **アクセス制限** - 自己の録画・評価データは閲覧不可（内部ユーザーのみ閲覧可能）
   - **典型的な用途** - 採用面接候補者、研修受講者、アンケート回答者

**ゲストセッションのワークフロー:**

```
1. クライアント管理者/ユーザーがゲストセッションを作成
   ↓
2. システムが一意のURL + 簡易パスワードを生成
   ↓
3. 招待者がメール等でゲストにURL + パスワードを送信
   ↓
4. ゲストがURLにアクセス、パスワード入力
   ↓
5. アバター面接官との会話セッション開始
   ↓
6. 動画・音声・文字起こしを自動保存、自動評価
   ↓
7. 内部ユーザーが録画・評価データを閲覧・分析
```

**セキュリティ設計:**

- **一時的なアクセス権限** - セッション終了後、URLは無効化（オプション）
- **簡易認証** - 4-8桁のPIN、またはランダム文字列
- **データ隔離** - ゲストは他のゲストや内部データにアクセス不可
- **自動削除** - 設定期間経過後、ゲストセッションデータを自動削除（オプション）

> 詳細: [docs/02-architecture/MULTITENANCY.md](docs/02-architecture/MULTITENANCY.md)

### 環境URL

#### Development環境
- **Frontend (Local):** http://localhost:3000
- **REST API:** https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
- **WebSocket:** wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
- **CDN:** https://d3mx0sug5s3a6x.cloudfront.net

#### Production環境
- **Frontend:** https://app.prance.jp
- **REST API:** https://api.app.prance.jp
- **WebSocket:** wss://ws.app.prance.jp
- **CDN:** https://cdn.app.prance.jp

> 詳細: [docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md](docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)

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

- **AWS Lambda** (Node.js 22 LTS Runtime, ARM64)
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

> 詳細: [docs/10-reference/TECH_STACK.md](docs/10-reference/TECH_STACK.md)

---

## 4. 開発ガイドライン

### 🔴 絶対厳守ルール（CRITICAL RULES）

**これらのルールに違反すると本番環境で500エラーが発生します。必ず遵守してください。**

#### Rule 1: Prismaスキーマ変更時の必須手順

**条件:** `packages/database/prisma/schema.prisma` を変更した場合

**❌ 禁止事項:**
- マイグレーション実行せずにLambda関数デプロイ
- マイグレーション実行の延期
- Prisma Client再生成のスキップ

**✅ 推奨方法:**
```bash
# 統合デプロイスクリプト使用（自動化）
cd infrastructure
pnpm run deploy:dev-migration
```

> 詳細手順: [infrastructure/CLAUDE.md - Rule 1](infrastructure/CLAUDE.md)

#### Rule 1-B: 統合デプロイスクリプト使用の徹底（2026-03-18追加）🆕

**🔴 最重要: 手動実行ではなく統合スクリプトを使用すること**

**自動化されるプロセス:**
1. Prismaスキーマ変更検出 → 2. Prisma Client再生成 → 3. Lambda関数デプロイ → 4. DBマイグレーション実行 → 5. デプロイ検証

**Git pre-commit hook設定:**
```bash
ln -s ../../scripts/prisma-schema-guard.sh .git/hooks/pre-commit
```

> 詳細: [infrastructure/CLAUDE.md - Rule 1-B](infrastructure/CLAUDE.md)

#### Rule 2: 環境変数変更時の必須確認

**条件:** `.env.local` または `infrastructure/.env` を変更した場合

**必須実行:**
```bash
./scripts/validate-env.sh          # 検証
pnpm run env:consistency            # 整合性チェック
pkill -f "next dev" && pnpm run dev  # Next.js再起動
cd infrastructure && ./deploy.sh dev # Lambda反映
```

> 詳細: [docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md](docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)

#### Rule 2-B: ハードコード値の絶対禁止（2026-03-19追加）🆕

**🔴 最重要: すべての設定値は .env.local で管理、コード内のハードコード禁止**

**禁止事項:**
```typescript
// ❌ 数値定数のハードコード
const MAX_RESULTS = 1000;
const SALT_ROUNDS = 10;

// ❌ フォールバック値の使用
const region = process.env.AWS_REGION || 'us-east-1';
const model = process.env.BEDROCK_MODEL_ID || 'claude-sonnet-4';

// ❌ AWS ドメイン名のハードコード
const url = `https://bucket.s3.amazonaws.com/${key}`;
```

**正しい方法:**
```typescript
// ✅ env-validator.ts 経由でのみアクセス
import { getMaxResults, getAwsRegion, getRequiredEnv, getAwsEndpointSuffix } from '../shared/utils/env-validator';

const maxResults = getMaxResults();
const region = getAwsRegion();
const model = getRequiredEnv('BEDROCK_MODEL_ID');
const url = `https://bucket.s3.${region}.${getAwsEndpointSuffix()}/${key}`;
```

**検証方法:**
```bash
# ハードコード値検出（9パターン）
bash scripts/detect-hardcoded-values.sh

# 環境変数整合性チェック（8項目）
pnpm run env:consistency
```

**新規環境変数追加手順:**
1. `.env.local` に追加
2. `env-validator.ts` に getter 関数追加
3. コードで `getXxx()` 関数を使用
4. 検証スクリプト実行

> 詳細: [docs/07-development/HARDCODE_ELIMINATION_REPORT.md](docs/07-development/HARDCODE_ELIMINATION_REPORT.md)

#### Rule 3: 根本原因分析の原則（CRITICAL - 2026-03-10追加）

**🔴 最重要: 対症療法ではなく根本原因を修正すること**

**❌ 禁止:** エラーの症状だけに対応、「動けばいい」で終わる、同じエラーの繰り返しを放置

**✅ 必須プロセス:**
1. エラーの再現性を確認
2. ログ全体・スタックトレースを追跡
3. 「なぜ？」を5回繰り返す（5 Whys分析）
4. 根本的な解決策を実装
5. ドキュメント・メモリに記録

**教訓:** 繰り返し発生するエラーは設計上の問題を疑う。

#### Rule 4: テスト・実装確認の原則（CRITICAL - 2026-03-11追加）

**🔴 最重要: 推測でテストを書かず、必ず実装を確認してから作成すること**

**❌ 禁止:** URLパス・ルート構造の推測、「一般的な慣習」だけでコード作成、ドキュメントへの曖昧な記載

**✅ 必須プロセス:**
```bash
# 実装確認（例：Next.jsルート）
find apps/web/app -name "page.tsx" | grep -v node_modules

# APIエンドポイント確認
grep -r "router\\.get\|router\\.post" infrastructure/lambda --include="*.ts"
```

**教訓:** 推測は必ず失敗する。コードが唯一の真実の源。

> 詳細・過去の失敗例: [CODING_RULES.md - Rule 4](CODING_RULES.md)

#### Rule 5: 多言語対応システムの統一（CRITICAL - 2026-03-11追加）

**🔴 最重要: 独自I18nProviderのみ使用、next-intlは使用禁止**

**❌ 禁止:** next-intl の `useTranslations`/`getTranslations` 使用

**✅ 正しい方法:**
```typescript
import { useI18n } from '@/lib/i18n/provider';
export function MyComponent() {
  const { t } = useI18n();
  return <div>{t('common.welcome')}</div>;
}
```

**検証:**
```bash
grep -r "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules
# 期待結果: 0件
```

> 詳細: [docs/07-development/I18N_SYSTEM_GUIDELINES.md](docs/07-development/I18N_SYSTEM_GUIDELINES.md)

#### Rule 6: UI設定項目のデータベース同期原則（CRITICAL - 2026-03-15追加）

**🔴 最重要: UI上で設定可能にした項目は、必ずデータベースに正しく保存・取得されることを保証すること**

**❌ 禁止:** GET APIの select 漏れ、UPDATE APIの updateData 漏れ、不適切なデフォルト値

**✅ 必須プロセス（5 Phase）:**
1. データモデル設計（Prismaスキーマ + マイグレーション）
2. 型定義（packages/shared）
3. バックエンド実装（GET/UPDATE API + DEFAULT_SETTINGS）
4. フロントエンド実装（型定義 + フォーム）
5. 検証（`pnpm run validate:ui-settings`）

**教訓:** デフォルト値は「最も便利な値」に設定（有効化 > 無効化）。

> 詳細: [docs/07-development/UI_SETTINGS_DATABASE_SYNC_RULES.md](docs/07-development/UI_SETTINGS_DATABASE_SYNC_RULES.md)

#### Rule 7: Lambda関数デプロイメント原則（CRITICAL - 2026-03-15追加）🆕

**🔴 最重要: Lambda関数デプロイはCDK経由のみ。手動zipアップロード絶対禁止**

**❌ 禁止:** 手動zipアップロード（TypeScriptがそのままzip → Runtime Error）

**✅ 正しい方法:**
```bash
cd infrastructure && pnpm run deploy:lambda
# CDKが自動実行: esbuildトランスパイル → bundling → 最適化zip → Lambda更新
```

**CDKが「no changes」と判断した場合:**
```bash
# Option 1: ソースコードに小さな変更（推奨）
# index.ts のコメントに現在時刻追加

# Option 2: CDKキャッシュクリア
rm -rf infrastructure/cdk.out/
```

**教訓:** 焦って設計を無視した対処（手動zip）をしない。

> 詳細: [memory/deployment-rules.md](memory/deployment-rules.md)

#### Rule 8: NULL vs UNDEFINED使い分け原則（CRITICAL - 2026-03-16追加）🆕

**🔴 最重要: null と undefined を各レイヤーで一貫して使い分けること**

**基本原則:**
- Database/Backend Lambda/API: `null`（SQL/JSON標準）
- Frontend API Types: `Type | null`（APIレスポンスと一致）
- Frontend UI State: `undefined`（TypeScript optional型）

**変換:**
```typescript
// API取得時: null → undefined
setField(apiResponse.field === null ? undefined : apiResponse.field);

// API送信時: undefined → null
const updateData = { field: stateField === undefined ? null : stateField };
```

> 詳細: [docs/07-development/NULL_UNDEFINED_GUIDELINES.md](docs/07-development/NULL_UNDEFINED_GUIDELINES.md)

#### Rule 9: Enum統一化原則（CRITICAL - 2026-03-18追加）🆕

**🔴 最重要: Enumのインライン定義禁止、共有型のみ使用すること**

**✅ 2026-03-18完了:** 17箇所のインライン定義削除、packages/shared + infrastructure/lambda/shared/types で一元管理

**❌ 禁止:** インライン定義（`'ACTIVE' | 'PROCESSING'`）、独自Enum定義

**✅ 正しい方法:**
```typescript
// Frontend
import type { SessionStatus, AvatarType, UserRole } from '@prance/shared';
const [filter, setFilter] = useState<SessionStatus | 'all'>('all');

// Lambda
import type { UserRole, AvatarType } from '../../shared/types';
const payload: JWTPayload = { role: user.role as UserRole };
```

**効果:** 型安全性向上、保守性向上、DRY原則遵守（17箇所 → 0箇所）

> 詳細: [docs/09-progress/archives/2026-03-18-temporary-reports/ENUM_UNIFICATION_COMPLETE.md](docs/09-progress/archives/2026-03-18-temporary-reports/ENUM_UNIFICATION_COMPLETE.md)

---

### 重要な設計原則

#### 1. コード品質
TypeScript厳密モード、Jest/Playwright、ESLint/Prettier、OWASP Top 10対策

#### 2. サーバーレス最適化
Provisioned Concurrency、ARM64 (Graviton2)、Step Functions、コスト最適化

#### 3. セキュリティ
Cognito + Lambda Authorizer (RBAC)、SSE-KMS/暗号化DB、IAM最小権限、CloudTrail監査

#### 4. 環境変数管理
**🔴 最重要:** AWS RDS Aurora Serverless v2専用。ローカルPostgreSQL使用禁止。

**検証:** `./scripts/validate-env.sh`（コミット前必須）

**更新ファイル:** `.env.local`（ルート）、`infrastructure/.env`

> 詳細: [docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md](docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)

#### 5. 多言語対応
**🌍 対応言語:** 10言語（日英中韓西葡仏独伊）、24リージョナルバリアント

**言語コード:** ISO 639-1（UI）、BCP-47（STT）

**🔴 重要:** zh-CN/zh-TW は完全に異なる言語として扱う（'zh'に削減禁止）

**リソース管理:**
- `language-config.ts` - 言語メタデータ（単一の真実の源）
- `apps/web/messages/{languageCode}.json` - UI翻訳
- 文字列ハードコード禁止、Middlewareで一元管理

**URL設計:** 全言語で共通URL（ロケールプレフィックスなし）

> 詳細: [docs/05-modules/MULTILINGUAL_SYSTEM.md](docs/05-modules/MULTILINGUAL_SYSTEM.md)

#### 6. 設定値の一元管理
**🔴 重要原則:** ハードコード禁止。言語、リージョン、メディアフォーマット、その他定数はリソースファイルで一元管理。

**一元管理ファイル:**
- `infrastructure/lambda/shared/config/defaults.ts` - 全デフォルト値
- `infrastructure/lambda/shared/config/language-config.ts` - 言語メタデータ
- `infrastructure/lambda/shared/config/index.ts` - 環境変数ヘルパー

> 詳細: [infrastructure/lambda/shared/config/defaults.ts](infrastructure/lambda/shared/config/defaults.ts)

#### 7. コミット前チェック
**UI文字列追加・変更時の必須検証:**
```bash
grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components  # ハードコード検出
grep -rn 'placeholder=["'"'"'][A-Z]' apps/web  # placeholder属性
grep -r "import.*useI18n.*from.*@/lib/i18n" apps/web --count  # useI18n使用確認
```

> 詳細: [CODING_RULES.md](CODING_RULES.md)

#### 8. Cookie処理の統一化
**重要:** Cookie設定は統一ユーティリティ（`apps/web/lib/cookies.ts`）を使用。直接`document.cookie`操作禁止。

**効果:** DRY原則、一貫性保持、セキュリティ設定統一管理

> 詳細: [apps/CLAUDE.md - Cookie処理](apps/CLAUDE.md)

#### 9. 言語リスト同期検証
**必須同期:** Frontend config/Lambda config/Message directories の3箇所

**検証:** `pnpm run validate:languages`

> 詳細: [scripts/validate-language-sync.sh](scripts/validate-language-sync.sh)

#### 10. コード整合性管理
**根本問題:** AI生成コード間での不整合（型不整合、スキーマ不整合、名称不整合）

**対策:** 3層防御システム（予防・検出・修正）

**コミット前必須:**
```bash
pnpm run consistency:check    # 不整合検出
pnpm run consistency:fix      # 自動修正
pnpm run pre-commit           # 全チェック
```

> 詳細: [docs/04-design/CONSISTENCY_GUIDELINES.md](docs/04-design/CONSISTENCY_GUIDELINES.md)

#### 11. Prismaスキーマ準拠
**必須:** Prisma Clientのフィールド名と完全一致（camelCase）

**重要フィールド:** `orgId`（organizationId禁止）、`userId`、`scenarioId`、`avatarId`、`startedAt`、`endedAt`

**Enum:** UserRole（SUPER_ADMIN/CLIENT_ADMIN/CLIENT_USER/GUEST）、SessionStatus、AvatarType（TWO_D/THREE_D）

> 詳細: [CODING_RULES.md - Prismaスキーマ準拠](CODING_RULES.md)

#### 12. 型定義の一元管理
**DRY原則:** すべての共有型は `packages/shared/src/types/index.ts` で一元管理。重複定義絶対禁止。

**一元管理型:** Entity（User/Avatar/Session等）、Enum（UserRole/SessionStatus等）、Pagination、Error

**Lambda関数:** `infrastructure/lambda/shared/types/index.ts` が共有型を re-export

**検証:**
```bash
# 重複定義検出
grep -rn "^export interface \(User\|Avatar\)" apps/web infrastructure/lambda --include="*.ts" | grep -v node_modules | grep -v "packages/shared"
```

> 詳細: [CODING_RULES.md - 型定義一元管理](CODING_RULES.md)

### 開発ワークフロー

```bash
# 1. ローカル開発
pnpm install
pnpm run dev

# 2. ビルド・テスト
pnpm run build
pnpm run test
pnpm run lint

# 3. インフラデプロイ (CDK)
cd infrastructure
pnpm run deploy:dev

# 4. コミット・プッシュ
git add .
git commit -m "feat: ..."
git push origin main
```

---

## 5. 設計原則（Design Principles）

### 🎯 コア原則（2026-04-02追加）

このプロジェクトは以下の4つの設計原則に基づいて開発されています。これらは単なる「推奨事項」ではなく、**技術的負債を防ぎ、長期的な保守性を保証するための必須要件**です。

#### 原則1: 依存関係の最小化（Minimize Dependencies）

**Why:** 依存関係は「負債」である

各依存関係は：
- セキュリティリスク（脆弱性）
- 保守コスト（バージョン更新）
- ビルド時間の増加
- バンドルサイズの増加
- ベンダーロックインのリスク

**How:**
- 新規依存追加前に「自前実装できないか」検討（100行以内なら自己実装）
- 大きなライブラリ（20+ 直接依存）は避ける
- ユーティリティライブラリは必要な関数のみコピー
- Tree-shakeable なライブラリを優先

**Automation:** `pnpm run validate:deps-size`

**判断基準:**

| 実装時間 | 推奨アクション |
|---------|--------------|
| < 1時間 | ✅ 自己実装を推奨 |
| 1-4時間 | ✅ 自己実装を検討 |
| 4-8時間 | ⚠️ 軽量ライブラリを検討 |
| > 8時間 | ✅ ライブラリ使用（慎重に選定） |

**成功事例:**
- shadcn/ui 採用（0 runtime dependencies） vs Material-UI（50+ dependencies）
- 独自 i18n システム（200行、0 dependencies） vs next-intl（15+ dependencies）
- native fetch（0 dependencies） vs Axios（5 dependencies）

#### 原則2: ワークスペース境界の明確化（Clear Workspace Boundaries）

**Why:** Monorepoでは境界が曖昧になりやすく、不適切な依存関係が技術的負債を生む

**境界ルール:**

```
apps/web           → CAN import → packages/shared (types only)
                   → CANNOT import → infrastructure

infrastructure     → CAN import → packages/shared (types only)
                   → CANNOT import → apps/web

packages/shared    → CANNOT import → apps/web OR infrastructure
                   → Only type definitions, no runtime logic

packages/database  → CANNOT import → anything except Prisma
```

**How:**
- apps/web: フロントエンド専用（React, Next.js, Browser APIs）
- infrastructure: バックエンド専用（Lambda, AWS SDK, Prisma）
- packages/shared: 型定義のみ（interfaces, types, enums, validation schemas）
- 共有ロジックは各ワークスペースで独立実装

**Automation:** `pnpm run validate:monorepo`

**よくある違反例:**
- ❌ Frontend が Lambda utility 関数を import → AWS SDK が bundle に含まれる（5MB増加）
- ❌ Backend が React component を import → ビルドエラー
- ❌ packages/shared に Prisma Client → Frontend が不要な依存を持つ

**正しい実装:**
```typescript
// packages/shared/src/types/user.ts (✅ 型定義のみ)
export interface User {
  id: string;
  email: string;
}

// apps/web/lib/api.ts (✅ Frontend)
import type { User } from '@prance/shared';

// infrastructure/lambda/auth/me/index.ts (✅ Backend)
import type { User } from '@prance/shared';
```

#### 原則3: 実装を見てからテスト（Implementation First, Then Test）

**Why:** 推測は必ず失敗する。コードが唯一の真実の源。

**過去の失敗例（2026-04-01）:**
- Next.js route を推測でテスト作成
- 想定: `/dashboard/sessions`
- 実際: `/sessions`（route group使用）
- 結果: 3時間のデバッグ時間を浪費

**How:**
1. `find`/`grep` でルート・エンドポイントを確認
2. 実装コードを読む
3. URL/フィールド名/レスポンス構造を確認
4. その後テストを書く

**Automation:** `pnpm run validate:tests`

**テスト作成前チェックリスト:**
- [ ] 実装ファイルを見つけた（find/ls コマンド実行済み）
- [ ] 実装コードを読んだ（推測していない）
- [ ] URL/エンドポイントパスを確認した
- [ ] リクエスト/レスポンス構造を確認した
- [ ] データベーススキーマを確認した（該当する場合）

**よくある推測ミス:**
- Next.js route groups: `(dashboard)` は URL に含まれない
- Prisma schema: `thumbnailUrl` vs `imageUrl`（フィールド名の推測）
- API endpoints: `/api/v1/users/profile` vs `/api/v1/auth/me`（慣習による推測）

#### 原則4: 自動化への投資（Invest in Automation）

**Why:**
- 1時間の自動化スクリプトが100時間のデバッグを防ぐ
- 人間は繰り返し作業でミスをする（30%のエラー率）
- 自動化は「再利用可能な知識」として蓄積される

**投資判断基準:**

| 条件 | 自動化するべきか |
|------|----------------|
| タスクが2回以上繰り返される | ✅ 検討 |
| タスクがシステム正確性に重要 | ✅ 必須 |
| タスクが人的エラーを起こしやすい | ✅ 必須 |
| タスク失敗のコストが高い（1+ 時間） | ✅ 必須 |

**ROI 実績:**

| スクリプト | 作成時間 | 防止エラー数 | 節約時間 | ROI |
|-----------|---------|-------------|---------|-----|
| validate-workspace-dependencies.sh | 2時間 | 12+ (1週間) | 24時間 | 1200% |
| validate-schema-interface-implementation.sh | 3時間 | 8+ (1週間) | 16時間 | 533% |
| deploy.sh | 4時間 | 手動ミス10+ (1ヶ月) | 20時間 | 500% |

**自動化パターン:**
1. **Validation Scripts** - 設定エラー防止（validate-*.sh）
2. **Integration Scripts** - 複数ステップの統合（deploy.sh）
3. **Detection Scripts** - アンチパターン検出（detect-*.sh）
4. **Fix Scripts** - 自動修正（fix-*.sh）

**実装例:**
```bash
# 検証スクリプト例（200-300行が目安）
scripts/validate-workspace-dependencies.sh  # 236行、8チェック
scripts/validate-schema-interface-implementation.sh  # 220行、5チェック
scripts/validate-env-consistency.sh  # 210行、6チェック
```

**Pre-commit hookに統合:**
```bash
# .git/hooks/pre-commit
pnpm run validate:all  # すべての検証を自動実行
```

### 設計原則の適用方法

**日常開発での使用:**

1. **依存関係追加時:**
   ```bash
   pnpm info <package> dependencies  # 依存関係確認
   pnpm run validate:deps-size       # 検証
   ```

2. **コード変更時:**
   ```bash
   pnpm run validate:monorepo  # 境界チェック
   pnpm run validate:tests     # テスト実装チェック
   ```

3. **コミット前:**
   ```bash
   pnpm run pre-commit  # 全チェック自動実行
   ```

**コードレビュー時の確認:**
- [ ] 新規依存は10個以下の直接依存か？
- [ ] ワークスペース境界を侵犯していないか？
- [ ] テストは実装を確認してから書いたか？
- [ ] 繰り返し作業を自動化したか？

**詳細ドキュメント:**
- [memory/feedback_dependency_management.md](memory/feedback_dependency_management.md)
- [memory/feedback_monorepo_rules.md](memory/feedback_monorepo_rules.md)
- [memory/feedback_test_implementation.md](memory/feedback_test_implementation.md)
- [memory/feedback_automation_investment.md](memory/feedback_automation_investment.md)

---

## 6. プロジェクトステータス

### Phase 0: インフラ基盤構築 ✅ 完了 (2026-03-05)

**構築済みインフラ (AWS us-east-1):**

- NetworkStack - VPC、Subnets、NAT Gateway、Security Groups
- CognitoStack - User Pool、認証・認可
- DatabaseStack - Aurora Serverless v2 (PostgreSQL 15.4)
- StorageStack - S3 Buckets、CloudFront CDN
- DynamoDBStack - セッション状態、WebSocket接続
- ApiGatewayStack - REST API、WebSocket API
- ApiLambdaStack - Lambda関数（20+ functions）

### Phase 1-1.6.1: MVP・リアルタイム会話 ✅ 完了 (2026-03-22)

**Phase 1: MVP開発 (2026-03-06)**
- ✅ 認証システム (JWT, Register/Login/Me)
- ✅ シナリオ管理 (CRUD + Clone)
- ✅ アバター管理 (CRUD + Clone)
- ✅ セッション管理 (Create/List/Detail)

**Phase 1.5: リアルタイム会話 (2026-03-21)**
- ✅ リアルタイムSTT（1秒チャンク、無音検出）
- ✅ ストリーミングAI応答（Bedrock Claude Streaming API）
- ✅ ストリーミングTTS（ElevenLabs WebSocket Streaming API）

**Phase 1.6: アバターレンダリング (2026-03-21)**
- ✅ Three.js + React Three Fiber統合
- ✅ 3Dアバターモデル・リップシンク
- ✅ SessionPlayer統合

**Phase 1.6.1: 録画・シナリオ信頼性 (2026-03-22)**
- ✅ WebSocket ACK確認・自動リトライ (Day 31)
- ✅ Partial Recording通知システム (Day 34)
- ✅ 録画統計リアルタイム表示 (Day 35)
- ✅ シナリオバリデーション・エラーリカバリー (Day 36)

> 詳細: [docs/09-progress/archives/SESSION_2026-03-22_Day36_Phase1.6.1_Complete.md](docs/09-progress/archives/SESSION_2026-03-22_Day36_Phase1.6.1_Complete.md)

### Phase 2: 録画・解析・レポート ✅ 完了 (2026-03-17)

**実装完了機能:**

1. ✅ **録画機能** - Backend/Frontend統合、S3保存、CDN配信
2. ✅ **解析機能** - 基盤実装、データモデル構築
3. ✅ **レポート生成** - 基盤実装、テンプレートシステム

> 詳細: [docs/09-progress/phases/PHASE_2_PLAN.md](docs/09-progress/phases/PHASE_2_PLAN.md)

### Phase 2.5: ゲストユーザー機能 ✅ 完了 (2026-03-17)

**実装完了機能:**

- ✅ ゲストユーザー認証（URL + パスワード）
- ✅ ゲストセッション管理
- ✅ 候補者招待・評価機能

### Phase 3: Production環境構築 ✅ 完了 (2026-03-18)

**Phase 3.1: Dev環境 ✅**
- Lambda + API Gateway + CloudFront統合

**Phase 3.2: Production環境 ✅**
- **Frontend:** https://app.prance.jp
- **REST API:** https://api.app.prance.jp
- **WebSocket:** wss://ws.app.prance.jp
- **CDN:** https://cdn.app.prance.jp

**Phase 3.3: E2Eテスト ✅**
- Playwright E2Eテスト実装
- Stage 1-3: 97.1% (34/35)
- Stage 4-5: セッションフィクスチャ修正完了

### コード品質向上: Enum統一化 🎉 完了 (2026-03-18)

**実施内容:**

- ✅ 17箇所のインライン定義を削除
- ✅ UserRoleに'GUEST'を追加（Prismaスキーマと一致）
- ✅ packages/shared + infrastructure/lambda/shared/types で一元管理
- ✅ 型安全性・保守性・DRY原則の向上

**ドキュメント:**
- `ENUM_CONSISTENCY_REPORT.md` - 監査レポート
- `ENUM_UNIFICATION_COMPLETE.md` - 完了レポート

### コード品質向上: ハードコード値削除 🎉 完了 (2026-03-19)

**目的:** .env.local を単一の真実の源（Single Source of Truth）として確立

**実施内容:**

- ✅ defaults.ts の60+定数を環境変数に移行
- ✅ env-validator.ts に20個の getter 関数追加（型安全アクセス）
- ✅ 全フォールバック値削除（`process.env.XXX || 'default'` 形式）
- ✅ AWS domain hardcoding 削除（`AWS_ENDPOINT_SUFFIX` 追加）
- ✅ 20+ Lambda関数ファイルを更新
- ✅ 検証スクリプト拡張（9パターンのハードコード検出）
- ✅ 環境変数整合性チェック追加（8項目検証）

**検証結果:**
- ハードコード値: 0件 ✅
- 環境変数重複: 0件 ✅
- 環境変数矛盾: 0件 ✅
- スコア重み合計: 1.0 ✅

**効果:**
- **保守性向上** - 設定値変更が1箇所で完結（Before: 5-10ファイル → After: .env.local 1行）
- **不整合リスク削減** - 同じ値が複数箇所に存在しない
- **型安全性向上** - env-validator.ts 経由で厳密な型チェック
- **環境差異管理** - dev/staging/production で設定値を容易に変更可能

**ドキュメント:**
- [ハードコード値削除レポート](docs/07-development/HARDCODE_ELIMINATION_REPORT.md) - 完全な実装記録

### Phase 4: ベンチマークシステム ✅ 完了 (2026-03-20)

**実装完了機能:**

1. ✅ **DynamoDB Schema設計** - BenchmarkCache v2 (profileHash+metric), UserSessionHistory (userId+sessionId)
2. ✅ **統計計算ユーティリティ** - Welford's Algorithm (O(1)メモリ), z-score, 偏差値, percentile
3. ✅ **k-anonymity保護** - 最小サンプルサイズ10, プロファイルハッシュ (SHA256)
4. ✅ **Lambda関数** - GET /api/v1/benchmark, POST /api/v1/benchmark/update-history
5. ✅ **フロントエンド統合** - BenchmarkDashboard, MetricCard, GrowthChart, AIInsights
6. ✅ **多言語対応** - 10言語84翻訳キー完全同期
7. ✅ **Production デプロイ** - DynamoDB Tables + Lambda Functions (2026-03-20 08:57-09:05 UTC)
8. ✅ **テスト** - 30単体テスト (statistics, profile-hash)

**統計機能:**
- **平均・中央値・標準偏差** - 基本統計量
- **Z-score** - 標準化スコア
- **偏差値** - 日本式標準化スコア (平均50, 標準偏差10)
- **Percentile Rank** - 正規分布近似による百分位数
- **成長トラッキング** - セッション履歴90日保持

**プライバシー保護:**
- **k-anonymity** - 最小10ユーザー/プロファイル
- **プロファイル正規化** - age→decades, gender, experience, industry, role
- **SHA256ハッシュ** - 個人識別不可能なプロファイルID

> 詳細: [docs/05-modules/BENCHMARK_SYSTEM.md](docs/05-modules/BENCHMARK_SYSTEM.md)

### Phase 5: ランタイム設定管理システム ✅ 完了 (2026-03-21)

**実装完了機能:**

1. ✅ **データモデル** - runtime_configs テーブル設計
2. ✅ **Backend API** - GET/PUT /api/v1/runtime-configs
3. ✅ **Runtime Config Loader** - 3層キャッシュ（Lambda Memory → ElastiCache → Aurora RDS）
4. ✅ **統合実装** - 11ファイル移行完了（100% coverage）
5. ✅ **Score Preset Weights** - 20設定値のDB移行（Phase 5.4.1）

**実装規模:**
- 36 runtime configs（16 original + 20 score preset weights）
- 11ファイル移行、23 Lambda関数更新
- 6デプロイメント（合計 ~850秒）
- 0 runtime errors

**実装方式:**
- Aurora RDS: 設定値の永続化
- ElastiCache: 高速キャッシュ（TTL: 60秒）
- Lambda メモリキャッシュ: 超高速アクセス（TTL: 10秒）
- Graceful degradation: 環境変数フォールバック

**効果:**
- 設定値変更: Lambda再デプロイ不要（5-10分 → 即座）
- A/Bテスト: 有効化（コード変更なし）
- パフォーマンス影響: Negligible (~1ms初回, <0.1ms キャッシュヒット)

> 詳細: [docs/05-modules/RUNTIME_CONFIGURATION.md](docs/05-modules/RUNTIME_CONFIGURATION.md)

---

## 7. 重要な設計判断

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

> 詳細: [docs/10-reference/FAQ.md](docs/10-reference/FAQ.md)

### なぜAIプロンプト・プロバイダ管理を管理者UIに実装したか？

**理由:**

1. **ビジネスの柔軟性** - コード変更なしでプロンプト最適化、開発サイクル短縮
2. **顧客要望への対応** - Enterprise顧客が独自プロンプトで差別化
3. **リスク管理** - プロバイダ障害時の自動フォールバック、コスト管理

> 詳細: [docs/05-modules/AI_MANAGEMENT.md](docs/05-modules/AI_MANAGEMENT.md)

---

## 8. ドキュメント索引

### 初心者向けガイド

- [プロジェクト概要](docs/01-getting-started/README.md)
- [クイックスタート](docs/01-getting-started/QUICKSTART.md)
- [セットアップガイド](docs/01-getting-started/SETUP.md)
- [よくある質問](docs/01-getting-started/FAQ.md)

### アーキテクチャ

- [システムアーキテクチャ](docs/02-architecture/SYSTEM_ARCHITECTURE.md)
- [マルチテナント設計](docs/02-architecture/MULTITENANCY.md)
- [環境アーキテクチャ](docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)

### 計画・ロードマップ

- [実用レベル対応ロードマップ](docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md) 🔴最優先
- [リリースロードマップ](docs/03-planning/releases/RELEASE_ROADMAP.md)
- [完全実装ロードマップ](docs/03-planning/implementation/COMPLETE_IMPLEMENTATION_ROADMAP.md)
- [優先度ベース実装計画](docs/03-planning/implementation/PRIORITY_BASED_IMPLEMENTATION_PLAN.md)
- [実装計画サマリー](docs/03-planning/implementation/IMPLEMENTATION_SUMMARY.md)
- [機能ギャップ分析](docs/03-planning/analysis/FEATURE_GAP_ANALYSIS.md)

### 技術設計

- [API設計](docs/04-design/API_DESIGN.md)
- [データベース設計](docs/04-design/DATABASE_DESIGN.md)
- [APIキー管理](docs/04-design/API_KEY_MANAGEMENT.md)
- [整合性ガイドライン](docs/04-design/CONSISTENCY_GUIDELINES.md)

### モジュール詳細

- [AIプロンプト・プロバイダ管理](docs/05-modules/AI_MANAGEMENT.md)
- [解析モジュール](docs/05-modules/ANALYSIS_MODULE.md)
- [アバターモジュール](docs/05-modules/AVATAR_MODULE.md)
- [ベンチマークシステム](docs/05-modules/BENCHMARK_SYSTEM.md)
- [外部連携API](docs/05-modules/EXTERNAL_API.md)
- [プラン管理](docs/05-modules/SUBSCRIPTION_PLANS.md)
- [多言語対応](docs/05-modules/MULTILINGUAL_SYSTEM.md)
- [ATS連携](docs/05-modules/ATS_INTEGRATION.md)
- [プラグインシステム](docs/05-modules/PLUGIN_SYSTEM.md)
- [ランタイム設定管理](docs/05-modules/RUNTIME_CONFIGURATION.md) 📋 将来実装予定
- その他8モジュール ([docs/05-modules/](docs/05-modules/) 参照)

### インフラ構成

- [AWSサーバーレス構成](docs/06-infrastructure/AWS_SERVERLESS.md)
- [ドメイン設定](docs/06-infrastructure/DOMAIN_SETUP_SUMMARY.md)
- [Node.js 22移行記録](docs/06-infrastructure/NODE22_MIGRATION_REPORT.md)

### 開発ガイド

- [開発ワークフロー](docs/07-development/DEVELOPMENT_WORKFLOW.md)
- [DBマイグレーションチェックリスト](docs/07-development/DATABASE_MIGRATION_CHECKLIST.md)
- [Lambdaバージョン管理](docs/07-development/LAMBDA_VERSION_MANAGEMENT.md)
- [ハードコード値削除レポート](docs/07-development/HARDCODE_ELIMINATION_REPORT.md) 🆕

### 運用ガイド

- [デプロイメント](docs/08-operations/DEPLOYMENT.md)
- [CI/CD](docs/08-operations/CICD.md)
- [運用ガイド](docs/08-operations/OPERATIONS_GUIDE.md)
- [セキュリティ](docs/08-operations/SECURITY.md)

### 進捗記録

- [セッション履歴](docs/09-progress/SESSION_HISTORY.md)
- [Phase 2 計画](docs/09-progress/phases/PHASE_2_PLAN.md)
- [セッションアーカイブ](docs/09-progress/archives/)
- [タスク完了記録](docs/09-progress/tasks/)

### リファレンス

- [技術スタック詳細](docs/10-reference/TECH_STACK.md)
- [用語集](docs/10-reference/GLOSSARY.md)
- [CLAUDE.md英語版](docs/10-reference/CLAUDE.en.md)

---

## 9. 開発プロセスガイドライン

### セッション管理ルール

**プライマリドキュメント:**

- **`START_HERE.md`** - 次回セッション開始の唯一のエントリーポイント
  - 簡潔（200行以内）
  - 常に最新状態を反映
  - 環境確認手順、最優先タスク（1-3項目）のみ記載

**アーカイブドキュメント:**

- **`docs/09-progress/SESSION_HISTORY.md`** - 全セッションの詳細履歴
- **`docs/09-progress/archives/ARCHIVE_YYYY-MM-DD_*.md`** - 各セッションの詳細記録

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

- 詳細な作業内容は `docs/09-progress/archives/ARCHIVE_YYYY-MM-DD_*.md` に保存
- コミットハッシュ、デプロイ時間、エラー対応履歴を記録

**3. 重要な発見・決定事項**

- 技術的な重要発見は `CLAUDE.md` の関連セクションに追加
- アーキテクチャ変更は該当するドキュメント（`docs/02-architecture/`, `docs/05-modules/`）を更新

### 次回セッション開始時の手順（2026-03-19更新）

**第一声:**

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

**🔴 必須実行手順:**

```bash
# Step 1: 環境検証（自動化）
bash scripts/verify-environment.sh

# Step 2: 既知の問題確認
cat docs/07-development/KNOWN_ISSUES.md

# Step 3: START_HERE.mdのタスク実行
```

**検証内容:**

1. Git作業ディレクトリ状態
2. Node.js/npmバージョン確認
3. 環境変数ファイル (`.env.local`) 存在・設定確認
4. データベース接続確認
5. 開発サーバー状態確認
6. API エンドポイント設定確認

**重要原則:**

- ❌ **推測禁止** - 過去に動いていた設定を確認してから変更
- ❌ **不要なファイル作成禁止** - `apps/web/.env.local` 等の個別ファイルは作成しない
- ✅ **最小変更** - 必要最小限の変更のみ実施
- ✅ **記録** - 変更内容を必ず記録

**詳細プロトコル:**

- `docs/07-development/SESSION_RESTART_PROTOCOL.md` - セッション再開の標準手順
- `docs/07-development/KNOWN_ISSUES.md` - 既知の問題と回避策

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

## 10. 貢献・サポート

### 開発チーム

| ロール                 | 担当                            |
| ---------------------- | ------------------------------- |
| フロントエンド開発     | Next.js, Three.js, UI/UX        |
| バックエンド開発       | Lambda, Step Functions, API設計 |
| インフラ/DevOps        | AWS CDK, CI/CD, 監視            |
| AI/ML エンジニア       | プロンプト最適化、解析          |
| プロダクトマネージャー | 要件定義、優先順位付け          |

### 問い合わせ

- **Issues**: GitHub Issues
- **Documentation**: このリポジトリの `docs/` ディレクトリ
- **Progress Tracking**: [START_HERE.md](START_HERE.md)（最新状態）、[docs/09-progress/](docs/09-progress/)（履歴）

---

**最終更新:** 2026-03-22
**次回レビュー予定:** 次Phase開始時
**変更履歴:**
- 2026-03-22: Phase 1-5全完了反映、ドキュメント整理完了
- 2026-03-20: Phase 4完了、環境変数完全管理システム確立
- 2026-03-11: Day 12音声バグ修正完了、Phase 1.5進捗98%に更新
