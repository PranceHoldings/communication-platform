# Phase 6: WebSocket Integration Analysis - silencePromptTimeout Hierarchical Fallback

**Date**: 2026-03-15
**Session**: Phase 6 Manual Testing - WebSocket Integration
**Test Scenario ID**: `6f7f02c2-624e-41a2-b7ba-c0bc683584e5`
**Test Session ID**: `7f095a51-bc3f-460e-be2e-b4540cd63d8e`

---

## 1. Issue Discovery

**Expected Behavior:**
- Scenario `silencePromptTimeout`: `null` → Should fallback to organization setting
- Organization `silencePromptTimeout`: `25` seconds
- **Expected Result**: Silence timer should use 25 seconds

**Problem Found:**
The frontend is using `silenceTimeout` instead of `silencePromptTimeout` for the silence timer!

---

## 2. Field Confusion - silenceTimeout vs silencePromptTimeout

There are **TWO different timeout fields** with different purposes:

| Field                  | Purpose                                                                 | Used By           |
|------------------------|-------------------------------------------------------------------------|-------------------|
| `silenceTimeout`       | User speech end detection - how long to wait for user silence before triggering `speech_end` | Azure STT         |
| `silencePromptTimeout` | AI silence prompt timeout - how long to wait before AI sends "please continue" prompt       | Frontend timer    |

**Key Difference:**
- `silenceTimeout` (10s) → Azure STT → Detects when user has stopped speaking
- `silencePromptTimeout` (25s) → Frontend → Timer visible to user, triggers AI prompt

---

## 3. Current Implementation Analysis

### 3.1 Database Schema (✅ Correct)

```sql
-- packages/database/prisma/schema.prisma (Line 136)
silencePromptTimeout Int? @map("silence_prompt_timeout") // AI会話促し待機時間（秒、null = use org default）
```

### 3.2 Backend API (✅ Correct)

**GET /api/v1/scenarios/{id}** - Returns `silencePromptTimeout`:
```typescript
// infrastructure/lambda/scenarios/get/index.ts (Lines 28-49)
const scenario = await prisma.scenario.findUnique({
  where: { id: scenarioId },
  select: {
    id: true,
    title: true,
    // ...
    silencePromptTimeout: true,  // ✅ Correctly selected
    silenceTimeout: true,        // Also selected (for Azure STT)
  },
});
```

**GET /api/v1/organizations/settings** - Returns `silencePromptTimeout`:
```typescript
// infrastructure/lambda/organizations/settings/index.ts
// Includes silencePromptTimeout in organization settings
```

### 3.3 Frontend - SessionPlayer (❌ BUG FOUND)

**Location**: `apps/web/components/session-player/index.tsx` (Lines 921-932)

**Current Code (INCORRECT)**:
```typescript
const effectiveSilenceTimeout =
  scenario.silenceTimeout ?? orgSettings?.silenceTimeout ?? DEFAULT_ORG_SETTINGS.silenceTimeout;
  //      ^^^^^^^^^^^^^^^ WRONG FIELD!

// Silence Timer統合
const { elapsedTime: silenceElapsedTime, resetTimer: _resetSilenceTimer } = useSilenceTimer({
  enabled: status === 'ACTIVE' && initialGreetingCompleted && effectiveEnableSilencePrompt,
  timeoutSeconds: effectiveSilenceTimeout,  // Using wrong timeout!
  isAIPlaying: isPlayingAudio,
  isUserSpeaking: isMicRecording,
  isProcessing: isProcessing,
  onTimeout: handleSilenceTimeout,
});
```

**Should Be (CORRECT)**:
```typescript
const effectiveSilencePromptTimeout =
  scenario.silencePromptTimeout ?? orgSettings?.silencePromptTimeout ?? DEFAULT_ORG_SETTINGS.silencePromptTimeout;
  //      ^^^^^^^^^^^^^^^^^^^^^ CORRECT FIELD!

// Silence Timer統合
const { elapsedTime: silenceElapsedTime, resetTimer: _resetSilenceTimer } = useSilenceTimer({
  enabled: status === 'ACTIVE' && initialGreetingCompleted && effectiveEnableSilencePrompt,
  timeoutSeconds: effectiveSilencePromptTimeout,  // Use correct timeout!
  isAIPlaying: isPlayingAudio,
  isUserSpeaking: isMicRecording,
  isProcessing: isProcessing,
  onTimeout: handleSilenceTimeout,
});
```

