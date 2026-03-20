#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { NetworkStack } from '../lib/network-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { DatabaseStack } from '../lib/database-stack';
import { StorageStack } from '../lib/storage-stack';
import { DynamoDBStack } from '../lib/dynamodb-stack';
import { GuestRateLimitStack } from '../lib/guest-rate-limit-stack';
import { ApiLambdaStack } from '../lib/api-lambda-stack';
import { DnsStack } from '../lib/dns-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { ApiGatewayDomainStack } from '../lib/api-gateway-domain-stack';
import { ElastiCacheStack } from '../lib/elasticache-stack';
// import { NextJsLambdaStack } from '../lib/nextjs-lambda-stack'; // Temporarily disabled for Phase 1.6
import { getConfig } from '../lib/config';

// Load environment variables from .env file
dotenvConfig({ path: resolve(__dirname, '../.env') });

const app = new cdk.App();

// Default AWS region (centralized constant)
const DEFAULT_AWS_REGION = 'us-east-1';

// 環境変数から設定を取得
const environment: string = (app.node.tryGetContext('environment') as string | undefined) || 'dev';
const account: string = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT || '';
const region: string =
  process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || DEFAULT_AWS_REGION;

// 環境設定を取得
const config = getConfig(environment);

const env = {
  account,
  region,
};

// 証明書用のus-east-1環境（CloudFrontで必須）
const envUsEast1 = {
  account,
  region: DEFAULT_AWS_REGION, // CloudFront certificates must be in us-east-1
};

// Stack名のプレフィックス
const stackPrefix = `Prance-${environment}`;

// DNS スタック（Route 53）
const dnsStack = new DnsStack(app, `${stackPrefix}-DNS`, {
  env,
  config,
  description: 'Prance Platform - Route 53 DNS Configuration',
});

// SSL/TLS 証明書スタック（us-east-1に作成 - CloudFront用）
// Production環境では手動取得済み証明書を使用
let certificate: acm.ICertificate;
let certificateStack: CertificateStack | undefined;

if (environment === 'production') {
  // Production: 手動取得済み証明書をインポート
  certificate = acm.Certificate.fromCertificateArn(
    app,
    `${stackPrefix}-ImportedCertificate`,
    'arn:aws:acm:us-east-1:010438500933:certificate/782586aa-201a-429f-8207-f49c9ebcaf41'
  );
} else {
  // Dev/Staging: CDKで証明書を自動作成
  certificateStack = new CertificateStack(app, `${stackPrefix}-Certificate`, {
    env: envUsEast1, // CloudFrontで使用するためus-east-1に作成
    config,
    hostedZone: dnsStack.hostedZone,
    description: 'Prance Platform - ACM SSL/TLS Certificate',
    crossRegionReferences: true, // クロスリージョン参照を有効化
  });
  certificate = certificateStack.certificate;
}

// ネットワークスタック
const networkStack = new NetworkStack(app, `${stackPrefix}-Network`, {
  env,
  environment,
  description: 'Prance Platform - VPC and Network Resources',
});

// Cognitoスタック
const cognitoStack = new CognitoStack(app, `${stackPrefix}-Cognito`, {
  env,
  environment,
  description: 'Prance Platform - User Authentication (Cognito)',
});

// データベーススタック
const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  environment,
  vpc: networkStack.vpc,
  description: 'Prance Platform - Aurora Serverless v2 Database',
});

// ストレージスタック
const storageStack = new StorageStack(app, `${stackPrefix}-Storage`, {
  env,
  config,
  certificate: certificate,
  hostedZone: dnsStack.hostedZone,
  description: 'Prance Platform - S3 Storage and CloudFront CDN',
  crossRegionReferences: true, // クロスリージョン参照を有効化
});

// DynamoDBスタック
const dynamoDBStack = new DynamoDBStack(app, `${stackPrefix}-DynamoDB`, {
  env,
  environment,
  description: 'Prance Platform - DynamoDB Tables',
});

// Guest Rate Limit スタック
const guestRateLimitStack = new GuestRateLimitStack(app, `${stackPrefix}-GuestRateLimit`, {
  env,
  environment,
  description: 'Prance Platform - Guest Session Rate Limiting',
});

