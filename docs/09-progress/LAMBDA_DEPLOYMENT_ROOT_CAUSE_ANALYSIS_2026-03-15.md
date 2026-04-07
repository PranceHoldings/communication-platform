# Lambda関数「古いバージョン問題」根本原因分析

**作成日:** 2026-03-15 13:30 JST
**問題:** Lambda関数デプロイ時に古いコードが使用される問題が再発
**ステータス:** 🔴 分析中

---

## 問題の履歴

### 過去の発生（4回以上）

1. **Day 11-12 (2026-03-10-11)**: WebSocket Lambda関数で古いコード
   - `deploy:websocket` スクリプト作成で対応
   - `memory/deployment-rules.md` にルール記載

2. **Day 14 (2026-03-12)**: 環境変数欠如（CLOUDFRONT_DOMAIN等）
   - デプロイ後の検証スクリプト作成

3. **Day 17 (2026-03-15 今回)**: 組織設定デフォルト値が古い
   - `DEFAULT_SETTINGS.showSilenceTimer: true` に変更したがデプロイされず
   - **ユーザー指摘**: 「もう2度とないと言っていたのにまた起きた」

---

## 現在のデプロイフロー

### 1. 標準CDKデプロイ

```bash
cd infrastructure
pnpm exec cdk deploy Prance-dev-ApiLambda
```

**動作:**
1. TypeScriptコンパイル（`tsc`）
2. Lambda関数ごとにesbuildでバンドル
3. S3にアップロード
4. CloudFormationでLambda更新

**問題:**
- ❓ コンパイルが正しく実行されているか
- ❓ キャッシュが影響していないか
- ❓ node_modulesが正しく含まれているか

### 2. WebSocket専用デプロイ

```bash
pnpm run deploy:websocket
# → infrastructure/lambda/websocket/default/build.sh
```

**動作:**
1. TypeScriptコンパイル
2. 依存関係を手動でnode_modulesにインストール
3. zipファイル作成
4. AWS CLIで直接アップロード

**なぜこれが必要？:**
- CDKの標準bundlingでは不十分
- 特定の依存関係（ffmpeg-static等）が含まれない

---

## 根本原因の仮説

### 仮説1: CDK Bundlingキャッシュ問題

**症状:**
- ソースコードを変更してもLambda関数が更新されない
- 再ビルドしても古いコードが使われる

**検証方法:**
```bash
# CDKアセットキャッシュクリア
rm -rf infrastructure/cdk.out
rm -rf infrastructure/.cdk.staging

# 再ビルド
cd infrastructure && pnpm exec cdk deploy Prance-dev-ApiLambda
```

### 仮説2: TypeScriptコンパイルが不完全

**症状:**
- `infrastructure/lib/**/*.js` ファイルが古い
- `pnpm run build` が実行されていない

**検証方法:**
```bash
# インフラのTypeScriptコンパイル状態確認
ls -lh infrastructure/lib/api-lambda-stack.js
cat infrastructure/lib/api-lambda-stack.js | grep "OrganizationSettingsFunction" | head -5

# 再コンパイル
cd infrastructure && rm -rf lib/*.js && pnpm run build
```

### 仮説3: Lambda関数コードのハッシュ不一致

**症状:**
- CloudFormationが「変更なし」と判断
- 実際にはソースコードが変更されている

**検証方法:**
```bash
# Lambda関数のCodeSha256確認
aws lambda get-function --function-name prance-organizations-settings-dev \
  --query 'Configuration.CodeSha256' --output text

# ローカルコードのハッシュ計算
cd infrastructure/lambda/organizations/settings
find . -type f -name "*.ts" -o -name "*.js" | sort | xargs cat | sha256sum
```

### 仮説4: esbuildバンドル設定問題

**症状:**
- 共有モジュールが正しくバンドルされない
- `@prance/shared` からのインポートが失敗

**検証方法:**
```bash
# esbuildの出力確認
cd infrastructure
pnpm exec cdk synth Prance-dev-ApiLambda > /tmp/cdk-synth.yaml
grep -A 20 "OrganizationSettingsFunction" /tmp/cdk-synth.yaml
```

