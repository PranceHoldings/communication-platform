# パフォーマンス最適化ガイド

**Phase:** 1.6 - 実用レベル化
**作成日:** 2026-03-20
**最終更新:** 2026-03-20

---

## 概要

Phase 1.6で実装されたパフォーマンス最適化機能の統合ガイドです。

## 実装された最適化

### 1. レート制限（Token Bucket Algorithm）

**目的:** WebSocket/APIリクエストの過負荷を防ぎ、システムの安定性を確保

**実装場所:**
- `infrastructure/lambda/shared/utils/rate-limiter.ts`
- `infrastructure/lib/dynamodb-stack.ts`

**アルゴリズム:** Token Bucket
- **maxTokens:** バケット内の最大トークン数（バースト容量）
- **refillRate:** 毎秒追加されるトークン数
- **tokensRequired:** 1リクエストあたりの消費トークン数

**使用方法（Lambda関数内）:**

```typescript
import { checkRateLimit, RateLimitProfiles } from '../../shared/utils/rate-limiter';

// Audio chunk rate limiting (20 chunks/sec, 100 chunks burst)
const config = RateLimitProfiles.audioChunk(sessionId);
const result = await checkRateLimit(config, 1);

if (!result.allowed) {
  return {
    statusCode: 429,
    body: JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: result.retryAfter,
      remainingTokens: result.remainingTokens,
    }),
  };
}

// Process audio chunk
// ...
```

**プリセットプロファイル:**

| プロファイル | maxTokens | refillRate | 用途 |
|-------------|-----------|------------|------|
| audioChunk | 100 | 20/sec | 音声チャンク送信 |
| videoChunk | 50 | 10/sec | 動画チャンク送信 |
| speechRecognition | 30 | 5/sec | 音声認識リクエスト |
| aiResponse | 10 | 1/sec | AI応答生成 |
| tts | 20 | 2/sec | TTS生成 |
| websocketMessage | 200 | 50/sec | WebSocketメッセージ |
| apiRequest | 100 | 10/sec | APIリクエスト |
| sessionCreate | 5 | 0.1/sec | セッション作成 |

**DynamoDBテーブル:**
- テーブル名: `prance-session-rate-limit-{environment}`
- Partition Key: `limitKey` (String) - 例: `audio:session-123`
- TTL: 24時間（非アクティブ時）

**管理機能:**

```typescript
// レート制限のリセット（管理者機能）
await resetRateLimit('audio:session-123');

// 現在の状態確認
const status = await getRateLimitStatus(config);
console.log(`Tokens: ${status.tokens}/${status.maxTokens}`);
```

---

### 2. 音声チャンクバッファリング最適化

**目的:** 音声チャンクの送信効率を向上し、ネットワーク負荷を削減

**実装場所:**
- `apps/web/hooks/useAudioBuffer.ts`

**機能:**
- **バッファリング:** 複数チャンクをバッファに蓄積
- **バッチ送信:** 一定数に達したらまとめて送信
- **自動フラッシュ:** タイマーで定期的にフラッシュ
- **即座フラッシュ:** バッファ満杯時は即座に送信

**使用方法:**

```typescript
import { useAudioBuffer } from '@/hooks/useAudioBuffer';
import { useWebSocket } from '@/hooks/useWebSocket';

function SessionPlayer() {
  const { sendAudioChunk } = useWebSocket({...});

  const audioBuffer = useAudioBuffer(sendAudioChunk, {
    maxBufferSize: 10,  // 最大10チャンクまでバッファ
    batchSize: 5,       // 5チャンクずつ送信
    flushInterval: 100, // 100ms毎に自動フラッシュ
  });

  // 音声チャンクを受信したら
  const handleAudioChunk = (data: ArrayBuffer, timestamp: number) => {
    audioBuffer.addChunk(data, timestamp);
  };

  // セッション終了時は強制フラッシュ
  const handleSessionEnd = () => {
    audioBuffer.flush();
    audioBuffer.clear();
  };

  // 統計情報の取得
  const stats = audioBuffer.getStats();
  console.log(`Buffered: ${stats.bufferedChunks}/${stats.maxBufferSize}`);

  return (
    <div>
      {/* Session Player UI */}
    </div>
  );
}
```

**パフォーマンス効果:**
- **ネットワークリクエスト削減:** 10チャンク個別送信 → 2回のバッチ送信（80%削減）
- **レイテンシ削減:** バッファリングによりスパイク削減
- **スループット向上:** バッチ送信による効率化

**設定値の調整ガイドライン:**

