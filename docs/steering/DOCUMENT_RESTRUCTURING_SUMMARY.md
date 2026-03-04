# ステアリングドキュメント: ドキュメント構造整理

**作成日:** 2026-03-04
**担当者:** Claude Code
**ステータス:** 完了

---

## 📋 作業概要

**目的:**
- ドキュメント管理ルールの確立と適用
- 永続化ドキュメント、レファレンス、ステアリングドキュメントの明確な分類
- グローサリー（用語集）の作成
- ドキュメント構造の理解を容易にするREADMEの作成

**背景:**
- プロジェクトの成長に伴いドキュメント数が増加
- ドキュメントの目的・用途が不明確
- 新規メンバーがドキュメントを見つけにくい
- 用語の統一が必要

---

## 🎯 成果物

- [x] `docs/reference/` フォルダ作成・ドキュメント移動
- [x] `docs/steering/` フォルダ作成
- [x] `docs/GLOSSARY.md` 作成（132用語）
- [x] `docs/steering/TEMPLATE_STEERING_DOCUMENT.md` 作成
- [x] `docs/README.md` 作成（ドキュメント管理ルール説明）
- [x] `infrastructure/docs/README.md` 作成（インフラドキュメント案内）
- [x] 現在のセッション進捗をステアリングドキュメント化

---

## 📝 実施内容

### 1. ディレクトリ構造の再編成

**作成したフォルダ:**
```
docs/
├── reference/        # レファレンス的なドキュメント
└── steering/         # 作業単位のステアリングドキュメント

infrastructure/docs/  # インフラ関連ドキュメント（既存）
```

**移動したドキュメント:**
```
docs/ → docs/reference/
  ├── AUTH_COMPARISON_CLERK_VS_COGNITO.md
  ├── AWS_MIGRATION_ANALYSIS.md
  ├── AZURE_SETUP_CHECKLIST.md
  ├── BUSINESS_OVERVIEW.md
  ├── CLIENT_PRESENTATION.md
  └── EXTERNAL_TOOLS_SETUP.md
```

### 2. 新規作成ドキュメント

#### `docs/GLOSSARY.md` (132用語)
- アルファベット順・50音順で整理
- 主要カテゴリ:
  - AWS サービス関連（ACM, ACU, Aurora, etc.）
  - プラットフォーム固有用語（Avatar, Scenario, Session, etc.）
  - 技術用語（Blendshape, Viseme, TTS, STT, etc.）
  - 日本語用語（お名前.com、サブドメイン委譲、3階層ロール、etc.）

#### `docs/steering/TEMPLATE_STEERING_DOCUMENT.md`
- 作業ログの標準テンプレート
- 含まれるセクション:
  - 作業概要（目的・背景）
  - 成果物リスト
  - 作業ログ（タイムスタンプ付き）
  - 課題・懸念事項（テーブル形式）
  - 進捗状況（チェックリスト）
  - 関連リソース
  - 完了チェックリスト
  - 最終メモ

#### `docs/README.md`
- ドキュメント管理ルールの詳細説明
- 4つのドキュメント分類:
  1. 永続化ドキュメント（`docs/` 直下）
  2. レファレンスドキュメント（`docs/reference/`）
  3. ステアリングドキュメント（`docs/steering/`）
  4. グローサリー（`docs/GLOSSARY.md`）
- 命名規則、更新プロセス、ベストプラクティス

#### `infrastructure/docs/README.md`
- インフラドキュメントの案内
- DNS設定ドキュメントの分類
- 目的別の参照先テーブル
- よくある問題と解決策

### 3. 既存ドキュメントの整理

