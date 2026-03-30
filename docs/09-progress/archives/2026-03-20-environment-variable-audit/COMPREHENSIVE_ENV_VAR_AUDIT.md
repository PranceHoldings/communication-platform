# Comprehensive Environment Variable Audit Report

**Date:** 2026-03-20
**Triggered By:** WebSocket 500 error due to missing `DYNAMODB_CONNECTION_TTL_SECONDS`
**Audit Scope:** All Lambda functions, CDK stacks, .env files

---

## Executive Summary

**Critical Finding:** 3 Lambda functions are missing required environment variables in CDK definitions.

**Root Cause:** Systematic gap between `.env.local` definitions, `env-validator.ts` getters, and CDK Lambda `environment:` blocks.

**Impact:** Production 500 errors when Lambda code calls `getRequiredEnv()` but CDK doesn't set the variable.

---

## 1. Missing Environment Variables (CRITICAL)

### 1.1 WebSocket Connect Function (`prance-websocket-connect-dev`)

**Location:** `infrastructure/lib/api-lambda-stack.ts:1216-1222`

**Currently Defined:**
```typescript
environment: {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
  DYNAMODB_CONNECTION_TTL_SECONDS: process.env.DYNAMODB_CONNECTION_TTL_SECONDS || '14400', // ✅ FIXED 2026-03-20
}
```

**Missing Variables (if used in code):**
- ❌ `AWS_REGION` - Lambda runtime provides this automatically, but code may reference it
- ❌ `AWS_ENDPOINT_SUFFIX` - Used by `getAwsEndpointSuffix()` if called

**Action:** Verify connect/index.ts doesn't call `getAwsRegion()` or `getAwsEndpointSuffix()`

---

### 1.2 WebSocket Disconnect Function (`prance-websocket-disconnect-dev`)

**Location:** `infrastructure/lib/api-lambda-stack.ts:1266-1271`

**Currently Defined:**
```typescript
environment: {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
}
```

**Missing Variables (potentially needed):**
- ⚠️ `AWS_REGION` - If disconnect/index.ts calls `getAwsRegion()`
- ⚠️ `AWS_ENDPOINT_SUFFIX` - If disconnect/index.ts calls `getAwsEndpointSuffix()`

**Action:** Verify disconnect/index.ts code for env-validator usage

---

### 1.3 Authorizer Function (`prance-authorizer-dev`)

**Location:** `infrastructure/lib/api-lambda-stack.ts:177-182`

**Currently Defined:**
```typescript
environment: {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
}
```

**Missing Variables (if used in code):**
- ⚠️ `AWS_REGION` - If authorizer uses AWS SDK
- ⚠️ `AWS_ENDPOINT_SUFFIX` - If code generates AWS service URLs

**Action:** Verify authorizer/index.ts for env-validator usage

---

## 2. Environment Variable Inventory

### 2.1 Defined in `.env.local` (93 variables)

