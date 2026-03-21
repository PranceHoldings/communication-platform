# Phase 5.4: Runtime Verification Testing Plan

**Date:** 2026-03-21 11:35 UTC (Day 30)
**Status:** 📋 Testing Plan

---

## 🎯 Objective

Verify that all migrated runtime configurations (Batch 1-5) work correctly with the 3-tier caching system:
- Lambda Memory Cache (TTL: 10s)
- ElastiCache Serverless (TTL: 60s)
- Aurora RDS (persistent storage)

---

## 🧪 Test Cases

### Test 1: BCRYPT_SALT_ROUNDS ✅

**Files:** `shared/auth/password.ts`, `shared/utils/pinHash.ts`
**Functions:** `prance-guest-auth-dev`, `prance-guest-sessions-create-dev`, `prance-guest-sessions-batch-dev`

**Test Steps:**

```bash
# 1. Create guest session with PIN (current salt rounds)
curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest-sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test-bcrypt-001",
    "pin": "1234",
    "expiresAt": "2026-03-22T00:00:00Z"
  }'

# Expected: Hash starts with $2a$10$ (10 rounds)
# Example: $2a$10$abcdefghijklmnopqrstuvwxyz...

# 2. Update BCRYPT_SALT_ROUNDS in database
aws rds-data execute-statement \
  --resource-arn "arn:aws:rds:us-east-1:010438500933:cluster:prance-dev-cluster" \
  --secret-arn "arn:aws:secretsmanager:us-east-1:010438500933:secret:..." \
  --database "prance" \
  --sql "UPDATE runtime_configs SET value = '12' WHERE key = 'BCRYPT_SALT_ROUNDS'"

# 3. Wait for cache expiry (60 seconds for ElastiCache)
sleep 65

# 4. Create another guest session
curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest-sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test-bcrypt-002",
    "pin": "1234",
    "expiresAt": "2026-03-22T00:00:00Z"
  }'

# Expected: Hash starts with $2a$12$ (12 rounds - NEW VALUE)
# Verify: Different hash for same PIN due to different salt rounds
```

**Success Criteria:**
- ✅ First hash uses 10 rounds ($2a$10$...)
- ✅ Second hash uses 12 rounds ($2a$12$...)
- ✅ Both PINs authenticate correctly
- ✅ No errors in CloudWatch Logs

---

### Test 2: Score Calculation Weights ⏭️

**File:** `shared/analysis/score-calculator.ts`
**Function:** `prance-sessions-analysis-dev`

**Test Steps:**

```bash
# 1. Run session analysis with current weights
# (Default: emotion=0.25, audio=0.25, content=0.25, delivery=0.25)

# 2. Update weights in database
UPDATE runtime_configs SET value = '0.4' WHERE key = 'EMOTION_SCORE_WEIGHT';
UPDATE runtime_configs SET value = '0.2' WHERE key = 'AUDIO_SCORE_WEIGHT';
UPDATE runtime_configs SET value = '0.2' WHERE key = 'CONTENT_SCORE_WEIGHT';
UPDATE runtime_configs SET value = '0.2' WHERE key = 'DELIVERY_SCORE_WEIGHT';

# 3. Wait for cache expiry
sleep 65

# 4. Trigger analysis on new session
aws lambda invoke \
  --function-name prance-sessions-trigger-analysis-dev \
  --payload '{"sessionId":"<session-id>"}' \
  /tmp/analysis-result.json

# 5. Check CloudWatch Logs for weight values
aws logs tail /aws/lambda/prance-sessions-analysis-dev --since 5m --filter-pattern "weights"
```

**Success Criteria:**
- ✅ Logs show new weights (0.4, 0.2, 0.2, 0.2)
- ✅ Overall score calculation uses new weights
- ✅ Weights sum to 1.0

---

### Test 3: Rate Limiter Configs ⏭️

**File:** `shared/utils/rateLimiter.ts`
**Functions:** Multiple (WebSocket, API endpoints)

