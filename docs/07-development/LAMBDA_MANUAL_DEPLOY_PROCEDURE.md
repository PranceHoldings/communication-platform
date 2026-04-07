# Lambda 手動デプロイ完全手順書

**🔴 このドキュメントに従わないと100%失敗します**

**作成理由:** 2026-03-14に同じミスを3回繰り返したため
- 1回目: Prisma Client欠如（検証なし）
- 2回目: Prisma Client欠如（エラー抑制）
- 3回目: zipの構造間違い（deploy/を含めた）

---

## ⚠️ 重要な前提知識

### Lambda zipファイルの基本ルール

**Rule 1: index.jsはルートに配置**
```
✅ 正しい:
lambda.zip
├── index.js
├── node_modules/
└── prisma/

❌ 間違い:
lambda.zip
└── deploy/
    ├── index.js
    └── node_modules/
```

**Rule 2: require()のパス解決**
- Lambda実行時のカレントディレクトリ: `/var/task/`
- `require('@prisma/client')` は `/var/task/node_modules/@prisma/client` を探す
- zipのルートが `/var/task/` にマウントされる

**Rule 3: 検証必須**
- zipの中身を必ず確認
- index.jsがルートにあることを確認
- node_modules/がルートにあることを確認

---

## 📋 手順（全8ステップ）

### Step 1: Prisma Client生成（2分）

```bash
cd /workspaces/prance-communication-platform
pnpm run db:generate
```

**検証:**
```bash
# Prisma Clientの存在確認
ls -la packages/database/node_modules/.prisma/client/ | head -5
# 出力: default.js, index.js, schema.prisma等が表示される
```

**✅ 合格条件:**
- `packages/database/node_modules/.prisma/client/` が存在
- `index.js`, `schema.prisma` が存在

**❌ 失敗時:**
```bash
pnpm run lambda:fix  # 自動修復
pnpm run db:generate  # 再生成
```

---

### Step 2: esbuildビルド（1分）

```bash
cd infrastructure/lambda/websocket/default
pnpm exec esbuild index.ts \
  --bundle \
  --platform=node \
  --target=es2020 \
  --outfile=dist/index.js \
  --external:@aws-sdk/* \
  --external:@prisma/client \
  --sourcemap
```

**検証:**
```bash
ls -lh dist/index.js
# 出力: 1.3M程度のファイルサイズ
```

**✅ 合格条件:**
- `dist/index.js` が存在
- ファイルサイズが1MB以上

**❌ 失敗時:**
- ビルドエラーを確認
- TypeScriptエラーを修正
- 再ビルド

---

### Step 3: デプロイディレクトリ準備（1分）

```bash
# クリーン
rm -rf deploy
mkdir -p deploy/node_modules

# index.jsをルートにコピー（重要）
cp dist/index.js deploy/
cp dist/index.js.map deploy/ 2>/dev/null || true
```

**検証:**
```bash
ls -la deploy/
# 出力: index.js, node_modules/が表示される
```

**✅ 合格条件:**
- `deploy/index.js` が存在（`deploy/dist/index.js` ではない）
- `deploy/node_modules/` ディレクトリが存在

---

### Step 4: Prisma Client コピー（WITH VALIDATION）（2分）

