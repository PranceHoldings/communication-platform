# Prance Platform ドキュメント

このディレクトリにはPranceプラットフォームの包括的な技術ドキュメントが格納されています。

---

## 📂 ドキュメント体系

### マスターファイル

- **[CLAUDE.md](../CLAUDE.md)** - プロジェクト全体の概要と重要な方針（約350行）

### 新構成（v2.0）

```
docs/
├── README.md                          # このファイル
├── GLOSSARY.md                        # 重要用語集（統合版は reference/GLOSSARY.md）
│
├── architecture/                       # アーキテクチャ設計
│   ├── SYSTEM_ARCHITECTURE.md          - システム全体構成
│   └── MULTITENANCY.md                 - マルチテナント設計
│
├── modules/                            # モジュール詳細設計（14モジュール）
│   ├── AVATAR_MODULE.md                - アバター管理
│   ├── VOICE_MODULE.md                 - 音声処理
│   ├── SCENARIO_ENGINE.md              - シナリオエンジン
│   ├── SESSION_RECORDING.md            - セッション・録画
│   ├── TRANSCRIPT_PLAYER.md            - トランスクリプトプレイヤー
│   ├── ANALYSIS_MODULE.md              - 感情・非言語解析
│   ├── REPORT_MODULE.md                - レポート生成
│   ├── AI_MANAGEMENT.md                - AIプロンプト・プロバイダ管理
│   ├── BENCHMARK_SYSTEM.md             - ベンチマークシステム
│   ├── EXTERNAL_API.md                 - 外部連携API
│   ├── SUBSCRIPTION_PLANS.md           - サブスクリプション・プラン管理
│   ├── MULTILINGUAL_SYSTEM.md          - 多言語対応
│   ├── ATS_INTEGRATION.md              - ATS連携
│   └── PLUGIN_SYSTEM.md                - プラグインシステム
│
├── development/                        # 開発関連
│   ├── IMPLEMENTATION_PHASES.md        - 実装フェーズ計画
│   ├── API_DESIGN.md                   - API設計
│   └── DATABASE_DESIGN.md              - データベース設計
│
├── infrastructure/                     # インフラ構成
│   └── AWS_SERVERLESS.md               - AWSサーバーレス詳細
│
├── reference/                          # リファレンス
│   ├── TECH_STACK.md                   - 技術スタック詳細
│   ├── FAQ.md                          - よくある質問
│   ├── GLOSSARY.md                     - 用語集（統合版）
│   ├── AUTH_COMPARISON_CLERK_VS_COGNITO.md
│   ├── AWS_MIGRATION_ANALYSIS.md
│   ├── AZURE_SETUP_CHECKLIST.md
│   ├── BUSINESS_OVERVIEW.md
│   ├── CLIENT_PRESENTATION.md
│   └── EXTERNAL_TOOLS_SETUP.md
│
├── steering/                           # ステアリングドキュメント
│   ├── TEMPLATE_STEERING_DOCUMENT.md
│   └── SESSION_YYYY-MM-DD_*.md
│
└── [レガシードキュメント]              # 旧構成（v1.x）
    ├── ALPHA_DEVELOPMENT.md
    ├── API_SPECIFICATION.md
    ├── ARCHITECTURE.md
    ├── CICD.md
    ├── CODING_STANDARDS.md
    ├── DATABASE_DESIGN.md
    ├── DEPLOYMENT.md
    ├── DEVELOPMENT_GUIDE.md
    ├── FEATURE_ROADMAP.md
    ├── IMPLEMENTATION_PLAN.md
    ├── OPERATIONS_GUIDE.md
    ├── PROJECT_STRUCTURE.md
    ├── RELEASE_PLAN.md
    └── SECURITY.md
```

### ドキュメント統計

| カテゴリ       | ファイル数 | 総サイズ | 説明                     |
| -------------- | ---------- | -------- | ------------------------ |
| **マスター**   | 1          | 50KB     | CLAUDE.md                |
| **アーキテクチャ** | 2      | 108KB    | システム設計・マルチテナント |
| **モジュール** | 14         | 380KB    | 各機能モジュール詳細     |
| **開発**       | 3          | 124KB    | API・DB・実装フェーズ    |
| **インフラ**   | 1          | 40KB     | AWSサーバーレス構成      |
| **リファレンス** | 4        | 204KB    | 技術スタック・FAQ・用語集 |
| **合計（v2.0）** | **25**   | **906KB**| **全ドキュメント**       |