```typescript
// 低遅延優先（リアルタイム性重視）
{
  maxBufferSize: 5,
  batchSize: 2,
  flushInterval: 50, // 50ms
}

// 高スループット優先（効率重視）
{
  maxBufferSize: 20,
  batchSize: 10,
  flushInterval: 200, // 200ms
}

// バランス型（推奨）
{
  maxBufferSize: 10,
  batchSize: 5,
  flushInterval: 100, // 100ms
}
```

---

### 3. メモリリーク対策（WeakMap Cache）

**目的:** 長時間セッションでのメモリリークを防止し、安定性を向上

**実装場所:**
- `apps/web/hooks/useMemorySafeCache.ts`

**機能:**
- **WeakMap:** オブジェクトキーの自動ガベージコレクション
- **TTL:** 一定時間経過後の自動削除
- **LRU Eviction:** 最大サイズ超過時の古いエントリ削除
- **自動クリーンアップ:** 期限切れエントリの定期削除
- **統計情報:** ヒット率、サイズ、削除数の追跡

**使用方法:**

```typescript
import { useMemorySafeCache } from '@/hooks/useMemorySafeCache';

interface TranscriptData {
  text: string;
  timestamp: number;
  confidence: number;
}

function SessionPlayer() {
  const transcriptCache = useMemorySafeCache<object, TranscriptData>({
    maxSize: 100,          // 最大100エントリ
    ttl: 5 * 60 * 1000,    // 5分間有効
    onEvict: (key, value) => {
      console.log('Evicted:', key);
    },
  });

  // キャッシュに保存
  const cacheTranscript = (id: string, data: TranscriptData) => {
    transcriptCache.set(id, data);
  };

  // キャッシュから取得
  const getTranscript = (id: string): TranscriptData | undefined => {
    return transcriptCache.get(id);
  };

  // 存在確認
  const hasTranscript = (id: string): boolean => {
    return transcriptCache.has(id);
  };

  // 削除
  const deleteTranscript = (id: string): boolean => {
    return transcriptCache.delete(id);
  };

  // 全削除
  const clearCache = () => {
    transcriptCache.clear();
  };

  // 統計情報
  const stats = transcriptCache.getStats();
  console.log('Cache Stats:', stats);
  // {
  //   hits: 150,
  //   misses: 20,
  //   hitRate: "88.24%",
  //   evictions: 5,
  //   size: 95,
  //   totalSizeBytes: 12800,
  //   totalSizeKB: "12.50"
  // }

  return (
    <div>
      {/* Session Player UI */}
    </div>
  );
}
```

**ベストプラクティス:**

1. **オブジェクトキー vs 文字列キー:**
   ```typescript
   // ✅ 推奨: オブジェクトキー（自動GC）
   const messageObj = { id: 'msg-123' };
   cache.set(messageObj, data);

   // ⚠️ 注意: 文字列キー（手動管理）
   cache.set('msg-123', data); // LRU + TTLで管理
   ```

2. **適切なTTL設定:**
   ```typescript
   // 短期データ（1分）
   { ttl: 60 * 1000 }

   // 中期データ（5分）- 推奨
   { ttl: 5 * 60 * 1000 }

   // 長期データ（30分）
   { ttl: 30 * 60 * 1000 }
   ```

3. **maxSize設定:**
   ```typescript
   // 小規模キャッシュ（50エントリ）
   { maxSize: 50 }

   // 中規模キャッシュ（100エントリ）- 推奨
   { maxSize: 100 }

   // 大規模キャッシュ（500エントリ）
   { maxSize: 500 }
   ```

4. **メモリ監視:**
   ```typescript
   useEffect(() => {
    const intervalId = setInterval(() => {
      const stats = cache.getStats();
      console.log('[Cache] Stats:', stats);

      // Alert if cache is growing too large
      if (parseInt(stats.totalSizeKB) > 1024) { // 1MB
        console.warn('[Cache] Memory usage exceeds 1MB');
      }
    }, 60000); // Every 1 minute

    return () => clearInterval(intervalId);
  }, []);
  ```

---

## パフォーマンステスト

### 1. レート制限テスト

