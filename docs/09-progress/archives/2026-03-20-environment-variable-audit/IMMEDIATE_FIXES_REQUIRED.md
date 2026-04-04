# Immediate Fixes Required - Environment Variable Audit

**Date:** 2026-03-20
**Priority:** P0 - Critical
**Status:** Action Required

---

## Critical Findings

### 1. WebSocket Connect & Disconnect Functions Missing AWS_REGION

**Problem:** Both functions use `process.env.AWS_REGION` but CDK doesn't set it explicitly.

**Files Affected:**
- `infrastructure/lambda/websocket/connect/index.ts:13`
- `infrastructure/lambda/websocket/disconnect/index.ts:11`

**Current Code:**
```typescript
const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);
```

**Current CDK (connect):**
```typescript
// infrastructure/lib/api-lambda-stack.ts:1216-1222
environment: {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
  DYNAMODB_CONNECTION_TTL_SECONDS: process.env.DYNAMODB_CONNECTION_TTL_SECONDS || '14400',
}
```

**Current CDK (disconnect):**
```typescript
// infrastructure/lib/api-lambda-stack.ts:1266-1271
environment: {
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
}
```

**Impact:**
- Currently works because AWS Lambda runtime provides `AWS_REGION` automatically
- But implicit dependency is fragile and could break in edge cases
- Inconsistent with best practices

**Fix Required:**

Add to both functions' environment blocks:
```typescript
AWS_REGION: this.region, // Explicit region from CDK context
```

**Fixed CDK (connect):**
```typescript
environment: {
  AWS_REGION: this.region, // ✅ ADD THIS
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  JWT_SECRET: jwtSecret.secretValueFromJson('secret').unsafeUnwrap(),
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
  DYNAMODB_CONNECTION_TTL_SECONDS: process.env.DYNAMODB_CONNECTION_TTL_SECONDS || '14400',
}
```

**Fixed CDK (disconnect):**
```typescript
environment: {
  AWS_REGION: this.region, // ✅ ADD THIS
  ENVIRONMENT: props.environment,
  LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG',
  NODE_ENV: props.environment === 'production' ? 'production' : 'development',
  CONNECTIONS_TABLE_NAME: props.websocketConnectionsTable.tableName,
}
```

---

## Verification After Fix

```bash
# 1. Verify CDK changes
git diff infrastructure/lib/api-lambda-stack.ts

# 2. Deploy
cd infrastructure
pnpm run deploy:websocket

# 3. Verify environment variables are set
aws lambda get-function-configuration \
  --function-name prance-websocket-connect-dev \
  --query 'Environment.Variables.AWS_REGION' \
  --output text
# Expected: us-east-1

aws lambda get-function-configuration \
  --function-name prance-websocket-disconnect-dev \
  --query 'Environment.Variables.AWS_REGION' \
  --output text
# Expected: us-east-1

# 4. Test WebSocket connection
# Run E2E tests or manual connection test
```

---

## Additional Findings (Non-Critical)

### Variable Name Inconsistency

**Issue:** `.env.local` uses `NEXT_PUBLIC_WS_ENDPOINT` but `infrastructure/.env` uses `NEXT_PUBLIC_WS_URL`

**Fix:** Standardize to `NEXT_PUBLIC_WS_ENDPOINT` in both files.

**Files to Update:**
- `/workspaces/prance-communication-platform/infrastructure/.env:71`

**Change:**
```bash
# Before
NEXT_PUBLIC_WS_URL=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev

# After
NEXT_PUBLIC_WS_ENDPOINT=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

---

## Timeline

- [ ] **Step 1:** Update CDK stack (5 minutes)
- [ ] **Step 2:** Deploy WebSocket functions (2 minutes)
- [ ] **Step 3:** Verify environment variables (1 minute)
- [ ] **Step 4:** Test WebSocket connection (2 minutes)
- [ ] **Step 5:** Fix variable name inconsistency (1 minute)

**Total Estimated Time:** 11 minutes

---

## Risk Assessment

**Current Risk:** LOW
- Functions currently work because Lambda runtime provides AWS_REGION
- But this is implicit and could fail in edge cases

**Post-Fix Risk:** NONE
- Explicit environment variables are best practice
- No runtime behavior changes expected
- Only makes existing implicit behavior explicit

---

## Related Issues

- WebSocket 500 error (2026-03-20) - Fixed by adding `DYNAMODB_CONNECTION_TTL_SECONDS`
- This audit identified 2 more functions with similar implicit dependencies

---

**Status:** Ready for implementation
**Next Action:** Update CDK stack as shown above
