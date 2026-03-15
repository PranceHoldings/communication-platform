# Prance Communication Platform - Documentation Guide

**親ドキュメント:** [../CLAUDE.md](../CLAUDE.md)
**関連ドキュメント:** [../apps/CLAUDE.md](../apps/CLAUDE.md) | [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md)

**バージョン:** 1.0
**最終更新:** 2026-03-15

---

## 📋 このディレクトリについて

`docs/` ディレクトリはプロジェクト全体のドキュメントを含みます：

```
docs/
├── 01-getting-started/        # 初心者向けガイド
├── 02-architecture/           # アーキテクチャ設計
├── 03-planning/               # 計画・ロードマップ
├── 04-design/                 # 技術設計
├── 05-modules/                # 機能モジュール
├── 06-infrastructure/         # インフラ構成
├── 07-development/            # 開発ガイド
├── 08-operations/             # 運用ガイド
├── 09-progress/               # 進捗記録
└── 10-reference/              # リファレンス
```

---

## 🔴 ドキュメント管理の絶対厳守ルール

### Rule 1: ドキュメント更新タイミング

**START_HERE.md の更新タイミング:**

- ✅ セッション終了時（最新状態を反映）
- ✅ 重要なマイルストーン達成時（Phase進捗、デプロイ完了）
- ❌ セッション途中の細かい変更（アーカイブに記録）

**CLAUDE.md の更新タイミング:**

- ✅ アーキテクチャ変更・重要な設計決定
- ✅ 新しいモジュール追加
- ✅ Phase完了時の総括
- ✅ 絶対厳守ルール追加時
- ❌ 日常的な実装進捗（START_HERE.mdまたはアーカイブに記録）

**docs/ 配下の更新タイミング:**

- ✅ 技術仕様の変更
- ✅ API設計の追加・変更
- ✅ インフラ構成の変更
- ✅ 新しいモジュールの詳細設計

### Rule 2: セッション記録の管理

**プライマリドキュメント:**

- **START_HERE.md** - 次回セッション開始の唯一のエントリーポイント
  - 簡潔（200行以内）
  - 常に最新状態を反映
  - 環境確認手順、最優先タスク（1-3項目）のみ記載

**アーカイブドキュメント:**

- **docs/09-progress/SESSION_HISTORY.md** - 全セッションの詳細履歴
- **docs/09-progress/archives/ARCHIVE_YYYY-MM-DD_*.md** - 各セッションの詳細記録

**セッション終了時の記録手順:**

```bash
# 1. START_HERE.md の更新（必須）
# - 最終作業日時
# - Phase進捗率
# - 最新デプロイ情報
# - 完了したタスク（取り消し線）
# - 次回の優先タスク（3項目以内）

# 2. セッション詳細のアーカイブ（推奨）
# docs/09-progress/archives/ARCHIVE_YYYY-MM-DD_*.md に保存
# - コミットハッシュ
# - デプロイ時間
# - エラー対応履歴

# 3. 重要な発見・決定事項
# - CLAUDE.md の関連セクションに追加
# - 該当するドキュメント（docs/02-architecture/, docs/05-modules/）を更新
```

---

## 📚 ドキュメント構造

### 01-getting-started/ - 初心者向けガイド

```
01-getting-started/
├── README.md              # プロジェクト概要
├── QUICKSTART.md          # クイックスタート
├── SETUP.md               # セットアップガイド
└── FAQ.md                 # よくある質問
```

**対象読者:** 新規参加者、初めてプロジェクトに触れる開発者

**内容:**
- プロジェクトの目的と価値提案
- 開発環境のセットアップ手順
- 最初のコントリビューション方法

### 02-architecture/ - アーキテクチャ設計

```
02-architecture/
├── SYSTEM_ARCHITECTURE.md      # システム全体構成
├── MULTITENANCY.md             # マルチテナント設計
└── ENVIRONMENT_ARCHITECTURE.md # 環境アーキテクチャ
```

**対象読者:** アーキテクト、上級開発者、インフラエンジニア

