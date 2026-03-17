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

    // Next.js Standalone Build Path
    const standaloneDir = path.join(__dirname, '../../apps/web/.next/standalone');

    // Next.js Lambda Function (SSR)
    this.lambdaFunction = new lambda.Function(this, 'NextJsFunction', {
      functionName: `prance-nextjs-${config.environment}`,
      description: 'Next.js SSR Lambda Function with Standalone Build',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // Graviton2 for better performance
      handler: 'apps/web/lambda.handler',
      code: lambda.Code.fromAsset(standaloneDir, {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash',
            '-c',
            [
              'cp -r /asset-input/* /asset-output/',
              // Copy lambda adapter
              'cp /asset-input/../../lambda.js /asset-output/apps/web/',
              // Copy static assets
              'cp -r /asset-input/../../.next/static /asset-output/apps/web/.next/',
              'cp -r /asset-input/../../public /asset-output/apps/web/',
            ].join(' && '),
          ],
        },
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: `https://api.${config.domain.fullDomain}`,
        NEXT_PUBLIC_WS_URL: `wss://ws.${config.domain.fullDomain}`,
        NEXT_PUBLIC_CLOUDFRONT_DOMAIN: cdk.Fn.importValue(`${config.environment}-CDNDomainName`),
      },
      // Cold start optimization
      reservedConcurrentExecutions: 5, // Keep 5 instances warm
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

    // CloudFront Distribution (Optional - for static asset caching)
    this.distribution = new cloudfront.Distribution(this, 'NextJsDistribution', {
      comment: `Next.js Distribution - ${config.environment}`,
      defaultBehavior: {
        origin: new origins.HttpOrigin(this.httpApi.apiEndpoint.replace('https://', '')),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // SSR - no cache for HTML
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      // Cache static assets
      additionalBehaviors: {
        '/_next/static/*': {
          origin: new origins.HttpOrigin(this.httpApi.apiEndpoint.replace('https://', '')),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        '/static/*': {
          origin: new origins.HttpOrigin(this.httpApi.apiEndpoint.replace('https://', '')),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      enableIpv6: true,
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

    new cdk.CfnOutput(this, 'NextJsCloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain',
    });
  }
}
