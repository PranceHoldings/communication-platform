import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';
import * as path from 'path';

export interface NextJsLambdaStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  certificate: acm.ICertificate;
  hostedZone: route53.IHostedZone;
}

export class NextJsLambdaStack extends cdk.Stack {
  public readonly lambdaFunction: lambda.Function;
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: NextJsLambdaStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Next.js Lambda deployment package (pre-built)
    const lambdaPackageDir = '/tmp/nextjs-lambda-package';

    // Verify pre-built Lambda package exists
    const fs = require('fs');
    if (!fs.existsSync(lambdaPackageDir)) {
      throw new Error(
        'Next.js Lambda package not found. Run: bash scripts/build-nextjs-standalone.sh && ' +
          'bash scripts/package-nextjs-lambda.sh'
      );
    }

    // Next.js Lambda Function (SSR) - Using pre-packaged deployment artifact
    this.lambdaFunction = new lambda.Function(this, 'NextJsFunction', {
      functionName: `prance-nextjs-${config.environment}`,
      description: 'Next.js SSR Lambda Function with Standalone Build',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // Graviton2 for better performance
      handler: 'apps/web/lambda.handler',
      code: lambda.Code.fromAsset(lambdaPackageDir),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        // NOTE: NEXT_PUBLIC_* are baked into the bundle at build time — these Lambda env vars
        // are informational only and do NOT override what's in the bundle.
        // The authoritative values are set in deploy.sh before the Next.js build.
        NEXT_PUBLIC_API_URL: `https://api.${config.domain.fullDomain}/api/v1`,
        NEXT_PUBLIC_WS_ENDPOINT: `wss://ws.${config.domain.fullDomain}`,
        NEXT_PUBLIC_CLOUDFRONT_DOMAIN: cdk.Fn.importValue(`${config.environment}-CDNDomainName`),
      },
      // reservedConcurrentExecutions を設定しない = アカウントの並列実行数上限内で自由にスケール
      // (reservedConcurrentExecutions: 5 は "warm 維持" ではなく "同時5リクエストで打ち切り" になるため削除)
    });

    // API Gateway HTTP API
    this.httpApi = new apigatewayv2.HttpApi(this, 'NextJsHttpApi', {
      apiName: `prance-nextjs-api-${config.environment}`,
      description: 'HTTP API for Next.js Lambda Function',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['*'],
      },
      defaultIntegration: new integrations.HttpLambdaIntegration(
        'NextJsIntegration',
        this.lambdaFunction
      ),
    });

    // Custom Domain for API Gateway (app.prance.jp)
    const apiDomain = new apigatewayv2.DomainName(this, 'NextJsApiDomain', {
      domainName: config.domain.fullDomain, // dev.app.prance.jp or app.prance.jp
      certificate: props.certificate,
    });

    // API Mapping
    new apigatewayv2.ApiMapping(this, 'NextJsApiMapping', {
      api: this.httpApi,
      domainName: apiDomain,
      stage: this.httpApi.defaultStage,
    });

    // Route 53 Record
    new route53.ARecord(this, 'NextJsAliasRecord', {
      zone: props.hostedZone,
      recordName: config.domain.fullDomain,
      target: route53.RecordTarget.fromAlias(
        new route53targets.ApiGatewayv2DomainProperties(
          apiDomain.regionalDomainName,
          apiDomain.regionalHostedZoneId
        )
      ),
    });

    // CloudFront Distribution for static asset caching
    this.distribution = new cloudfront.Distribution(this, 'NextJsDistribution', {
      comment: `Next.js Distribution - ${config.environment}`,
      defaultBehavior: {
        origin: new origins.HttpOrigin(config.domain.fullDomain, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          httpsPort: 443,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // SSR pages - no cache
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: true,
      },
      additionalBehaviors: {
        // Cache static assets (Next.js static files)
        '/_next/static/*': {
          origin: new origins.HttpOrigin(config.domain.fullDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            httpsPort: 443,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED, // Max cache for static assets
          compress: true,
        },
        // Cache public assets
        '/images/*': {
          origin: new origins.HttpOrigin(config.domain.fullDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            httpsPort: 443,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      certificate: props.certificate,
      domainNames: [`cdn.${config.domain.fullDomain}`], // cdn.dev.app.prance.jp
      enableLogging: true,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
    });

    // Route 53 Record for CloudFront CDN
    new route53.ARecord(this, 'NextJsCdnAliasRecord', {
      zone: props.hostedZone,
      recordName: `cdn.${config.domain.fullDomain}`,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(this.distribution)
      ),
    });

    // Outputs
    new cdk.CfnOutput(this, 'NextJsFunctionArn', {
      value: this.lambdaFunction.functionArn,
      description: 'Next.js Lambda Function ARN',
      exportName: `${id}-FunctionArn`,
    });

    new cdk.CfnOutput(this, 'NextJsApiEndpoint', {
      value: this.httpApi.apiEndpoint,
      description: 'Next.js HTTP API Endpoint',
      exportName: `${id}-ApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'NextJsCustomDomain', {
      value: `https://${config.domain.fullDomain}`,
      description: 'Next.js Custom Domain URL',
    });

    new cdk.CfnOutput(this, 'NextJsCdnDomain', {
      value: `https://cdn.${config.domain.fullDomain}`,
      description: 'Next.js CDN Domain URL',
    });

    new cdk.CfnOutput(this, 'NextJsCloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain',
      exportName: `${config.environment}-NextJsCDNDomain`,
    });
  }
}
