import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  environment: string;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigatewayv2.CfnApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

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

    // REST API（デプロイは手動で制御 - Lambda統合後に実行）
    // CORS設定: Dev環境ではlocalhost:3000を許可、Production環境では特定ドメインのみ
    const allowedOrigins =
      props.environment === 'production'
        ? ['https://app.prance.jp']
        : ['http://localhost:3000', 'https://app.prance.jp'];

    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `prance-api-${props.environment}`,
      description: `Prance Platform REST API - ${props.environment}`,
      deploy: false, // Lambda統合後に手動でデプロイ
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    // Gateway Responses - エラーレスポンスにもCORSヘッダーを追加
    // CRITICAL: Lambda Authorizerが401/403を返す際にCORSヘッダーが必要
    this.restApi.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${allowedOrigins.join(',')}'`,
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Api-Key'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    this.restApi.addGatewayResponse('AccessDenied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${allowedOrigins.join(',')}'`,
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Api-Key'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    // Note: Lambda Authorizer (JWT) は LambdaStack で作成されます

    // APIリソース構造の基本定義
    // Note: 全てのエンドポイントはLambdaStackで作成されます（Deployment制御のため）

    // WebSocket API (AWS IoT Core代替として、まずAPI Gateway WebSocketで実装)
    // 注: 本番環境ではAWS IoT Coreに移行予定
    this.webSocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `prance-websocket-api-${props.environment}`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      description: `Prance Platform WebSocket API - ${props.environment}`,
    });

    // Outputs
    // Note: RestApiUrl は LambdaStack で出力されます（デプロイメント後）

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
