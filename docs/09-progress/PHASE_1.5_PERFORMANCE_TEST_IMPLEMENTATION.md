# Phase 1.5 Performance Test Implementation - Complete

**作成日:** 2026-03-14
**Phase:** 1.5 (Day 14 - Performance Testing)
**ステータス:** ✅ 実装完了（テスト準備完了）

---

## 📋 実装概要

Phase 1.5の残りタスクである「パフォーマンステスト」の実装が完了しました。

### 実装内容

1. **パフォーマンステストスクリプト** (`scripts/performance-test.ts`)
2. **CloudWatch メトリクス収集スクリプト** (`scripts/collect-metrics.sh`)
3. **認証トークン取得スクリプト** (`scripts/get-auth-token.js`)
4. **CloudWatch Monitoring Stack** (`infrastructure/lib/monitoring-stack.ts`)
5. **テスト実行ガイド** (`docs/07-development/PHASE_1.5_PERFORMANCE_TEST_GUIDE.md`)

---

## 🎯 Phase 1.5 完了基準

| 基準 | 目標値 | 測定方法 |
|------|--------|---------|
| **平均レスポンス時間** | < 4秒 | STT開始 → TTS完了 |
| **95パーセンタイル** | < 6秒 | 全テストの95% |
| **成功率** | > 95% | 正常完了 / 全テスト |

---

## 📁 作成ファイル一覧

### 1. Performance Test Script

**ファイル:** `scripts/performance-test.ts`
**サイズ:** 520行
**機能:**
- WebSocket接続テスト
- STT → AI → TTS パイプライン測定
- 単一セッション/負荷テスト対応
- JSON形式の詳細レポート出力
- Phase 1.5完了基準の自動判定

**使用方法:**
```bash
# 単一セッションテスト
pnpm run perf:test

# 10並行負荷テスト
pnpm run perf:load

# 詳細ログ
pnpm run perf:test -- --verbose
```

### 2. CloudWatch Metrics Collection Script

**ファイル:** `scripts/collect-metrics.sh`
**サイズ:** 180行
**機能:**
- Lambda呼び出し回数・エラー率
- 実行時間（平均・P95・最大）
- 同時実行数
- 最近のエラーログ（最新10件）
- Phase 1.5完了基準の自動判定

**使用方法:**
```bash
# 過去1時間のメトリクス
pnpm run perf:metrics

# 過去24時間
pnpm run perf:metrics -- --hours 24

# 過去7日間
pnpm run perf:metrics -- --days 7
```

### 3. Auth Token Helper Script

**ファイル:** `scripts/get-auth-token.js`
**サイズ:** 35行
**機能:**
- Lambda APIへのログイン
- JWTアクセストークン取得
- 環境変数への簡易設定

**使用方法:**
```bash
# トークン取得
export AUTH_TOKEN=$(./scripts/get-auth-token.js)

# カスタム認証情報
export AUTH_EMAIL="user@example.com"
export AUTH_PASSWORD="password"
export AUTH_TOKEN=$(./scripts/get-auth-token.js)
```

### 4. CloudWatch Monitoring Stack

**ファイル:** `infrastructure/lib/monitoring-stack.ts`
**サイズ:** 200行
**機能:**
- CloudWatch Dashboard作成
  - WebSocket呼び出し数
  - エラー率
  - レスポンス時間（平均・P95・最大）
  - 同時実行数
  - 成功率
- CloudWatch Alarms設定
  - 高エラー率アラーム（> 5%）
  - 高レスポンス時間アラーム（P95 > 6秒）
  - スロットルアラーム（> 5回）
- SNS通知統合

**デプロイ:**
```bash
cd infrastructure
pnpm run cdk -- deploy Prance-dev-Monitoring
```

**Dashboard URL:**
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Prance-dev-Performance
```

### 5. Test Execution Guide

**ファイル:** `docs/07-development/PHASE_1.5_PERFORMANCE_TEST_GUIDE.md`
**サイズ:** 450行
**内容:**
- Phase 1.5完了基準の説明
- パフォーマンステストの実行手順
- CloudWatch Dashboard/Alarmsの使用方法
- ボトルネック分析手法
- トラブルシューティングガイド
- 継続的モニタリング設定
- Phase 1.5完了チェックリスト

---

## 🔧 npm Scripts 追加

`package.json` に以下のスクリプトを追加：

```json
{
  "scripts": {
    "perf:test": "pnpm exec tsx scripts/performance-test.ts",
    "perf:load": "pnpm exec tsx scripts/performance-test.ts --load 10",
    "perf:metrics": "bash scripts/collect-metrics.sh"
  }
}
```

---

## 📊 テストの流れ

### 1. 単一セッションテスト

```bash
# Step 1: 認証トークン取得
export AUTH_TOKEN=$(./scripts/get-auth-token.js)

# Step 2: パフォーマンステスト実行
pnpm run perf:test
```

**出力例:**
```
🚀 Starting single session performance test...

[perf-test-1710403200000] Connected in 123ms
[perf-test-1710403200000] STT completed in 1850ms
[perf-test-1710403200000] AI response completed in 2100ms
[perf-test-1710403200000] TTS completed in 950ms
[perf-test-1710403200000] Total pipeline time: 4900ms

📊 Test Result:
  Session ID: perf-test-1710403200000
  Success: ✅
  Total Response Time: 4.90s
```

### 2. 負荷テスト（10並行）

```bash
pnpm run perf:load
```

**出力例:**
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
```

