# WebSocket CDK Integration Guide

**Status:** 待機中（Lambda関数実装完了、CDK統合が必要）
**Created:** 2026-03-06
**Priority:** 高

---

## 概要

セッションプレイヤーPhase 2の一環として、WebSocket通信を実装するためのLambda関数は作成済み。
次のステップとして、これらをCDK（ApiLambdaStack）に統合してデプロイする必要がある。

---

## 実装済み

### 1. Lambda関数（全て実装完了）

**場所:** `infrastructure/lambda/websocket/`

#### $connect Handler
- **ファイル:** `connect/index.ts`
- **機能:**
  - JWT認証（query param `token` または `Authorization` header）
  - DynamoDB接続管理テーブルへの登録
  - TTL設定（4時間）
  - user_id, org_id の保存
- **依存:** @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, jsonwebtoken

#### $disconnect Handler
- **ファイル:** `disconnect/index.ts`
- **機能:**
  - DynamoDB接続管理テーブルからの削除
  - クリーンアップ処理
- **依存:** @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb

#### $default Handler
- **ファイル:** `default/index.ts`
- **機能:**
  - メッセージルーティング（type別）
  - サポートメッセージタイプ:
    - `ping` / `pong` - ハートビート
    - `authenticate` - 再認証
    - `audio_chunk` - 音声データ（TODO: STT統合）
    - `speech_end` - 発話終了
    - `user_speech` - ユーザー発話テキスト（TODO: AI応答生成）
    - `session_end` - セッション終了
  - エラーハンドリング
  - クライアントへのメッセージ送信（PostToConnectionCommand）
- **依存:** @aws-sdk/client-apigatewaymanagementapi

### 2. フロントエンド

**ファイル:** `apps/web/hooks/useWebSocket.ts`

- TypeScript完全型付け
- 自動再接続（最大5回、Exponential Backoff）
- ハートビート（30秒間隔）
- メッセージタイプ別ハンドラ
- エラーハンドリング

---

## 未実装（CDK統合）

### 必要な変更箇所

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

### Step 1: Lambda関数の定義

`ApiLambdaStack` constructor内、既存Lambda関数定義の後に追加:

```typescript
// ==================== WebSocket Lambda Functions ====================

// WebSocket $connect Handler
const websocketConnectFunction = new nodejs.NodejsFunction(this, 'WebSocketConnectFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64,
  timeout: cdk.Duration.seconds(10),
  memorySize: 256,
  tracing: lambda.Tracing.ACTIVE,
  logRetention:
    props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
  functionName: `prance-websocket-connect-${props.environment}`,
  description: 'WebSocket $connect handler',
  entry: path.join(__dirname, '../lambda/websocket/connect/index.ts'),
  handler: 'handler',
  environment: {
    ENVIRONMENT: props.environment,
    LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
    NODE_ENV: props.environment === 'production' ? 'production' : 'development',
    JWT_SECRET: process.env.JWT_SECRET || 'development-secret-change-in-production',
    CONNECTIONS_TABLE_NAME: `prance-websocket-connections-${props.environment}`,
  },
  bundling: {
    minify: props.environment === 'production',
    sourceMap: true,
    target: 'es2020',
    externalModules: ['aws-sdk'],
  },
});

// WebSocket $disconnect Handler
const websocketDisconnectFunction = new nodejs.NodejsFunction(this, 'WebSocketDisconnectFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64,
  timeout: cdk.Duration.seconds(10),
  memorySize: 256,
  tracing: lambda.Tracing.ACTIVE,
  logRetention:
    props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
  functionName: `prance-websocket-disconnect-${props.environment}`,
  description: 'WebSocket $disconnect handler',
  entry: path.join(__dirname, '../lambda/websocket/disconnect/index.ts'),
  handler: 'handler',
  environment: {
    ENVIRONMENT: props.environment,
    LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
    NODE_ENV: props.environment === 'production' ? 'production' : 'development',
    CONNECTIONS_TABLE_NAME: `prance-websocket-connections-${props.environment}`,
  },
  bundling: {
    minify: props.environment === 'production',
    sourceMap: true,
    target: 'es2020',
    externalModules: ['aws-sdk'],
  },
});

// WebSocket $default Handler
const websocketDefaultFunction = new nodejs.NodejsFunction(this, 'WebSocketDefaultFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64,
  timeout: cdk.Duration.seconds(30),
  memorySize: 512,
  tracing: lambda.Tracing.ACTIVE,
  logRetention:
    props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
  functionName: `prance-websocket-default-${props.environment}`,
  description: 'WebSocket $default message handler',
  entry: path.join(__dirname, '../lambda/websocket/default/index.ts'),
  handler: 'handler',
  environment: {
    ENVIRONMENT: props.environment,
    LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
    NODE_ENV: props.environment === 'production' ? 'production' : 'development',
    WEBSOCKET_ENDPOINT: `https://${this.webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/${props.environment}`,
  },
  bundling: {
    minify: props.environment === 'production',
    sourceMap: true,
    target: 'es2020',
    externalModules: ['aws-sdk'],
  },
});
```

### Step 2: WebSocket API Integration

```typescript
// WebSocket Lambda Integrations
const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
  apiId: this.webSocketApi.ref,
  integrationType: 'AWS_PROXY',
  integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketConnectFunction.functionArn}/invocations`,
});

const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
  apiId: this.webSocketApi.ref,
  integrationType: 'AWS_PROXY',
  integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketDisconnectFunction.functionArn}/invocations`,
});

