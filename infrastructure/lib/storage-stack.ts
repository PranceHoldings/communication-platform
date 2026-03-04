import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
  environment: string;
}

export class StorageStack extends cdk.Stack {
  public readonly recordingsBucket: s3.Bucket;
  public readonly avatarsBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // 録画用S3バケット
    this.recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
      bucketName: `prance-recordings-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldRecordings',
          enabled: true,
          expiration: props.environment === 'production'
            ? cdk.Duration.days(90)
            : cdk.Duration.days(7),
          transitions: props.environment === 'production'
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
      removalPolicy: props.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'production',
    });

    // アバター用S3バケット
    this.avatarsBucket = new s3.Bucket(this, 'AvatarsBucket', {
      bucketName: `prance-avatars-${props.environment}-${this.account}`,
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
      removalPolicy: props.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'production',
    });

    // CloudFront Distribution (CDN)
    this.distribution = new cloudfront.Distribution(this, 'CDNDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.avatarsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/recordings/*': {
          origin: new origins.S3Origin(this.recordingsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: new cloudfront.CachePolicy(this, 'RecordingsCachePolicy', {
            cachePolicyName: `prance-recordings-${props.environment}`,
            defaultTtl: cdk.Duration.days(1),
            maxTtl: cdk.Duration.days(30),
            minTtl: cdk.Duration.seconds(0),
          }),
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // 北米・ヨーロッパのみ (コスト削減)
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      comment: `Prance Platform CDN - ${props.environment}`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'RecordingsBucketName', {
      value: this.recordingsBucket.bucketName,
      description: 'Recordings S3 Bucket Name',
      exportName: `${props.environment}-RecordingsBucketName`,
    });

    new cdk.CfnOutput(this, 'AvatarsBucketName', {
      value: this.avatarsBucket.bucketName,
      description: 'Avatars S3 Bucket Name',
      exportName: `${props.environment}-AvatarsBucketName`,
    });

    new cdk.CfnOutput(this, 'CDNDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront CDN Domain Name',
      exportName: `${props.environment}-CDNDomainName`,
    });

    new cdk.CfnOutput(this, 'CDNDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}