**内容:**
- システム全体のアーキテクチャ図
- マルチテナント・権限設計
- AWS構成・ネットワーク設計
- セキュリティアーキテクチャ

**更新タイミング:**
- インフラ構成変更時
- 新しいAWSサービス追加時
- セキュリティ設計変更時

### 03-planning/ - 計画・ロードマップ

```
03-planning/
├── releases/                   # リリース計画
│   ├── PRODUCTION_READY_ROADMAP.md  # 実用レベル対応 🔴最優先
│   └── RELEASE_ROADMAP.md           # リリースロードマップ
├── implementation/             # 実装計画
│   ├── COMPLETE_IMPLEMENTATION_ROADMAP.md
│   ├── PRIORITY_BASED_IMPLEMENTATION_PLAN.md
│   └── IMPLEMENTATION_SUMMARY.md
└── analysis/                   # 分析・ギャップ分析
    ├── FEATURE_GAP_ANALYSIS.md
    └── INCONSISTENCY_REPORT.md
```

**対象読者:** プロダクトマネージャー、開発リーダー

**内容:**
- Phase別実装計画
- 優先度付けされたタスクリスト
- 機能ギャップ分析
- リリーススケジュール

**更新タイミング:**
- Phase完了時
- 優先度変更時
- 新機能追加時

### 04-design/ - 技術設計

```
04-design/
├── API_DESIGN.md                   # API設計
├── DATABASE_DESIGN.md              # データベース設計
├── API_KEY_MANAGEMENT.md           # APIキー管理
├── CONSISTENCY_GUIDELINES.md       # 整合性ガイドライン
└── LOCK_MECHANISM_IMPROVEMENTS.md  # ロックメカニズム改善
```

**対象読者:** バックエンド開発者、API開発者

**内容:**
- RESTful API設計原則
- エンドポイント仕様
- データベーススキーマ
- 認証・認可設計

**更新タイミング:**
- 新しいAPIエンドポイント追加時
- データベーススキーマ変更時
- セキュリティ要件変更時

### 05-modules/ - 機能モジュール

```
05-modules/
├── AI_MANAGEMENT.md               # AIプロンプト・プロバイダ管理
├── ANALYSIS_MODULE.md             # 解析モジュール
├── AVATAR_MODULE.md               # アバター管理
├── BENCHMARK_SYSTEM.md            # ベンチマークシステム
├── EXTERNAL_API.md                # 外部連携API
├── MULTILINGUAL_SYSTEM.md         # 多言語対応
└── ... (全17モジュール)
```

**対象読者:** 機能別開発担当者

**内容:**
- モジュール別の詳細設計
- 実装方針
- 使用方法
- トラブルシューティング

**更新タイミング:**
- 新モジュール追加時
- モジュールの大幅な変更時
- 実装完了時

### 06-infrastructure/ - インフラ構成

```
06-infrastructure/
├── AWS_SERVERLESS.md              # AWSサーバーレス詳細
├── DOMAIN_SETUP_SUMMARY.md        # ドメイン設定
└── NODE22_MIGRATION_REPORT.md     # Node.js 22移行記録
```

**対象読者:** インフラエンジニア、DevOpsエンジニア

**内容:**
- AWS CDK構成詳細
- Lambda関数設定
- ドメイン・DNS設定
- マイグレーション記録

**更新タイミング:**
- インフラ構成変更時
- 新しいAWSリソース追加時
- 重要なマイグレーション実施時

### 07-development/ - 開発ガイド

```
07-development/
├── DEVELOPMENT_WORKFLOW.md         # 開発ワークフロー
├── DATABASE_MIGRATION_CHECKLIST.md # DBマイグレーションチェックリスト
├── LAMBDA_VERSION_MANAGEMENT.md    # Lambdaバージョン管理
├── DATABASE_QUERY_SYSTEM.md        # データベースクエリシステム 🆕
├── I18N_SYSTEM_GUIDELINES.md       # 多言語対応ガイドライン
└── UI_SETTINGS_DATABASE_SYNC_RULES.md # UI設定項目同期ルール 🆕
```

**対象読者:** 全開発者

