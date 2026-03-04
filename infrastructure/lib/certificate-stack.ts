import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

interface CertificateStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  hostedZone: route53.IHostedZone;
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const { config, hostedZone } = props;

    // SSL/TLS証明書の作成
    // CloudFrontで使用するため、us-east-1リージョンに作成する必要があります
    // 注意: このスタックはus-east-1リージョンにデプロイする必要があります
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: config.domain.fullDomain,
      // ワイルドカード証明書も含める（将来的なサブドメイン追加に備える）
      subjectAlternativeNames: [
        `*.${config.domain.fullDomain}`,
        // API Gateway用のサブドメインも追加
        `api.${config.domain.fullDomain}`,
        `ws.${config.domain.fullDomain}`,
      ],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // 証明書情報を出力
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM Certificate ARN',
      exportName: `${id}-CertificateArn`,
    });

    new cdk.CfnOutput(this, 'CertificateDomain', {
      value: config.domain.fullDomain,
      description: 'Certificate Domain',
    });
  }
}
