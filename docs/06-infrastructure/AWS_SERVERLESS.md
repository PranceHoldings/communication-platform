# AWSサーバーレスインフラ構成

**バージョン:** 2.0
**作成日:** 2026-03-05
**最終更新:** 2026-03-05
**ステータス:** Phase 0 完了

---

## 目次

1. [インフラ構成概要](#1-インフラ構成概要)
2. [主要コンポーネント詳細](#2-主要コンポーネント詳細)
   - 2.1 [フロントエンド層](#21-フロントエンド層)
   - 2.2 [API層](#22-api層)
   - 2.3 [データ層](#23-データ層)
   - 2.4 [非同期処理層](#24-非同期処理層)
   - 2.5 [ストレージ・CDN層](#25-ストレージcdn層)
3. [スケーラビリティ設計](#3-スケーラビリティ設計)
4. [コスト最適化](#4-コスト最適化)
5. [高可用性・DR設計](#5-高可用性dr設計)
6. [セキュリティアーキテクチャ](#6-セキュリティアーキテクチャ)
7. [監視・ロギング](#7-監視ロギング)
8. [デプロイメント戦略](#8-デプロイメント戦略)

---

## 1. インフラ構成概要

### 全体アーキテクチャ図

```
┌───────────────────────────────────────────────────────────────────┐
│                   CloudFront CDN (Global Edge Locations)           │
│                   - Static Assets Distribution                     │
│                   - API Caching & DDoS Protection                  │
└────────────┬────────────────────────────────────┬──────────────────┘
             │                                    │
             ↓                                    ↓
┌────────────────────────────┐      ┌────────────────────────────┐
│   S3 Static Hosting        │      │   API Gateway (REST)       │
│   (Next.js Static Assets)  │      │   - Lambda Authorizer      │
│   - SSR/SSG Pages          │      │   - Usage Plans            │
│   - Client Components      │      │   - Rate Limiting          │
└────────────────────────────┘      └──────────┬─────────────────┘
                                               │
                ┌──────────────────────────────┼────────────────────┐
                ↓                              ↓                    ↓
    ┌────────────────────┐      ┌──────────────────────┐ ┌──────────────────┐
    │  AWS IoT Core      │      │  Amazon Cognito      │ │  AWS WAF         │
    │  - WebSocket API   │      │  - User Pools        │ │  - DDoS Protection│
    │  - 1M Concurrent   │      │  - Identity Pools    │ │  - IP Filtering  │
    │    Connections     │      │  - OAuth2/SAML       │ │  - Rate Limiting │
    └────────┬───────────┘      └──────────┬───────────┘ └────────┬─────────┘
             │                              │                      │
             └──────────────────────────────┼──────────────────────┘
                                            │
                                            ↓
┌──────────────────────────────────────────────────────────────────────┐
│                       AWS Lambda Functions (Node.js 20, ARM64)       │
├─────────────────────┬────────────────────┬────────────────────────────┤
│  API Lambda         │  WebSocket Lambda  │  Background Workers       │
│  - Avatar CRUD      │  - Session Manager │  - Recording Processing   │
│  - Scenario CRUD    │  - AI Conversation │  - Emotion Analysis       │
│  - Session CRUD     │  - Real-time STT   │  - Report Generation      │
│  - Prompt Manager   │  - TTS Streaming   │  - PDF Generation         │
│  - Provider Manager │  - Connection Mgmt │  - Thumbnail Generation   │
│  - Auth Handler     │                    │  - Cleanup Jobs           │
└─────────────────────┴────────────────────┴────────────────────────────┘
             │                              │                      │
             └──────────────────────────────┼──────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ↓                             ↓                             ↓
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│ Aurora Serverless v2 │      │     DynamoDB         │      │  ElastiCache Redis   │
│ (PostgreSQL 15.4)    │      │  - Session State     │      │  - API Rate Limiting │
│ - Master Data        │      │  - WebSocket Conn    │      │  - Cache (Session)   │
│ - Users & Orgs       │      │  - Benchmark Cache   │      │  - Language Resources│
│ - Scenarios          │      │  - TTL Auto-delete   │      │                      │
│ - Prompts & Settings │      │                      │      │                      │
│ - Multi-AZ           │      │                      │      │                      │
│ - 0.5-16 ACU Scale   │      │                      │      │                      │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────────────────────────────┐
│              EventBridge + Step Functions (Orchestration)             │
│                                                                       │
│  Session Completion Event → Step Functions Workflow                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  1. Recording Verification (Lambda)                            │  │
│  │  2. Video Composition (MediaConvert)                           │  │
│  │  3. Thumbnail Generation (Lambda) [Parallel]                   │  │
│  │  4. Transcript Regeneration (Lambda) [Parallel]                │  │
│  │  5. Emotion Analysis (Lambda → Azure Face API)                 │  │
│  │  6. Voice Analysis (Lambda → Azure Speech)                     │  │
│  │  7. AI Report Generation (Lambda → Claude API)                 │  │
│  │  8. PDF Generation (Lambda + Puppeteer Layer)                  │  │
│  │  9. Notification (SNS → Email/SMS)                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                Amazon S3 + CloudFront CDN                             │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │
│  │  Recordings    │ │  Avatars       │ │  Reports       │           │
│  │  (Video/Audio) │ │  (3D Models)   │ │  (PDF/HTML)    │           │
│  │  - Lifecycle   │ │  - CloudFront  │ │  - Signed URLs │           │
│  │    Policy      │ │    Cached      │ │                │           │
│  └────────────────┘ └────────────────┘ └────────────────┘           │
│                                                                       │
│  - Encryption (SSE-KMS)                                              │
│  - Versioning (Critical Buckets)                                     │
│  - Intelligent-Tiering (Cost Optimization)                           │
│  - CloudFront Signed URLs (Secure Distribution)                      │
└──────────────────────────────────────────────────────────────────────┘
```

### サーバーレスアーキテクチャの特徴

#### 1. フルマネージド＆自動スケーリング

- **Lambda**: リクエスト数に応じて自動スケール (0 → 1000+ 同時実行)
- **Aurora Serverless v2**: 負荷に応じて自動ACU調整 (0.5 → 16 ACU)
- **DynamoDB**: オンデマンドモードで無制限スケール
- **IoT Core**: 100万同時WebSocket接続対応

#### 2. コスト効率

- **使用量ベース課金**: アイドル時のコストを最小化
- **Lambda ARM64 (Graviton2)**: 20%のコスト削減
- **S3 Intelligent-Tiering**: 自動コスト最適化
- **推定コスト** (月間1000セッション): $500-800

#### 3. 高可用性＆スケーラビリティ

- **Multi-AZ デプロイ** (Aurora, Lambda)
- **自動フェイルオーバー** (RTO < 1分)
- **グローバルCDN配信** (CloudFront)
- **99.9% SLA**

#### 4. メンテナンス性

- **サーバー管理不要** (自動パッチ・OS更新)
- **Infrastructure as Code** (AWS CDK) 管理
- **分散トレーシング** (X-Ray) で迅速な問題特定
- **CloudWatch統合監視**

---

## 2. 主要コンポーネント詳細

### 2.1 フロントエンド層

#### Next.js 15 + AWS Amplify Hosting

```typescript
// infrastructure/lib/frontend-stack.ts
export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // S3 Bucket for Static Assets
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `prance-web-${props.environment}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for Prance Website',
    });

    websiteBucket.grantRead(originAccessIdentity);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/404.html',
          ttl: Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Output
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });
  }
}
```

**特徴:**

- **Next.js App Router**: SSR/SSG/ISRのハイブリッドレンダリング
- **CloudFront CDN**: グローバルエッジロケーションで低レイテンシ配信
- **S3静的ホスティング**: ビルド済み静的アセットの配信
- **HTTP/2 & HTTP/3対応**: 高速通信プロトコル

---

### 2.2 API層

#### API Gateway (REST + WebSocket)

```typescript
// infrastructure/lib/api-gateway-stack.ts
export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // REST API
    const api = new apigateway.RestApi(this, 'PranceApi', {
      restApiName: 'Prance Platform API',
      description: 'Prance Communication Platform REST API',
      deployOptions: {
        stageName: props.environment,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Tenant-Id'],
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
    });

    // Lambda Integration
    const integration = new apigateway.LambdaIntegration(props.apiFunction, {
      proxy: true,
    });

    // Routes
    const apiV1 = api.root.addResource('v1');
    apiV1.addProxy({
      anyMethod: true,
      defaultIntegration: integration,
    });

    // Usage Plan (Rate Limiting)
    const plan = api.addUsagePlan('UsagePlan', {
      name: 'Standard Plan',
      throttle: {
        rateLimit: 1000,
        burstLimit: 2000,
      },
      quota: {
        limit: 1000000,
        period: apigateway.Period.MONTH,
      },
    });

    plan.addApiStage({
      stage: api.deploymentStage,
    });

    // WebSocket API (AWS IoT Core)
    // Note: IoT Coreは別スタックで管理
  }
}
```

#### Lambda Functions (Node.js 20, ARM64)

```typescript
// infrastructure/lib/lambda-stack.ts
export class LambdaStack extends Stack {
  public readonly apiFunction: lambda.Function;
  public readonly websocketFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // API Lambda Function
    this.apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64, // Graviton2
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/api/dist')),
      memorySize: 1024,
      timeout: Duration.seconds(30),
      environment: {
        DATABASE_URL: props.databaseUrl,
        REDIS_URL: props.redisUrl,
        NODE_ENV: props.environment,
        AWS_BEDROCK_MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
        ELEVENLABS_API_KEY: props.elevenLabsApiKey,
        AZURE_SPEECH_KEY: props.azureSpeechKey,
      },
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      reservedConcurrentExecutions: 10, // Prevent cost runaway
    });

    // WebSocket Lambda Function
    this.websocketFunction = new lambda.Function(this, 'WebSocketFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'websocket.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/api/dist')),
      memorySize: 2048,
      timeout: Duration.seconds(60),
      environment: {
        IOT_ENDPOINT: props.iotEndpoint,
        DATABASE_URL: props.databaseUrl,
      },
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Lambda Layers (Shared Dependencies)
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../layers/shared')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      description: 'Shared utilities and dependencies',
    });

    const aiLayer = new lambda.LayerVersion(this, 'AILayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../layers/ai')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      description: 'Anthropic Claude SDK, OpenAI SDK, Google Generative AI',
    });

    this.apiFunction.addLayers(sharedLayer, aiLayer);
    this.websocketFunction.addLayers(sharedLayer, aiLayer);
  }
}
```

**特徴:**

- **ARM64 (Graviton2)**: 20%のコスト削減、パフォーマンス向上
- **Lambda Layers**: 共通ライブラリの共有でデプロイサイズ削減
- **VPC統合**: Private Subnetで Aurora/Redisへ安全にアクセス
- **X-Ray Tracing**: 分散トレーシングで性能監視
- **Reserved Concurrent Executions**: コスト暴走防止

---

### 2.3 データ層

#### Aurora Serverless v2 (PostgreSQL 15.4)

```typescript
// infrastructure/lib/database-stack.ts
export class DatabaseStack extends Stack {
  public readonly cluster: rds.DatabaseCluster;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Aurora Serverless v2 Cluster
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 16,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: [rds.ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true })],
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.auroraSecurityGroup],
      defaultDatabaseName: 'prance',
      storageEncrypted: true,
      backup: {
        retention: Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'Sun:04:00-Sun:05:00',
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    // Output
    new CfnOutput(this, 'DatabaseEndpoint', {
      value: this.cluster.clusterEndpoint.socketAddress,
      description: 'Aurora Cluster Writer Endpoint',
    });

    new CfnOutput(this, 'DatabaseReadEndpoint', {
      value: this.cluster.clusterReadEndpoint.socketAddress,
      description: 'Aurora Cluster Reader Endpoint',
    });
  }
}
```

**特徴:**

- **自動スケーリング**: 0.5 → 16 ACU (1 ACU = 2GB RAM + CPU)
- **Multi-AZ構成**: Writer + Reader (自動フェイルオーバー)
- **暗号化**: 保存時暗号化 (KMS)
- **自動バックアップ**: 7日間保持、ポイントインタイムリカバリ
- **Prisma ORM対応**: TypeScript型安全アクセス

#### DynamoDB (セッション状態・キャッシュ)

```typescript
// infrastructure/lib/dynamodb-stack.ts
export class DynamoDBStack extends Stack {
  constructor(scope: Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id, props);

