#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { DatabaseStack } from '../lib/database-stack';
import { StorageStack } from '../lib/storage-stack';
import { DynamoDBStack } from '../lib/dynamodb-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { DnsStack } from '../lib/dns-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { getConfig } from '../lib/config';

const app = new cdk.App();

// 環境変数から設定を取得
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

// 環境設定を取得
const config = getConfig(environment);

const env = {
  account,
  region,
};

// 証明書用のus-east-1環境（CloudFrontで必須）
const envUsEast1 = {
  account,
  region: 'us-east-1',
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

// API Gatewayスタック
const apiGatewayStack = new ApiGatewayStack(app, `${stackPrefix}-ApiGateway`, {
  env,
  environment,
  userPool: cognitoStack.userPool,
  description: 'Prance Platform - API Gateway (REST & WebSocket)',
});

// Lambdaスタック
const lambdaStack = new LambdaStack(app, `${stackPrefix}-Lambda`, {
  env,
  environment,
  vpc: networkStack.vpc,
  lambdaSecurityGroup: networkStack.lambdaSecurityGroup,
  restApi: apiGatewayStack.restApi,
  authorizer: apiGatewayStack.authorizer,
  description: 'Prance Platform - Lambda Functions',
});

// スタック依存関係の設定（デプロイ順序を保証）
certificateStack.addDependency(dnsStack);
storageStack.addDependency(certificateStack);
databaseStack.addDependency(networkStack);
cognitoStack.addDependency(networkStack);
apiGatewayStack.addDependency(cognitoStack);
// LambdaStackはApiGatewayStackのrestApiを使用するため、自動的に依存関係が設定される
// lambdaStack.addDependency(apiGatewayStack); // 循環依存を避けるため削除

// タグ付け
cdk.Tags.of(app).add('Project', 'Prance');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