### 3.4 Frontend - useWebSocket Hook (❌ BUG FOUND)

**Location**: `apps/web/hooks/useWebSocket.ts` (Lines 35-42, 632-641)

**Current Interface (INCORRECT)**:
```typescript
interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  initialGreeting?: string;
  silenceTimeout?: number;           // WRONG - This is for Azure STT
  enableSilencePrompt?: boolean;
  silenceThreshold?: number;
  minSilenceDuration?: number;
  // ... handlers
}
```

**Current Usage (INCORRECT)**:
```typescript
// apps/web/components/session-player/index.tsx (Lines 632-641)
const { ... } = useWebSocket({
  sessionId: session.id,
  token: token || '',
  scenarioPrompt: (scenario.configJson as any)?.systemPrompt,
  scenarioLanguage: scenario.language,
  initialGreeting: scenario.initialGreeting,
  silenceTimeout: scenario.silenceTimeout,           // WRONG FIELD!
  enableSilencePrompt: scenario.enableSilencePrompt,
  silenceThreshold: scenario.silenceThreshold,
  minSilenceDuration: scenario.minSilenceDuration,
  // ...
});
```

**Should Be (CORRECT)**:
```typescript
interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  initialGreeting?: string;
  silenceTimeout?: number;           // Keep for Azure STT (user speech detection)
  silencePromptTimeout?: number;     // ADD: For AI silence prompt (frontend timer)
  enableSilencePrompt?: boolean;
  silenceThreshold?: number;
  minSilenceDuration?: number;
  // ... handlers
}

// Usage:
const { ... } = useWebSocket({
  sessionId: session.id,
  token: token || '',
  scenarioPrompt: (scenario.configJson as any)?.systemPrompt,
  scenarioLanguage: scenario.language,
  initialGreeting: scenario.initialGreeting,
  silenceTimeout: scenario.silenceTimeout,                      // For Azure STT
  silencePromptTimeout: effectiveSilencePromptTimeout,          // ADD: For frontend timer
  enableSilencePrompt: scenario.enableSilencePrompt,
  silenceThreshold: scenario.silenceThreshold,
  minSilenceDuration: scenario.minSilenceDuration,
  // ...
});
```

### 3.5 WebSocket Lambda - authenticate Handler (❌ BUG FOUND)

**Location**: `infrastructure/lambda/websocket/default/index.ts` (Lines 276-330)

**Current Code (INCOMPLETE)**:
```typescript
case 'authenticate':
  const sessionId = message.sessionId as string;

  // Get scenario data directly from authenticate message (sent from frontend)
  const scenarioLanguage = (message as any).scenarioLanguage || DEFAULT_SCENARIO_LANGUAGE;
  const scenarioPrompt = (message as any).scenarioPrompt as string | undefined;
  const initialGreeting = (message as any).initialGreeting as string | undefined;
  const silenceTimeout = (message as any).silenceTimeout as number | undefined;  // Only silenceTimeout
  const enableSilencePrompt = (message as any).enableSilencePrompt as boolean | undefined;
  const initialSilenceTimeout = (message as any).initialSilenceTimeout as number | undefined;

  console.log('[authenticate] Received scenario data:', {
    hasPrompt: !!scenarioPrompt,
    language: scenarioLanguage,
    hasInitialGreeting: !!initialGreeting,
    silenceTimeout,          // Only logs silenceTimeout
    enableSilencePrompt,
    initialSilenceTimeout,
  });
```

