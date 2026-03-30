# Phase 3: Parameter Store移行 & CI/CD統合 - 実装計画

**作成日:** 2026-03-19
**担当:** DevOps Team
**優先度:** Low（1ヶ月以内）
**状態:** 設計完了・実装待ち

---

## 📋 Phase 3概要

**目的:**
1. 機密でない設定値をAWS Systems Manager Parameter Storeへ移行
2. 環境変数検証をGitHub Actions CI/CDパイプラインに統合

**効果:**
- 設定値の一元管理
- 環境別設定の容易な切り替え
- デプロイ前の自動検証
- 本番環境の設定ミス防止

---

## 🎯 Phase 3.1: Parameter Store移行

### 対象変数

**機密でない設定値（Parameter Store推奨）:**

| 変数名 | 現在の場所 | 移行先 | タイプ |
|--------|-----------|--------|--------|
| RATE_LIMIT_MAX_ATTEMPTS | 環境変数 | Parameter Store | String |
| RATE_LIMIT_ATTEMPT_WINDOW | 環境変数 | Parameter Store | String |
| RATE_LIMIT_LOCKOUT_DURATION | 環境変数 | Parameter Store | String |
| STT_LANGUAGE | 環境変数 | Parameter Store | String |
| STT_AUTO_DETECT_LANGUAGES | 環境変数 | Parameter Store | StringList |
| AUDIO_CONTENT_TYPE | 環境変数 | Parameter Store | String |
| VIDEO_CONTENT_TYPE | 環境変数 | Parameter Store | String |
| VIDEO_FORMAT | 環境変数 | Parameter Store | String |
| VIDEO_RESOLUTION | 環境変数 | Parameter Store | String |
| BEDROCK_MODEL_ID | 環境変数 | Parameter Store | String |
| ENABLE_AUTO_ANALYSIS | 環境変数 | Parameter Store | String |

**機密情報（Secrets Manager保持）:**
- DATABASE_URL
- JWT_SECRET
- ELEVENLABS_API_KEY
- AZURE_SPEECH_KEY
- CLOUDFRONT_PRIVATE_KEY（未移行 - Phase 1で対応予定）

---

### Parameter Store階層設計

```
/prance/
├── dev/
│   ├── rate-limit/
│   │   ├── max-attempts         # 5
│   │   ├── attempt-window       # 300
│   │   └── lockout-duration     # 900
│   ├── stt/
│   │   ├── language             # en-US
│   │   └── auto-detect-languages# en-US,ja-JP,zh-CN
│   ├── media/
│   │   ├── audio-content-type   # audio/webm
│   │   ├── video-content-type   # video/webm
│   │   ├── video-format         # webm
│   │   └── video-resolution     # 1280x720
│   ├── ai/
│   │   └── bedrock-model-id     # us.anthropic.claude-sonnet-4-6
│   └── analysis/
│       └── enable-auto-analysis # true
├── production/
│   └── [同じ構造]
└── staging/
    └── [同じ構造]
```

**命名規則:**
- プレフィックス: `/prance/{environment}/`
- スネークケース → ケバブケース（例: `max_attempts` → `max-attempts`）
- 環境ごとに異なる値を設定可能

---

### 実装手順

#### Step 1: Parameter Store作成スクリプト

```bash
#!/bin/bash
# scripts/setup-parameter-store.sh

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi

echo "=== Setting up Parameter Store for $ENVIRONMENT environment ==="

# Rate Limiting
aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/rate-limit/max-attempts" \
  --value "5" \
  --type String \
  --description "Maximum rate limit attempts" \
  --overwrite

aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/rate-limit/attempt-window" \
  --value "300" \
  --type String \
  --description "Rate limit attempt window (seconds)" \
  --overwrite

aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/rate-limit/lockout-duration" \
  --value "900" \
  --type String \
  --description "Rate limit lockout duration (seconds)" \
  --overwrite

# STT Configuration
aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/stt/language" \
  --value "en-US" \
  --type String \
  --description "Default STT language" \
  --overwrite

aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/stt/auto-detect-languages" \
  --value "en-US,ja-JP,zh-CN" \
  --type StringList \
  --description "Auto-detect STT languages" \
  --overwrite

# Media Configuration
aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/media/audio-content-type" \
  --value "audio/webm" \
  --type String \
  --description "Audio content type" \
  --overwrite

aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/media/video-content-type" \
  --value "video/webm" \
  --type String \
  --description "Video content type" \
  --overwrite

aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/media/video-format" \
  --value "webm" \
  --type String \
  --description "Video format" \
  --overwrite

aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/media/video-resolution" \
  --value "1280x720" \
  --type String \
  --description "Video resolution" \
  --overwrite

# AI Configuration
aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/ai/bedrock-model-id" \
  --value "us.anthropic.claude-sonnet-4-6" \
  --type String \
  --description "AWS Bedrock model ID" \
  --overwrite

# Analysis Configuration
aws ssm put-parameter \
  --name "/prance/$ENVIRONMENT/analysis/enable-auto-analysis" \
  --value "true" \
  --type String \
  --description "Enable automatic session analysis" \
  --overwrite

echo "✅ Parameter Store setup complete for $ENVIRONMENT"
```

