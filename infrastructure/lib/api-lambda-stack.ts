import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import { Construct } from 'constructs';
import { getConfig } from './config';

export interface ApiLambdaStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  databaseCluster: rds.DatabaseCluster;
  databaseSecret: secretsmanager.Secret;
  websocketConnectionsTable: dynamodb.Table;
  recordingsBucket: s3.Bucket;
  guestRateLimitTable: dynamodb.Table;
}

export class ApiLambdaStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigatewayv2.CfnApi;
  public readonly healthCheckFunction: nodejs.NodejsFunction;
  public readonly registerFunction: nodejs.NodejsFunction;
  public readonly loginFunction: nodejs.NodejsFunction;
  public readonly getCurrentUserFunction: nodejs.NodejsFunction;
  public readonly organizationSettingsFunction: nodejs.NodejsFunction;
  public readonly migrationFunction: nodejs.NodejsFunction;
  public readonly populateScenarioDefaultsFunction: nodejs.NodejsFunction;
  public readonly listSessionsFunction: nodejs.NodejsFunction;
  public readonly createSessionFunction: nodejs.NodejsFunction;
  public readonly getSessionFunction: nodejs.NodejsFunction;
  public readonly listScenariosFunction: nodejs.NodejsFunction;
  public readonly createScenarioFunction: nodejs.NodejsFunction;
  public readonly getScenarioFunction: nodejs.NodejsFunction;
  public readonly listAvatarsFunction: nodejs.NodejsFunction;
  public readonly createAvatarFunction: nodejs.NodejsFunction;
  public readonly getAvatarFunction: nodejs.NodejsFunction;
  public readonly updateScenarioFunction: nodejs.NodejsFunction;
  public readonly deleteScenarioFunction: nodejs.NodejsFunction;
  public readonly updateAvatarFunction: nodejs.NodejsFunction;
  public readonly deleteAvatarFunction: nodejs.NodejsFunction;
  public readonly cloneAvatarFunction: nodejs.NodejsFunction;
  public readonly sessionAnalysisFunction: nodejs.NodejsFunction;
  public readonly getAnalysisFunction: nodejs.NodejsFunction;
  public readonly triggerAnalysisFunction: nodejs.NodejsFunction;
  public readonly getScoreFunction: nodejs.NodejsFunction;
  public readonly generateReportFunction: nodejs.NodejsFunction;
  // Guest User Functions
  public readonly createGuestSessionFunction: nodejs.NodejsFunction;
  public readonly listGuestSessionsFunction: nodejs.NodejsFunction;
  public readonly getGuestSessionFunction: nodejs.NodejsFunction;
  public readonly updateGuestSessionFunction: nodejs.NodejsFunction;
  public readonly deleteGuestSessionFunction: nodejs.NodejsFunction;
  public readonly batchCreateGuestSessionsFunction: nodejs.NodejsFunction;
  public readonly getGuestSessionLogsFunction: nodejs.NodejsFunction;
  public readonly completeGuestSessionFunction: nodejs.NodejsFunction;
  public readonly verifyGuestTokenFunction: nodejs.NodejsFunction;
  public readonly authGuestFunction: nodejs.NodejsFunction;
  public readonly getGuestSessionDataFunction: nodejs.NodejsFunction;
  public readonly authorizer: apigateway.TokenAuthorizer;

  constructor(scope: Construct, id: string, props: ApiLambdaStackProps) {
    super(scope, id, props);

    // 環境設定を取得
    const config = getConfig(props.environment);

    // ==================== Secrets Manager ====================
    // 機密情報をSecrets Managerから取得

    // ElevenLabs Secret
    const elevenLabsSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ElevenLabsSecret',
      `prance/elevenlabs/${props.environment}`
    );

    // Azure Speech Secret
    const azureSpeechSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'AzureSpeechSecret',
      `prance/azure-speech/${props.environment}`
    );

    // JWT Secret
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'JwtSecret',
      `prance/jwt/${props.environment}`
    );

    // ==================== API Gateway ====================

    // CloudWatch Logs ロググループ
    const restApiLogGroup = new logs.LogGroup(this, 'RestApiLogGroup', {
      logGroupName: `/aws/apigateway/prance-rest-api-${props.environment}`,
      retention:
        props.environment === 'production'
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
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
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10), // Authorizerは高速である必要がある
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention:
        props.environment === 'production'
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
      functionName: `prance-authorizer-${props.environment}`,
      description: 'JWT Token Authorizer for API Gateway',
      entry: path.join(__dirname, '../lambda/auth/authorizer/index.ts'),
      handler: 'handler',
      environment: {
        ENVIRONMENT: props.environment,
        LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
        NODE_ENV: props.environment === 'production' ? 'production' : 'development',
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
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

    // DATABASE_URLを構築（Secrets Managerから認証情報を取得）
    const dbUsername = props.databaseSecret.secretValueFromJson('username').unsafeUnwrap();
    const dbPassword = props.databaseSecret.secretValueFromJson('password').unsafeUnwrap();
    const DATABASE_URL = `postgresql://${dbUsername}:${dbPassword}@${props.databaseCluster.clusterEndpoint.hostname}:${props.databaseCluster.clusterEndpoint.port}/prance`;

    // Lambda共通環境変数
    const commonEnvironment = {
      ENVIRONMENT: props.environment,
      LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
      NODE_ENV: props.environment === 'production' ? 'production' : 'development',
      DATABASE_URL,
      JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
      FRONTEND_URL: `https://${config.domain.fullDomain}`,
      GUEST_RATE_LIMIT_TABLE_NAME: props.guestRateLimitTable.tableName,
      BEDROCK_REGION: this.region,
      STORAGE_BUCKET_NAME: props.recordingsBucket.bucketName,
    };

    // Lambda共通設定
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // Graviton2 (コスト削減)
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE, // X-Ray有効化
      logRetention:
        props.environment === 'production'
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
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
          beforeBundling(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
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
          beforeBundling(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
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
          beforeBundling(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // 組織設定（AI & Audio Settings）Lambda関数
    this.organizationSettingsFunction = new nodejs.NodejsFunction(
      this,
      'OrganizationSettingsFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-organizations-settings-${props.environment}`,
        description: 'Get and update organization settings (AI & Audio)',
        entry: path.join(__dirname, '../lambda/organizations/settings/index.ts'),
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
            beforeBundling(_inputDir: string, _outputDir: string): string[] {
              return [];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
              return [
                // Copy Prisma generated client
                `mkdir -p ${outputDir}/node_modules/.prisma`,
                `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
                // Copy Prisma schema
                `mkdir -p ${outputDir}/prisma`,
                `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
                // Copy shared modules
                `mkdir -p ${outputDir}/shared`,
                `cp -r ${inputDir}/infrastructure/lambda/shared/config ${outputDir}/shared/`,
                `cp -r ${inputDir}/infrastructure/lambda/shared/utils ${outputDir}/shared/`,
                `cp -r ${inputDir}/infrastructure/lambda/shared/types ${outputDir}/shared/`,
                `cp -r ${inputDir}/infrastructure/lambda/shared/auth ${outputDir}/shared/`,
                `cp -r ${inputDir}/infrastructure/lambda/shared/database ${outputDir}/shared/`,
              ];
            },
            beforeInstall(): string[] {
              return [];
            },
          },
        },
      }
    );

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
          beforeBundling(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
              // Copy all migration SQL files
              `cp ${inputDir}/infrastructure/lambda/migrations/*.sql ${outputDir}/ || true`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // データベース保守Lambda関数（Scenario Default Values設定）
    this.populateScenarioDefaultsFunction = new nodejs.NodejsFunction(
      this,
      'PopulateScenarioDefaultsFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-populate-scenario-defaults-${props.environment}`,
        description:
          'Populate silence management default values for existing scenarios (one-time maintenance)',
        entry: path.join(__dirname, '../lambda/maintenance/populate-scenario-defaults/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(300), // 5分
        memorySize: 512,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: {
          minify: false,
          sourceMap: true,
          target: 'es2020',
          externalModules: ['aws-sdk', '@aws-sdk/*'],
          nodeModules: ['@prisma/client'],
          commandHooks: {
            beforeBundling(_inputDir: string, _outputDir: string): string[] {
              return [];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
              return [
                // Copy Prisma generated client
                `mkdir -p ${outputDir}/node_modules/.prisma`,
                `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
                // Copy Prisma schema
                `mkdir -p ${outputDir}/prisma`,
                `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
              ];
            },
            beforeInstall(): string[] {
              return [];
            },
          },
        },
      }
    );

    // ==================== Session Management Lambda Functions ====================

    // Prisma bundling configuration (共通)
    const prismaBundlingConfig = {
      minify: props.environment === 'production',
      sourceMap: true,
      target: 'es2020',
      externalModules: ['aws-sdk', '@aws-sdk/*'],
      nodeModules: ['@prisma/client'],
      commandHooks: {
        beforeBundling(_inputDir: string, _outputDir: string): string[] {
          return [];
        },
        afterBundling(inputDir: string, outputDir: string): string[] {
          return [
            // Copy Prisma generated client
            `mkdir -p ${outputDir}/node_modules/.prisma`,
            `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
            // Copy Prisma schema
            `mkdir -p ${outputDir}/prisma`,
            `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
            // Copy shared modules (CRITICAL: Required by some Lambda functions)
            `mkdir -p ${outputDir}/shared`,
            `cp -r ${inputDir}/infrastructure/lambda/shared/analysis ${outputDir}/shared/ 2>/dev/null || true`,
            `cp -r ${inputDir}/infrastructure/lambda/shared/auth ${outputDir}/shared/ 2>/dev/null || true`,
            `cp -r ${inputDir}/infrastructure/lambda/shared/config ${outputDir}/shared/ 2>/dev/null || true`,
            `cp -r ${inputDir}/infrastructure/lambda/shared/types ${outputDir}/shared/ 2>/dev/null || true`,
            `cp -r ${inputDir}/infrastructure/lambda/shared/utils ${outputDir}/shared/ 2>/dev/null || true`,
          ];
        },
        beforeInstall(): string[] {
          return [];
        },
      },
    };

    // セッション一覧取得Lambda関数
    this.listSessionsFunction = new nodejs.NodejsFunction(this, 'ListSessionsFunction', {
      ...commonLambdaProps,
      functionName: `prance-sessions-list-${props.environment}`,
      description: 'List sessions for authenticated user',
      entry: path.join(__dirname, '../lambda/sessions/list/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // セッション作成Lambda関数
    this.createSessionFunction = new nodejs.NodejsFunction(this, 'CreateSessionFunction', {
      ...commonLambdaProps,
      functionName: `prance-sessions-create-${props.environment}`,
      description: 'Create a new session',
      entry: path.join(__dirname, '../lambda/sessions/create/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // セッション詳細取得Lambda関数
    this.getSessionFunction = new nodejs.NodejsFunction(this, 'GetSessionFunction', {
      ...commonLambdaProps,
      functionName: `prance-sessions-get-${props.environment}`,
      description: 'Get session details by ID',
      entry: path.join(__dirname, '../lambda/sessions/get/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // ==================== シナリオ管理Lambda関数 ====================

    // シナリオ一覧取得Lambda関数
    this.listScenariosFunction = new nodejs.NodejsFunction(this, 'ListScenariosFunction', {
      ...commonLambdaProps,
      functionName: `prance-scenarios-list-${props.environment}`,
      description: 'Get list of scenarios',
      entry: path.join(__dirname, '../lambda/scenarios/list/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // シナリオ作成Lambda関数
    this.createScenarioFunction = new nodejs.NodejsFunction(this, 'CreateScenarioFunction', {
      ...commonLambdaProps,
      functionName: `prance-scenarios-create-${props.environment}`,
      description: 'Create a new scenario',
      entry: path.join(__dirname, '../lambda/scenarios/create/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // シナリオ詳細取得Lambda関数
    this.getScenarioFunction = new nodejs.NodejsFunction(this, 'GetScenarioFunction', {
      ...commonLambdaProps,
      functionName: `prance-scenarios-get-${props.environment}`,
      description: 'Get scenario details by ID',
      entry: path.join(__dirname, '../lambda/scenarios/get/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // シナリオ更新Lambda関数
    this.updateScenarioFunction = new nodejs.NodejsFunction(this, 'UpdateScenarioFunction', {
      ...commonLambdaProps,
      functionName: `prance-scenarios-update-${props.environment}`,
      description: 'Update an existing scenario',
      entry: path.join(__dirname, '../lambda/scenarios/update/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // シナリオ削除Lambda関数
    this.deleteScenarioFunction = new nodejs.NodejsFunction(this, 'DeleteScenarioFunction', {
      ...commonLambdaProps,
      functionName: `prance-scenarios-delete-${props.environment}`,
      description: 'Delete a scenario',
      entry: path.join(__dirname, '../lambda/scenarios/delete/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // ==================== アバター管理Lambda関数 ====================

    // アバター一覧取得Lambda関数
    this.listAvatarsFunction = new nodejs.NodejsFunction(this, 'ListAvatarsFunction', {
      ...commonLambdaProps,
      functionName: `prance-avatars-list-${props.environment}`,
      description: 'Get list of avatars',
      entry: path.join(__dirname, '../lambda/avatars/list/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // アバター作成Lambda関数
    this.createAvatarFunction = new nodejs.NodejsFunction(this, 'CreateAvatarFunction', {
      ...commonLambdaProps,
      functionName: `prance-avatars-create-${props.environment}`,
      description: 'Create a new avatar',
      entry: path.join(__dirname, '../lambda/avatars/create/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // アバター詳細取得Lambda関数
    this.getAvatarFunction = new nodejs.NodejsFunction(this, 'GetAvatarFunction', {
      ...commonLambdaProps,
      functionName: `prance-avatars-get-${props.environment}`,
      description: 'Get avatar details by ID',
      entry: path.join(__dirname, '../lambda/avatars/get/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // アバター更新Lambda関数
    this.updateAvatarFunction = new nodejs.NodejsFunction(this, 'UpdateAvatarFunction', {
      ...commonLambdaProps,
      functionName: `prance-avatars-update-${props.environment}`,
      description: 'Update an existing avatar',
      entry: path.join(__dirname, '../lambda/avatars/update/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // アバター削除Lambda関数
    this.deleteAvatarFunction = new nodejs.NodejsFunction(this, 'DeleteAvatarFunction', {
      ...commonLambdaProps,
      functionName: `prance-avatars-delete-${props.environment}`,
      description: 'Delete an avatar',
      entry: path.join(__dirname, '../lambda/avatars/delete/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // アバタークローンLambda関数
    this.cloneAvatarFunction = new nodejs.NodejsFunction(this, 'CloneAvatarFunction', {
      ...commonLambdaProps,
      functionName: `prance-avatars-clone-${props.environment}`,
      description: 'Clone a public avatar to user organization',
      entry: path.join(__dirname, '../lambda/avatars/clone/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // ==================== セッション解析Lambda関数 ====================

    // セッション解析処理Lambda関数（非同期実行）
    this.sessionAnalysisFunction = new nodejs.NodejsFunction(this, 'SessionAnalysisFunction', {
      ...commonLambdaProps,
      functionName: `prance-sessions-analysis-${props.environment}`,
      description: 'Process session analysis (emotion, audio, scoring)',
      entry: path.join(__dirname, '../lambda/sessions/analysis/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(5), // 解析処理は時間がかかる
      memorySize: 3008, // 高メモリ（Rekognition処理）
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
      environment: {
        ...commonEnvironment,
        RECORDINGS_BUCKET_NAME: props.recordingsBucket.bucketName,
        ENABLE_AUTO_ANALYSIS: process.env.ENABLE_AUTO_ANALYSIS || 'true',
      },
    });

    // S3とRekognitionアクセス権限を付与
    props.recordingsBucket.grantRead(this.sessionAnalysisFunction);
    this.sessionAnalysisFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'rekognition:DetectFaces',
          'rekognition:RecognizeCelebrities',
          'rekognition:DetectModerationLabels',
        ],
        resources: ['*'],
      })
    );

    // 解析結果取得Lambda関数
    this.getAnalysisFunction = new nodejs.NodejsFunction(this, 'GetAnalysisFunction', {
      ...commonLambdaProps,
      functionName: `prance-sessions-get-analysis-${props.environment}`,
      description: 'Get session analysis results',
      entry: path.join(__dirname, '../lambda/sessions/get-analysis/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // 解析トリガーLambda関数
    this.triggerAnalysisFunction = new nodejs.NodejsFunction(this, 'TriggerAnalysisFunction', {
      ...commonLambdaProps,
      functionName: `prance-sessions-trigger-analysis-${props.environment}`,
      description: 'Trigger session analysis manually',
      entry: path.join(__dirname, '../lambda/sessions/trigger-analysis/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
      environment: {
        ...commonEnvironment,
        ANALYSIS_FUNCTION_NAME: `prance-sessions-analysis-${props.environment}`,
      },
    });

    // 解析Lambda呼び出し権限を付与
    this.sessionAnalysisFunction.grantInvoke(this.triggerAnalysisFunction);

    // スコア取得Lambda関数
    this.getScoreFunction = new nodejs.NodejsFunction(this, 'GetScoreFunction', {
      ...commonLambdaProps,
      functionName: `prance-sessions-get-score-${props.environment}`,
      description: 'Get session score',
      entry: path.join(__dirname, '../lambda/sessions/get-score/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // ==================== Report Generation Lambda Function ====================

    // Generate PDF Report
    this.generateReportFunction = new nodejs.NodejsFunction(this, 'GenerateReportFunction', {
      ...commonLambdaProps,
      functionName: `prance-report-generate-${props.environment}`,
      description: 'Generate PDF report for completed session',
      entry: path.join(__dirname, '../lambda/report-generate/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60), // Longer timeout for PDF generation
      memorySize: 1024, // More memory for chart/PDF generation
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk', '@aws-sdk/*'],
        nodeModules: [
          '@prisma/client',
          'react',
          '@react-pdf/renderer',
          '@aws-sdk/client-s3',
          '@aws-sdk/s3-request-presigner',
          '@aws-sdk/client-bedrock-runtime',
        ],
        commandHooks: {
          beforeBundling(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          beforeInstall(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            // Copy report templates and styles, and Prisma client
            return [
              // Copy Prisma generated client
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r ${inputDir}/packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Prisma client will be generated at runtime"`,
              // Copy Prisma schema
              `mkdir -p ${outputDir}/prisma`,
              `cp ${inputDir}/packages/database/prisma/schema.prisma ${outputDir}/prisma/ 2>/dev/null || true`,
              // Copy report module
              `mkdir -p ${outputDir}/lambda`,
              `cp -r ${inputDir}/infrastructure/lambda/report ${outputDir}/lambda/`,
              // Copy shared modules
              `cp -r ${inputDir}/infrastructure/lambda/shared/config ${outputDir}/shared/`,
              `cp -r ${inputDir}/infrastructure/lambda/shared/utils ${outputDir}/shared/`,
              `cp -r ${inputDir}/infrastructure/lambda/shared/types ${outputDir}/shared/`,
              `cp -r ${inputDir}/infrastructure/lambda/shared/auth ${outputDir}/shared/`,
              `cp -r ${inputDir}/infrastructure/lambda/shared/database ${outputDir}/shared/`,
            ];
          },
        },
      },
    });

    // Grant S3 permissions for PDF upload
    props.recordingsBucket.grantReadWrite(this.generateReportFunction);

    // Grant Bedrock permissions for AI suggestions
    this.generateReportFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/us.anthropic.claude-sonnet-4-20250514-v1:0`,
        ],
      })
    );

    // ==================== Guest User Lambda Functions ====================

    // Create Guest Session
    this.createGuestSessionFunction = new nodejs.NodejsFunction(
      this,
      'CreateGuestSessionFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-guest-sessions-create-${props.environment}`,
        description: 'Create a new guest session',
        entry: path.join(__dirname, '../lambda/guest-sessions/create/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: prismaBundlingConfig,
      }
    );

    // List Guest Sessions
    this.listGuestSessionsFunction = new nodejs.NodejsFunction(this, 'ListGuestSessionsFunction', {
      ...commonLambdaProps,
      functionName: `prance-guest-sessions-list-${props.environment}`,
      description: 'List guest sessions with filters',
      entry: path.join(__dirname, '../lambda/guest-sessions/list/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // Get Guest Session
    this.getGuestSessionFunction = new nodejs.NodejsFunction(this, 'GetGuestSessionFunction', {
      ...commonLambdaProps,
      functionName: `prance-guest-sessions-get-${props.environment}`,
      description: 'Get guest session details',
      entry: path.join(__dirname, '../lambda/guest-sessions/get/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // Update Guest Session
    this.updateGuestSessionFunction = new nodejs.NodejsFunction(
      this,
      'UpdateGuestSessionFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-guest-sessions-update-${props.environment}`,
        description: 'Update guest session',
        entry: path.join(__dirname, '../lambda/guest-sessions/update/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: prismaBundlingConfig,
      }
    );

    // Delete Guest Session
    this.deleteGuestSessionFunction = new nodejs.NodejsFunction(
      this,
      'DeleteGuestSessionFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-guest-sessions-delete-${props.environment}`,
        description: 'Delete (revoke) guest session',
        entry: path.join(__dirname, '../lambda/guest-sessions/delete/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: prismaBundlingConfig,
      }
    );

    // Batch Create Guest Sessions
    this.batchCreateGuestSessionsFunction = new nodejs.NodejsFunction(
      this,
      'BatchCreateGuestSessionsFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-guest-sessions-batch-${props.environment}`,
        description: 'Batch create guest sessions (max 100)',
        entry: path.join(__dirname, '../lambda/guest-sessions/batch/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(60), // Longer timeout for batch
        memorySize: 1024, // More memory for batch
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: prismaBundlingConfig,
      }
    );

    // Get Guest Session Logs
    this.getGuestSessionLogsFunction = new nodejs.NodejsFunction(
      this,
      'GetGuestSessionLogsFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-guest-sessions-logs-${props.environment}`,
        description: 'Get guest session audit logs',
        entry: path.join(__dirname, '../lambda/guest-sessions/logs/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: prismaBundlingConfig,
      }
    );

    // Complete Guest Session
    this.completeGuestSessionFunction = new nodejs.NodejsFunction(
      this,
      'CompleteGuestSessionFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-guest-sessions-complete-${props.environment}`,
        description: 'Mark guest session as completed',
        entry: path.join(__dirname, '../lambda/guest-sessions/complete/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: prismaBundlingConfig,
      }
    );

    // Verify Guest Token
    this.verifyGuestTokenFunction = new nodejs.NodejsFunction(this, 'VerifyGuestTokenFunction', {
      ...commonLambdaProps,
      functionName: `prance-guest-verify-${props.environment}`,
      description: 'Verify guest token before PIN entry',
      entry: path.join(__dirname, '../lambda/guest/verify/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // Authenticate Guest
    this.authGuestFunction = new nodejs.NodejsFunction(this, 'AuthGuestFunction', {
      ...commonLambdaProps,
      functionName: `prance-guest-auth-${props.environment}`,
      description: 'Authenticate guest with PIN and issue JWT',
      entry: path.join(__dirname, '../lambda/guest/auth/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: prismaBundlingConfig,
    });

    // Get Guest Session Data
    this.getGuestSessionDataFunction = new nodejs.NodejsFunction(
      this,
      'GetGuestSessionDataFunction',
      {
        ...commonLambdaProps,
        functionName: `prance-guest-session-data-${props.environment}`,
        description: 'Get session data for authenticated guest',
        entry: path.join(__dirname, '../lambda/guest/session-data/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.lambdaSecurityGroup],
        bundling: prismaBundlingConfig,
      }
    );

    // ==================== WebSocket Lambda Functions ====================

    // WebSocket $connect Handler
    const websocketConnectFunction = new nodejs.NodejsFunction(this, 'WebSocketConnectFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention:
        props.environment === 'production'
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
      functionName: `prance-websocket-connect-${props.environment}`,
      description: 'WebSocket $connect handler',
      entry: path.join(__dirname, '../lambda/websocket/connect/index.ts'),
      handler: 'handler',
      environment: {
        ENVIRONMENT: props.environment,
        LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
        NODE_ENV: props.environment === 'production' ? 'production' : 'development',
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
        CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
      },
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk'],
        commandHooks: {
          beforeBundling(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // Copy shared modules (JWT auth)
              `mkdir -p ${outputDir}/shared`,
              `cp -r ${inputDir}/infrastructure/lambda/shared/auth ${outputDir}/shared/`,
              `cp -r ${inputDir}/infrastructure/lambda/shared/types ${outputDir}/shared/ 2>/dev/null || true`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // WebSocket $disconnect Handler
    const websocketDisconnectFunction = new nodejs.NodejsFunction(
      this,
      'WebSocketDisconnectFunction',
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        tracing: lambda.Tracing.ACTIVE,
        logRetention:
          props.environment === 'production'
            ? logs.RetentionDays.ONE_MONTH
            : logs.RetentionDays.ONE_WEEK,
        functionName: `prance-websocket-disconnect-${props.environment}`,
        description: 'WebSocket $disconnect handler',
        entry: path.join(__dirname, '../lambda/websocket/disconnect/index.ts'),
        handler: 'handler',
        environment: {
          ENVIRONMENT: props.environment,
          LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
          NODE_ENV: props.environment === 'production' ? 'production' : 'development',
          CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
        },
        bundling: {
          minify: props.environment === 'production',
          sourceMap: true,
          target: 'es2020',
          externalModules: ['aws-sdk'],
        },
      }
    );

    // WebSocket $default Handler (with AI/Audio/Video processing)
    // Note: We now use ffmpeg-static npm package instead of Lambda Layer
    // This provides better compatibility with ARM64 architecture and simplifies deployment

    const websocketDefaultFunction = new nodejs.NodejsFunction(this, 'WebSocketDefaultFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // Using ARM64 for Graviton2 cost savings + dev env compatibility
      timeout: cdk.Duration.seconds(300), // Increased for video processing (5 minutes)
      memorySize: 3008, // Increased for video processing with ffmpeg
      ephemeralStorageSize: cdk.Size.gibibytes(10), // Large storage for video chunk processing
      tracing: lambda.Tracing.ACTIVE,
      logRetention:
        props.environment === 'production'
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
      functionName: `prance-websocket-default-${props.environment}`,
      description: 'WebSocket $default message handler with STT/AI/TTS/Video processing',
      entry: path.join(__dirname, '../lambda/websocket/default/index.ts'),
      handler: 'handler',
      depsLockFilePath: path.join(__dirname, '../lambda/websocket/default/package-lock.json'),
      projectRoot: path.join(__dirname, '../lambda'),
      environment: {
        ENVIRONMENT: props.environment,
        LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
        NODE_ENV: props.environment === 'production' ? 'production' : 'development',
        // AWS_REGION is automatically set by Lambda runtime - do not override
        WEBSOCKET_ENDPOINT: `https://${this.webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/${props.environment}`,
        CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
        S3_BUCKET: props.recordingsBucket.bucketName,
        DATABASE_URL,
        // JWT Secret for authentication
        JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
        // ffmpeg Configuration (CRITICAL: Set explicit path where CDK copies binary)
        FFMPEG_PATH: '/var/task/ffmpeg',
        FFPROBE_PATH: '/var/task/ffprobe',
        // AI/Audio Service Configuration
        // 機密情報はSecrets Managerから取得、非機密情報はデフォルト値使用
        AZURE_SPEECH_KEY: azureSpeechSecret.secretValueFromJson('subscriptionKey').unsafeUnwrap(),
        AZURE_SPEECH_REGION: azureSpeechSecret.secretValueFromJson('region').unsafeUnwrap(),
        ELEVENLABS_API_KEY: elevenLabsSecret.secretValueFromJson('apiKey').unsafeUnwrap(),
        ELEVENLABS_VOICE_ID: elevenLabsSecret.secretValueFromJson('voiceId').unsafeUnwrap(),
        ELEVENLABS_MODEL_ID: elevenLabsSecret.secretValueFromJson('modelId').unsafeUnwrap(),
        BEDROCK_REGION: process.env.BEDROCK_REGION || 'us-east-1',
        BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-6',
        // CloudFront Configuration (for signed URLs)
        // Using hardcoded value for dev environment (see CDK_CLOUDFRONT_DOMAIN_FIX.md)
        CLOUDFRONT_DOMAIN: 'd3mx0sug5s3a6x.cloudfront.net',
        CLOUDFRONT_KEY_PAIR_ID: process.env.CLOUDFRONT_KEY_PAIR_ID || '',
        CLOUDFRONT_PRIVATE_KEY: process.env.CLOUDFRONT_PRIVATE_KEY || '',
        // Language and Media Configuration (デフォルト値はLambda内で管理)
        STT_LANGUAGE: process.env.STT_LANGUAGE || '',
        VIDEO_FORMAT: process.env.VIDEO_FORMAT || '',
        VIDEO_RESOLUTION: process.env.VIDEO_RESOLUTION || '',
        AUDIO_CONTENT_TYPE: process.env.AUDIO_CONTENT_TYPE || '',
        VIDEO_CONTENT_TYPE: process.env.VIDEO_CONTENT_TYPE || '',
        // Analysis Configuration
        ANALYSIS_FUNCTION_NAME: `prance-sessions-analysis-${props.environment}`,
        ENABLE_AUTO_ANALYSIS: process.env.ENABLE_AUTO_ANALYSIS || 'true',
      },
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: [
          'aws-sdk',
          '@aws-sdk/*',
          '@smithy/*',
          'microsoft-cognitiveservices-speech-sdk',
          'ffmpeg-static',
        ],
        nodeModules: [
          'microsoft-cognitiveservices-speech-sdk',
          'ffmpeg-static',
          '@prisma/client',
          'prisma',
        ],
        commandHooks: {
          beforeBundling(_inputDir: string, _outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              // ROOT CAUSE ANALYSIS (2026-03-14):
              // Previous design (commit fa84e6f, 2026-03-12) copied pre-compiled .js files from source directory.
              // This was based on INCORRECT DIAGNOSIS: "index.js missing from Lambda zip"
              // TRUTH: esbuild automatically transpiles index.ts and bundles imported modules into outputDir/index.js
              // PROBLEM: Copying from source directory OVERWRITES esbuild output with stale code
              // SOLUTION: Let esbuild handle all transpilation. Only copy shared modules and native dependencies.
              //
              // Why previous approach failed:
              // 1. esbuild generates fresh index.js from index.ts → outputDir/index.js (correct code)
              // 2. afterBundling copies old index.js from source → OVERWRITES with stale code (2026-03-11)
              // 3. Even "clean build" (rm -rf cdk.out) doesn't remove source .js files
              // 4. Old code gets deployed repeatedly
              //
              // Correct approach:
              // - esbuild: Handles index.ts transpilation + bundling (audio-processor, video-processor, chunk-utils)
              // - afterBundling: Only copies shared/ modules and native dependencies (ffmpeg-static, Azure SDK)
              // Fix require paths in bundled file (../../shared -> ./shared)
              // Note: esbuild bundles all TypeScript imports, but preserves dynamic require() for shared modules
              `sed -i 's|require("../../shared/|require("./shared/|g' ${outputDir}/index.js || true`,
              `sed -i "s|require('../../shared/|require('./shared/|g" ${outputDir}/index.js || true`,
              // Copy ALL shared modules (CRITICAL: Without these, Lambda will fail with ImportModuleError)
              `mkdir -p ${outputDir}/shared`,
              `cp -r ${inputDir}/shared/ai ${outputDir}/shared/`,
              `cp -r ${inputDir}/shared/audio ${outputDir}/shared/`,
              `cp -r ${inputDir}/shared/analysis ${outputDir}/shared/ 2>/dev/null || true`,
              `cp -r ${inputDir}/shared/config ${outputDir}/shared/`, // CRITICAL: defaults.ts, language-config.ts
              `cp -r ${inputDir}/shared/utils ${outputDir}/shared/`, // CRITICAL: error-logger.ts
              `cp -r ${inputDir}/shared/types ${outputDir}/shared/`, // CRITICAL: Type definitions
              `cp -r ${inputDir}/shared/auth ${outputDir}/shared/ 2>/dev/null || true`,
              `cp -r ${inputDir}/shared/database ${outputDir}/shared/ 2>/dev/null || true`,
              // Copy Prisma Client (both @prisma/client package and .prisma/client generated code)
              // Note: Both are required - @prisma/client is the package, .prisma/client is the generated code
              `mkdir -p ${outputDir}/node_modules/@prisma`,
              `cp -r ${inputDir}/websocket/default/node_modules/@prisma/client ${outputDir}/node_modules/@prisma/ 2>/dev/null || echo "Warning: @prisma/client package not found"`,
              `mkdir -p ${outputDir}/node_modules/.prisma`,
              `cp -r ${inputDir}/../../packages/database/node_modules/.prisma/client ${outputDir}/node_modules/.prisma/ 2>/dev/null || echo "Warning: .prisma/client generated code not found"`,
              // Copy Prisma schema (CRITICAL: Required for Prisma Client initialization)
              `cp ${inputDir}/../../packages/database/prisma/schema.prisma ${outputDir}/node_modules/.prisma/client/schema.prisma 2>/dev/null || echo "Warning: schema.prisma not found"`,
              // Copy native dependencies (CRITICAL: ffmpeg-static for audio processing, Azure Speech SDK for STT)
              `mkdir -p ${outputDir}/node_modules/ffmpeg-static`,
              `cp -r ${inputDir}/websocket/default/node_modules/ffmpeg-static/. ${outputDir}/node_modules/ffmpeg-static/ 2>/dev/null || echo "Warning: ffmpeg-static not found"`,
              `mkdir -p ${outputDir}/node_modules/microsoft-cognitiveservices-speech-sdk`,
              `cp -r ${inputDir}/websocket/default/node_modules/microsoft-cognitiveservices-speech-sdk/. ${outputDir}/node_modules/microsoft-cognitiveservices-speech-sdk/ 2>/dev/null || echo "Warning: Azure Speech SDK not found"`,
              // Copy ffmpeg/ffprobe binaries directly to root for direct access
              `cp ${inputDir}/websocket/default/node_modules/ffmpeg-static/ffmpeg ${outputDir}/ffmpeg 2>/dev/null || echo "Warning: ffmpeg binary not found"`,
              `chmod +x ${outputDir}/ffmpeg 2>/dev/null || true`,
              `cp ${inputDir}/websocket/default/node_modules/ffmpeg-static/ffprobe ${outputDir}/ffprobe 2>/dev/null || echo "Info: ffprobe not found in ffmpeg-static (optional)"`,
              `chmod +x ${outputDir}/ffprobe 2>/dev/null || true`,
              `echo "Shared modules and native dependencies copied successfully (esbuild handles TypeScript transpilation)"`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // DynamoDB permissions for WebSocket handlers
    props.websocketConnectionsTable.grantReadWriteData(websocketConnectFunction);
    props.websocketConnectionsTable.grantReadWriteData(websocketDisconnectFunction);
    props.websocketConnectionsTable.grantReadWriteData(websocketDefaultFunction);

    // DynamoDB permissions for Guest User functions
    // Auth function needs read/write for rate limiting
    props.guestRateLimitTable.grantReadWriteData(this.authGuestFunction);
    // Verify function may need read access for rate limit checks
    props.guestRateLimitTable.grantReadData(this.verifyGuestTokenFunction);

    // S3 permissions for default handler (audio/video storage)
    props.recordingsBucket.grantReadWrite(websocketDefaultFunction);

    // Secrets Manager permissions for WebSocket handlers
    // Connect handler needs JWT secret for authentication
    jwtSecret.grantRead(websocketConnectFunction);
    // Default handler needs all secrets for AI/Audio/Video processing
    elevenLabsSecret.grantRead(websocketDefaultFunction);
    azureSpeechSecret.grantRead(websocketDefaultFunction);
    props.databaseSecret.grantRead(websocketDefaultFunction);

    // Secrets Manager permissions for Authorizer
    jwtSecret.grantRead(authorizerFunction);

    // Secrets Manager permissions for Auth functions
    jwtSecret.grantRead(this.registerFunction);
    jwtSecret.grantRead(this.loginFunction);
    jwtSecret.grantRead(this.getCurrentUserFunction);
    props.databaseSecret.grantRead(this.registerFunction);
    props.databaseSecret.grantRead(this.loginFunction);
    props.databaseSecret.grantRead(this.getCurrentUserFunction);

    // PostToConnection permission for default handler
    websocketDefaultFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.ref}/*`,
        ],
      })
    );

    // AWS Bedrock permissions for AI responses
    // Note: Bedrock cross-region inference profiles may redirect to different regions
    websocketDefaultFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream', // Required for streaming responses
        ],
        resources: [
          `arn:aws:bedrock:*::foundation-model/*`,
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      })
    );

    // Lambda invoke permission for session analysis (auto-trigger on session_end)
    this.sessionAnalysisFunction.grantInvoke(websocketDefaultFunction);

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

    const getCurrentUserIntegration = new apigateway.LambdaIntegration(
      this.getCurrentUserFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const organizationSettingsIntegration = new apigateway.LambdaIntegration(
      this.organizationSettingsFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const listSessionsIntegration = new apigateway.LambdaIntegration(this.listSessionsFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const createSessionIntegration = new apigateway.LambdaIntegration(this.createSessionFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const getSessionIntegration = new apigateway.LambdaIntegration(this.getSessionFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const listScenariosIntegration = new apigateway.LambdaIntegration(this.listScenariosFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const createScenarioIntegration = new apigateway.LambdaIntegration(
      this.createScenarioFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const getScenarioIntegration = new apigateway.LambdaIntegration(this.getScenarioFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const listAvatarsIntegration = new apigateway.LambdaIntegration(this.listAvatarsFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const createAvatarIntegration = new apigateway.LambdaIntegration(this.createAvatarFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const getAvatarIntegration = new apigateway.LambdaIntegration(this.getAvatarFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const updateScenarioIntegration = new apigateway.LambdaIntegration(
      this.updateScenarioFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const deleteScenarioIntegration = new apigateway.LambdaIntegration(
      this.deleteScenarioFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const updateAvatarIntegration = new apigateway.LambdaIntegration(this.updateAvatarFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const deleteAvatarIntegration = new apigateway.LambdaIntegration(this.deleteAvatarFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const cloneAvatarIntegration = new apigateway.LambdaIntegration(this.cloneAvatarFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    // セッション解析API統合
    const getAnalysisIntegration = new apigateway.LambdaIntegration(this.getAnalysisFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const triggerAnalysisIntegration = new apigateway.LambdaIntegration(
      this.triggerAnalysisFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const getScoreIntegration = new apigateway.LambdaIntegration(this.getScoreFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    // Guest User Integrations
    const createGuestSessionIntegration = new apigateway.LambdaIntegration(
      this.createGuestSessionFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const listGuestSessionsIntegration = new apigateway.LambdaIntegration(
      this.listGuestSessionsFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const getGuestSessionIntegration = new apigateway.LambdaIntegration(
      this.getGuestSessionFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const updateGuestSessionIntegration = new apigateway.LambdaIntegration(
      this.updateGuestSessionFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const deleteGuestSessionIntegration = new apigateway.LambdaIntegration(
      this.deleteGuestSessionFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    // レポート生成API統合
    const generateReportIntegration = new apigateway.LambdaIntegration(
      this.generateReportFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const batchCreateGuestSessionsIntegration = new apigateway.LambdaIntegration(
      this.batchCreateGuestSessionsFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const getGuestSessionLogsIntegration = new apigateway.LambdaIntegration(
      this.getGuestSessionLogsFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const completeGuestSessionIntegration = new apigateway.LambdaIntegration(
      this.completeGuestSessionFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const verifyGuestTokenIntegration = new apigateway.LambdaIntegration(
      this.verifyGuestTokenFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

    const authGuestIntegration = new apigateway.LambdaIntegration(this.authGuestFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    const getGuestSessionDataIntegration = new apigateway.LambdaIntegration(
      this.getGuestSessionDataFunction,
      {
        proxy: true,
        allowTestInvoke: props.environment !== 'production',
      }
    );

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

    // Organizations endpoints
    const organizationsResource = apiV1.addResource('organizations');

    const settingsResource = organizationsResource.addResource('settings');
    // GET /api/v1/organizations/settings (Get organization settings)
    settingsResource.addMethod('GET', organizationSettingsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });
    // PUT /api/v1/organizations/settings (Update organization settings)
    settingsResource.addMethod('PUT', organizationSettingsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });
    // PATCH /api/v1/organizations/settings (Update organization settings - partial)
    settingsResource.addMethod('PATCH', organizationSettingsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // Sessions endpoints
    const sessionsResource = apiV1.addResource('sessions');

    // GET /api/v1/sessions (List sessions)
    sessionsResource.addMethod('GET', listSessionsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/sessions (Create session)
    sessionsResource.addMethod('POST', createSessionIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // GET /api/v1/sessions/{id} (Get session by ID)
    const sessionIdResource = sessionsResource.addResource('{id}');
    sessionIdResource.addMethod('GET', getSessionIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // GET /api/v1/sessions/{id}/analysis (Get session analysis results)
    const analysisResource = sessionIdResource.addResource('analysis');
    analysisResource.addMethod('GET', getAnalysisIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/sessions/{id}/analyze (Trigger session analysis)
    const analyzeResource = sessionIdResource.addResource('analyze');
    analyzeResource.addMethod('POST', triggerAnalysisIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // GET /api/v1/sessions/{id}/score (Get session score)
    const scoreResource = sessionIdResource.addResource('score');
    scoreResource.addMethod('GET', getScoreIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/sessions/{id}/report (Generate PDF report)
    const reportResource = sessionIdResource.addResource('report');
    reportResource.addMethod('POST', generateReportIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // Scenarios endpoints
    const scenariosResource = apiV1.addResource('scenarios');

    // GET /api/v1/scenarios (List scenarios)
    scenariosResource.addMethod('GET', listScenariosIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/scenarios (Create scenario)
    scenariosResource.addMethod('POST', createScenarioIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // GET /api/v1/scenarios/{id} (Get scenario by ID)
    const scenarioIdResource = scenariosResource.addResource('{id}');
    scenarioIdResource.addMethod('GET', getScenarioIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // PUT /api/v1/scenarios/{id} (Update scenario)
    scenarioIdResource.addMethod('PUT', updateScenarioIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // DELETE /api/v1/scenarios/{id} (Delete scenario)
    scenarioIdResource.addMethod('DELETE', deleteScenarioIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // Avatars endpoints
    const avatarsResource = apiV1.addResource('avatars');

    // GET /api/v1/avatars (List avatars)
    avatarsResource.addMethod('GET', listAvatarsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/avatars (Create avatar)
    avatarsResource.addMethod('POST', createAvatarIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // GET /api/v1/avatars/{id} (Get avatar by ID)
    const avatarIdResource = avatarsResource.addResource('{id}');
    avatarIdResource.addMethod('GET', getAvatarIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // PUT /api/v1/avatars/{id} (Update avatar)
    avatarIdResource.addMethod('PUT', updateAvatarIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // DELETE /api/v1/avatars/{id} (Delete avatar)
    avatarIdResource.addMethod('DELETE', deleteAvatarIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/avatars/{id}/clone (Clone avatar)
    const avatarCloneResource = avatarIdResource.addResource('clone');
    avatarCloneResource.addMethod('POST', cloneAvatarIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // ==================== Guest User Endpoints ====================

    // Guest Sessions endpoints (Internal users only)
    const guestSessionsResource = apiV1.addResource('guest-sessions');

    // POST /api/v1/guest-sessions (Create guest session - CLIENT_ADMIN, CLIENT_USER)
    guestSessionsResource.addMethod('POST', createGuestSessionIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // GET /api/v1/guest-sessions (List guest sessions - CLIENT_ADMIN, CLIENT_USER)
    guestSessionsResource.addMethod('GET', listGuestSessionsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/guest-sessions/batch (Batch create - CLIENT_ADMIN, CLIENT_USER)
    const guestSessionsBatchResource = guestSessionsResource.addResource('batch');
    guestSessionsBatchResource.addMethod('POST', batchCreateGuestSessionsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // Guest Session by ID
    const guestSessionIdResource = guestSessionsResource.addResource('{id}');

    // GET /api/v1/guest-sessions/{id} (Get guest session - CLIENT_ADMIN, CLIENT_USER)
    guestSessionIdResource.addMethod('GET', getGuestSessionIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // PATCH /api/v1/guest-sessions/{id} (Update guest session - CLIENT_ADMIN only)
    guestSessionIdResource.addMethod('PATCH', updateGuestSessionIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // DELETE /api/v1/guest-sessions/{id} (Delete guest session - CLIENT_ADMIN only)
    guestSessionIdResource.addMethod('DELETE', deleteGuestSessionIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // POST /api/v1/guest-sessions/{id}/complete (Mark as completed - Guest or Internal)
    const guestSessionCompleteResource = guestSessionIdResource.addResource('complete');
    guestSessionCompleteResource.addMethod('POST', completeGuestSessionIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // GET /api/v1/guest-sessions/{id}/logs (Get audit logs - CLIENT_ADMIN only)
    const guestSessionLogsResource = guestSessionIdResource.addResource('logs');
    guestSessionLogsResource.addMethod('GET', getGuestSessionLogsIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // Guest Access endpoints (No authentication required or guest-only)
    const guestResource = apiV1.addResource('guest');

    // GET /api/v1/guest/verify/{token} (Verify guest token - No auth required)
    const guestVerifyResource = guestResource.addResource('verify').addResource('{token}');
    guestVerifyResource.addMethod('GET', verifyGuestTokenIntegration, {
      apiKeyRequired: false,
    });

    // POST /api/v1/guest/auth (Authenticate guest with PIN - No auth required)
    const guestAuthResource = guestResource.addResource('auth');
    guestAuthResource.addMethod('POST', authGuestIntegration, {
      apiKeyRequired: false,
    });

    // GET /api/v1/guest/session-data (Get session data - Guest only)
    const guestSessionDataResource = guestResource.addResource('session-data');
    guestSessionDataResource.addMethod('GET', getGuestSessionDataIntegration, {
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

    // ==================== WebSocket API Integration ====================

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

    // WebSocket Deployment
    const wsDeployment = new apigatewayv2.CfnDeployment(this, 'WebSocketDeployment', {
      apiId: this.webSocketApi.ref,
    });

    // Deployment depends on routes
    wsDeployment.addDependency(connectRoute);
    wsDeployment.addDependency(disconnectRoute);
    wsDeployment.addDependency(defaultRoute);

    // WebSocket Stage
    const _wsStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', {
      apiId: this.webSocketApi.ref,
      stageName: props.environment,
      deploymentId: wsDeployment.ref,
      defaultRouteSettings: {
        dataTraceEnabled: props.environment !== 'production',
        loggingLevel: props.environment === 'production' ? 'ERROR' : 'INFO',
        throttlingBurstLimit: 500,
        throttlingRateLimit: 1000,
      },
    });

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

    // Lambda関数にSecretsとRDSへのアクセス権限を付与
    props.databaseSecret.grantRead(this.registerFunction);
    props.databaseSecret.grantRead(this.loginFunction);
    props.databaseSecret.grantRead(this.getCurrentUserFunction);
    props.databaseSecret.grantRead(this.migrationFunction);
    props.databaseSecret.grantRead(this.listSessionsFunction);
    props.databaseSecret.grantRead(this.createSessionFunction);
    props.databaseSecret.grantRead(this.getSessionFunction);
    props.databaseSecret.grantRead(this.listScenariosFunction);
    props.databaseSecret.grantRead(this.createScenarioFunction);
    props.databaseSecret.grantRead(this.getScenarioFunction);
    props.databaseSecret.grantRead(this.listAvatarsFunction);
    props.databaseSecret.grantRead(this.createAvatarFunction);
    props.databaseSecret.grantRead(this.getAvatarFunction);
    props.databaseSecret.grantRead(this.updateAvatarFunction);
    props.databaseSecret.grantRead(this.deleteAvatarFunction);
    props.databaseSecret.grantRead(this.cloneAvatarFunction);
    props.databaseSecret.grantRead(this.generateReportFunction);

    // RDSクラスターへの接続を許可
    props.databaseCluster.connections.allowDefaultPortFrom(this.registerFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.loginFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.getCurrentUserFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.migrationFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.listSessionsFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.createSessionFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.getSessionFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.listScenariosFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.createScenarioFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.getScenarioFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.listAvatarsFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.createAvatarFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.getAvatarFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.updateAvatarFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.deleteAvatarFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.cloneAvatarFunction);
    props.databaseCluster.connections.allowDefaultPortFrom(this.generateReportFunction);

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

    new cdk.CfnOutput(this, 'ListSessionsFunctionArn', {
      value: this.listSessionsFunction.functionArn,
      description: 'List Sessions Lambda Function ARN',
      exportName: `${props.environment}-ListSessionsFunctionArn`,
    });

    new cdk.CfnOutput(this, 'CreateSessionFunctionArn', {
      value: this.createSessionFunction.functionArn,
      description: 'Create Session Lambda Function ARN',
      exportName: `${props.environment}-CreateSessionFunctionArn`,
    });

    new cdk.CfnOutput(this, 'GetSessionFunctionArn', {
      value: this.getSessionFunction.functionArn,
      description: 'Get Session Lambda Function ARN',
      exportName: `${props.environment}-GetSessionFunctionArn`,
    });

    new cdk.CfnOutput(this, 'ListScenariosFunctionArn', {
      value: this.listScenariosFunction.functionArn,
      description: 'List Scenarios Lambda Function ARN',
      exportName: `${props.environment}-ListScenariosFunctionArn`,
    });

    new cdk.CfnOutput(this, 'CreateScenarioFunctionArn', {
      value: this.createScenarioFunction.functionArn,
      description: 'Create Scenario Lambda Function ARN',
      exportName: `${props.environment}-CreateScenarioFunctionArn`,
    });

    new cdk.CfnOutput(this, 'GetScenarioFunctionArn', {
      value: this.getScenarioFunction.functionArn,
      description: 'Get Scenario Lambda Function ARN',
      exportName: `${props.environment}-GetScenarioFunctionArn`,
    });

    new cdk.CfnOutput(this, 'ScenariosEndpoints', {
      value: JSON.stringify({
        list: `${this.restApi.url}api/v1/scenarios`,
        create: `${this.restApi.url}api/v1/scenarios`,
        get: `${this.restApi.url}api/v1/scenarios/{id}`,
      }),
      description: 'Scenarios API Endpoints',
    });

    new cdk.CfnOutput(this, 'ListAvatarsFunctionArn', {
      value: this.listAvatarsFunction.functionArn,
      description: 'List Avatars Lambda Function ARN',
      exportName: `${props.environment}-ListAvatarsFunctionArn`,
    });

    new cdk.CfnOutput(this, 'CreateAvatarFunctionArn', {
      value: this.createAvatarFunction.functionArn,
      description: 'Create Avatar Lambda Function ARN',
      exportName: `${props.environment}-CreateAvatarFunctionArn`,
    });

    new cdk.CfnOutput(this, 'GetAvatarFunctionArn', {
      value: this.getAvatarFunction.functionArn,
      description: 'Get Avatar Lambda Function ARN',
      exportName: `${props.environment}-GetAvatarFunctionArn`,
    });

    new cdk.CfnOutput(this, 'AvatarsEndpoints', {
      value: JSON.stringify({
        list: `${this.restApi.url}api/v1/avatars`,
        create: `${this.restApi.url}api/v1/avatars`,
        get: `${this.restApi.url}api/v1/avatars/{id}`,
      }),
      description: 'Avatars API Endpoints',
    });

    new cdk.CfnOutput(this, 'GenerateReportFunctionArn', {
      value: this.generateReportFunction.functionArn,
      description: 'Generate Report Lambda Function ARN',
      exportName: `${props.environment}-GenerateReportFunctionArn`,
    });

    new cdk.CfnOutput(this, 'GenerateReportFunctionName', {
      value: this.generateReportFunction.functionName,
      description: 'Generate Report Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'SessionsEndpoints', {
      value: JSON.stringify({
        list: `${this.restApi.url}api/v1/sessions`,
        create: `${this.restApi.url}api/v1/sessions`,
        get: `${this.restApi.url}api/v1/sessions/{id}`,
        report: `${this.restApi.url}api/v1/sessions/{id}/report`,
      }),
      description: 'Sessions API Endpoints',
    });
  }
}
