#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
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
import { AmplifyStack } from '../lib/amplify-stack';
import { ApiGatewayDomainStack } from '../lib/api-gateway-domain-stack';
import { NextJsLambdaStack } from '../lib/nextjs-lambda-stack';
import { getConfig } from '../lib/config';

// Load environment variables from .env file
dotenvConfig({ path: resolve(__dirname, '../.env') });

const app = new cdk.App();

// Default AWS region (centralized constant)
const DEFAULT_AWS_REGION = 'us-east-1';

// 環境変数から設定を取得
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || DEFAULT_AWS_REGION;

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
const certificateStack = new CertificateStack(app, `${stackPrefix}-Certificate`, {
  env: envUsEast1, // CloudFrontで使用するためus-east-1に作成
  config,
  hostedZone: dnsStack.hostedZone,
  description: 'Prance Platform - ACM SSL/TLS Certificate',
  crossRegionReferences: true, // クロスリージョン参照を有効化
});

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
  certificate: certificateStack.certificate,
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
  description: 'Prance Platform - API Gateway, Lambda Functions, and Authorizer',
});

// Monitoring Stack (Phase 1.5 Performance Monitoring)
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  environment,
  // websocketLambdaFunction: apiLambdaStack.websocketDefaultFunction, // TODO: Export from ApiLambdaStack
  alertEmail: process.env.ALERT_EMAIL, // Optional: Set in .env for email alerts
  description: 'Prance Platform - CloudWatch Monitoring and Alarms (Phase 1.5)',
});

// API Gateway Custom Domains Stack (Phase 3.1)
const apiGatewayDomainStack = new ApiGatewayDomainStack(app, `${stackPrefix}-ApiDomains`, {
  env,
  config,
  certificate: certificateStack.certificate,
  hostedZone: dnsStack.hostedZone,
  restApi: apiLambdaStack.restApi,
  webSocketApi: apiLambdaStack.webSocketApi,
  webSocketStage: apiLambdaStack.webSocketStage,
  description: 'Prance Platform - API Gateway Custom Domains',
  crossRegionReferences: true,
});

// Amplify Hosting Stack (Phase 3.1) - DEPRECATED
// Replaced with Lambda-based Next.js deployment for better monorepo support
// const amplifyStack = new AmplifyStack(app, `${stackPrefix}-Amplify`, {
//   env,
//   config,
//   certificate: certificateStack.certificate,
//   hostedZone: dnsStack.hostedZone,
//   description: 'Prance Platform - Amplify Hosting (Next.js SSR)',
//   crossRegionReferences: true,
// });

// Next.js Lambda Stack (Phase 3.2) - Replaces Amplify
const nextJsLambdaStack = new NextJsLambdaStack(app, `${stackPrefix}-NextJs`, {
  env,
  config,
  certificate: certificateStack.certificate,
  hostedZone: dnsStack.hostedZone,
  description: 'Prance Platform - Next.js SSR on Lambda (Standalone Build)',
  crossRegionReferences: true,
});

// スタック依存関係の設定（デプロイ順序を保証）
certificateStack.addDependency(dnsStack);
storageStack.addDependency(certificateStack);
databaseStack.addDependency(networkStack);
cognitoStack.addDependency(networkStack);
apiLambdaStack.addDependency(networkStack);
apiLambdaStack.addDependency(databaseStack);
apiLambdaStack.addDependency(dynamoDBStack);
apiLambdaStack.addDependency(storageStack);
monitoringStack.addDependency(apiLambdaStack);
apiGatewayDomainStack.addDependency(apiLambdaStack);
apiGatewayDomainStack.addDependency(certificateStack);
// amplifyStack.addDependency(certificateStack);
// amplifyStack.addDependency(apiGatewayDomainStack); // API URLsが先に必要
nextJsLambdaStack.addDependency(certificateStack);
nextJsLambdaStack.addDependency(apiGatewayDomainStack); // API URLsが先に必要

// タグ付け
cdk.Tags.of(app).add('Project', 'Prance');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