**実行:**
```bash
chmod +x scripts/setup-parameter-store.sh
bash scripts/setup-parameter-store.sh dev
bash scripts/setup-parameter-store.sh production
```

---

#### Step 2: Lambda関数でのParameter Store読み込み

**共有ユーティリティ作成:**

```typescript
// infrastructure/lambda/shared/config/parameter-store.ts
import { SSMClient, GetParameterCommand, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

/**
 * Get single parameter from Parameter Store
 */
export async function getParameter(name: string): Promise<string> {
  const fullPath = `/prance/${ENVIRONMENT}/${name}`;
  const command = new GetParameterCommand({ Name: fullPath });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value || '';
}

/**
 * Get all parameters under a path
 */
export async function getParametersByPath(path: string): Promise<Record<string, string>> {
  const fullPath = `/prance/${ENVIRONMENT}/${path}`;
  const command = new GetParametersByPathCommand({
    Path: fullPath,
    Recursive: true,
  });

  const response = await ssmClient.send(command);
  const parameters: Record<string, string> = {};

  response.Parameters?.forEach((param) => {
    const key = param.Name?.replace(fullPath + '/', '') || '';
    parameters[key] = param.Value || '';
  });

  return parameters;
}

/**
 * Get rate limiting configuration
 */
export async function getRateLimitConfig() {
  const params = await getParametersByPath('rate-limit');
  return {
    maxAttempts: parseInt(params['max-attempts'] || '5', 10),
    attemptWindow: parseInt(params['attempt-window'] || '300', 10),
    lockoutDuration: parseInt(params['lockout-duration'] || '900', 10),
  };
}

/**
 * Get media configuration
 */
export async function getMediaConfig() {
  const params = await getParametersByPath('media');
  return {
    audioContentType: params['audio-content-type'] || 'audio/webm',
    videoContentType: params['video-content-type'] || 'video/webm',
    videoFormat: params['video-format'] || 'webm',
    videoResolution: params['video-resolution'] || '1280x720',
  };
}
```

**Lambda関数での使用:**

```typescript
// infrastructure/lambda/websocket/default/index.ts
import { getRateLimitConfig, getMediaConfig } from '../../shared/config/parameter-store';

export const handler = async (event: APIGatewayWebSocketEvent) => {
  // Parameter Store から設定を取得（キャッシュ推奨）
  const rateLimitConfig = await getRateLimitConfig();
  const mediaConfig = await getMediaConfig();

  // 設定を使用
  console.log('Rate limit max attempts:', rateLimitConfig.maxAttempts);
  console.log('Video format:', mediaConfig.videoFormat);

  // ... Lambda処理
};
```

**キャッシング戦略:**

```typescript
// キャッシュ (Lambda関数起動時に1回だけ取得)
let rateLimitConfigCache: any = null;

async function getCachedRateLimitConfig() {
  if (!rateLimitConfigCache) {
    rateLimitConfigCache = await getRateLimitConfig();
  }
  return rateLimitConfigCache;
}
```

---

#### Step 3: CDK Stack更新（IAM権限追加）

