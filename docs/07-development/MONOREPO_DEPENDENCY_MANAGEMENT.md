# Monorepo Dependency Management Guide

**作成日:** 2026-04-02  
**最終更新:** 2026-04-02  
**ステータス:** ✅ Active  
**関連ドキュメント:** [CODING_RULES.md](../../CODING_RULES.md), [CLAUDE.md](../../CLAUDE.md)

---

## 📋 目次

1. [概要](#概要)
2. [根本原則](#根本原則)
3. [ワークスペース構造](#ワークスペース構造)
4. [依存関係配置ルール](#依存関係配置ルール)
5. [検証システム](#検証システム)
6. [修正履歴](#修正履歴)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### 問題の本質

**症状:**
```bash
pnpm run build
# Module not found: Can't resolve '@dnd-kit/core'
# Module not found: Can't resolve '@dnd-kit/sortable'
# Module not found: Can't resolve '@dnd-kit/utilities'
```

**根本原因:**
- フロントエンドコンポーネント (`apps/web`) が使用するパッケージをルート `package.json` に配置
- 各ワークスペースが自身の依存関係を正しく宣言していない
- Monorepo依存関係管理の原則違反

**影響範囲:**
- ビルドエラー（Module not found）
- 型解決失敗（TypeScript）
- ランタイムエラー（本番環境）
- 依存関係の不整合

---

## 根本原則

### Principle 1: 各ワークスペースは自身の依存関係を宣言する

**❌ 間違った方法:**
```json
// ルート package.json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",      // apps/webで使用
    "@radix-ui/react-dialog": "^1.0.5",  // apps/webで使用
    "bcryptjs": "^3.0.3"            // infrastructureで使用
  }
}
```

**✅ 正しい方法:**
```json
// apps/web/package.json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@radix-ui/react-dialog": "^1.0.5"
  }
}

// infrastructure/package.json
{
  "dependencies": {
    "bcryptjs": "^3.0.3"
  }
}

// ルート package.json
{
  "devDependencies": {
    // 開発ツール・ビルドツールのみ
    "turbo": "^1.12.0",
    "typescript": "^5.3.3"
  }
}
```

### Principle 2: npm workspaces の hoisting を理解する

**npm workspaces の動作:**
- すべての依存関係はルート `node_modules/` にhoistされる
- ワークスペースの `node_modules/` には特殊な依存関係のみ
- `package.json` の宣言が重要（実際の配置場所ではない）

**重要:** 
```bash
# ❌ これは誤解
ls apps/web/node_modules/@dnd-kit  # 存在しない
→ "依存関係がない" と判断するのは間違い

# ✅ 正しい確認方法
jq '.dependencies["@dnd-kit/core"]' apps/web/package.json
→ package.json に宣言されていれば正しい
```

### Principle 3: 依存関係の重複を最小化する

**重複が許容されるケース:**
- `@prisma/client`: ルート + `packages/database` + `infrastructure`
  - Prisma は特殊な生成プロセスが必要
  - 各ワークスペースで独立した Prisma Client が必要

**重複を避けるべきケース:**
- 一般的なパッケージ（`immer`, `@reduxjs/toolkit`, `ws` 等）
- フロントエンド/バックエンドで共通利用されるパッケージ

---

## ワークスペース構造

### ディレクトリ構成

```
prance-communication-platform/
├── package.json                 # ルート（開発ツールのみ）
├── apps/
│   └── web/
│       └── package.json         # フロントエンド依存関係
├── packages/
│   ├── shared/
│   │   └── package.json         # 共有型定義
│   └── database/
│       └── package.json         # Prisma Client
└── infrastructure/
    └── package.json             # Lambda関数依存関係
```

### 各ワークスペースの責務

| ワークスペース | 配置すべき依存関係 | 例 |
|----------------|-------------------|-----|
| **ルート** | ビルドツール、開発ツール | `turbo`, `typescript`, `eslint` |
| **apps/web** | フロントエンドパッケージ | `react`, `next`, `@radix-ui/*`, `@dnd-kit/*` |
| **infrastructure** | Lambda関数パッケージ | `@aws-sdk/*`, `bcryptjs`, `jsonwebtoken` |
| **packages/shared** | 型定義、バリデーション | `zod` |
| **packages/database** | Prisma | `@prisma/client`, `prisma` |

---

## 依存関係配置ルール

### Rule 1: フロントエンドパッケージ

**対象:**
- React UI ライブラリ: `@radix-ui/*`, `lucide-react`, `sonner`
- Three.js 関連: `three`, `@react-three/fiber`, `@react-three/drei`
- ドラッグ&ドロップ: `@dnd-kit/*`
- データビジュアライゼーション: `recharts`, `d3-array`, `d3-scale`
- フォーム: `react-hook-form`, `zod`
- 状態管理: `zustand`, `@tanstack/react-query`

**配置先:** `apps/web/package.json`

### Rule 2: バックエンドパッケージ

**対象:**
- AWS SDK: `@aws-sdk/client-*`
- 認証: `bcryptjs`, `jsonwebtoken`
- データベース: `@prisma/client`, `pg`, `redis`
- PDF生成: `@react-pdf/renderer`

**配置先:** `infrastructure/package.json`

### Rule 3: 共有パッケージ

**対象:**
- 型定義: `@prance/shared`
- バリデーション: `zod`（packages/sharedでのみ使用）

**配置先:** `packages/shared/package.json`

### Rule 4: ビルドツール

**対象:**
- Monorepoツール: `turbo`, `npm-run-all`
- 型チェック: `typescript`, `@types/*`
- Linter/Formatter: `eslint`, `prettier`
- テスト: `@playwright/test`（devDependencies）

**配置先:** ルート `package.json` の `devDependencies`

---

## 検証システム

### 自動検証スクリプト

```bash
# 依存関係整合性チェック
pnpm run validate:workspace-deps

# 期待される出力:
# ✅ All packages used in apps/web are properly declared
# ✅ No duplicate dependencies found
# ✅ No misplaced frontend packages found in infrastructure
```

### 検証内容

#### Phase 1: 使用パッケージの宣言確認

```bash
# 1. apps/web配下の全import文をスキャン
# 2. 外部パッケージを抽出（@/, ./, ../を除外）
# 3. apps/web/package.json に存在するか確認
# 4. 存在しない場合、ルートpackage.jsonにあればエラー
```

**検出例:**
```
❌ Found packages used in apps/web but declared in root package.json:
   - @dnd-kit/utilities
     Example: apps/web/components/scenario-editor/QuestionEditor.tsx:21
```

#### Phase 2: 重複依存関係の検出

```bash
# 1. ルート package.json の dependencies を取得
# 2. 各ワークスペース package.json と比較
# 3. 重複を検出
```

**検出例:**
```
⚠️  Found duplicate dependencies (declared in both root and workspace):
   - immer (root + apps/web)
   - @reduxjs/toolkit (root + apps/web)
```

#### Phase 3: フロントエンドパッケージの誤配置検出

```bash
# 1. infrastructure/lambda配下の全.tsファイルをスキャン
# 2. フロントエンドパッケージ（react-dom, next, @radix-ui）の使用を検出
# 3. 許可リスト（report/generator.ts）を除外
```

**検出例:**
```
❌ Found frontend packages imported in infrastructure/lambda:
   - next in api-handler.ts
```

### CI/CD統合

#### pre-commit hook

```bash
# .git/hooks/pre-commit
pnpm run validate:workspace-deps || exit 1
```

#### package.json script

```json
{
  "scripts": {
    "pre-commit": "pnpm run validate:workspace-deps && pnpm run lint && pnpm run typecheck"
  }
}
```

---

## 修正履歴

### 2026-04-02: 初回修正

**修正内容:**

1. **依存関係の再配置**
   - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`: ルート → `apps/web`
   - `@reduxjs/toolkit`, `immer`: ルートから削除（apps/webに既存）
   - `ws`: ルートから削除（infrastructureに既存）
   - `dotenv`: `apps/web/devDependencies` に追加（playwright.config.ts で使用）

2. **ファイル削除**
   - スペース含むファイル: 125ファイル削除
   - パターン: `* 2.ts`, `* 2.md`, `* 2.json` 等

3. **検証スクリプト作成**
   - `scripts/validate-workspace-dependencies.sh`
   - 3フェーズ検証（使用パッケージ、重複、誤配置）
   - CI/CD統合

**修正前のエラー:**
```bash
pnpm run build
# Module not found: Can't resolve '@dnd-kit/core'
# Module not found: Can't resolve '@dnd-kit/sortable'
# Module not found: Can't resolve '@dnd-kit/utilities'
```

**修正後の結果:**
```bash
pnpm run validate:workspace-deps
# ✅ All packages used in apps/web are properly declared
# ⚠️  Found 2 warning(s) (Prisma duplicate - acceptable)
```

**影響:**
- ビルドエラー解消
- 依存関係の明確化
- 今後の再発防止（自動検証）

---

## トラブルシューティング

### 問題: Module not found エラー

**症状:**
```bash
pnpm run build
# Module not found: Can't resolve '<package-name>'
```

**診断手順:**

```bash
# Step 1: パッケージがどこで使われているか確認
grep -rn "from '<package-name>" apps/web/components apps/web/lib --include="*.ts" --include="*.tsx"

# Step 2: package.json で宣言されているか確認
jq '.dependencies["<package-name>"]' apps/web/package.json

# Step 3: ルートに誤配置されていないか確認
jq '.dependencies["<package-name>"]' package.json
```

**修正方法:**

```bash
# Option 1: apps/web に追加
cd apps/web
pnpm install <package-name>

# Option 2: ルートから削除 + apps/web に追加
# package.json を編集してから
pnpm install
```

### 問題: 型解決失敗

**症状:**
```typescript
// Cannot find module '<package-name>' or its corresponding type declarations
import { Component } from '<package-name>';
```

**診断手順:**

```bash
# Step 1: パッケージがインストールされているか確認
ls node_modules/<package-name>

# Step 2: 型定義が含まれているか確認
ls node_modules/<package-name>/types
ls node_modules/@types/<package-name>

# Step 3: package.json で宣言されているか確認
jq '.dependencies["<package-name>"] // .devDependencies["<package-name>"]' apps/web/package.json
```

**修正方法:**

```bash
# パッケージに型定義が含まれている場合
cd apps/web
pnpm install <package-name>

# @types/<package-name> が必要な場合
cd apps/web
pnpm install --save-dev @types/<package-name>
```

### 問題: ビルドは成功するが、ランタイムエラー

**症状:**
```bash
pnpm run build  # ✅ Success
pnpm run start
# Error: Cannot find module '<package-name>'
```

**診断手順:**

```bash
# Step 1: package.json で dependencies に宣言されているか確認
# （devDependencies ではなく dependencies）
jq '.dependencies["<package-name>"]' apps/web/package.json

# Step 2: Next.js の transpilePackages 設定確認
cat apps/web/next.config.js | grep transpilePackages
```

**修正方法:**

```bash
# devDependencies → dependencies に移動
# apps/web/package.json を編集

# Monorepoパッケージの場合、transpilePackages に追加
# apps/web/next.config.js
module.exports = {
  transpilePackages: ['@prance/shared', '@prance/database'],
};
```

### 問題: pnpm install が失敗する

**症状:**
```bash
pnpm install
# npm error code Unknown system error -35
# npm error syscall mkdir
```

**原因:**
- スペース含むディレクトリ（`node_modules/package 2/`）
- ファイルシステムデッドロック（EDEADLK）

**修正方法:**

```bash
# Step 1: スペース含むディレクトリを削除
bash scripts/clean-space-directories.sh

# Step 2: node_modules を完全削除
rm -rf node_modules apps/web/node_modules packages/*/node_modules infrastructure/node_modules

# Step 3: 再インストール
pnpm install
```

### 問題: 検証スクリプトがエラーを報告する

**症状:**
```bash
pnpm run validate:workspace-deps
# ❌ Found packages used in apps/web but declared in root package.json:
#    - <package-name>
```

**修正方法:**

```bash
# Step 1: package.json を編集
# ルート package.json から削除
# apps/web/package.json に追加

# Step 2: 再インストール
pnpm install

# Step 3: 検証
pnpm run validate:workspace-deps
# ✅ All packages used in apps/web are properly declared
```

---

## ベストプラクティス

### 新しい依存関係を追加する時

```bash
# ❌ 間違った方法（ルートから実行）
pnpm install <package-name>

# ✅ 正しい方法（ワークスペースを指定）
pnpm install <package-name> --workspace=apps/web
# または
cd apps/web && pnpm install <package-name>
```

### 依存関係を削除する時

```bash
# Step 1: 使用箇所を確認
grep -rn "from '<package-name>" apps/web --include="*.ts" --include="*.tsx"

# Step 2: 使用されていないことを確認してから削除
cd apps/web
npm uninstall <package-name>

# Step 3: 検証
pnpm run validate:workspace-deps
```

### Monorepoパッケージを参照する時

```json
// apps/web/package.json
{
  "dependencies": {
    "@prance/shared": "*",     // ✅ "*" を使用（バージョン自動解決）
    "@prance/database": "*"
  }
}
```

### 型定義パッケージの配置

```json
// apps/web/package.json
{
  "devDependencies": {
    "@types/node": "^20.11.0",      // ✅ 開発時のみ必要
    "@types/react": "^18.2.0",
    "@types/three": "^0.160.0"
  }
}
```

---

## 関連リソース

### ドキュメント
- [CODING_RULES.md](../../CODING_RULES.md) - コミット前チェックリスト
- [CLAUDE.md](../../CLAUDE.md) - プロジェクト概要
- [apps/CLAUDE.md](../../apps/CLAUDE.md) - フロントエンド開発ガイド
- [infrastructure/CLAUDE.md](../../infrastructure/CLAUDE.md) - インフラ開発ガイド

### スクリプト
- `scripts/validate-workspace-dependencies.sh` - 依存関係検証
- `scripts/clean-space-directories.sh` - スペース含むディレクトリ削除
- `scripts/clean-build.sh` - クリーンビルド

### npm コマンド
```bash
pnpm run validate:workspace-deps  # 依存関係検証
pnpm run build:clean              # クリーンビルド
pnpm run pre-commit               # コミット前チェック
```

---

**最終更新:** 2026-04-02  
**次回レビュー:** 依存関係追加時、ビルドエラー発生時