**Test Steps:**

```bash
# 1. Check current rate limit
# (Default: RATE_LIMIT_REQUESTS_PER_MINUTE = 60)

# 2. Update rate limit in database
UPDATE runtime_configs SET value = '10' WHERE key = 'RATE_LIMIT_REQUESTS_PER_MINUTE';

# 3. Wait for cache expiry
sleep 65

# 4. Send multiple requests
for i in {1..15}; do
  curl -X GET "https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/scenarios" \
    -H "Authorization: Bearer $TOKEN"
  echo "Request $i"
done

# Expected: First 10 requests succeed, 11-15 return 429 Too Many Requests
```

**Success Criteria:**
- ✅ Rate limit enforced at new value (10 requests/minute)
- ✅ 429 status code returned after limit exceeded
- ✅ Retry-After header present

---

### Test 4: Audio/AI Configs (TTS, Claude) ⏭️

**Files:** `shared/audio/tts-elevenlabs.ts`, `shared/ai/bedrock.ts`
**Functions:** `prance-websocket-default-v2-dev`

**Test Steps:**

```bash
# Test TTS_STABILITY
# 1. Update TTS_STABILITY in database
UPDATE runtime_configs SET value = '0.8' WHERE key = 'TTS_STABILITY';
UPDATE runtime_configs SET value = '0.9' WHERE key = 'TTS_SIMILARITY_BOOST';

# 2. Wait for cache expiry
sleep 65

# 3. Generate speech via WebSocket
# (Connect to WebSocket and send audio chunk)
# Expected: TTS audio has higher stability (less variation)

# Test CLAUDE_TEMPERATURE
# 1. Update CLAUDE_TEMPERATURE in database
UPDATE runtime_configs SET value = '0.3' WHERE key = 'CLAUDE_TEMPERATURE';

# 2. Wait for cache expiry
sleep 65

# 3. Generate AI response via WebSocket
# Expected: More deterministic AI responses (less creative)
```

**Success Criteria:**
- ✅ TTS uses new stability/similarity boost values
- ✅ Claude uses new temperature value
- ✅ CloudWatch Logs show updated config values

---

### Test 5: Chunk Processing Batch Sizes ⏭️

**File:** `websocket/default/chunk-utils.ts`
**Function:** `prance-websocket-default-v2-dev`

**Test Steps:**

```bash
# 1. Update batch sizes in database
UPDATE runtime_configs SET value = '25' WHERE key = 'VIDEO_CHUNK_BATCH_SIZE';
UPDATE runtime_configs SET value = '5' WHERE key = 'ANALYSIS_BATCH_SIZE';

# 2. Wait for cache expiry
sleep 65

# 3. Upload video chunks via WebSocket
# (Send 100 video chunks)

# 4. Check CloudWatch Logs for batch processing
aws logs tail /aws/lambda/prance-websocket-default-v2-dev --since 10m --filter-pattern "BATCH_SIZE"
```

**Success Criteria:**
- ✅ Video chunks processed in batches of 25 (not 50)
- ✅ Analysis chunks processed in batches of 5 (not 10)
- ✅ Logs show updated batch sizes

---

### Test 6: DB Query MAX_RESULTS ⏭️

**File:** `db-query/index.ts`
**Function:** `prance-db-query-dev`

**Test Steps:**

```bash
# 1. Update MAX_RESULTS in database
UPDATE runtime_configs SET value = '500' WHERE key = 'MAX_RESULTS';

# 2. Wait for cache expiry
sleep 65

# 3. Execute large query
aws lambda invoke \
  --function-name prance-db-query-dev \
  --payload '{
    "sql": "SELECT * FROM sessions ORDER BY createdAt DESC LIMIT 2000",
    "readOnly": true
  }' \
  /tmp/query-result.json

# 4. Check result count
cat /tmp/query-result.json | jq '.rowCount, .data | length'

# Expected: rowCount = 2000, data.length = 500 (truncated to MAX_RESULTS)
```