const defaultIntegration = new apigatewayv2.CfnIntegration(this, 'DefaultIntegration', {
  apiId: this.webSocketApi.ref,
  integrationType: 'AWS_PROXY',
  integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketDefaultFunction.functionArn}/invocations`,
});

// WebSocket Routes
const connectRoute = new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
  apiId: this.webSocketApi.ref,
  routeKey: '$connect',
  authorizationType: 'NONE', // JWT auth handled in Lambda
  target: `integrations/${connectIntegration.ref}`,
});

const disconnectRoute = new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
  apiId: this.webSocketApi.ref,
  routeKey: '$disconnect',
  authorizationType: 'NONE',
  target: `integrations/${disconnectIntegration.ref}`,
});

const defaultRoute = new apigatewayv2.CfnRoute(this, 'DefaultRoute', {
  apiId: this.webSocketApi.ref,
  routeKey: '$default',
  authorizationType: 'NONE',
  target: `integrations/${defaultIntegration.ref}`,
});

// WebSocket Stage
const wsStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', {
  apiId: this.webSocketApi.ref,
  stageName: props.environment,
  autoDeploy: true,
  defaultRouteSettings: {
    dataTraceEnabled: props.environment !== 'production',
    loggingLevel: props.environment === 'production' ? 'ERROR' : 'INFO',
    throttlingBurstLimit: 500,
    throttlingRateLimit: 1000,
  },
});

// WebSocket Deployment
const wsDeployment = new apigatewayv2.CfnDeployment(this, 'WebSocketDeployment', {
  apiId: this.webSocketApi.ref,
});

// Deployment depends on routes
wsDeployment.addDependency(connectRoute);
wsDeployment.addDependency(disconnectRoute);
wsDeployment.addDependency(defaultRoute);

// Stage depends on deployment
wsStage.addDependency(wsDeployment);
```

### Step 3: Permissions

```typescript
// Lambda invoke permissions for WebSocket API
websocketConnectFunction.addPermission('WebSocketConnectPermission', {
  principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*`,
});

websocketDisconnectFunction.addPermission('WebSocketDisconnectPermission', {
  principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*`,
});

websocketDefaultFunction.addPermission('WebSocketDefaultPermission', {
  principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*`,
});

