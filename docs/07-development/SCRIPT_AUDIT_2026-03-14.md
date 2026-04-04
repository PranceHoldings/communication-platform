# Scripts Audit - 2026-03-14

**作成日:** 2026-03-14
**最終更新:** 2026-03-14
**目的:** スクリプトの重複・冗長性を分析し、統合・削除の必要性を判断

---

## 📊 スクリプト概要

**総数:** 32スクリプト
**カテゴリ:**
- ビルド・デプロイ: 7スクリプト
- 検証: 11スクリプト
- 修正・クリーンアップ: 6スクリプト
- 監視・メトリクス: 3スクリプト
- テスト: 2スクリプト
- その他: 3スクリプト

---

## 🔍 カテゴリ別分析

### 1. ビルド・デプロイ (7スクリプト)

| スクリプト | 目的 | 使用頻度 | 統合候補 |
|-----------|------|---------|---------|
| `build-lambda-functions.sh` | Lambda関数ビルド | 高 | ✅ 保持 |
| `build-and-deploy.sh` | 簡易ビルド・デプロイ | 中 | ⚠️ 検討 |
| `deploy-lambda-websocket-manual.sh` | WebSocket Lambda手動デプロイ（全8ステップ自動化） | 高 | ✅ 保持 |
| `cdk-deploy-wrapper.sh` | CDKデプロイラッパー（検証強制） | 高 | ✅ 保持 |
| `clean-build.sh` | クリーンビルド | 高 | ✅ 保持 |
| `clean-directory-safe.sh` | ディレクトリ安全削除 | 中 | ✅ 保持（ユーティリティ） |
| `enforce-deployment-rules.sh` | デプロイルール強制 | 低 | ⚠️ 検討 |

**推奨アクション:**
- ✅ **保持:** `build-lambda-functions.sh`, `deploy-lambda-websocket-manual.sh`, `cdk-deploy-wrapper.sh`, `clean-build.sh`, `clean-directory-safe.sh`
- ⚠️ **統合検討:** `build-and-deploy.sh` は `cdk-deploy-wrapper.sh` と機能重複の可能性
- ⚠️ **利用状況確認:** `enforce-deployment-rules.sh` は shell profile に source する前提（使用されているか？）

---

### 2. 検証スクリプト (11スクリプト)

| スクリプト | 目的 | 使用頻度 | 統合候補 |
|-----------|------|---------|---------|
| `validate-env.sh` | 環境変数検証 | 高 | ✅ 保持 |
| `validate-i18n-system.sh` | i18nシステム検証（next-intl残骸検出） | 高 | ✅ 保持 |
| `validate-i18n-keys.sh` | i18n翻訳キー存在検証 | 高 | ✅ 保持 |
| `validate-language-sync.sh` | 言語リスト同期検証 | 高 | ✅ 保持（2026-03-14新規作成） |
| `validate-lambda-dependencies.sh` | Lambda依存関係検証 | 高 | ✅ 保持 |
| `validate-lambda-env-vars.sh` | Lambda環境変数検証 | 高 | ✅ 保持 |
| `validate-lambda-zip.sh` | Lambda ZIPファイル構造検証 | 中 | ✅ 保持 |
| `pre-deploy-check.sh` | デプロイ前総合チェック（12項目） | 高 | ✅ 保持（統合スクリプト） |
| `pre-deploy-lambda-check.sh` | Lambda デプロイ前チェック（6項目） | 高 | ✅ 保持（Lambda専用） |
| `post-deploy-lambda-test.sh` | Lambda デプロイ後テスト（5項目） | 高 | ✅ 保持 |
| `check-lambda-version.sh` | Lambda バージョン確認 | 中 | ✅ 保持 |

**推奨アクション:**
- ✅ **全て保持:** それぞれ異なる目的を持ち、重複なし
- ✅ **統合済み:** `pre-deploy-check.sh` が多くの検証を統合している
- ℹ️ **役割分担:**
  - `pre-deploy-check.sh`: 全体デプロイ前チェック（環境変数、i18n、CDK設定等）
  - `pre-deploy-lambda-check.sh`: Lambda固有の詳細チェック（依存関係、ZIP構造等）
  - `post-deploy-lambda-test.sh`: デプロイ後の動作検証

**統合の可能性:**
- ❌ **統合不要:** 各スクリプトは明確に異なる役割を持ち、個別実行のニーズがある

