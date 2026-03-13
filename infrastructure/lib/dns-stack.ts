import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

interface DnsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class DnsStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Route 53 Hosted Zone の取得
    // prance.jp は Route 53 Registrar で管理されており、
    // 既存の Hosted Zone を使用します。
    // サブドメイン（dev.app.prance.jp等）のレコードは
    // このHosted Zone内に直接作成されます。
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.domain.root, // prance.jp
    });

    // 環境情報を出力
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: `Route 53 Hosted Zone ID (${config.domain.root})`,
      exportName: `${id}-HostedZoneId`,
    });

    new cdk.CfnOutput(this, 'HostedZoneName', {
      value: this.hostedZone.zoneName,
      description: `Route 53 Hosted Zone Name (${config.domain.root})`,
      exportName: `${id}-HostedZoneName`,
    });

    new cdk.CfnOutput(this, 'ApplicationDomain', {
      value: config.domain.fullDomain,
      description: 'Application Domain',
      exportName: `${id}-ApplicationDomain`,
    });
  }
}
