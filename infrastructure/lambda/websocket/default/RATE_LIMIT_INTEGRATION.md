# WebSocket Lambda - Rate Limit Integration Example

**Phase 1.6:** パフォーマンス最適化

## 統合手順

### 1. インポート追加

```typescript
// index.ts の先頭に追加
import { checkRateLimit, RateLimitProfiles } from '../../shared/utils/rate-limiter';
```

### 2. audio_chunk_realtime ハンドラーに統合

**場所:** `index.ts` 行413付近

**変更前:**
```typescript
case 'audio_chunk_realtime':
  // Handle real-time audio chunks (Phase 1.5 - streaming STT)
  const rtAudioData = message.data as string;
  const rtTimestamp = message.timestamp as number;
  const rtSequenceNumber = message.sequenceNumber as number;
  const rtContentType = message.contentType as string;
  const rtSessionId = connectionData?.sessionId || 'unknown';

  console.log('[audio_chunk_realtime] Received real-time audio chunk:', {
    sequenceNumber: rtSequenceNumber,
    timestamp: rtTimestamp,
    dataSize: rtAudioData ? rtAudioData.length : 0,
    contentType: rtContentType,
    sessionId: rtSessionId,
  });

  try {
    // Save this chunk to S3 for later processing (on speech_end)
    // ...
```

**変更後:**
```typescript
case 'audio_chunk_realtime':
  // Handle real-time audio chunks (Phase 1.5 - streaming STT)
  const rtAudioData = message.data as string;
  const rtTimestamp = message.timestamp as number;
  const rtSequenceNumber = message.sequenceNumber as number;
  const rtContentType = message.contentType as string;
  const rtSessionId = connectionData?.sessionId || 'unknown';

  console.log('[audio_chunk_realtime] Received real-time audio chunk:', {
    sequenceNumber: rtSequenceNumber,
    timestamp: rtTimestamp,
    dataSize: rtAudioData ? rtAudioData.length : 0,
    contentType: rtContentType,
    sessionId: rtSessionId,
  });

  // Phase 1.6: Rate limiting (20 chunks/sec, 100 chunks burst)
  const audioRateLimit = RateLimitProfiles.audioChunk(rtSessionId);
  const rateLimitResult = await checkRateLimit(audioRateLimit, 1);

  if (!rateLimitResult.allowed) {
    console.warn('[audio_chunk_realtime] Rate limit exceeded:', {
      sessionId: rtSessionId,
      sequenceNumber: rtSequenceNumber,
      remainingTokens: rateLimitResult.remainingTokens,
      retryAfter: rateLimitResult.retryAfter,
    });

    // Send rate limit error to client
    await sendToConnection(connectionId, {
      type: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Audio chunk rate limit exceeded',
      details: {
        retryAfter: rateLimitResult.retryAfter,
        remainingTokens: rateLimitResult.remainingTokens,
      },
    });
    break;
  }

  console.log('[audio_chunk_realtime] Rate limit check passed:', {
    remainingTokens: rateLimitResult.remainingTokens,
  });

  try {
    // Save this chunk to S3 for later processing (on speech_end)
    // ...
```

### 3. speech_end ハンドラーに統合

**場所:** `index.ts` 行471付近

**追加コード:**
```typescript
case 'speech_end':
  // User stopped speaking - process accumulated real-time chunks (Phase 1.5)
  const speechEndSessionId = connectionData?.sessionId || 'unknown';
  const lastSequenceNumber = connectionData?.realtimeAudioSequenceNumber || -1;
  const totalRealtimeChunks = connectionData?.realtimeAudioChunkCount || 0;

  console.log('[speech_end] Speech ended - processing accumulated chunks:', {
    sessionId: speechEndSessionId,
    lastSequenceNumber,
    totalChunks: totalRealtimeChunks,
  });

  // Phase 1.6: Rate limiting for speech recognition (5 requests/sec)
  const speechRateLimit = RateLimitProfiles.speechRecognition(speechEndSessionId);
  const speechRateLimitResult = await checkRateLimit(speechRateLimit, 1);

  if (!speechRateLimitResult.allowed) {
    console.warn('[speech_end] Rate limit exceeded:', {
      sessionId: speechEndSessionId,
      remainingTokens: speechRateLimitResult.remainingTokens,
      retryAfter: speechRateLimitResult.retryAfter,
    });

    await sendToConnection(connectionId, {
      type: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Speech recognition rate limit exceeded',
      details: {
        retryAfter: speechRateLimitResult.retryAfter,
        remainingTokens: speechRateLimitResult.remainingTokens,
      },
    });
    break;
  }

  // Check if audio processing is already in progress (prevent duplicate processing)
  if (connectionData?.realtimeAudioProcessing) {
    // ...
```

### 4. AIレスポンス生成に統合

**場所:** AI応答生成処理の直前

```typescript
// Phase 1.6: Rate limiting for AI response generation (1 request/sec)
const aiRateLimit = RateLimitProfiles.aiResponse(rtSessionId);
const aiRateLimitResult = await checkRateLimit(aiRateLimit, 1);

if (!aiRateLimitResult.allowed) {
  console.warn('[AI] Rate limit exceeded:', {
    sessionId: rtSessionId,
    remainingTokens: aiRateLimitResult.remainingTokens,
    retryAfter: aiRateLimitResult.retryAfter,
  });

  await sendToConnection(connectionId, {
    type: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'AI response rate limit exceeded',
    details: {
      retryAfter: aiRateLimitResult.retryAfter,
    },
  });
  return;
}

// Generate AI response
const aiResponse = await generateAIResponse(userTranscript);
```