// ElastiCache スタック（Phase 5: Runtime Configuration Management）
const elastiCacheStack = new ElastiCacheStack(app, `${stackPrefix}-ElastiCache`, {
  env,
  vpc: networkStack.vpc,
  environment: config,
  description: 'Prance Platform - ElastiCache Serverless for Runtime Config',
});

// API + Lambda + Authorizerスタック（完全統合）
const apiLambdaStack = new ApiLambdaStack(app, `${stackPrefix}-ApiLambda`, {
  env,
  environment,
  vpc: networkStack.vpc,
  lambdaSecurityGroup: networkStack.lambdaSecurityGroup,
  databaseCluster: databaseStack.cluster,
  databaseSecret: databaseStack.secret,
  websocketConnectionsTable: dynamoDBStack.websocketConnectionsTable,
  recordingsBucket: storageStack.recordingsBucket,
  guestRateLimitTable: guestRateLimitStack.table,
  sessionRateLimitTable: dynamoDBStack.sessionRateLimitTable, // Phase 1.6: Token Bucket rate limiting
  benchmarkCacheTable: dynamoDBStack.benchmarkCacheTable, // Phase 4: Benchmark cache
  userSessionHistoryTable: dynamoDBStack.userSessionHistoryTable, // Phase 4: User session history
  description: 'Prance Platform - API Gateway, Lambda Functions, and Authorizer',
});

// Monitoring Stack (Phase 1.6 Performance Monitoring)
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  environment,
  websocketLambdaFunction: apiLambdaStack.websocketDefaultFunction,
  alertEmail: process.env.ALERT_EMAIL, // Optional: Set in .env for email alerts
  description: 'Prance Platform - CloudWatch Monitoring and Alarms (Phase 1.6)',
});

// API Gateway Custom Domains Stack (Phase 3.1)
const apiGatewayDomainStack = new ApiGatewayDomainStack(app, `${stackPrefix}-ApiDomains`, {
  env,
  config,
  certificate: certificate,
  hostedZone: dnsStack.hostedZone,
  restApi: apiLambdaStack.restApi,
  webSocketApi: apiLambdaStack.webSocketApi,
  webSocketStage: apiLambdaStack.webSocketStage,
  description: 'Prance Platform - API Gateway Custom Domains',
  crossRegionReferences: true,
});

// Next.js Lambda Stack
// TODO: Temporarily disabled for Phase 1.6 monitoring deployment
// Requires: bash scripts/build-nextjs-standalone.sh && bash scripts/package-nextjs-lambda.sh
/*
const nextJsLambdaStack = new NextJsLambdaStack(app, `${stackPrefix}-NextJs`, {
  env,
  config,
  certificate: certificate,
  hostedZone: dnsStack.hostedZone,
  description: 'Prance Platform - Next.js SSR on Lambda (Standalone Build)',
  crossRegionReferences: true,
});
*/

// スタック依存関係の設定（デプロイ順序を保証）
if (certificateStack) {
  certificateStack.addDependency(dnsStack);
  storageStack.addDependency(certificateStack);
  apiGatewayDomainStack.addDependency(certificateStack);
  // nextJsLambdaStack.addDependency(certificateStack); // Disabled for Phase 1.6
} else {
  // Production環境: 手動証明書使用時はDNSに依存
  storageStack.addDependency(dnsStack);
  apiGatewayDomainStack.addDependency(dnsStack);
  // nextJsLambdaStack.addDependency(dnsStack); // Disabled for Phase 1.6
}
databaseStack.addDependency(networkStack);
cognitoStack.addDependency(networkStack);
elastiCacheStack.addDependency(networkStack);
apiLambdaStack.addDependency(networkStack);
apiLambdaStack.addDependency(databaseStack);
apiLambdaStack.addDependency(dynamoDBStack);
apiLambdaStack.addDependency(storageStack);
apiLambdaStack.addDependency(elastiCacheStack);
monitoringStack.addDependency(apiLambdaStack);
apiGatewayDomainStack.addDependency(apiLambdaStack);
// nextJsLambdaStack.addDependency(apiGatewayDomainStack); // API URLsが先に必要 // Disabled for Phase 1.6

// タグ付け
cdk.Tags.of(app).add('Project', 'Prance');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