---

## 必須検証手順（デプロイ前）

### Step 1: ソースコード変更確認

```bash
# 変更したファイルの確認
git diff infrastructure/lambda/organizations/settings/index.ts

# 期待: DEFAULT_SETTINGS の変更が表示される
```

### Step 2: TypeScriptコンパイル

```bash
# インフラのビルド
cd infrastructure && pnpm run build

# エラーがないことを確認
echo $?  # 期待: 0
```

### Step 3: CDKキャッシュクリア

```bash
# キャッシュ削除
cd infrastructure
rm -rf cdk.out .cdk.staging

# 再ビルド
pnpm exec cdk synth Prance-dev-ApiLambda
```

### Step 4: デプロイ実行

```bash
# デプロイ
pnpm exec cdk deploy Prance-dev-ApiLambda --require-approval never

# 成功確認
# Output: "UPDATE_COMPLETE" が表示される
```

### Step 5: デプロイ後検証

```bash
# Lambda関数の更新日時確認
aws lambda get-function --function-name prance-organizations-settings-dev \
  --query 'Configuration.LastModified' --output text

# 期待: デプロイ直後の時刻
```

### Step 6: 動作確認

```bash
# ブラウザリフレッシュ（Ctrl+R）
# 設定画面でデフォルト値確認
# コンソールログで値確認
```

---

## 恒久対策案

### 対策1: デプロイ前検証スクリプト強化

```bash
# scripts/pre-lambda-deploy-check.sh (新規作成)
#!/bin/bash

echo "========================================="
echo "Lambda Deployment Pre-Check"
echo "========================================="

# Step 1: ソースコード変更確認
echo "1. Checking source code changes..."
if git diff --quiet HEAD -- infrastructure/lambda/; then
  echo "  ⚠️  No Lambda code changes detected"
else
  echo "  ✅ Lambda code changes detected"
fi

# Step 2: TypeScript compile check
echo "2. Checking TypeScript compilation..."
cd infrastructure
if pnpm run build > /tmp/ts-build.log 2>&1; then
  echo "  ✅ TypeScript compilation successful"
else
  echo "  ❌ TypeScript compilation failed"
  cat /tmp/ts-build.log
  exit 1
fi

# Step 3: CDK cache clean
echo "3. Cleaning CDK cache..."
rm -rf cdk.out .cdk.staging
echo "  ✅ CDK cache cleaned"

# Step 4: CDK synth test
echo "4. Testing CDK synth..."
if pnpm exec cdk synth Prance-dev-ApiLambda > /tmp/cdk-synth.log 2>&1; then
  echo "  ✅ CDK synth successful"
else
  echo "  ❌ CDK synth failed"
  cat /tmp/cdk-synth.log
  exit 1
fi

echo "========================================="
echo "✅ All pre-checks passed"
echo "========================================="
```

### 対策2: デプロイ後検証スクリプト強化

```bash
# scripts/post-lambda-deploy-check.sh (拡張)
#!/bin/bash

FUNCTION_NAME=$1

echo "========================================="
echo "Lambda Deployment Post-Check"
echo "========================================="

# Step 1: LastModified確認
echo "1. Checking LastModified..."
LAST_MODIFIED=$(aws lambda get-function --function-name $FUNCTION_NAME \
  --query 'Configuration.LastModified' --output text)
echo "  LastModified: $LAST_MODIFIED"

# 5分以内に更新されているか確認
CURRENT_TIME=$(date -u +%s)
MODIFIED_TIME=$(date -d "$LAST_MODIFIED" +%s)
DIFF=$((CURRENT_TIME - MODIFIED_TIME))

if [ $DIFF -lt 300 ]; then
  echo "  ✅ Lambda function updated recently ($DIFF seconds ago)"
else
  echo "  ⚠️  Lambda function not updated recently ($DIFF seconds ago)"
fi

# Step 2: CodeSha256確認
echo "2. Checking CodeSha256..."
CODE_SHA=$(aws lambda get-function --function-name $FUNCTION_NAME \
  --query 'Configuration.CodeSha256' --output text)
echo "  CodeSha256: $CODE_SHA"

# Step 3: 環境変数確認
echo "3. Checking environment variables..."
ENV_VARS=$(aws lambda get-function-configuration --function-name $FUNCTION_NAME \
  --query 'Environment.Variables' --output json)
echo "$ENV_VARS" | jq '.'

echo "========================================="
echo "✅ Post-check completed"
echo "========================================="
```

