# 運用ガイド

Pranceプラットフォームの運用手順とベストプラクティス

## 目次

- [運用概要](#運用概要)
- [日常運用](#日常運用)
- [監視・アラート](#監視アラート)
- [デプロイ手順](#デプロイ手順)
- [トラブルシューティング](#トラブルシューティング)
- [バックアップ・リストア](#バックアップリストア)
- [スケーリング](#スケーリング)
- [メンテナンス](#メンテナンス)

---

## 運用概要

### 運用体制

```
┌──────────────────────────────────────────────────────────┐
│ SRE（Site Reliability Engineering）チーム構成             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ SREマネージャー                                           │
│     │                                                    │
│     ├─ オンコールエンジニア（ローテーション）              │
│     │   └─ 1次対応（P0/P1）                             │
│     │                                                    │
│     ├─ インフラエンジニア                                 │
│     │   ├─ AWS管理                                       │
│     │   ├─ CI/CD保守                                     │
│     │   └─ パフォーマンス最適化                           │
│     │                                                    │
│     └─ DevOpsエンジニア                                  │
│         ├─ 自動化・ツール開発                            │
│         ├─ 監視システム保守                              │
│         └─ ドキュメント管理                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### オンコールローテーション

| 時間帯 | 担当 | 対応レベル |
|--------|------|-----------|
| **平日 9:00-18:00** | 全SREチーム | P0-P3 |
| **平日 18:00-9:00** | オンコール（1名） | P0-P1 |
| **週末・祝日** | オンコール（1名） | P0-P1 |

**エスカレーションパス:**

```
1次対応（オンコール）
    ↓ 30分で解決しない場合
SREマネージャー
    ↓ 1時間で解決しない場合
CTO + 関連チームリーダー
    ↓ P0が2時間継続
CEO + 全役員
```

### SLA（Service Level Agreement）

| メトリクス | 目標 | 測定方法 |
|-----------|------|---------|
| **稼働率** | 99.9% | CloudWatch Synthetics |
| **APIレスポンスタイム** | p95 < 500ms | CloudWatch Metrics |
| **エラー率** | < 0.1% | CloudWatch Logs Insights |
| **データ損失** | 0件 | バックアップ検証 |

**ダウンタイム許容:**

- 月間: 43.8分
- 四半期: 2.2時間
- 年間: 8.8時間

---

## 日常運用

### 朝会（Daily Standup）

**時間:** 毎朝10:00（15分）

**議題:**

1. 過去24時間のインシデント
2. 重要なアラート
3. 本日のデプロイ予定
4. ブロッカー確認

### 日次チェックリスト

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== Prance Platform Daily Health Check ==="
echo "Date: $(date)"

# 1. システム稼働確認
echo "\n[1] System Health"
curl -s https://api.prance-platform.com/health | jq .

# 2. エラー率確認
echo "\n[2] Error Rate (last 24h)"
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum

# 3. レスポンスタイム確認
echo "\n[3] Response Time p95 (last 24h)"
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average \
  --extended-statistics p95

# 4. Lambda同時実行数
echo "\n[4] Lambda Concurrency"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ConcurrentExecutions \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Maximum

# 5. Aurora接続数
echo "\n[5] Aurora Connections"
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBClusterIdentifier,Value=prance-production-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average

# 6. S3ストレージ使用量
echo "\n[6] S3 Storage"
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=prance-recordings-production \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average

# 7. コスト確認
echo "\n[7] Cost (last 7 days)"
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=SERVICE

echo "\n=== Health Check Complete ==="
```

### 週次レビュー

**時間:** 毎週金曜15:00（30分）

**議題:**

1. 週間インシデントレビュー
2. SLO達成状況
3. コスト分析
4. 来週のメンテナンス計画
5. 改善タスクの進捗

---

## 監視・アラート

### CloudWatch ダッシュボード

#### メインダッシュボード

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "title": "API Request Count",
        "metrics": [
          ["AWS/ApiGateway", "Count", { "stat": "Sum" }]
        ],
        "period": 300,
        "region": "us-east-1"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "API Latency (p95)",
        "metrics": [
          ["AWS/ApiGateway", "Latency", { "stat": "p95" }]
        ],
        "period": 300,
        "yAxis": { "left": { "max": 1000 } }
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Lambda Errors",
        "metrics": [
          ["AWS/Lambda", "Errors", { "stat": "Sum" }]
        ],
        "period": 300
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Aurora CPU Utilization",
        "metrics": [
          ["AWS/RDS", "CPUUtilization", {
            "dimensions": { "DBClusterIdentifier": "prance-production-cluster" }
          }]
        ],
        "period": 300,
        "yAxis": { "left": { "min": 0, "max": 100 } }
      }
    }
  ]
}
```

### アラート設定

#### P0 - Critical Alerts

```typescript
// API Gateway 5XX Error Rate
new cloudwatch.Alarm(this, 'ApiGateway5XXAlarm', {
  metric: apiGateway.metricServerError({
    statistic: 'Sum',
    period: Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 2,
  alarmDescription: 'API Gateway 5XX errors exceeded threshold',
  actionsEnabled: true,
  alarmActions: [snsTopicCritical],
});

// Lambda Function Errors
new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
  metric: lambdaFunction.metricErrors({
    statistic: 'Sum',
    period: Duration.minutes(5),
  }),
  threshold: 5,
  evaluationPeriods: 2,
  alarmDescription: 'Lambda errors exceeded threshold',
  alarmActions: [snsTopicCritical],
});

// Aurora Database Connections
new cloudwatch.Alarm(this, 'AuroraConnectionsAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/RDS',
    metricName: 'DatabaseConnections',
    dimensionsMap: {
      DBClusterIdentifier: auroraCluster.clusterIdentifier,
    },
    statistic: 'Average',
    period: Duration.minutes(5),
  }),
  threshold: 80,
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  alarmDescription: 'Aurora connections nearing limit',
  alarmActions: [snsTopicCritical],
});
```

#### P1 - High Alerts

```typescript
// API Latency
new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
  metric: apiGateway.metricLatency({
    statistic: 'p95',
    period: Duration.minutes(5),
  }),
  threshold: 1000,  // 1秒
  evaluationPeriods: 3,
  alarmDescription: 'API latency p95 exceeded 1 second',
  alarmActions: [snsTopicHigh],
});

