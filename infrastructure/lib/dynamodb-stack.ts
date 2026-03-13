import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DynamoDBStackProps extends cdk.StackProps {
  environment: string;
}

export class DynamoDBStack extends cdk.Stack {
  public readonly sessionsStateTable: dynamodb.Table;
  public readonly websocketConnectionsTable: dynamodb.Table;
  public readonly benchmarkCacheTable: dynamodb.Table;
  public readonly apiRateLimitTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id, props);

    // セッション状態管理テーブル
    this.sessionsStateTable = new dynamodb.Table(this, 'SessionsStateTable', {
      tableName: `prance-sessions-state-${props.environment}`,
      partitionKey: {
        name: 'session_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // オンデマンドモード
      timeToLiveAttribute: 'ttl',
      pointInTimeRecovery: props.environment === 'production',
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // WebSocket接続管理テーブル
    this.websocketConnectionsTable = new dynamodb.Table(this, 'WebSocketConnectionsTable', {
      tableName: `prance-websocket-connections-${props.environment}`,
      partitionKey: {
        name: 'connection_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 接続情報は一時的なので常に削除
    });

    // user_idでの検索用GSI
    this.websocketConnectionsTable.addGlobalSecondaryIndex({
      indexName: 'user-id-index',
      partitionKey: {
        name: 'user_id',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ベンチマークキャッシュテーブル
    this.benchmarkCacheTable = new dynamodb.Table(this, 'BenchmarkCacheTable', {
      tableName: `prance-benchmark-cache-${props.environment}`,
      partitionKey: {
        name: 'pk', // org_id#timeframe (例: org_123#month)
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk', // metric_type (例: score_distribution)
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecovery: props.environment === 'production',
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // APIレート制限カウンターテーブル
    this.apiRateLimitTable = new dynamodb.Table(this, 'ApiRateLimitTable', {
      tableName: `prance-api-rate-limit-${props.environment}`,
      partitionKey: {
        name: 'pk', // api_key_id#window_type (例: key_123#hourly)
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk', // window_timestamp
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // レート制限は一時的なデータ
    });

    // 録画メタデータテーブル - Removed: Now using PostgreSQL (Prisma Recording model)

    // Outputs
    new cdk.CfnOutput(this, 'SessionsStateTableName', {
      value: this.sessionsStateTable.tableName,
      description: 'Sessions State DynamoDB Table Name',
      exportName: `${props.environment}-SessionsStateTableName`,
    });

    new cdk.CfnOutput(this, 'WebSocketConnectionsTableName', {
      value: this.websocketConnectionsTable.tableName,
      description: 'WebSocket Connections DynamoDB Table Name',
      exportName: `${props.environment}-WebSocketConnectionsTableName`,
    });

    new cdk.CfnOutput(this, 'BenchmarkCacheTableName', {
      value: this.benchmarkCacheTable.tableName,
      description: 'Benchmark Cache DynamoDB Table Name',
      exportName: `${props.environment}-BenchmarkCacheTableName`,
    });

    new cdk.CfnOutput(this, 'ApiRateLimitTableName', {
      value: this.apiRateLimitTable.tableName,
      description: 'API Rate Limit DynamoDB Table Name',
      exportName: `${props.environment}-ApiRateLimitTableName`,
    });
  }
}
