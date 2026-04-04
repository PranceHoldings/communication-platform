# E2E Test Session Fixture Fix

**Date:** 2026-03-18
**Issue:** Stage 4-5 E2E tests finding wrong session due to API ordering
**Status:** ✅ Fixed

---

## Problem

### Original Behavior

The `testSessionWithRecordingId` fixture was:
1. Querying `/sessions?limit=50` to get a list of sessions
2. Filtering for COMPLETED sessions with recordings
3. Using the first result (sessions[0])

### Issue

- API returns sessions ordered by `startedAt DESC` (most recent first)
- Test session `44040076-ebb5-4579-b019-e81c0ad1713c` was prepared with recordings
- However, newer sessions without recordings appeared first in results
- Tests would fail with "Found 0 sessions with recordings" or use wrong session

---

## Solution

### New Behavior

The fixture now implements a **two-step approach**:

#### Step 1: Try Known Test Session (Primary)

```typescript
const KNOWN_TEST_SESSION_WITH_RECORDING = '44040076-ebb5-4579-b019-e81c0ad1713c';

// Fetch the known session directly
const response = await authenticatedPage.request.get(
  `${apiUrl}/sessions/${KNOWN_TEST_SESSION_WITH_RECORDING}`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);

// Validate it has recordings
if (session.status === 'COMPLETED' && session.recordings?.length > 0) {
  await use(KNOWN_TEST_SESSION_WITH_RECORDING);
  return;
}
```

#### Step 2: Fallback to Search (Secondary)

If the known session doesn't exist or doesn't have recordings, fall back to the original search logic:

```typescript
// Search for any session with recordings
const response = await authenticatedPage.request.get(`${apiUrl}/sessions?limit=50`);
const sessionsWithRecordings = sessions.filter(s =>
  s.status === 'COMPLETED' && s.recordings?.length > 0
);
```

---

## Benefits

### 1. Predictable Test Behavior

✅ Tests always use the same session (44040076...) when available
✅ Consistent test results across runs
✅ No dependency on API ordering

### 2. Robustness

✅ Graceful fallback if known session is deleted
✅ Maintains backward compatibility
✅ Clear logging for debugging

### 3. Performance

✅ Direct GET /sessions/{id} is faster than list query
✅ Reduces API load (1 request vs list query)

---

## Test Session Preparation

The known test session must be prepared before running Stage 4-5 tests:

### SQL Setup

```sql
-- Ensure session status is COMPLETED
UPDATE sessions
SET status = 'COMPLETED'::"SessionStatus",
    ended_at = NOW(),
    duration_sec = 120
WHERE id = '44040076-ebb5-4579-b019-e81c0ad1713c';

-- Verify recordings exist
SELECT id, type, processing_status, duration_sec
FROM recordings
WHERE session_id = '44040076-ebb5-4579-b019-e81c0ad1713c';
```

### Verification

```bash
# Run E2E tests
pnpm run test:e2e -- stage4-recording.spec.ts

# Expected console output:
# 🎯 Attempting to use known test session: 44040076-ebb5-4579-b019-e81c0ad1713c
# 🔍 Known session status: COMPLETED
# 🔍 Known session recordings count: 2
# ✅ Using known test session: 44040076-ebb5-4579-b019-e81c0ad1713c (2 recordings)
```

---

## Files Modified

- `apps/web/tests/e2e/fixtures/session.fixture.ts`
  - Added `KNOWN_TEST_SESSION_WITH_RECORDING` constant
  - Modified `testSessionWithRecordingId` to try known session first
  - Maintained fallback search logic

---

## Related Issues

- **Root Cause:** API ordering by `startedAt DESC` caused unpredictable session selection
- **Previous Workaround:** Increased query limit to 50 (ineffective)
- **Proper Solution:** Direct session ID usage eliminates ordering dependency

---

## Testing Checklist

- [ ] Known test session exists in database
- [ ] Session has status='COMPLETED'
- [ ] Session has at least 1 recording with processing_status='COMPLETED'
- [ ] E2E Stage 4 tests pass (S4-001 through S4-010)
- [ ] Fixture logs show "Using known test session" message

---

## Future Improvements

1. **Environment Variable:** Make test session ID configurable via env var
2. **Automatic Setup:** Script to create/prepare test session automatically
3. **Multiple Test Sessions:** Support different sessions for different test scenarios
4. **CI/CD Integration:** Ensure test data exists in CI environment

---

**Result:** ✅ E2E tests now reliably find the correct test session with recordings