```typescript
// tests/unit/rate-limiter.test.ts
describe('Rate Limiter', () => {
  it('should allow requests within limit', async () => {
    const config = {
      key: 'test:session-123',
      maxTokens: 10,
      refillRate: 1, // 1 token/sec
    };

    // First request should be allowed
    const result1 = await checkRateLimit(config, 1);
    expect(result1.allowed).toBe(true);
    expect(result1.remainingTokens).toBe(9);
  });

  it('should block requests exceeding limit', async () => {
    const config = {
      key: 'test:session-456',
      maxTokens: 5,
      refillRate: 0.1, // Very slow refill
    };

    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(config, 1);
    }

    // Next request should be blocked
    const result = await checkRateLimit(config, 1);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

### 2. バッファリングテスト

```typescript
// tests/unit/audio-buffer.test.ts
describe('Audio Buffer', () => {
  it('should buffer chunks and send in batches', () => {
    const sendChunk = jest.fn();
    const buffer = useAudioBuffer(sendChunk, {
      maxBufferSize: 10,
      batchSize: 5,
      flushInterval: 100,
    });

    // Add 5 chunks
    for (let i = 0; i < 5; i++) {
      buffer.addChunk(new ArrayBuffer(100), Date.now());
    }

    // Should not send yet (buffer not full)
    expect(sendChunk).not.toHaveBeenCalled();

    // Add 5 more chunks (total 10, buffer full)
    for (let i = 0; i < 5; i++) {
      buffer.addChunk(new ArrayBuffer(100), Date.now());
    }

    // Should send 5 chunks
    expect(sendChunk).toHaveBeenCalledTimes(5);
  });
});
```

### 3. キャッシュテスト

```typescript
// tests/unit/memory-safe-cache.test.ts
describe('Memory Safe Cache', () => {
  it('should evict LRU entries when full', () => {
    const onEvict = jest.fn();
    const cache = useMemorySafeCache({
      maxSize: 3,
      onEvict,
    });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Cache is full, adding one more should evict oldest
    cache.set('key4', 'value4');

    expect(onEvict).toHaveBeenCalledWith('key1', 'value1');
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key4')).toBe(true);
  });

  it('should auto-cleanup expired entries', async () => {
    const cache = useMemorySafeCache({
      ttl: 100, // 100ms TTL
    });

    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be expired
    expect(cache.has('key1')).toBe(false);
  });
});
```

---

## パフォーマンスメトリクス

### 目標値

| メトリクス | 目標値 | 測定方法 |
|-----------|--------|---------|
| 音声チャンク送信レイテンシ | <100ms平均 | CloudWatch Metrics |
| WebSocketメッセージ処理時間 | <50ms P95 | CloudWatch Logs |
| メモリ使用量（フロントエンド） | <100MB/session | Chrome DevTools |
| DynamoDBレート制限読み取り | <10ms | CloudWatch Metrics |

### 監視

```bash
# CloudWatch Metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=prance-websocket-default-dev \
  --statistics Average,Maximum \
  --start-time 2026-03-20T00:00:00Z \
  --end-time 2026-03-20T23:59:59Z \
  --period 300

# DynamoDB Rate Limit Table メトリクス
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=prance-session-rate-limit-dev \
  --statistics Sum \
  --start-time 2026-03-20T00:00:00Z \
  --end-time 2026-03-20T23:59:59Z \
  --period 60
```

---

## トラブルシューティング

### レート制限関連

**問題:** Rate limit exceeded エラーが頻発

```typescript
// 解決策: refillRateを増やす
const config = RateLimitProfiles.audioChunk(sessionId);
config.refillRate = 30; // 20 → 30 に増加
```

**問題:** DynamoDB スロットリング

```bash
# 解決策: オンデマンドモードに変更（CDK設定済み）
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
```

### バッファリング関連

**問題:** 音声チャンクの遅延が大きい

```typescript
// 解決策: flushIntervalを短くする
const audioBuffer = useAudioBuffer(sendChunk, {
  flushInterval: 50, // 100ms → 50ms
});
```

**問題:** バッファがすぐに満杯になる

```typescript
// 解決策: maxBufferSizeを増やす、またはbatchSizeを増やす
const audioBuffer = useAudioBuffer(sendChunk, {
  maxBufferSize: 20, // 10 → 20
  batchSize: 10,     // 5 → 10
});
```

### キャッシュ関連

**問題:** メモリ使用量が増え続ける

```typescript
// 解決策1: TTLを短くする
const cache = useMemorySafeCache({
  ttl: 2 * 60 * 1000, // 5分 → 2分
});

// 解決策2: maxSizeを減らす
const cache = useMemorySafeCache({
  maxSize: 50, // 100 → 50
});

