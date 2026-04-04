# Prance Communication Platform - Scripts Guide

**親ドキュメント:** [../CLAUDE.md](../CLAUDE.md)
**関連ドキュメント:** [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md)

**バージョン:** 2.0
**最終更新:** 2026-04-05

---

## 📋 このディレクトリについて

`scripts/` ディレクトリは開発・運用を支援するシェルスクリプトを含みます：

- **検証スクリプト** - 環境変数、依存関係、言語同期等の検証
- **デプロイスクリプト** - インフラ・Lambda関数のデプロイ補助
- **データベーススクリプト** - マイグレーション、クエリ実行
- **監視スクリプト** - ログ監視、ヘルスチェック

---

## 🔴 スクリプト使用の絶対厳守ルール

### Rule 1: 検証スクリプトは必ずコミット前に実行

**❌ 禁止事項:**
- 検証スクリプトをスキップしてコミット
- エラーを無視してデプロイ
- 「後で直す」という先送り

**✅ 必須実行手順:**

```bash
# コミット前の全検証
pnpm run pre-commit

# 個別検証
bash scripts/validate-env.sh
bash scripts/validate-lambda-dependencies.sh
bash scripts/validate-language-sync.sh
bash scripts/validate-ui-settings.sh
```

### Rule 2: データベースクエリシステムの使用

**🔴 最重要: Aurora RDSへのアクセスは必ずLambda経由**

**✅ 正しい方法:**

```bash
# 標準的なクエリ実行
bash scripts/db-query.sh "SELECT * FROM scenarios LIMIT 5"

# ファイル経由（大きなクエリ）
bash scripts/db-query.sh --file scripts/queries/verification.sql

# 書き込み操作（明示的フラグ必須）
bash scripts/db-query.sh --write "UPDATE scenarios SET title='New' WHERE id='xxx'"
```

**❌ 禁止事項:**

```bash
# ローカルPostgreSQLへの直接接続（禁止）
psql postgresql://localhost:5432/prance

# RDSへの直接接続（VPCでブロック済み）
psql postgresql://xxx.rds.amazonaws.com:5432/prance
```

---

## 📦 スクリプト一覧

### 検証スクリプト

#### validate-env.sh

**用途:** 環境変数が正しく設定されているか検証

**実行:**

```bash
bash scripts/validate-env.sh
```

**検証項目:**
- DATABASE_URL が AWS RDS を指しているか
- 必須環境変数の存在確認
- .env.local と infrastructure/.env の整合性

**期待される出力:**

```
✅ DATABASE_URL is correctly configured (AWS RDS)
✅ All required environment variables are set
✅ .env.local and infrastructure/.env are synchronized
```

#### validate-lambda-dependencies.sh

**用途:** Lambda関数の依存関係が正しくインストールされているか検証

**実行:**

```bash
cd infrastructure
pnpm run lambda:predeploy

# または直接
bash scripts/validate-lambda-dependencies.sh prance-scenarios-get-dev
```

**検証項目:**
- @aws-sdk/client-s3
- @aws-sdk/client-bedrock-runtime
- @prisma/client
- microsoft-cognitiveservices-speech-sdk
- 共有モジュール (shared/config, shared/utils)

**修復:**

```bash
# 依存関係破損時の修復
pnpm run lambda:fix
```

#### validate-language-sync.sh

**用途:** Frontend/Lambda/Message directoriesの言語リストが同期しているか検証

**実行:**

```bash
pnpm run validate:languages

# または直接
bash scripts/validate-language-sync.sh
```

**検証項目:**
- apps/web/lib/i18n/config.ts の locales 配列
- infrastructure/lambda/shared/config/language-config.ts の LANGUAGES 配列
- apps/web/messages/{languageCode}/ ディレクトリ構造

**期待される出力:**