**内容:**
- 日常的な開発ワークフロー
- コーディング規約
- テスト手順
- デプロイ手順

**更新タイミング:**
- 新しい開発手順確立時
- ツール・ライブラリ更新時
- ベストプラクティス発見時

### 08-operations/ - 運用ガイド

```
08-operations/
├── DEPLOYMENT.md                  # デプロイメント
├── CICD.md                        # CI/CD
├── OPERATIONS_GUIDE.md            # 運用ガイド
└── SECURITY.md                    # セキュリティ
```

**対象読者:** 運用担当者、DevOpsエンジニア

**内容:**
- デプロイ手順
- CI/CDパイプライン
- 監視・ログ管理
- インシデント対応

**更新タイミング:**
- デプロイフロー変更時
- 新しい監視項目追加時
- インシデント対応手順確立時

### 09-progress/ - 進捗記録

```
09-progress/
├── SESSION_HISTORY.md             # 全セッション詳細履歴
├── archives/                      # セッション記録
│   ├── ARCHIVE_2026-03-06_Phase1_Completion.md
│   └── SESSION_2026-03-09_*.md
├── phases/                        # Phase計画
│   ├── PHASE_2_PLAN.md
│   └── PHASE_2.2_ANALYSIS_IMPLEMENTATION_PLAN.md
└── tasks/                         # タスク完了記録
    └── TASK_2.2.*_COMPLETE.md
```

**対象読者:** プロジェクトマネージャー、全開発者

**内容:**
- 日々の開発進捗
- Phase別進捗状況
- タスク完了記録
- 重要な決定事項の記録

**更新タイミング:**
- 毎セッション終了時
- Phase完了時
- 重要なマイルストーン達成時

### 10-reference/ - リファレンス

```
10-reference/
├── TECH_STACK.md                  # 技術スタック詳細
├── GLOSSARY.md                    # 用語集
└── CLAUDE.en.md                   # CLAUDE.md英語版
```

**対象読者:** 全開発者、新規参加者

**内容:**
- 使用技術の詳細
- プロジェクト固有用語の定義
- 多言語ドキュメント

**更新タイミング:**
- 新しい技術導入時
- 新しい用語追加時
- ドキュメント翻訳時

---

## 💎 コード整合性管理（最重要）

**🔴 根本問題: Claude Code自身が生成したコード間での不整合**

Claude Code（AI）は複数セッションにまたがると、以下の不整合を起こしやすい：

1. **出力の型と入力の型の不整合**
   例: ElevenLabs API が `audio/mpeg` を返すのに、S3に `.webm` 拡張子で保存

2. **スキーマ定義と実装の不整合**
   例: Prismaスキーマで `sessionId` なのに、実装で `session_id` を使用

3. **作成した名称と利用する名称の不整合**
   例: 型を `UserRole` で定義したのに、別ファイルで `'admin' | 'user'` と再定義

**対策: 3層の防御システム**

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: 予防（設計時）                               │
│ - 単一の真実の源（Single Source of Truth）            │
│ - 共有型パッケージの使用                               │
│ - ハードコード禁止                                    │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Layer 2: 検出（開発時）                               │
│ - npm run consistency:check（不整合検出）             │
│ - npm run consistency:validate（型整合性検証）        │
│ - TypeScriptコンパイルチェック                        │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│ Layer 3: 修正（コミット前）                           │
│ - npm run consistency:fix（自動修正）                 │
│ - npm run pre-commit（全チェック）                    │
│ - CI/CDパイプライン統合                               │
└─────────────────────────────────────────────────────┘
```

**必須コマンド（コミット前）:**

```bash
# 1. 不整合検出
npm run consistency:check

# 2. 自動修正
npm run consistency:fix

# 3. 型整合性検証
npm run consistency:validate

