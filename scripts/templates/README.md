# Script Templates

このディレクトリには、新規スクリプト作成用のテンプレートが含まれています。

## 📋 概要

すべての新規スクリプトは**共有ライブラリシステム** (`scripts/lib/common.sh`) を使用する必要があります。
このテンプレートシステムは、共有ライブラリ統合を自動化し、コード品質を保証します。

---

## 🚀 クイックスタート

### 方法1: インタラクティブ生成（推奨）

```bash
# スクリプトジェネレーターを実行
bash scripts/new-script.sh

# プロンプトに従って入力
# → 自動的に共有ライブラリ統合済みスクリプトが生成されます
```

**入力項目:**
1. スクリプト名 (例: `my-new-script`)
2. 簡単な説明 (例: `Validates configuration files`)
3. 詳細な目的 (オプション)
4. メインセクション名 (オプション、デフォルト: スクリプト名)

**出力:**
- `scripts/my-new-script.sh` - 実行可能な完全なスクリプト
- 共有ライブラリ統合済み
- 構文検証済み
- テンプレートコメント付き

### 方法2: テンプレートから手動作成

```bash
# テンプレートをコピー
cp scripts/templates/script-template.sh scripts/my-new-script.sh

# プレースホルダーを置換
sed -i 's/SCRIPT_NAME/my-new-script.sh/g' scripts/my-new-script.sh
sed -i 's/Brief Description/My script description/g' scripts/my-new-script.sh
sed -i 's/CREATION_DATE/2026-04-05/g' scripts/my-new-script.sh
sed -i 's/SECTION_NAME/My Section/g' scripts/my-new-script.sh

# 実行権限付与
chmod +x scripts/my-new-script.sh

# 検証
bash scripts/validate-new-script.sh scripts/my-new-script.sh
```

---

## 📚 テンプレート構造

### script-template.sh

**セクション:**

1. **ヘッダー** - スクリプト情報、使用方法
2. **共有ライブラリ読み込み** - `source "$SCRIPT_DIR/lib/common.sh"`
3. **設定** - 定数・設定変数
4. **ヘルパー関数** - 補助関数定義
5. **メインロジック** - 主要処理
6. **エントリーポイント** - 引数パース、main()実行

**含まれる機能:**
- ✅ 共有ライブラリ統合
- ✅ ログ関数使用例
- ✅ カウンター管理例
- ✅ エラーハンドリング例
- ✅ 引数パース例
- ✅ ヘルプメッセージ

**プレースホルダー:**
- `SCRIPT_NAME` - スクリプトファイル名
- `Brief Description` - 簡単な説明
- `Detailed purpose` - 詳細な目的
- `CREATION_DATE` - 作成日
- `SECTION_NAME` - メインセクション名

---

## 🔍 検証

### 自動検証（推奨）

```bash
# 新規スクリプトを検証
bash scripts/validate-new-script.sh scripts/my-new-script.sh
```

**検証項目 (7項目):**
1. ✅ Shebang (`#!/bin/bash`)
2. ✅ 共有ライブラリsource
3. ✅ SCRIPT_DIR定義
4. ✅ ハードコード色定義なし
5. ✅ ログ関数使用
6. ✅ カウンター管理使用
7. ✅ Bash構文エラーなし

### Git Pre-commit Hook

**新規スクリプトがコミットされる際、自動的に検証されます:**

```bash
# スクリプトをコミット
git add scripts/my-new-script.sh
git commit -m "feat: add new script"

# 自動実行:
# [8/8] Validating shared library usage in scripts...
# ✅ All scripts use shared library correctly
```

---

## 📖 ベストプラクティス

### 1. 必ず共有ライブラリをsource

```bash
# ✅ 正しい
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
```

### 2. ログ関数を使用

```bash
# ❌ 禁止
echo -e "${GREEN}✅ Success${NC}"

# ✅ 推奨
log_success "Success"
```

### 3. カウンター管理を使用

```bash
# ❌ 禁止
PASSED=0
((PASSED++))

# ✅ 推奨
increment_counter PASSED
```

### 4. エラーハンドリング

```bash
# ✅ 推奨
require_command "aws" "brew install awscli"
require_file ".env.local" "Copy from .env.example"
require_env "DATABASE_URL" "Set in .env.local"
```

### 5. 引数パース

```bash
# テンプレートに含まれるパターンを使用
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      # ヘルプ表示
      ;;
    -v|--verbose)
      DEBUG=true
      shift
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done
```

---

## 🛠️ カスタマイズ

### テンプレートの拡張

**プロジェクト固有のテンプレートを追加:**

```bash
# 新しいテンプレートを作成
cp scripts/templates/script-template.sh scripts/templates/validation-script-template.sh

# カスタマイズ
# - 検証スクリプト固有のパターン追加
# - デフォルトのヘルパー関数追加
# - 標準的な引数セット追加
```

**new-script.sh を拡張:**
- テンプレート選択機能追加
- プロジェクト固有のプレースホルダー追加
- より詳細な設定オプション追加

---

## 📊 統計

### テンプレートから生成されたスクリプト

**自動検証機能により:**
- ✅ 100% 共有ライブラリ使用
- ✅ 0% ハードコード色定義
- ✅ 100% 構文エラーなし

---

## 🔗 関連ドキュメント

- [scripts/CLAUDE.md](../CLAUDE.md) - スクリプト使用ガイド
- [scripts/lib/common.sh](../lib/common.sh) - 共有ライブラリソースコード
- [scripts/validate-shared-lib-usage.sh](../validate-shared-lib-usage.sh) - 全体検証
- [scripts/validate-new-script.sh](../validate-new-script.sh) - 新規スクリプト検証

---

**最終更新:** 2026-04-05  
**バージョン:** 1.0
