import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface ApiGatewayDomainStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  certificate: acm.ICertificate;
  hostedZone: route53.IHostedZone;
  restApi: apigateway.RestApi;
  webSocketApi: apigatewayv2.CfnApi;
  webSocketStage: apigatewayv2.CfnStage;
}

export class ApiGatewayDomainStack extends cdk.Stack {
  public readonly restApiDomain: apigateway.DomainName;
  public readonly webSocketDomain: apigatewayv2.CfnDomainName;

  constructor(scope: Construct, id: string, props: ApiGatewayDomainStackProps) {
    super(scope, id, props);

    const { config, certificate, hostedZone, restApi, webSocketApi, webSocketStage } = props;

    // REST API カスタムドメイン
    const apiDomainName = `api.${config.domain.fullDomain}`;
    this.restApiDomain = new apigateway.DomainName(this, 'RestApiDomain', {
      domainName: apiDomainName,
      certificate: certificate,
      endpointType: apigateway.EndpointType.REGIONAL,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    });

    // REST API マッピング
    new apigateway.BasePathMapping(this, 'RestApiMapping', {
      domainName: this.restApiDomain,
      restApi: restApi,
      stage: restApi.deploymentStage,
      basePath: '', // ルートパス
    });

    // REST API Route 53 Aレコード
    new route53.ARecord(this, 'RestApiAliasRecord', {
      zone: hostedZone,
      recordName: apiDomainName,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGateway(restApi)
      ),
      comment: `API Gateway REST API domain for ${config.environment} environment`,
    });

    // WebSocket API カスタムドメイン
    const wsDomainName = `ws.${config.domain.fullDomain}`;
    this.webSocketDomain = new apigatewayv2.CfnDomainName(this, 'WebSocketDomain', {
      domainName: wsDomainName,
      domainNameConfigurations: [
        {
          certificateArn: certificate.certificateArn,
          endpointType: 'REGIONAL',
          securityPolicy: 'TLS_1_2',
        },
      ],
    });

    // WebSocket API マッピング
    new apigatewayv2.CfnApiMapping(this, 'WebSocketApiMapping', {
      apiId: webSocketApi.ref,
      domainName: this.webSocketDomain.ref,
      stage: webSocketStage.ref,
    });

    // WebSocket API Route 53 Aレコード
    new route53.ARecord(this, 'WebSocketAliasRecord', {
      zone: hostedZone,
      recordName: wsDomainName,
      target: route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: this.webSocketDomain.attrRegionalDomainName,
          hostedZoneId: this.webSocketDomain.attrRegionalHostedZoneId,
        }),
      }),
      comment: `API Gateway WebSocket API domain for ${config.environment} environment`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'RestApiCustomDomain', {
      value: apiDomainName,
      description: 'REST API Custom Domain',
      exportName: `${id}-RestApiDomain`,
    });

    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: `https://${apiDomainName}`,
      description: 'REST API URL',
      exportName: `${id}-RestApiUrl`,
    });

    new cdk.CfnOutput(this, 'WebSocketCustomDomain', {
      value: wsDomainName,
      description: 'WebSocket API Custom Domain',
      exportName: `${id}-WebSocketDomain`,
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: `wss://${wsDomainName}`,
      description: 'WebSocket API URL',
      exportName: `${id}-WebSocketUrl`,
    });

    new cdk.CfnOutput(this, 'RestApiRegionalDomainName', {
      value: this.restApiDomain.domainNameAliasDomainName,
      description: 'REST API Regional Domain Name (for DNS)',
    });

    new cdk.CfnOutput(this, 'WebSocketRegionalDomainName', {
      value: this.webSocketDomain.attrRegionalDomainName,
      description: 'WebSocket API Regional Domain Name (for DNS)',
    });
  }
}