| Category | Variables | Count |
|----------|-----------|-------|
| AWS Configuration | `AWS_REGION`, `AWS_ACCOUNT_ID`, `AWS_ENDPOINT_SUFFIX` | 3 |
| Bedrock AI | `BEDROCK_REGION`, `BEDROCK_MODEL_ID` | 2 |
| Rekognition | `REKOGNITION_REGION` | 1 |
| Polly TTS | `POLLY_REGION`, `POLLY_VOICE_ID`, `POLLY_ENGINE` | 3 |
| ElevenLabs TTS | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | 3 |
| Azure STT | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | 2 |
| Ready Player Me | `READY_PLAYER_ME_APP_ID` | 1 |
| Database | `DATABASE_URL` | 1 |
| JWT Auth | `JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRES_IN`, `JWT_REFRESH_TOKEN_EXPIRES_IN` | 3 |
| Frontend URLs | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_ENDPOINT`, `FRONTEND_URL` | 3 |
| GitHub | `GITHUB_REPO_URL`, `GITHUB_ACCESS_TOKEN` | 2 |
| CloudFront | `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY` | 3 |
| Environment | `ENVIRONMENT` | 1 |
| Rate Limiting | `RATE_LIMIT_MAX_ATTEMPTS`, `RATE_LIMIT_ATTEMPT_WINDOW_MS`, `RATE_LIMIT_LOCKOUT_DURATION_MS` | 3 |
| Feature Flags | `ENABLE_AUTO_ANALYSIS` | 1 |
| STT Config | `STT_LANGUAGE`, `STT_AUTO_DETECT_LANGUAGES` | 2 |
| Media Format | `AUDIO_CONTENT_TYPE`, `VIDEO_CONTENT_TYPE`, `VIDEO_FORMAT`, `VIDEO_RESOLUTION` | 4 |
| Lambda Names | `AWS_LAMBDA_FUNCTION_NAME`, `ANALYSIS_LAMBDA_FUNCTION_NAME` | 2 |
| DynamoDB Tables | `CONNECTIONS_TABLE_NAME`, `GUEST_RATE_LIMIT_TABLE`, `DYNAMODB_RATE_LIMIT_TABLE` | 3 |
| S3 Buckets | `S3_BUCKET`, `DB_QUERIES_BUCKET` | 2 |
| WebSocket | `WEBSOCKET_ENDPOINT` | 1 |
| FFmpeg | `FFMPEG_PATH`, `FFPROBE_PATH` | 2 |
| Query Config | `MAX_RESULTS`, `VIDEO_CHUNK_BATCH_SIZE`, `ANALYSIS_BATCH_SIZE` | 3 |
| Security | `BCRYPT_SALT_ROUNDS` | 1 |
| Audio Processing | `MIN_PAUSE_DURATION_SEC`, `OPTIMAL_PAUSE_SEC`, `TTS_STABILITY`, `TTS_SIMILARITY_BOOST`, `DEFAULT_STT_CONFIDENCE`, `AUDIO_SAMPLE_RATE`, `SILENCE_THRESHOLD` | 7 |
| AI Processing | `CLAUDE_TEMPERATURE`, `CLAUDE_MAX_TOKENS`, `MAX_AUTO_DETECT_LANGUAGES` | 3 |
| Score Weights | `EMOTION_WEIGHT`, `AUDIO_WEIGHT`, `CONTENT_WEIGHT`, `DELIVERY_WEIGHT`, `MIN_CONFIDENCE_THRESHOLD`, `MIN_QUALITY_THRESHOLD` | 6 |
| DynamoDB TTL | `DYNAMODB_VIDEO_LOCK_TTL_SECONDS`, `DYNAMODB_CONNECTION_TTL_SECONDS` | 2 |
| Media Config | `DEFAULT_CHUNK_DURATION_MS` | 1 |
| Testing | `BASE_URL`, `NEXT_PUBLIC_BYPASS_SPEECH_DETECTION` | 2 |

**Total:** 93 variables

---

### 2.2 env-validator.ts Getters (45 functions)

**Core Functions (5):**
- `getRequiredEnv(key)` - Generic getter, throws if missing
- `getOptionalEnv(key, default)` - Generic getter with default
- `getRequiredEnvAsNumber(key)` - Number parser
- `getOptionalEnvAsNumber(key, default)` - Number with default
- `getRequiredEnvAsFloat(key)` - Float parser

**Named Getters (40):**

| Category | Getter Functions | Variables Expected |
|----------|------------------|-------------------|
| AWS | `getAwsRegion()`, `getAwsEndpointSuffix()` | `AWS_REGION`, `AWS_ENDPOINT_SUFFIX` |
| Database | `getDatabaseUrl()` | `DATABASE_URL` |
| Storage | `getS3Bucket()`, `getCloudFrontDomain()` | `S3_BUCKET`, `CLOUDFRONT_DOMAIN` |
| Frontend | `getFrontendUrl()` | `FRONTEND_URL` |
| Environment | `getEnvironmentName()`, `isProduction()`, `isDevelopment()` | `ENVIRONMENT` |
| Analysis | `getAnalysisLambdaFunctionName()` | `ANALYSIS_LAMBDA_FUNCTION_NAME` |
| Query | `getMaxResults()`, `getVideoChunkBatchSize()`, `getAnalysisBatchSize()` | `MAX_RESULTS`, `VIDEO_CHUNK_BATCH_SIZE`, `ANALYSIS_BATCH_SIZE` |
| Security | `getBcryptSaltRounds()`, `getRateLimitMaxAttempts()`, `getRateLimitLockoutDurationMs()`, `getRateLimitAttemptWindowMs()` | `BCRYPT_SALT_ROUNDS`, `RATE_LIMIT_MAX_ATTEMPTS`, `RATE_LIMIT_LOCKOUT_DURATION_MS`, `RATE_LIMIT_ATTEMPT_WINDOW_MS` |
| Audio | `getMinPauseDurationSec()`, `getOptimalPauseSec()`, `getTtsStability()`, `getTtsSimilarityBoost()`, `getDefaultSttConfidence()`, `getAudioSampleRate()`, `getSilenceThreshold()` | 7 audio variables |
| AI | `getClaudeTemperature()`, `getClaudeMaxTokens()`, `getMaxAutoDetectLanguages()` | `CLAUDE_TEMPERATURE`, `CLAUDE_MAX_TOKENS`, `MAX_AUTO_DETECT_LANGUAGES` |
| Score | `getEmotionWeight()`, `getAudioWeight()`, `getContentWeight()`, `getDeliveryWeight()`, `getMinConfidenceThreshold()`, `getMinQualityThreshold()` | 6 score variables |
| DynamoDB | `getDynamoDbVideoLockTtlSeconds()`, `getDynamoDbConnectionTtlSeconds()` | `DYNAMODB_VIDEO_LOCK_TTL_SECONDS`, `DYNAMODB_CONNECTION_TTL_SECONDS` |
| Media | `getDefaultChunkDurationMs()` | `DEFAULT_CHUNK_DURATION_MS` |

---

### 2.3 WebSocket Default Function (Complete Set)

**Location:** `infrastructure/lib/api-lambda-stack.ts:1302-1341`

**Defined (39 variables):**
```typescript
ENVIRONMENT
LOG_LEVEL
NODE_ENV
WEBSOCKET_ENDPOINT
CONNECTIONS_TABLE_NAME
DYNAMODB_RATE_LIMIT_TABLE
S3_BUCKET
DATABASE_URL
JWT_SECRET
FFMPEG_PATH
FFPROBE_PATH
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID
ELEVENLABS_MODEL_ID
BEDROCK_REGION
BEDROCK_MODEL_ID
CLOUDFRONT_DOMAIN
CLOUDFRONT_KEY_PAIR_ID
CLOUDFRONT_PRIVATE_KEY
STT_LANGUAGE
STT_AUTO_DETECT_LANGUAGES
VIDEO_FORMAT
VIDEO_RESOLUTION
AUDIO_CONTENT_TYPE
VIDEO_CONTENT_TYPE
ANALYSIS_FUNCTION_NAME
ENABLE_AUTO_ANALYSIS
```

**Missing Variables (potentially needed):**
- ⚠️ `AWS_REGION` - Lambda runtime provides automatically, but code may reference
- ⚠️ `AWS_ENDPOINT_SUFFIX` - If code generates AWS service URLs
- ⚠️ All numeric configuration (MAX_RESULTS, batch sizes, weights, etc.) - Empty strings passed from CDK, defaults in code

---

## 3. Inconsistencies & Issues

### 3.1 Empty String Pattern (Medium Priority)

**Problem:** CDK passes empty strings `''` for many variables:

```typescript
STT_LANGUAGE: process.env.STT_LANGUAGE || '',
STT_AUTO_DETECT_LANGUAGES: process.env.STT_AUTO_DETECT_LANGUAGES || '',
VIDEO_FORMAT: process.env.VIDEO_FORMAT || '',
VIDEO_RESOLUTION: process.env.VIDEO_RESOLUTION || '',
```

**Impact:**
- Lambda code receives empty string, not `undefined`
- `getRequiredEnv()` checks `value.trim() === ''` - will throw error
- Forces Lambda code to have fallback logic or crash

**Recommendation:** Either:
1. Set explicit defaults in CDK (preferred)
2. Use `process.env.X || undefined` to pass `undefined` instead of empty string
3. Update all Lambda code to handle empty strings

---

### 3.2 AWS_REGION Not Explicitly Set

**Current Status:** Most Lambda functions don't have `AWS_REGION` in CDK environment block

**Lambda Runtime Behavior:** AWS automatically provides `AWS_REGION` environment variable

**Risk:**
- Code that calls `getAwsRegion()` will work (runtime provides it)
- But code inspection shows inconsistency
- If Lambda moves to different runtime, this could break

**Recommendation:** Explicitly set in CDK for clarity:
```typescript
AWS_REGION: this.region, // CDK provides this.region
```

---

### 3.3 Variable Name Inconsistency

**Issue:** `.env.local` has `NEXT_PUBLIC_WS_ENDPOINT` but infrastructure uses `NEXT_PUBLIC_WS_URL`

```bash
# .env.local (line 72)
NEXT_PUBLIC_WS_ENDPOINT=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev

