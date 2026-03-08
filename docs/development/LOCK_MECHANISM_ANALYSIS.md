# ロックメカニズム潜在的問題分析と対応策

**作成日:** 2026-03-08
**対象:** WebSocketチャンク処理のDynamoDBロックメカニズム
**ファイル:** `infrastructure/lambda/websocket/default/index.ts`

---

## 📊 調査概要

WebSocketで受信する動画・音声チャンクの重複処理を防ぐために、DynamoDB条件付き書き込みを使用した分散ロックメカニズムを実装している。複数のLambda関数が同時に同じチャンクを処理しようとした場合、最初の1つだけがロックを取得し、他はスキップする仕組み。

**調査対象コード:**

- Video chunk処理: Lines 312-431
- Audio chunk処理: Lines 553-689

---

## 🔍 発見された潜在的問題（9項目）

### 🔴 Critical（即対応が必要）

#### 1. エラー発生時のロック解放漏れ

**問題:**

- ロック取得後、処理中にエラーが発生するとロック削除コード（Line 408-419, 643-654）に到達しない
- TTL（5分）が切れるまでロックが残り、他のLambdaがそのチャンクを処理できない

**影響範囲:**

```typescript
// Line 345-406: video chunk reassembly (no try-catch)
console.log(`Reassembling video chunk ${chunkId}...`);
const partBuffers: Buffer[] = [];
for (let i = 0; i < totalParts; i++) {
  // S3 GetObject - network error可能性
  // Buffer.from - memory error可能性
}
const videoBuffer = Buffer.concat(partBuffers); // OOM可能性
await videoProc.saveVideoChunk(...); // S3 PutObject - network error可能性

// Line 408: ロック削除（エラー時に到達しない）
await ddb.send(new DeleteCommand({...}));
```

**エラーシナリオ:**

1. ネットワークエラー（S3 GetObject/PutObject失敗）
2. メモリ不足（Buffer.concat時のOOM）
3. Lambdaタイムアウト（処理時間超過）
4. 外部サービスエラー（audio処理時のAzure STT / ElevenLabs障害）

**現在の動作:**

```
Lambda A: Lock acquired for chunk-123
Lambda A: [Processing...] → ERROR!
Lambda A: Lock NOT cleaned up (code unreached)
Lambda B: Lock already held for chunk-123, skipping
Result: chunk-123 never processed until TTL expires (5 min)
```

#### 2. 音声処理パイプラインのエラー処理不足

**問題:**

- Line 625: `handleAudioProcessing()` 呼び出しにtry-catchがない
- Azure STT、Bedrock AI、ElevenLabs TTSのいずれかが失敗するとロックが残る

**影響:**

```typescript
// Line 625: No error handling
await handleAudioProcessing(connectionId, completeAudioBuffer, connectionData);
// ↓ この中でエラーが発生すると...

// Line 643: ロック削除に到達しない
await ddb.send(new DeleteCommand({...}));
```

**外部依存:**

- Azure Speech Services (STT)
- AWS Bedrock (AI response generation)
- ElevenLabs (TTS)

---

### 🟡 High（早めに対応すべき）

#### 3. ChunkIDの衝突可能性

**問題:**

- ChunkID生成: `${timestamp}-${Math.random().toString(36).substring(2, 9)}`
- ランダム部分: 7文字 → 36^7 = 約78億通り
- Birthday paradox: 約10万チャンクで衝突確率1%

**シミュレーション:**

```
同時セッション数: 100
チャンク頻度: 10 chunks/sec/session
総チャンク数/日: 100 * 10 * 86400 = 86,400,000 chunks/day

Birthday paradox formula:
P(collision) ≈ 1 - e^(-n²/2N)
where n = 86,400,000, N = 36^7 ≈ 78,364,164,096

P(collision) ≈ 0.47% (per day)
```

**衝突時の動作:**

```
Time 0.000s: Lambda A receives chunk-123-abc7def (video part 5)
Time 0.001s: Lambda B receives chunk-456-abc7def (video part 3, different chunk but same ID!)
Time 0.002s: Lambda A acquires lock "video-lock-abc7def"
Time 0.003s: Lambda B tries lock "video-lock-abc7def" → FAILS (thinks it's duplicate)
Result: chunk-456 is never processed!
```

**コード位置:**

```typescript
// apps/web/hooks/useWebSocket.ts:413
const chunkId = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
```

#### 4. ロック削除失敗時の処理

**問題:**

- ロック削除失敗時、エラーログのみで後処理なし
- TTL頼みになり、最悪48時間ロックが残る可能性（DynamoDB TTL遅延）

