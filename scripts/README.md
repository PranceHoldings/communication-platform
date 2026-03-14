# Scripts Directory

**目的:** プロジェクトで使用する自動化スクリプトを集約

---

## 🔴 デプロイスクリプト（最重要）

### WebSocket Lambda関数のデプロイ

```bash
# 手動デプロイスクリプト（推奨）
./scripts/deploy-lambda-websocket-manual.sh

# または npm scripts経由
npm run deploy:websocket
```

**内部で実行される8ステップ:**
1. Prisma Client生成
2. TypeScriptビルド
3. 共有モジュールコピー
4. 依存関係検証
5. ZIPファイル作成
6. ZIP構造検証
7. AWS Lambda デプロイ
8. デプロイ後テスト（5項目）

---

### 他のスタックのデプロイ

```bash
# CDKデプロイラッパー（推奨）
./scripts/cdk-deploy-wrapper.sh <StackName>

# または npm scripts経由
npm run deploy:stack <StackName>
```

**内部で実行される検証:**
- 環境変数検証
- Lambda依存関係検証
- インフラビルド
- デプロイ後テスト

---

## 検証スクリプト

### 事前検証（デプロイ前に実行）

| スクリプト | 目的 | 実行タイミング |
|-----------|------|---------------|
| `validate-env.sh` | 環境変数の存在・形式確認 | デプロイ前（必須） |
| `validate-i18n-system.sh` | next-intl使用禁止チェック | コミット前（必須） |
| `validate-lambda-dependencies.sh` | Lambda依存関係の完全性 | デプロイ前（必須） |
| `validate-lambda-zip.sh` | ZIPファイル構造検証 | デプロイ前 |
| `pre-deploy-lambda-check.sh` | 全検証の統合実行 | デプロイ前（推奨） |

### 事後検証（デプロイ後に実行）

| スクリプト | 目的 | 実行タイミング |
|-----------|------|---------------|
| `post-deploy-lambda-test.sh` | Lambda動作確認（5項目） | デプロイ後（推奨） |
| `validate-lambda-env-vars.sh` | Lambda環境変数確認 | デプロイ後（推奨） |

---

## ビルドスクリプト

| スクリプト | 目的 |
|-----------|------|
| `build-lambda-functions.sh` | Lambda関数のビルド |
| `build-and-deploy.sh` | ビルド + デプロイの統合実行 |
| `clean-build.sh` | クリーンビルド（node_modules削除） |

---

## メンテナンススクリプト

| スクリプト | 目的 |
|-----------|------|
| `fix-lambda-node-modules.sh` | Lambda依存関係の自動修復 |
| `cleanup-broken-files.sh` | 破損ファイルの削除 |
| `clean-space-directories.sh` | 空白含有ディレクトリの削除 |

---

## パフォーマンス・監視スクリプト

| スクリプト | 目的 |
|-----------|------|
| `collect-metrics.sh` | CloudWatchメトリクス収集 |
| `create-cloudwatch-dashboard.sh` | ダッシュボード作成 |
| `create-cloudwatch-alarms.sh` | アラーム作成 |

---

## 整合性チェックスクリプト

| スクリプト | 目的 |
|-----------|------|
| `detect-inconsistencies.sh` | コード不整合の検出 |
| `fix-inconsistencies.sh` | 不整合の自動修正 |

---

## 使用方法

### 1. 最も一般的なケース（WebSocket Lambda デプロイ）

```bash
# ワンコマンドで全自動
npm run deploy:websocket
```

---

### 2. 他のスタックのデプロイ

```bash
# Database スタック
npm run deploy:stack Prance-dev-Database

# Storage スタック
npm run deploy:stack Prance-dev-Storage
```

---

### 3. デプロイ前の事前確認

```bash
# 全検証を一括実行
npm run lambda:predeploy
```

---

### 4. Lambda依存関係が破損した場合

```bash
# 自動修復
npm run lambda:fix

# 修復後の検証
npm run lambda:validate
```

---

### 5. デプロイ後の動作確認

```bash
# 特定のLambda関数をテスト
npm run lambda:test prance-websocket-default-dev

# 環境変数を検証
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev
```

---

## トラブルシューティング

### 問題: "Permission denied" エラー

**解決策:**
```bash
chmod +x scripts/*.sh
```

---

### 問題: Lambda依存関係エラー

**解決策:**
```bash
npm run lambda:fix
npm run lambda:validate
```

---

### 問題: 古いコードがデプロイされている

**原因:** CDKの通常デプロイを使用した

**解決策:**
```bash
npm run deploy:websocket
```

---

## npm scripts一覧

```json
{
  "deploy:websocket": "bash scripts/deploy-lambda-websocket-manual.sh",
  "deploy:stack": "bash scripts/cdk-deploy-wrapper.sh",
  "lambda:validate": "bash scripts/validate-lambda-dependencies.sh",
  "lambda:fix": "bash scripts/fix-lambda-node-modules.sh",
  "lambda:predeploy": "bash scripts/pre-deploy-lambda-check.sh",
  "lambda:test": "bash scripts/post-deploy-lambda-test.sh",
  "env:validate": "bash scripts/validate-env.sh",
  "i18n:validate": "bash scripts/validate-i18n-system.sh"
}
```

---

## 関連ドキュメント

- `docs/07-development/DEPLOYMENT_ENFORCEMENT.md` - デプロイ強制システム
- `docs/07-development/LAMBDA_BUILD_DEPLOY_GUIDE.md` - Lambda専用ガイド
- `memory/deployment-rules.md` - デプロイルール（必読）
- `START_HERE.md` - 次回セッション手順

---

**最終更新:** 2026-03-14