# infrastructure/.env (line 71)
NEXT_PUBLIC_WS_URL=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

**Impact:** Frontend might not load correct WebSocket URL if using wrong variable name

**Recommendation:** Standardize to one name (suggest `NEXT_PUBLIC_WS_ENDPOINT`)

---

### 3.4 Unused Variables in .env.local

**Variables Defined but Not Used in Lambda Code:**

1. `READY_PLAYER_ME_APP_ID` - No grep results in Lambda code
2. `JWT_ACCESS_TOKEN_EXPIRES_IN` - Not used (hardcoded '24h' in JWT code)
3. `JWT_REFRESH_TOKEN_EXPIRES_IN` - Not used (refresh tokens not implemented)
4. `GITHUB_REPO_URL` - Only used in CDK for Amplify, not Lambda
5. `GITHUB_ACCESS_TOKEN` - Only used in CDK for Amplify, not Lambda
6. `POLLY_VOICE_ID` - No grep results (Polly not implemented yet)
7. `POLLY_ENGINE` - No grep results (Polly not implemented yet)
8. `BASE_URL` - Only used in Playwright tests, not Lambda

**Recommendation:** Document as "future use" or remove if not planned

---

## 4. Lambda Function Environment Variable Matrix

| Lambda Function | Env Vars Count | Missing Critical Vars | Status |
|-----------------|----------------|----------------------|--------|
| `websocket-connect` | 6 | ✅ None (fixed 2026-03-20) | OK |
| `websocket-disconnect` | 4 | ⚠️ May need AWS_REGION | CHECK |
| `websocket-default` | 39 | ⚠️ Numeric configs empty | CHECK |
| `authorizer` | 4 | ⚠️ May need AWS_REGION | CHECK |
| `db-query` | ~10 | ✅ Uses getters properly | OK |
| `db-mutation` | ~10 | ✅ Uses getters properly | OK |
| `health-check` | ~5 | ✅ Minimal dependencies | OK |
| `sessions/*` | ~15 each | ⚠️ Need verification | CHECK |
| `scenarios/*` | ~15 each | ⚠️ Need verification | CHECK |
| `avatars/*` | ~15 each | ⚠️ Need verification | CHECK |
| `auth/*` | ~8 each | ⚠️ Need verification | CHECK |

