import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface ElastiCacheStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  environment: EnvironmentConfig;
}

/**
 * ElastiCache Serverless Stack
 *
 * Purpose: Runtime configuration caching for Lambda functions
 * - Cache Layer: 60 second TTL for runtime configs
 * - Target Cache Hit Rate: 99%+
 * - Auto-scaling: Serverless (Redis 7.x compatible)
 */
export class ElastiCacheStack extends cdk.Stack {
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly serverlessCache: elasticache.CfnServerlessCache;
  public readonly cacheEndpoint: string;

  constructor(scope: Construct, id: string, props: ElastiCacheStackProps) {
    super(scope, id, props);

    const { vpc, environment } = props;

    // Security Group for ElastiCache
    this.securityGroup = new ec2.SecurityGroup(this, 'ElastiCacheSecurityGroup', {
      vpc,
      description: `ElastiCache security group for ${environment.name}`,
      allowAllOutbound: true,
    });

    // Allow inbound from Lambda security group (port 6379 - Redis)
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis access from VPC'
    );

    // Subnet Group for ElastiCache
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'ElastiCacheSubnetGroup', {
      description: `ElastiCache subnet group for ${environment.name}`,
      subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
      cacheSubnetGroupName: `prance-${environment.name}-elasticache-subnet-group`,
    });

    // ElastiCache Serverless (Redis 7.x compatible)
    this.serverlessCache = new elasticache.CfnServerlessCache(this, 'RuntimeConfigCache', {
      serverlessCacheName: `prance-${environment.name}-runtime-config`,
      engine: 'redis',
      description: 'Runtime configuration cache for Lambda functions',

      // Security Groups
      securityGroupIds: [this.securityGroup.securityGroupId],

      // Subnet Group
      subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),

      // Cache Usage Limits (optional, defaults to auto-scaling)
      cacheUsageLimits: {
        dataStorage: {
          maximum: 1, // GB
          unit: 'GB',
        },
        ecpuPerSecond: {
          maximum: 5000, // ECPU per second
        },
      },

      // Daily snapshot (Production only)
      ...(environment.name === 'production' && {
        dailySnapshotTime: '03:00', // UTC 3:00 AM
        snapshotRetentionLimit: 3,
      }),
    });

    // Wait for subnet group to be created
    this.serverlessCache.addDependency(subnetGroup);

    // Cache endpoint (will be available after deployment)
    // Format: <cache-name>.serverless.use1.cache.amazonaws.com:6379
    this.cacheEndpoint = this.serverlessCache.attrEndpointAddress;

    // Outputs
    new cdk.CfnOutput(this, 'ElastiCacheEndpoint', {
      value: this.cacheEndpoint,
      description: 'ElastiCache Serverless endpoint',
      exportName: `${environment.name}-elasticache-endpoint`,
    });

    new cdk.CfnOutput(this, 'ElastiCachePort', {
      value: '6379',
      description: 'ElastiCache port',
    });

    new cdk.CfnOutput(this, 'ElastiCacheSecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'ElastiCache security group ID',
      exportName: `${environment.name}-elasticache-sg-id`,
    });

    // Tags
    cdk.Tags.of(this).add('Environment', environment.name);
    cdk.Tags.of(this).add('Purpose', 'RuntimeConfiguration');
  }
}
