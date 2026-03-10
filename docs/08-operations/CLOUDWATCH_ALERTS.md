# CloudWatch Logs アラート設定ガイド

**作成日:** 2026-03-10
**Phase 1.5 Day 10:** エラーハンドリング監視

---

## 概要

このドキュメントでは、Phase 1.5で実装したエラーハンドリング・リトライロジックを監視するためのCloudWatch Logsアラート設定について説明します。

---

## 監視対象メトリクス

### 1. エラー率（Error Rate）

**目的:** 全体的なエラー発生率を監視

**閾値:**
- **警告:** 5分間に10件以上のエラー
- **重大:** 5分間に50件以上のエラー

**CloudWatch Logs Insights クエリ:**
```
fields @timestamp
| filter level = "ERROR"
| stats count() as errorCount by bin(5m)
| filter errorCount > 10
```

**アラート設定:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "prance-high-error-rate-dev" \
  --alarm-description "High error rate detected in Lambda functions" \
  --metric-name ErrorCount \
  --namespace "AWS/Lambda" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=prance-websocket-default-dev
```

---

### 2. API呼び出し失敗（API Call Failures）

**目的:** STT/AI/TTS APIの失敗を検出

**閾値:**
- **警告:** 5分間に5件以上の失敗
- **重大:** 5分間に20件以上の失敗

**CloudWatch Logs Insights クエリ:**
```
fields @timestamp, error.message, context.sessionId
| filter level = "ERROR"
| filter (message like /STT/ or message like /AI/ or message like /TTS/)
| stats count() as apiFailures by bin(5m)
| filter apiFailures > 5
```

---

### 3. リトライ頻度（Retry Frequency）

**目的:** リトライが頻繁に発生している場合は根本的な問題がある可能性

**閾値:**
- **警告:** 5分間に10回以上のリトライ
- **重大:** 5分間に30回以上のリトライ

**CloudWatch Logs Insights クエリ:**
```
fields @timestamp, message, context.sessionId
| filter message like /Retrying/
| stats count() as retryCount by bin(5m)
| filter retryCount > 10
```

---

### 4. タイムアウトエラー（Timeout Errors）

**目的:** タイムアウトエラーの監視

**閾値:**
- **警告:** 5分間に5件以上のタイムアウト

**CloudWatch Logs Insights クエリ:**
```
fields @timestamp, error.message, context.sessionId
| filter level = "ERROR"
| filter error.message like /timeout/i
| stats count() as timeoutCount by bin(5m)
| filter timeoutCount > 5
```

---

### 5. レート制限エラー（Rate Limit Errors）

**目的:** API レート制限の監視

**閾値:**
- **警告:** 5分間に3件以上のレート制限エラー

**CloudWatch Logs Insights クエリ:**
```
fields @timestamp, error.message, context.sessionId
| filter level = "ERROR"
| filter (error.code = "429" or error.code = "ThrottlingException")
| stats count() as rateLimitCount by bin(5m)
| filter rateLimitCount > 3
```

---

### 6. リトライ後の成功率（Retry Success Rate）

**目的:** リトライの効果測定

**CloudWatch Logs Insights クエリ:**
```
fields @timestamp, message
| filter message like /completed/
| filter context.attempts > 1
| stats count() as retriedSuccess,
        avg(context.attempts) as avgAttempts,
        max(context.totalDelay) as maxDelay
        by bin(15m)
```

---

## アラート通知設定

### SNS トピック作成

```bash
# SNS トピック作成
aws sns create-topic --name prance-alerts-dev

# メール通知購読
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:010438500933:prance-alerts-dev \
  --protocol email \
  --notification-endpoint admin@prance.com
```

### CloudWatch Alarm → SNS 統合

```bash
# 高エラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "prance-high-error-rate-dev" \
  --alarm-description "High error rate detected" \
  --metric-name ErrorCount \
  --namespace "CustomMetrics/Prance" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:010438500933:prance-alerts-dev
```

---

## ダッシュボード設定

### CloudWatch Dashboard作成

```bash
aws cloudwatch put-dashboard \
  --dashboard-name "prance-error-monitoring-dev" \
  --dashboard-body file://dashboard.json
```

**dashboard.json:**
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Errors", { "stat": "Sum", "label": "Lambda Errors" }],
          [".", "Throttles", { "stat": "Sum", "label": "Lambda Throttles" }],
          ["CustomMetrics/Prance", "RetryCount", { "stat": "Sum", "label": "API Retries" }]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Error Overview",
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "fields @timestamp, level, message, error.message\n| filter level = \"ERROR\"\n| sort @timestamp desc\n| limit 20",
        "region": "us-east-1",
        "title": "Recent Errors",
        "logGroupNames": [
          "/aws/lambda/prance-websocket-default-dev"
        ]
      }
    }
  ]
}
```

---

## 運用手順

### 1. アラート受信時の対応

**エラー率が高い場合:**
1. CloudWatch Logs Insightsで詳細確認
2. エラーの種類を特定（STT/AI/TTS）
3. 外部APIの状態確認（Azure, AWS, ElevenLabs）
4. 必要に応じてインシデント対応

**リトライが頻繁な場合:**
1. リトライ対象のAPIを特定
2. APIプロバイダーのステータスページ確認
3. レート制限設定の見直し
4. バックオフ設定の調整検討

### 2. 定期レビュー（週次）

- エラー率トレンド確認
- リトライ成功率確認
- タイムアウト発生状況確認
- 必要に応じてリトライ設定調整

### 3. エスカレーション

**重大エラー発生時:**
1. インシデント記録作成
2. 影響範囲の特定
3. 暫定対応実施
4. 根本原因分析
5. 恒久対策実施

---

## よく使うクエリ集

### エラー詳細表示

```
fields @timestamp, level, message, error.message, error.code, context.sessionId
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

### セッション別エラー集計

```
fields context.sessionId
| filter level = "ERROR"
| stats count() as errorCount by context.sessionId
| sort errorCount desc
```

### API別エラー率

```
fields @timestamp, message
| filter level = "ERROR"
| parse message /\[(\w+)\]/
| stats count() as errorCount by $1
| sort errorCount desc
```

### リトライ効果測定

```
fields @timestamp, context.attempts, context.totalDelay
| filter message like /completed/
| filter context.attempts > 1
| stats count() as successAfterRetry,
        avg(context.attempts) as avgAttempts,
        avg(context.totalDelay) as avgDelay,
        max(context.attempts) as maxAttempts
```

---

## 参考リンク

- [CloudWatch Logs Insights クエリ構文](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [SNS 通知](https://docs.aws.amazon.com/sns/latest/dg/welcome.html)