**削減効果:** 元のCLAUDE.md（300KB、6000行）→ 新CLAUDE.md（50KB、350行）+ 分割ドキュメント

---

## 📖 ドキュメント管理ルール

### 1. 永続化ドキュメント

**配置場所:** `docs/` 直下

**特徴:**
- プロジェクト全体で長期的に参照される重要ドキュメント
- システムアーキテクチャ、API仕様、開発ガイド等
- 定期的にレビュー・更新される

**命名規則:**
- 大文字スネークケース: `DOCUMENT_NAME.md`
- 内容が明確にわかる名前を使用
- 例: `API_SPECIFICATION.md`, `DATABASE_DESIGN.md`

**更新時の注意:**
- 変更履歴を記録する（バージョン、日付、変更内容）
- 重大な変更は関係者に通知
- 古い情報は削除または「非推奨」マークを付ける

---

### 2. レファレンスドキュメント

**配置場所:** `docs/reference/`

**特徴:**
- 技術比較、外部サービス設定、ビジネス資料等
- 必要に応じて参照されるが、日常的には使われない
- 特定の意思決定時や新規メンバーのオンボーディングで活用

**対象:**
- 技術選定の比較資料
- 外部サービスのセットアップ手順
- ビジネス概要・プレゼン資料
- 移行分析レポート

**命名規則:**
- 大文字スネークケース: `TOPIC_NAME.md`
- 内容の種類がわかる名前
- 例: `AUTH_COMPARISON_*.md`, `*_SETUP_CHECKLIST.md`

---

### 3. ステアリングドキュメント

**配置場所:** `docs/steering/`

**特徴:**
- 特定の作業セッションやタスクの進捗管理
- 作業ログ、決定事項、課題、次のステップを記録
- 作業完了後はアーカイブとして保管

**対象:**
- 特定機能の実装作業
- 大規模なリファクタリング
- インフラ構築・設定作業
- 調査・検証タスク

**命名規則:**
- `SESSION_YYYY-MM-DD_TASK_NAME.md`
- 例: `SESSION_2026-03-04_DOMAIN_DNS_SETUP.md`

**ライフサイクル:**
1. 作業開始時に作成（テンプレートから複製）
2. 作業中に随時更新（ログ、決定事項、課題を記録）
3. 作業完了時に最終メモを記入
4. アーカイブとして保管（削除しない）

---

### 4. グローサリー（用語集）

**ファイル:** `docs/GLOSSARY.md`

**目的:**
- プロジェクト内で使用される重要用語を一元管理
- 新規メンバーの学習コスト削減
- 用語の統一による誤解の防止

**管理方針:**
- 新しい重要用語が登場したら追加
- アルファベット順・50音順で整理
- 簡潔な定義と、必要に応じて詳細ドキュメントへのリンク

**追加すべき用語の例:**
- プロジェクト固有の技術用語
- 頻繁に使用される略語
- 誤解されやすい概念
- 複数の意味を持つ用語

---

## 🔍 ドキュメントの探し方

### 目的別の参照先（v2.0対応）

| 目的 | 参照先 |
|------|--------|
| **プロジェクト全体の理解** | [CLAUDE.md](../CLAUDE.md), [SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md) |
| **開発を始める** | [IMPLEMENTATION_PHASES.md](development/IMPLEMENTATION_PHASES.md), [TECH_STACK.md](reference/TECH_STACK.md) |
| **特定機能を実装する** | [modules/](modules/) 配下の該当モジュールドキュメント |
| **APIを実装する** | [API_DESIGN.md](development/API_DESIGN.md) |
| **データベースを設計する** | [DATABASE_DESIGN.md](development/DATABASE_DESIGN.md) |
| **インフラ・デプロイ** | [AWS_SERVERLESS.md](infrastructure/AWS_SERVERLESS.md), `../infrastructure/README.md` |
| **マルチテナント理解** | [MULTITENANCY.md](architecture/MULTITENANCY.md) |
| **技術選定の背景を知る** | [FAQ.md](reference/FAQ.md), `reference/` 配下のドキュメント |
| **過去の作業を確認する** | `steering/` 配下のドキュメント, `../SESSION_PROGRESS.md` |
| **用語の意味を調べる** | [GLOSSARY.md](reference/GLOSSARY.md) |

### 初めてプロジェクトに参加する場合

1. **[CLAUDE.md](../CLAUDE.md)** - プロジェクト全体の概要を把握
2. **[SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md)** - システムアーキテクチャを理解
3. **[TECH_STACK.md](reference/TECH_STACK.md)** - 使用技術を確認
4. **[IMPLEMENTATION_PHASES.md](development/IMPLEMENTATION_PHASES.md)** - 現在のフェーズと次のタスクを確認

