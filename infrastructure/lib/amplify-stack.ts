import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface AmplifyStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  certificate: acm.ICertificate;
  hostedZone: route53.IHostedZone;
}

export class AmplifyStack extends cdk.Stack {
  public readonly app: amplify.CfnApp;
  public readonly branch: amplify.CfnBranch;
  public readonly domain: amplify.CfnDomain;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    const { config, certificate, hostedZone } = props;

    // Amplify用のIAMロール
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Amplify Hosting Service Role',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    });

    // Amplify App作成
    this.app = new amplify.CfnApp(this, 'App', {
      name: `prance-web-${config.environment}`,
      description: `Prance Communication Platform - Frontend (${config.environment})`,
      repository: process.env.GITHUB_REPO_URL || '',
      accessToken: process.env.GITHUB_ACCESS_TOKEN || '',
      iamServiceRole: amplifyRole.roleArn,
      platform: 'WEB_COMPUTE', // Next.js SSR対応
      environmentVariables: [
        {
          name: 'NEXT_PUBLIC_API_URL',
          value: `https://api.${config.domain.fullDomain}`,
        },
        {
          name: 'NEXT_PUBLIC_WS_URL',
          value: `wss://ws.${config.domain.fullDomain}`,
        },
        {
          name: 'NEXT_PUBLIC_CLOUDFRONT_DOMAIN',
          value: cdk.Fn.importValue(`${config.environment}-CDNDomainName`),
        },
        {
          name: 'NODE_ENV',
          value: 'production',  // Always use 'production' for next build
        },
        {
          name: 'AMPLIFY_MONOREPO_APP_ROOT',
          value: 'apps/web',
        },
      ],
      buildSpec: `version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - echo "Installing dependencies from monorepo root..."
            - cd ../.. && npm ci && cd apps/web
            - echo "Cleaning Next.js cache..."
            - rm -rf .next
        build:
          commands:
            - echo "Building Next.js app..."
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
`,
      customRules: [
        // SPA Fallback (Client-side routing)
        {
          source: '</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>',
          target: '/index.html',
          status: '200',
        },
      ],
    });

    // ブランチ設定（main）
    const branchName = config.environment === 'production' ? 'main' : 'dev';
    this.branch = new amplify.CfnBranch(this, 'Branch', {
      appId: this.app.attrAppId,
      branchName: branchName,
      description: `${config.environment} environment branch`,
      enableAutoBuild: true,
      enablePullRequestPreview: config.environment !== 'production',
      stage: config.environment === 'production' ? 'PRODUCTION' : 'DEVELOPMENT',
      framework: 'Next.js - SSR',
    });

    // カスタムドメイン設定
    this.domain = new amplify.CfnDomain(this, 'Domain', {
      appId: this.app.attrAppId,
      domainName: config.domain.fullDomain,
      subDomainSettings: [
        {
          branchName: this.branch.branchName,
          prefix: '', // ルートドメイン（dev.app.prance.jp）
        },
      ],
      enableAutoSubDomain: false,
      certificateSettings: {
        certificateType: 'CUSTOM',
        customCertificateArn: certificate.certificateArn,
      },
    });

    // 依存関係の設定
    this.branch.addDependency(this.app);
    this.domain.addDependency(this.branch);

    // Outputs
    new cdk.CfnOutput(this, 'AppId', {
      value: this.app.attrAppId,
      description: 'Amplify App ID',
      exportName: `${id}-AppId`,
    });

    new cdk.CfnOutput(this, 'AppArn', {
      value: this.app.attrArn,
      description: 'Amplify App ARN',
    });

    new cdk.CfnOutput(this, 'DefaultDomain', {
      value: this.app.attrDefaultDomain,
      description: 'Amplify Default Domain',
    });

    new cdk.CfnOutput(this, 'CustomDomain', {
      value: config.domain.fullDomain,
      description: 'Custom Domain Name',
    });

    new cdk.CfnOutput(this, 'AppConsoleUrl', {
      value: `https://console.aws.amazon.com/amplify/home?region=${this.region}#/${this.app.attrAppId}`,
      description: 'Amplify Console URL',
    });
  }
}
