# Next.js フロントエンドデプロイガイド

**作成日:** 2026-04-25
**ステータス:** 🔴 必読（本番デプロイ前）

---

## 問題の記録（2026-04-25 発覚）

### 症状

```
GET https://app.prance.jp/_next/static/chunks/webpack-c1350e5b46c8d8ab.js 404
GET https://app.prance.jp/_next/static/css/3e02ea19c67f2267.css 503
```

- ページの HTML は返るが、JS/CSS/フォントがすべて 404/503
- ブラウザでレンダリングが完全に壊れていた

### 根本原因（4点）

#### 原因 1: `NextJsLambdaStack` が CDK アプリからコメントアウト

`infrastructure/bin/app.ts` で `Prance-production-NextJs` スタックが無効化されていた。

```typescript
// import { NextJsLambdaStack } from '../lib/nextjs-lambda-stack'; // Temporarily disabled
```

**結果:** `pnpm run deploy:production` を実行しても Next.js Lambda が更新されない。
フロントエンドが何週間も古いビルドのまま放置されていた。

#### 原因 2: `package-nextjs-lambda.sh` が存在しなかった

`nextjs-lambda-stack.ts` が `/tmp/nextjs-lambda-package` を参照しているが、
このディレクトリを作成するスクリプトが存在しなかった。

```typescript
// nextjs-lambda-stack.ts
const lambdaPackageDir = '/tmp/nextjs-lambda-package'; // ← 誰も作らない
```

**結果:** CDK が Next.js スタックをデプロイしようとすると即エラーになる。

#### 原因 3: `deploy.sh` に Next.js ビルドステップが未統合

`deploy.sh` は Lambda（バックエンド）のビルドと CDK デプロイだけを実行していた。
フロントエンドのビルド（`build-nextjs-standalone.sh` → `package-nextjs-lambda.sh`）が含まれていなかった。

**結果:** デプロイ担当者がビルドステップを知らなければ、古いビルドが使われ続ける。

#### 原因 4: `NEXT_PUBLIC_API_URL` はビルド時に焼き込まれる

Next.js の `NEXT_PUBLIC_*` 環境変数はビルド時に静的に埋め込まれる。
Lambda の環境変数を後から変更しても **バンドルには反映されない**。

```
Lambda env: NEXT_PUBLIC_API_URL=https://api.app.prance.jp  ← 正しい
実際の JS:  [API Client] Base URL: https://ffypxkomg1.execute-api...dev ← dev を指している
```

古いビルドが dev 環境でビルドされていたため、本番 Lambda にデプロイしても dev の API を呼んでいた。

---

## 修正内容（2026-04-25 実装）

### 1. `scripts/package-nextjs-lambda.sh` を新規作成

Next.js standalone ビルドから Lambda デプロイパッケージ（`/tmp/nextjs-lambda-package`）を組み立てるスクリプト。

```
standalone build
  ├── apps/web/.next/standalone/   → パッケージに含める（Node.js サーバー）
  ├── apps/web/.next/static/       → パッケージに含める（静的アセット）
  └── apps/web/public/             → パッケージに含める（public ファイル）
apps/web/lambda.js                 → パッケージに含める（Lambda ハンドラー上書き）
```

### 2. `infrastructure/deploy.sh` を更新

フロントエンドビルドを Step 2 として統合：

```
Step 1: Lambda ビルド準備（依存関係、Prisma、TypeScript）
Step 2: Next.js フロントエンドビルド（build-nextjs-standalone → package-nextjs-lambda）
Step 3: CDK デプロイ（Lambda + Next.js スタック両方）
Step 4: デプロイ後検証（validate-nextjs-deployment.sh）
```

オプション:
- `--skip-build`: Step 1 をスキップ
- `--skip-nextjs`: Step 2 をスキップ（Lambda だけ更新したい場合）

### 3. `infrastructure/bin/app.ts` を更新

`NextJsLambdaStack` のコメントアウトを解除し、依存関係を正しく設定。

### 4. `scripts/validate-nextjs-deployment.sh` を新規作成

デプロイ後の自動検証スクリプト：

- Lambda 最終更新時刻（24時間以上古い場合に警告）
- BUILD_ID 整合性（ローカルビルドと Lambda のビルドが一致するか）
- HTTP ステータス確認（トップページ 200）
- 静的ファイル配信確認（webpack チャンク、CSS が 200 で返るか）
- API クライアント設定確認（`NEXT_PUBLIC_API_URL` が正しい環境を指しているか）

