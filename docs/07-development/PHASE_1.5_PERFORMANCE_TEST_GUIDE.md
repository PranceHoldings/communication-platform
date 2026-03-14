# Phase 1.5 Performance Test Guide

**作成日:** 2026-03-14
**Phase:** 1.5 (Real-time Conversation Performance Testing)
**目標:** Phase 1.5完了基準の検証

---

## 📋 Phase 1.5 完了基準

Phase 1.5の完了基準は以下の通りです：

| 基準 | 目標値 | 測定方法 |
|------|--------|---------|
| **平均レスポンス時間** | < 4秒 | STT開始 → TTS完了 |
| **95パーセンタイル** | < 6秒 | 全テストの95% |
| **成功率** | > 95% | 正常完了 / 全テスト |
| **エラーハンドリング** | 適切なフィードバック | エラー時のユーザー通知 |

---

## 🚀 パフォーマンステストの実行

### Step 1: 環境確認

```bash
# Next.js開発サーバー確認
curl http://localhost:3000

# Lambda API確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health

# AWS認証確認
aws sts get-caller-identity
```

### Step 2: 認証トークン取得

```bash
# 認証トークン取得（環境変数に設定）
export AUTH_TOKEN=$(./scripts/get-auth-token.sh)

# トークン確認
echo $AUTH_TOKEN
```

### Step 3: 単一セッションテスト

```bash
# 基本テスト（1セッション）
npm run perf:test

# 詳細ログ付きテスト
npm run perf:test -- --verbose
```

**期待される出力:**

```
🚀 Starting single session performance test...

[perf-test-1710403200000] Connected in 123ms
[perf-test-1710403200000] Sent audio chunk
[perf-test-1710403200000] STT completed in 1850ms
[perf-test-1710403200000] AI response completed in 2100ms
[perf-test-1710403200000] TTS completed in 950ms
[perf-test-1710403200000] Total pipeline time: 4900ms

📊 Test Result:
  Session ID: perf-test-1710403200000
  Success: ✅
  Total Response Time: 4.90s
```

### Step 4: 負荷テスト（10並行セッション）

```bash
# 10セッション同時実行
npm run perf:test -- --load 10

# カスタム並行数
npm run perf:test -- --load 20
```

**期待される出力:**

```
================================================================================
📊 PERFORMANCE TEST RESULTS
================================================================================

Success Rate: 100.0% (10/10)

Total Response Time (STT → AI → TTS):
  Average:  3.45s
  Median:   3.32s
  95th %:   5.12s
  Min:      2.89s
  Max:      5.45s

🎯 Phase 1.5 Completion Criteria:
  ✓ Average < 4s:     ✅ PASS (3.45s)
  ✓ 95th % < 6s:      ✅ PASS (5.12s)
  ✓ Success rate > 95%: ✅ PASS (100.0%)

✅ ALL CRITERIA MET

Component Breakdown (Average):
  Connection:  125ms
  STT:         1850ms
  AI:          980ms
  TTS:         495ms

================================================================================

📄 Detailed results saved to: test-results/performance-test-2026-03-14T10-30-45-123Z.json
```

### Step 5: CloudWatch メトリクス確認

```bash
# 過去1時間のメトリクス
npm run perf:metrics

# 過去24時間のメトリクス
npm run perf:metrics -- --hours 24

# 過去7日間のメトリクス
npm run perf:metrics -- --days 7
```

**期待される出力:**

```
================================================================
📊 CloudWatch Metrics Collection
================================================================

Function: prance-websocket-default-dev
Region: us-east-1
Time Range: Last 1 hours
Period: 2026-03-14T09:30:00 to 2026-03-14T10:30:00

1. Invocation Metrics
---
  Total Invocations: 150
  Total Errors: 3
  Total Throttles: 0
  Error Rate: 2.00%

2. Duration Metrics
---
  Average Duration: 3245ms
  P95 Duration: 5123ms
  Max Duration: 6890ms

3. Concurrent Executions
---
  Average Concurrent: 2
  Max Concurrent: 8

4. Phase 1.5 Completion Criteria
---
  ✅ Average Duration < 4s: PASS (3.25s)
  ✅ Error Rate < 5%: PASS (2.00%)

5. Recent Errors (Last 10)
---
  [2026-03-14 10:15:32] ERROR: ElevenLabs API timeout after 5000ms
  [2026-03-14 10:12:18] ERROR: Azure STT failed: Network unreachable
  [2026-03-14 10:08:45] ERROR: Bedrock throttling: Rate limit exceeded

================================================================

💡 Tip: For end-to-end performance metrics, run:
   npm run perf:test
```

---

## 📊 CloudWatch Dashboard

### Dashboard URL

CloudWatch ダッシュボードにアクセス：

```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Prance-dev-Performance
```

### ダッシュボードの内容

**Row 1: 呼び出しメトリクス**
- WebSocket Invocations（5分間隔）
- Error Rate（エラー・スロットル）

**Row 2: レスポンス時間**
- Lambda Duration（平均・P95・最大）
- Phase 1.5目標ライン（4秒・6秒）

**Row 3: 同時実行**
- Concurrent Executions
- Success Rate（過去1時間）

### CloudWatch Alarms

以下のアラームが設定されています：

| アラーム | 条件 | アクション |
|---------|------|----------|
| **High Error Rate** | エラー率 > 5% | SNS通知 |
| **High Duration** | P95 > 6秒 | SNS通知 |
| **Throttles** | スロットル > 5回 | SNS通知 |