```
✅ Frontend config languages: en, ja, zh-CN, zh-TW, ko, es, pt, fr, de, it
✅ Lambda config languages: en, ja, zh-CN, zh-TW, ko, es, pt, fr, de, it
✅ Message directories: en, ja, zh-CN, zh-TW, ko, es, pt, fr, de, it
✅ All language lists are synchronized
```

#### validate-ui-settings.sh

**用途:** UI設定項目がデータベースに正しく保存・取得されるか検証

**実行:**

```bash
pnpm run validate:ui-settings

# 特定フィールドのみ検証
pnpm run validate:ui-settings -- --field silencePromptTimeout
```

**検証項目:**
- Prismaスキーマにフィールドが存在するか
- GET APIの select に含まれているか
- UPDATE/CREATE APIの updateData に含まれているか
- 組織設定 DEFAULT_SETTINGS に適切なデフォルト値があるか

**期待される出力:**

```
Validating UI setting: silencePromptTimeout

✅ Field exists in Prisma schema
✅ Included in GET API select
✅ Included in UPDATE API updateData
✅ Default value is appropriate (15)

Validation passed ✅
```

#### validate-deployment-method.sh

**用途:** 手動zipファイルが存在しないか検証（Lambda関数デプロイ前）

**実行:**

```bash
bash scripts/validate-deployment-method.sh
```

**検証項目:**
- infrastructure/lambda/**/*.zip ファイルの存在確認
- lambda-deployment.zip 等の手動作成zipファイル検出

**期待される出力:**

```
✅ No manual zip files detected
✅ All validations passed
```

---

### データベーススクリプト

#### db-query.sh

**用途:** Lambda経由でSQLクエリを実行（直接実行モード）

**実行:**

```bash
# 基本的なSELECT
bash scripts/db-query.sh "SELECT id, title FROM scenarios LIMIT 5"

# 複雑なクエリ
bash scripts/db-query.sh "
SELECT
  id,
  title,
  silence_prompt_timeout,
  enable_silence_prompt
FROM scenarios
WHERE silence_prompt_timeout IS NOT NULL
ORDER BY created_at DESC
LIMIT 10
"

# ファイル経由
bash scripts/db-query.sh --file scripts/queries/verification.sql

# 最大結果数指定
bash scripts/db-query.sh --max-results 100 "SELECT * FROM sessions"

# 書き込み操作（--write フラグ必須）
bash scripts/db-query.sh --write "UPDATE scenarios SET title='New Title' WHERE id='xxx'"
```

**オプション:**
- `--file FILE` - SQLファイルから読み込み
- `--write` - 書き込み操作を許可（デフォルトはread-only）
- `--max-results N` - 最大結果数（デフォルト: 1000）
- `--env ENV` - 環境指定（dev/staging/production、デフォルト: dev）

**セキュリティ:**
- デフォルトでread-onlyモード（SELECT, WITH句のみ許可）
- INSERT, UPDATE, DELETE, DROP等は `--write` フラグが必須
- 書き込み操作時は確認プロンプト表示

#### db-exec.sh

**用途:** Lambda経由でSQLクエリを実行（S3経由モード、大きなクエリ用）

**実行:**

```bash
# ファイルから読み込み（read-only）
bash scripts/db-exec.sh scripts/queries/large-migration.sql

# 書き込み操作
bash scripts/db-exec.sh --write scripts/queries/update.sql
```

**処理フロー:**
1. SQLファイルをS3にアップロード
2. Lambda関数にqueryIdを渡して実行
3. 結果取得
4. S3から自動削除（クリーンアップ）

**S3バケット:**
- `prance-db-queries-dev`
- 7日後に自動削除（ライフサイクルルール）

---

### デプロイスクリプト

#### deploy.sh

**用途:** 環境ごとのCDKデプロイを実行

**実行:**

```bash
cd infrastructure

# 開発環境
bash deploy.sh dev

# ステージング環境
bash deploy.sh staging

# 本番環境
bash deploy.sh production
```