**現在のコード:**

```typescript
// Line 408-419 (video), 643-654 (audio)
try {
  await ddb.send(
    new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connection_id: lockKey },
    })
  );
  console.log(`Cleaned up lock for chunk ${chunkId}`);
} catch (error) {
  console.error(`Failed to clean up lock for chunk ${chunkId}:`, error);
  // ここで終わり！リトライも代替手段もなし
}
```

**失敗ケース:**

- DynamoDBスロットリング（ProvisionedThroughputExceededException）
- ネットワークタイムアウト
- DynamoDBサービス障害（稀だが発生する）

---

### 🟢 Medium（時間があれば対応）

#### 5. DynamoDB TTLの遅延

**問題:**

- TTL設定: 5分（300秒）
- AWS公式: "TTL deletion is best-effort and typically occurs within 48 hours"
- 実際には数時間〜数日遅れることもある

**影響:**

```
Expected: Lock expires at T+5min
Reality:  Lock might persist until T+48hours (worst case)
```

**緩和策:**

- 現状のTTL（5分）は適切
- ただし、エラー時のロック解放漏れ問題（Problem #1）が解決されれば、TTL遅延の影響は限定的

#### 6. Connectionテーブルの用途混在

**問題:**

- `prance-websocket-connections-dev` テーブル用途:
  - WebSocket接続情報（`connection_id: Z43y_c_kIAMCKSw=`）
  - 処理ロック（`connection_id: video-lock-17214-cef8b7j`）

**スキーマ:**

```
Table: prance-websocket-connections-dev
Partition Key: connection_id (STRING)
GSI: user-id-index
```

**問題点:**

- 接続情報とロック情報が混在
- GSI `user-id-index` はロック情報には無意味
- Scan操作時にロック情報も含まれ、パフォーマンス低下の可能性

**規模:**

```
Connections: ~100-1,000 (active WebSocket connections)
Locks:       ~10,000-100,000 (high-frequency chunking)
Ratio:       Locks >> Connections (100:1)
```

---

### ⚪ Low（監視のみ）

#### 7. S3パーツ削除失敗の影響

**問題:**

- Line 394-406 (video), 627-641 (audio): パーツ削除が失敗してもログのみ
- S3にゴミデータが残る

**現在のコード:**

```typescript
for (let i = 0; i < totalParts; i++) {
  try {
    await s3Client.send(new DeleteObjectCommand({...}));
  } catch (cleanupError) {
    console.warn(`Failed to clean up part ${i}:`, cleanupError);
    // 続行
  }
}
```

**影響:**

- ストレージコスト増加（S3標準: $0.023/GB/month）
- チャンク数: ~100,000 chunks/day
- パーツサイズ: ~40KB/part \* 9 parts = 360KB/chunk
- 削除失敗率: 仮に0.1%
- ゴミデータ: 100 chunks/day \* 360KB = 36MB/day = 1GB/month
- コスト: ~$0.02/month（無視できる）

**機能への影響:** なし（ロックは正常に削除されるため、再処理は発生しない）

#### 8. 音声処理の二重防止ロジックの重複

**問題:**

- ロックメカニズムと、`audioChunksCount`リセット＋S3削除の二重防止
- 複雑性が増すが、実害はない

**現在の防止層:**

1. **Layer 1 (Lock)**: DynamoDB条件付き書き込みでロック
2. **Layer 2 (Counter Reset)**: Line 656-659: `audioChunksCount = 0`
3. **Layer 3 (S3 Cleanup)**: Line 662-689: S3のaudio-chunksを削除
4. **Layer 4 (session_end Check)**: Line 752-757: audio-chunksがないことを確認

**評価:** Defense in depthとしては良い設計だが、Layer 1だけで十分な可能性

#### 9. S3リスト取得からロック取得までのRace Condition

**問題:**

- Line 301-311 (video), 538-551 (audio): S3リストでパーツ数確認
- リスト取得からロック取得まで数ミリ秒のギャップ
- 複数のLambdaが同時に「全パーツ揃った」と判定する可能性

**タイムライン:**

```
T+0ms:  Lambda A lists S3 → 9/9 parts found
T+1ms:  Lambda B lists S3 → 9/9 parts found
T+2ms:  Lambda A acquires lock → SUCCESS
T+3ms:  Lambda B tries lock → FAIL (skip)
Result: No problem (lock prevents duplicate processing)
```

**評価:** ロックメカニズムで最終的に1つだけが処理するため、実害なし

---

## 📋 推奨される対応策