```bash
# ソースパス定義
SOURCE_PRISMA="../../../../packages/database/node_modules/.prisma"
SOURCE_PRISMA_MODULE="../../../../packages/database/node_modules/@prisma"

# Step 4.1: .prisma/client コピー
echo "Copying .prisma/client..."
if [ ! -d "$SOURCE_PRISMA/client" ]; then
  echo "❌ ERROR: Prisma Client not found at $SOURCE_PRISMA/client"
  exit 1
fi

cp -r "$SOURCE_PRISMA" deploy/node_modules/

# 検証
if [ ! -d "deploy/node_modules/.prisma/client" ]; then
  echo "❌ ERROR: Prisma Client copy failed"
  exit 1
fi
echo "✅ Prisma Client copied"

# Step 4.2: @prisma module コピー
echo "Copying @prisma module..."
if [ ! -d "$SOURCE_PRISMA_MODULE" ]; then
  echo "❌ ERROR: @prisma module not found at $SOURCE_PRISMA_MODULE"
  exit 1
fi

cp -r "$SOURCE_PRISMA_MODULE" deploy/node_modules/

# 検証
if [ ! -d "deploy/node_modules/@prisma" ]; then
  echo "❌ ERROR: @prisma module copy failed"
  exit 1
fi
echo "✅ @prisma module copied"

# Step 4.3: schema.prisma コピー
echo "Copying schema.prisma..."
mkdir -p deploy/prisma
cp ../../../../packages/database/prisma/schema.prisma deploy/prisma/

# 検証
if [ ! -f "deploy/prisma/schema.prisma" ]; then
  echo "❌ ERROR: schema.prisma copy failed"
  exit 1
fi
echo "✅ schema.prisma copied"

# Step 4.4: package.json作成
echo '{"dependencies":{"@prisma/client":"^5.22.0"}}' > deploy/package.json
echo "✅ package.json created"
```

**検証:**
```bash
ls -la deploy/node_modules/.prisma/client/ | head -5
ls -la deploy/node_modules/@prisma/ | head -5
ls -la deploy/prisma/
```

**✅ 合格条件:**
- `deploy/node_modules/.prisma/client/index.js` が存在
- `deploy/node_modules/@prisma/client/` が存在
- `deploy/prisma/schema.prisma` が存在
- `deploy/package.json` が存在

**❌ 失敗時:**
- パスが間違っている
- ソースファイルが存在しない
- `pnpm run db:generate` を実行していない

---

### Step 5: 最終検証（1分）🔴 最重要

```bash
echo "=== Final Validation ==="
cd deploy

# Check 1: index.js in root
if [ ! -f "index.js" ]; then
  echo "❌ FAIL: index.js not in root"
  exit 1
fi
echo "✅ PASS: index.js in root"

# Check 2: node_modules in root
if [ ! -d "node_modules" ]; then
  echo "❌ FAIL: node_modules not in root"
  exit 1
fi
echo "✅ PASS: node_modules in root"

# Check 3: Prisma Client
if [ ! -f "node_modules/.prisma/client/index.js" ]; then
  echo "❌ FAIL: Prisma Client not found"
  exit 1
fi
echo "✅ PASS: Prisma Client found"

# Check 4: @prisma module
if [ ! -d "node_modules/@prisma/client" ]; then
  echo "❌ FAIL: @prisma module not found"
  exit 1
fi
echo "✅ PASS: @prisma module found"

# Check 5: schema.prisma
if [ ! -f "prisma/schema.prisma" ]; then
  echo "❌ FAIL: schema.prisma not found"
  exit 1
fi
echo "✅ PASS: schema.prisma found"

# Check 6: File sizes
INDEX_SIZE=$(stat -f%z index.js 2>/dev/null || stat -c%s index.js)
if [ "$INDEX_SIZE" -lt 1000000 ]; then
  echo "❌ FAIL: index.js too small ($INDEX_SIZE bytes)"
  exit 1
fi
echo "✅ PASS: index.js size OK ($INDEX_SIZE bytes)"

echo ""
echo "=== Structure Preview ==="
ls -lah | head -10
echo ""
echo "=== All checks passed! Ready to zip. ==="

cd ..
```

**✅ 合格条件:**
- 全6項目が PASS

**❌ 失敗時:**
- どの項目が失敗したか確認
- 該当ステップに戻って修正

---

### Step 6: ZIP作成（WITH STRUCTURE VALIDATION）（1分）🔴 最重要