**実行される処理:**
1. 環境変数検証
2. CDK Bootstrap確認
3. 全Stackのデプロイ
4. デプロイ結果の出力

#### clean-deploy.sh

**用途:** クリーン状態からのデプロイ（node_modules削除 → 再インストール → デプロイ）

**実行:**

```bash
cd infrastructure
bash clean-deploy.sh dev
```

**⚠️ 注意:**
- 時間がかかる（10-20分）
- 依存関係が破損している場合のみ使用
- 通常は `deploy.sh` を使用すること

---

### クリーンアップスクリプト

#### clean-space-files-and-dirs.sh

**バージョン:** 2.0 (2026-04-03改善版)

**用途:** ファイル名・ディレクトリ名に空白を含むアイテムを削除

**背景:**
- macOS Finderが自動生成するコピーファイル（`file 2.sh`, `dir 2/` など）を検出・削除
- ビルドエラーの原因となるため、定期的な実行を推奨
- 削除失敗時は自動的に `-broken-<timestamp>` に名称変更

**v2.0の改善点:**
- ✅ `.broken-*` ディレクトリ内部もスキャン対象に（従来は除外）
- ✅ `find -depth` で深くネストしたディレクトリから削除
- ✅ 4段階（ファイル）/5段階（ディレクトリ）の削除戦略
  - Strategy 1: 通常削除 (`rm -rf`)
  - Strategy 2: sudo削除 (`sudo rm -rf`)
  - Strategy 3: パーミッション変更後削除 (`chmod 777 + rm`)
  - Strategy 4: 個別削除 (`find -delete`, ディレクトリのみ)
  - Strategy 5: リネームフォールバック (`.broken-*`)
- ✅ 削除失敗ログを記録 (`/tmp/failed-deletions-*.log`)
- ✅ 失敗時のユーザーガイダンス改善

**実行:**

```bash
# ドライラン（削除せずに確認のみ）
bash scripts/clean-space-files-and-dirs.sh --dry-run

# 通常実行（確認プロンプト付き、.broken-* 含む）
bash scripts/clean-space-files-and-dirs.sh

# 確認なしで実行
bash scripts/clean-space-files-and-dirs.sh --force

# 全プロジェクトをスキャン
bash scripts/clean-space-files-and-dirs.sh --all

# 削除せず名称変更のみ
bash scripts/clean-space-files-and-dirs.sh --rename-only

# .broken-* を除外（v1.0互換モード）
bash scripts/clean-space-files-and-dirs.sh --exclude-broken
```

**処理フロー:**
1. 空白を含むファイル・ディレクトリを検出（深い階層から）
2. 削除試行（4-5段階の戦略）
3. 削除失敗時は `-broken-<timestamp>` に自動名称変更
4. 失敗したアイテムを `/tmp/failed-deletions-*.log` に記録
5. サマリーレポート＋対処方法を表示

**除外パターン:**
- `node_modules/`
- `.git/`
- `*.broken-*` (オプション: `--exclude-broken` で除外可能)

**デフォルトスキャンパス:**
- `apps/`, `infrastructure/`, `packages/`, `scripts/`, `docs/`

**期待される出力:**

```
Files found:           98
Files cleaned:         98 ✅
Files failed:          0

Directories found:     42
Directories cleaned:   42 ✅
Directories failed:    0

✅ All space-containing items cleaned successfully
```

#### clean-space-files-and-dirs.sh

**用途:** ディレクトリ名に空白を含むディレクトリを削除（ディレクトリのみ）

**対象パス:**
- `apps/web/.next`
- `infrastructure/cdk.out`
- `apps/web/.turbo`

**実行:**

```bash
bash scripts/clean-space-files-and-dirs.sh
```

**⚠️ 注意:**
- `clean-space-files-and-dirs.sh` の方が機能が豊富（ファイル + ディレクトリ対応）
- 新規クリーンアップには `clean-space-files-and-dirs.sh` の使用を推奨

