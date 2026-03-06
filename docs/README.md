# Prance Platform ドキュメント

このディレクトリにはPranceプラットフォームの包括的な技術ドキュメントが格納されています。

**プロジェクトステータス:** Phase 1 完了 (100%) | Phase 2 準備中

---

## 📂 ドキュメント構成

### エントリーポイント

- **[START_HERE.md](../START_HERE.md)** - 次回セッション開始の唯一のエントリーポイント
- **[CLAUDE.md](../CLAUDE.md)** - プロジェクト全体の概要と重要な方針

### アーキテクチャ設計

```
docs/architecture/
├── SYSTEM_ARCHITECTURE.md     # システム全体構成
└── MULTITENANCY.md            # マルチテナント設計
```

### モジュール詳細設計（14モジュール）

```
docs/modules/
├── AVATAR_MODULE.md           # アバター管理
├── VOICE_MODULE.md            # 音声処理
├── SCENARIO_ENGINE.md         # シナリオエンジン
├── SESSION_RECORDING.md       # セッション・録画
├── TRANSCRIPT_PLAYER.md       # トランスクリプトプレイヤー
├── ANALYSIS_MODULE.md         # 感情・非言語解析
├── REPORT_MODULE.md           # レポート生成
├── AI_MANAGEMENT.md           # AIプロンプト・プロバイダ管理
├── BENCHMARK_SYSTEM.md        # ベンチマークシステム
├── EXTERNAL_API.md            # 外部連携API
├── SUBSCRIPTION_PLANS.md      # サブスクリプション・プラン管理
├── MULTILINGUAL_SYSTEM.md     # 多言語対応
├── ATS_INTEGRATION.md         # ATS連携
└── PLUGIN_SYSTEM.md           # プラグインシステム
```

### 開発関連

```
docs/development/
├── IMPLEMENTATION_PHASES.md   # 実装フェーズ計画
├── API_DESIGN.md              # API設計
├── DATABASE_DESIGN.md         # データベース設計
├── API_KEY_MANAGEMENT.md      # APIキー管理
└── ENVIRONMENT_ARCHITECTURE.md # 環境アーキテクチャ
```

### インフラ構成

```
docs/infrastructure/
└── AWS_SERVERLESS.md          # AWSサーバーレス詳細
```

### 進捗管理

```
docs/progress/
├── SESSION_HISTORY.md                      # 全セッション詳細履歴
├── ARCHIVE_2026-03-06_Phase1_Completion.md # Phase 1完了記録
└── PHASE_2_PLAN.md                         # Phase 2詳細プラン
```

### リファレンス

```
docs/reference/
├── TECH_STACK.md              # 技術スタック詳細
├── FAQ.md                     # よくある質問
└── GLOSSARY.md                # 用語集
```

### 運用ガイド

```
docs/
├── CICD.md                    # CI/CD
├── CODING_STANDARDS.md        # コーディング規約
├── DEPLOYMENT.md              # デプロイ手順
├── OPERATIONS_GUIDE.md        # 運用ガイド
└── SECURITY.md                # セキュリティ
```

---

## 🔍 目的別の参照先

| 目的 | 参照先 |
|------|--------|
| **次回作業開始** | [START_HERE.md](../START_HERE.md) |
| **プロジェクト全体理解** | [CLAUDE.md](../CLAUDE.md), [SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md) |
| **開発を始める** | [IMPLEMENTATION_PHASES.md](development/IMPLEMENTATION_PHASES.md) |
| **特定機能を実装** | [modules/](modules/) 配下の該当ドキュメント |
| **API実装** | [API_DESIGN.md](development/API_DESIGN.md) |
| **DB設計** | [DATABASE_DESIGN.md](development/DATABASE_DESIGN.md) |
| **デプロイ** | [AWS_SERVERLESS.md](infrastructure/AWS_SERVERLESS.md), [DEPLOYMENT.md](DEPLOYMENT.md) |
| **進捗確認** | [progress/](progress/) 配下のドキュメント |
| **用語確認** | [GLOSSARY.md](reference/GLOSSARY.md) |

---

## 📋 新規参加者向けガイド

### 1. 全体把握（30分）
1. [START_HERE.md](../START_HERE.md) - 現在のステータス確認
2. [CLAUDE.md](../CLAUDE.md) - プロジェクト概要
3. [SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md) - アーキテクチャ理解

### 2. 技術理解（1時間）
1. [TECH_STACK.md](reference/TECH_STACK.md) - 使用技術
2. [AWS_SERVERLESS.md](infrastructure/AWS_SERVERLESS.md) - インフラ構成
3. [DATABASE_DESIGN.md](development/DATABASE_DESIGN.md) - DB設計

### 3. 開発準備（1時間）
1. [IMPLEMENTATION_PHASES.md](development/IMPLEMENTATION_PHASES.md) - 現在のフェーズ
2. [API_DESIGN.md](development/API_DESIGN.md) - API仕様
3. [CODING_STANDARDS.md](CODING_STANDARDS.md) - コーディング規約

---

## ✅ ドキュメント管理ルール

### 更新タイミング

**START_HERE.md:**
- ✅ セッション終了時（最新状態を反映）
- ✅ 重要なマイルストーン達成時

**CLAUDE.md:**
- ✅ アーキテクチャ変更・重要な設計決定
- ✅ Phase完了時の総括

**docs/ 配下:**
- ✅ 技術仕様の変更
- ✅ API設計の追加・変更
- ✅ 新しいモジュールの追加

### 命名規則

- **永続ドキュメント:** 大文字スネークケース（例: `API_DESIGN.md`）
- **進捗記録:** `ARCHIVE_YYYY-MM-DD_*.md`
- **プランドキュメント:** `PHASE_N_PLAN.md`

---

## 🤝 ドキュメント更新プロセス

1. **小規模修正:** 直接編集してコミット
2. **大規模変更:** ブランチ作成 → PR提出
3. **新規ドキュメント:** 適切なディレクトリに配置 → レビュー → コミット

---

**最終更新:** 2026-03-06
**ドキュメントバージョン:** 2.1
**管理者:** Prance Development Team