### 3. CloudWatch メトリクス確認

```bash
pnpm run perf:metrics
```

**出力例:**
```
================================================================
📊 CloudWatch Metrics Collection
================================================================

Function: prance-websocket-default-dev
Region: us-east-1

1. Invocation Metrics
---
  Total Invocations: 150
  Total Errors: 3
  Error Rate: 2.00%

2. Duration Metrics
---
  Average Duration: 3245ms
  P95 Duration: 5123ms

4. Phase 1.5 Completion Criteria
---
  ✅ Average Duration < 4s: PASS (3.25s)
  ✅ Error Rate < 5%: PASS (2.00%)
```

---

## 🚀 次のステップ

### Immediate（今すぐ実行）

1. **認証トークン取得**
   ```bash
   export AUTH_TOKEN=$(./scripts/get-auth-token.js)
   ```

2. **単一セッションテスト**
   ```bash
   pnpm run perf:test
   ```

3. **CloudWatch メトリクス確認**
   ```bash
   pnpm run perf:metrics
   ```

### Short-term（Day 14-15）

1. **負荷テスト実行**
   ```bash
   pnpm run perf:load
   ```

2. **CloudWatch Monitoring Stack デプロイ**
   ```bash
   cd infrastructure
   pnpm run cdk -- deploy Prance-dev-Monitoring
   ```

3. **CloudWatch Dashboard確認**
   - ブラウザでダッシュボードにアクセス
   - メトリクスが正しく表示されているか確認
   - アラームが設定されているか確認

4. **Phase 1.5完了判定**
   - 全テスト結果を集計
   - 完了基準を満たしているか確認
   - レポート作成

---

## ✅ Phase 1.5 完了チェックリスト

### テスト実施

- [ ] 単一セッションテスト成功（平均 < 4秒）
- [ ] 負荷テスト成功（10並行、成功率 > 95%）
- [ ] CloudWatch メトリクス確認（P95 < 6秒）
- [ ] エラーハンドリング適切（エラー時の通知）

### インフラ設定

- [ ] CloudWatch Monitoring Stack デプロイ完了
- [ ] CloudWatch Dashboard作成完了
- [ ] CloudWatch Alarms設定完了
- [ ] SNS通知設定完了（オプション）

### ドキュメント

- [ ] テスト結果レポート作成
- [ ] ボトルネック分析実施
- [ ] Phase 1.5完了レポート作成

---

## 📝 技術的な詳細

### パフォーマンステストの仕組み

**1. WebSocket接続:**
- `ws` パッケージ使用
- 接続時間測定（`Date.now()`）

**2. メッセージ送受信:**
- JSON形式でメッセージ送信
- `action: 'audio_chunk'` で音声チャンク送信
- `isFinal: true` でSTT処理トリガー

**3. タイミング測定:**
- `sttStartTime`: 音声チャンク送信時刻
- `sttEndTime`: `transcript` メッセージ受信時刻
- `aiStartTime`: `ai_chunk_start` メッセージ受信時刻
- `aiEndTime`: `ai_chunk_end` メッセージ受信時刻
- `ttsStartTime`: `tts_chunk_start` メッセージ受信時刻
- `ttsEndTime`: `tts_chunk_end` メッセージ受信時刻

**4. 結果集計:**
- 平均・中央値・P95・最小・最大を計算
- Phase 1.5完了基準と比較
- JSON形式で詳細結果を保存

### CloudWatch メトリクスの種類

**Lambda標準メトリクス:**
- `Invocations`: 呼び出し回数
- `Errors`: エラー回数
- `Throttles`: スロットル回数
- `Duration`: 実行時間（平均・P95・最大）
- `ConcurrentExecutions`: 同時実行数

**カスタムメトリクス（今後追加予定）:**
- STT処理時間
- AI応答時間
- TTS処理時間
- エンドツーエンドレスポンス時間

---

## 🔍 トラブルシューティング

### テストが失敗する場合

**1. WebSocket接続エラー:**
```bash
# WebSocket API URLを確認
echo $WEBSOCKET_URL

# Lambda関数が起動しているか確認
aws lambda get-function --function-name prance-websocket-default-dev
```

**2. 認証エラー:**
```bash
# 新しいトークンを取得
export AUTH_TOKEN=$(./scripts/get-auth-token.js)

# トークンの有効性を確認
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/auth/me
```

**3. STT/AI/TTSエラー:**
- CloudWatch Logs でエラー詳細を確認
- 環境変数が正しく設定されているか確認
- APIキーが有効か確認

---

## 📈 期待される結果

Phase 1.5完了基準を満たす結果：

| メトリクス | 目標 | 期待値 |
|-----------|------|--------|
| 平均レスポンス時間 | < 4秒 | 3.0-3.5秒 |
| P95レスポンス時間 | < 6秒 | 4.5-5.5秒 |
| 成功率 | > 95% | 98-100% |
| エラー率 | < 5% | 0-2% |

---

## 🎉 完了

Phase 1.5パフォーマンステストの実装が完了しました。

**次のアクション:**
1. テストを実行して結果を確認
2. CloudWatch Dashboard/Alarmsをデプロイ
3. Phase 1.5完了レポートを作成
4. Phase 1.6（既存機能の実用化）に進む

---

**最終更新:** 2026-03-14
**実装者:** Claude Code
**次回レビュー:** Phase 1.5テスト実行後