### 5. TTS生成に統合

**場所:** TTS生成処理の直前

```typescript
// Phase 1.6: Rate limiting for TTS generation (2 requests/sec)
const ttsRateLimit = RateLimitProfiles.tts(rtSessionId);
const ttsRateLimitResult = await checkRateLimit(ttsRateLimit, 1);

if (!ttsRateLimitResult.allowed) {
  console.warn('[TTS] Rate limit exceeded:', {
    sessionId: rtSessionId,
    remainingTokens: ttsRateLimitResult.remainingTokens,
    retryAfter: ttsRateLimitResult.retryAfter,
  });

  await sendToConnection(connectionId, {
    type: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'TTS rate limit exceeded',
    details: {
      retryAfter: ttsRateLimitResult.retryAfter,
    },
  });
  return;
}

// Generate TTS audio
const ttsAudio = await generateTTS(aiResponse);
```

## テスト

### 1. ユニットテスト

```typescript
// tests/unit/websocket-rate-limit.test.ts
import { handler } from '../index';
import { checkRateLimit } from '../../../shared/utils/rate-limiter';

jest.mock('../../../shared/utils/rate-limiter');

describe('WebSocket Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow audio chunk within rate limit', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remainingTokens: 99,
    });

    const event = {
      requestContext: { connectionId: 'conn-123' },
      body: JSON.stringify({
        action: 'default',
        type: 'audio_chunk_realtime',
        data: 'base64audiodata',
        timestamp: Date.now(),
        sequenceNumber: 0,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('audio:'),
        maxTokens: 100,
        refillRate: 20,
      }),
      1
    );
  });

  it('should block audio chunk exceeding rate limit', async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: false,
      remainingTokens: 0,
      retryAfter: 5,
    });

    const event = {
      requestContext: { connectionId: 'conn-123' },
      body: JSON.stringify({
        action: 'default',
        type: 'audio_chunk_realtime',
        data: 'base64audiodata',
        timestamp: Date.now(),
        sequenceNumber: 0,
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    // Should send error message to client
    // Verify sendToConnection was called with RATE_LIMIT_EXCEEDED
  });
});
```

### 2. 統合テスト

```bash
# 1. DynamoDB Stackデプロイ
cd infrastructure
npm run cdk -- deploy Prance-dev-DynamoDB --require-approval never

# 2. 環境変数確認
aws dynamodb describe-table --table-name prance-session-rate-limit-dev

# 3. Lambda関数デプロイ
npm run deploy:lambda

# 4. 環境変数確認（Lambda）
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables.DYNAMODB_RATE_LIMIT_TABLE'

# 期待: "prance-session-rate-limit-dev"
```

### 3. 負荷テスト

```typescript
// tests/load/audio-chunk-rate-limit.test.ts
import WebSocket from 'ws';

describe('Audio Chunk Rate Limit Load Test', () => {
  it('should enforce rate limit under high load', async () => {
    const ws = new WebSocket('wss://...');

    await new Promise(resolve => ws.on('open', resolve));

    // Send 150 chunks rapidly (exceeds 100 burst capacity)
    const results = [];
    for (let i = 0; i < 150; i++) {
      ws.send(JSON.stringify({
        action: 'default',
        type: 'audio_chunk_realtime',
        data: btoa('audio data'),
        timestamp: Date.now(),
        sequenceNumber: i,
      }));

      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms interval = 100 chunks/sec
    }

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should receive rate limit errors after first 100 chunks
    const errors = results.filter(r => r.code === 'RATE_LIMIT_EXCEEDED');
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

## モニタリング

### CloudWatch Metrics

```bash
# DynamoDB Rate Limit Table メトリクス
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=prance-session-rate-limit-dev \
  --statistics Sum \
  --start-time 2026-03-20T00:00:00Z \
  --end-time 2026-03-20T23:59:59Z \
  --period 60

# Lambda Duration（レート制限チェックのオーバーヘッド）
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=prance-websocket-default-dev \
  --statistics Average,Maximum \
  --start-time 2026-03-20T00:00:00Z \
  --end-time 2026-03-20T23:59:59Z \
  --period 300
```

### CloudWatch Logs Insights

```sql
-- Rate limit violations
fields @timestamp, @message
| filter @message like /Rate limit exceeded/
| stats count() by bin(5m)

-- Rate limit overhead
fields @timestamp, @message
| filter @message like /Rate limit check passed/
| parse @message "remainingTokens: *" as remainingTokens
| stats avg(remainingTokens) by bin(5m)
```

## パフォーマンス目標

| メトリクス | 目標値 | 現在値 |
|-----------|--------|--------|
| レート制限チェックレイテンシ | <10ms | TBD |
| DynamoDB読み取りスループット | <100 RCU/sec | TBD |
| レート制限エラー率 | <1% | TBD |
| 音声チャンク処理成功率 | >99% | TBD |

---

**作成日:** 2026-03-20
**Phase:** 1.6 - パフォーマンス最適化
**次回更新:** 統合テスト完了後