### 対策3: 統一デプロイスクリプト

```bash
# scripts/deploy-lambda-safe.sh (新規作成)
#!/bin/bash

FUNCTION_TYPE=$1  # "api" or "websocket"
STACK_NAME="Prance-dev-ApiLambda"

echo "========================================="
echo "Safe Lambda Deployment"
echo "Function Type: $FUNCTION_TYPE"
echo "========================================="

# Pre-check
bash scripts/pre-lambda-deploy-check.sh
if [ $? -ne 0 ]; then
  echo "❌ Pre-check failed. Aborting deployment."
  exit 1
fi

# Deploy
case $FUNCTION_TYPE in
  api)
    echo "Deploying API Lambda functions..."
    cd infrastructure && pnpm exec cdk deploy $STACK_NAME --require-approval never
    ;;
  websocket)
    echo "Deploying WebSocket Lambda functions..."
    pnpm run deploy:websocket
    ;;
  *)
    echo "❌ Invalid function type: $FUNCTION_TYPE"
    exit 1
    ;;
esac

# Post-check
if [ $FUNCTION_TYPE == "api" ]; then
  bash scripts/post-lambda-deploy-check.sh prance-organizations-settings-dev
elif [ $FUNCTION_TYPE == "websocket" ]; then
  bash scripts/post-lambda-deploy-check.sh prance-websocket-default-dev
fi

echo "========================================="
echo "✅ Safe deployment completed"
echo "========================================="
```

---

## npm scripts統合

```json
{
  "scripts": {
    "lambda:pre-check": "bash scripts/pre-lambda-deploy-check.sh",
    "lambda:post-check": "bash scripts/post-lambda-deploy-check.sh",
    "lambda:deploy-safe": "bash scripts/deploy-lambda-safe.sh"
  }
}
```

**使用方法:**

```bash
# API Lambda関数の安全デプロイ
pnpm run lambda:deploy-safe api

# WebSocket Lambda関数の安全デプロイ
pnpm run lambda:deploy-safe websocket
```

---

## 教訓

### 1. 「2度と起きない」は保証できない

**問題点:**
- 複雑なビルドシステムでは予期しない問題が発生しうる
- 人間の記憶に頼った運用は必ず失敗する

**対策:**
- ✅ 自動検証スクリプトで人間の記憶に頼らない
- ✅ デプロイ前・デプロイ後のチェックを必須化
- ✅ 失敗を想定したフェイルセーフ機構

### 2. デフォルト値の多重管理は禁止

**問題点:**
- Lambda と Frontend で別々に定義
- 変更時に片方を更新し忘れる

**対策:**
- ✅ `@prance/shared/defaults.ts` で統一管理
- ✅ 単一の真実の源（Single Source of Truth）

### 3. ビルドプロセスの透明化

**問題点:**
- CDKがどのようにコードをバンドルしているか不明瞭
- キャッシュの影響が不透明

**対策:**
- ✅ 検証スクリプトでプロセスを可視化
- ✅ デプロイ前にCDKキャッシュをクリア

---

## 次のアクション

1. ✅ デフォルト値の統一管理完了（`@prance/shared/defaults.ts`）
2. ⏳ Lambda関数の再デプロイ
3. ⏳ デプロイ前・後検証スクリプト作成
4. ⏳ 統一デプロイスクリプト作成
5. ⏳ ドキュメント・メモリ更新

---

**最終更新:** 2026-03-15 13:30 JST
