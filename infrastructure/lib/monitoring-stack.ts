/**
 * Monitoring Stack
 * CloudWatch Dashboards and Alarms for Phase 1.5 Performance Monitoring
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  websocketLambdaFunction?: lambda.IFunction;
  alertEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { environment, websocketLambdaFunction, alertEmail } = props;

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `prance-alarms-${environment}`,
      displayName: `Prance ${environment} Alarms`,
    });

    if (alertEmail) {
      this.alarmTopic.addSubscription(new snsSubscriptions.EmailSubscription(alertEmail));
    }

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `Prance-${environment}-Performance`,
    });

    if (websocketLambdaFunction) {
      this.addWebSocketMetrics(websocketLambdaFunction, environment);
      this.addWebSocketAlarms(websocketLambdaFunction, environment);
    }

    // Output dashboard URL
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
    });
  }

  /**
   * Add WebSocket Lambda metrics to dashboard
   */
  private addWebSocketMetrics(lambdaFunction: lambda.IFunction, environment: string): void {
    // Row 1: Invocation metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'WebSocket Invocations',
        left: [
          lambdaFunction.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Error Rate',
        left: [
          lambdaFunction.metricErrors({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
          }),
          lambdaFunction.metricThrottles({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.ORANGE,
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Row 2: Duration metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (Phase 1.5 Target: < 4s avg, < 6s p95)',
        left: [
          lambdaFunction.metricDuration({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.BLUE,
          }),
          lambdaFunction.metricDuration({
            statistic: 'p95',
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.ORANGE,
          }),
          lambdaFunction.metricDuration({
            statistic: 'Maximum',
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
          }),
        ],
        leftYAxis: {
          min: 0,
          max: 10000, // 10 seconds
        },
        leftAnnotations: [
          {
            value: 4000,
            label: 'Target Average (4s)',
            color: cloudwatch.Color.GREEN,
          },
          {
            value: 6000,
            label: 'Target P95 (6s)',
            color: cloudwatch.Color.ORANGE,
          },
        ],
        width: 24,
        height: 6,
      })
    );

    // Row 3: Concurrent executions
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Concurrent Executions',
        left: [
          lambdaFunction
            .metricInvocations({
              statistic: 'Sum',
              period: cdk.Duration.minutes(1),
            })
            .with({
              label: 'Concurrent',
              color: cloudwatch.Color.PURPLE,
            }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Success Rate (Last Hour)',
        metrics: [
          new cloudwatch.MathExpression({
            expression: '100 - (errors / invocations) * 100',
            usingMetrics: {
              invocations: lambdaFunction.metricInvocations({
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
              }),
              errors: lambdaFunction.metricErrors({
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
              }),
            },
            label: 'Success Rate %',
          }),
        ],
        width: 12,
        height: 6,
      })
    );
  }

  /**
   * Create CloudWatch alarms for WebSocket Lambda
   */
  private addWebSocketAlarms(lambdaFunction: lambda.IFunction, environment: string): void {
    // Alarm 1: High error rate (> 5%)
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      alarmName: `${environment}-websocket-high-error-rate`,
      alarmDescription: 'WebSocket error rate exceeds 5%',
      metric: new cloudwatch.MathExpression({
        expression: '(errors / invocations) * 100',
        usingMetrics: {
          invocations: lambdaFunction.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          errors: lambdaFunction.metricErrors({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        },
      }),
      threshold: 5, // 5%
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    errorRateAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // Alarm 2: High duration (p95 > 6s)
    const highDurationAlarm = new cloudwatch.Alarm(this, 'HighDurationAlarm', {
      alarmName: `${environment}-websocket-high-duration`,
      alarmDescription: 'WebSocket p95 duration exceeds 6 seconds (Phase 1.5 target)',
      metric: lambdaFunction.metricDuration({
        statistic: 'p95',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 6000, // 6 seconds
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    highDurationAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // Alarm 3: Throttles detected
    const throttleAlarm = new cloudwatch.Alarm(this, 'ThrottleAlarm', {
      alarmName: `${environment}-websocket-throttles`,
      alarmDescription: 'WebSocket Lambda is being throttled',
      metric: lambdaFunction.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    throttleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
  }
}
