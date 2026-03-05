import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface LambdaStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  restApi: apigateway.RestApi;
  authorizerFunction: lambda.IFunction;
}

export class LambdaStack extends cdk.Stack {
  public readonly healthCheckFunction: nodejs.NodejsFunction;
  public readonly registerFunction: nodejs.NodejsFunction;
  public readonly loginFunction: nodejs.NodejsFunction;
  public readonly getCurrentUserFunction: nodejs.NodejsFunction;
  public readonly authorizer: apigateway.TokenAuthorizer;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Token Authorizer（JWT検証）- AuthorizerStackから渡されたLambda関数を使用
    this.authorizer = new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
      handler: props.authorizerFunction,
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
        externalModules: ['aws-sdk', '@aws-sdk/*', '@prisma/client'],
        // bcryptjsとjsonwebtokenはバンドルに含める
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            // inputDirは /asset-input/infrastructure/lambda/auth/register
            // Prismaファイルは /asset-input/packages/database にある
            const prismaPath = '/asset-input/packages/database';
            return [
              `cd ${outputDir}`,
              `cp -r ${prismaPath}/node_modules/.prisma .`,
              `cp -r ${prismaPath}/prisma .`,
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
      memorySize: 512, // Prisma使用のため増量
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk', '@aws-sdk/*', '@prisma/client'],
        // bcryptjsとjsonwebtokenはバンドルに含める
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            // inputDirは /asset-input/infrastructure/lambda/auth/register
            // Prismaファイルは /asset-input/packages/database にある
            const prismaPath = '/asset-input/packages/database';
            return [
              `cd ${outputDir}`,
              `cp -r ${prismaPath}/node_modules/.prisma .`,
              `cp -r ${prismaPath}/prisma .`,
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
      memorySize: 512, // Prisma使用のため増量
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk', '@aws-sdk/*', '@prisma/client'],
        // jsonwebtokenはバンドルに含める
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            // inputDirは /asset-input/infrastructure/lambda/auth/register
            // Prismaファイルは /asset-input/packages/database にある
            const prismaPath = '/asset-input/packages/database';
            return [
              `cd ${outputDir}`,
              `cp -r ${prismaPath}/node_modules/.prisma .`,
              `cp -r ${prismaPath}/prisma .`,
            ];
          },
          beforeInstall(): string[] {
            return [];
          },
        },
      },
    });

    // API Gatewayとの統合
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
    const apiV1 = props.restApi.root.resourceForPath('api/v1');

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
      // 認証不要（新規登録）
    });

    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', loginIntegration, {
      apiKeyRequired: false,
      // 認証不要（ログイン）
    });

    // Users endpoints
    const usersResource = apiV1.addResource('users');

    const meResource = usersResource.addResource('me');
    meResource.addMethod('GET', getCurrentUserIntegration, {
      apiKeyRequired: false,
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // API Gatewayのデプロイメント（全てのメソッド追加後）
    const deployment = new apigateway.Deployment(this, 'ApiDeployment', {
      api: props.restApi,
      description: `Deployment at ${new Date().toISOString()}`,
    });

    // デプロイメントが全てのメソッドに依存することを明示
    deployment.node.addDependency(healthResource);
    deployment.node.addDependency(registerResource);
    deployment.node.addDependency(loginResource);
    deployment.node.addDependency(meResource);

    // CloudWatch Logs ロググループ
    const restApiLogGroup = new logs.LogGroup(this, 'RestApiLogGroup', {
      logGroupName: `/aws/apigateway/prance-rest-api-${props.environment}`,
      retention: props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ステージの作成
    const stage = new apigateway.Stage(this, 'ApiStage', {
      deployment,
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
    });

    props.restApi.deploymentStage = stage;

    // Usage Plan (レート制限)
    const usagePlan = props.restApi.addUsagePlan('UsagePlan', {
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

    usagePlan.addApiStage({
      stage,
    });

    // Outputs
    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: `https://${props.restApi.restApiId}.execute-api.${this.region}.amazonaws.com/${props.environment}/`,
      description: 'REST API URL',
      exportName: `${props.environment}-RestApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiStageName', {
      value: stage.stageName,
      description: 'API Gateway Stage Name',
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

    new cdk.CfnOutput(this, 'AuthEndpoints', {
      value: JSON.stringify({
        register: `${props.restApi.url}api/v1/auth/register`,
        login: `${props.restApi.url}api/v1/auth/login`,
      }),
      description: 'Auth API Endpoints',
    });

    new cdk.CfnOutput(this, 'UsersEndpoints', {
      value: JSON.stringify({
        me: `${props.restApi.url}api/v1/users/me`,
      }),
      description: 'Users API Endpoints',
    });
  }
}
