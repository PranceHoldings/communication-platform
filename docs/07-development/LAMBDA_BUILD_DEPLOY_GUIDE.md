# Lambda Functions ビルド・デプロイ完全ガイド

**最終更新:** 2026-03-11
**対象:** 開発者、DevOpsエンジニア

---

## 📋 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [ビルドプロセス](#ビルドプロセス)
4. [デプロイプロセス](#デプロイプロセス)
5. [トラブルシューティング](#トラブルシューティング)
6. [CI/CD統合](#cicd統合)

---

## 概要

### Lambda関数の構成

```
infrastructure/lambda/
├── websocket/
│   ├── default/          # WebSocket $default handler (STT/AI/TTS/Video)
│   ├── connect/          # WebSocket $connect handler
│   └── disconnect/       # WebSocket $disconnect handler
├── sessions/
│   ├── analysis/         # Session analysis (Rekognition, audio)
│   ├── create/           # Session creation
│   ├── get/              # Session detail
│   └── list/             # Session list
├── scenarios/            # Scenario management (7 functions)
├── avatars/              # Avatar management (7 functions)
└── shared/               # Shared modules (CRITICAL)
    ├── ai/               # AI processing (Bedrock)
    ├── audio/            # Audio processing (STT/TTS)
    ├── analysis/         # Analysis processors
    ├── config/           # Configuration (defaults.ts, language-config.ts)
    ├── types/            # Type definitions
    ├── utils/            # Utilities (error-logger.ts)
    └── auth/             # Authentication (JWT)
```

### 重要な概念

**🔴 CRITICAL: 共有モジュールの重要性**

Lambda関数は `../../shared/` ディレクトリのモジュールに依存しています。CDK bundling時に自動的にコピーされますが、**以下の条件が必須**：

1. **共有モジュールが正しくビルドされている**（TypeScript → JavaScript）
2. **CDK bundling設定で正しくコピーされる**（`afterBundling` hooks）
3. **Lambda node_modulesに必須SDKがインストールされている**

**欠如すると → Runtime.ImportModuleError → 500エラー → サービス停止**

---

## アーキテクチャ

### ビルドプロセスの全体像

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 開発者がTypeScriptを編集                                   │
│    infrastructure/lambda/websocket/default/index.ts           │
│    infrastructure/lambda/shared/config/defaults.ts            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. pnpm run build (Turborepo)                                 │
│    - infrastructure: tsc (TypeScript → JavaScript)            │
│    - shared: tsc (shared modules compilation)                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Lambda依存関係検証 (pnpm run lambda:validate)               │
│    - node_modules存在確認                                     │
│    - 必須SDK確認 (Azure Speech, ElevenLabs, etc.)            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. CDK Synth (pnpm run cdk -- synth)                          │
│    - CloudFormationテンプレート生成                            │
│    - Lambda関数のentry pointを検証                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. CDK Deploy (pnpm run cdk -- deploy)                        │
│    - Lambda関数ごとにビルド（NodejsFunction）                 │
│    - esbuild bundling                                         │
│    - commandHooks.afterBundling() で共有モジュールコピー      │
│    - node_modules bundling                                    │
│    - ZIP作成 → S3アップロード → Lambda更新                    │
└─────────────────────────────────────────────────────────────┘
```

### CDK Bundling Process

**WebSocket Default Handler の例:**

```typescript
// infrastructure/lib/api-lambda-stack.ts

const websocketDefaultFunction = new nodejs.NodejsFunction(this, 'WebSocketDefaultFunction', {
  entry: path.join(__dirname, '../lambda/websocket/default/index.ts'),
  bundling: {
    minify: props.environment === 'production',
    sourceMap: true,
    target: 'es2020',
    externalModules: [
      'aws-sdk',
      '@aws-sdk/*',
      'microsoft-cognitiveservices-speech-sdk',  // Install from package.json
      'ffmpeg-static',                           // Install from package.json
    ],
    nodeModules: ['microsoft-cognitiveservices-speech-sdk', 'ffmpeg-static'],
    commandHooks: {
      afterBundling(inputDir: string, outputDir: string): string[] {
        return [
          // Copy ALL shared modules (CRITICAL)
          `mkdir -p ${outputDir}/shared`,
          `cp -r /asset-input/infrastructure/lambda/shared/ai ${outputDir}/shared/`,
          `cp -r /asset-input/infrastructure/lambda/shared/audio ${outputDir}/shared/`,
          `cp -r /asset-input/infrastructure/lambda/shared/analysis ${outputDir}/shared/`,
          `cp -r /asset-input/infrastructure/lambda/shared/config ${outputDir}/shared/`,
          `cp -r /asset-input/infrastructure/lambda/shared/utils ${outputDir}/shared/`,
          `cp -r /asset-input/infrastructure/lambda/shared/types ${outputDir}/shared/`,
        ];
      },
    },
  },
});
```

**重要ポイント:**

1. **`externalModules`**: esbuildでバンドルせず、node_modulesから読み込む
2. **`nodeModules`**: package.jsonから明示的にインストールする
3. **`commandHooks.afterBundling`**: バンドル後に共有モジュールをコピー

---

## ビルドプロセス

### 標準ビルドフロー

```bash
# 1. クリーンビルド（推奨：初回・トラブル時）
pnpm run build:clean

# 2. 通常ビルド
pnpm run build

# 3. Lambda依存関係検証
pnpm run lambda:validate

# 4. デプロイ前チェック（全検証）
bash scripts/pre-deploy-lambda-check.sh
```

### Lambda依存関係の管理

#### 必須SDKのインストール

**WebSocket Default Handler:**

```json
// infrastructure/lambda/websocket/default/package.json
{
  "dependencies": {
    "@aws-sdk/client-apigatewaymanagementapi": "^3.0.0",
    "@aws-sdk/client-bedrock-runtime": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "microsoft-cognitiveservices-speech-sdk": "^1.41.1",  // CRITICAL
    "ffmpeg-static": "^5.3.0"                             // CRITICAL
  }
}
```

**インストール:**

```bash
cd infrastructure/lambda/websocket/default
pnpm install
```

#### 破損したnode_modulesの修復

```bash
# 自動修復
pnpm run lambda:fix

# または手動修復
cd infrastructure/lambda/websocket/default
sudo rm -rf node_modules
pnpm install
```

### 共有モジュールのビルド

**共有モジュールは infrastructure/lambda/shared/ に配置:**

```bash
# TypeScriptコンパイル（CDKが自動実行）
cd infrastructure/lambda/shared
pnpm exec tsc
```

**重要:**
- CDK deployが自動的にコンパイルするため、通常は手動実行不要
- ただし、型チェックは事前に実行推奨

---

## デプロイプロセス

### 1. シンプルデプロイ（ビルド済み前提）

```bash
cd infrastructure
./deploy-simple.sh dev
```

**フロー:**
1. ビルド成果物確認
2. 環境変数同期
3. AWS認証確認
4. **Lambda依存関係検証** ← 自動実行
5. CDK Synth
6. CDK Deploy

### 2. クリーンデプロイ（完全再構築）

```bash
cd infrastructure
./clean-deploy.sh dev
```

**フロー:**
1. node_modules完全削除（Lambda含む）
2. ビルドキャッシュ削除
3. 環境変数同期
4. 依存関係再インストール
5. **Lambda依存関係再インストール** ← 自動実行
6. TypeScriptビルド
7. デプロイ

### 3. Lambda関数のみ再デプロイ

```bash
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

**使用タイミング:**
- Lambda関数コード変更時
- 共有モジュール変更時
- 環境変数変更時

### 4. 個別Lambda関数の更新（緊急時）

```bash
# WebSocket Default Handler の例
cd infrastructure/lambda/websocket/default

# 1. 依存関係確認
pnpm install

# 2. ZIPパッケージ作成
zip -r /tmp/websocket-default.zip . -x "*.broken-*" -x ".DS_Store"

# 3. Lambda更新
aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb:///tmp/websocket-default.zip

# 4. 更新完了待機
aws lambda wait function-updated \
  --function-name prance-websocket-default-dev
```

**⚠️ 警告:** この方法はCDKをバイパスするため、緊急時のみ使用。後で正式にCDK経由でデプロイすること。

---

## トラブルシューティング

### Error 1: Runtime.ImportModuleError

**症状:**
```
Cannot find module '../../shared/config/defaults'
```

**原因:**
- 共有モジュールがCDK bundling時にコピーされていない
- CDK bundling設定の `afterBundling` hooksが不完全

**解決策:**

1. **CDK bundling設定を確認:**
   ```typescript
   // infrastructure/lib/api-lambda-stack.ts
   commandHooks: {
     afterBundling(inputDir: string, outputDir: string): string[] {
       return [
         `cp -r /asset-input/infrastructure/lambda/shared/config ${outputDir}/shared/`,
         // 必要なモジュールを全てコピー
       ];
     },
   },
   ```

2. **再デプロイ:**
   ```bash
   cd infrastructure
   pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
   ```

### Error 2: Cannot find module 'microsoft-cognitiveservices-speech-sdk'

**症状:**
```
Runtime.ImportModuleError: Cannot find module 'microsoft-cognitiveservices-speech-sdk'
```

**原因:**
- Lambda関数の `node_modules` が破損または欠如
- `package.json` に定義されているが、インストールされていない

**解決策:**

```bash
# 1. 依存関係検証
pnpm run lambda:validate

# 2. 自動修復
pnpm run lambda:fix

# 3. 再デプロイ
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### Error 3: CDK Synth Failed

**症状:**
```
Other CLIs (PID=...) are currently reading from cdk.out
```

**原因:**
- 別のCDKプロセスが実行中
- cdk.outディレクトリがロックされている

**解決策:**

```bash
# 1. 実行中のプロセスを停止
pkill -f "cdk deploy"
pkill -f "cdk synth"

# 2. cdk.outを削除
rm -rf infrastructure/cdk.out

# 3. 再実行
cd infrastructure
pnpm run cdk -- synth --context environment=dev
```

### Error 4: TypeScript Compilation Error

**症状:**
```
TS2307: Cannot find module '../../shared/config/defaults'
```

**原因:**
- 共有モジュールがビルドされていない
- importパスが間違っている

**解決策:**

```bash
# 1. 共有モジュールのビルド
pnpm run build

# 2. 型チェック
cd infrastructure/lambda/websocket/default
pnpm exec tsc --noEmit

# 3. importパス確認
# 正しい: import { DEFAULTS } from '../../shared/config/defaults';
# 間違い: import { DEFAULTS } from '../shared/config/defaults';
```

---

## CI/CD統合

### GitHub Actions ワークフロー例

```yaml
name: Deploy Lambda Functions

on:
  push:
    branches: [main]
    paths:
      - 'infrastructure/lambda/**'
      - 'infrastructure/lib/**'

jobs:
  deploy-lambda:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build

      - name: Validate Lambda dependencies
        run: pnpm run lambda:validate

      - name: Pre-deploy checks
        run: bash scripts/pre-deploy-lambda-check.sh

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy Lambda functions
        run: |
          cd infrastructure
          pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### npm scriptsの活用

```json
{
  "scripts": {
    "lambda:validate": "bash scripts/validate-lambda-dependencies.sh",
    "lambda:fix": "bash scripts/fix-lambda-node-modules.sh",
    "lambda:build": "bash scripts/build-lambda-functions.sh",
    "lambda:predeploy": "bash scripts/pre-deploy-lambda-check.sh",
    "deploy:lambda": "cd infrastructure && pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never"
  }
}
```

---

## チェックリスト

### デプロイ前チェックリスト

- [ ] `pnpm run build` 成功
- [ ] `pnpm run lambda:validate` 成功
- [ ] `bash scripts/pre-deploy-lambda-check.sh` 成功
- [ ] 環境変数が正しく設定されている（`.env.local`, `infrastructure/.env`）
- [ ] AWS認証情報が設定されている
- [ ] Prisma Clientが生成されている（`pnpm run db:generate`）

### デプロイ後確認

- [ ] Lambda関数がデプロイされた
  ```bash
  aws lambda list-functions --query 'Functions[?contains(FunctionName, `prance`)].FunctionName'
  ```
- [ ] Lambda関数が正常に起動する
  ```bash
  aws lambda invoke --function-name prance-websocket-default-dev --payload '{}' /tmp/test.json
  ```
- [ ] CloudWatch Logsでエラーがない
  ```bash
  aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m
  ```
- [ ] ブラウザでWebSocket接続テスト

---

## 参考資料

- [MEMORY.md Rule 3](../../MEMORY.md) - Lambda依存関係検証の原則
- [ROOT_CAUSE_ANALYSIS_2026-03-11_lambda_sdk_missing.md](../09-progress/ROOT_CAUSE_ANALYSIS_2026-03-11_lambda_sdk_missing.md) - 根本原因分析
- [AWS CDK Documentation - NodejsFunction](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html)

---

**最終更新:** 2026-03-11 09:00 JST
**作成者:** Claude Code
**レビュー:** 必要
