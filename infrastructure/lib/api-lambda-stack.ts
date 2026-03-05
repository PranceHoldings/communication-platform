import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface ApiLambdaStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
}

export class ApiLambdaStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigatewayv2.CfnApi;
  public readonly healthCheckFunction: nodejs.NodejsFunction;
  public readonly registerFunction: nodejs.NodejsFunction;
  public readonly loginFunction: nodejs.NodejsFunction;
  public readonly getCurrentUserFunction: nodejs.NodejsFunction;
  public readonly migrationFunction: nodejs.NodejsFunction;
  public readonly authorizer: apigateway.TokenAuthorizer;

  constructor(scope: Construct, id: string, props: ApiLambdaStackProps) {
    super(scope, id, props);

    // ==================== API Gateway ====================

    // CloudWatch Logs ロググループ
    const restApiLogGroup = new logs.LogGroup(this, 'RestApiLogGroup', {
      logGroupName: `/aws/apigateway/prance-rest-api-${props.environment}`,
      retention: props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // REST API（自動デプロイを有効化）
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `prance-api-${props.environment}`,
      description: `Prance Platform REST API - ${props.environment}`,
      deployOptions: {
        stageName: props.environment,
        throttlingBurstLimit: 500,
        throttlingRateLimit: 1000,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: props.environment !== 'production',
        accessLogDestination: new apigateway.LogGroupLogDestination(restApiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // TODO: 本番環境では特定ドメインに制限
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    // WebSocket API (AWS IoT Core代替として、まずAPI Gateway WebSocketで実装)
    this.webSocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `prance-websocket-api-${props.environment}`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      description: `Prance Platform WebSocket API - ${props.environment}`,
    });

    // ==================== Lambda Functions ====================

    // JWT Authorizer Lambda関数（VPC不要、DB接続なし）
    const authorizerFunction = new nodejs.NodejsFunction(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10), // Authorizerは高速である必要がある
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention:
        props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      functionName: `prance-authorizer-${props.environment}`,
      description: 'JWT Token Authorizer for API Gateway',
      entry: path.join(__dirname, '../lambda/auth/authorizer/index.ts'),
      handler: 'handler',
      environment: {
        ENVIRONMENT: props.environment,
        LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
        NODE_ENV: props.environment === 'production' ? 'production' : 'development',
        JWT_SECRET: process.env.JWT_SECRET || 'development-secret-change-in-production',
      },
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk'],
      },
      // VPC接続不要（DB接続なし）
    });

    // Token Authorizer（JWT検証）
    this.authorizer = new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
      handler: authorizerFunction,
      identitySource: 'method.request.header.Authorization',
      authorizerName: `prance-jwt-authorizer-${props.environment}`,
      resultsCacheTtl: cdk.Duration.minutes(5), // 5分間キャッシュ
    });

    // Lambda共通環境変数
    const commonEnvironment = {
      ENVIRONMENT: props.environment,
      LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
      NODE_ENV: props.environment === 'production' ? 'production' : 'development',
      DATABASE_URL: process.env.DATABASE_URL || '',
      JWT_SECRET: process.env.JWT_SECRET || 'development-secret-change-in-production',
    };

    // Lambda共通設定
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64, // Graviton2 (コスト削減)
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE, // X-Ray有効化
      logRetention:
        props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      environment: commonEnvironment,
    };

    // ヘルスチェックLambda関数 (TypeScriptを自動ビルド)
    this.healthCheckFunction = new nodejs.NodejsFunction(this, 'HealthCheckFunction', {
      ...commonLambdaProps,
      functionName: `prance-health-check-${props.environment}`,
      description: 'Health check endpoint',
      entry: path.join(__dirname, '../lambda/health-check/index.ts'),
      handler: 'handler',
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk'],
      },
      // VPC接続は不要（パブリックエンドポイントのみ）
    });

    // ユーザー登録Lambda関数
    this.registerFunction = new nodejs.NodejsFunction(this, 'RegisterFunction', {
      ...commonLambdaProps,
      functionName: `prance-auth-register-${props.environment}`,
      description: 'User registration endpoint',
      entry: path.join(__dirname, '../lambda/auth/register/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512, // Prisma使用のため増量
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk', '@aws-sdk/*'],
        nodeModules: ['@prisma/client'],
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r /asset-input/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp /asset-input/packages/database/prisma/schema.prisma ${outputDir}/prisma/`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // ログインLambda関数
    this.loginFunction = new nodejs.NodejsFunction(this, 'LoginFunction', {
      ...commonLambdaProps,
      functionName: `prance-auth-login-${props.environment}`,
      description: 'User login endpoint',
      entry: path.join(__dirname, '../lambda/auth/login/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk', '@aws-sdk/*'],
        nodeModules: ['@prisma/client'],
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r /asset-input/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp /asset-input/packages/database/prisma/schema.prisma ${outputDir}/prisma/`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // 現在のユーザー情報取得Lambda関数
    this.getCurrentUserFunction = new nodejs.NodejsFunction(this, 'GetCurrentUserFunction', {
      ...commonLambdaProps,
      functionName: `prance-users-me-${props.environment}`,
      description: 'Get current user information endpoint',
      entry: path.join(__dirname, '../lambda/users/me/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk', '@aws-sdk/*'],
        nodeModules: ['@prisma/client'],
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r /asset-input/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp /asset-input/packages/database/prisma/schema.prisma ${outputDir}/prisma/`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // データベースマイグレーション実行Lambda関数（一時的な使用のみ）
    this.migrationFunction = new nodejs.NodejsFunction(this, 'MigrationFunction', {
      ...commonLambdaProps,
      functionName: `prance-db-migration-${props.environment}`,
      description: 'Database migration execution (temporary use only)',
      entry: path.join(__dirname, '../lambda/migrations/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(300), // 5分 (マイグレーション実行に時間がかかる場合)
      memorySize: 1024,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        minify: false, // マイグレーションはデバッグしやすいように minify しない
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk', '@aws-sdk/*'],
        nodeModules: ['@prisma/client'],
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r /asset-input/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp /asset-input/packages/database/prisma/schema.prisma ${outputDir}/prisma/`,
              // Copy migration SQL files
              `cp /asset-input/infrastructure/lambda/migrations/migration.sql ${outputDir}/`,
              `cp /asset-input/infrastructure/lambda/migrations/schema-update.sql ${outputDir}/`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // ==================== API Gateway統合 ====================

    const healthIntegration = new apigateway.LambdaIntegration(this.healthCheckFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const registerIntegration = new apigateway.LambdaIntegration(this.registerFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const loginIntegration = new apigateway.LambdaIntegration(this.loginFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const getCurrentUserIntegration = new apigateway.LambdaIntegration(this.getCurrentUserFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    // APIリソースの作成
    const apiV1 = this.restApi.root.resourceForPath('api/v1');

    // Health check endpoint
    const healthResource = apiV1.addResource('health');
    healthResource.addMethod('GET', healthIntegration, {
      apiKeyRequired: false,
    });

    // Auth endpoints
    const authResource = apiV1.addResource('auth');

    const registerResource = authResource.addResource('register');
    registerResource.addMethod('POST', registerIntegration, {
      apiKeyRequired: false,
    });

    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', loginIntegration, {
      apiKeyRequired: false,
    });

    // Users endpoints
    const usersResource = apiV1.addResource('users');

    const meResource = usersResource.addResource('me');
    meResource.addMethod('GET', getCurrentUserIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // ==================== API Deployment ====================

    // RestAPIで自動デプロイを有効化しているため、deploymentStageは自動的に作成される
    const stage = this.restApi.deploymentStage;

    // Usage Plan (レート制限)
    const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
      name: `prance-usage-plan-${props.environment}`,
      throttle: {
        rateLimit: 1000,
        burstLimit: 500,
      },
      quota: {
        limit: 100000,
        period: apigateway.Period.MONTH,
      },
    });

    // Usage PlanをStageに関連付け
    usagePlan.addApiStage({
      stage,
      api: this.restApi,
    });

    // ==================== Outputs ====================

    new cdk.CfnOutput(this, 'RestApiId', {
      value: this.restApi.restApiId,
      description: 'REST API ID',
      exportName: `${props.environment}-RestApiId`,
    });

    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: `https://${this.restApi.restApiId}.execute-api.${this.region}.amazonaws.com/${props.environment}/`,
      description: 'REST API URL',
      exportName: `${props.environment}-RestApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiStageName', {
      value: stage.stageName,
      description: 'API Gateway Stage Name',
    });

    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: this.webSocketApi.ref,
      description: 'WebSocket API ID',
      exportName: `${props.environment}-WebSocketApiId`,
    });

    new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
      value: `wss://${this.webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/${props.environment}`,
      description: 'WebSocket API Endpoint',
      exportName: `${props.environment}-WebSocketApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'AuthorizerFunctionArn', {
      value: authorizerFunction.functionArn,
      description: 'JWT Authorizer Lambda Function ARN',
      exportName: `${props.environment}-AuthorizerFunctionArn`,
    });

    new cdk.CfnOutput(this, 'AuthorizerFunctionName', {
      value: authorizerFunction.functionName,
      description: 'JWT Authorizer Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'AuthorizerArn', {
      value: this.authorizer.authorizerId,
      description: 'JWT Authorizer ID',
      exportName: `${props.environment}-AuthorizerId`,
    });

    new cdk.CfnOutput(this, 'HealthCheckFunctionArn', {
      value: this.healthCheckFunction.functionArn,
      description: 'Health Check Lambda Function ARN',
      exportName: `${props.environment}-HealthCheckFunctionArn`,
    });

    new cdk.CfnOutput(this, 'HealthCheckFunctionName', {
      value: this.healthCheckFunction.functionName,
      description: 'Health Check Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'RegisterFunctionArn', {
      value: this.registerFunction.functionArn,
      description: 'Register Lambda Function ARN',
      exportName: `${props.environment}-RegisterFunctionArn`,
    });

    new cdk.CfnOutput(this, 'LoginFunctionArn', {
      value: this.loginFunction.functionArn,
      description: 'Login Lambda Function ARN',
      exportName: `${props.environment}-LoginFunctionArn`,
    });

    new cdk.CfnOutput(this, 'GetCurrentUserFunctionArn', {
      value: this.getCurrentUserFunction.functionArn,
      description: 'Get Current User Lambda Function ARN',
      exportName: `${props.environment}-GetCurrentUserFunctionArn`,
    });

    new cdk.CfnOutput(this, 'MigrationFunctionArn', {
      value: this.migrationFunction.functionArn,
      description: 'Database Migration Lambda Function ARN',
      exportName: `${props.environment}-MigrationFunctionArn`,
    });

    new cdk.CfnOutput(this, 'MigrationFunctionName', {
      value: this.migrationFunction.functionName,
      description: 'Database Migration Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'AuthEndpoints', {
      value: JSON.stringify({
        register: `${this.restApi.url}api/v1/auth/register`,
        login: `${this.restApi.url}api/v1/auth/login`,
      }),
      description: 'Auth API Endpoints',
    });

    new cdk.CfnOutput(this, 'UsersEndpoints', {
      value: JSON.stringify({
        me: `${this.restApi.url}api/v1/users/me`,
      }),
      description: 'Users API Endpoints',
    });
  }
}
