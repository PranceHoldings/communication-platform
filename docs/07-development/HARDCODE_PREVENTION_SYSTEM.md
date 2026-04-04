# ハードコード完全防止システム

**作成日:** 2026-03-19
**ステータス:** 🔴 実装中
**優先度:** CRITICAL

---

## 🔴 根本的な問題

### 失敗の分析

**事実:** 2026-03-19の監査で18箇所以上のハードコードが発見された

**なぜドキュメント・メモリ・チェックスクリプトで防げなかったのか？**

| 防御層 | 実装状況 | 失敗理由 |
|--------|---------|---------|
| ドキュメント | ✅ 完備 | 読まれない、記憶に残らない |
| メモリ | ✅ 記録済み | 参照されない、忘れられる |
| チェックスクリプト | ⚠️ 部分的 | コミット後の検出、パターン不足 |
| ESLint | ❌ 未実装 | リアルタイム警告なし |
| Git pre-commit | ⚠️ 一部 | ハードコード検出機能なし |
| CI/CD | ❌ 未統合 | PRマージ前のブロックなし |

**結論:** 人間（AI）の記憶と注意力に依存する防御は必ず失敗する

---

## 🎯 完全防止システムの設計原則

### 1. Zero Trust原則

**すべてのコードを信頼しない - 自動検証のみを信頼する**

### 2. Defense in Depth（多層防御）

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Deployment Gate (CDK pre-deploy)              │ 🔴 NEW
│ - Lambda関数コード監査                                   │
│ - 環境変数必須チェック                                   │
└─────────────────────────────────────────────────────────┘
         ↓ 通過した場合のみデプロイ
┌─────────────────────────────────────────────────────────┐
│ Layer 3: CI/CD Gate (GitHub Actions)                   │ 🔴 NEW
│ - PRマージ前の自動検証                                   │
│ - マージブロック機能                                     │
└─────────────────────────────────────────────────────────┘
         ↓ 通過した場合のみマージ
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Commit Gate (Git pre-commit hook)             │ ⚠️ 強化
│ - ESLint必須実行                                        │
│ - ハードコード検出スクリプト                             │
└─────────────────────────────────────────────────────────┘
         ↓ 通過した場合のみコミット
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Editor Gate (VSCode + ESLint)                 │ 🔴 NEW
│ - リアルタイムエラー表示                                 │
│ - コード記述時に即座に警告                               │
└─────────────────────────────────────────────────────────┘
```

### 3. Fail Fast原則

**問題を可能な限り早期に検出 - 後工程ほど修正コストが高い**

| 検出タイミング | 修正コスト | 実装状況 |
|---------------|-----------|---------|
| コード記述時 | 1x（最小） | 🔴 未実装 |
| 保存時 | 2x | 🔴 未実装 |
| コミット時 | 5x | ⚠️ 部分的 |
| PR作成時 | 10x | 🔴 未実装 |
| デプロイ時 | 50x | 🔴 未実装 |
| 本番障害 | 1000x（最大） | - |

---

## 🏗️ Layer 1: Editor Gate（最重要）

### 目標: コード記述の瞬間にエラー表示

#### 1.1 ESLintカスタムルール作成

**ファイル:** `scripts/eslint-rules/no-hardcoded-values.js`

**検出パターン:**
1. **S3/CloudFront直接URL**
   ```javascript
   // ❌ 検出
   `https://${bucket}.s3.amazonaws.com/${key}`
   `https://${bucket}.s3.us-east-1.amazonaws.com/${key}`
   'https://prance-dev-recordings.s3.us-east-1.amazonaws.com/'
   ```

2. **デフォルト環境値**
   ```javascript
   // ❌ 検出
   process.env.VARIABLE || 'default-value'
   process.env.VARIABLE || 'http://localhost:3000'
   process.env.VARIABLE || 'us-east-1'
   ```

3. **リージョンハードコード**
   ```javascript
   // ❌ 検出
   REGION: 'us-east-1'
   region: 'us-east-1'
   { region: 'eastus' }
   ```

4. **Lambda関数名ハードコード**
   ```javascript
   // ❌ 検出
   FunctionName: 'prance-*-dev'
   ```

**除外パターン:**
```javascript
// ✅ 許可 - defaults.tsの定義
// File: infrastructure/lambda/shared/config/defaults.ts
export const AWS_DEFAULTS = {
  REGION: process.env.AWS_REGION || 'us-east-1',  // 環境変数フォールバック
}

// ✅ 許可 - コメント内
// Example: https://bucket.s3.amazonaws.com/key

// ✅ 許可 - テストモック
// File: **/*.test.ts, **/*.spec.ts
const mockUrl = 'https://test.s3.amazonaws.com/test'
```

#### 1.2 ESLint設定統合

**ファイル:** `.eslintrc.json`

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "plugins": ["local-rules"],
  "rules": {
    "local-rules/no-hardcoded-urls": "error",
    "local-rules/no-hardcoded-regions": "error",
    "local-rules/no-default-env-values": "error",
    "local-rules/require-env-validator": "error"
  },
  "overrides": [
    {
      "files": ["infrastructure/lambda/shared/config/defaults.ts"],
      "rules": {
        "local-rules/no-hardcoded-regions": "off"
      }
    },
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "local-rules/no-hardcoded-urls": "warn"
      }
    }
  ]
}
```