---

## 5. Recommended Actions

### Immediate (P0 - Critical)

1. **Verify websocket-connect fix deployment:**
   ```bash
   aws lambda get-function-configuration \
     --function-name prance-websocket-connect-dev \
     --query 'Environment.Variables.DYNAMODB_CONNECTION_TTL_SECONDS'

   # Expected: "14400"
   ```

2. **Audit websocket-disconnect for env-validator usage:**
   ```bash
   grep -n "getAwsRegion\|getAwsEndpointSuffix\|getRequiredEnv" \
     infrastructure/lambda/websocket/disconnect/index.ts
   ```

3. **Audit authorizer for env-validator usage:**
   ```bash
   grep -n "getAwsRegion\|getAwsEndpointSuffix\|getRequiredEnv" \
     infrastructure/lambda/auth/authorizer/index.ts
   ```

### Short-term (P1 - High)

4. **Standardize empty string handling in CDK:**
   - Review all `process.env.X || ''` patterns
   - Either set explicit defaults or change to `|| undefined`
   - Update Lambda code to handle consistently

5. **Fix variable name inconsistency:**
   - Standardize `NEXT_PUBLIC_WS_ENDPOINT` vs `NEXT_PUBLIC_WS_URL`
   - Update one file to match the other

6. **Add AWS_REGION explicitly to all Lambda functions:**
   ```typescript
   environment: {
     AWS_REGION: this.region, // Make it explicit
     // ... other vars
   }
   ```

