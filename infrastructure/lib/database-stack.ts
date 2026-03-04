import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  environment: string;
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // データベース認証情報をSecrets Managerで管理
    this.secret = new secretsmanager.Secret(this, 'AuroraSecret', {
      secretName: `prance/aurora/${props.environment}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'pranceadmin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // Aurora Serverless v2クラスター作成
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(this.secret),
      defaultDatabaseName: 'prance',
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      serverlessV2MinCapacity: 0.5, // 最小0.5 ACU (コスト削減)
      serverlessV2MaxCapacity: 2, // Alpha版は2 ACUで十分
      writer: rds.ClusterInstance.serverlessV2('Writer'),
      readers:
        props.environment === 'production' ? [rds.ClusterInstance.serverlessV2('Reader')] : [], // Dev環境はReaderなし
      backup: {
        retention: props.environment === 'production' ? cdk.Duration.days(7) : cdk.Duration.days(1),
        preferredWindow: '03:00-04:00', // JST 12:00-13:00
      },
      deletionProtection: props.environment === 'production',
      removalPolicy:
        props.environment === 'production' ? cdk.RemovalPolicy.SNAPSHOT : cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora Cluster Endpoint',
      exportName: `${props.environment}-AuroraEndpoint`,
    });

    new cdk.CfnOutput(this, 'ClusterReadEndpoint', {
      value: this.cluster.clusterReadEndpoint.hostname,
      description: 'Aurora Cluster Read Endpoint',
      exportName: `${props.environment}-AuroraReadEndpoint`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.secret.secretArn,
      description: 'Aurora Secret ARN',
      exportName: `${props.environment}-AuroraSecretArn`,
    });
  }
}
