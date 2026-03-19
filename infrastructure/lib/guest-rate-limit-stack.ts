/**
 * Guest Session Rate Limit Stack
 *
 * Creates DynamoDB table for rate limiting guest PIN authentication attempts.
 *
 * Features:
 * - IP-based rate limiting
 * - Automatic cleanup via TTL
 * - Scalable with DynamoDB on-demand pricing
 *
 * @module GuestRateLimitStack
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface GuestRateLimitStackProps extends cdk.StackProps {
  environment: string;
}

export class GuestRateLimitStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: GuestRateLimitStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // DynamoDB Table for Rate Limiting
    this.table = new dynamodb.Table(this, 'GuestRateLimitTable', {
      tableName: `prance-guest-rate-limits-${environment}`,
      partitionKey: {
        name: 'ipAddress',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
      timeToLiveAttribute: 'ttl', // Automatic cleanup after 10 minutes
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod', // Backup for production
    });

    // Outputs
    new cdk.CfnOutput(this, 'GuestRateLimitTableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name for guest rate limiting',
      exportName: `${environment}-guest-rate-limit-table-name`,
    });

    new cdk.CfnOutput(this, 'GuestRateLimitTableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN for guest rate limiting',
      exportName: `${environment}-guest-rate-limit-table-arn`,
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'Prance');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Module', 'GuestSession');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
