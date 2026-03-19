# Prance Communication Platform - ドキュメント索引

**最終更新:** 2026-03-19
**ステータス:** ✅ ドキュメント構造整理完了

---

## 📋 このドキュメントについて

このファイルは、プロジェクト全体のドキュメント構造とナビゲーションガイドです。
**どのドキュメントを読めばいいか迷ったら、ここを参照してください。**

---

## 🚀 セッション開始時（最優先）

### 1. START_HERE.md
**役割:** 次回セッション開始の唯一のエントリーポイント
**内容:** 環境検証、既知の問題、次のアクション（最優先タスク）
**更新頻度:** 毎セッション終了時

### 2. docs/07-development/SESSION_RESTART_PROTOCOL.md
**役割:** セッション再開の標準手順（詳細版）
**内容:** Phase 1-5の手順、推測禁止の原則、トラブルシューティング

### 3. docs/07-development/KNOWN_ISSUES.md
**役割:** 現在発生中の問題と回避策
**内容:** Critical/Warning/Info Issues、解決済み問題の参考記録

---

## 📖 プロジェクト全体理解

### CLAUDE.md（プロジェクトルート）
**役割:** プロジェクト全体の概要・重要方針
**対象読者:** 全開発者、新規参加者
**内容:**
- プロジェクト概要（コンセプト、ターゲット市場）
- 基本アーキテクチャ
- 技術スタック
- **開発ガイドライン（絶対厳守ルール）**
- セッション管理ルール

**行数:** 2000行（包括的）
**更新タイミング:** アーキテクチャ変更、重要な設計決定時

### CODING_RULES.md（プロジェクトルート）
**役割:** コミット前チェックリスト（クイックリファレンス）
**対象読者:** 全開発者（コード作成時）
**内容:**
- 15項目のチェックリスト（i18n、Prisma、型定義等）
- よくある間違い一覧
- 検証コマンド

**行数:** 888行（実用的）
**更新タイミング:** 新しいチェック項目追加時

### README.md（プロジェクトルート）
**役割:** プロジェクト説明（外部向け）
**対象読者:** GitHub訪問者、新規参加者
**内容:** プロジェクト概要、セットアップ方法、ライセンス

---

## 🏗️ サブシステム別ガイド

### apps/CLAUDE.md
**役割:** フロントエンド開発ガイド
**対象読者:** フロントエンド開発者
**内容:**
- Next.js 15 App Router構造準拠
- 多言語対応システム統一
- Cookie処理の統一化
- 共有型定義の使用
- UI/UXガイドライン
- コード品質原則

**行数:** 594行
**更新タイミング:** フロントエンド設計変更時

### infrastructure/CLAUDE.md
**役割:** インフラ・Lambda開発ガイド
**対象読者:** バックエンド・インフラ開発者
**内容:**
- Lambda関数デプロイメント原則
- Prismaスキーマ変更手順
- 環境変数管理
- Lambda依存関係検証
- サーバーレス最適化
- セキュリティ

**行数:** 801行
**更新タイミング:** インフラ構成変更、Lambda関数追加時

### scripts/CLAUDE.md
**役割:** スクリプト使用ガイド
**対象読者:** 全開発者（スクリプト実行時）
**内容:**
- 検証スクリプト
- デプロイスクリプト
- データベースクエリスクリプト
- スクリプト実行ルール

**行数:** （未確認）
**更新タイミング:** 新スクリプト追加時

### docs/CLAUDE.md
**役割:** ドキュメント管理ガイド
**対象読者:** ドキュメント作成者
**内容:**
- ドキュメント構造
- 更新タイミング
- マークダウン規約
- コード整合性管理

**行数:** 565行
**更新タイミング:** ドキュメント構造変更時

---

## 📁 詳細ドキュメント（docs/配下）

### docs/01-getting-started/ - 初心者向け
- **README.md** - プロジェクト概要
- **QUICKSTART.md** - クイックスタート
- **SETUP.md** - セットアップガイド
- **FAQ.md** - よくある質問

### docs/02-architecture/ - アーキテクチャ設計
- **SYSTEM_ARCHITECTURE.md** - システム全体構成
- **MULTITENANCY.md** - マルチテナント設計
- **ENVIRONMENT_ARCHITECTURE.md** - 環境アーキテクチャ

