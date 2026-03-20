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
  public readonly userSessionHistoryTable: dynamodb.Table; // Phase 4: User session history for growth tracking
  public readonly apiRateLimitTable: dynamodb.Table;
  public readonly sessionRateLimitTable: dynamodb.Table; // Phase 1.6: Token Bucket rate limiting

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

    // ベンチマークキャッシュテーブル (Phase 4: Profile-based benchmarking)
    this.benchmarkCacheTable = new dynamodb.Table(this, 'BenchmarkCacheTable', {
      tableName: `prance-benchmark-cache-v2-${props.environment}`, // v2: New schema with profileHash + metric
      partitionKey: {
        name: 'profileHash', // SHA256(scenarioId + userAttributes) for profile-based grouping
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'metric', // Metric type: "overallScore" | "emotionScore" | "audioScore" | ...
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl', // Cache expires after 7 days
      pointInTimeRecovery: props.environment === 'production',
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI: metricによる検索（全プロファイルから特定メトリクスを取得）
    this.benchmarkCacheTable.addGlobalSecondaryIndex({
      indexName: 'MetricIndex',
      partitionKey: {
        name: 'metric',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'profileHash',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ユーザーセッション履歴テーブル (Phase 4: Growth tracking)
    this.userSessionHistoryTable = new dynamodb.Table(this, 'UserSessionHistoryTable', {
      tableName: `prance-user-session-history-${props.environment}`,
      partitionKey: {
        name: 'userId', // User ID
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sessionId', // Session ID (allows chronological ordering)
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl', // History expires after 90 days
      pointInTimeRecovery: props.environment === 'production',
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI: scenarioIdによる検索（特定シナリオの履歴を取得）
    this.userSessionHistoryTable.addGlobalSecondaryIndex({
      indexName: 'ScenarioIndex',
      partitionKey: {
        name: 'scenarioId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'completedAt', // ISO8601 timestamp for chronological ordering
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
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

    // セッション内レート制限テーブル (Phase 1.6: Token Bucket algorithm)
    this.sessionRateLimitTable = new dynamodb.Table(this, 'SessionRateLimitTable', {
      tableName: `prance-session-rate-limit-${props.environment}`,
      partitionKey: {
        name: 'limitKey', // Unique key (e.g., audio:sessionId, video:sessionId)
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Rate limit data is temporary
    });

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
      description: 'Benchmark Cache DynamoDB Table Name (Phase 4: Profile-based benchmarking)',
      exportName: `${props.environment}-BenchmarkCacheTableName`,
    });

    new cdk.CfnOutput(this, 'UserSessionHistoryTableName', {
      value: this.userSessionHistoryTable.tableName,
      description: 'User Session History DynamoDB Table Name (Phase 4: Growth tracking)',
      exportName: `${props.environment}-UserSessionHistoryTableName`,
    });

    new cdk.CfnOutput(this, 'ApiRateLimitTableName', {
      value: this.apiRateLimitTable.tableName,
      description: 'API Rate Limit DynamoDB Table Name',
      exportName: `${props.environment}-ApiRateLimitTableName`,
    });

    new cdk.CfnOutput(this, 'SessionRateLimitTableName', {
      value: this.sessionRateLimitTable.tableName,
      description: 'Session Rate Limit DynamoDB Table Name (Token Bucket)',
      exportName: `${props.environment}-SessionRateLimitTableName`,
    });
  }
}