---

## 🔍 ボトルネック分析

### X-Ray Trace分析

```bash
# X-Ray トレースを確認
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --filter-expression 'service("prance-websocket-default-dev")'
```

### コンポーネント別レスポンス時間

典型的な内訳（目標値）：

| コンポーネント | 目標時間 | 実測平均 | 最適化余地 |
|---------------|---------|---------|----------|
| **WebSocket接続** | < 200ms | 125ms | ✅ |
| **STT（Azure Speech）** | < 2000ms | 1850ms | ✅ |
| **AI応答（Bedrock Claude）** | < 2000ms | 980ms | ✅ |
| **TTS（ElevenLabs）** | < 1000ms | 495ms | ✅ |
| **合計** | < 4000ms | 3450ms | ✅ |

### 最適化ポイント

**STTが遅い場合（> 2秒）:**
- 音声チャンクサイズを小さくする（1秒 → 0.5秒）
- Azure Speech Regionを最適化（us-east-1が最速）
- 無音検出閾値を調整

**AI応答が遅い場合（> 2秒）:**
- Lambda Provisioned Concurrency設定
- Bedrock Inference Profile使用
- プロンプト長を短縮

**TTSが遅い場合（> 1秒）:**
- ElevenLabs WebSocket Streaming使用（既に実装済み）
- 音声チャンクをより小さく分割
- モデルをturbo_v2.5に変更（高速化）

---

## 🐛 トラブルシューティング

### エラー: Connection timeout

**原因:** WebSocket接続失敗

**解決策:**
```bash
# WebSocket API URLを確認
echo $WEBSOCKET_URL

# Lambda関数が起動しているか確認
aws lambda get-function --function-name prance-websocket-default-dev

# API Gateway WebSocketエンドポイントを確認
aws apigatewayv2 get-apis --query 'Items[?Name==`prance-websocket-dev`]'
```

### エラー: Authentication failed

**原因:** 認証トークンが無効または期限切れ

**解決策:**
```bash
# 新しいトークンを取得
export AUTH_TOKEN=$(./scripts/get-auth-token.sh)

# トークンの有効性を確認
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/auth/me
```

### エラー: STT failed

**原因:** Azure Speech Services API障害

**解決策:**
```bash
# 環境変数を確認
echo $AZURE_SPEECH_KEY
echo $AZURE_SPEECH_REGION

# Azure Speech サービスステータス確認
curl "https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken" \
  -H "Ocp-Apim-Subscription-Key: ${AZURE_SPEECH_KEY}"
```

### エラー: AI response failed

**原因:** AWS Bedrock API障害またはレート制限

**解決策:**
```bash
# Bedrock権限を確認
aws bedrock list-foundation-models --region us-east-1

# Bedrock quotaを確認
aws service-quotas get-service-quota \
  --service-code bedrock \
  --quota-code L-1D9381B1
```

### エラー: TTS failed

**原因:** ElevenLabs API障害

**解決策:**
```bash
# ElevenLabs APIステータス確認
curl -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
  https://api.elevenlabs.io/v1/user

# Voice IDを確認
curl -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
  https://api.elevenlabs.io/v1/voices
```

---

## 📈 継続的モニタリング

### 定期テスト（推奨）

```bash
# crontabで1時間ごとにテスト実行
0 * * * * cd /path/to/prance && npm run perf:test >> /var/log/prance-perf.log 2>&1

# 毎日午前2時に負荷テスト
0 2 * * * cd /path/to/prance && npm run perf:load >> /var/log/prance-load.log 2>&1
```

### メトリクス収集（推奨）

```bash
# 1時間ごとにメトリクス収集
0 * * * * cd /path/to/prance && npm run perf:metrics >> /var/log/prance-metrics.log 2>&1
```

---

## ✅ Phase 1.5完了チェックリスト

パフォーマンステストを実行し、以下の全項目を確認してください：

### 必須項目

- [ ] 単一セッションテスト成功（平均 < 4秒）
- [ ] 負荷テスト成功（10並行、成功率 > 95%）
- [ ] CloudWatch メトリクス確認（P95 < 6秒）
- [ ] エラーハンドリング適切（エラー時の通知）
- [ ] CloudWatch Dashboard作成完了
- [ ] CloudWatch Alarms設定完了

### 推奨項目

- [ ] 50並行負荷テスト成功
- [ ] X-Ray Trace分析実施
- [ ] ボトルネック特定・最適化実施
- [ ] 継続的モニタリング設定

---

## 📝 レポート作成

テスト完了後、以下の情報を含むレポートを作成してください：

### テスト結果サマリー

- テスト日時
- テスト環境（dev/staging/production）
- テスト種別（単一/負荷）
- 成功率
- 平均レスポンス時間
- P95レスポンス時間

### 完了基準達成状況

- [ ] 平均レスポンス時間 < 4秒
- [ ] P95レスポンス時間 < 6秒
- [ ] 成功率 > 95%

### 発見された問題

- エラー内容
- 発生頻度
- 根本原因
- 対応策

### 推奨事項

- 最適化ポイント
- インフラ調整
- コード改善

---

**最終更新:** 2026-03-14
**次回レビュー:** Phase 1.5完了時
**関連ドキュメント:**
- [PRODUCTION_READY_ROADMAP.md](../../03-planning/releases/PRODUCTION_READY_ROADMAP.md)
- [SESSION_HISTORY.md](../../09-progress/SESSION_HISTORY.md)