#### 1.3 VSCode設定

**ファイル:** `.vscode/settings.json`

```json
{
  "eslint.validate": ["javascript", "typescript", "typescriptreact"],
  "eslint.run": "onType",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": [
    "apps/web",
    "infrastructure/lambda"
  ],
  "problems.showCurrentInProblemPanel": true
}
```

**効果:**
- ✅ コード記述中にリアルタイムで赤い波線表示
- ✅ 保存時に自動チェック
- ✅ 問題パネルに一覧表示

---

## 🏗️ Layer 2: Commit Gate（強化）

### 目標: コミット時に完全ブロック

#### 2.1 包括的ハードコード検出スクリプト

**ファイル:** `scripts/detect-hardcoded-values.sh`

**検出パターン（強化版）:**

```bash
#!/bin/bash

# S3 URL検出
grep -rn "\.s3\.amazonaws\.com\|\.s3\.[a-z0-9-]*\.amazonaws\.com" \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=.next \
  infrastructure/lambda apps/web

# CloudFront URL検出（具体的なドメイン）
grep -rn "https://[a-z0-9]*\.cloudfront\.net" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  infrastructure/lambda apps/web

# デフォルト値パターン検出
grep -rn "process\.env\.[A-Z_]* || ['\"]" \
  --include="*.ts" --include="*.tsx" \
  --exclude="**/config/defaults.ts" \
  --exclude-dir=node_modules \
  infrastructure/lambda apps/web

# リージョンハードコード検出
grep -rn "REGION.*:.*['\"]us-east-1['\"]" \
  --include="*.ts" \
  --exclude="**/config/defaults.ts" \
  --exclude-dir=node_modules \
  infrastructure/lambda

# Lambda関数名ハードコード検出
grep -rn "FunctionName.*['\"]prance-.*-dev['\"]" \
  --include="*.ts" \
  --exclude-dir=node_modules \
  infrastructure/lambda

# localhost URLハードコード検出
grep -rn "['\"]http://localhost:[0-9]*['\"]" \
  --include="*.ts" --include="*.tsx" \
  --exclude="playwright.config.ts" \
  --exclude-dir=node_modules \
  apps/web
```

**実行結果:**
```
❌ Hardcoded values detected:
  infrastructure/lambda/video-processor.ts:258: https://${bucket}.s3.amazonaws.com
  infrastructure/lambda/defaults.ts:13: REGION: 'us-east-1'

✅ No hardcoded values detected
```

#### 2.2 Git pre-commit hook強化

**ファイル:** `.git/hooks/pre-commit`

```bash
#!/bin/bash

echo "🔍 Pre-commit checks..."

# Step 1: ESLint実行（必須）
echo "Running ESLint..."
pnpm run lint --silent
if [ $? -ne 0 ]; then
  echo "❌ ESLint failed. Fix errors before committing."
  exit 1
fi

# Step 2: ハードコード検出（必須）
echo "Checking for hardcoded values..."
bash scripts/detect-hardcoded-values.sh
if [ $? -ne 0 ]; then
  echo "❌ Hardcoded values detected. Remove them before committing."
  echo "Run: bash scripts/detect-hardcoded-values.sh for details"
  exit 1
fi

# Step 3: 環境変数整合性チェック
echo "Validating environment variables..."
bash scripts/validate-env-consistency.sh
if [ $? -ne 0 ]; then
  echo "❌ Environment variable inconsistency detected."
  exit 1
fi

echo "✅ All pre-commit checks passed"
exit 0
```

**自動インストールスクリプト:**

**ファイル:** `scripts/install-git-hooks.sh`

```bash
#!/bin/bash

echo "Installing Git hooks..."

# pre-commit hook
ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed successfully"
```

---

## 🏗️ Layer 3: CI/CD Gate（新規実装）

### 目標: PRマージ前に完全ブロック

#### 3.1 GitHub Actions Workflow

**ファイル:** `.github/workflows/hardcode-check.yml`

```yaml
name: Hardcode Detection

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

jobs:
  detect-hardcoded-values:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm run lint

      - name: Detect hardcoded values
        run: bash scripts/detect-hardcoded-values.sh

      - name: Validate environment variables
        run: bash scripts/validate-env-consistency.sh

      - name: Generate report
        if: failure()
        run: |
          echo "## ❌ Hardcode Detection Failed" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Hardcoded values were detected in your code." >> $GITHUB_STEP_SUMMARY
          echo "Please fix them before merging." >> $GITHUB_STEP_SUMMARY

      - name: Block merge
        if: failure()
        run: exit 1
```

#### 3.2 ブランチ保護ルール

**GitHub設定（手動）:**

1. Settings → Branches → Branch protection rules
2. Add rule: `main`, `dev`
3. ✅ Require status checks to pass before merging
4. ✅ Require branches to be up to date before merging
5. Status checks: `detect-hardcoded-values`