#### cleanup-broken-files.sh

**バージョン:** 2.0 (2026-04-03改善版)

**用途:** `.broken-*` パターンでリネームされたディレクトリを削除

**v2.0の改善点:**
- ✅ 5段階の強化された削除戦略
  - Strategy 1: 通常削除 (`rm -rf`)
  - Strategy 2: sudo削除 (`sudo rm -rf`)
  - Strategy 3: アグレッシブモード（空白含むファイル先削除）
  - Strategy 4: パーミッション変更後削除 (`chmod 777 + rm`)
  - Strategy 5: 個別削除 (`find -delete`)
- ✅ アグレッシブモード追加（`--aggressive`）
- ✅ 削除失敗ログを記録 (`/tmp/cleanup-failed-*.log`)
- ✅ 失敗時の詳細なガイダンス

**実行:**

```bash
# 7日以上前のバックアップのみ削除
bash scripts/cleanup-broken-files.sh

# 全バックアップを削除
bash scripts/cleanup-broken-files.sh --all

# 確認なしで実行
bash scripts/cleanup-broken-files.sh --force

# アグレッシブモード（.broken-* 内の空白含むファイルも削除）
bash scripts/cleanup-broken-files.sh --all --aggressive

# フルパワーモード（推奨）
bash scripts/cleanup-broken-files.sh --all --aggressive --force
```

**アグレッシブモードとは:**
- `.broken-*` ディレクトリ内の空白を含むファイル・ディレクトリを先に削除
- 今回のような「`dir 2/subdir 2/`」パターンに有効
- 削除成功率が向上

**削除対象パターン:**
- `.broken-*`
- `node_modules.broken*`
- `.next.broken-*`, `.next.old-*`
- `cdk.out.old-*`, `cdk.out.broken-*`

**期待される出力:**

```
✓ 成功: 5
✗ 失敗: 0

✅ クリーンアップ完了
```

**失敗時の出力:**

```
✗ 失敗: 2

失敗したアイテムのログ:
  /tmp/cleanup-failed-20260403-143000.log

推奨される対処方法:
  1. アグレッシブモードで再試行
  2. プロセスを確認・終了
  3. システム再起動後に再試行
```

---

### 監視・ヘルスチェックスクリプト

#### watch-logs.sh

**用途:** CloudWatch Logsをリアルタイム監視

**実行:**

```bash
# Lambda関数のログ監視
bash scripts/watch-logs.sh prance-scenarios-get-dev

# エラーログのみフィルタ
bash scripts/watch-logs.sh prance-scenarios-get-dev ERROR
```

#### health-check.sh

**用途:** システム全体のヘルスチェック

**実行:**

```bash
bash scripts/health-check.sh dev
```

**チェック項目:**
- RDS接続確認
- Lambda関数ステータス
- API Gatewayエンドポイント
- S3バケット存在確認
- DynamoDBテーブル存在確認

---

## 🔍 クエリファイル管理

### scripts/queries/ ディレクトリ

よく使うSQLクエリを保存して再利用します。

```
scripts/queries/
├── phase6-verification.sql   # Phase 6階層的フォールバック検証
├── list-scenarios.sql         # シナリオ一覧取得
├── list-users.sql             # ユーザー一覧取得
├── organization-settings.sql  # 組織設定確認
└── [カスタムクエリ]
```

**クエリファイルの作成:**

```sql
-- scripts/queries/list-scenarios.sql
SELECT
  id,
  title,
  language,
  silence_prompt_timeout,
  enable_silence_prompt
FROM scenarios
WHERE org_id = 'YOUR_ORG_ID'
ORDER BY created_at DESC
LIMIT 20;
```

**実行:**

```bash
bash scripts/db-query.sh --file scripts/queries/list-scenarios.sql
```

---

## 🧪 スクリプトテスト

### 単体テスト