// Lambda Throttles
new cloudwatch.Alarm(this, 'LambdaThrottlesAlarm', {
  metric: lambdaFunction.metricThrottles({
    statistic: 'Sum',
    period: Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 2,
  alarmDescription: 'Lambda throttles detected',
  alarmActions: [snsTopicHigh],
});
```

### ログ分析クエリ

#### エラーログ分析

```sql
-- CloudWatch Logs Insights

-- 1. エラー頻度（過去1時間）
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)

-- 2. エラー種別集計
fields @timestamp, error_type, error_message
| filter level = "ERROR"
| stats count() by error_type

-- 3. 遅いAPIエンドポイント
fields @timestamp, endpoint, duration
| filter duration > 1000
| sort duration desc
| limit 20

-- 4. ユーザーエラー（403/401）
fields @timestamp, user_id, status_code, endpoint
| filter status_code in [401, 403]
| stats count() by user_id, status_code

-- 5. Lambda コールドスタート
fields @timestamp, @duration, @initDuration
| filter @initDuration > 1000
| stats avg(@initDuration), max(@initDuration), count()
```

---

## デプロイ手順

### 通常デプロイ（本番環境）

#### 前提条件

- [ ] すべてのテストがパス
- [ ] ステージング環境で動作確認済み
- [ ] デプロイ計画書作成済み
- [ ] ロールバック手順確認済み
- [ ] 関係者への通知済み

#### デプロイコマンド

```bash
# 1. 本番環境へデプロイ
./scripts/deploy.sh production

# 実行内容:
# - Git タグ作成 (v1.2.3)
# - GitHub Actions トリガー
# - ビルド・テスト実行
# - CDK デプロイ
# - スモークテスト実行
# - ヘルスチェック
```

#### デプロイ後チェックリスト

```bash
# 1. ヘルスチェック
curl https://api.prance-platform.com/health

# 2. スモークテスト
npm run test:smoke -- --env=production

# 3. CloudWatch メトリクス確認
# - エラー率
# - レスポンスタイム
# - スループット

# 4. ログ確認
aws logs tail /aws/lambda/prance-api-function --follow

# 5. ユーザー影響確認
# - Slack #user-reports チャンネル
# - サポートチケット
```

### 緊急デプロイ（ホットフィックス）

**P0障害対応時:**

```bash
# 1. ホットフィックスブランチ作成
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# 2. 修正・テスト
npm run test

# 3. PR作成（承認スキップ可）
gh pr create --title "Hotfix: Critical bug fix" --base main

# 4. マージ・デプロイ
gh pr merge --merge
git tag v1.2.4
git push origin v1.2.4

# 5. デプロイ監視
# GitHub Actions の進捗を監視
gh run watch
```

### ロールバック手順

```bash
# 1. 前バージョンのタグ確認
git tag --sort=-version:refname | head -5

# 2. ロールバック実行
./scripts/rollback.sh production v1.2.2

# 実行内容:
# - 指定バージョンのチェックアウト
# - CDK デプロイ
# - ヘルスチェック

# 3. 確認
curl https://api.prance-platform.com/health
```

---

## トラブルシューティング

### 問題: API Gateway 5XXエラー急増

**症状:**

- API Gateway の 5XX エラー率が 5% を超える
- CloudWatch アラームが発火

**診断手順:**

```bash
# 1. エラーログ確認
aws logs tail /aws/apigateway/prance-api --since 10m --follow

# 2. Lambda エラー確認
aws logs tail /aws/lambda/prance-api-function --since 10m \
  --filter-pattern "ERROR"

# 3. Lambda メトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=prance-api-function \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**一般的な原因と対処:**

| 原因 | 診断 | 対処 |
|------|------|------|
| **Lambda タイムアウト** | CloudWatch Logs: "Task timed out" | タイムアウト値を増加、またはコード最適化 |
| **データベース接続エラー** | "ECONNREFUSED 5432" | Aurora 接続数確認、コネクションプール調整 |
| **メモリ不足** | "JavaScript heap out of memory" | Lambda メモリを増加 |
| **外部API障害** | "ETIMEDOUT", "ENOTFOUND" | フォールバック処理確認、タイムアウト調整 |

### 問題: データベース接続枯渇

**症状:**

- "too many connections" エラー
- API レスポンスタイム急増

**診断手順:**

```bash
# 1. 現在の接続数確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBClusterIdentifier,Value=prance-production-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Maximum

# 2. Lambda 同時実行数確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ConcurrentExecutions \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Maximum
```

**対処:**

```bash
# 短期対応: Lambda 同時実行数制限
aws lambda put-function-concurrency \
  --function-name prance-api-function \
  --reserved-concurrent-executions 50

# 中期対応: Prisma Data Proxy 設定調整
# prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  # コネクションプール設定
  connection_limit = 10
}

# 長期対応: Aurora Read Replica 追加
# infrastructure/lib/database-stack.ts
```

### 問題: S3ストレージコスト急増

**診断手順:**

```bash
# 1. バケット別サイズ確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name BucketSizeBytes \
  --dimensions Name=BucketName,Value=prance-recordings-production \
  --start-time $(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average

# 2. オブジェクト数確認
aws s3 ls s3://prance-recordings-production --recursive --summarize

# 3. 古いファイル確認
aws s3api list-objects-v2 \
  --bucket prance-recordings-production \
  --query 'Contents[?LastModified<`2024-01-01`]' \
  --output json | jq 'length'
```

**対処:**

```bash
# Lifecycle Policy 適用
aws s3api put-bucket-lifecycle-configuration \
  --bucket prance-recordings-production \
  --lifecycle-configuration file://lifecycle-policy.json

# lifecycle-policy.json
{
  "Rules": [
    {
      "Id": "ArchiveOldRecordings",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

### 問題: リアルタイム文字起こしエラー（Azure STT）

**症状:**

- セッション中に文字起こしが停止する
- 「音声認識エラー」メッセージが表示される
- ユーザーが発話しても字幕が表示されない

**診断手順:**

```bash
# 1. Azure Speech Services ステータス確認
curl https://status.azure.com/en-us/status

# 2. Lambda WebSocket ログ確認
aws logs tail /aws/lambda/prance-websocket-function --since 10m \
  --filter-pattern "STT Error"

# 3. ユーザーセッションログ確認（CloudWatch Insights）
# クエリ: 特定セッションのエラーログ
fields @timestamp, @message
| filter session_id = "session_abc123"
| filter @message like /STT|Speech|Recognition/
| sort @timestamp desc
| limit 100

# 4. Azure STT API Key 有効期限確認
aws secretsmanager get-secret-value \
  --secret-id prod/azure/speech-key \
  --query 'SecretString' --output text | jq '.expires_at'
```

**一般的な原因と対処:**

| 原因 | 診断 | 対処 |
|------|------|------|
| **Azure STT クォータ超過** | Azure Portal: クォータ使用状況確認 | クォータ増加申請、またはレート制限実装 |
| **マイクアクセス拒否** | ブラウザログ: "NotAllowedError" | ユーザーにマイク権限付与を依頼 |
| **ネットワークレイテンシ高** | CloudWatch: WebSocket latency > 500ms | リージョン変更、ネットワーク品質確認 |
| **API Key 期限切れ** | Azure API: "401 Unauthorized" | Secrets Manager で API Key 更新 |
| **WebSocket 切断** | Lambda ログ: "Connection closed" | 自動再接続ロジック確認、IoT Core 設定確認 |

**対処（短期）:**

```bash
# Azure STT エンドポイント変更（フォールバック）
# apps/web/.env.production
NEXT_PUBLIC_AZURE_SPEECH_REGION=eastus  # → westus2 に変更

# デプロイ
npm run deploy:production
```

**対処（長期）:**

```typescript
// アプリ側での自動リトライ実装
// apps/web/hooks/useRealtimeTranscription.ts

recognizer.canceled = (s, e) => {
  if (e.reason === sdk.CancellationReason.Error) {
    console.error('STT Error:', e.errorDetails);

    // 3回までリトライ
    if (retryCount < 3) {
      setTimeout(() => {
        recognizer.startContinuousRecognitionAsync();
        retryCount++;
      }, 1000 * retryCount);
    } else {
      // マニュアル入力にフォールバック
      setTranscriptionMode('manual');
      showNotification({
        type: 'error',
        message: '音声認識に問題が発生しました。手動入力に切り替えてください。'
      });
    }
  }
};
```

### 問題: WebSocket 接続が頻繁に切断される

**症状:**

- セッション中に「接続が切断されました」メッセージが頻繁に表示される
- 録画データが途中で途切れる
- AI応答が届かない

**診断手順:**

```bash
# 1. IoT Core 接続メトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/IoT \
  --metric-name Connect.Success \
  --metric-name Connect.Failure \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# 2. Lambda WebSocket ハンドラーエラー確認
aws logs tail /aws/lambda/prance-websocket-function --since 30m \
  --filter-pattern "ERROR|Disconnect"

# 3. DynamoDB スロットリング確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=websocket_connections \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**一般的な原因と対処:**

| 原因 | 診断 | 対処 |
|------|------|------|
| **Lambda タイムアウト** | CloudWatch Logs: "Task timed out after 60.00 seconds" | Lambda タイムアウトを 300秒に増加 |
| **IoT Core ポリシー不足** | IoT Core ログ: "Forbidden" | IoT ポリシーに `iot:Publish`, `iot:Subscribe` 追加 |
| **DynamoDB スロットリング** | CloudWatch: UserErrors > 0 | DynamoDB オンデマンドモードに変更 |
| **クライアント側ネットワーク** | ブラウザコンソール: "WebSocket connection failed" | ユーザーにネットワーク確認を依頼 |
| **Lambda 同時実行制限** | CloudWatch: Throttles > 0 | 予約済み同時実行数を増加 |

**対処（即座）:**

```bash
# Lambda 同時実行数制限を緩和
aws lambda put-function-concurrency \
  --function-name prance-websocket-function \
  --reserved-concurrent-executions 500

# DynamoDB をオンデマンドモードに変更
aws dynamodb update-table \
  --table-name websocket_connections \
  --billing-mode PAY_PER_REQUEST
```

**対処（長期）:**

```typescript
// クライアント側での自動再接続実装
// apps/web/hooks/useWebSocket.ts

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

wsClient.onDisconnect(() => {
  console.warn('WebSocket disconnected');

  if (reconnectAttempts < maxReconnectAttempts) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
      wsClient.reconnect();
      reconnectAttempts++;
    }, delay);
  } else {
    // 再接続失敗 → ユーザーに通知
    showNotification({
      type: 'error',
      message: '接続が切断されました。セッションを再開してください。'
    });

    // 録画データをローカルに保存
    saveRecordingLocally();
  }
});

wsClient.onConnect(() => {
  // 再接続成功 → カウンターリセット
  reconnectAttempts = 0;
});
```

### 問題: 録画データのアップロード失敗

**症状:**

- セッション終了後、「録画データのアップロードに失敗しました」エラー
- 録画ファイルがS3にない
- Step Functions ワークフローが失敗している

**診断手順:**

```bash
# 1. S3アップロードログ確認（CloudWatch Logs Insights）
fields @timestamp, @message
| filter @message like /S3|Upload|PutObject/
| filter session_id = "session_abc123"
| sort @timestamp desc

# 2. Step Functions 実行履歴確認
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:SessionProcessing \
  --status-filter FAILED \
  --max-results 10

# 3. S3バケットポリシー確認
aws s3api get-bucket-policy \
  --bucket prance-recordings-production \
  --query Policy --output text | jq .

# 4. Lambda S3 アクセス権限確認
aws iam get-role-policy \
  --role-name prance-api-function-role \
  --policy-name S3AccessPolicy
```

**一般的な原因と対処:**

| 原因 | 診断 | 対処 |
|------|------|------|
| **ファイルサイズ超過** | ブラウザログ: "413 Payload Too Large" | プラン別サイズ制限を調整、圧縮率向上 |
| **S3バケット権限不足** | S3 ログ: "AccessDenied" | IAM ロールに `s3:PutObject` 権限追加 |
| **署名付きURL 期限切れ** | ブラウザログ: "403 Forbidden" | URL有効期限を延長（15分 → 30分） |
| **ネットワークタイムアウト** | ブラウザログ: "Network request failed" | アップロードタイムアウトを延長 |
| **S3 CORS設定不足** | ブラウザログ: "CORS error" | S3バケット CORS設定を追加 |

**対処（即座）:**

```bash
# S3バケット CORS設定追加
aws s3api put-bucket-cors \
  --bucket prance-recordings-production \
  --cors-configuration file://cors-config.json

# cors-config.json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "POST"],
      "AllowedOrigins": ["https://app.prance-platform.com"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

**対処（長期）:**

```typescript
// アップロードリトライロジック実装
// apps/web/lib/recording/upload.ts

async function uploadToS3WithRetry(
  blob: Blob,
  presignedUrl: string,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob.type
        }
      });

      if (response.ok) {
        console.log('Upload successful');
        return;
      }

      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.error(`Upload attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        // 最後のリトライも失敗 → ローカル保存
        saveRecordingLocally(blob);

        showNotification({
          type: 'error',
          message: 'アップロードに失敗しました。録画データはローカルに保存されました。'
        });

        throw error;
      }

      // 指数バックオフで待機
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function saveRecordingLocally(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording_${Date.now()}.webm`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## バックアップ・リストア

### 自動バックアップ

#### Aurora PostgreSQL

```yaml
# 自動バックアップ設定
Aurora:
  BackupRetentionPeriod: 35  # 35日間保持
  PreferredBackupWindow: "03:00-04:00"  # JST 12:00-13:00
  EnableBacktrackで: false  # Aurora PostgreSQLは非対応
  EnablePITR: true  # Point-in-Time Recovery

# スナップショット（手動）
# デプロイ前、月次
```

#### S3

```yaml
# バージョニング有効化
S3Bucket:
  VersioningConfiguration:
    Status: Enabled

# クロスリージョンレプリケーション
ReplicationConfiguration:
  Role: !GetAtt S3ReplicationRole.Arn
  Rules:
    - Id: ReplicateAllObjects
      Status: Enabled
      Priority: 1
      Destination:
        Bucket: !GetAtt BackupBucket.Arn
        ReplicationTime:
          Status: Enabled
          Time:
            Minutes: 15
```

### バックアップ検証

```bash
#!/bin/bash
# backup-validation.sh

# 月次バックアップ検証（毎月1日実行）

echo "=== Backup Validation ==="

# 1. Aurora スナップショット確認
echo "[1] Aurora Snapshots"
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier prance-production-cluster \
  --query 'DBClusterSnapshots[0:5].[DBClusterSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table

# 2. S3 バージョニング確認
echo "[2] S3 Versioning"
aws s3api get-bucket-versioning \
  --bucket prance-recordings-production

# 3. レプリケーション確認
echo "[3] S3 Replication"
aws s3api get-bucket-replication \
  --bucket prance-recordings-production

# 4. テストリストア実行（ステージング環境）
echo "[4] Test Restore"
./scripts/restore-test.sh staging

echo "=== Validation Complete ==="
```

### リストア手順

#### Aurora PITR（Point-in-Time Recovery）

```bash
# 特定時点へのリストア
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier prance-production-cluster \
  --db-cluster-identifier prance-restored-cluster \
  --restore-to-time "2026-03-04T10:30:00Z" \
  --vpc-security-group-ids sg-xxxxxxxxxxxxx \
  --db-subnet-group-name prance-db-subnet-group

# 接続先切り替え（DNS更新またはCDK再デプロイ）
```

#### S3オブジェクトリストア

```bash
# バージョン指定でリストア
aws s3api get-object \
  --bucket prance-recordings-production \
  --key recordings/session_abc123.mp4 \
  --version-id EXAMPLE_VERSION_ID \
  session_abc123.mp4

# 一括リストア（特定日時以降）
aws s3 sync \
  s3://prance-recordings-production-backup/ \
  s3://prance-recordings-production/ \
  --exclude "*" \
  --include "2026-03-04/*"
```

---

## スケーリング

### Lambda スケーリング

```typescript
// Provisioned Concurrency 設定
const version = lambdaFunction.currentVersion;
const alias = version.addAlias('live', {
  provisionedConcurrentExecutions: 10,
});

// Auto Scaling
const target = new appscaling.ScalableTarget(this, 'ScalableTarget', {
  serviceNamespace: appscaling.ServiceNamespace.LAMBDA,
  maxCapacity: 100,
  minCapacity: 10,
  resourceId: `function:${lambdaFunction.functionName}:live`,
  scalableDimension: 'lambda:function:ProvisionedConcurrentExecutions',
});

target.scaleToTrackMetric('PceTracking', {
  targetValue: 0.70,
  predefinedMetric: appscaling.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
});
```

### Aurora スケーリング

```yaml
# Aurora Serverless v2
MinCapacity: 0.5 ACU  # 最小
MaxCapacity: 16 ACU   # 最大

# スケールアップトリガー:
# - CPU使用率 > 70%
# - 接続数 > 50

# スケールダウントリガー:
# - CPU使用率 < 30% (5分継続)
# - 接続数 < 20
```

### 手動スケーリング（イベント対応）

```bash
# 大規模イベント前のスケールアップ

# 1. Lambda Provisioned Concurrency 増加
aws lambda put-provisioned-concurrency-config \
  --function-name prance-api-function \
  --provisioned-concurrent-executions 50 \
  --qualifier live

# 2. Aurora 最小ACU引き上げ
aws rds modify-db-cluster \
  --db-cluster-identifier prance-production-cluster \
  --serverless-v2-scaling-configuration MinCapacity=2.0,MaxCapacity=32.0

# 3. CloudFront キャッシュ warming
./scripts/cache-warming.sh

# イベント終了後、元に戻す
```

---

## メンテナンス

### 定期メンテナンス

| 頻度 | タスク | 担当 |
|------|--------|------|
| **日次** | ヘルスチェック、ログ確認 | オンコール |
| **週次** | パフォーマンスレビュー、コスト分析 | SRE |
| **月次** | バックアップ検証、セキュリティパッチ | SRE |
| **四半期** | DR訓練、キャパシティプランニング | SRE + Dev |
| **年次** | ペネトレーションテスト、監査対応 | Security + SRE |

### メンテナンスウィンドウ

**定期メンテナンス:**

- 時間: 毎月第2火曜 3:00-5:00 JST
- 通知: 1週間前
- 影響: サービス継続（最小限の影響）

**計画停止メンテナンス:**

- 頻度: 年2回
- 時間: 日曜 2:00-6:00 JST
- 通知: 1ヶ月前
- 影響: サービス停止あり

### 依存関係更新

```bash
# 月次依存関係更新

# 1. npm パッケージ更新
npm outdated
npm update
npm audit fix

# 2. セキュリティパッチ適用
npm audit
npm audit fix --force  # 破壊的変更がある場合は慎重に

# 3. テスト実行
npm run test
npm run test:e2e

# 4. ステージング環境デプロイ
./scripts/deploy.sh staging

# 5. 動作確認後、本番デプロイ
./scripts/deploy.sh production
```

---

## ドキュメント管理

### ランブック更新

```
docs/runbooks/
  ├── incident-response.md          # インシデント対応手順
  ├── deployment.md                 # デプロイ手順
  ├── database-maintenance.md       # DB メンテナンス
  ├── scaling-procedures.md         # スケーリング手順
  └── disaster-recovery.md          # DR手順

# 更新タイミング:
# - 新機能デプロイ時
# - インシデント発生後
# - 四半期レビュー時
```

### オンコールハンドオーバー

```markdown
# Handover Template

## Date: 2026-03-04

### Ongoing Issues
- [ ] Issue #123: Intermittent API latency spike (P2)
  - Root cause: Under investigation
  - Next step: Profile Lambda function

### Scheduled Tasks
- [ ] Deploy v1.2.4 to production (tomorrow 10:00)
- [ ] Monthly backup validation (March 5)

### Monitoring
- Aurora CPU: Normal (30-40%)
- Lambda errors: Below threshold
- Cost: Trending slightly high (investigate S3)

### Notes
- New customer onboarding scheduled for tomorrow
- Keep an eye on #customer-feedback channel

## Handover to: [Next person]
```

---

次のステップ: [プロダクト要求仕様](PRODUCT_REQUIREMENTS.md) → [ユーザーストーリー](USER_STORIES.md)
