# Phase 6: WebSocket Integration Verification - silencePromptTimeout Hierarchical Fallback

**Date**: 2026-03-15
**Session**: Phase 6 Manual Testing - WebSocket Integration
**Status**: ✅ FIXES IMPLEMENTED - READY FOR TESTING

---

## Summary of Fixes

**Problem**: Frontend was using `silenceTimeout` (for Azure STT) instead of `silencePromptTimeout` (for AI silence prompt timer), breaking hierarchical fallback.

**Root Cause**: Incomplete feature implementation - backend was updated but frontend integration was not completed.

**Files Changed**: 4 files
1. `apps/web/components/session-player/index.tsx` - Use silencePromptTimeout for timer
2. `apps/web/hooks/useWebSocket.ts` - Add silencePromptTimeout to interface & authenticate message
3. `packages/shared/src/types/index.ts` - Add silencePromptTimeout to AuthenticateMessage
4. `infrastructure/lambda/websocket/default/index.ts` - Handle silencePromptTimeout in authenticate handler

**Deployment Status**:
- ✅ Shared package built (AuthenticateMessage updated)
- ✅ WebSocket Lambda deployed (51 MB, uploaded to S3)
- ✅ Next.js dev server restarted
- ⏳ Ready for testing

---

## Test Data

### Test Scenario
- **ID**: `6f7f02c2-624e-41a2-b7ba-c0bc683584e5`
- **Title**: "Test Hierarchical Fallback"
- **silencePromptTimeout**: `null` (should fallback to organization)

### Organization Settings
- **silencePromptTimeout**: `25` seconds (this should be used)
- **enableSilencePrompt**: `false` (silence prompt disabled)

### System Default
- **silencePromptTimeout**: `15` seconds (DEFAULT_ORG_SETTINGS)

### Expected Behavior
**Hierarchical Fallback Chain**:
```
Scenario (null) → Organization (25s) → System Default (15s)
```

**Result**: Timer should use **25 seconds** (organization setting)

---

## Verification Steps

### Step 1: Verify Frontend Resolution

**Action**: Check SessionPlayer resolves silencePromptTimeout correctly

**Method**: Add console.log to SessionPlayer
```typescript
// apps/web/components/session-player/index.tsx (around line 925)
const effectiveSilencePromptTimeout =
  scenario.silencePromptTimeout ?? orgSettings?.silencePromptTimeout ?? DEFAULT_ORG_SETTINGS.silencePromptTimeout;

console.log('[SessionPlayer] silencePromptTimeout resolution:', {
  scenarioValue: scenario.silencePromptTimeout,
  orgValue: orgSettings?.silencePromptTimeout,
  systemDefault: DEFAULT_ORG_SETTINGS.silencePromptTimeout,
  resolved: effectiveSilencePromptTimeout,
});
```

**Expected Console Output**:
```
[SessionPlayer] silencePromptTimeout resolution: {
  scenarioValue: null,
  orgValue: 25,
  systemDefault: 15,
  resolved: 25
}
```

### Step 2: Verify WebSocket Authenticate Message

**Action**: Check useWebSocket sends silencePromptTimeout in authenticate message

**Method**: Check browser console when starting session

**Expected Console Output**:
```
[WebSocket] Sent authenticate with scenario data: {
  hasPrompt: true,
  language: 'ja',
  hasInitialGreeting: true,
  silenceTimeout: 10,
  silencePromptTimeout: 25,  // ✅ Should be 25 (from organization)
  enableSilencePrompt: false,
  silenceThreshold: 0.12,
  minSilenceDuration: 500
}
```

### Step 3: Verify Lambda Receives silencePromptTimeout

**Action**: Check Lambda CloudWatch logs

**Command**:
```bash
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --filter-pattern "[authenticate]"
```

**Expected Log Output**:
```
[authenticate] Received scenario data: {
  hasPrompt: true,
  promptPreview: "...",
  language: 'ja',
  hasInitialGreeting: true,
  initialGreetingPreview: "...",
  silenceTimeout: 10,
  silencePromptTimeout: 25,  // ✅ Should be 25 (from organization)
  enableSilencePrompt: false,
  initialSilenceTimeout: undefined
}
```

### Step 4: Verify Lambda Stores in DynamoDB

**Action**: Check DynamoDB connection data

**Command**:
```bash
# Get connection ID from CloudWatch logs
CONNECTION_ID="<connection-id-from-logs>"

aws dynamodb get-item \
  --table-name prance-websocket-connections-dev \
  --key '{"connection_id": {"S": "'$CONNECTION_ID'"}}' \
  --output json | jq '.Item'
```

**Expected DynamoDB Item**:
```json
{
  "connection_id": { "S": "..." },
  "sessionId": { "S": "7f095a51-bc3f-460e-be2e-b4540cd63d8e" },
  "silenceTimeout": { "N": "10" },
  "silencePromptTimeout": { "N": "25" },  // ✅ Should be 25
  "enableSilencePrompt": { "BOOL": false },
  "scenarioLanguage": { "S": "ja" },
  ...
}
```

### Step 5: Verify Timer Display (If Enabled)

**Note**: Current test scenario has `enableSilencePrompt: false` at organization level, so timer will NOT be shown.

**To test timer display**:
1. Update organization settings: `enableSilencePrompt: true`
2. Start session
3. Check UI shows timer counting to 25 seconds

**Expected UI**:
- Timer visible (if enabled)
- Counts from 0 to 25 seconds
- At 25 seconds, triggers AI silence prompt (if enabled)

