# ビルド・デプロイクイックガイド

**作成日:** 2026-03-12
**対象:** 開発者
**目的:** エラー無しでスムーズにビルド・デプロイを実行する

---

## 🚀 クイックスタート（推奨）

### すべてを一括実行

```bash
npm run build:deploy
```

**このコマンドは以下を実行します:**
1. ✅ Infrastructureビルド
2. ✅ Lambda依存関係検証
3. ✅ Lambda関数デプロイ

**出力例:**
```
============================================
Build and Deploy - Phase A Refactoring
============================================

[22:50:00] Step 1/3: Building infrastructure...
✓ Infrastructure built successfully
[22:50:05] Step 2/3: Running pre-deployment checks...
✓ All validations passed
[22:50:10] Step 3/3: Deploying Lambda functions...

UPDATE_COMPLETE Prance-dev-ApiLambda

============================================
✅ Build and Deploy Complete
============================================
```

---

## 📝 個別コマンド

### 1. Infrastructureのみビルド

```bash
npm run build:infra
```

**用途:** TypeScriptコンパイルのみ実行（デプロイしない）

**実行内容:**
- `infrastructure/` ディレクトリ内の TypeScript → JavaScript コンパイル
- 型チェック
- 構文エラー検出

### 2. Lambda関数のみビルド

```bash
npm run build:lambda
```

**用途:** Lambda関数の依存関係チェックとビルド

**実行内容:**
- Lambda node_modules 検証
- TypeScript コンパイル
- 共有モジュールチェック

### 3. デプロイ前検証

```bash
npm run lambda:predeploy
```

**用途:** デプロイ前に6項目を検証

**検証項目:**
1. 環境変数設定
2. Lambda依存関係
3. i18n リソース
4. TypeScript コンパイル
5. Prisma Client生成
6. CDK bundling設定

### 4. Lambda関数デプロイ

```bash
npm run deploy:lambda
```

**用途:** Lambda関数のみデプロイ（フロントエンドは含まない）

**デプロイ対象:**
- WebSocket Lambda (default, connect, disconnect)
- REST API Lambdas (auth, scenarios, sessions, etc.)
- Maintenance Lambdas

---

## ⚠️ よくあるエラーと解決方法

### エラー 1: "Missing script: 'build'"

```
npm error Missing script: "build"
```

**原因:** 間違ったディレクトリで実行している

**解決方法:**
```bash
# ❌ 間違い: Lambda関数ディレクトリ内で実行
cd infrastructure/lambda/websocket/default
npm run build  # エラー！

# ✅ 正しい: プロジェクトルートで実行
cd /workspaces/prance-communication-platform
npm run build:infra
```

### エラー 2: "Lambda dependencies missing"

```
ERROR: @azure/speech-sdk not found
```

**原因:** Lambda node_modules が破損している

**解決方法:**
```bash
npm run lambda:fix
npm run build:deploy
```

### エラー 3: "TypeScript compilation error"

```
error TS2304: Cannot find name 'downloadAndCombineChunks'
```

**原因:** インポートが不足している、または型定義エラー

**解決方法:**
```bash
# 1. TypeScriptコンパイルチェック
cd infrastructure/lambda/websocket/default
npx tsc --noEmit

# 2. エラーを修正

# 3. 再ビルド
cd /workspaces/prance-communication-platform
npm run build:infra
```

### エラー 4: "CDK deployment failed"

```
UPDATE_ROLLBACK_COMPLETE
```

**原因:** Lambda関数にバグがある、または設定エラー

**解決方法:**
```bash
# 1. CloudWatch Logsでエラー確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m

# 2. ロールバックされたスタックを再デプロイ
npm run build:deploy
```

---

## 🔧 高度なコマンド

### 全体ビルド（全ワークスペース）

```bash
npm run build
```

**実行内容:**
- apps/web (Next.js)
- packages/shared
- packages/database (Prisma Client生成)
- infrastructure (CDK)

### クリーンビルド

```bash
npm run build:clean
```

**実行内容:**
- node_modules削除
- ビルドキャッシュクリア
- 再インストール
- 再ビルド

### デプロイ前チェック（全項目）

```bash
npm run pre-commit
```

**実行内容:**
- i18n検証
- Lambda依存関係検証
- コード整合性検証
- Lint
- TypeScriptコンパイル

---

## 📊 デプロイ後の確認

### 1. Lambda関数バージョン確認

```bash
aws lambda get-function --function-name prance-websocket-default-dev \
  --query 'Configuration.LastModified' --output text
```

**期待出力:**
```
2026-03-12T22:49:16.000+0000
```

### 2. CloudWatch Logs確認

```bash
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --follow
```

**確認ポイント:**
```
[downloadAndCombineChunks] Found N chunks in S3
[downloadAndCombineChunks] Downloaded chunk-000000.webm: XXXX bytes
[downloadAndCombineChunks] Complete
```

### 3. E2Eテスト

```bash
# 1. Next.js開発サーバー起動
npm run dev

# 2. ブラウザでアクセス
open http://localhost:3000

# 3. セッション開始 → 発話 → AI応答確認
```

---

## 📋 チェックリスト（コミット前）

- [ ] `npm run build:infra` 成功
- [ ] `npm run lambda:predeploy` 成功
- [ ] `npm run build:deploy` 成功
- [ ] CloudWatch Logs確認（エラーなし）
- [ ] E2Eテスト実行（音声再生確認）
- [ ] git add/commit/push

---

## 🆘 サポート

**問題が解決しない場合:**

1. **ログ確認:**
   ```bash
   # ビルドログ
   cat /tmp/infra-build.log

   # デプロイログ
   cat /tmp/predeploy.log
   ```

2. **完全クリーンアップ:**
   ```bash
   npm run clean
   npm run lambda:fix
   npm install
   npm run build:deploy
   ```

3. **Issue報告:**
   - GitHub Issues: https://github.com/anthropics/claude-code/issues
   - エラーメッセージ全文をコピー
   - 実行したコマンドを記載

---

**最終更新:** 2026-03-12
**関連ドキュメント:**
- `START_HERE.md` - セッション開始手順
- `LAMBDA_BUILD_DEPLOY_GUIDE.md` - Lambda詳細ガイド
- `docs/08-operations/DEPLOYMENT.md` - デプロイメント全体
