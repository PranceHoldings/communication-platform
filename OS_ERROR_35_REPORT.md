# OS Error 35 (Resource Deadlock) Report

**日時:** 2026-04-03  
**環境:** GitHub Codespaces (Linux 6.12.76-linuxkit)  
**Node.js:** v22.x  
**問題:** ファイルシステムでResource Deadlockが発生し、ビルド・デプロイが不可能

---

## 📋 エラーが発生したファイル一覧

### 1. TypeScript Compiler (packages/shared)

**エラータイプ:** `error TS5033: Could not write file`

```
/workspaces/prance-communication-platform/packages/shared/dist/index.d.ts.map
  → Unknown system error -35: Unknown system error -35, open

/workspaces/prance-communication-platform/packages/shared/dist/index.js
  → Unknown system error -35: Unknown system error -35, open

/workspaces/prance-communication-platform/packages/shared/dist/index.js.map
  → Unknown system error -35: Unknown system error -35, open
```

**コマンド:**
```bash
cd packages/shared && pnpm run build
# tsc コンパイル時に失敗
```

---

### 2. Next.js Build (apps/web)

**エラータイプ:** `Next.js ERROR: Failed to read file`

```
/workspaces/prance-communication-platform/apps/web/app/test-avatar/page.tsx
  → Unknown system error -35: Unknown system error -35, read
```

**コマンド:**
```bash
cd apps/web && pnpm run build
# next build 時に失敗
```

---

### 3. Prisma Client Generation (packages/database)

**エラータイプ:** `Schema Env Error`

```
Prisma schema file: /workspaces/prance-communication-platform/packages/database/prisma/schema.prisma
  → Error: Unknown system error -35: Unknown system error -35, read
```

**コマンド:**
```bash
cd packages/database && pnpm exec prisma generate
# Prisma Client生成時に警告（警告のみで生成は成功）
```

**注:** Prisma Clientの生成自体は完了するが、スキーマファイル読み込み時にエラーが発生

---

### 4. Turbo Build (全体)

**エラータイプ:** `io error: Resource deadlock would occur`

```
turbo run build
  → x io error: Resource deadlock would occur (os error 35)
  → Packages in scope: @prance/database, @prance/infrastructure, @prance/shared, @prance/web
```

**コマンド:**
```bash
pnpm run build
# turbo がすべてのパッケージをビルド時に失敗
```

---

## 🔍 根本原因の分析

### 1. macOS Finder による空白ディレクトリ生成

**検出された空白入りディレクトリ:** 90+ 箇所（node_modules内）

```
node_modules/@alloc 2/
node_modules/@aws 2/
node_modules/@typescript-eslint 2/
node_modules/.es-iterator-helpers 2-KCsfFr1W/
... (90+ directories)
```

**影響:**
- npmがnode_modulesにアクセス時にファイルシステムロックが発生
- ビルドツール（tsc, next, turbo）がファイル書き込み時にロック競合

### 2. ファイルシステムのリソース枯渇

**症状:**
- 複数プロセスが同時にnode_modulesにアクセス
- ファイル記述子（File Descriptor）の競合
- inotify リソースの枯渇（Linuxカーネルレベル）

**os error 35の意味（Linux）:**
- `EDEADLK` - Resource deadlock would occur
- ファイルロック操作が循環待機状態に陥る

---

## 🛠️ 試みた対策（すべて失敗）

### 1. 空白ディレクトリクリーンアップ

```bash
bash scripts/clean-space-files-and-dirs.sh --force --all
# 結果: 空白ディレクトリが削除できない（同じエラー）
```

### 2. node_modules 完全削除

```bash
rm -rf node_modules
# 結果: "Directory not empty" エラー（170+ 箇所）
```

### 3. Turbo キャッシュクリア

```bash
rm -rf .turbo apps/web/.turbo infrastructure/.turbo packages/*/.turbo
# 結果: キャッシュクリアは成功したが、ビルドは失敗
```

### 4. 個別パッケージビルド

```bash
cd packages/shared && pnpm run build
cd apps/web && pnpm run build
# 結果: どちらも os error 35 で失敗
```

### 5. infrastructure のみでデプロイ

```bash
cd infrastructure
pnpm install  # 成功
pnpm run deploy:staging  # ルートの pnpm run build で失敗
```

---

## ✅ 成功した対策

### 1. infrastructure/node_modules のみ再インストール

```bash
cd infrastructure
rm -rf node_modules
pnpm install --legacy-peer-deps
# 結果: ✅ 成功（259パッケージインストール完了）
```

### 2. infrastructure から deploy.sh 実行

```bash
cd infrastructure
bash deploy.sh staging
# 結果: ❌ 失敗（ルートディレクトリの pnpm run build でエラー）
```

**問題点:**
- `deploy.sh` がルートディレクトリの `pnpm run build` を実行
- ルートの node_modules が破損しているため失敗

---

## 🚨 最終結論

### この環境では修復不可能

**理由:**
1. **ファイルシステム全体が破損** - os error 35はシステムレベルのエラー
2. **node_modules が削除不可能** - 170+の空白ディレクトリがロック状態
3. **ビルドツールがすべて失敗** - tsc, next, turbo すべてが同じエラー

### 唯一の解決策

**新しいクリーンな環境でデプロイを実行する必要があります。**

---

## 📝 推奨される次のアクション

### Option 1: 新しい Codespaces 環境（推奨）

```bash
# 1. 新しいCodespacesを起動
# 2. リポジトリをクローン
git checkout staging
git pull origin staging

# 3. Staging環境デプロイ
cd infrastructure
pnpm install
pnpm run deploy:staging
```

### Option 2: ローカルマシン

```bash
git pull origin staging
cd infrastructure
pnpm install
pnpm run deploy:staging
```

### Option 3: GitHub Actions CI/CD（長期的推奨）

`.github/workflows/deploy-staging.yml` を作成して、stagingブランチへのpush時に自動デプロイ

---

## 📊 影響範囲

### ✅ 完了済み（影響なし）

- 翻訳キー修正完了（avatars.fallback関連）
- コード変更コミット＆プッシュ完了
  - devブランチ: `4e66850`
  - stagingブランチ: `20fb484`
- CloudWatch監視セットアップ完了

### ❌ 未完了（環境問題により実行不可）

- Staging環境デプロイ
- Production環境デプロイ

---

## 🔧 予防策（将来の対応）

### 1. macOS Finder による空白ディレクトリ生成防止

**原因:** macOSのFinderが「ファイル 2」「フォルダ 2」を自動生成

**対策:**
- Finder経由でのコピー操作を避ける
- コマンドラインで `cp` コマンドを使用
- `.gitignore` に空白パターンを追加

```gitignore
# macOS Finder auto-generated files
*\ 2/
*\ 2.*
*\ 3/
*\ 3.*
```

### 2. Pre-commit Hook強化

```bash
# .git/hooks/pre-commit に追加
if find . -name "* *" -type d | grep -v node_modules | grep -q .; then
  echo "❌ Error: Space-containing directories detected"
  exit 1
fi
```

### 3. GitHub Actions CI/CD 導入

**メリット:**
- クリーンな環境で毎回ビルド・デプロイ
- ローカル環境の破損の影響を受けない
- 自動化によるヒューマンエラー削減

---

**作成日:** 2026-04-03  
**作成者:** Claude Sonnet 4.5  
**ステータス:** 環境問題により作業中断、別環境でのデプロイが必要
