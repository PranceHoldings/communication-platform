import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  environment: string;
  userPool: cognito.UserPool;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigatewayv2.CfnApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // CloudWatch Logs ロググループ
    const restApiLogGroup = new logs.LogGroup(this, 'RestApiLogGroup', {
      logGroupName: `/aws/apigateway/prance-rest-api-${props.environment}`,
      retention: props.environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // REST API
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `prance-api-${props.environment}`,
      description: `Prance Platform REST API - ${props.environment}`,
      deploy: true,
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

    // Cognito Authorizer
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: `prance-authorizer-${props.environment}`,
      identitySource: 'method.request.header.Authorization',
    });

    // APIリソース構造の基本定義
    const apiV1 = this.restApi.root.addResource('api').addResource('v1');

    // ヘルスチェックエンドポイント（認証不要）
    const health = this.restApi.root.addResource('health');
    health.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({
            status: 'healthy',
            environment: props.environment,
            timestamp: '$context.requestTime',
          }),
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{ statusCode: '200' }],
    });

    // 認証済みヘルスチェック（Authorizerのテスト用）
    const secureHealth = apiV1.addResource('secure-health');
    secureHealth.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({
            status: 'healthy',
            message: 'Authenticated',
          }),
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      methodResponses: [{ statusCode: '200' }],
    });

    // Usage Plan (レート制限)
    const usagePlan = this.restApi.addUsagePlan('UsagePlan', {
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
      stage: this.restApi.deploymentStage,
    });

    // WebSocket API (AWS IoT Core代替として、まずAPI Gateway WebSocketで実装)
    // 注: 本番環境ではAWS IoT Coreに移行予定
    this.webSocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `prance-websocket-api-${props.environment}`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      description: `Prance Platform WebSocket API - ${props.environment}`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: this.restApi.url,
      description: 'REST API URL',
      exportName: `${props.environment}-RestApiUrl`,
    });

    new cdk.CfnOutput(this, 'RestApiId', {
      value: this.restApi.restApiId,
      description: 'REST API ID',
      exportName: `${props.environment}-RestApiId`,
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
  }
}