**Should Be (CORRECT)**:
```typescript
case 'authenticate':
  const sessionId = message.sessionId as string;

  // Get scenario data directly from authenticate message (sent from frontend)
  const scenarioLanguage = (message as any).scenarioLanguage || DEFAULT_SCENARIO_LANGUAGE;
  const scenarioPrompt = (message as any).scenarioPrompt as string | undefined;
  const initialGreeting = (message as any).initialGreeting as string | undefined;
  const silenceTimeout = (message as any).silenceTimeout as number | undefined;            // For Azure STT
  const silencePromptTimeout = (message as any).silencePromptTimeout as number | undefined; // ADD: For frontend timer
  const enableSilencePrompt = (message as any).enableSilencePrompt as boolean | undefined;
  const initialSilenceTimeout = (message as any).initialSilenceTimeout as number | undefined;

  console.log('[authenticate] Received scenario data:', {
    hasPrompt: !!scenarioPrompt,
    language: scenarioLanguage,
    hasInitialGreeting: !!initialGreeting,
    silenceTimeout,
    silencePromptTimeout,  // ADD: Log this field
    enableSilencePrompt,
    initialSilenceTimeout,
  });
```

**Store in DynamoDB**:
```typescript
await updateConnectionData(connectionId, {
  sessionId,
  conversationHistory: initialConversationHistory,
  scenarioLanguage,
  scenarioPrompt,
  initialGreeting,
  silenceTimeout,             // For Azure STT
  silencePromptTimeout,       // ADD: For frontend timer
  enableSilencePrompt,
  initialSilenceTimeout,
});
```

**Send in authenticated response**:
```typescript
await sendToConnection(connectionId, {
  type: 'authenticated',
  message: 'Session initialized',
  sessionId,
  initialGreeting,
  silenceTimeout,
  silencePromptTimeout,  // ADD: Send back to client
  enableSilencePrompt,
  initialSilenceTimeout,
});
```

### 3.6 WebSocket ConnectionData Interface (❌ BUG FOUND)

**Location**: `infrastructure/lambda/websocket/default/index.ts` (Lines 213-244)

**Current Interface (INCOMPLETE)**:
```typescript
interface ConnectionData {
  connectionId: string;
  sessionId?: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;

  // Session Settings (from organization settings)
  silenceTimeout?: number; // Silence timeout in seconds (user speech end detection)
  enableSilencePrompt?: boolean; // Enable AI silence prompt
  initialSilenceTimeout?: number; // Azure STT initial silence timeout in milliseconds

  // Missing: silencePromptTimeout

  // Video processing (Phase 2)
  videoChunksCount?: number;
  lastVideoChunkTime?: number;
  // ...
}
```

**Should Be (CORRECT)**:
```typescript
interface ConnectionData {
  connectionId: string;
  sessionId?: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;

  // Session Settings (from organization settings)
  silenceTimeout?: number;             // For Azure STT (user speech end detection)
  silencePromptTimeout?: number;       // ADD: For AI silence prompt (frontend timer)
  enableSilencePrompt?: boolean;
  initialSilenceTimeout?: number;

  // Video processing (Phase 2)
  videoChunksCount?: number;
  lastVideoChunkTime?: number;
  // ...
}
```

---

## 4. Root Cause Analysis

**Timeline of the Bug:**

1. **2026-03-15 08:45 (Day 16)**: Added `silencePromptTimeout` field to database schema
   - Migration created: `20260315084516_add_silence_prompt_timeout/migration.sql`
   - Prisma schema updated with correct field

2. **2026-03-15 (Day 16)**: Updated backend APIs to select/update `silencePromptTimeout`
   - ✅ GET /api/v1/scenarios/{id} - Returns `silencePromptTimeout`
   - ✅ PUT /api/v1/scenarios/{id} - Updates `silencePromptTimeout`
   - ✅ POST /api/v1/scenarios - Creates with `silencePromptTimeout`
   - ✅ GET /api/v1/organizations/settings - Returns `silencePromptTimeout`
   - ✅ PUT /api/v1/organizations/settings - Updates `silencePromptTimeout`
   - ✅ PATCH /api/v1/organizations/settings - Updates `silencePromptTimeout`

3. **2026-03-15 (Day 16)**: Frontend was NOT updated to use new field
   - ❌ SessionPlayer still uses `scenario.silenceTimeout`
   - ❌ useWebSocket still sends `silenceTimeout` (not `silencePromptTimeout`)
   - ❌ WebSocket Lambda doesn't handle `silencePromptTimeout`

**Root Cause**: Incomplete feature implementation
- Backend changes were completed (database, API)
- Frontend changes were NOT completed (SessionPlayer, useWebSocket, WebSocket Lambda)
- This is a classic example of "partial implementation" causing bugs

