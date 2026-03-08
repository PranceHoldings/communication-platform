import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface AuthorizerStackProps extends cdk.StackProps {
  environment: string;
}

export class AuthorizerStack extends cdk.Stack {
  public readonly authorizerFunction: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: AuthorizerStackProps) {
    super(scope, id, props);

    // Authorizer用の環境変数（DBアクセス不要）
    const authorizerEnvironment = {
      ENVIRONMENT: props.environment,
      LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
      NODE_ENV: props.environment === 'production' ? 'production' : 'development',
      JWT_SECRET: process.env.JWT_SECRET || 'development-secret-change-in-production',
    };

    // JWT Authorizer Lambda関数（VPC不要、DB接続なし）
    this.authorizerFunction = new nodejs.NodejsFunction(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
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
      environment: authorizerEnvironment,
      bundling: {
        minify: props.environment === 'production',
        sourceMap: true,
        target: 'es2020',
        externalModules: ['aws-sdk'],
        // jsonwebtokenはバンドルに含める（externalModulesに含めない）
      },
      // VPC接続不要（DB接続なし）
    });

    // Note: TokenAuthorizerはLambdaStackで作成されます（RestApiへの参照が必要なため）

    // Outputs
    new cdk.CfnOutput(this, 'AuthorizerFunctionArn', {
      value: this.authorizerFunction.functionArn,
      description: 'JWT Authorizer Lambda Function ARN',
      exportName: `${props.environment}-AuthorizerFunctionArn`,
    });

    new cdk.CfnOutput(this, 'AuthorizerFunctionName', {
      value: this.authorizerFunction.functionName,
      description: 'JWT Authorizer Lambda Function Name',
    });
  }
}