### docs/03-planning/ - 計画・ロードマップ
- **releases/PRODUCTION_READY_ROADMAP.md** - 実用レベル対応（🔴最優先）
- **releases/RELEASE_ROADMAP.md** - リリースロードマップ
- **implementation/** - 実装計画（5ファイル）
- **analysis/** - 分析・ギャップ分析（2ファイル）

### docs/04-design/ - 技術設計
- **API_DESIGN.md** - API設計
- **DATABASE_DESIGN.md** - データベース設計
- **API_KEY_MANAGEMENT.md** - APIキー管理
- **CONSISTENCY_GUIDELINES.md** - 整合性ガイドライン

### docs/05-modules/ - 機能モジュール（17モジュール）
- **AI_MANAGEMENT.md** - AIプロンプト・プロバイダ管理
- **ANALYSIS_MODULE.md** - 解析モジュール
- **AVATAR_MODULE.md** - アバター管理
- **BENCHMARK_SYSTEM.md** - ベンチマークシステム（🎯 Phase 4）
- **EXTERNAL_API.md** - 外部連携API
- **MULTILINGUAL_SYSTEM.md** - 多言語対応
- **その他11モジュール**

### docs/06-infrastructure/ - インフラ構成
- **AWS_SERVERLESS.md** - AWSサーバーレス詳細
- **DOMAIN_SETUP_SUMMARY.md** - ドメイン設定
- **NODE22_MIGRATION_REPORT.md** - Node.js 22移行記録

### docs/07-development/ - 開発ガイド
- **SESSION_RESTART_PROTOCOL.md** - セッション再開プロトコル（🔴必読）
- **KNOWN_ISSUES.md** - 既知の問題（🔴必読）
- **DEVELOPMENT_WORKFLOW.md** - 開発ワークフロー
- **DATABASE_MIGRATION_CHECKLIST.md** - DBマイグレーションチェックリスト
- **LAMBDA_VERSION_MANAGEMENT.md** - Lambdaバージョン管理
- **I18N_SYSTEM_GUIDELINES.md** - 多言語対応ガイドライン
- **UI_SETTINGS_DATABASE_SYNC_RULES.md** - UI設定項目同期ルール

### docs/08-operations/ - 運用ガイド
- **DEPLOYMENT.md** - デプロイメント
- **CICD.md** - CI/CD
- **OPERATIONS_GUIDE.md** - 運用ガイド
- **SECURITY.md** - セキュリティ

### docs/09-progress/ - 進捗記録
- **SESSION_HISTORY.md** - 全セッション詳細履歴
- **archives/** - 個別セッション記録
- **phases/** - Phase計画
- **tasks/** - タスク完了記録

### docs/10-reference/ - リファレンス
- **TECH_STACK.md** - 技術スタック詳細
- **GLOSSARY.md** - 用語集
- **CLAUDE.en.md** - CLAUDE.md英語版

---

## 🎯 目的別ナビゲーション

### セッションを開始したい
1. **START_HERE.md** （必須）
2. **docs/07-development/SESSION_RESTART_PROTOCOL.md** （詳細）
3. **docs/07-development/KNOWN_ISSUES.md** （既知の問題確認）

### コードを書く前に確認
1. **CODING_RULES.md** （チェックリスト）
2. **該当サブシステムのCLAUDE.md** （apps/ or infrastructure/）
3. **docs/04-design/** （該当する技術設計）

### 特定機能を実装したい
1. **docs/05-modules/** （該当モジュールのドキュメント）
2. **docs/03-planning/** （実装計画）
3. **該当サブシステムのCLAUDE.md**

### エラー・問題が発生した
1. **docs/07-development/KNOWN_ISSUES.md** （既知の問題）
2. **docs/09-progress/SESSION_HISTORY.md** （過去の解決例）
3. **該当サブシステムのCLAUDE.md** （トラブルシューティング）

### デプロイしたい
1. **infrastructure/CLAUDE.md** （デプロイ原則）
2. **docs/08-operations/DEPLOYMENT.md** （デプロイ手順）
3. **scripts/CLAUDE.md** （スクリプト使用方法）

### プロジェクトを理解したい
1. **README.md** （プロジェクト説明）
2. **CLAUDE.md** （プロジェクト全体概要）
3. **docs/01-getting-started/** （初心者向けガイド）
4. **docs/02-architecture/** （アーキテクチャ設計）

---

## 📝 ドキュメント作成・更新ルール

### 更新タイミング

**START_HERE.md:**
- ✅ 毎セッション終了時（必須）
- ✅ 重要なマイルストーン達成時

**CLAUDE.md:**
- ✅ アーキテクチャ変更時
- ✅ 重要な設計決定時
- ✅ Phase完了時

**CODING_RULES.md:**
- ✅ 新しいチェック項目追加時
- ✅ よくある間違いパターン発見時

**サブシステムCLAUDE.md:**
- ✅ 該当サブシステムの設計変更時
- ✅ 新しいベストプラクティス確立時

**docs/配下:**
- ✅ 技術仕様変更時
- ✅ API設計追加・変更時
- ✅ 新モジュール追加時

### ドキュメント作成ガイドライン

**詳細:** `docs/CLAUDE.md` 参照

---

## 🗑️ アーカイブ・削除済みファイル

### 2026-03-19 アーカイブ移動
**場所:** `docs/09-progress/archives/2026-03-18-temporary-reports/`

- ENUM_CONSISTENCY_REPORT.md
- ENUM_UNIFICATION_COMPLETE.md
- PROJECT_OVERVIEW.md
- SILENCE_SETTINGS_FIX_VERIFICATION.md
- TEST_PHASE_1.5_AUDIO.md
- TEST_SESSION_FIX.md
- TEST_SESSION_RECORDING.md
- START_HERE.md.backup（旧版、2370行）

### 2026-03-19 削除
- infrastructure/apps/CLAUDE.md（誤配置）

---

## 💡 このドキュメントの使い方

1. **迷ったらまずここを開く** - どのドキュメントを読むべきか確認
2. **目的別ナビゲーション** - 自分の状況に合ったセクションを参照
3. **定期的に確認** - ドキュメント構造の変更を把握

---

**最終更新:** 2026-03-19
**次回レビュー:** ドキュメント構造変更時
