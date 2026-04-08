# 【重要】npm → pnpm 移行完了通知

**日付:** 2026-04-04  
**対象:** 開発チーム全員  
**優先度:** 🔴 高（即座に対応が必要）

---

## 📢 概要

Prance Communication Platformのパッケージマネージャーを **npm から pnpm に移行しました**。

**devブランチ** に本日マージ完了し、全ての開発者は次回の `git pull` から pnpm 環境に移行します。

---

## 🎯 移行理由

### パフォーマンス向上

| 指標 | npm | pnpm | 改善率 |
|-----|-----|------|-------|
| インストール時間 | 3-5分 | 1-2分 | **60% 高速化** |
| ディスク使用量 | 1.2GB | 600MB | **50% 削減** |
| Dev Server起動 | 2.1秒 | 1.8秒 | **14% 高速化** |

### 技術的利点

- ✅ **厳密な依存関係管理** - phantom dependencies 防止
- ✅ **Monorepo最適化** - workspace:* プロトコルによる明示的な内部依存
- ✅ **Lambda bundling互換** - hoisted node_modules で CDK と完全互換

---

## 🚨 必須アクション

### 全開発者が実施すべき手順

#### 1. pnpm インストール（初回のみ）

```bash
# Node.js 22+ の場合（推奨）
corepack enable
corepack prepare pnpm@10.32.1 --activate

# または npm 経由
npm install -g pnpm@10.32.1

# インストール確認
pnpm --version
# 期待: 10.32.1
```

#### 2. プロジェクト更新

```bash
# 最新のdevブランチを取得
git checkout dev
git pull origin dev

# 古い node_modules を削除
rm -rf node_modules packages/*/node_modules apps/*/node_modules infrastructure/node_modules

# pnpm でインストール
pnpm install

# 開発サーバー起動確認
pnpm run dev
```

**所要時間:** 約5-10分（初回のみ）

---

## 📝 変更されたコマンド

### 日常開発コマンド

| タスク | 旧 (npm) | 新 (pnpm) |
|-------|----------|-----------|
| **インストール** | `npm install` | `pnpm install` |
| **CI環境** | `npm ci` | `pnpm install --frozen-lockfile` |
| **スクリプト実行** | `npm run dev` | `pnpm run dev` |
| **グローバルツール** | `npx cdk deploy` | `pnpm exec cdk deploy` |
| **パッケージ追加** | `npm install pkg` | `pnpm add pkg` |
| **パッケージ削除** | `npm uninstall pkg` | `pnpm remove pkg` |

### よく使うコマンド例

```bash
# 開発サーバー起動
pnpm run dev

# ビルド
pnpm run build

# テスト実行
pnpm run test:e2e

# Prisma Client生成
cd packages/database && pnpm exec prisma generate

# CDK デプロイ
cd infrastructure && pnpm exec cdk deploy
```

---

## 🛠️ CI/CD・インフラ更新

### GitHub Actions

**更新が必要なファイル:** `.github/workflows/*.yml`

```yaml
# Before
- run: npm ci

# After
- uses: pnpm/action-setup@v2
  with:
    version: 10
- run: pnpm install --frozen-lockfile
```

### Dockerfile

**更新が必要なファイル:** `Dockerfile` (存在する場合)

```dockerfile
# Before
RUN npm ci --only=production

# After
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
RUN pnpm install --prod --frozen-lockfile
```

### DevContainer

**更新が必要なファイル:** `.devcontainer/devcontainer.json` (存在する場合)

```json
{
  "postCreateCommand": "corepack enable && pnpm install"
}
```

---

## ❓ よくある質問

### Q1: npm に戻したい場合はどうすればいいですか？

緊急時は以下のコマンドで即座に npm に戻せます：

```bash
bash scripts/rollback-to-npm.sh
```

または

```bash
git reset --hard 4e66850  # 移行前のコミット
npm install
```

### Q2: pnpm のキャッシュはどこに保存されますか？

`/tmp/pnpm-cache` に保存されます（`.npmrc` で設定済み）。

