# Phase 1.6 Performance Test Plan

## Audio Buffer Performance Metrics

### Theoretical Performance (Based on Configuration)

**Before Audio Buffer Integration:**
- Recording chunks: 100ms intervals (MediaRecorder timeslice)
- Transmission: 1 chunk = 1 WebSocket send
- Network requests: 10 requests/second (100% baseline)

**After Audio Buffer Integration:**
```typescript
useAudioBuffer(sendAudioChunkToWebSocket, {
  maxBufferSize: 10,  // Buffer up to 10 chunks
  batchSize: 5,       // Send 5 chunks at a time
  flushInterval: 100, // Flush every 100ms
});
```

**Expected Results:**
- Chunks batched: 5 chunks per send
- Network requests: 2 requests/second
- **Reduction: 80%** (10 req/s → 2 req/s)

### Actual Performance Measurement

#### Method 1: Browser Console (Manual Test)

1. Start a session in browser
2. Open DevTools Console
3. Monitor audio buffer stats:
   ```javascript
   // SessionPlayer logs buffer stats automatically
   // Look for: "[SessionPlayer] Audio chunk added to buffer:"
   // Example output:
   {
     sequenceNumber: 42,
     size: 4096,
     bufferStats: {
       chunksBuffered: 5,
       chunksSent: 40,
       batchesSent: 8,
       lastFlushTime: 1710893456789
     }
   }
   ```

4. Calculate reduction:
   ```
   Reduction = (chunksSent - batchesSent) / chunksSent
   Example: (40 - 8) / 40 = 80%
   ```

#### Method 2: Network Tab (Manual Test)

1. Start a session in browser
2. Open DevTools Network tab
3. Filter for WebSocket frames
4. Count "audio_chunk_realtime" messages over 10 seconds
5. Compare:
   - Before: ~100 messages/10s
   - After: ~20 messages/10s
   - Reduction: 80%

#### Method 3: CloudWatch Metrics (Production)

**Prerequisites:**
- Successful WebSocket session completion
- Wait 5-15 minutes for CloudWatch data propagation

**Query:**
```bash
# Get WebSocket Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=prance-websocket-default-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum \
  --region us-east-1
```

**Expected Results:**
- Before: ~600 invocations/10-minute session
- After: ~120 invocations/10-minute session
- Reduction: 80%

### Current Status (2026-03-20)

❌ **E2E Environment Limitation:**
- WebSocket connection fails with 500 error
- Cannot measure performance in automated tests
- Requires manual testing in working environment

✅ **Implementation Complete:**
- Audio buffer integrated in SessionPlayer
- Rate limit error handling implemented
- Translation keys added (en/ja)

### Next Steps

1. **Manual Test** in local/dev environment:
   - Start Next.js dev server: `npm run dev`
   - Start a real session with microphone
   - Monitor browser console for buffer stats
   - Verify 80% reduction in Network tab

2. **Production Test** after deployment:
   - Deploy to staging/production
   - Run real user session
   - Check CloudWatch metrics after 15 minutes
   - Verify Lambda invocation reduction

3. **Document Results:**
   - Record actual reduction rate
   - Update Phase 1.6 completion report
   - Add to project metrics dashboard

## Performance Optimization Checklist

- [x] Audio buffer implementation
- [x] Buffer configuration (10/5/100ms)
- [x] Flush on session end (2 locations)
- [x] Rate limit error handling
- [ ] Manual test verification
- [ ] CloudWatch metrics verification
- [ ] Performance benchmark documentation