    // Session State Table
    const sessionStateTable = new dynamodb.Table(this, 'SessionStateTable', {
      tableName: `prance-session-state-${props.environment}`,
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // WebSocket Connection Table
    const connectionTable = new dynamodb.Table(this, 'ConnectionTable', {
      tableName: `prance-websocket-connections-${props.environment}`,
      partitionKey: { name: 'connection_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
    });

    // GSI: session_id → connection_id
    connectionTable.addGlobalSecondaryIndex({
      indexName: 'SessionIdIndex',
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
    });

    // Benchmark Cache Table
    const benchmarkTable = new dynamodb.Table(this, 'BenchmarkTable', {
      tableName: `prance-benchmark-cache-${props.environment}`,
      partitionKey: { name: 'profile_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'metric_name', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
    });

    // Rate Limiting Table
    const rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: `prance-rate-limit-${props.environment}`,
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
    });
  }
}
```

**特徴:**

- **オンデマンドモード**: 自動スケール、容量計画不要
- **TTL自動削除**: 期限切れデータの自動削除でコスト削減
- **DynamoDB Streams**: リアルタイムデータ変更通知
- **Point-in-Time Recovery**: 35日間の継続バックアップ

#### ElastiCache Serverless (Redis)

```typescript
// infrastructure/lib/cache-stack.ts
export class CacheStack extends Stack {
  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    // ElastiCache Serverless Redis
    const cacheCluster = new elasticache.CfnServerlessCache(this, 'RedisCache', {
      serverlessCacheName: `prance-redis-${props.environment}`,
      engine: 'redis',
      majorEngineVersion: '7',
      securityGroupIds: [props.redisSecurityGroup.securityGroupId],
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
    });