---

## 5. Required Fixes

### Fix 1: SessionPlayer - Use silencePromptTimeout instead of silenceTimeout

**File**: `apps/web/components/session-player/index.tsx`

**Change**:
```diff
- const effectiveSilenceTimeout =
-   scenario.silenceTimeout ?? orgSettings?.silenceTimeout ?? DEFAULT_ORG_SETTINGS.silenceTimeout;
+ const effectiveSilencePromptTimeout =
+   scenario.silencePromptTimeout ?? orgSettings?.silencePromptTimeout ?? DEFAULT_ORG_SETTINGS.silencePromptTimeout;

  const { elapsedTime: silenceElapsedTime, resetTimer: _resetSilenceTimer } = useSilenceTimer({
    enabled: status === 'ACTIVE' && initialGreetingCompleted && effectiveEnableSilencePrompt,
-   timeoutSeconds: effectiveSilenceTimeout,
+   timeoutSeconds: effectiveSilencePromptTimeout,
    isAIPlaying: isPlayingAudio,
    isUserSpeaking: isMicRecording,
    isProcessing: isProcessing,
    onTimeout: handleSilenceTimeout,
  });
```

**Also update WebSocket call**:
```diff
  const { ... } = useWebSocket({
    sessionId: session.id,
    token: token || '',
    scenarioPrompt: (scenario.configJson as any)?.systemPrompt,
    scenarioLanguage: scenario.language,
    initialGreeting: scenario.initialGreeting,
    silenceTimeout: scenario.silenceTimeout,
+   silencePromptTimeout: effectiveSilencePromptTimeout,
    enableSilencePrompt: scenario.enableSilencePrompt,
    silenceThreshold: scenario.silenceThreshold,
    minSilenceDuration: scenario.minSilenceDuration,
    // ...
  });
```

### Fix 2: useWebSocket - Add silencePromptTimeout to interface

**File**: `apps/web/hooks/useWebSocket.ts`

**Change 1 - Interface**:
```diff
  interface UseWebSocketOptions {
    sessionId: string;
    token: string;
    scenarioPrompt?: string;
    scenarioLanguage?: string;
    initialGreeting?: string;
    silenceTimeout?: number;           // Silence timeout in seconds from scenario
+   silencePromptTimeout?: number;     // AI silence prompt timeout (for frontend timer)
    enableSilencePrompt?: boolean;
    silenceThreshold?: number;
    minSilenceDuration?: number;
    // ... handlers
  }
```

**Change 2 - Extract from options**:
```diff
  export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
    const {
      sessionId,
      token,
      scenarioPrompt,
      scenarioLanguage,
      initialGreeting,
      silenceTimeout,
+     silencePromptTimeout,
      enableSilencePrompt,
      silenceThreshold,
      minSilenceDuration,
      // ...
    } = options;
```

**Change 3 - Send in authenticate message**:
```diff
  const authenticateMsg: AuthenticateMessage = {
    type: 'authenticate',
    sessionId: sessionId,
    scenarioPrompt,
    scenarioLanguage,
    initialGreeting,
    silenceTimeout,
+   silencePromptTimeout,
    enableSilencePrompt,
    silenceThreshold,
    minSilenceDuration,
    timestamp: Date.now(),
  };
```

### Fix 3: WebSocket Lambda - Handle silencePromptTimeout

**File**: `infrastructure/lambda/websocket/default/index.ts`

**Change 1 - Extract from message**:
```diff
  case 'authenticate':
    const sessionId = message.sessionId as string;

    const scenarioLanguage = (message as any).scenarioLanguage || DEFAULT_SCENARIO_LANGUAGE;
    const scenarioPrompt = (message as any).scenarioPrompt as string | undefined;
    const initialGreeting = (message as any).initialGreeting as string | undefined;
    const silenceTimeout = (message as any).silenceTimeout as number | undefined;
+   const silencePromptTimeout = (message as any).silencePromptTimeout as number | undefined;
    const enableSilencePrompt = (message as any).enableSilencePrompt as boolean | undefined;
    const initialSilenceTimeout = (message as any).initialSilenceTimeout as number | undefined;

    console.log('[authenticate] Received scenario data:', {
      hasPrompt: !!scenarioPrompt,
      language: scenarioLanguage,
      hasInitialGreeting: !!initialGreeting,
      silenceTimeout,
+     silencePromptTimeout,
      enableSilencePrompt,
      initialSilenceTimeout,
    });
```