```bash
# スクリプトの構文チェック
bash -n scripts/validate-env.sh

# ShellCheck（静的解析）
shellcheck scripts/validate-env.sh
```

### 統合テスト

```bash
# 全検証スクリプト実行
for script in scripts/validate-*.sh; do
  echo "Testing $script"
  bash "$script"
done
```

---

## 📚 スクリプト作成ガイドライン

### ベストプラクティス

**1. エラーハンドリング**

```bash
#!/bin/bash
set -e  # エラーで即座に終了

# エラー時のクリーンアップ
trap 'echo "Error occurred"; cleanup' ERR

function cleanup() {
  # クリーンアップ処理
  rm -f /tmp/temp-file
}
```

**2. カラー出力**

```bash
# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 使用
echo -e "${GREEN}✓ Success${NC}"
echo -e "${RED}✗ Error${NC}"
echo -e "${YELLOW}⚠️  Warning${NC}"
```

**3. 引数パース**

```bash
# デフォルト値
ENVIRONMENT="dev"
VERBOSE=false

# 引数パース
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done
```

**4. ドライラン対応**

```bash
DRY_RUN=false

if [ "$DRY_RUN" = true ]; then
  echo "Would execute: aws s3 cp file.txt s3://bucket/"
else
  aws s3 cp file.txt s3://bucket/
fi
```

---

## 🔍 トラブルシューティング

### よくある問題

**1. Permission denied**

```bash
# 実行権限付与
chmod +x scripts/validate-env.sh
```

**2. Command not found**

```bash
# 依存コマンドのインストール確認
which aws    # AWS CLI
which jq     # JSON processor
which psql   # PostgreSQL client
```

**3. Environment variable not set**

```bash
# 環境変数確認
echo $DATABASE_URL
env | grep DATABASE_URL

# .env読み込み
set -a
source .env.local
set +a
```

---

## 📚 共有ライブラリシステム

### 概要

**バージョン:** Phase 4完了（2026-04-05）
**カバレッジ:** 75/75 production scripts (100%)

全てのproductionスクリプトは `scripts/lib/common.sh` 共有ライブラリを使用しています。

### 提供機能

#### 1. カラー出力
```bash
# 自動的にexportされる変数
RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, WHITE, BOLD, NC
```

#### 2. ログ関数
```bash
log_success "成功メッセージ"    # 緑のチェックマーク
log_error "エラーメッセージ"    # 赤のX
log_warning "警告メッセージ"    # 黄色の警告
log_info "情報メッセージ"       # シアンの情報アイコン
log_section "セクションタイトル" # セクションヘッダー
log_step 1 "ステップ1"          # ステップ表示
log_debug "デバッグメッセージ"  # DEBUG=true時のみ表示
```

#### 3. カウンター管理
```bash
reset_counters                  # 全カウンターを0にリセット
increment_counter PASSED        # PASSEDカウンターをインクリメント
increment_counter FAILED        # FAILEDカウンターをインクリメント
increment_counter ERRORS        # ERRORSカウンターをインクリメント
increment_counter WARNINGS      # WARNINGSカウンターをインクリメント
increment_counter SKIPPED       # SKIPPEDカウンターをインクリメント
print_counter_summary           # サマリーを表示して終了コード返却
```

#### 4. エラーハンドリング
```bash
die "エラーメッセージ" [exit_code]  # エラーメッセージを表示して終了
require_command "aws" "brew install awscli"  # コマンドの存在確認
require_file "/path/to/file" "hint"          # ファイルの存在確認
require_directory "/path/to/dir" "hint"      # ディレクトリの存在確認
require_env "DATABASE_URL" "hint"            # 環境変数の存在確認
```

#### 5. ユーティリティ
```bash
confirm "実行しますか？" "y"    # ユーザー確認プロンプト（デフォルトy）
print_separator "=" 50          # 区切り線表示
get_script_dir                  # スクリプトディレクトリパスを取得
is_sourced                      # sourceされているか確認
```