**Success Criteria:**
- ✅ Results truncated to 500 rows (not 1000)
- ✅ `truncated` flag is true
- ✅ CloudWatch Logs show MAX_RESULTS = 500

---

## 🔧 Test Environment Setup

### Prerequisites

1. **Valid JWT Token:**
```bash
export TOKEN="eyJhbGc..."  # Get from login endpoint
```

2. **Database Access:**
```bash
# Aurora RDS Data API access
aws rds-data execute-statement --help
```

3. **CloudWatch Logs Access:**
```bash
# View Lambda function logs
aws logs tail /aws/lambda/prance-* --follow
```

### Test Execution Order

1. ✅ Test 1 (BCRYPT) - Easiest to verify, quick test
2. ⏭️ Test 6 (MAX_RESULTS) - Simple query, easy verification
3. ⏭️ Test 2 (Score Weights) - Requires session completion
4. ⏭️ Test 3 (Rate Limiter) - Quick test, easy verification
5. ⏭️ Test 4 (TTS/AI) - Requires WebSocket connection
6. ⏭️ Test 5 (Chunk Processing) - Requires WebSocket connection + video upload

---

## ⚠️ Important Notes

### Cache TTL Considerations

- **Lambda Memory Cache:** 10 seconds
- **ElastiCache:** 60 seconds
- **Test Wait Time:** 65 seconds minimum (to ensure cache expiry)

### Rollback Plan

If any test fails, rollback to original values:

```sql
-- Rollback commands
UPDATE runtime_configs SET value = '10' WHERE key = 'BCRYPT_SALT_ROUNDS';
UPDATE runtime_configs SET value = '0.25' WHERE key = 'EMOTION_SCORE_WEIGHT';
UPDATE runtime_configs SET value = '0.25' WHERE key = 'AUDIO_SCORE_WEIGHT';
UPDATE runtime_configs SET value = '0.25' WHERE key = 'CONTENT_SCORE_WEIGHT';
UPDATE runtime_configs SET value = '0.25' WHERE key = 'DELIVERY_SCORE_WEIGHT';
UPDATE runtime_configs SET value = '60' WHERE key = 'RATE_LIMIT_REQUESTS_PER_MINUTE';
UPDATE runtime_configs SET value = '0.5' WHERE key = 'TTS_STABILITY';
UPDATE runtime_configs SET value = '0.75' WHERE key = 'TTS_SIMILARITY_BOOST';
UPDATE runtime_configs SET value = '0.7' WHERE key = 'CLAUDE_TEMPERATURE';
UPDATE runtime_configs SET value = '50' WHERE key = 'VIDEO_CHUNK_BATCH_SIZE';
UPDATE runtime_configs SET value = '10' WHERE key = 'ANALYSIS_BATCH_SIZE';
UPDATE runtime_configs SET value = '1000' WHERE key = 'MAX_RESULTS';
```

---

## 📊 Expected Results

### Success Metrics

- ✅ All 6 tests pass
- ✅ Zero runtime errors
- ✅ Cache hit rate > 99% (after first call)
- ✅ Configuration updates take effect within 65 seconds
- ✅ Environment variable fallback works (if DB unavailable)

### Failure Scenarios

If any test fails:
1. Check CloudWatch Logs for errors
2. Verify database connection
3. Verify ElastiCache connection
4. Check cache TTL values
5. Verify environment variable fallback

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅

1. Document test results
2. Proceed to Batch 6 (stt-azure.ts)
3. Close Phase 5.4 with full confidence

### If Tests Fail ❌

1. Debug and fix issues
2. Re-run failed tests
3. Update implementation if necessary
4. Document lessons learned

---

**Created:** 2026-03-21 11:35 UTC
**Status:** 📋 Ready for Execution
**Estimated Time:** 1-2 hours (with wait times for cache expiry)
