# SessionPlayer Component Refactoring Plan

**Date:** 2026-03-08
**Issue:** Circular dependencies and hook initialization order problems
**Files:** `apps/web/components/session-player/index.tsx`

---

## Problem Analysis

### Current Hook/Callback Order

```
1. State (line 32-41) ✓
2. Refs (line 39-46) ✓
3. useEffect for token (line 49-54) ✓
4. handleTranscript (line 57-110) - references pendingSessionEnd ✓
5. handleAvatarResponse (line 112-123) ✓
6. handleProcessingUpdate (line 125-128) ✓
7. handleSessionComplete (line 130-147) ✓
8. handleAudioResponse (line 149-220) ✓
9. handleError (line 222-226) ✓
10. useWebSocket (line 229-249) ← RETURNS isConnected, sendAudioData, sendVideoChunk, endSession
11. useEffect for disconnect ref (line 252-254) ✓
12. useEffect for session end (line 257-280) - uses isConnected, endSession ✓
13. handleAudioChunk (line 283-298) ✓
14. handleRecordingError (line 300-303) ✓
15. handleRecordingComplete (line 305-331) ❌ PROBLEM - uses isConnected, sendAudioData
16. useAudioRecorder (line 333-346) ✓
17. handleVideoChunk (line 349-366) ❌ PROBLEM - uses isConnected, sendVideoChunk
18. handleVideoRecordingComplete (line 368-378) ✓
19. handleVideoRecordingError (line 380-386) ✓
20. handleCanvasReady (line 389-396) ✓
21. useVideoRecorder (line 399-413) ✓
22-27. Various useEffects (line 416-481) ✓
28-30. Handler functions (line 483-577) - may use isConnected, endSession
```

### Identified Circular Dependencies

#### Problem 1: handleRecordingComplete (line 305)
```typescript
const handleRecordingComplete = useCallback(
  async (audioBlob: Blob) => {
    if (isConnected) { // ← isConnected comes from useWebSocket (line 229)
      await sendAudioData(audioBlob); // ← sendAudioData from useWebSocket
      setPendingSessionEnd(true);
    }
  },
  [isConnected, sendAudioData, t] // ← Dependencies on values not yet defined
);
```

**Impact:** `handleRecordingComplete` is passed to `useAudioRecorder` (line 343), which is called AFTER `useWebSocket` initializes, but the callback itself is defined BEFORE `useWebSocket`.

#### Problem 2: handleVideoChunk (line 349)
```typescript
const handleVideoChunk = useCallback(
  async (chunk: Blob, timestamp: number) => {
    if (isConnected && status === 'ACTIVE') { // ← isConnected from useWebSocket
      await sendVideoChunk(chunk, timestamp); // ← sendVideoChunk from useWebSocket
    }
  },
  [isConnected, status, sendVideoChunk] // ← Dependency on useWebSocket values
);
```

**Impact:** `handleVideoChunk` is passed to `useVideoRecorder` (line 409), called AFTER `useWebSocket`, but defined BEFORE.

#### Problem 3: handleStop (line 537)
```typescript
const handleStop = () => {
  // ...
  if (isConnected && !pendingSessionEnd) { // ← isConnected from useWebSocket
    endSession(); // ← endSession from useWebSocket
  }
};
```

**Impact:** Regular function (not useCallback), but references values from `useWebSocket`.

---

## Solution: Use Refs to Break Circular Dependencies

### Strategy

Use **refs** to store values from `useWebSocket` and reference them in callbacks. This breaks the initialization order dependency while maintaining React's reactivity where needed.

### Pattern

```typescript
// Step 1: Create refs for WebSocket values (BEFORE callbacks)
const isConnectedRef = useRef(false);
const sendAudioDataRef = useRef<((blob: Blob) => Promise<void>) | null>(null);
const sendVideoChunkRef = useRef<((chunk: Blob, timestamp: number) => Promise<void>) | null>(null);
const endSessionRef = useRef<(() => void) | null>(null);

// Step 2: Define callbacks using refs (BEFORE useWebSocket)
const handleRecordingComplete = useCallback(
  async (audioBlob: Blob) => {
    if (isConnectedRef.current && sendAudioDataRef.current) {
      await sendAudioDataRef.current(audioBlob);
      setPendingSessionEnd(true);
    }
  },
  [t] // ← No dependency on useWebSocket values
);

// Step 3: Call useWebSocket
const {
  isConnected,
  sendAudioData,
  sendVideoChunk,
  endSession,
  // ...
} = useWebSocket({ ... });

// Step 4: Sync refs with useWebSocket values (AFTER useWebSocket)
useEffect(() => {
  isConnectedRef.current = isConnected;
}, [isConnected]);

useEffect(() => {
  sendAudioDataRef.current = sendAudioData;
}, [sendAudioData]);

useEffect(() => {
  sendVideoChunkRef.current = sendVideoChunk;
}, [sendVideoChunk]);

useEffect(() => {
  endSessionRef.current = endSession;
}, [endSession]);
```

