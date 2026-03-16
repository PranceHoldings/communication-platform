import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface StorageStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  certificate?: acm.ICertificate;
  hostedZone?: route53.IHostedZone;
}

export class StorageStack extends cdk.Stack {
  public readonly recordingsBucket: s3.Bucket;
  public readonly avatarsBucket: s3.Bucket;
  public readonly dbQueriesBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config, certificate, hostedZone } = props;

    // 録画用S3バケット
    this.recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
      bucketName: `prance-recordings-${config.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldRecordings',
          enabled: true,
          expiration: cdk.Duration.days(config.s3.recordingsLifecycleDays),
          transitions:
            config.environment === 'production'
              ? [
                  {
                    storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                    transitionAfter: cdk.Duration.days(30),
                  },
                ]
              : [],
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // TODO: 本番環境では特定ドメインに制限
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      removalPolicy:
        config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'production',
    });

    // アバター用S3バケット
    this.avatarsBucket = new s3.Bucket(this, 'AvatarsBucket', {
      bucketName: `prance-avatars-${config.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'IntelligentTiering',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(0),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy:
        config.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'production',
    });

    // Database Queries用S3バケット（開発用）
    this.dbQueriesBucket = new s3.Bucket(this, 'DbQueriesBucket', {
      bucketName: `prance-db-queries-${config.environment}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldQueries',
          enabled: true,
          expiration: cdk.Duration.days(7), // 7日後に自動削除
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Distribution (CDN)
    this.distribution = new cloudfront.Distribution(this, 'CDNDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.avatarsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/recordings/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(this.recordingsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: new cloudfront.CachePolicy(this, 'RecordingsCachePolicy', {
            cachePolicyName: `prance-recordings-${config.environment}`,
            defaultTtl: cdk.Duration.days(1),
            maxTtl: cdk.Duration.days(30),
            minTtl: cdk.Duration.seconds(0),
          }),
        },
        '/sessions/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(this.recordingsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: new cloudfront.CachePolicy(this, 'SessionsCachePolicy', {
            cachePolicyName: `prance-sessions-${config.environment}`,
            defaultTtl: cdk.Duration.hours(1),
            maxTtl: cdk.Duration.days(7),
            minTtl: cdk.Duration.seconds(0),
          }),
        },
      },
      // Note: カスタムドメインは設定しない（S3アセット配信専用）
      // フロントエンドは Amplify Hosting で dev.app.prance.jp を使用
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // 北米・ヨーロッパのみ (コスト削減)
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      comment: `Prance Platform CDN - ${config.environment} (S3 Assets Only)`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'RecordingsBucketName', {
      value: this.recordingsBucket.bucketName,
      description: 'Recordings S3 Bucket Name',
      exportName: `${config.environment}-RecordingsBucketName`,
    });

    new cdk.CfnOutput(this, 'AvatarsBucketName', {
      value: this.avatarsBucket.bucketName,
      description: 'Avatars S3 Bucket Name',
      exportName: `${config.environment}-AvatarsBucketName`,
    });

    new cdk.CfnOutput(this, 'CDNDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront CDN Domain Name (CloudFront)',
      exportName: `${config.environment}-CDNDomainName`,
    });

    new cdk.CfnOutput(this, 'CDNDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'CDNUsageNote', {
      value: 'CloudFront CDN is used for S3 assets only. Frontend is hosted on Amplify.',
      description: 'CloudFront Usage Note',
    });
  }
}
