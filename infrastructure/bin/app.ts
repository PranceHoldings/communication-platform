#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { DatabaseStack } from '../lib/database-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();

// 環境変数から設定を取得
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

const env = {
  account,
  region,
};

// Stack名のプレフィックス
const stackPrefix = `Prance-${environment}`;

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
  environment,
  description: 'Prance Platform - S3 Storage and CloudFront CDN',
});

// タグ付け
cdk.Tags.of(app).add('Project', 'Prance');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