### Benefits

1. ✅ Breaks circular dependencies - callbacks don't depend on useWebSocket values
2. ✅ Maintains functionality - refs always have latest values
3. ✅ Minimal structural changes - no need to reorder large blocks
4. ✅ Clear pattern - easy to understand and maintain
5. ✅ No performance impact - refs are stable

### Trade-offs

1. ⚠️ Refs don't trigger re-renders - but that's fine here, we only need values not reactivity
2. ⚠️ Slightly more verbose - but explicit and clear
3. ⚠️ Need to remember to sync refs - but this is a one-time setup

---

## Implementation Plan

### Phase 1: Add Refs (5 minutes)

**Location:** After existing refs (line 46), before handleTranscript

```typescript
// WebSocket value refs (to break circular dependencies)
const isConnectedRef = useRef<boolean>(false);
const sendAudioDataRef = useRef<((blob: Blob) => Promise<void>) | null>(null);
const sendVideoChunkRef = useRef<((chunk: Blob, timestamp: number) => Promise<void>) | null>(null);
const endSessionRef = useRef<(() => void) | null>(null);
```

### Phase 2: Update handleRecordingComplete (3 minutes)

**Location:** Line 305-331

**Before:**
```typescript
const handleRecordingComplete = useCallback(
  async (audioBlob: Blob) => {
    if (isConnected) {
      // ...
      await sendAudioData(audioBlob);
      // ...
    }
  },
  [isConnected, sendAudioData, t]
);
```

**After:**
```typescript
const handleRecordingComplete = useCallback(
  async (audioBlob: Blob) => {
    if (isConnectedRef.current && sendAudioDataRef.current) {
      try {
        console.log('[SessionPlayer] Recording complete:', {
          size: audioBlob.size,
          type: audioBlob.type,
        });

        console.log('[SessionPlayer] Sending complete audio via WebSocket');

        // Send complete audio blob for STT processing
        await sendAudioDataRef.current(audioBlob);

        // Set flag to wait for transcript_final before ending session
        setPendingSessionEnd(true);

        toast.info(t('sessions.player.messages.processingAudio'));
      } catch (error) {
        console.error('[SessionPlayer] Failed to process recording:', error);
        toast.error(t('sessions.player.messages.audioSendError'));
        setPendingSessionEnd(false);
      }
    }
  },
  [t] // ← Removed isConnected, sendAudioData
);
```

### Phase 3: Update handleVideoChunk (3 minutes)

**Location:** Line 349-366

**Before:**
```typescript
const handleVideoChunk = useCallback(
  async (chunk: Blob, timestamp: number) => {
    if (isConnected && status === 'ACTIVE') {
      try {
        await sendVideoChunk(chunk, timestamp);
        // ...
      } catch (error) {
        // ...
      }
    }
  },
  [isConnected, status, sendVideoChunk]
);
```

**After:**
```typescript
const handleVideoChunk = useCallback(
  async (chunk: Blob, timestamp: number) => {
    if (isConnectedRef.current && status === 'ACTIVE' && sendVideoChunkRef.current) {
      try {
        await sendVideoChunkRef.current(chunk, timestamp);
        console.log('[SessionPlayer] Video chunk sent:', {
          size: chunk.size,
          timestamp,
          type: chunk.type
        });
      } catch (error) {
        console.error('[SessionPlayer] Failed to send video chunk:', error);
      }
    }
  },
  [status] // ← Removed isConnected, sendVideoChunk
);
```

### Phase 4: Add Ref Sync useEffects (5 minutes)

**Location:** After useWebSocket (line 249), before existing useEffect for disconnect

```typescript
// Sync WebSocket values to refs (to break circular dependencies)
useEffect(() => {
  isConnectedRef.current = isConnected;
}, [isConnected]);

useEffect(() => {
  sendAudioDataRef.current = sendAudioData;
}, [sendAudioData]);

useEffect(() => {
  sendVideoChunkRef.current = sendVideoChunk;
}, [sendVideoChunk]);

useEffect(() => {
  endSessionRef.current = endSession;
}, [endSession]);
```