    // Output
    new CfnOutput(this, 'RedisEndpoint', {
      value: cacheCluster.attrEndpointAddress,
      description: 'ElastiCache Redis Endpoint',
    });
  }
}
```

**用途:**

- **APIレート制限**: トークンバケット方式
- **セッションキャッシュ**: 高速アクセス
- **言語リソースキャッシュ**: 多言語対応の高速配信
- **一時データ**: JWT検証キャッシュ

---

### 2.4 非同期処理層

#### EventBridge + Step Functions

```typescript
// infrastructure/lib/workflow-stack.ts
export class WorkflowStack extends Stack {
  constructor(scope: Construct, id: string, props: WorkflowStackProps) {
    super(scope, id, props);

    // Step Functions State Machine
    const sessionProcessingWorkflow = new sfn.StateMachine(this, 'SessionProcessingWorkflow', {
      stateMachineName: `session-processing-${props.environment}`,
      definition: this.createWorkflowDefinition(props),
      tracingEnabled: true,
      logs: {
        level: sfn.LogLevel.ALL,
        destination: new logs.LogGroup(this, 'WorkflowLogs', {
          retention: logs.RetentionDays.ONE_WEEK,
        }),
      },
    });

    // EventBridge Rule: Session Completion Event
    const rule = new events.Rule(this, 'SessionCompletionRule', {
      eventPattern: {
        source: ['prance.sessions'],
        detailType: ['Session Completed'],
      },
    });

    rule.addTarget(new targets.SfnStateMachine(sessionProcessingWorkflow));
  }

