# ビルドプロセスガイド

**最終更新:** 2026-03-10
**バージョン:** 2.0（クリーンビルドスクリプト対応）

---

## 📋 概要

このドキュメントは、Prance Communication Platformの包括的なビルドプロセスを説明します。

### 3つのビルドレベル

| レベル | 用途 | コマンド | 実行時間 |
|--------|------|---------|---------|
| **通常ビルド** | 日常開発 | `pnpm run build` | 15-25秒 |
| **クリーンビルド** | トラブル時、デプロイ前 | `pnpm run build:clean` | 2-5分 |
| **検証付きデプロイ** | 本番デプロイ | `pnpm run deploy:check` | 1-2分 |

---

## 🔨 通常ビルド

### 使用場面
- コード変更後の動作確認
- ローカル開発中
- CI/CDパイプライン

### 実行方法

```bash
pnpm run build
```

### 内部動作

```
Turbo (並列実行)
├── @prance/shared (TypeScript コンパイル)
├── @prance/database (Prisma Client 生成)
├── @prance/infrastructure (TypeScript コンパイル)
└── @prance/web (Next.js ビルド)
```

### 失敗時の対応

1. **型エラー（TS****）**
   ```bash
   # 詳細確認
   pnpm run typecheck
   ```

2. **モジュール解決エラー（Cannot find module）**
   ```bash
   # 依存関係再インストール
   pnpm install
   ```

3. **キャッシュ問題**
   ```bash
   # クリーンビルドに切り替え
   pnpm run build:clean
   ```

---

## 🧹 クリーンビルド

### 使用場面
- 通常ビルドが失敗する
- デプロイ前の最終確認
- 依存関係の大幅な変更後
- 原因不明のエラー発生時

### 実行方法

```bash
# 推奨: 全自動
pnpm run build:clean

# オプション付き実行
./scripts/clean-build.sh --skip-install  # インストールスキップ
./scripts/clean-build.sh --skip-validation  # 検証スキップ
```

### 実行内容（5ステップ）

#### Step 1: クリーンアップ（30秒）
削除対象:
- `node_modules/` (全workspace)
- `.next/`, `.turbo/` (キャッシュ)
- `dist/`, `lib/*.js` (ビルド成果物)
- `.next.broken-*`, `node_modules.broken-*` (バックアップ)

#### Step 2: 依存関係インストール（1-2分）
```bash
pnpm install  # ルートで実行 → workspaces全体
```

**重要:** Monorepo workspaces構成により、全ての依存関係がルートの`node_modules/`にhoistされます。

#### Step 3: 依存関係検証（10秒）
検証項目:
- ✅ `@aws-sdk/client-lambda`
- ✅ `@types/aws-lambda`
- ✅ `@prisma/client`
- ✅ `typescript`
- ✅ `next`
- ✅ Prisma Client 生成状況

#### Step 4: ビルド実行（15-30秒）
```bash
pnpm run build  # Turboで並列実行
```

エラー検出:
- TypeScriptエラー → 最後の10行表示
- モジュールエラー → 関連行抽出
- ログ保存先: `/tmp/build-output.log`

#### Step 5: ビルド成果物確認（5秒）
検証:
- ✅ `infrastructure/lib/*.js`
- ✅ `apps/web/.next/server/`
- ✅ `packages/shared/tsconfig.tsbuildinfo`

### 成功時の出力例

```
============================================
クリーンビルド完了 🎉
============================================

次のステップ:
  1. 環境変数検証: ./scripts/validate-env.sh
  2. デプロイ前チェック: ./scripts/pre-deploy-check.sh
  3. CDKデプロイ: cd infrastructure && ./deploy.sh dev
```

---

## ✅ デプロイ前チェック

### 使用場面
- CDKデプロイ直前
- 本番環境デプロイ前
- CI/CDパイプラインの最終ステップ

### 実行方法

```bash
# デフォルト（dev環境）
pnpm run deploy:check

# 環境指定
./scripts/pre-deploy-check.sh --environment staging
./scripts/pre-deploy-check.sh --environment production
```

### チェック項目（8カテゴリ）

#### 1. 環境変数検証
- ✅ `.env.local` 存在確認
- ✅ `infrastructure/.env` 存在確認
- ✅ DATABASE_URL（AWS RDS）
- ✅ API URL（AWS API Gateway）
- ✅ 必須環境変数

#### 2. AWS認証確認
- ✅ `aws sts get-caller-identity` 成功
- ✅ Account ID表示

#### 3. ビルド成果物確認
- ✅ `infrastructure/lib/*.js`
- ✅ `apps/web/.next/`

#### 4. Prismaスキーマ変更確認
- ⚠️ 変更検出時はマイグレーション必須手順を表示

#### 5. Git状態確認
- ⚠️ 未コミット変更
- ⚠️ 未プッシュコミット

#### 6. 依存関係整合性
- ✅ 重要パッケージの存在確認

#### 7. Lambda API稼働確認
- ✅ Health endpoint応答

#### 8. CDK Bootstrap確認
- ✅ CDKToolkit スタック存在

### 成功時の出力例

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
デプロイ前チェック完了 ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ 成功: 8
⚠ 警告: 2
✗ 失敗: 0

次のステップ:
  cd infrastructure && ./deploy.sh dev