---

## Test Execution

### Test 1: Null Scenario Value → Organization Fallback (✅ Current Test)

**Configuration**:
- Scenario: `silencePromptTimeout: null`
- Organization: `silencePromptTimeout: 25`
- System: `silencePromptTimeout: 15`

**Expected**: `25` seconds (organization)

### Test 2: Custom Scenario Value → No Fallback

**Configuration**:
- Scenario: `silencePromptTimeout: 30`
- Organization: `silencePromptTimeout: 25`
- System: `silencePromptTimeout: 15`

**Expected**: `30` seconds (scenario)

### Test 3: Null Scenario + Null Organization → System Default

**Configuration**:
- Scenario: `silencePromptTimeout: null`
- Organization: `silencePromptTimeout: null`
- System: `silencePromptTimeout: 15`

**Expected**: `15` seconds (system default)

---

## Quick Verification Commands

### 1. Check Latest WebSocket Lambda Deployment
```bash
aws lambda get-function --function-name prance-websocket-default-dev \
  --query 'Configuration.[FunctionName, LastModified, CodeSize, State, LastUpdateStatus]' \
  --output table
```

Expected:
- LastModified: 2026-03-15 12:58:38+00:00 (today)
- CodeSize: 53811877 (51 MB)
- State: Active
- LastUpdateStatus: Successful

### 2. Check Lambda Environment Variables
```bash
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables' \
  --output json | jq -r 'to_entries[] | "\(.key)=\(.value)"' | grep -E "CLOUDFRONT_DOMAIN|FFMPEG_PATH"
```

Expected:
```
CLOUDFRONT_DOMAIN=d3mx0sug5s3a6x.cloudfront.net
FFMPEG_PATH=/var/task/ffmpeg
```

### 3. Check Scenario Details
```bash
curl -s -H "Authorization: Bearer $(cat ~/.cache/prance-token.txt)" \
  "http://localhost:3001/api/v1/scenarios/6f7f02c2-624e-41a2-b7ba-c0bc683584e5" | jq '{
  id: .id,
  title: .title,
  silencePromptTimeout: .silencePromptTimeout,
  enableSilencePrompt: .enableSilencePrompt,
  silenceTimeout: .silenceTimeout
}'
```

Expected:
```json
{
  "id": "6f7f02c2-624e-41a2-b7ba-c0bc683584e5",
  "title": "Test Hierarchical Fallback",
  "silencePromptTimeout": null,
  "enableSilencePrompt": null,
  "silenceTimeout": null
}
```

### 4. Check Organization Settings
```bash
curl -s -H "Authorization: Bearer $(cat ~/.cache/prance-token.txt)" \
  "http://localhost:3001/api/v1/organizations/settings" | jq '{
  silencePromptTimeout: .silencePromptTimeout,
  enableSilencePrompt: .enableSilencePrompt,
  silenceTimeout: .silenceTimeout
}'
```

Expected:
```json
{
  "silencePromptTimeout": 25,
  "enableSilencePrompt": false,
  "silenceTimeout": 10
}
```

### 5. Monitor WebSocket Connection (Live)
```bash
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --filter-pattern "[authenticate]"
```

Expected output when starting session:
```
[authenticate] Received scenario data: {
  silencePromptTimeout: 25,
  enableSilencePrompt: false,
  ...
}
```

---

## Success Criteria

**✅ All checks must pass**:

1. Frontend resolves `silencePromptTimeout: 25` (from organization)
2. WebSocket sends `silencePromptTimeout: 25` in authenticate message
3. Lambda receives `silencePromptTimeout: 25` in authenticate handler
4. Lambda stores `silencePromptTimeout: 25` in DynamoDB
5. Lambda sends `silencePromptTimeout: 25` in authenticated response
6. Timer (if enabled) counts to 25 seconds

**❌ Failure Indicators**:
- Frontend logs `silencePromptTimeout: null` or `10` (wrong field)
- WebSocket does not send `silencePromptTimeout` field
- Lambda logs do not show `silencePromptTimeout: 25`
- DynamoDB item missing `silencePromptTimeout` field

---

## Rollback Plan (If Needed)

If tests fail:

1. **Check logs**: Identify which layer is failing
2. **Revert changes**: `git revert HEAD` (4 commits)
3. **Redeploy**: `npm run deploy:websocket`
4. **Root cause analysis**: Review error messages and data flow

---

## Next Steps After Verification

1. ✅ **Verify Test 1**: Null → Organization (25s)
2. ⏳ **Verify Test 2**: Custom scenario value (30s)
3. ⏳ **Verify Test 3**: Null → System default (15s)
4. ⏳ **UI Testing**: Enable `enableSilencePrompt` and verify timer display
5. ⏳ **Complete Phase 6**: Mark all tests as passed
6. ⏳ **Update Phase 6 Manual Testing Results**: Document verification results

---

## Related Documents

- [Phase 6 Manual Testing Checklist](./PHASE_6_MANUAL_TESTING_CHECKLIST.md)
- [Phase 6 Manual Testing Results](./PHASE_6_MANUAL_TESTING_RESULTS.md)
- [Phase 6 WebSocket Integration Analysis](./PHASE_6_WEBSOCKET_INTEGRATION_ANALYSIS.md)
- [Silence Management Module](../../05-modules/SILENCE_MANAGEMENT.md)

---

**Status**: ✅ Ready for testing
**Deployment Time**: 2026-03-15 12:58:38 UTC
**Next Action**: Execute verification steps 1-5 and validate hierarchical fallback