**効果:**
- ✅ ハードコード検出時にPRマージ不可
- ✅ レビュアーに自動通知
- ✅ CI/CDログで詳細確認可能

---

## 🏗️ Layer 4: Deployment Gate（新規実装）

### 目標: デプロイ前に最終検証

#### 4.1 CDK pre-deploy検証

**ファイル:** `infrastructure/scripts/pre-deploy-check.sh`

```bash
#!/bin/bash

echo "🔍 Pre-deployment checks..."

# Step 1: Lambda関数コード監査
echo "Auditing Lambda function code..."
bash scripts/detect-hardcoded-values.sh infrastructure/lambda
if [ $? -ne 0 ]; then
  echo "❌ Hardcoded values detected in Lambda functions"
  exit 1
fi

# Step 2: 環境変数必須チェック
echo "Validating required environment variables..."
required_vars=(
  "AWS_REGION"
  "DATABASE_URL"
  "S3_BUCKET"
  "CLOUDFRONT_DOMAIN"
  "FRONTEND_URL"
  "ANALYSIS_LAMBDA_FUNCTION_NAME"
)

missing_vars=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo "❌ Missing required environment variables:"
  printf '  - %s\n' "${missing_vars[@]}"
  exit 1
fi

echo "✅ All pre-deployment checks passed"
exit 0
```

#### 4.2 デプロイスクリプト統合

**ファイル:** `infrastructure/deploy.sh`

```bash
#!/bin/bash

# Pre-deployment checks（必須）
bash scripts/pre-deploy-check.sh
if [ $? -ne 0 ]; then
  echo "❌ Pre-deployment checks failed. Deployment aborted."
  exit 1
fi

# CDKデプロイ実行
pnpm run cdk -- deploy "$@"
```

---

## 📊 完全防止システムの実装計画

### Phase 1: 即時実装（今日中） 🔴 CRITICAL

| タスク | 所要時間 | 優先度 |
|--------|---------|--------|
| 1. ESLintカスタムルール作成 | 2時間 | 🔴 CRITICAL |
| 2. 包括的検出スクリプト作成 | 1時間 | 🔴 CRITICAL |
| 3. Git pre-commit hook強化 | 30分 | 🔴 CRITICAL |
| 4. VSCode設定追加 | 15分 | 🔴 CRITICAL |

**合計:** 3時間45分

### Phase 2: CI/CD統合（明日） ⚠️ HIGH

| タスク | 所要時間 | 優先度 |
|--------|---------|--------|
| 5. GitHub Actions Workflow作成 | 1時間 | ⚠️ HIGH |
| 6. ブランチ保護ルール設定 | 15分 | ⚠️ HIGH |
| 7. PRテンプレート更新 | 15分 | ⚠️ HIGH |

**合計:** 1時間30分

### Phase 3: Deployment Gate（2日後） 💡 MEDIUM

| タスク | 所要時間 | 優先度 |
|--------|---------|--------|
| 8. CDK pre-deploy検証スクリプト | 1時間 | 💡 MEDIUM |
| 9. デプロイスクリプト統合 | 30分 | 💡 MEDIUM |
| 10. ドキュメント更新 | 30分 | 💡 MEDIUM |

**合計:** 2時間

---

## ✅ 成功基準

### 定量的指標

| メトリクス | 現在 | 目標 |
|-----------|------|------|
| ハードコード検出時間 | コミット後 | コード記述時（即座） |
| 検出率 | 50% | 100% |
| False Positive率 | N/A | <5% |
| 修正までの時間 | 数日 | 数分 |

### 定性的指標

- ✅ 開発者がハードコードを書いた瞬間にVSCodeで赤い波線表示
- ✅ コミット時に自動ブロック（git commit失敗）
- ✅ PRマージ時に自動ブロック（GitHub Actions失敗）
- ✅ デプロイ時に最終チェック（CDK pre-deploy失敗）

---

## 🧪 検証手順

### テストケース

```typescript
// Test 1: S3直接URL（検出されるべき）
const url = `https://${bucket}.s3.amazonaws.com/${key}`;

// Test 2: デフォルト環境値（検出されるべき）
const region = process.env.AWS_REGION || 'us-east-1';

// Test 3: 正しい方法（検出されないべき）
import { getAwsRegion } from './env-validator';
const region = getAwsRegion();
```

### 実行

```bash
# Step 1: ESLint実行
pnpm run lint

# Step 2: 検出スクリプト実行
bash scripts/detect-hardcoded-values.sh

# Step 3: コミット試行（ブロックされるべき）
git add .
git commit -m "test: hardcoded value"

# Step 4: 修正後にコミット成功
# （修正後）
git commit -m "test: use env-validator"
```

---

## 📚 参考資料

- [ESLint Custom Rules](https://eslint.org/docs/latest/extend/custom-rules)
- [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

---

**最終更新:** 2026-03-19
**次回レビュー:** Phase 1完了後
**担当:** DevOps + All Developers