```

---

## 🔧 トラブルシューティング

### 問題1: node_modules削除失敗（最頻出）

**エラー:**
```
rm: cannot remove 'node_modules': Directory not empty
rm: cannot remove 'node_modules/@aws-sdk': Resource deadlock avoided
```

**原因:**
- ファイルがロックされている
- 破損ファイル
- プロセスが使用中

**解決策（自動対応 - 推奨）:**

```bash
# ✅ 推奨: 自動リトライ＋リネーム戦略
pnpm run build:clean
```

**内部動作（4段階リトライ）:**
1. **Strategy 1:** 通常削除 (`rm -rf`)
2. **Strategy 2:** sudo権限削除 (`sudo rm -rf`)
3. **Strategy 3:** リネーム退避 (`mv → *.broken-<timestamp>`)
4. **Strategy 4:** 個別ファイル削除 + 空ディレクトリ削除

削除できないディレクトリは自動的に`*.broken-<timestamp>`にリネームされます。

**手動対応:**
```bash
# 1. プロセス停止
pkill -f "next dev"
pkill -f "pnpm run dev"

# 2. 破損ファイルのクリーンアップ
pnpm run clean:broken

# 3. クリーンビルド再実行
pnpm run build:clean
```

**詳細:** [TROUBLESHOOTING_NODE_MODULES.md](./TROUBLESHOOTING_NODE_MODULES.md)

### 問題2: TypeScriptエラー（TS2307: Cannot find module）

**エラー例:**
```
error TS2307: Cannot find module '@aws-sdk/client-lambda'
```

**原因:** 依存関係がインストールされていない

**解決策:**
```bash
# クリーンビルド実行
pnpm run build:clean

# または手動対応
pnpm install
pnpm run build
```

### 問題3: Prisma Client未生成

**エラー:**
```
Cannot find module '.prisma/client'
```

**解決策:**
```bash
cd packages/database
pnpm exec prisma generate
cd ../..
pnpm run build
```

### 問題4: ビルドは成功するが、デプロイ時エラー

**原因:** 環境変数が正しく設定されていない

**解決策:**
```bash
# 環境変数検証
./scripts/validate-env.sh

# デプロイ前チェック実行
pnpm run deploy:check
```

### 問題5: 破損ファイル・バックアップディレクトリの蓄積

**症状:**
- ディスク容量が圧迫される
- `*.broken-*`, `*.old-*` ディレクトリが大量にある

**確認:**
```bash
# バックアップディレクトリを確認
find . -name "*.broken-*" -o -name "*.old-*" -type d

# サイズ確認
du -sh *.broken-* *.old-* 2>/dev/null
```

**解決策:**
```bash
# 7日以上前のバックアップのみ削除（推奨）
pnpm run clean:broken

# 全てのバックアップを削除
./scripts/cleanup-broken-files.sh --all

# 確認なしで削除
./scripts/cleanup-broken-files.sh --all --force
```

**予防策:**
- クリーンビルドスクリプトは自動的に7日以上前のバックアップを削除します
- 週1回 `pnpm run clean:broken` を実行することを推奨

**詳細:** [TROUBLESHOOTING_NODE_MODULES.md](./TROUBLESHOOTING_NODE_MODULES.md)

---

## 📊 ビルド時間ベンチマーク

### 通常環境（Codespaces 4-core）

| フェーズ | 初回 | キャッシュあり |
|---------|------|--------------|
| pnpm install | 120秒 | 5秒 |
| shared build | 2秒 | 0.5秒（キャッシュ） |
| infrastructure build | 5秒 | 0.5秒（キャッシュ） |
| web build (Next.js) | 25秒 | 10秒 |
| **合計** | **152秒** | **16秒** |

### クリーンビルド（全削除から）

| ステップ | 所要時間 |
|---------|---------|
| クリーンアップ | 30秒 |
| pnpm install | 120秒 |
| 検証 | 10秒 |
| ビルド | 25秒 |
| 成果物確認 | 5秒 |
| **合計** | **190秒（3分10秒）** |

---

## 🎯 ベストプラクティス

### 日常開発

```bash
# コード変更後
pnpm run build

# エラー時
pnpm run build:clean
```

### デプロイ前

```bash
# 1. クリーンビルド
pnpm run build:clean

# 2. デプロイ前チェック
pnpm run deploy:check

# 3. デプロイ
cd infrastructure && ./deploy.sh dev
```

### CI/CDパイプライン

```yaml
# 推奨フロー
- run: pnpm run build:clean --skip-install
- run: pnpm run deploy:check
- run: cd infrastructure && pnpm run deploy
```

---

## 🔗 関連ドキュメント

- **環境変数管理:** [CLAUDE.md - 環境変数管理の絶対原則](../../CLAUDE.md#環境変数管理の絶対原則)
- **Prismaマイグレーション:** [DATABASE_MIGRATION_CHECKLIST.md](./DATABASE_MIGRATION_CHECKLIST.md)
- **CDKデプロイ:** [docs/08-operations/DEPLOYMENT.md](../08-operations/DEPLOYMENT.md)
- **開発ワークフロー:** [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)

---

## 📝 変更履歴

### v2.1（2026-03-10）
- **破損ファイル対策を強化**
  - 4段階リトライロジック実装
  - 削除失敗時の自動リネーム退避
  - 個別ファイル削除戦略追加
- 破損ファイルクリーンアップスクリプト追加 (`pnpm run clean:broken`)
- トラブルシューティングドキュメント追加
- 7日以上前のバックアップ自動削除

### v2.0（2026-03-10）
- クリーンビルドスクリプト追加
- デプロイ前チェックスクリプト追加
- エラーハンドリング強化
- 依存関係検証の改善

### v1.0（2026-03-06）
- 初版作成
- 基本的なビルドフロー文書化