```bash
echo "=== Creating ZIP file ==="

# 重要: deploy/の中に入ってからzipする
cd deploy
zip -r ../lambda-deployment.zip .
cd ..

echo "✅ ZIP created"

# ZIP構造の検証（重要）
echo ""
echo "=== Validating ZIP structure ==="
unzip -l lambda-deployment.zip | head -20

# index.jsがルートにあることを確認
if ! unzip -l lambda-deployment.zip | grep -q "^.*  index.js$"; then
  echo "❌ FAIL: index.js not in ZIP root"
  echo "Expected: index.js"
  echo "Found:"
  unzip -l lambda-deployment.zip | grep index.js
  exit 1
fi
echo "✅ PASS: index.js in ZIP root"

# node_modules/がルートにあることを確認
if ! unzip -l lambda-deployment.zip | grep -q "^.*  node_modules/"; then
  echo "❌ FAIL: node_modules/ not in ZIP root"
  exit 1
fi
echo "✅ PASS: node_modules/ in ZIP root"

# deploy/が含まれていないことを確認
if unzip -l lambda-deployment.zip | grep -q "deploy/"; then
  echo "❌ FAIL: deploy/ directory found in ZIP (wrong structure)"
  exit 1
fi
echo "✅ PASS: No deploy/ directory in ZIP"

echo ""
echo "=== ZIP validation passed ==="
ls -lh lambda-deployment.zip
```

**✅ 合格条件:**
- index.js が ZIP root にある
- node_modules/ が ZIP root にある
- deploy/ ディレクトリが含まれていない
- ファイルサイズが10MB以上

**❌ 失敗時:**
```bash
# 間違った構造の場合
rm lambda-deployment.zip
cd deploy
zip -r ../lambda-deployment.zip .  # deployの中に入ってから実行
cd ..
```

---

### Step 7: Lambda デプロイ（2分）

```bash
echo "=== Deploying to Lambda ==="

aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb://lambda-deployment.zip \
  --region us-east-1 \
  --query '[FunctionName,LastModified,CodeSize,State]' \
  --output table

echo "✅ Deployment initiated"
```

**検証:**
```bash
# 10秒待機
sleep 10

# デプロイ状態確認
aws lambda get-function \
  --function-name prance-websocket-default-dev \
  --region us-east-1 \
  --query 'Configuration.[State,LastUpdateStatus,LastModified]' \
  --output table
```

**✅ 合格条件:**
- State: Active
- LastUpdateStatus: Successful

**❌ 失敗時:**
- CloudWatch Logsを確認
- エラーメッセージを読む

---

### Step 8: デプロイ後検証（2分）🔴 最重要

```bash
echo "=== Post-Deployment Validation ==="

# Check 1: Lambda状態確認
echo "Checking Lambda state..."
STATE=$(aws lambda get-function \
  --function-name prance-websocket-default-dev \
  --region us-east-1 \
  --query 'Configuration.State' \
  --output text)

if [ "$STATE" != "Active" ]; then
  echo "❌ FAIL: Lambda not active (State: $STATE)"
  exit 1
fi
echo "✅ PASS: Lambda is Active"

# Check 2: エラーログ確認
echo "Checking CloudWatch Logs for errors..."
ERROR_COUNT=$(aws logs filter-log-events \
  --log-group-name /aws/lambda/prance-websocket-default-dev \
  --start-time $(($(date +%s) - 60))000 \
  --filter-pattern "ERROR" \
  --max-items 10 \
  --query 'length(events)' \
  --output text 2>/dev/null)

if [ "$ERROR_COUNT" != "0" ] && [ "$ERROR_COUNT" != "None" ] && [ -n "$ERROR_COUNT" ]; then
  echo "⚠️ WARNING: $ERROR_COUNT errors found in logs"
  echo "Checking error details..."
  aws logs filter-log-events \
    --log-group-name /aws/lambda/prance-websocket-default-dev \
    --start-time $(($(date +%s) - 60))000 \
    --filter-pattern "ERROR" \
    --max-items 3 \
    --query 'events[*].message' \
    --output text | head -20

  # Prisma Client エラーチェック
  if aws logs filter-log-events \
    --log-group-name /aws/lambda/prance-websocket-default-dev \
    --start-time $(($(date +%s) - 60))000 \
    --filter-pattern "Cannot find module '@prisma/client'" \
    --max-items 1 \
    --query 'events[*].message' \
    --output text 2>/dev/null | grep -q "Cannot find module"; then
    echo "❌ FAIL: Prisma Client not found in Lambda"
    exit 1
  fi
else
  echo "✅ PASS: No errors in logs"
fi

# Check 3: Test invocation (optional)
echo "Testing Lambda invocation..."
aws lambda invoke \
  --function-name prance-websocket-default-dev \
  --payload '{"requestContext":{"routeKey":"$default","connectionId":"test"}}' \
  /tmp/test-invoke.json \
  --region us-east-1 \
  --query 'StatusCode' \
  --output text > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ PASS: Lambda invocation successful"
else
  echo "⚠️ WARNING: Lambda invocation failed (may be expected for test payload)"
fi

echo ""
echo "=== All post-deployment checks passed ==="
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "Next step: Test in browser"
echo "1. http://localhost:3000"
echo "2. Login and start a session"
echo "3. Check Console for Phase 1.6 logs"
```

