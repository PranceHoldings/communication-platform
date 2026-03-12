# Space-Containing Directory Prevention Guide

**Status:** 🔴 CRITICAL - Build/Deploy Blocker
**Date:** 2026-03-12
**Memory Rule:** MEMORY.md Rule 4

---

## 📋 目次

1. [問題の概要](#問題の概要)
2. [影響範囲](#影響範囲)
3. [自動防止メカニズム](#自動防止メカニズム)
4. [手動対応手順](#手動対応手順)
5. [予防策](#予防策)

---

## 問題の概要

### 🔴 Critical Issue

**空白を含むディレクトリ名はビルド・デプロイを完全にブロックします**

**典型的なファイル名:**
- `dashboard 2/`
- `chunks 2/`
- `vendor-chunks 2/`
- `static 2/`
- `webpack 2/`
- `css 2/`
- `development 2/`
- `media 2/`

### 発生原因

1. **macOS Finderの自動生成**
   - ファイル/ディレクトリをコピーすると `〜 2` という名前で作成される
   - ドラッグ&ドロップ操作で意図せず発生

2. **削除不能な理由**
   - `rm -rf` でも削除できない（`ENOTEMPTY` エラー）
   - `sudo rm -rf` でも削除できないケースがある
   - ディレクトリ階層が深すぎる（65535階層ネスト）

### 影響を受けるプロセス

- ❌ Next.js ビルド（`npm run build`）
- ❌ Next.js 開発サーバー（`npm run dev`）
- ❌ CDK デプロイ（`npm run cdk -- deploy`）
- ❌ Turbo ビルド（`turbo run build`）
- ❌ クリーンビルド（`npm run build:clean`）

---

## 影響範囲

### 問題が発生しやすいディレクトリ

| ディレクトリ | 理由 | リスクレベル |
|-------------|------|------------|
| `apps/web/.next` | Next.jsビルド出力 | 🔴 Critical |
| `infrastructure/cdk.out` | CDKバンドリング出力 | 🔴 Critical |
| `apps/web/.turbo` | Turboキャッシュ | 🟡 Medium |
| `node_modules/.cache` | npm/Turboキャッシュ | 🟡 Medium |

### 過去の実例

**2026-03-12 Day 13セッション:**
- **問題**: Next.jsサーバーが起動しない
- **原因**: `.next` ディレクトリ内に9個の空白含有ディレクトリ
- **検出された数**: 9個
  ```
  .next/types/app/dashboard 2
  .next/server/vendor-chunks 2
  .next/server/static 2
  .next/server/app 2
  .next/static/webpack 2
  .next/static/css 2
  .next/static/development 2
  .next/static/chunks 2
  .next/static/media 2
  ```
- **解決策**: `.next` を `.next.broken-*` にリネーム → 新規作成

---

## 自動防止メカニズム

### 1. clean-space-directories.sh スクリプト

**場所:** `scripts/clean-space-directories.sh`

**機能:**
1. 空白を含むディレクトリを自動検出
2. 削除を試行（通常 → sudo → mv戦略）
3. 削除不能な場合は `.broken-*` にリネーム

**実行方法:**
```bash
# 直接実行
bash scripts/clean-space-directories.sh

# npm script経由
npm run clean:spaces
```

**出力例:**
```
============================================
Cleaning Space-Containing Directories
============================================

[1/3] Scanning for directories with spaces...
  Checking: apps/web/.next
  ✗ Found: apps/web/.next/types/app/dashboard 2
  ✓ Removed: apps/web/.next/types/app/dashboard 2

[2/3] Checking build output directories...
  ✓ apps/web/.next: Clean

[3/3] Cleaning up problematic build directories...

============================================
Summary
============================================

Directories found:   9
Directories cleaned: 9
Directories failed:  0

✅ All space-containing directories cleaned
```

### 2. Pre-Deployment Check統合

**場所:** `scripts/pre-deploy-lambda-check.sh`

**統合内容:**
- CHECK 0/7として自動実行
- デプロイ前に必ず空白チェック実行
- 失敗時はデプロイをブロック

**実行方法:**
```bash
# Lambda関数デプロイ前の検証（7項目）
npm run lambda:predeploy

# 出力例:
# [CHECK 0/7] 空白文字を含むディレクトリの検証
#   ✓ 空白文字チェック: OK
```

### 3. Clean Build統合

**場所:** `scripts/clean-build.sh`

**統合内容:**
- Step 0として最初に実行
- クリーンビルド前に空白チェック
- 失敗時はビルドを中断

**実行方法:**
```bash
# クリーンビルド（自動で空白チェック実行）
npm run build:clean

# 出力例:
# Step 0: 空白文字を含むディレクトリの検出・削除
#   実行中: clean-space-directories.sh
#   空白文字チェック完了
```

---

## 手動対応手順

### Step 1: 検出

```bash
# 空白を含むディレクトリを検索
find . -name "* *" -type d \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*.broken-*"

# 主要ディレクトリのみ検索
find apps/web/.next infrastructure/cdk.out -name "* *" -type d 2>/dev/null
```

### Step 2: 削除試行

```bash
# 方法1: 通常削除
rm -rf "apps/web/.next/types/app/dashboard 2"

# 方法2: sudo削除
sudo rm -rf "apps/web/.next/types/app/dashboard 2"

# 方法3: 親ディレクトリごと削除
rm -rf apps/web/.next
```

### Step 3: 削除不能な場合

```bash
# .next ディレクトリをリネーム
sudo mv apps/web/.next apps/web/.next.broken-$(date +%s)
mkdir -p apps/web/.next

# cdk.out ディレクトリをリネーム
sudo mv infrastructure/cdk.out infrastructure/cdk.out.broken-$(date +%s)
mkdir -p infrastructure/cdk.out
```

### Step 4: 再ビルド

```bash
# Next.js
cd apps/web
npm run dev

# Lambda関数
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda
```

---

## 予防策

### 1. .gitignore設定

**既に設定済み:**
```gitignore
# macOS Finder auto-generated files
**/* 2/
**/* 2

# Broken directories
*.broken-*
.next.broken-*
cdk.out.broken-*
```

### 2. Git Pre-commit Hook

**推奨設定（将来実装）:**
```bash
#!/bin/bash
# .husky/pre-commit

# 空白を含むファイルをコミットさせない
if git diff --cached --name-only | grep " "; then
  echo "❌ Error: Filenames with spaces are not allowed"
  exit 1
fi
```

### 3. 開発ガイドライン

**チーム全体で遵守:**

✅ **DO:**
- ファイル名は英数字・ハイフン・アンダースコアのみ使用
- コピー&ペーストではなくgit操作を使用
- ターミナルでファイル操作（Finder使用を最小限に）

❌ **DON'T:**
- macOS Finderでファイルをコピー
- 空白を含むファイル/ディレクトリ名を作成
- 手動でビルド出力を編集

### 4. 定期チェック

**推奨頻度:**
- **毎日**: ビルド/デプロイ前
- **週1回**: プロジェクト全体スキャン
- **コミット前**: pre-commit hook

**コマンド:**
```bash
# デイリーチェック
npm run clean:spaces

# ウィークリーチェック
find . -name "* *" -type d -not -path "*/node_modules/*" -not -path "*/.git/*"
```

---

## トラブルシューティング

### Q1: `rm -rf` で削除できない

**A:** 以下の順で試行:
```bash
# 1. sudo削除
sudo rm -rf "directory 2"

# 2. 親ディレクトリをリネーム
sudo mv parent-dir parent-dir.broken-$(date +%s)

# 3. 完全クリーン（最終手段）
rm -rf .next cdk.out node_modules
npm install
npm run build
```

### Q2: 再発防止方法は？

**A:**
1. `npm run clean:spaces` をデイリー実行
2. `npm run lambda:predeploy` でデプロイ前チェック
3. macOS Finderの使用を最小限に
4. git操作でファイル管理

### Q3: `.broken-*` ディレクトリは削除して良い？

**A:** はい、安全に削除可能:
```bash
# .broken-* ディレクトリを検索
find . -name "*.broken-*" -type d

# 確認後に削除
find . -name "*.broken-*" -type d -exec rm -rf {} +
```

---

## チェックリスト

### ビルド前
- [ ] `npm run clean:spaces` を実行
- [ ] `.next` ディレクトリに空白なし
- [ ] `cdk.out` ディレクトリに空白なし

### デプロイ前
- [ ] `npm run lambda:predeploy` を実行
- [ ] CHECK 0/7（空白チェック）が成功
- [ ] 全7項目のチェックが成功

### コミット前
- [ ] 空白を含むファイルがない
- [ ] `.broken-*` ディレクトリは未追加
- [ ] git status に空白含有ファイルがない

---

## 関連ドキュメント

- **CLAUDE.md Rule 4**: ファイル名規則
- **MEMORY.md Rule 4**: 空白文字禁止令
- **Session 2026-03-12**: 空白問題の詳細記録

---

**Last Updated:** 2026-03-12
**Status:** 🟢 Active - Automated Prevention Implemented