# 4. 全チェック（lint + typecheck + 整合性）
npm run pre-commit
```

**検出される不整合の例:**

| 不整合タイプ         | 検出例                        | 影響               |
| -------------------- | ----------------------------- | ------------------ |
| ContentType不整合    | `audio/mpeg` + `.webm`        | ブラウザ再生エラー |
| Prismaスキーマ不整合 | `session_id` vs `sessionId`   | 500エラー          |
| 型定義重複           | `User`インターフェースが3箇所 | 型不整合バグ       |
| ハードコード         | `'en-US'`, `'webm'` 直接記述  | 変更時の修正漏れ   |

**詳細ドキュメント:**

- [docs/04-design/CONSISTENCY_GUIDELINES.md](04-design/CONSISTENCY_GUIDELINES.md) - 包括的ガイドライン
- [docs/03-planning/analysis/INCONSISTENCY_REPORT.md](03-planning/analysis/INCONSISTENCY_REPORT.md) - 最新の検出レポート

**効果:**

- ✅ 型の不整合を予防・検出・自動修正
- ✅ 500エラーの根本原因を排除
- ✅ 開発速度の向上（バグ修正時間の削減）
- ✅ コードの保守性向上

---

## 📝 ドキュメント作成ガイドライン

### マークダウン規約

**1. ヘッダー構造**

```markdown
# タイトル（H1）- ドキュメントに1つのみ

## セクション（H2）- 主要セクション

### サブセクション（H3）- 詳細項目

#### 詳細項目（H4）- 必要に応じて
```

**2. コードブロック**

````markdown
```typescript
// TypeScriptコード
interface User {
  id: string;
  name: string;
}
```

```bash
# シェルコマンド
npm run dev
```
````

**3. リンク**

```markdown
# 相対パス使用
[関連ドキュメント](../02-architecture/SYSTEM_ARCHITECTURE.md)

# アンカーリンク
[セクションへのリンク](#section-name)
```

**4. テーブル**

```markdown
| カテゴリ | 説明 | ステータス |
| -------- | ---- | ---------- |
| 機能A    | 説明 | ✅ 完了    |
| 機能B    | 説明 | ⏳ 進行中  |
```

**5. 絵文字使用**

```markdown
✅ 完了
⏳ 進行中
❌ 未実施
🔴 最優先
⚠️ 警告
📋 リスト
🔍 検索・確認
```

### ドキュメントテンプレート

```markdown
# [モジュール名] - [簡潔な説明]

**親ドキュメント:** [../CLAUDE.md](../CLAUDE.md)
**関連ドキュメント:** [link1](link1.md) | [link2](link2.md)

**バージョン:** 1.0
**作成日:** YYYY-MM-DD
**最終更新:** YYYY-MM-DD
**ステータス:** ✅ 実装完了 / ⏳ 進行中 / ❌ 未実施

---

## 📋 概要

[モジュールの目的、役割、重要性を簡潔に説明]

---

## 🏗️ アーキテクチャ

[システム構成図、データフロー図等]

---

## 🔧 実装

[実装の詳細、コード例、設定方法等]

---

## 🧪 テスト

[テスト方法、テストケース等]

---

## 📚 関連ドキュメント

- [ドキュメント1](link1.md)
- [ドキュメント2](link2.md)

---

**最終更新:** YYYY-MM-DD
**次回レビュー:** [予定日/イベント]
```

---

## 🔍 ドキュメントレビュー

### 定期レビュー

**月次レビュー:**
- 全ドキュメントの最終更新日確認
- 古くなった情報の更新
- 新規ドキュメントの必要性確認

**Phase完了時レビュー:**
- Phase関連ドキュメントの完全性確認
- 実装との整合性確認
- 次Phaseのドキュメント準備

### レビューチェックリスト

```markdown
- [ ] 内容が最新の実装と一致しているか
- [ ] リンクが正しく機能しているか
- [ ] コード例が動作するか
- [ ] 画像・図が適切に表示されるか
- [ ] 誤字・脱字がないか
- [ ] マークダウン構文が正しいか
```

---

## 📚 関連ドキュメント

- [開発ワークフロー](07-development/DEVELOPMENT_WORKFLOW.md)
- [セッション履歴](09-progress/SESSION_HISTORY.md)
- [プロジェクト概要](01-getting-started/README.md)

---

**最終更新:** 2026-03-15
**次回レビュー:** Phase 2完了時