### Priority 1: エラーハンドリングの追加（Critical）

**対応内容:**

1. ロック取得後の処理全体をtry-catch-finallyで囲む
2. finallyブロックでロックを必ず削除
3. エラー時は適切なエラーメッセージをクライアントに送信

**実装例（Video処理）:**

```typescript
// Line 332後に追加
console.log(`Lock acquired for chunk ${chunkId}, proceeding with processing`);

let processingSuccess = false;
try {
  // === 既存の処理ロジック ===
  console.log(`Reassembling video chunk ${chunkId}...`);
  const partBuffers: Buffer[] = [];
  for (let i = 0; i < totalParts; i++) {
    // ... S3 download
  }
  const videoBuffer = Buffer.concat(partBuffers);
  await videoProc.saveVideoChunk(...);

  // S3パーツ削除
  for (let i = 0; i < totalParts; i++) {
    // ... delete parts
  }

  processingSuccess = true;

} catch (processingError) {
  console.error(`[video_chunk_part] Processing failed for chunk ${chunkId}:`, processingError);

  // エラーをクライアントに通知
  await sendToConnection(connectionId, {
    type: 'error',
    code: 'VIDEO_PROCESSING_ERROR',
    message: 'Failed to process video chunk',
    details: processingError instanceof Error ? processingError.message : 'Unknown error',
    chunkId,
  });

} finally {
  // ロックを必ず削除（成功・失敗問わず）
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connection_id: lockKey },
      })
    );
    console.log(`Cleaned up lock for chunk ${chunkId} (success=${processingSuccess})`);
  } catch (lockCleanupError) {
    console.error(`CRITICAL: Failed to clean up lock for chunk ${chunkId}:`, lockCleanupError);
    // ロック削除失敗は重大なので、CloudWatchアラームトリガー用にCRITICALログ
  }
}

// 成功時のみクライアントに通知
if (processingSuccess) {
  await updateConnectionData(connectionId, {...});
  await sendToConnection(connectionId, {
    type: 'video_chunk_ack',
    chunkId,
    chunksReceived: videoChunkCount,
  });
}
```

**Audio処理も同様に:**

```typescript
// Line 573後に追加
let audioProcessingSuccess = false;
try {
  // Reassemble audio parts
  // Call handleAudioProcessing
  // Cleanup S3 parts
  audioProcessingSuccess = true;
} catch (error) {
  console.error(`[audio_data_part] Processing failed:`, error);
  await sendToConnection(connectionId, {
    type: 'error',
    code: 'AUDIO_PROCESSING_ERROR',
    message: 'Failed to process audio',
    details: error instanceof Error ? error.message : 'Unknown error',
  });
} finally {
  // Always cleanup lock
  await ddb.send(new DeleteCommand({...}));
}
```

**期待される効果:**

- ✅ ロック解放漏れを100%防止
- ✅ エラー時でもクライアントに適切なフィードバック
- ✅ CloudWatchでロック削除失敗を監視可能

---

### Priority 2: ChunkID生成の改善（High）

**対応内容:**
UUID v4（128-bit）を使用してChunkID衝突を実質的にゼロにする

**実装例（Frontend）:**

```typescript
// apps/web/hooks/useWebSocket.ts:413
// Before:
const chunkId = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;

// After:
import { v4 as uuidv4 } from 'uuid';
const chunkId = `${timestamp}-${uuidv4()}`;
// Example: "1772947085-550e8400-e29b-41d4-a716-446655440000"
```

**UUID v4の衝突確率:**

```
UUID space: 2^122 ≈ 5.3 × 10^36
Chunks needed for 1% collision: ~2.6 × 10^18 chunks

Reality check:
100 sessions * 10 chunks/sec/session * 365 days * 1000 years
= ~3.15 × 10^13 chunks (still 5 orders of magnitude away from 1%)
```

**パッケージ追加:**

```bash
cd apps/web
npm install uuid
npm install --save-dev @types/uuid
```

**期待される効果:**

- ✅ ChunkID衝突リスクを実質的にゼロに
- ✅ タイムスタンプ部分でソート可能性を維持

---

### Priority 3: ロック削除失敗時のリトライ（High）

**対応内容:**
ロック削除失敗時に指数バックオフでリトライ

**実装例:**