---

### 3. 修正・クリーンアップ (6スクリプト)

| スクリプト | 目的 | 使用頻度 | 統合候補 |
|-----------|------|---------|---------|
| `fix-lambda-node-modules.sh` | Lambda node_modules修復 | 中 | ✅ 保持 |
| `fix-inconsistencies.sh` | コード不整合自動修正 | 低 | ⚠️ 検討 |
| `detect-inconsistencies.sh` | コード不整合検出 | 低 | ⚠️ 検討 |
| `cleanup-broken-files.sh` | 破損ファイルクリーンアップ | 低 | ✅ 保持（緊急時用） |
| `clean-space-files-and-dirs.sh` | 空白含有ディレクトリ削除 | 低 | ✅ 保持（ビルド前実行） |
| `auto-fix-and-test.sh` | 自動修正 + テスト | 低 | ⚠️ 目的不明確 |

**推奨アクション:**
- ✅ **保持:** `fix-lambda-node-modules.sh`, `cleanup-broken-files.sh`, `clean-space-files-and-dirs.sh`
- ⚠️ **統合検討:** `fix-inconsistencies.sh` + `detect-inconsistencies.sh` → 1スクリプトに統合可能？
- ⚠️ **利用状況確認:** `auto-fix-and-test.sh` の目的と使用頻度を確認

---

### 4. 監視・メトリクス (3スクリプト)

| スクリプト | 目的 | 使用頻度 | 統合候補 |
|-----------|------|---------|---------|
| `collect-metrics.sh` | CloudWatch メトリクス収集 | 中 | ✅ 保持 |
| `create-cloudwatch-dashboard.sh` | CloudWatch Dashboard作成 | 低 | ✅ 保持 |
| `create-cloudwatch-alarms.sh` | CloudWatch Alarms作成 | 低 | ✅ 保持 |

**推奨アクション:**
- ✅ **全て保持:** Phase 1.5監視基盤の重要なスクリプト
- ℹ️ **使用パターン:**
  - Dashboard/Alarms作成は初回のみ（infrastructure as code の補完）
  - Metrics収集は継続的なモニタリング用

---

### 5. テスト (2スクリプト)

| スクリプト | 目的 | 使用頻度 | 統合候補 |
|-----------|------|---------|---------|
| `run-e2e-tests.sh` | E2Eテスト実行 | 高 | ✅ 保持 |
| `get-auth-token.js` | JWT認証トークン取得 | 高 | ✅ 保持（ユーティリティ） |

**推奨アクション:**
- ✅ **全て保持:** テストに必須

---

### 6. その他 (3スクリプト)

| スクリプト | 目的 | 使用頻度 | 統合候補 |
|-----------|------|---------|---------|
| `populate-scenario-defaults-aws.sh` | Scenario デフォルト値投入 | 低 | ✅ 保持（初期セットアップ用） |
| `fix-guest-sessions-auth.sh` | ゲストセッション認証修正 | 低 | ⚠️ 一時的修正スクリプト？ |
| `extract-missing-keys-en.sh` | 英語翻訳キー抽出 | 低 | ⚠️ 検討 |

**推奨アクション:**
- ✅ **保持:** `populate-scenario-defaults-aws.sh`（初期セットアップ・マイグレーション用）
- ⚠️ **確認:** `fix-guest-sessions-auth.sh` は一時的なパッチスクリプト？ 問題解決済みなら削除
- ⚠️ **統合検討:** `extract-missing-keys-en.sh` → `validate-i18n-keys.sh` に統合可能？

---

## 🔄 重複・統合分析

### 1. 統合可能なスクリプト

#### A. コード不整合検出・修正
- **現状:** `detect-inconsistencies.sh` (検出) + `fix-inconsistencies.sh` (修正)
- **提案:** 1つのスクリプトに統合、`--fix` オプションで動作切り替え
- **新名称:** `check-code-consistency.sh --fix`

#### B. i18n翻訳キー管理
- **現状:** `validate-i18n-keys.sh` (検証) + `extract-missing-keys-en.sh` (抽出)
- **提案:** 検証スクリプトに抽出機能を追加、`--extract` オプション
- **新構造:**
  ```bash
  validate-i18n-keys.sh           # 検証（既存）
  validate-i18n-keys.sh --extract # 抽出（統合）
  ```