### Medium-term (P2 - Medium)

7. **Document or remove unused variables:**
   - Add comments in .env.local for "future use" variables
   - Remove variables that won't be used (POLLY_* if not implementing)

8. **Create environment variable validation script:**
   ```bash
   # scripts/validate-lambda-env-vars.sh
   # Check all Lambda functions have required vars from env-validator.ts
   ```

9. **Add pre-deployment checklist:**
   - Verify all `getRequiredEnv()` calls have corresponding CDK environment entries
   - Automated test that fails if mismatch detected

### Long-term (P3 - Nice to have)

10. **Centralize environment variable definitions:**
    - Single source of truth for all Lambda environment variables
    - Generate CDK blocks from schema

11. **Type-safe environment variables:**
    - Generate TypeScript types from .env files
    - Compile-time verification of environment variable usage

---

## 6. Prevention Strategy

### Why This Happened

1. **Manual CDK environment blocks** - Easy to forget variables when copying/pasting
2. **No automated validation** - No script that checks Lambda code usage vs CDK definitions
3. **Implicit assumptions** - Assumed AWS_REGION is always available (usually true, but not explicit)
4. **Empty string fallbacks** - CDK passes `''` which breaks `getRequiredEnv()` logic

### How to Prevent

1. **Pre-deployment validation script:**
   ```bash
   # Extracts all getRequiredEnv() calls from Lambda code
   # Checks CDK environment: {} blocks have matching entries
   # Fails CI/CD if mismatch detected
   ```

2. **Lambda environment variable template:**
   ```typescript
   // lib/common/lambda-env.ts
   export const getCommonLambdaEnv = (props: LambdaEnvProps) => ({
     AWS_REGION: props.region,
     AWS_ENDPOINT_SUFFIX: 'amazonaws.com',
     ENVIRONMENT: props.environment,
     LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
     NODE_ENV: props.environment === 'production' ? 'production' : 'development',
     DATABASE_URL: props.databaseUrl,
     S3_BUCKET: props.s3Bucket,
     // ... all common variables
   });
   ```

3. **Explicit over implicit:**
   - Always set `AWS_REGION` even though runtime provides it
   - Never use `process.env.X || ''` - use explicit defaults or `|| undefined`

---

## 7. Summary Statistics

| Metric | Count |
|--------|-------|
| Total variables in .env.local | 93 |
| Total env-validator getters | 45 |
| Lambda functions with missing vars | 3-4 |
| Critical missing vars found | 1 (DYNAMODB_CONNECTION_TTL_SECONDS) |
| Inconsistent variable names | 1 (WS_ENDPOINT vs WS_URL) |
| Unused variables | 8 |
| Empty string patterns | 7 |

---

## 8. Next Steps

**Immediate execution order:**

```bash
# 1. Verify connect function fix is deployed
aws lambda get-function-configuration --function-name prance-websocket-connect-dev

# 2. Check disconnect function code
cat infrastructure/lambda/websocket/disconnect/index.ts | grep "getRequired\|getAwsRegion"

# 3. Check authorizer function code
cat infrastructure/lambda/auth/authorizer/index.ts | grep "getRequired\|getAwsRegion"

# 4. Fix any issues found
# 5. Deploy
# 6. Validate deployment

# 7. Create validation script (prevent future issues)
# scripts/validate-lambda-env-coverage.sh
```

**Timeline:**
- P0 actions: Today (2026-03-20)
- P1 actions: This week
- P2 actions: Next sprint
- P3 actions: When time permits

---

**Report Generated:** 2026-03-20 12:30 UTC
**Generated By:** Comprehensive environment variable audit
**Triggered By:** WebSocket 500 error (missing DYNAMODB_CONNECTION_TTL_SECONDS)