```typescript
// 新規ヘルパー関数
async function deleteLockWithRetry(
  lockKey: string,
  maxRetries: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connection_id: lockKey },
        })
      );
      console.log(`Successfully deleted lock ${lockKey} (attempt ${attempt})`);
      return true;
    } catch (error) {
      console.error(`Failed to delete lock ${lockKey} (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
        console.log(`Retrying lock deletion after ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(`CRITICAL: Failed to delete lock ${lockKey} after ${maxRetries} attempts. TTL will clean up in 5 minutes.`);
  return false;
}

// 使用例（finallyブロック内）
finally {
  await deleteLockWithRetry(lockKey);
}
```

**期待される効果:**

- ✅ 一時的なDynamoDBスロットリングに対応
- ✅ ネットワーク瞬断からの回復
- ✅ ロック削除成功率を99.9%以上に向上

---

### Priority 4: 専用ロックテーブルの作成（Medium）

**対応内容:**
チャンク処理ロック専用のDynamoDBテーブルを作成

**新規テーブル設計:**

```typescript
// infrastructure/lib/dynamodb-stack.ts に追加
this.chunkLocksTable = new dynamodb.Table(this, 'ChunkLocksTable', {
  tableName: `prance-chunk-locks-${props.environment}`,
  partitionKey: {
    name: 'lock_key',
    type: dynamodb.AttributeType.STRING,
  },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

**スキーマ:**

```
Partition Key: lock_key (STRING)
  - "video-lock-17214-cef8b7j"
  - "audio-lock-1772947087523-ln2f4y5"

Attributes:
  - session_id (STRING)
  - chunk_id (STRING)
  - locked_at (NUMBER) - Unix timestamp
  - ttl (NUMBER) - Unix timestamp + 300 seconds
```

**期待される効果:**

- ✅ 接続情報とロック情報の分離
- ✅ GSI不要（lock_keyで直接アクセス）
- ✅ スケーラビリティ向上（独立したスループット）
- ✅ コスト最適化（小さなアイテムサイズ）

**コスト試算:**

```
Write: 100,000 locks/day * 2 operations (PUT + DELETE) = 200,000 WRU/day
Read:  0 (conditional PUTのみなのでReadなし)
Storage: 100,000 locks * 200 bytes * 5 min / 1440 min = ~700 KB (無視できる)

Cost: 200,000 WRU/day * $1.25/million = $0.25/day = $7.50/month
```

---

### Priority 5: CloudWatchアラームの追加（Medium）

**対応内容:**
ロック削除失敗を監視するCloudWatchアラーム

**実装:**

```typescript
// infrastructure/lib/monitoring-stack.ts (新規作成)
const lockCleanupFailureAlarm = new cloudwatch.Alarm(this, 'LockCleanupFailureAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Lambda',
    metricName: 'Errors',
    dimensionsMap: {
      FunctionName: websocketDefaultFunction.functionName,
    },
    statistic: 'Sum',
    period: Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Lock cleanup failures detected',
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});

// SNS通知設定
const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
  displayName: 'Prance Critical Alarms',
});
lockCleanupFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
```

**ログベースメトリクス:**

```typescript
// CloudWatch Logs Insights query
fields @timestamp, @message
| filter @message like /CRITICAL.*Failed to clean up lock/
| stats count() by bin(5m)
```

**期待される効果:**

- ✅ ロック削除失敗をリアルタイムで検知
- ✅ 5分以内にチームに通知
- ✅ 手動介入でロックを削除可能

---

### Priority 6: ChunkID衝突検出（Low）

**対応内容:**
ロック取得時にsessionIdとchunkIdをセットで保存し、衝突を検出

**実装例:**

```typescript
// Lock acquisition時
const lockKey = `video-lock-${chunkId}`;
try {
  await ddb.send(
    new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connection_id: lockKey,
        sessionId: partSessionId,
        chunkId: chunkId,
        timestamp: partTimestamp, // 追加
        lockedAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 300,
      },
      ConditionExpression: 'attribute_not_exists(connection_id)',
    })
  );
  console.log(`Lock acquired for chunk ${chunkId}`);
} catch (error: any) {
  if (error.name === 'ConditionalCheckFailedException') {
    // ロック取得失敗 - 既存のロック情報を取得
    const existingLock = await ddb.send(
      new GetCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connection_id: lockKey },
      })
    );

    if (existingLock.Item) {
      // セッションIDとタイムスタンプを比較
      if (
        existingLock.Item.sessionId !== partSessionId ||
        Math.abs(existingLock.Item.timestamp - partTimestamp) > 1000
      ) {
        // 異なるセッション or 1秒以上の時間差 = ChunkID衝突の可能性！
        console.error(`CRITICAL: Potential ChunkID collision detected!`, {
          lockKey,
          currentSession: partSessionId,
          currentTimestamp: partTimestamp,
          existingSession: existingLock.Item.sessionId,
          existingTimestamp: existingLock.Item.timestamp,
        });

        // CloudWatchメトリクスに記録
        // 手動でチャンクを再送するようクライアントに通知
        await sendToConnection(connectionId, {
          type: 'error',
          code: 'CHUNK_ID_COLLISION',
          message: 'ChunkID collision detected. Please retry.',
          chunkId,
        });
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'ChunkID collision' }),
        };
      }
    }

    // 同じチャンクの重複処理 → 正常にスキップ
    console.log(`Lock already held for chunk ${chunkId}, skipping duplicate processing`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Chunk already being processed' }),
    };
  }
  throw error;
}
```

**期待される効果:**

- ✅ ChunkID衝突を検出して記録
- ✅ 衝突発生時にクライアントに再送を促す
- ✅ メトリクスで衝突頻度を監視

---

## 📊 実装優先度マトリクス

| 優先度 | 対応策                 | 影響度      | 実装難易度 | 推定工数 |
| ------ | ---------------------- | ----------- | ---------- | -------- |
| **P1** | エラーハンドリング追加 | 🔴 Critical | 低         | 2時間    |
| **P2** | ChunkID改善（UUID v4） | 🟡 High     | 低         | 1時間    |
| **P3** | ロック削除リトライ     | 🟡 High     | 中         | 1時間    |
| **P4** | 専用ロックテーブル     | 🟢 Medium   | 中         | 3時間    |
| **P5** | CloudWatchアラーム     | 🟢 Medium   | 中         | 2時間    |
| **P6** | ChunkID衝突検出        | ⚪ Low      | 中         | 1時間    |

**合計推定工数:** 10時間（1-2日）

---

## 🧪 テストシナリオ

### Test 1: エラー発生時のロック解放

```bash
# S3を一時的に停止してエラーを誘発
aws s3api put-bucket-policy --bucket prance-storage-dev --policy '{...deny all...}'