```typescript
// infrastructure/lib/api-lambda-stack.ts
import * as iam from 'aws-cdk-lib/aws-iam';

// Lambda関数にParameter Store読み取り権限を付与
this.lambdaRole.addToPolicy(new iam.PolicyStatement({
  actions: [
    'ssm:GetParameter',
    'ssm:GetParameters',
    'ssm:GetParametersByPath',
  ],
  resources: [
    `arn:aws:ssm:${this.region}:${this.account}:parameter/prance/${props.environment}/*`,
  ],
}));
```

---

#### Step 4: 移行計画

**段階的移行（リスク最小化）:**

1. **Week 1: Parameter Store作成**
   - Development環境にParameter Store作成
   - 既存環境変数と並行運用

2. **Week 2: Lambda関数更新**
   - Parameter Store読み込みコード追加
   - フォールバック: 環境変数が存在すれば優先

3. **Week 3: Production移行**
   - Production環境にParameter Store作成
   - 動作確認後、環境変数削除

4. **Week 4: クリーンアップ**
   - 旧環境変数削除
   - ドキュメント更新

**フォールバック実装例:**

```typescript
export async function getRateLimitConfig() {
  // Option 1: Parameter Store
  try {
    const params = await getParametersByPath('rate-limit');
    if (params['max-attempts']) {
      return {
        maxAttempts: parseInt(params['max-attempts'], 10),
        attemptWindow: parseInt(params['attempt-window'], 10),
        lockoutDuration: parseInt(params['lockout-duration'], 10),
      };
    }
  } catch (error) {
    console.warn('Failed to fetch from Parameter Store, falling back to env vars', error);
  }

  // Option 2: Environment variables (fallback)
  return {
    maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
    attemptWindow: parseInt(process.env.RATE_LIMIT_ATTEMPT_WINDOW || '300', 10),
    lockoutDuration: parseInt(process.env.RATE_LIMIT_LOCKOUT_DURATION || '900', 10),
  };
}
```

---

## 🔄 Phase 3.2: CI/CD自動チェック統合

### GitHub Actions Workflow作成

```yaml
# .github/workflows/env-validation.yml
name: Environment Variable Validation

on:
  pull_request:
    branches:
      - main
      - dev
    paths:
      - '.env.example'
      - 'apps/**/*.ts'
      - 'apps/**/*.tsx'
      - 'infrastructure/lambda/**/*.ts'

jobs:
  validate-env:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Validate environment variables
        run: bash scripts/validate-env-consistency.sh

      - name: Comment on PR (on failure)
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.name,
              body: '❌ **Environment Variable Validation Failed**\n\nPlease run `bash scripts/validate-env-consistency.sh` locally and fix the issues.'
            })
```

### Pre-deployment Validation

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches:
      - main

jobs:
  pre-deployment-checks:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Validate environment variables
        run: bash scripts/validate-env-consistency.sh

      - name: Validate Lambda dependencies
        run: cd infrastructure && npm run lambda:predeploy

      - name: Validate deployment method
        run: bash scripts/validate-deployment-method.sh

  deploy:
    needs: pre-deployment-checks
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to AWS
        run: cd infrastructure && npm run deploy:production
```

---

## 📊 Phase 3実装スケジュール

| Week | タスク | 担当 | 状態 |
|------|--------|------|------|
| 1 | Parameter Store作成スクリプト作成 | DevOps | ⏳ 未着手 |
| 1 | Development環境にParameter Store作成 | DevOps | ⏳ 未着手 |
| 2 | Lambda共有ユーティリティ実装 | Backend | ⏳ 未着手 |
| 2 | WebSocket Lambda関数更新 | Backend | ⏳ 未着手 |
| 2 | CDK Stack更新（IAM権限） | DevOps | ⏳ 未着手 |
| 3 | Production環境にParameter Store作成 | DevOps | ⏳ 未着手 |
| 3 | Production Lambda関数デプロイ | DevOps | ⏳ 未着手 |
| 3 | 動作確認・テスト | QA | ⏳ 未着手 |
| 4 | 旧環境変数削除 | DevOps | ⏳ 未着手 |
| 4 | GitHub Actions Workflow作成 | DevOps | ⏳ 未着手 |
| 4 | ドキュメント更新 | All | ⏳ 未着手 |

**開始予定:** 2026-04-01
**完了予定:** 2026-04-30

---

## ✅ Phase 3完了基準

- [ ] 全ての設定値がParameter Storeに移行済み
- [ ] Development/Production環境で動作確認完了
- [ ] 旧環境変数が全てCDK/Lambdaから削除済み
- [ ] GitHub Actions Workflow が正常動作
- [ ] ドキュメントが更新済み（CLAUDE.md, infrastructure/CLAUDE.md）
- [ ] チーム全員がParameter Store使用方法を理解

---

## 📚 参考資料

- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Parameter Store Best Practices](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-best-practices.html)

---

**最終更新:** 2026-03-19
**次回レビュー:** Phase 3開始時（2026-04-01予定）