**Change 2 - Store in DynamoDB**:
```diff
  await updateConnectionData(connectionId, {
    sessionId,
    conversationHistory: initialConversationHistory,
    scenarioLanguage,
    scenarioPrompt,
    initialGreeting,
    silenceTimeout,
+   silencePromptTimeout,
    enableSilencePrompt,
    initialSilenceTimeout,
  });
```

**Change 3 - Send in response**:
```diff
  await sendToConnection(connectionId, {
    type: 'authenticated',
    message: 'Session initialized',
    sessionId,
    initialGreeting,
    silenceTimeout,
+   silencePromptTimeout,
    enableSilencePrompt,
    initialSilenceTimeout,
  });
```

**Change 4 - Update ConnectionData interface**:
```diff
  interface ConnectionData {
    connectionId: string;
    sessionId?: string;
    scenarioPrompt?: string;
    scenarioLanguage?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;

    // Session Settings (from organization settings)
    silenceTimeout?: number;
+   silencePromptTimeout?: number;       // AI silence prompt timeout (frontend timer)
    enableSilencePrompt?: boolean;
    initialSilenceTimeout?: number;

    // ...
  }
```

### Fix 4: Shared Types - Add silencePromptTimeout to AuthenticateMessage

**File**: `packages/shared/src/types/index.ts`

**Change**:
```diff
  export interface AuthenticateMessage {
    type: 'authenticate';
    sessionId: string;
    scenarioPrompt?: string;
    scenarioLanguage?: string;
    initialGreeting?: string;
    silenceTimeout?: number;
+   silencePromptTimeout?: number;
    enableSilencePrompt?: boolean;
    silenceThreshold?: number;
    minSilenceDuration?: number;
    timestamp: number;
  }
```

---

## 6. Verification Plan

After implementing all fixes:

1. **Deploy Lambda functions**:
   ```bash
   pnpm run deploy:websocket
   ```

2. **Restart Next.js dev server**:
   ```bash
   pkill -f "next dev"
   pnpm run dev
   ```

3. **Test hierarchical fallback**:
   - Test Scenario: `6f7f02c2-624e-41a2-b7ba-c0bc683584e5` (silencePromptTimeout: null)
   - Organization: silencePromptTimeout: 25 seconds
   - **Expected**: Timer should use 25 seconds

4. **Check CloudWatch logs**:
   ```bash
   aws logs tail /aws/lambda/prance-websocket-default-dev --follow --filter-pattern "[authenticate]"
   ```

   Should see:
   ```
   [authenticate] Received scenario data: {
     silencePromptTimeout: 25,  // ← Should show 25 (from organization)
     enableSilencePrompt: false
   }
   ```

5. **Test UI**:
   - Start session
   - Verify timer displays 25 seconds
   - Wait for timeout (if enabled)
   - Verify AI prompt fires at 25 seconds

---

## 7. Summary

**Problem**: Frontend was using `silenceTimeout` instead of `silencePromptTimeout` for the silence timer, breaking the hierarchical fallback logic.

**Root Cause**: Incomplete feature implementation - backend was updated but frontend was not.

**Impact**:
- Scenario `silencePromptTimeout: null` was NOT falling back to organization setting
- Timer was using `silenceTimeout` (10s) instead of `silencePromptTimeout` (25s)
- Hierarchical fallback completely broken for this feature

**Fix Required**: Update 4 files to properly handle `silencePromptTimeout`:
1. SessionPlayer.tsx - Use correct field for timer
2. useWebSocket.ts - Send correct field in authenticate message
3. WebSocket Lambda - Handle correct field in authenticate handler
4. Shared types - Add field to AuthenticateMessage interface

**Lessons Learned**:
- When adding new fields, must update ENTIRE data flow (DB → API → Frontend → WebSocket → Lambda)
- Partial implementation is worse than no implementation
- Always verify end-to-end integration, not just backend API changes