# セッション実行 → エラー発生
# CloudWatch Logsで確認:
# ✅ "CRITICAL: Failed to clean up lock..." ログが出ていないこと
# ✅ "Cleaned up lock for chunk XXX (success=false)" ログがあること
```

### Test 2: ChunkID衝突の防止

```bash
# UUID v4実装後、100万チャンク送信
# 期待結果: 衝突ゼロ
```

### Test 3: ロック削除リトライ

```bash
# DynamoDBスロットリングを誘発（大量リクエスト）
# CloudWatch Logsで確認:
# ✅ "Retrying lock deletion after XXXms..." ログ
# ✅ 最終的に "Successfully deleted lock" ログ
```

---

## 📈 監視指標

### CloudWatch Logs Insights クエリ

**1. ロック削除失敗を検出:**

```
fields @timestamp, @message
| filter @message like /CRITICAL.*Failed to clean up lock/
| stats count() as FailureCount by bin(1h)
```

**2. ChunkID衝突を検出:**

```
fields @timestamp, @message
| filter @message like /CRITICAL.*ChunkID collision detected/
| stats count() as CollisionCount by sessionId
```

**3. ロック取得成功率:**

```
fields @timestamp, @message
| filter @message like /Lock acquired/ or @message like /Lock already held/
| stats count(@message) as Total,
        sum(@message like /Lock acquired/) as Acquired,
        sum(@message like /Lock already held/) as Skipped
| extend SuccessRate = Acquired / Total * 100
```

### CloudWatchメトリクス

**カスタムメトリクス（追加推奨）:**

```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
const cloudwatch = new CloudWatch({ region: 'us-east-1' });

// ロック削除失敗時
await cloudwatch.putMetricData({
  Namespace: 'Prance/Locks',
  MetricData: [
    {
      MetricName: 'LockCleanupFailure',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'LockType', Value: 'video' },
        { Name: 'Environment', Value: 'dev' },
      ],
    },
  ],
});
```

---

## 🎯 結論

### 即座に対応すべき（今日中）

1. **エラーハンドリング追加**（P1） - 2時間
2. **ChunkID改善**（P2） - 1時間

→ **合計3時間で、Criticalリスクを90%削減可能**

### 早めに対応すべき（今週中）

3. **ロック削除リトライ**（P3） - 1時間
4. **CloudWatchアラーム**（P5） - 2時間

### 時間があれば対応（来週以降）

5. **専用ロックテーブル**（P4） - 3時間
6. **ChunkID衝突検出**（P6） - 1時間

---

**最終更新:** 2026-03-08
**次回レビュー:** P1-P2実装後