  private createWorkflowDefinition(props: WorkflowStackProps): sfn.IChainable {
    // 1. Recording Verification
    const verifyRecording = new tasks.LambdaInvoke(this, 'VerifyRecording', {
      lambdaFunction: props.verifyRecordingFunction,
      outputPath: '$.Payload',
    });

    // 2. Video Composition (MediaConvert)
    const composeVideo = new tasks.MediaConvertCreateJob(this, 'ComposeVideo', {
      createJobRequest: {
        // MediaConvert job configuration
      },
    });

    // 3. Parallel Processing
    const parallelProcessing = new sfn.Parallel(this, 'ParallelProcessing');

    const generateThumbnail = new tasks.LambdaInvoke(this, 'GenerateThumbnail', {
      lambdaFunction: props.generateThumbnailFunction,
    });

    const regenerateTranscript = new tasks.LambdaInvoke(this, 'RegenerateTranscript', {
      lambdaFunction: props.regenerateTranscriptFunction,
    });

    parallelProcessing.branch(generateThumbnail);
    parallelProcessing.branch(regenerateTranscript);

    // 4. Emotion Analysis
    const emotionAnalysis = new tasks.LambdaInvoke(this, 'EmotionAnalysis', {
      lambdaFunction: props.emotionAnalysisFunction,
    });

    // 5. Voice Analysis
    const voiceAnalysis = new tasks.LambdaInvoke(this, 'VoiceAnalysis', {
      lambdaFunction: props.voiceAnalysisFunction,
    });

    // 6. AI Report Generation
    const generateReport = new tasks.LambdaInvoke(this, 'GenerateReport', {
      lambdaFunction: props.generateReportFunction,
    });

    // 7. PDF Generation
    const generatePDF = new tasks.LambdaInvoke(this, 'GeneratePDF', {
      lambdaFunction: props.generatePDFFunction,
    });

    // 8. Notification
    const sendNotification = new tasks.SnsPublish(this, 'SendNotification', {
      topic: props.notificationTopic,
      message: sfn.TaskInput.fromJsonPathAt('$.reportUrl'),
    });

    // Chain
    return verifyRecording
      .next(composeVideo)
      .next(parallelProcessing)
      .next(emotionAnalysis)
      .next(voiceAnalysis)
      .next(generateReport)
      .next(generatePDF)
      .next(sendNotification);
  }
}
```

**特徴:**

- **ビジュアルワークフロー**: AWS Management Consoleで可視化
- **並列処理**: サムネイル生成とトランスクリプト再生成を並列実行
- **エラーハンドリング**: リトライ・タイムアウト・フォールバック
- **実行履歴**: 全ステップの入出力を記録

---

### 2.5 ストレージ・CDN層

#### S3 Buckets

```typescript
// infrastructure/lib/storage-stack.ts
export class StorageStack extends Stack {
  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // Recordings Bucket
    const recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
      bucketName: `prance-recordings-${props.environment}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldRecordings',
          enabled: true,
          expiration: Duration.days(90),
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
    });

    // Avatars Bucket
    const avatarsBucket = new s3.Bucket(this, 'AvatarsBucket', {
      bucketName: `prance-avatars-${props.environment}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // Reports Bucket
    const reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: `prance-reports-${props.environment}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldReports',
          enabled: true,
          expiration: Duration.days(365),
        },
      ],
    });

    // CloudFront Distribution for Avatars
    const avatarsDistribution = new cloudfront.Distribution(this, 'AvatarsDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(avatarsBucket, {
          originAccessIdentity: props.originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });
  }
}
```

**特徴:**

- **KMS暗号化**: 録画・レポートは顧客管理キーで暗号化
- **Intelligent-Tiering**: アクセス頻度に応じた自動ストレージクラス変更
- **ライフサイクルポリシー**: 自動削除でストレージコスト削減
- **CloudFront署名付きURL**: セキュアなコンテンツ配信

---

## 3. スケーラビリティ設計

### 水平スケーリング

| コンポーネント           | スケール方法               | 最大容量                        |
| ------------------------ | -------------------------- | ------------------------------- |
| **Lambda**               | 自動（リクエスト数ベース） | 1,000同時実行（デフォルト制限） |
| **Aurora Serverless v2** | 自動（ACU調整）            | 16 ACU (32GB RAM)               |
| **DynamoDB**             | 自動（オンデマンド）       | 無制限                          |
| **IoT Core**             | 自動（接続数ベース）       | 100万同時接続                   |
| **CloudFront**           | 自動（グローバルエッジ）   | 無制限                          |

### 垂直スケーリング

- **Lambda Memory**: 1024MB → 10,240MB (128MB単位)
- **Aurora ACU**: 0.5 → 16 (0.5単位)
- **ElastiCache**: 自動スケール（サーバーレス）

### スケーリングトリガー

```typescript
// CloudWatch Alarms
const cpuAlarm = new cloudwatch.Alarm(this, 'HighCPUAlarm', {
  metric: cluster.metricCPUUtilization(),
  threshold: 80,
  evaluationPeriods: 2,
  datapointsToAlarm: 2,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});

cpuAlarm.addAlarmAction(new actions.SnsAction(props.alertTopic));
```

---

## 4. コスト最適化

### 月間1,000セッション想定コスト ($500-800)

| サービス                            | 使用量                            | 月額 (USD) |
| ----------------------------------- | --------------------------------- | ---------- |
| **Lambda**                          | 100万リクエスト、1024MB、30秒平均 | $120       |
| **Aurora Serverless v2**            | 平均2 ACU、730時間                | $180       |
| **DynamoDB**                        | 500万読込、100万書込              | $40        |
| **S3**                              | 1TB保存、10TBダウンロード         | $50        |
| **CloudFront**                      | 10TBダウンロード                  | $85        |
| **IoT Core**                        | 100万メッセージ/月                | $8         |
| **API Gateway**                     | 100万リクエスト                   | $3.50      |
| **ElastiCache**                     | Serverless、1GBキャッシュ         | $20        |
| **その他** (NAT Gateway, VPC, Logs) | -                                 | $50        |

**合計**: 約 **$556/月**

### コスト削減戦略

1. **Lambda ARM64採用**: 20%コスト削減
2. **Reserved Concurrent Executions**: コスト暴走防止
3. **S3 Intelligent-Tiering**: アクセス頻度ベースの自動最適化
4. **DynamoDB TTL**: 不要データの自動削除
5. **CloudWatch Logs Retention**: 7日間保持（長期はS3アーカイブ）
6. **Aurora Serverless v2**: アイドル時0.5 ACUまで自動縮小

---

## 5. 高可用性・DR設計

### 高可用性 (HA)

#### Multi-AZ構成

- **Aurora**: Writer + Reader (自動フェイルオーバー)
- **Lambda**: 複数AZで自動実行
- **DynamoDB**: 3AZ自動レプリケーション

#### 自動フェイルオーバー

```typescript
// Aurora Automatic Failover
this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
  // ...
  readers: [rds.ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true })],
});
```

**RTO (Recovery Time Objective)**: < 1分
**RPO (Recovery Point Objective)**: < 5分

### ディザスタリカバリ (DR)

#### バックアップ戦略

| データ       | バックアップ方法       | 保持期間 | リストア時間 |
| ------------ | ---------------------- | -------- | ------------ |
| **Aurora**   | 自動スナップショット   | 7日      | 5-10分       |
| **DynamoDB** | Point-in-Time Recovery | 35日     | 5-10分       |
| **S3**       | バージョニング         | 無期限   | 即時         |

#### DR計画

1. **Warm Standby** (推奨): セカンダリリージョンで縮小構成を維持
2. **Pilot Light**: 最小構成を維持、障害時に拡張
3. **Backup & Restore**: 最も低コスト、RTO/RPO最長

---

## 6. セキュリティアーキテクチャ

### ネットワークセキュリティ

```typescript
// VPC構成
this.vpc = new ec2.Vpc(this, 'PranceVpc', {
  maxAzs: 2,
  natGateways: 1,
  subnetConfiguration: [
    {
      cidrMask: 24,
      name: 'public',
      subnetType: ec2.SubnetType.PUBLIC,
    },
    {
      cidrMask: 24,
      name: 'private',
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
    {
      cidrMask: 28,
      name: 'isolated',
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  ],
});

// Security Groups
this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
  vpc: this.vpc,
  description: 'Security group for Lambda functions',
  allowAllOutbound: true,
});

this.auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSG', {
  vpc: this.vpc,
  description: 'Security group for Aurora cluster',
  allowAllOutbound: false,
});

// Lambda → Aurora
this.auroraSecurityGroup.addIngressRule(
  this.lambdaSecurityGroup,
  ec2.Port.tcp(5432),
  'Allow Lambda to access Aurora'
);
```

### データ暗号化

#### 保存時暗号化

- **S3**: SSE-KMS (顧客管理キー)
- **Aurora**: 暗号化ストレージ
- **DynamoDB**: AWS管理キー
- **ElastiCache**: 暗号化有効

#### 転送時暗号化

- **CloudFront**: TLS 1.2+
- **API Gateway**: HTTPS必須
- **IoT Core**: TLS 1.2+

### IAM権限管理

```typescript
// Lambda Execution Role
const lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
  ],
});

// Grant Aurora Access
cluster.grantDataApiAccess(lambdaRole);

// Grant S3 Access
recordingsBucket.grantReadWrite(lambdaRole);

// Grant DynamoDB Access
sessionStateTable.grantReadWriteData(lambdaRole);
```

**原則**: 最小権限の原則 (Least Privilege)

---

## 7. 監視・ロギング

### CloudWatch Metrics

```typescript
// Custom Metrics
const sessionsMetric = new cloudwatch.Metric({
  namespace: 'Prance/Sessions',
  metricName: 'ActiveSessions',
  statistic: 'Sum',
  period: Duration.minutes(5),
});

// Dashboard
const dashboard = new cloudwatch.Dashboard(this, 'PranceDashboard', {
  dashboardName: 'Prance-Platform',
});

dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'Active Sessions',
    left: [sessionsMetric],
  })
);
```

### X-Ray Tracing

```typescript
// Lambda Tracing Enabled
tracing: lambda.Tracing.ACTIVE,
```

### CloudWatch Logs

```typescript
// Log Groups
logRetention: logs.RetentionDays.ONE_WEEK,
```

### アラート設定

```typescript
// High Error Rate Alarm
const errorAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
  metric: apiFunction.metricErrors(),
  threshold: 10,
  evaluationPeriods: 2,
  datapointsToAlarm: 2,
});

errorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

---

## 8. デプロイメント戦略

### AWS CDK デプロイ

```bash
# 環境変数設定
export AWS_PROFILE=prance-dev
export AWS_REGION=us-east-1

# CDK Bootstrap (初回のみ)
cd infrastructure
pnpm run bootstrap

# デプロイ (全スタック)
pnpm run deploy

# 個別スタックデプロイ
pnpm run deploy:network
pnpm run deploy:database
pnpm run deploy:lambda
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Build
        run: pnpm run build
      - name: CDK Deploy
        run: |
          cd infrastructure
          pnpm run deploy -- --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
```

### Blue/Green Deployment

```typescript
// Lambda Alias
const liveAlias = new lambda.Alias(this, 'LiveAlias', {
  aliasName: 'live',
  version: apiFunction.currentVersion,
});

// Gradual Deployment
const deployment = new codedeploy.LambdaDeploymentGroup(this, 'DeploymentGroup', {
  alias: liveAlias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
  alarms: [errorAlarm],
});
```

---

## 関連ドキュメント

- [システムアーキテクチャ](../architecture/SYSTEM_ARCHITECTURE.md)
- [データベース設計](../development/DATABASE_DESIGN.md)
- [API設計](../development/API_DESIGN.md)
- [技術スタック詳細](../reference/TECH_STACK.md)
- [FAQ](../reference/FAQ.md)
- [用語集](../reference/GLOSSARY.md)

---

**最終更新:** 2026-03-05
**次回レビュー予定:** Phase 1 完了時