### Phase 5: Update handleStop (2 minutes)

**Location:** Line 537-577

**Before:**
```typescript
const handleStop = () => {
  // ...
  if (isConnected && !pendingSessionEnd) {
    endSession();
    // ...
  }
};
```

**After:**
```typescript
const handleStop = () => {
  if (status === 'ACTIVE' || status === 'PAUSED' || status === 'READY') {
    setStatus('COMPLETED');

    // 1. Stop audio recording first
    stopRecording();

    // 2. Stop video recording if active
    if (recordingStatus === 'recording' || recordingStatus === 'paused') {
      stopVideoRecording();
    }

    // 3. Stop user camera
    if (userVideoRef.current && userVideoRef.current.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('[SessionPlayer] Stopped camera track:', track.kind);
      });
      userVideoRef.current.srcObject = null;
    }

    // 4. Send session end notification (if connected)
    if (isConnectedRef.current && !pendingSessionEnd && endSessionRef.current) {
      endSessionRef.current();

      // 5. Set timeout to disconnect after 30 seconds if no session_complete received
      sessionEndTimeoutRef.current = setTimeout(() => {
        console.log('[SessionPlayer] Session end timeout - disconnecting WebSocket');
        if (disconnectRef.current) {
          disconnectRef.current();
        }
      }, 30000);
    } else if (pendingSessionEnd) {
      console.log('[SessionPlayer] Waiting for transcript before sending session_end');
    }

    toast.success(t('sessions.player.messages.sessionEnded'));
  }
};
```

### Phase 6: Verify shouldSendSessionEnd useEffect (2 minutes)

**Location:** Line 257-280

**Check:** This useEffect already uses `isConnected` and `endSession` directly, which is fine because:
1. It's defined AFTER useWebSocket (line 229)
2. It's in a useEffect, not a callback passed to other hooks

**No changes needed** - this pattern is correct.

---

## Testing Checklist

After implementation, test the following scenarios:

### Basic Flow
- [ ] Click "Start" button
- [ ] WebSocket connects successfully
- [ ] Audio recording starts
- [ ] Speak and verify transcript appears (no duplicates)
- [ ] Click "Stop" button
- [ ] Verify transcript_final received before session_end sent
- [ ] Session completes successfully

### Video Recording
- [ ] Start session
- [ ] Click "Start Recording" button
- [ ] Verify video recording indicator shows
- [ ] Speak and move
- [ ] Click "Stop Recording" button
- [ ] Verify video chunks sent to S3
- [ ] Check DynamoDB for recording metadata

### Error Scenarios
- [ ] Deny microphone permission → verify error message
- [ ] Deny camera permission → verify warning message
- [ ] Stop session before audio processing completes → verify no errors
- [ ] WebSocket disconnects during session → verify error handling

### Console Checks
- [ ] No "Cannot access before initialization" errors
- [ ] No duplicate transcript messages
- [ ] All video chunks logged correctly
- [ ] Session end flow logs correctly

---

## Estimated Time

- Phase 1: 5 minutes
- Phase 2: 3 minutes
- Phase 3: 3 minutes
- Phase 4: 5 minutes
- Phase 5: 2 minutes
- Phase 6: 2 minutes
- Testing: 10 minutes

**Total: ~30 minutes**

---

## Alternative Approaches (Not Recommended)

### Alternative 1: Move all callbacks after useWebSocket
**Problem:** Would require restructuring useWebSocket to accept refs or functions, breaking its API

### Alternative 2: Extract custom hooks
**Problem:** Adds complexity without solving the fundamental ordering issue

### Alternative 3: Use inline functions
**Problem:** Creates new function instances on every render, poor performance

---

## Success Criteria

1. ✅ No "Cannot access before initialization" errors
2. ✅ No duplicate transcripts
3. ✅ Video recording works correctly
4. ✅ Audio recording works correctly
5. ✅ Session end flow works correctly
6. ✅ All TypeScript errors resolved
7. ✅ All ESLint warnings resolved
8. ✅ Component compiles successfully

---

**Next Steps:**
1. Review this plan
2. Implement Phase 1-5
3. Test thoroughly
4. Update START_HERE.md with completion
5. Commit with message: "refactor(SessionPlayer): fix hook dependencies with refs pattern"