---

### 2. 削除候補スクリプト

| スクリプト | 削除理由 | 確認事項 |
|-----------|---------|---------|
| `auto-fix-and-test.sh` | 目的・使用頻度が不明確 | 実際に使用されているか確認 |
| `fix-guest-sessions-auth.sh` | 一時的なパッチスクリプト（問題解決済み？） | ゲストセッション認証が正常に動作するか確認 |
| `enforce-deployment-rules.sh` | shell profileにsourceする前提、実際に使用されているか不明 | 使用されていなければ削除 |

---

### 3. 改善提案

#### A. スクリプトドキュメント化
**問題:** 各スクリプトのヘッダーコメントは充実しているが、全体像が把握しづらい

**提案:**
```markdown
# scripts/README.md
- 各スクリプトの役割
- 実行タイミング（ビルド前/後、デプロイ前/後等）
- 依存関係（このスクリプトはこのスクリプトを呼び出す等）
- 使用頻度（必須/推奨/オプショナル）
```

#### B. npm scripts統合
**問題:** 一部のスクリプトはpackage.jsonに統合されているが、されていないものもある

**提案:**
```json
{
  "scripts": {
    "validate:all": "bash scripts/pre-deploy-check.sh",
    "validate:lambda": "bash scripts/pre-deploy-lambda-check.sh",
    "validate:i18n": "bash scripts/validate-i18n-system.sh",
    "validate:i18n-keys": "bash scripts/validate-i18n-keys.sh",
    "validate:languages": "bash scripts/validate-language-sync.sh",
    "fix:lambda-deps": "bash scripts/fix-lambda-node-modules.sh",
    "fix:consistency": "bash scripts/fix-inconsistencies.sh",
    "deploy:websocket": "bash scripts/deploy-lambda-websocket-manual.sh",
    "test:e2e": "bash scripts/run-e2e-tests.sh"
  }
}
```

#### C. スクリプトバージョニング
**問題:** スクリプトが進化しているが、バージョン管理が明確でない

**提案:**
- スクリプトヘッダーにバージョン番号追加
- 重要な変更はCHANGELOGセクションに記載
  ```bash
  # Script Version: 2.1
  # Last Updated: 2026-03-14
  #
  # CHANGELOG:
  # v2.1 (2026-03-14): Added Prisma validation
  # v2.0 (2026-03-10): Refactored for multi-stage validation
  ```

---

## 📝 推奨アクション（優先順位順）

### 優先度 🔴 HIGH

1. **スクリプトREADME作成**
   - `scripts/README.md` を作成
   - 各スクリプトの役割・使用タイミング・依存関係を記載
   - 新規開発者がスクリプトを理解しやすくする

2. **一時的パッチスクリプトの削除**
   - `fix-guest-sessions-auth.sh` - 問題解決済みか確認後、削除
   - `auto-fix-and-test.sh` - 目的・使用頻度確認後、必要なら削除

### 優先度 🟡 MEDIUM

3. **スクリプト統合**
   - `detect-inconsistencies.sh` + `fix-inconsistencies.sh` → `check-code-consistency.sh`
   - `validate-i18n-keys.sh` + `extract-missing-keys-en.sh` → 統合

4. **npm scripts統合**
   - 全検証スクリプトを `validate:*` で統一
   - 全修正スクリプトを `fix:*` で統一

### 優先度 🟢 LOW

5. **スクリプトバージョニング**
   - 重要スクリプトにバージョン番号追加
   - CHANGELOGセクション追加

6. **ドキュメント更新**
   - `docs/07-development/` にスクリプト使用ガイド追加

---

## ✅ 結論

**現状:** スクリプトは適切に分類・整理されており、重大な重複はなし

**主な改善点:**
1. ✅ 一時的パッチスクリプトの削除（2-3スクリプト）
2. ✅ 小規模な統合（2-3スクリプト）
3. ✅ ドキュメント作成（README.md）
4. ✅ npm scripts統合

**保持すべきスクリプト:** 29/32（約90%）

**削除・統合候補:** 3/32（約10%）

---

**次のステップ:**
1. `fix-guest-sessions-auth.sh` の使用状況確認
2. `auto-fix-and-test.sh` の目的確認
3. `scripts/README.md` 作成
4. 統合スクリプト実装