---

## 正しいデプロイ手順

### 通常デプロイ（推奨）

```bash
# Lambda + フロントエンド両方を更新
cd infrastructure
pnpm run deploy:production
```

`deploy.sh production` が自動的に以下を実行する：
1. Prisma Client 生成
2. Next.js ビルド（`build-nextjs-standalone.sh`）
3. Lambda パッケージ作成（`package-nextjs-lambda.sh`）
4. CDK デプロイ（全スタック）
5. デプロイ後検証

### Lambda だけ更新したい場合

```bash
cd infrastructure
pnpm run deploy:lambda              # dev の Lambda だけ更新
# または
pnpm run deploy:production --skip-nextjs  # 本番 Lambda だけ更新
```

### Next.js だけ更新したい場合

```bash
cd infrastructure
pnpm run deploy:nextjs-production   # 本番フロントエンドだけ更新
```

### デプロイ後の検証

```bash
# 本番環境を検証
pnpm run validate:nextjs-production

# 確認事項:
# ✅ Lambda 最終更新が新しい
# ✅ BUILD_ID が一致している
# ✅ トップページが HTTP 200
# ✅ 静的チャンクが HTTP 200（404 なら静的ファイルが含まれていない）
# ✅ API URL が本番エンドポイントを指している
```

---

## よくあるミスと対処法

### 静的ファイルが 404 になる

**原因:** Lambda パッケージに `apps/web/.next/static/` が含まれていない。
standalone ビルドだけでは静的ファイルが含まれないため、`package-nextjs-lambda.sh` が必須。

**対処:**
```bash
bash scripts/build-nextjs-standalone.sh
bash scripts/package-nextjs-lambda.sh
cd infrastructure && pnpm run deploy:nextjs-production
```

### Lambda 環境変数を変えても API URL が変わらない

**原因:** `NEXT_PUBLIC_*` は Next.js がビルド時に静的に埋め込む。
Lambda の環境変数は SSR 時の `process.env` にしか影響しない。

**対処:** 環境変数を変更したら必ず **再ビルド** してデプロイする。

### `CDK の "no changes"` で Lambda が更新されない

**原因:** CDK はアセット（Lambda パッケージ）のハッシュで変更を検出する。
コードを変更していないと「変更なし」と判断される。

**対処:**
```bash
rm -rf /tmp/nextjs-lambda-package
bash scripts/build-nextjs-standalone.sh  # 再ビルドでハッシュ変化
bash scripts/package-nextjs-lambda.sh
cd infrastructure && pnpm run deploy:nextjs-production
```

### dev ビルドが本番に使われていた

**原因:** ローカルで dev 環境向けにビルドしたパッケージが `/tmp/nextjs-lambda-package` に残っていて、
それをそのまま本番にデプロイしてしまった。

**対処:**
```bash
rm -rf /tmp/nextjs-lambda-package       # 古いパッケージを削除
# .env.local に本番の NEXT_PUBLIC_API_URL が設定されていることを確認
grep NEXT_PUBLIC_API_URL .env.local
# → NEXT_PUBLIC_API_URL=https://api.app.prance.jp  であること
bash scripts/build-nextjs-standalone.sh
bash scripts/package-nextjs-lambda.sh
```

---

## アーキテクチャメモ

### Lambda パッケージの構造

```
/tmp/nextjs-lambda-package/
├── apps/web/
│   ├── lambda.js              ← Lambda ハンドラー（カスタム実装）
│   ├── .next/
│   │   ├── standalone/        ← Next.js standalone サーバーコード
│   │   ├── static/            ← JS/CSS/フォント（静的アセット）
│   │   └── required-server-files.json
│   └── public/                ← public ディレクトリ
├── .build-id                  ← 検証用 BUILD_ID
└── node_modules/              ← standalone に含まれる依存関係
```

### 静的ファイルの配信方式

`apps/web/lambda.js` の `serveStaticFile()` が `/_next/static/*` を直接ファイルシステムから返す。
Next.js の SSR サーバーには渡さない（SSR サーバーは静的ファイルを返せないため）。

```javascript
if (urlPath.startsWith('/_next/static/') || ...) {
  const staticResponse = serveStaticFile(urlPath);
  if (staticResponse) return staticResponse;  // ← ここでファイルを返す
}
// 静的ファイルがなければ Next.js サーバーへ
```

---

**最終更新:** 2026-04-25