// 解決策3: 定期的にクリア
useEffect(() => {
  const intervalId = setInterval(() => {
    cache.clear();
  }, 10 * 60 * 1000); // 10分毎

  return () => clearInterval(intervalId);
}, []);
```

---

## 音声レイテンシ最適化（Day 52 - 2026-04-24）

### 背景

LiveKit水準のリアルタイム音声体験を目指して、4つのレイテンシ要因を特定し解消した。

### 改善1: TTS音声チャンクのストリーミング再生

**実装前:** Lambda から `audio_response` URL（CloudFront）が届いてから `<audio>` 要素で再生開始  
→ 全TTS生成完了を待つため、長い文章ほど開始が遅延

**実装後:** Lambda の `audio_chunk` メッセージ（base64 MP3）を Web Audio API で即座にデコード・キュー再生  
→ 最初のチャンクが届いた瞬間（数百ms以内）に音声開始

**実装ファイル:**
- `apps/web/hooks/useAudioPlayer.ts` — `playChunk()` + AudioBufferSourceNode スケジューリング
- `apps/web/components/session-player/index.tsx` — `handleTTSAudioChunk()` 実装、`audio_response` スキップロジック

```typescript
// Web Audio API キュースケジューリング（useAudioPlayer内）
const bufferSource = audioContext.createBufferSource();
bufferSource.buffer = audioBuffer;
bufferSource.start(nextStartTimeRef.current);
nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime) + audioBuffer.duration;
```

### 改善2: ElevenLabs WebSocket真ストリーミング

**実装前:** WebSocketを開いてもchunkを全収集後に返していた（偽ストリーミング）

**実装後:** queue+Promiseパターンで到着順にyieldする真のasync generator

**実装ファイル:** `infrastructure/lambda/shared/audio/tts-elevenlabs.ts` — `generateSpeechWebSocketStream()`

**パターン:**
```typescript
const queue: QueueEntry[] = [];
let waitResolve: (() => void) | null = null;
ws.on('message', data => { enqueue({type:'chunk', value: parsed}); });
ws.on('close', () => { enqueue({type:'done'}); });
return (async function*() {
  while(true) {
    if(queue.length === 0) await new Promise<void>(r => { waitResolve = r; });
    const entry = queue.shift()!;
    if(entry.type === 'done') break;
    if(entry.type === 'error') throw entry.error;
    yield entry.value;
  }
})();
```

### 改善3: AI→TTSセンテンスレベルパイプライン

**実装前:** AI全文生成完了 → TTS開始（逐次）

**実装後:** AIストリームをセンテンス区切りで監視し、区切りに達したら即TTS開始（並列）

**効果:** Multi-sentenceレスポンスで最初の音声開始まで **約1-3秒削減**

**実装ファイル:** `infrastructure/lambda/websocket/default/audio-processor.ts`

```typescript
const SENTENCE_BOUNDARY = /[.!?。！？\n]/;
const MIN_SENTENCE_CHARS = 15;

for await (const chunk of aiStream) {
  sentenceBuffer += chunk;
  if (sentenceBuffer.length >= MIN_SENTENCE_CHARS && SENTENCE_BOUNDARY.test(sentenceBuffer)) {
    const toFlush = sentenceBuffer;
    sentenceBuffer = '';
    await flushSentence(toFlush, false); // TTS starts here, AI still generating
  }
}
```

### 改善4: バージイン（AI話し中の割り込み）

**実装前:** AI音声再生中は割り込み不可

**実装後:** ユーザーの確認済み発話（800ms）でAI音声即座停止 → 録音再開

**実装ファイル:**
- `apps/web/hooks/useAudioRecorder.ts` — `onBargeIn` コールバック追加
- `apps/web/components/session-player/index.tsx` — `handleBargeIn()`: Web Audio + HTMLAudioElement両停止

**遅延防止:** `bargedInRef` で barge-in後に遅延到着する `audio_response` URLを抑制

### レイテンシ比較表

| フロー | Before（Day 52前） | After（Day 52後） |
|--------|-------------------|------------------|
| 発話→AI応答開始 | 200-400ms | 200-400ms（変化なし） |
| AI応答→TTS開始 | AI全文完了まで待機 | センテンス区切りで即開始 |
| 最初の音声出力 | AI完了 + TTS完了 | 最初のTTSチャンク到着（並列） |
| Multi-sentence total | 例: 3秒 | 例: ~1-1.5秒（~1-3s削減） |
| バージイン | 不可 | ~800ms後即座に対応 |

### 残レイテンシ要因（未解決）

**ストリーミングSTT:** 現在はバッファ蓄積後の一括認識。AWS Transcribe Streamingへの移行でさらに削減可能。詳細は `KNOWN_ISSUES.md` Issue #7 参照。

---

## 次のステップ

1. **Staging環境デプロイ:** 音声改善の実環境検証
2. **ストリーミングSTT:** AWS Transcribe Streamingへの移行検討
3. **CloudWatch Dashboard:** パフォーマンスメトリクスの可視化
4. **ロードテスト:** 高負荷時の動作確認

---

**作成日:** 2026-03-20
**最終更新:** 2026-04-24 (Day 52 - 音声レイテンシ最適化)
**Phase:** 1.6 → 商用品質改善中
