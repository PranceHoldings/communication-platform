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

    // Route 53 Hosted Zone の取得または作成
    // サブドメイン委譲方式: platform.prance.co.jp のみをRoute 53で管理
    // お名前.comでの変更は最小限（NSレコード4つのみ追加）

    // platform.prance.co.jp のHosted Zoneを参照（既に存在する前提）
    // 初回は手動で作成する必要があります
    // コマンド: aws route53 create-hosted-zone --name platform.prance.co.jp --caller-reference "prance-platform-$(date +%s)"
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.domain.platform,
    });

    // 環境情報を出力
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: `Route 53 Hosted Zone ID (${config.domain.platform})`,
      exportName: `${id}-HostedZoneId`,
    });

    new cdk.CfnOutput(this, 'HostedZoneName', {
      value: this.hostedZone.zoneName,
      description: 'Route 53 Hosted Zone Name (platform.prance.co.jp)',
      exportName: `${id}-HostedZoneName`,
    });

    // ネームサーバーの出力（既存のホストゾーンの場合は表示されない場合があります）
    if (this.hostedZone.hostedZoneNameServers && this.hostedZone.hostedZoneNameServers.length > 0) {
      new cdk.CfnOutput(this, 'HostedZoneNameServers', {
        value: cdk.Fn.join(',', this.hostedZone.hostedZoneNameServers),
        description: 'Route 53 Name Servers (お名前.comに設定)',
      });
    }

    new cdk.CfnOutput(this, 'ApplicationDomain', {
      value: config.domain.fullDomain,
      description: 'Application Domain',
      exportName: `${id}-ApplicationDomain`,
    });
  }
}