### 新規スクリプト作成ガイドライン

#### テンプレート

```bash
#!/bin/bash
# ==============================================================================
# Script Name - Brief Description
# ==============================================================================
# Purpose: Detailed purpose
# Usage: bash scripts/script-name.sh [options]
# ==============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# ==============================================================================
# Configuration
# ==============================================================================

# Your configuration variables here

# ==============================================================================
# Main Logic
# ==============================================================================

log_section "Script Name"

log_info "Starting process..."

# Your logic here

# Use counters
if [ condition ]; then
  log_success "Operation succeeded"
  increment_counter PASSED
else
  log_error "Operation failed"
  increment_counter FAILED
fi

# ==============================================================================
# Summary
# ==============================================================================

print_counter_summary
```

#### ベストプラクティス

1. **必ず共有ライブラリをsource**
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/lib/common.sh"
   ```

2. **色定義を独自に定義しない**
   ```bash
   # ❌ 禁止
   RED='\033[0;31m'
   GREEN='\033[0;32m'
   
   # ✅ 推奨
   # 共有ライブラリの変数を直接使用
   echo -e "${GREEN}Success${NC}"
   # または
   log_success "Success"
   ```

3. **ログ関数を使用**
   ```bash
   # ❌ 禁止
   echo -e "${GREEN}✅ Success${NC}"
   
   # ✅ 推奨
   log_success "Success"
   ```

4. **カウンター管理を使用**
   ```bash
   # ❌ 禁止
   PASSED=0
   ((PASSED++))
   
   # ✅ 推奨
   increment_counter PASSED
   ```

5. **エラーハンドリング**
   ```bash
   # ✅ 推奨
   require_command "aws" "brew install awscli"
   require_file ".env.local" "Copy from .env.example"
   require_env "DATABASE_URL" "Set in .env.local"
   ```

### 検証

#### 共有ライブラリ使用検証

**全スクリプトが共有ライブラリを使用しているか確認:**

```bash
bash scripts/validate-shared-lib-usage.sh
```

**期待される出力:**

```
==========================================
  Shared Library Usage Validation
==========================================
ℹ️  Scanning scripts/ directory (excluding archive/)

==========================================
  Summary Report
==========================================
Total scripts analyzed: 75

✅ Scripts using shared library (75):
  ✓ validate-env.sh
  ✓ detect-hardcoded-values.sh
  ✓ ...

==========================================
  Validation Result
==========================================
✅ All scripts are using the shared library system correctly! 🎉

Statistics:
  • Scripts using shared lib: 75
  • Special scripts (excluded): 0
  • Total analyzed: 75
```

**検証項目:**
- 共有ライブラリ source 確認
- 古い色定義検出（`RED='\033[...'`）
- 手動カウンター検出（`((PASSED++))`）
- カスタムdie関数検出

#### 構文チェック

```bash
# 個別スクリプト
bash -n scripts/your-script.sh

# 全スクリプト
for script in scripts/*.sh; do
  bash -n "$script" && echo "✓ $script"
done
```

### アーカイブ

**使用されていない古いスクリプトのアーカイブ:**

```
scripts/archive/
├── pre-phase4-migration/        ← Phase 4移行前のスクリプト（63個）
├── domain-migration-2024/       ← ドメイン移行スクリプト（5個）
└── [その他のアーカイブ]
```

各アーカイブディレクトリにはREADME.mdが含まれ、目的・日時・注意事項が記載されています。

---

## 📚 関連ドキュメント

- [データベースクエリシステム](../docs/07-development/DATABASE_QUERY_SYSTEM.md)
- [デプロイメント](../docs/08-operations/DEPLOYMENT.md)
- [環境アーキテクチャ](../docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md)
- [共有ライブラリソースコード](lib/common.sh)

---

**最終更新:** 2026-04-05
**次回レビュー:** 新規スクリプト追加時