// DynamoDB permissions (must import DynamoDB stack)
// In bin/app.ts: const dynamoDBStack = new DynamoDBStack(...);
// Pass to ApiLambdaStack: websocketConnectionsTable: dynamoDBStack.websocketConnectionsTable

// Then grant permissions:
props.websocketConnectionsTable.grantReadWriteData(websocketConnectFunction);
props.websocketConnectionsTable.grantReadWriteData(websocketDisconnectFunction);

// PostToConnection permission for default handler
websocketDefaultFunction.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['execute-api:ManageConnections'],
    resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*`],
  })
);
```

### Step 4: Update Stack Props and Constructor

**bin/app.ts**

```typescript
// Import DynamoDB stack first
const dynamoDBStack = new DynamoDBStack(app, `${stackPrefix}-DynamoDB`, {
  env,
  environment,
  description: 'Prance Platform - DynamoDB Tables',
});

// Pass to ApiLambdaStack
const apiLambdaStack = new ApiLambdaStack(app, `${stackPrefix}-ApiLambda`, {
  env,
  environment,
  vpc: networkStack.vpc,
  lambdaSecurityGroup: networkStack.lambdaSecurityGroup,
  databaseCluster: databaseStack.cluster,
  databaseSecret: databaseStack.secret,
  websocketConnectionsTable: dynamoDBStack.websocketConnectionsTable, // ADD THIS
  description: 'Prance Platform - API Gateway, Lambda Functions, and Authorizer',
});

// Add dependency
apiLambdaStack.addDependency(dynamoDBStack);
```

**lib/api-lambda-stack.ts interface**

```typescript
export interface ApiLambdaStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  databaseCluster: rds.DatabaseCluster;
  databaseSecret: secretsmanager.Secret;
  websocketConnectionsTable: dynamodb.Table; // ADD THIS
}
```

### Step 5: Add Outputs

```typescript
new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
  value: `wss://${this.webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/${props.environment}`,
  description: 'WebSocket API Endpoint',
  exportName: `${props.environment}-WebSocketApiEndpoint`,
});

new cdk.CfnOutput(this, 'WebSocketApiId', {
  value: this.webSocketApi.ref,
  description: 'WebSocket API ID',
  exportName: `${props.environment}-WebSocketApiId`,
});
```

---

## デプロイ手順

### 1. CDK統合（コード変更）

上記のコードを `infrastructure/lib/api-lambda-stack.ts` と `infrastructure/bin/app.ts` に追加

### 2. ビルド確認

```bash
cd /workspaces/prance-communication-platform/infrastructure
npm run build
```

### 3. CDK差分確認

```bash
npm run cdk -- diff Prance-dev-ApiLambda
```

### 4. デプロイ実行

```bash
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### 5. 動作確認

```bash
# WebSocket API IDとEndpointを確認
aws cloudformation describe-stacks \
  --stack-name Prance-dev-ApiLambda \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiEndpoint`]'

# Lambda関数の確認
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `prance-websocket`)].FunctionName'
```

---

## 次のステップ（Phase 2完了後）

1. ✅ WebSocket CDK統合・デプロイ
2. ⏳ SessionPlayerコンポーネントにuseWebSocket統合
3. ⏳ 動作テスト（接続・切断・メッセージ送受信）
4. ⏳ Phase 3: Audio Processing（STT/TTS統合）

---

## トラブルシューティング

### Lambda関数が見つからない

CDK bundling時にnode_modulesが正しくインストールされているか確認:

```bash
cd infrastructure/lambda/websocket/connect
npm install
cd ../disconnect
npm install
cd ../default
npm install
```

### WebSocket接続失敗

1. CloudWatch Logsを確認: `/aws/lambda/prance-websocket-connect-dev`
2. JWT_SECRETが正しく設定されているか確認
3. DynamoDBテーブル名が環境変数に正しく渡されているか確認

### PermissionError

Lambda実行ロールに以下の権限があるか確認:
- DynamoDB: PutItem, DeleteItem
- API Gateway: ManageConnections