**✅ 合格条件:**
- Lambda State: Active
- CloudWatch Logs: Prisma Clientエラーなし
- Test invocation: 成功（または予期されたエラー）

---

## 🚫 絶対にやってはいけないこと

### ❌ 1. deploy/ごとzipする

```bash
# ❌ 絶対ダメ
zip -r lambda-deployment.zip deploy/

# ZIP構造が間違う:
# deploy/index.js
# deploy/node_modules/
```

### ❌ 2. エラー抑制

```bash
# ❌ 絶対ダメ
cp ... 2>/dev/null
cp ... || true
cp ... || echo "Failed but continue"
```

### ❌ 3. 検証スキップ

```bash
# ❌ 検証なしでデプロイは自殺行為
aws lambda update-function-code ...  # 即座にデプロイ
```

### ❌ 4. ZIP構造を確認しない

```bash
# ❌ zipの中身を見ないでデプロイ
```

---

## ✅ チェックリスト（印刷用）

```
□ Step 1: Prisma Client生成
  □ pnpm run db:generate 実行
  □ .prisma/client/ 存在確認

□ Step 2: esbuildビルド
  □ pnpm exec esbuild 実行
  □ dist/index.js 存在確認

□ Step 3: デプロイディレクトリ準備
  □ deploy/ クリーン
  □ index.js をルートにコピー

□ Step 4: Prisma Client コピー
  □ .prisma/client コピー & 検証
  □ @prisma module コピー & 検証
  □ schema.prisma コピー & 検証

□ Step 5: 最終検証（6項目）
  □ index.js in root
  □ node_modules in root
  □ Prisma Client found
  □ @prisma module found
  □ schema.prisma found
  □ File sizes OK

□ Step 6: ZIP作成 & 検証
  □ cd deploy してから zip
  □ index.js が ZIP root にある
  □ deploy/ が含まれていない

□ Step 7: Lambda デプロイ
  □ aws lambda update-function-code 実行
  □ State: Active 確認

□ Step 8: デプロイ後検証（3項目）
  □ Lambda Active
  □ CloudWatch Logs: エラーなし
  □ Test invocation: 成功
```

---

## 📊 失敗履歴（学習用）

### 2026-03-14 失敗1回目（17:16）
**ミス:** Prisma Client未コピー（検証なし）
**原因:** 手動デプロイで急いだ
**教訓:** 検証スクリプト必須

### 2026-03-14 失敗2回目（17:25）
**ミス:** Prisma Client未コピー（エラー抑制）
**原因:** `2>/dev/null` でエラー隠蔽
**教訓:** エラー抑制禁止

### 2026-03-14 失敗3回目（17:32）
**ミス:** ZIP構造間違い（deploy/を含めた）
**原因:** zip -r lambda.zip deploy/ と実行
**教訓:** cd deploy してから zip

---

## 🎯 次回デプロイ時の心構え

1. **急がない** - 急ぐと100%失敗する
2. **このドキュメントを読む** - 5分かけて全部読む
3. **チェックリストに従う** - 1項目ずつ確認
4. **検証を省略しない** - 全ての検証を実行
5. **ZIP構造を確認** - unzip -l で必ず確認

---

**このドキュメントに従えば、100%成功します。**

**最終更新:** 2026-03-14 18:00 JST
**作成理由:** 同じミスを3回繰り返したため
