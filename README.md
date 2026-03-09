# Prance Communication Platform

> AIアバターとのインタラクティブ会話によるトレーニング・評価プラットフォーム

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange.svg)](docs/ARCHITECTURE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

## 概要

Pranceは、AIアバターとのリアルタイム会話を通じて面接練習、語学学習、企業研修などを実現するマルチテナント型SaaSプラットフォームです。

### 主要機能

- 🤖 **AIアバター会話** - Claude APIベースの自然な会話体験
  - ⚠️ **重要**: 現在Phase 1は技術的に動作しますが、実用レベルではありません（バッチ処理）
  - 🔴 **Phase 1.5-1.6で実用レベルに改善中** - リアルタイムストリーミング対応
  - 目標: リアルタイムUI、低レイテンシ（2-5秒）、話者別文字起こし、音声とリップシンクの完全同期
- 📹 **録画・解析** - 感情・非言語行動の自動解析（Phase 2）
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
4. **[開発ワークフロー](docs/development/DEVELOPMENT_WORKFLOW.md)** - Claude Code活用・包括的ガイド
5. **[外部ツールセットアップ](docs/reference/EXTERNAL_TOOLS_SETUP.md)** - API登録・キー取得の完全ガイド

**開発開始の流れ**:

1. **外部サービス登録**（1-2日）
   - Claude API、ElevenLabs、Azure等のアカウント作成
   - APIキー取得・Secrets Manager設定
   - 👉 [外部ツールセットアップガイド](docs/reference/EXTERNAL_TOOLS_SETUP.md)

2. **インフラ構築**（2週間）
   - AWS CDKによるサーバーレス基盤構築
   - 👉 [実装フェーズ](docs/development/IMPLEMENTATION_PHASES.md)

3. **機能開発**（13ヶ月）
   - Alpha → Beta → v1.0 → v1.x → v2.0
   - 👉 [機能モジュール一覧](docs/modules/)

**開発スケジュール**:

- **🔴 Production-Ready（2週間）**: リアルタイム会話・実用レベル化 ← **最優先対応中**
- **MVP Release（4週間）**: 録画・解析・レポート機能
- **Beta Release（9週間）**: ゲストユーザー、XLSX一括登録、ATS連携
- **v1.0 GA（6週間）**: サブスクリプション、外部API、ベンチマーク
- **v2.0 Enterprise（7週間）**: AIプロンプト管理、高度分析、最適化
- **v2.5 Advanced（15週間）**: カスタムアバター、音声クローン、プラグイン

**全体期間**: 43週間（約10.5ヶ月）

詳細は [実用レベル対応ロードマップ](docs/development/PRODUCTION_READY_ROADMAP.md) 🔴と [完全実装ロードマップ](docs/development/COMPLETE_IMPLEMENTATION_ROADMAP.md) を参照してください。

## クイックスタート

### ⚠️ 重要：環境アーキテクチャ

**ローカル開発環境でもAWSインフラを使用します。**

```
localhost:3000 (Next.js) → AWS Lambda API → AWS RDS Aurora
```

詳細は **[環境アーキテクチャ](docs/development/ENVIRONMENT_ARCHITECTURE.md)** を参照してください。

### 前提条件

- Node.js 20.x
- AWS CLI v2（認証設定済み）
- AWS CDK CLI
- Docker Desktop（CDKビルド用）

### セットアップ手順

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集してAPIキーを設定

# 3. AWS CDKデプロイ（初回のみ）
cd infrastructure
npx cdk bootstrap
npm run deploy

# 4. ローカル開発サーバー起動
cd ../apps/web
npm run dev
# → http://localhost:3000
```

詳細は以下を参照してください：

- **[セットアップガイド](docs/SETUP.md)** - 詳細な初期設定手順
- **[クイックスタート](docs/QUICKSTART.md)** - 作業再開手順
- **[環境アーキテクチャ](docs/development/ENVIRONMENT_ARCHITECTURE.md)** - 環境構成の理解
- **[APIキー管理](docs/development/API_KEY_MANAGEMENT.md)** - APIキーの一元管理

## プロジェクト構造

```
prance-communication-platform/
├── apps/
│   ├── web/              # Next.js フロントエンド
│   ├── api/              # NestJS バックエンド（Lambda関数）
│   └── workers/          # バックグラウンドワーカー
├── packages/
│   ├── shared/           # 共有ライブラリ
│   ├── database/         # Prismaスキーマ・マイグレーション
│   └── plugins/          # プラグインSDK
├── infrastructure/       # AWS CDK IaCコード
├── scripts/              # デプロイ・ユーティリティスクリプト
└── docs/                 # ドキュメント
```

詳細は [システムアーキテクチャ](docs/architecture/SYSTEM_ARCHITECTURE.md) を参照してください。

## デプロイ

### ステージング環境

```bash
npm run deploy:staging
```

### プロダクション環境

```bash
npm run deploy:production
```

詳細は [デプロイメントガイド](docs/DEPLOYMENT.md) を参照してください。

## ドキュメント

### 🔧 セットアップ・開発

- **[セットアップガイド](docs/SETUP.md)** - 初回環境構築手順
- **[クイックスタート](docs/QUICKSTART.md)** - 作業再開手順（1分チェックリスト）
- **[開発ワークフロー](docs/development/DEVELOPMENT_WORKFLOW.md)** ⭐ - Claude Code活用・包括的開発ガイド
- **[外部ツールセットアップ](docs/reference/EXTERNAL_TOOLS_SETUP.md)** - API登録・キー取得の完全ガイド
  - AI・会話サービス（Claude、OpenAI、Gemini）
  - 音声サービス（ElevenLabs、Azure Speech）
  - 画像・感情解析（Azure Face、MediaPipe）
  - アバター生成（Ready Player Me、Live2D）
  - AWS、Stripe、ATS連携
  - チェックリスト・コスト試算

### 📋 プロジェクト管理

- **[実装計画](docs/development/)** - 詳細実装ロードマップ
  - 🔴 [実用レベル対応ロードマップ](docs/development/PRODUCTION_READY_ROADMAP.md) - **最優先対応（Phase 1.5-1.6）**
  - [完全実装ロードマップ](docs/development/COMPLETE_IMPLEMENTATION_ROADMAP.md) - Phase 0-7全体計画
  - [優先度ベース実装計画](docs/development/PRIORITY_BASED_IMPLEMENTATION_PLAN.md) - Day単位の詳細タスク
  - [実装計画サマリー](docs/development/IMPLEMENTATION_SUMMARY.md) - 全体ナビゲーション
- **[進捗記録](docs/progress/)** - セッション履歴・Phase完了記録
  - [SESSION_HISTORY.md](docs/progress/SESSION_HISTORY.md) - 全セッション詳細
  - [PHASE_2_PLAN.md](docs/progress/PHASE_2_PLAN.md) - Phase 2詳細プラン
- [実装フェーズ](docs/development/IMPLEMENTATION_PHASES.md) - 技術的実装計画（旧版・参考）

### 🏗️ 技術ドキュメント

- [システムアーキテクチャ](docs/architecture/SYSTEM_ARCHITECTURE.md) - AWSサーバーレス全体構成
- [マルチテナント設計](docs/architecture/MULTITENANCY.md) - 3階層ユーザーロール
- [データベース設計](docs/development/DATABASE_DESIGN.md) - Aurora/DynamoDBスキーマ
- [API設計](docs/development/API_DESIGN.md) - RESTful API + WebSocket仕様
- [AWS詳細](docs/infrastructure/AWS_SERVERLESS.md) - インフラ構成詳細
- [CI/CDガイド](docs/CICD.md) - GitHub Actions + AWS CDK

### 💼 リファレンス

- [技術スタック](docs/reference/TECH_STACK.md) - 使用技術詳細
- [FAQ](docs/reference/FAQ.md) - よくある質問
- [用語集](docs/reference/GLOSSARY.md) - 専門用語解説
- [ビジネス概要](docs/reference/BUSINESS_OVERVIEW.md) - ビジネスモデル・市場分析
- [CLAUDE.md](CLAUDE.md) - 完全プロジェクト仕様書

### 🔐 運用・セキュリティ

- [デプロイメントガイド](docs/DEPLOYMENT.md) - 環境別デプロイ手順
- [運用ガイド](docs/OPERATIONS_GUIDE.md) - 監視・トラブルシューティング
- [セキュリティ](docs/SECURITY.md) - セキュリティポリシー・コンプライアンス

## 開発ワークフロー

### Claude Code での開発

このプロジェクトはClaude Codeでの開発を前提に設計されています。

```bash
# 機能ブランチ作成
git checkout -b feature/user-authentication

# Claude Codeで開発
# → 各機能は独立したモジュールとして実装

# テスト実行
npm test

# コミット
git add .
git commit -m "feat: implement user authentication"

# プッシュ（自動的にCI/CDパイプライン起動）
git push origin feature/user-authentication
```

詳細は [開発ワークフロー](docs/development/DEVELOPMENT_WORKFLOW.md) を参照してください。

## CI/CD

GitHub ActionsとAWS CDKによる自動化されたCI/CDパイプライン。

- **PR作成時**: 自動テスト・Lintチェック
- **mainマージ時**: ステージング環境自動デプロイ
- **タグプッシュ時**: プロダクション環境デプロイ

詳細は [CI/CDガイド](docs/CICD.md) を参照してください。

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
