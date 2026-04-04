# Prance Communication Platform

> AIアバターとのインタラクティブ会話によるトレーニング・評価プラットフォーム

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange.svg)](docs/02-architecture/SYSTEM_ARCHITECTURE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

## 概要

Pranceは、AIアバターとのリアルタイム会話を通じて面接練習、語学学習、企業研修などを実現するマルチテナント型SaaSプラットフォームです。

### 主要機能

- 🤖 **AIアバター会話** - Claude APIベースの自然な会話体験
  - ✅ **Phase 1.5ほぼ完了（98%）** - リアルタイムストリーミング実装・音声バグ修正完了
  - ⚠️ **音声再生テスト待ち** - 次回セッションで最終検証
  - 実装済み: リアルタイムSTT、ストリーミングAI応答、ストリーミングTTS、環境ノイズ対策
  - 目標達成: 低レイテンシ（2-5秒）、話者別文字起こし、音声とリップシンクの完全同期
- 📹 **録画・解析** - 感情・非言語行動の自動解析（Phase 2完了）
  - ユーザーとアバターの同時録画、サイドバイサイド合成動画、感情・視線解析
- 📊 **ベンチマーク** - 全体比較とパーソナライズド改善提案（Phase 4）
- 🔌 **ATS連携** - 国内外主要6社のATS統合（Phase 3）
- 🌍 **多言語対応** - 10言語完全対応（日英中韓西葡仏独伊）✅
- 🔧 **プラグインシステム** - 拡張可能なアーキテクチャ（Phase 5-7）

### 🚀 開発を始める前に

**必読ドキュメント**:

1. **[START_HERE.md](START_HERE.md)** ⭐⭐⭐ - 次回セッション開始手順（最優先）
2. **[CODING_RULES.md](CODING_RULES.md)** ⭐⭐ - コミット前チェックリスト（必須）
3. **[CLAUDE.md](CLAUDE.md)** ⭐ - プロジェクト概要・開発ガイドライン
4. **[docs/README.md](docs/README.md)** - ドキュメント構造ガイド

**開発開始の流れ**:

1. **セットアップ確認**（5分）
   - 環境変数、AWS認証、Next.js開発サーバー確認
   - 👉 [START_HERE.md](START_HERE.md)

2. **ドキュメント構造の理解**（10分）
   - 01-10の番号付きカテゴリーで論理的に整理
   - 👉 [docs/README.md](docs/README.md)

3. **優先タスクの確認**（5分）
   - Phase 1.5-1.6（実用化対応）またはPhase 2.3（レポート）
   - 👉 [START_HERE.md](START_HERE.md)

**開発スケジュール**:

- **🔴 Phase 1.5-1.6（2週間）**: リアルタイム会話・実用レベル化 ← **最優先対応中**
- **Phase 2.3（1-2週間）**: レポート生成機能
- **Phase 2.5（3週間）**: ゲストユーザーシステム
- **Phase 3.1（2週間）**: XLSX一括登録、基本ATS連携
- **Phase 4（4週間）**: SaaS機能（サブスクリプション、外部API、ベンチマーク）
- **Phase 5-6（8週間）**: Enterprise機能・最適化
- **Phase 7（15週間）**: 高度な機能拡張

**全体期間**: 43週間（約10.5ヶ月）

詳細は [実用レベル対応ロードマップ](docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md) 🔴と [完全実装ロードマップ](docs/03-planning/implementation/COMPLETE_IMPLEMENTATION_ROADMAP.md) を参照してください。

## クイックスタート

### ⚠️ 重要：環境アーキテクチャ

**ローカル開発環境でもAWSインフラを使用します。**

```
localhost:3000 (Next.js) → AWS Lambda API → AWS RDS Aurora
```

詳細は **[環境アーキテクチャ](docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)** を参照してください。

### 前提条件

- Node.js 20.x
- AWS CLI v2（認証設定済み）
- AWS CDK CLI
- Docker Desktop（CDKビルド用）

### セットアップ手順

```bash
# 1. 依存関係インストール
pnpm install

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集してAPIキーを設定

# 3. AWS CDKデプロイ（初回のみ）
cd infrastructure
pnpm exec cdk bootstrap
pnpm run deploy

# 4. ローカル開発サーバー起動
cd ../apps/web
pnpm run dev
# → http://localhost:3000
```

詳細は以下を参照してください：

- **[セットアップガイド](docs/01-getting-started/SETUP.md)** - 詳細な初期設定手順
- **[クイックスタート](docs/01-getting-started/QUICKSTART.md)** - 作業再開手順
- **[環境アーキテクチャ](docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)** - 環境構成の理解
- **[APIキー管理](docs/04-design/API_KEY_MANAGEMENT.md)** - APIキーの一元管理

## プロジェクト構造

```
prance-communication-platform/
├── apps/
│   └── web/              # Next.js フロントエンド
├── packages/
│   ├── shared/           # 共有ライブラリ
│   └── database/         # Prismaスキーマ・マイグレーション
├── infrastructure/       # AWS CDK IaCコード + Lambda関数
│   ├── lib/              # CDK Stacks
│   └── lambda/           # Lambda関数実装
├── scripts/              # デプロイ・ユーティリティスクリプト
└── docs/                 # ドキュメント（01-10番号付きカテゴリー）
    ├── 01-getting-started/
    ├── 02-architecture/
    ├── 03-planning/
    ├── 04-design/
    ├── 05-modules/
    ├── 06-infrastructure/
    ├── 07-development/
    ├── 08-operations/
    ├── 09-progress/
    └── 10-reference/
```

詳細は [システムアーキテクチャ](docs/02-architecture/SYSTEM_ARCHITECTURE.md) を参照してください。

## デプロイ

### 開発環境

```bash
cd infrastructure
pnpm run cdk -- deploy --all --require-approval never
```

### ステージング環境

```bash
pnpm run deploy:staging
```

### プロダクション環境

```bash
pnpm run deploy:production
```

詳細は [デプロイメントガイド](docs/08-operations/DEPLOYMENT.md) を参照してください。

## ドキュメント

### 📖 初心者向けガイド（01-getting-started）

- **[プロジェクト概要](docs/01-getting-started/README.md)** - プロジェクトの全体像
- **[セットアップガイド](docs/01-getting-started/SETUP.md)** - 初回環境構築手順
- **[クイックスタート](docs/01-getting-started/QUICKSTART.md)** - 作業再開手順（1分チェックリスト）
- **[FAQ](docs/01-getting-started/FAQ.md)** - よくある質問

### 🏗️ アーキテクチャ（02-architecture）

- **[システムアーキテクチャ](docs/02-architecture/SYSTEM_ARCHITECTURE.md)** - AWSサーバーレス全体構成
- **[マルチテナント設計](docs/02-architecture/MULTITENANCY.md)** - 4階層ユーザーロール
- **[環境アーキテクチャ](docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)** - 環境構成の詳細

### 📋 計画・ロードマップ（03-planning）

#### リリース計画（releases/）

- 🔴 **[実用レベル対応ロードマップ](docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md)** - **最優先対応（Phase 1.5-1.6）**
- **[リリースロードマップ](docs/03-planning/releases/RELEASE_ROADMAP.md)** - MVP/Beta/v1.0/v2.0計画

#### 実装計画（implementation/）

- **[完全実装ロードマップ](docs/03-planning/implementation/COMPLETE_IMPLEMENTATION_ROADMAP.md)** - Phase 0-7全体計画（43週間）
- **[優先度ベース実装計画](docs/03-planning/implementation/PRIORITY_BASED_IMPLEMENTATION_PLAN.md)** - Day単位の詳細タスク
- **[実装計画サマリー](docs/03-planning/implementation/IMPLEMENTATION_SUMMARY.md)** - 全体ナビゲーション

#### 分析（analysis/）

- **[機能ギャップ分析](docs/03-planning/analysis/FEATURE_GAP_ANALYSIS.md)** - 仕様と実装の差分
- **[不整合レポート](docs/03-planning/analysis/INCONSISTENCY_REPORT.md)** - コード整合性分析

### 🔧 技術設計（04-design）

- **[API設計](docs/04-design/API_DESIGN.md)** - RESTful API + WebSocket仕様
- **[データベース設計](docs/04-design/DATABASE_DESIGN.md)** - Aurora/DynamoDBスキーマ
- **[APIキー管理](docs/04-design/API_KEY_MANAGEMENT.md)** - APIキーの一元管理
- **[整合性ガイドライン](docs/04-design/CONSISTENCY_GUIDELINES.md)** - コード整合性ルール
- **[ロックメカニズム改善](docs/04-design/LOCK_MECHANISM_IMPROVEMENTS.md)** - 並行処理制御

### 💡 機能モジュール（05-modules）

- **[AI管理](docs/05-modules/AI_MANAGEMENT.md)** - プロンプト・プロバイダ管理
- **[解析モジュール](docs/05-modules/ANALYSIS_MODULE.md)** - 感情・音声解析
- **[アバターモジュール](docs/05-modules/AVATAR_MODULE.md)** - 2D/3Dアバター
- **[ベンチマークシステム](docs/05-modules/BENCHMARK_SYSTEM.md)** - 比較・改善提案
- **[外部API](docs/05-modules/EXTERNAL_API.md)** - APIキー管理・レート制限
- **[ゲストユーザーシステム](docs/05-modules/GUEST_USER_SYSTEM.md)** - ログイン不要アクセス
- **[多言語システム](docs/05-modules/MULTILINGUAL_SYSTEM.md)** - 10言語対応
- **[レポートモジュール](docs/05-modules/REPORT_MODULE.md)** - PDF生成
- **[セッション録画](docs/05-modules/SESSION_RECORDING.md)** - 録画・再生
- **[サブスクリプションプラン](docs/05-modules/SUBSCRIPTION_PLANS.md)** - プラン管理
- **[音声モジュール](docs/05-modules/VOICE_MODULE.md)** - TTS/STT
- ... 他6モジュール

### 🛠️ インフラ構成（06-infrastructure）

- **[AWSサーバーレス](docs/06-infrastructure/AWS_SERVERLESS.md)** - インフラ構成詳細
- **[ドメイン設定](docs/06-infrastructure/DOMAIN_SETUP_SUMMARY.md)** - DNS・SSL設定
- **[Node.js 22移行](docs/06-infrastructure/NODE22_MIGRATION_REPORT.md)** - 移行記録

### 👨‍💻 開発ガイド（07-development）

- **[開発ワークフロー](docs/07-development/DEVELOPMENT_WORKFLOW.md)** - Claude Code活用ガイド
- **[DBマイグレーションチェックリスト](docs/07-development/DATABASE_MIGRATION_CHECKLIST.md)** - Prisma手順
- **[Lambdaバージョン管理](docs/07-development/LAMBDA_VERSION_MANAGEMENT.md)** - デプロイ検証
- **[ロックメカニズム分析](docs/07-development/LOCK_MECHANISM_ANALYSIS.md)** - 並行処理問題分析

### 🚀 運用ガイド（08-operations）

- **[デプロイメント](docs/08-operations/DEPLOYMENT.md)** - 環境別デプロイ手順
- **[CI/CD](docs/08-operations/CICD.md)** - GitHub Actions + AWS CDK
- **[運用ガイド](docs/08-operations/OPERATIONS_GUIDE.md)** - 監視・トラブルシューティング
- **[セキュリティ](docs/08-operations/SECURITY.md)** - セキュリティポリシー

### 📈 進捗記録（09-progress）

- **[セッション履歴](docs/09-progress/SESSION_HISTORY.md)** - 全セッション詳細
- **[Phase 2計画](docs/09-progress/phases/PHASE_2_PLAN.md)** - 録画・解析・レポート
- **[Phase 2.2計画](docs/09-progress/phases/PHASE_2.2_ANALYSIS_IMPLEMENTATION_PLAN.md)** - 解析機能詳細
- **[Phase 1完了記録](docs/09-progress/archives/ARCHIVE_2026-03-06_Phase1_Completion.md)**
- **[Phase 2.2統合記録](docs/09-progress/archives/SESSION_2026-03-09_PHASE_2.2_INTEGRATION.md)**
- **[タスク完了記録](docs/09-progress/tasks/)** - 個別タスク詳細

### 📚 リファレンス（10-reference）

- **[技術スタック](docs/10-reference/TECH_STACK.md)** - 使用技術詳細
- **[FAQ](docs/10-reference/FAQ.md)** - よくある質問
- **[用語集](docs/10-reference/GLOSSARY.md)** - 専門用語解説
- **[CLAUDE.md英語版](docs/10-reference/CLAUDE.en.md)**

## 開発ワークフロー

### Claude Code での開発

このプロジェクトはClaude Codeでの開発を前提に設計されています。

```bash
# 次回セッション開始
# 第一声: 「前回の続きから始めます。START_HERE.mdを確認してください。」

# 機能ブランチ作成
git checkout -b feature/realtime-conversation

# Claude Codeで開発
# → 各機能は独立したモジュールとして実装

# テスト実行
pnpm test

# コミット前チェック（CODING_RULES.md参照）
pnpm run lint
pnpm run typecheck
pnpm run consistency:check

# コミット
git add .
git commit -m "feat: implement realtime conversation"

# プッシュ（自動的にCI/CDパイプライン起動）
git push origin feature/realtime-conversation
```

詳細は [開発ワークフロー](docs/07-development/DEVELOPMENT_WORKFLOW.md) を参照してください。

## CI/CD

GitHub ActionsとAWS CDKによる自動化されたCI/CDパイプライン。

- **PR作成時**: 自動テスト・Lintチェック
- **mainマージ時**: ステージング環境自動デプロイ
- **タグプッシュ時**: プロダクション環境デプロイ

詳細は [CI/CDガイド](docs/08-operations/CICD.md) を参照してください。

## チーム構成

| ロール          | 人数 | 主な担当         |
| --------------- | ---- | ---------------- |
| フロントエンド  | 2名  | Next.js, UI/UX   |
| バックエンド    | 2名  | Lambda, API設計  |
| インフラ/DevOps | 1名  | AWS CDK, CI/CD   |
| AI/MLエンジニア | 1名  | プロンプト最適化 |
| PM              | 1名  | 要件定義、調整   |
| QA              | 1名  | テスト自動化     |

## ライセンス

Proprietary - All rights reserved

## サポート

- 📧 Email: support@prance-platform.com
- 📚 ドキュメント: [docs/](docs/)
- 🐛 Issue報告: [GitHub Issues](https://github.com/your-org/prance-platform/issues)

---

**開発開始日**: 2026-03-04
**Production-Ready目標**: 2026-04-15 (Phase 1.5-1.6完了) 🔴最優先
**MVP Release目標**: 2026-05-15 (Phase 0-2完了)
**Beta Release目標**: 2026-07-15 (Phase 2.5, 3.1完了)
**v1.0 GA目標**: 2026-09-15 (Phase 4完了)
**v2.0 Enterprise目標**: 2026-11-15 (Phase 5-6完了)
**v2.5 Advanced目標**: 2027-01-15 (Phase 7完了)
