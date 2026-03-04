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
  authorizer: apigateway.CognitoUserPoolsAuthorizer;
}

export class LambdaStack extends cdk.Stack {
  public readonly healthCheckFunction: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Lambda共通環境変数
    const commonEnvironment = {
      ENVIRONMENT: props.environment,
      LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
      NODE_ENV: props.environment === 'production' ? 'production' : 'development',
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

    // API Gatewayとの統合
    const apiIntegration = new apigateway.LambdaIntegration(this.healthCheckFunction, {
      proxy: true,
      allowTestInvoke: props.environment !== 'production',
    });

    // APIリソースの作成
    const apiV1 = props.restApi.root.resourceForPath('api/v1');
    const healthResource = apiV1.addResource('health');
    healthResource.addMethod('GET', apiIntegration, {
      apiKeyRequired: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'HealthCheckFunctionArn', {
      value: this.healthCheckFunction.functionArn,
      description: 'Health Check Lambda Function ARN',
      exportName: `${props.environment}-HealthCheckFunctionArn`,
    });

    new cdk.CfnOutput(this, 'HealthCheckFunctionName', {
      value: this.healthCheckFunction.functionName,
      description: 'Health Check Lambda Function Name',
    });
  }
}