### Q3: Lambda bundling に影響はありますか？

ありません。`.npmrc` で `shamefully-hoist=true` を設定しており、npm と同じ hoisted node_modules 構造を使用しています。

### Q4: ロックファイルはどうなりますか？

- `package-lock.json` は削除されました（バックアップ: `package-lock.json.backup-before-pnpm`）
- `pnpm-lock.yaml` が新しいロックファイルです（9,681行）

### Q5: workspace:* とは何ですか？

pnpm の workspace プロトコルで、monorepo 内のパッケージ依存を明示的に表現します。

```json
{
  "@prance/database": "workspace:*",
  "@prance/shared": "workspace:*"
}
```

これにより、npm registry から誤って取得することを防ぎます。

---

## 📚 ドキュメント

### 完全ガイド

**包括的移行レポート:**  
[docs/06-infrastructure/NPM_TO_PNPM_MIGRATION_REPORT.md](docs/06-infrastructure/NPM_TO_PNPM_MIGRATION_REPORT.md)

- 移行理由・実施内容
- 検証結果・パフォーマンス改善
- ロールバック手順
- ベストプラクティス

### クイックリファレンス

**更新済みドキュメント:**
- [START_HERE.md](START_HERE.md) - 次回セッション開始手順
- [CLAUDE.md](CLAUDE.md) - プロジェクト概要
- [README.md](README.md) - クイックスタート

**コマンド変換スクリプト:**
- 43/88 シェルスクリプト更新済み
- 117/385 ドキュメント更新済み

---

## 🔍 既知の問題

### pnpm 移行に無関係な既存問題

以下の問題は npm 環境でも同じエラーが発生する既存の問題です（移行とは無関係）：

#### 1. AuthGuestFunction bundling error

**エラー:** `getRateLimitAttemptWindowMs` エクスポート欠損  
**影響:** ゲスト認証Lambda関数のみ  
**ファイル:** `infrastructure/lambda/shared/utils/runtime-config-loader.ts`

#### 2. session-player TypeScript type error

**エラー:** `RefObject<HTMLCanvasElement | null>` 型不一致  
**影響:** Production buildのみ（Dev環境は正常動作）  
**ファイル:** `apps/web/components/session-player/index.tsx:2783`

**これらの問題は別途修正予定です。**

---

## 📞 サポート

### 問題が発生した場合

1. **ドキュメント確認:**  
   [NPM_TO_PNPM_MIGRATION_REPORT.md](docs/06-infrastructure/NPM_TO_PNPM_MIGRATION_REPORT.md) のトラブルシューティングセクション

2. **キャッシュクリア:**
   ```bash
   pnpm store prune
   rm pnpm-lock.yaml
   pnpm install
   ```

3. **緊急ロールバック:**
   ```bash
   bash scripts/rollback-to-npm.sh
   ```

4. **チームに相談:**  
   Slack `#dev-general` チャンネル

---

## ✅ チェックリスト

**移行完了確認:**

- [ ] pnpm 10.32.1 インストール完了（`pnpm --version`）
- [ ] devブランチ最新取得（`git pull origin dev`）
- [ ] node_modules 削除・再インストール（`pnpm install`）
- [ ] 開発サーバー起動確認（`pnpm run dev`）
- [ ] CI/CDパイプライン更新（該当する場合）
- [ ] Dockerfile更新（該当する場合）
- [ ] チーム内共有完了

---

## 🎉 メリットのまとめ

✅ **開発速度向上** - インストール 60% 高速化  
✅ **ディスク節約** - 50% ストレージ削減  
✅ **依存関係の安全性** - phantom dependencies 防止  
✅ **Monorepo最適化** - workspace:* プロトコル  
✅ **Lambda互換性維持** - hoisted node_modules  

---

**重要:** 次回の `git pull` から pnpm 環境に移行します。上記の手順を必ず実施してください。

**質問・問題がある場合:** Slack `#dev-general` チャンネルで相談してください。

---

**作成日:** 2026-04-04  
**作成者:** Claude (Sonnet 4.5)  
**承認者:** [チームリード名]