**現状維持（適切に配置済み）:**
```
docs/
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

**プロジェクトルート（適切）:**
```
/
├── README.md                    # プロジェクト概要
├── CLAUDE.md                    # 企画書（Phase 5まで更新済み、バージョン2.0）
├── DOMAIN_SETUP_SUMMARY.md      # ドメイン設定サマリー
├── SESSION_PROGRESS.md          # 現在のセッション進捗（継続使用）
├── QUICKSTART.md                # クイックスタート
└── SETUP.md                     # セットアップ手順
```

---

## 📊 ドキュメント管理ルール（確立）

### 1. 永続化ドキュメント
- **配置:** `docs/` 直下
- **命名:** 大文字スネークケース `DOCUMENT_NAME.md`
- **対象:** システムアーキテクチャ、API仕様、開発ガイド等
- **更新:** 変更履歴を記録、重大な変更は通知

### 2. レファレンスドキュメント
- **配置:** `docs/reference/`
- **対象:** 技術比較、外部サービス設定、ビジネス資料
- **特徴:** 必要時に参照、日常的には使われない

### 3. ステアリングドキュメント
- **配置:** `docs/steering/`
- **命名:** `SESSION_YYYY-MM-DD_TASK_NAME.md`
- **対象:** 特定作業セッション、タスク進捗管理
- **ライフサイクル:** 作成 → 更新 → 完了 → アーカイブ保管

### 4. グローサリー
- **配置:** `docs/GLOSSARY.md`
- **目的:** 重要用語の一元管理、新規メンバーの学習支援
- **更新:** 新用語追加時に随時更新

---

## 📈 統計

### ドキュメント数

| カテゴリ | ファイル数 | 配置場所 |
|---------|----------|----------|
| 永続化ドキュメント | 14 | `docs/` |
| レファレンス | 6 | `docs/reference/` |
| ステアリング | 2 | `docs/steering/` |
| グローサリー | 1 | `docs/GLOSSARY.md` |
| インフラ（DNS関連） | 5 | `infrastructure/docs/` |
| README | 2 | `docs/`, `infrastructure/docs/` |
| **合計** | **30** | - |

### グローサリー

- **総用語数:** 132語
- **カテゴリ:** アルファベット（A-X）、日本語
- **カバー範囲:** AWS、技術用語、プラットフォーム固有、日本語用語

---

## ✅ 完了チェックリスト

- [x] `docs/reference/` フォルダ作成
- [x] `docs/steering/` フォルダ作成
- [x] レファレンスドキュメント6件を移動
- [x] グローサリーファイル作成（132用語）
- [x] ステアリングドキュメントテンプレート作成
- [x] `docs/README.md` 作成（管理ルール説明）
- [x] `infrastructure/docs/README.md` 作成
- [x] 現在のセッション進捗をステアリング化
- [x] ドキュメント整理完了の確認

---

## 🎓 学んだこと・今後への提言

### 成功したこと
1. **明確な分類**: 永続化、レファレンス、ステアリングの3分類が有効
2. **グローサリーの価値**: 132用語を整理し、新規メンバーの学習を支援
3. **READMEの重要性**: ドキュメント構造を説明するREADMEが理解を促進

### 改善提案
1. **定期レビュー**: 四半期ごとにドキュメントの見直し
2. **リンク切れチェック**: 自動化ツールの導入検討
3. **バージョン管理**: 重要ドキュメントのバージョン番号付与
4. **多言語対応**: 将来的に英語版ドキュメントの作成

### 今後のアクション
- [ ] チームメンバーにドキュメント管理ルールを共有
- [ ] 新規ドキュメント作成時のチェックリスト運用
- [ ] グローサリーの継続的な更新（新用語の追加）
- [ ] ステアリングドキュメントの定期的なアーカイブ

---

## 🔗 関連リソース

- **ドキュメント管理ルール:** `docs/README.md`
- **グローサリー:** `docs/GLOSSARY.md`
- **ステアリングテンプレート:** `docs/steering/TEMPLATE_STEERING_DOCUMENT.md`
- **インフラドキュメント:** `infrastructure/docs/README.md`

---

**完了日:** 2026-03-04
**アーカイブ先:** `docs/steering/DOCUMENT_RESTRUCTURING_SUMMARY.md`
