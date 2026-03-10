# Prance Communication Platform - ドキュメントガイド

このディレクトリには、Pranceプラットフォームの全ドキュメントが論理的に整理されています。

## ドキュメント構造（読む順序）

### 01. 初心者向けガイド
新規開発者はここから始めてください。

- **README.md** - プロジェクト概要
- **QUICKSTART.md** - 5分で動かすクイックスタート
- **SETUP.md** - 詳細なセットアップガイド
- **FAQ.md** - よくある質問

### 02. アーキテクチャ
システム全体の設計思想を理解する。

- **SYSTEM_ARCHITECTURE.md** - システム全体構成
- **MULTITENANCY.md** - マルチテナント設計
- **ENVIRONMENT_ARCHITECTURE.md** - 環境アーキテクチャ

### 03. 計画・ロードマップ
開発計画とリリースロードマップ。

- **releases/** - リリース計画
  - PRODUCTION_READY_ROADMAP.md 🔴最優先
  - RELEASE_ROADMAP.md
- **implementation/** - 実装計画
  - COMPLETE_IMPLEMENTATION_ROADMAP.md
  - PRIORITY_BASED_IMPLEMENTATION_PLAN.md
  - COMPREHENSIVE_IMPLEMENTATION_PLAN.md
  - IMPLEMENTATION_PHASES.md
  - IMPLEMENTATION_SUMMARY.md
- **analysis/** - 分析・ギャップ分析
  - FEATURE_GAP_ANALYSIS.md
  - INCONSISTENCY_REPORT.md

### 04. 技術設計
API、データベース、その他技術設計詳細。

- **API_DESIGN.md** - RESTful API設計
- **DATABASE_DESIGN.md** - データベーススキーマ
- **API_KEY_MANAGEMENT.md** - APIキー管理
- **CONSISTENCY_GUIDELINES.md** - コード整合性ガイドライン
- **LOCK_MECHANISM_IMPROVEMENTS.md** - ロックメカニズム改善

### 05. 機能モジュール
各機能モジュールの詳細仕様（17モジュール）。

- AI_MANAGEMENT.md
- ANALYSIS_MODULE.md
- AVATAR_MODULE.md
- BENCHMARK_SYSTEM.md
- EXTERNAL_API.md
- GUEST_USER_SYSTEM.md
- MULTILINGUAL_SYSTEM.md
- REPORT_MODULE.md
- SESSION_RECORDING.md
- SUBSCRIPTION_PLANS.md
- VOICE_MODULE.md
- ... 他6モジュール

### 06. インフラ構成
AWS、サーバーレス、デプロイ構成。

- **AWS_SERVERLESS.md** - AWSサーバーレス詳細
- **DOMAIN_SETUP_SUMMARY.md** - ドメイン設定
- **NODE22_MIGRATION_REPORT.md** - Node.js 22移行記録

### 07. 開発ガイド
日常的な開発作業のガイド。

- **DEVELOPMENT_WORKFLOW.md** - 開発ワークフロー
- **BUILD_PROCESS.md** - ビルドプロセスガイド（通常/クリーン/デプロイ前検証） 🆕
- **TROUBLESHOOTING_NODE_MODULES.md** - node_modulesトラブルシューティング 🆕
- **MEDIARECORDER_LIFECYCLE.md** - MediaRecorder APIライフサイクル（timeslice削除対応） 🆕
- **DATABASE_MIGRATION_CHECKLIST.md** - DBマイグレーションチェックリスト
- **LAMBDA_VERSION_MANAGEMENT.md** - Lambdaバージョン管理
- **LOCK_MECHANISM_ANALYSIS.md** - ロックメカニズム分析

### 08. 運用ガイド
デプロイ、CI/CD、運用、セキュリティ。

- **DEPLOYMENT.md** - デプロイメント手順
- **CICD.md** - CI/CDパイプライン
- **OPERATIONS_GUIDE.md** - 運用ガイド
- **SECURITY.md** - セキュリティガイドライン

### 09. 進捗記録
セッション履歴、Phase計画、タスク完了記録。

- **SESSION_HISTORY.md** - 全セッション詳細履歴
- **archives/** - セッション記録
  - ARCHIVE_2026-03-06_Phase1_Completion.md
  - SESSION_2026-03-09_*.md
  - SESSION_2026-03-10_Day12_Audio_Bug_Fixes.md 🆕
- **phases/** - Phase計画
  - PHASE_2_PLAN.md
  - PHASE_2.2_ANALYSIS_IMPLEMENTATION_PLAN.md
- **tasks/** - タスク完了記録
  - TASK_2.2.1_EMOTION_ANALYSIS_COMPLETE.md
  - TASK_2.2.2_AUDIO_ANALYSIS_COMPLETE.md
  - TASK_2.2.3_SCORING_ALGORITHM_COMPLETE.md
  - SESSIONPLAYER_REFACTORING_COMPLETE.md

### 10. リファレンス
技術スタック、用語集、その他参照資料。

- **TECH_STACK.md** - 技術スタック詳細
- **GLOSSARY.md** - 用語集
- **CLAUDE.en.md** - CLAUDE.md英語版

### archive/
削除・変更履歴（参考資料）。

- DELETED_FILES_2026-03-09.md
- DOCUMENTATION_CLEANUP_SUMMARY.md

---

## クイックリンク

- **開発開始**: [01-getting-started/QUICKSTART.md](01-getting-started/QUICKSTART.md)
- **最優先タスク**: [03-planning/releases/PRODUCTION_READY_ROADMAP.md](03-planning/releases/PRODUCTION_READY_ROADMAP.md) 🔴
- **アーキテクチャ理解**: [02-architecture/SYSTEM_ARCHITECTURE.md](02-architecture/SYSTEM_ARCHITECTURE.md)
- **進捗確認**: [09-progress/SESSION_HISTORY.md](09-progress/SESSION_HISTORY.md)

## 更新履歴

- **2026-03-11**:
  - Day 12音声バグ修正セッション記録追加（SESSION_2026-03-10_Day12_Audio_Bug_Fixes.md）
  - Phase 1.5進捗98%に更新（音声再生テスト待ち）
  - MediaRecorder Lifecycle文書更新（timeslice削除対応）
- **2026-03-10**:
  - ビルドプロセスガイド追加（BUILD_PROCESS.md, TROUBLESHOOTING_NODE_MODULES.md）
  - ドキュメント構造を番号付きカテゴリーに再編成
- **2026-03-09**: DOCUMENTATION_CLEANUP_SUMMARY.md 作成
- **2026-03-06**: Phase 1 完了記録
