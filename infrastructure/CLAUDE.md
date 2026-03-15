# Prance Communication Platform - Infrastructure Guide

**親ドキュメント:** [../CLAUDE.md](../CLAUDE.md)
**関連ドキュメント:** [../apps/CLAUDE.md](../apps/CLAUDE.md) | [../scripts/CLAUDE.md](../scripts/CLAUDE.md)

**バージョン:** 1.0
**最終更新:** 2026-03-15

---

## 📋 このディレクトリについて

`infrastructure/` ディレクトリはAWSインフラ定義とLambda関数を含みます：

- **bin/** - CDK App エントリーポイント
- **lib/** - CDK Stack定義（VPC, Lambda, DynamoDB, S3等）
- **lambda/** - Lambda関数ソースコード
- **scripts/** - デプロイ・検証スクリプト

---

## 🔴 インフラ開発の絶対厳守ルール

### Rule 1: Lambda関数デプロイメント原則

**🔴 最重要: Lambda関数デプロイはCDK経由のみ。手動zipアップロード絶対禁止**

**❌ 絶対禁止事項:**

```bash
# 手動zipアップロード（絶対に実行してはいけない）
cd infrastructure/lambda/websocket/default
zip -r lambda-deployment.zip .
aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb://lambda-deployment.zip
```

**理由:**
- TypeScriptファイル（.ts）がそのままzipされる
- esbuildによるトランスパイル（TypeScript → JavaScript）がスキップされる
- Lambda Runtimeは`.js`ファイルを期待するが、`.ts`ファイルしかない
- 結果: `Runtime.ImportModuleError: Cannot find module 'index'`

**✅ 正しいデプロイ方法（唯一の方法）:**

```bash
# WebSocket Lambda関数のデプロイ
cd infrastructure
npm run deploy:lambda

# CDKが自動的に実行する処理:
# 1. esbuildでトランスパイル (index.ts → index.js)
# 2. 依存関係のbundling
# 3. 共有モジュール・ネイティブ依存関係のコピー
# 4. 最適化されたzipファイル生成
# 5. Lambda関数への自動アップロード
```

**CDKが「no changes」と判断した場合の対処:**

```bash
# Option 1: ソースコードに小さな変更を加える（推奨）
# index.ts のコメントに現在時刻（秒まで）を追加
# Last updated: 2026-03-15 07:50:43 UTC

# Option 2: CDKキャッシュクリア
rm -rf infrastructure/cdk.out/

# 再デプロイ
cd infrastructure && npm run deploy:lambda
```

**デプロイ前の検証:**

```bash
# 手動zipファイルが存在しないか確認
bash scripts/validate-deployment-method.sh

# 期待される結果:
# ✅ All validations passed
# ❌ Manual zip files detected → 削除してからデプロイ
```

**チェックリスト:**

- [ ] CDK経由でデプロイしている？（`npm run deploy:lambda`）
- [ ] 手動zipファイルが存在しない？（`validate-deployment-method.sh`実行）
- [ ] デプロイ後、Lambda関数のLastModifiedタイムスタンプを確認？
- [ ] CloudWatch Logsでエラーがないか確認？

### Rule 2: Prismaスキーマ変更時の必須手順

**条件:** `packages/database/prisma/schema.prisma` を変更した場合

**✅ 必須実行手順（この順序で実行）:**

```bash
# Step 1: マイグレーションファイル生成
cd packages/database
npx prisma migrate dev --name <変更内容の説明>

# Step 2: Prisma Client再生成
npx prisma generate

# Step 3: Lambda関数デプロイ（マイグレーション適用）
cd ../../infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# Step 4: データベースマイグレーション実行
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json
cat /tmp/migration-result.json

# Step 5: マイグレーション成功確認
aws lambda invoke --function-name prance-sessions-get-dev \
  --payload '{"pathParameters":{"id":"test"}}' /tmp/test-result.json
# エラーがなければ成功
```

**チェックリスト:**

- [ ] `prisma migrate dev` 実行済み？
- [ ] `prisma generate` 実行済み？
- [ ] Lambda関数デプロイ済み？
- [ ] データベースマイグレーション実行済み？
- [ ] 動作確認済み？

### Rule 3: 環境変数管理

**🔴 最重要: このプロジェクトはAWS RDS Aurora Serverless v2専用です**

ローカルPostgreSQLは一切使用しません。全てのデータベース操作はAWS RDS経由で行います。

**❌ 絶対にやってはいけないこと:**

```bash
# ローカルPostgreSQLへの接続文字列
DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"
DATABASE_URL="postgresql://*@localhost/*"
```

**✅ 正しい設定:**

```bash
# AWS RDS Aurora Serverless v2への接続
DATABASE_URL="postgresql://pranceadmin:PASSWORD@*.cluster-*.us-east-1.rds.amazonaws.com:5432/prance"
```

**必須検証手順:**

```bash
# 環境変数が正しく設定されているか検証
./scripts/validate-env.sh

# コミット前に必ず実行
git add . && ./scripts/validate-env.sh && git commit -m "..."
```

**更新が必要なファイル:**

1. `.env.local` - プロジェクトルート
2. `infrastructure/.env` - インフラディレクトリ

**環境変数変更時の必須確認:**

```bash
# Step 1: 検証スクリプト実行
./scripts/validate-env.sh

# Step 2: Next.js再起動
pkill -f "next dev"
npm run dev

# Step 3: Lambda関数への反映
cd infrastructure
./deploy.sh dev
```

### Rule 4: Lambda依存関係検証

**🔴 デプロイ前に必須SDK検証、欠如=本番500エラー=サービス停止**

**必須手順:**

```bash
# デプロイ前に必ず実行
cd infrastructure
npm run lambda:predeploy

# 破損時は修復
npm run lambda:fix

# クリーンビルド時はLambda node_modulesも再インストール
```

**検証される依存関係:**

- AWS SDK (@aws-sdk/*)
- Azure Speech SDK (microsoft-cognitiveservices-speech-sdk)
- Prisma Client (@prisma/client)
- 共有モジュール (shared/config, shared/utils)

---

## 💎 重要な設計原則

### 1. サーバーレス最適化

**コールドスタート対策:**

```typescript
// Provisioned Concurrency（重要API）
this.websocketFunction = new nodejs.NodejsFunction(this, 'WebSocketFunction', {
  // ...
  reservedConcurrentExecutions: 5,  // 常に5インスタンスを待機
});
```

**Lambda最適化:**

- **メモリ適正化**: 512MB-1024MB（メモリに比例してCPU性能も向上）
- **ARM64 (Graviton2) 使用**: x86_64より約20%高速・安価

```typescript
// Lambda関数定義
new nodejs.NodejsFunction(this, 'Function', {
  runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,  // ✅ ARM64
  memorySize: 512,  // ✅ 適切なメモリサイズ
});
```

**非同期処理:**

- **Step Functions**: 長時間処理（15分以上）を分割
- **SQS**: バッファリング・リトライ

```typescript
// Step Functions で長時間処理を分割
const processingStateMachine = new sfn.StateMachine(this, 'ProcessingStateMachine', {
  definition: chain,
  timeout: cdk.Duration.hours(1),
});
```

**コスト最適化:**

- 使用量ベース課金
- アイドル時コスト最小化（月間1000セッション: $500-800）
- Aurora Serverless v2: 使用時のみ課金

### 2. セキュリティ

**認証・認可:**

```typescript
// Cognito User Pool
const userPool = new cognito.UserPool(this, 'UserPool', {
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
  mfa: cognito.Mfa.OPTIONAL,
});

// Lambda Authorizer
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
  cognitoUserPools: [userPool],
});
```

**データ暗号化:**

```typescript
// S3 (SSE-KMS)
const bucket = new s3.Bucket(this, 'Bucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: kmsKey,
});

// Aurora (暗号化DB)
const cluster = new rds.DatabaseCluster(this, 'Cluster', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_15_4,
  }),
  storageEncrypted: true,
  storageEncryptionKey: kmsKey,
});
```

**最小権限の原則:**

```typescript
// IAMロール
const lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
  ],
});

// 必要な権限のみ付与
bucket.grantRead(lambdaRole);
table.grantReadWriteData(lambdaRole);
```

**Secrets Manager:**

```typescript
// 機密情報はSecrets Managerから取得
const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'pranceadmin' }),
    generateStringKey: 'password',
    excludePunctuation: true,
  },
});
```

**監査ログ:**

- CloudTrail: 全API呼び出しを記録
- アクセスログ: S3, API Gateway, CloudFrontのアクセスログ保持

---

## 🏗️ CDK Stack構成

### Stack一覧

```
Prance-dev-Network          # VPC, Subnets, NAT Gateway
Prance-dev-Cognito          # User Pool, 認証
Prance-dev-Database         # Aurora Serverless v2
Prance-dev-Storage          # S3 Buckets, CloudFront
Prance-dev-DynamoDB         # セッション状態、接続管理
Prance-dev-ApiGateway       # REST API, WebSocket API
Prance-dev-ApiLambda        # Lambda関数（20+ functions）
```

### デプロイ順序

```bash
# 1. ネットワーク
npm run cdk -- deploy Prance-dev-Network --require-approval never

# 2. 認証
npm run cdk -- deploy Prance-dev-Cognito --require-approval never

# 3. データベース
npm run cdk -- deploy Prance-dev-Database --require-approval never

# 4. ストレージ
npm run cdk -- deploy Prance-dev-Storage --require-approval never

# 5. DynamoDB
npm run cdk -- deploy Prance-dev-DynamoDB --require-approval never

# 6. API Gateway
npm run cdk -- deploy Prance-dev-ApiGateway --require-approval never

# 7. Lambda関数
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# または全て一括
npm run deploy:dev
```

---

## ⚡ Lambda関数開発ガイドライン

### ディレクトリ構造

```
infrastructure/lambda/
├── shared/                    # 共有モジュール
│   ├── config/               # 設定・定数
│   │   ├── defaults.ts       # デフォルト値
│   │   ├── language-config.ts # 言語メタデータ
│   │   └── index.ts          # 環境変数ヘルパー
│   ├── database/             # Prisma Client
│   │   └── prisma.ts
│   ├── types/                # 型定義（re-export）
│   │   └── index.ts
│   └── utils/                # ユーティリティ
├── auth/                     # 認証関連Lambda
│   ├── register/
│   ├── login/
│   └── me/
├── scenarios/                # シナリオ管理
│   ├── create/
│   ├── list/
│   ├── get/
│   └── update/
├── sessions/                 # セッション管理
├── websocket/                # WebSocket接続
│   ├── connect/
│   ├── disconnect/
│   └── default/
└── db-query/                 # データベースクエリ（開発用）
```

### Lambda関数テンプレート

```typescript
// infrastructure/lambda/scenarios/get/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { NotFoundError } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { id } = event.pathParameters || {};

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing scenario ID' }),
      };
    }

    const scenario = await prisma.scenario.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        // ... 必要なフィールドのみ
      },
    });

    if (!scenario) {
      throw new NotFoundError('Scenario not found');
    }

    return {
      statusCode: 200,
      body: JSON.stringify(scenario),
    };
  } catch (error) {
    console.error('Error getting scenario:', error);

    return {
      statusCode: error instanceof NotFoundError ? 404 : 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
```

### CDK Lambda Function定義

```typescript
// infrastructure/lib/api-lambda-stack.ts
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

// Lambda関数作成
this.scenariosGetFunction = new nodejs.NodejsFunction(this, 'ScenariosGetFunction', {
  functionName: `prance-scenarios-get-${props.environment}`,
  description: 'Get scenario by ID',
  entry: path.join(__dirname, '../lambda/scenarios/get/index.ts'),
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,
  timeout: cdk.Duration.seconds(30),
  memorySize: 512,
  vpc: props.vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups: [props.lambdaSecurityGroup],
  environment: {
    NODE_ENV: props.environment,
    DATABASE_URL: databaseUrl,
    AWS_REGION: 'us-east-1',
    // ... 環境変数
  },
  bundling: {
    minify: true,
    sourceMap: true,
    externalModules: [
      '@aws-sdk/client-s3',
      '@aws-sdk/client-bedrock-runtime',
      // AWS SDK v3はランタイムに含まれる
    ],
    nodeModules: [
      '@prisma/client',
      'microsoft-cognitiveservices-speech-sdk',
      // バンドルが必要な依存関係
    ],
    commandHooks: {
      // Prisma Clientの生成とコピー
      beforeBundling(inputDir: string, outputDir: string): string[] {
        return [
          'cd ../../../packages/database && npx prisma generate',
        ];
      },
      afterBundling(inputDir: string, outputDir: string): string[] {
        return [
          `cp -r ../../../packages/database/node_modules/.prisma ${outputDir}/`,
          `cp -r ../../../packages/database/node_modules/@prisma ${outputDir}/node_modules/`,
          `cp ../../../packages/database/prisma/schema.prisma ${outputDir}/`,
        ];
      },
    },
  },
});
```

---

## 🗄️ データベースアクセス

### Prisma Client使用

```typescript
// Lambda関数内でのPrisma使用
import { prisma } from '../../shared/database/prisma';

// SELECT
const scenarios = await prisma.scenario.findMany({
  where: { orgId: 'org-123' },
  select: {
    id: true,
    title: true,
    language: true,
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
});

// INSERT
const scenario = await prisma.scenario.create({
  data: {
    title: 'New Scenario',
    language: 'ja',
    orgId: 'org-123',
    userId: 'user-456',
  },
});

// UPDATE
const updated = await prisma.scenario.update({
  where: { id: 'scenario-789' },
  data: { title: 'Updated Title' },
});

// DELETE
await prisma.scenario.delete({
  where: { id: 'scenario-789' },
});

// 必ず最後にdisconnect
await prisma.$disconnect();
```

### Prismaスキーマ準拠（詳細）

**命名規則（厳守）:**

| Prismaフィールド名 | 使用箇所                        | ❌ 間違いやすい例               |
| ------------------ | ------------------------------- | ------------------------------- |
| `orgId`            | User, Session, Avatar, Scenario | organizationId, organization_id |
| `userId`           | Session, Avatar                 | user_id, creator_id             |
| `scenarioId`       | Session                         | scenario_id                     |
| `avatarId`         | Session                         | avatar_id                       |
| `startedAt`        | Session                         | started_at, startTime           |
| `endedAt`          | Session                         | ended_at, endTime               |
| `durationSec`      | Session                         | duration_sec, duration          |
| `passwordHash`     | User                            | password_hash                   |
| `cognitoSub`       | User                            | cognito_sub                     |

**Enum値（完全一致必須）:**

- UserRole: `SUPER_ADMIN`, `CLIENT_ADMIN`, `CLIENT_USER`, `GUEST`
- SessionStatus: `ACTIVE`, `PROCESSING`, `COMPLETED`, `ERROR`
- AvatarType: `TWO_D`, `THREE_D` (アンダースコアあり)
- AvatarStyle: `ANIME`, `REALISTIC`
- Visibility: `PRIVATE`, `ORGANIZATION`, `PUBLIC`

**検証方法:**

```bash
# 1. Prismaスキーマファイルを確認
cat packages/database/prisma/schema.prisma | grep -A 15 "model Scenario"

# 2. フィールド名の確認
grep -rn "organizationId\|organization_id" infrastructure/lambda --include="*.ts"

# 3. Enum値の確認
grep -rn "ACTIVE\|PROCESSING" infrastructure/lambda --include="*.ts"
```

### 設定値の一元管理

**🔴 重要原則: ハードコード禁止**

**対象となる設定値:**

- 🌍 **言語設定**: STT言語（'en-US', 'ja-JP'）、シナリオ言語（'ja', 'en'）
- 📍 **リージョン設定**: AWS_REGION, BEDROCK_REGION等
- 🎬 **メディアフォーマット**: video/audio形式（'webm', 'mp4'）、解像度
- ⚙️ **その他定数**: タイムアウト値、リトライ回数等

**一元管理ファイル:**

```
infrastructure/lambda/shared/config/defaults.ts        # すべてのデフォルト値
infrastructure/lambda/shared/config/language-config.ts # 言語メタデータ
infrastructure/lambda/shared/config/index.ts           # 環境変数ヘルパー
```

**使用パターン:**

```typescript
// ❌ ハードコード（禁止）
const language = 'en-US';
const format = 'webm';

// ✅ 正しい方法
import { LANGUAGE_DEFAULTS, MEDIA_DEFAULTS } from '../../shared/config/defaults';

const language = process.env.STT_LANGUAGE || LANGUAGE_DEFAULTS.STT_LANGUAGE;
const format = process.env.VIDEO_FORMAT || MEDIA_DEFAULTS.VIDEO_FORMAT;
```

**検証方法:**

```bash
# ハードコード検出
grep -rn "'en-US'\|'webm'\|'1280x720'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts"
```

### Raw SQL（開発時のみ）

```bash
# データベースクエリスクリプト使用
bash scripts/db-query.sh "SELECT id, title FROM scenarios LIMIT 5"

# ファイル経由
bash scripts/db-query.sh --file scripts/queries/verification.sql
```

> 詳細: [docs/07-development/DATABASE_QUERY_SYSTEM.md](../docs/07-development/DATABASE_QUERY_SYSTEM.md)

---

## 🔐 セキュリティ

### IAMロール・ポリシー

```typescript
// Lambda関数に最小権限の原則
this.lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
  ],
});

// S3アクセス権限（必要な場合のみ）
recordingsBucket.grantRead(this.lambdaRole);
recordingsBucket.grantWrite(this.lambdaRole);

// DynamoDBアクセス権限
connectionsTable.grantReadWriteData(this.lambdaRole);
```

### Secrets Manager

```typescript
// 機密情報はSecrets Managerから取得
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: 'prance-dev-database-secret' })
);

const secret = JSON.parse(response.SecretString!);
const DATABASE_URL = `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname}`;
```

---

## 📊 モニタリング・ログ

### CloudWatch Logs

```bash
# Lambda関数のログ確認
aws logs tail /aws/lambda/prance-scenarios-get-dev --follow

# エラーログのみフィルタ
aws logs tail /aws/lambda/prance-scenarios-get-dev --filter-pattern "ERROR"

# 特定時間範囲
aws logs tail /aws/lambda/prance-scenarios-get-dev --since 1h
```

### X-Ray Tracing

```typescript
// Lambda関数でX-Ray有効化
this.lambdaFunction = new nodejs.NodejsFunction(this, 'Function', {
  // ...
  tracing: lambda.Tracing.ACTIVE,
});
```

---

## 🧪 テスト

### Lambda関数のローカルテスト

```bash
# SAM Local使用（オプション）
sam local invoke ScenariosGetFunction -e test-event.json
```

### 統合テスト

```bash
# デプロイ後のテスト
aws lambda invoke \
  --function-name prance-scenarios-get-dev \
  --payload '{"pathParameters":{"id":"test-id"}}' \
  /tmp/result.json

cat /tmp/result.json
```

---

## 🔍 トラブルシューティング

### よくある問題

**1. Runtime.ImportModuleError**

```
原因: TypeScriptファイルがトランスパイルされていない
解決: CDK経由でデプロイ（npm run deploy:lambda）
```

**2. Prisma Client not found**

```
原因: Prisma Clientがbundleに含まれていない
解決: bundling.commandHooks でコピー処理確認
```

**3. 環境変数が取得できない**

```bash
# Lambda関数の環境変数確認
aws lambda get-function-configuration \
  --function-name prance-scenarios-get-dev \
  --query 'Environment.Variables'
```

---

## 📚 関連ドキュメント

- [データベースクエリシステム](../docs/07-development/DATABASE_QUERY_SYSTEM.md)
- [Lambdaバージョン管理](../docs/07-development/LAMBDA_VERSION_MANAGEMENT.md)
- [AWSサーバーレス構成](../docs/06-infrastructure/AWS_SERVERLESS.md)
- [デプロイメント](../docs/08-operations/DEPLOYMENT.md)

---

**最終更新:** 2026-03-15
**次回レビュー:** Lambda関数デプロイ検証完了時