### 特定の機能を開発する場合

1. **該当するモジュールドキュメント** - 詳細仕様を確認
   - 例: アバター機能 → [AVATAR_MODULE.md](modules/AVATAR_MODULE.md)
2. **[API_DESIGN.md](development/API_DESIGN.md)** - APIエンドポイント仕様を確認
3. **[DATABASE_DESIGN.md](development/DATABASE_DESIGN.md)** - データベーススキーマを確認

### 困ったとき

1. **[FAQ.md](reference/FAQ.md)** - よくある質問を確認
2. **[GLOSSARY.md](reference/GLOSSARY.md)** - 用語を確認
3. **`../SESSION_PROGRESS.md`** - プロジェクト進捗を確認

---

## ✅ ドキュメント作成のベストプラクティス

### 1. 明確なタイトルと概要
- 読者が5秒で内容を理解できるタイトル
- 冒頭に「このドキュメントの目的」を記述

### 2. 目次の活用
- 長いドキュメントには必ず目次を付ける
- Markdownのアンカーリンクを活用

### 3. 最終更新日の記載
- すべてのドキュメントに最終更新日を明記
- 古い情報を参照するリスクを減らす

### 4. コード例の提供
- 技術的な説明には具体的なコード例を含める
- コピー&ペーストで動作するコードが理想

### 5. 図表の活用
- 複雑な概念はテキストだけでなく図表で説明
- Mermaidダイアグラム、ASCII図を活用

### 6. リンクの管理
- 外部リンクは定期的に確認（リンク切れ防止）
- 内部リンクは相対パスを使用

### 7. バージョン管理
- 重要な変更は履歴として記録
- v1.0.0 → v1.1.0 のような形式

### 8. グローサリーへのリンク

**ドキュメント内での用語リンク:**
- 重要用語を初めて使用する箇所では、グローサリーへのリンクを追加
- リンク形式: `[用語](./GLOSSARY.md#用語アンカー)`
- 例: `[Aurora Serverless v2](./GLOSSARY.md#aurora-serverless-v2)`、`[Multi-Tenant](./GLOSSARY.md#multi-tenant-マルチテナント)`
- 同じ用語が文書内で複数回登場する場合、初出のみリンクすればOK
- 相対パスは文書の位置に応じて調整（例: `../GLOSSARY.md` または `../../docs/GLOSSARY.md`）

**グローサリー内のリンク追加:**
- **外部リンク:** AWS公式ドキュメント、サービス公式サイト、技術仕様書など
- **内部リンク（関連ドキュメント）:** 企画書、設計書、実装ガイドなど該当用語を詳しく説明している文書
- **内部リンク（グローサリー内参照）:** 関連用語へのリンク（例: `[参照] [TTS](#tts-text-to-speech)`）
- 新しい用語をグローサリーに追加する際は、可能な限りリンクも同時に追加

**リンク運用のベストプラクティス:**
- 外部リンクは定期的に確認（リンク切れ防止）
- 公式ドキュメントの言語は英語を優先（日本語版がある場合は日本語も可）
- 内部リンクは相対パスを使用
- グローサリーへのリンクは読みやすさを重視し、過度なリンクは避ける（重要な用語のみ）

---

## 🚀 ドキュメント作成時のチェックリスト

新しいドキュメントを作成する際に確認すべき項目：

- [ ] 適切なディレクトリに配置されているか
- [ ] 命名規則に従っているか
- [ ] タイトルと概要が明確か
- [ ] 最終更新日が記載されているか
- [ ] 必要に応じて目次があるか
- [ ] コード例は動作確認済みか
- [ ] 重要な用語はGLOSSARY.mdに追加されているか
- [ ] 関連ドキュメントへのリンクがあるか
- [ ] レビューを受けたか

---

## 📝 ドキュメントの更新プロセス

1. **小規模な修正**: 直接編集してコミット
2. **大規模な変更**: ブランチを作成してPRを提出
3. **新規ドキュメント**: 上記チェックリストを確認してからコミット

---

## 🤝 貢献方法

ドキュメントの改善提案がある場合：

1. Issueを作成（内容: 改善提案）
2. PRを提出（修正内容を明記）
3. レビュー後にマージ

---

**最終更新:** 2026-03-05
**ドキュメントバージョン:** 2.0
**管理者:** Prance Development Team
