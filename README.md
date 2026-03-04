# Prance Communication Platform

> AIアバターとのインタラクティブ会話によるトレーニング・評価プラットフォーム

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange.svg)](docs/ARCHITECTURE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

## 概要

Pranceは、AIアバターとのリアルタイム会話を通じて面接練習、語学学習、企業研修などを実現するマルチテナント型SaaSプラットフォームです。

### 主要機能

- 🤖 **AIアバター会話** - Claude APIベースの自然な会話体験
- 📹 **録画・解析** - 感情・非言語行動の自動解析
- 📊 **ベンチマーク** - 全体比較とパーソナライズド改善提案
- 🔌 **ATS連携** - 国内外主要6社のATS統合
- 🌍 **多言語対応** - 日本語・英語（将来的に8言語以上）
- 🔧 **プラグインシステム** - 拡張可能なアーキテクチャ

## クイックスタート

### 前提条件

- Node.js 20.x
- AWS CLI v2
- Docker Desktop
- AWS CDK CLI

```bash
# 依存関係インストール
npm install

# 開発環境セットアップ
npm run setup:dev

# ローカル開発サーバー起動
npm run dev
```

詳細は [開発ガイド](docs/DEVELOPMENT_GUIDE.md) を参照してください。

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

詳細は [プロジェクト構造](docs/PROJECT_STRUCTURE.md) を参照してください。

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

### プロジェクト管理
- [実装プラン](docs/IMPLEMENTATION_PLAN.md) - フェーズ分け実装計画
- [プロジェクト構造](docs/PROJECT_STRUCTURE.md) - コードベース構成

### 技術ドキュメント
- [アーキテクチャ](docs/ARCHITECTURE.md) - システムアーキテクチャ
- [データベース設計](docs/DATABASE_DESIGN.md) - スキーマ設計
- [API仕様](docs/API_SPECIFICATION.md) - RESTful API仕様
- [開発ガイド](docs/DEVELOPMENT_GUIDE.md) - Claude Code開発ガイド

### ビジネスドキュメント
- [ビジネス概要](docs/BUSINESS_OVERVIEW.md) - ビジネスモデル・市場分析
- [製品要件](docs/PRODUCT_REQUIREMENTS.md) - 機能要件・仕様
- [ユーザーストーリー](docs/USER_STORIES.md) - ユースケース

### 運用ドキュメント
- [運用ガイド](docs/OPERATIONS_GUIDE.md) - 監視・トラブルシューティング
- [セキュリティ](docs/SECURITY.md) - セキュリティポリシー

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

詳細は [開発ガイド](docs/DEVELOPMENT_GUIDE.md#claude-code) を参照してください。

## CI/CD

GitHub ActionsとAWS CDKによる自動化されたCI/CDパイプライン。

- **PR作成時**: 自動テスト・Lintチェック
- **mainマージ時**: ステージング環境自動デプロイ
- **タグプッシュ時**: プロダクション環境デプロイ

詳細は [CI/CDガイド](docs/CICD.md) を参照してください。

## チーム構成

| ロール | 人数 | 主な担当 |
|--------|------|----------|
| フロントエンド | 2名 | Next.js, UI/UX |
| バックエンド | 2名 | Lambda, API設計 |
| インフラ/DevOps | 1名 | AWS CDK, CI/CD |
| AI/MLエンジニア | 1名 | プロンプト最適化 |
| PM | 1名 | 要件定義、調整 |
| QA | 1名 | テスト自動化 |

## ライセンス

Proprietary - All rights reserved

## サポート

- 📧 Email: support@prance-platform.com
- 📚 ドキュメント: [docs/](docs/)
- 🐛 Issue報告: [GitHub Issues](https://github.com/your-org/prance-platform/issues)

---

**開発開始日**: 2026-03-04
**想定リリース**: 2026-10-01 (Phase 0-4完了)
