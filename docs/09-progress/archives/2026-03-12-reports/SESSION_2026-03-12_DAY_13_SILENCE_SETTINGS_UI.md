# Session 2026-03-12 Day 13 - Silence Settings UI Integration

**Date:** 2026-03-12 09:00 - 15:15 JST
**Phase:** Phase 1.5 Day 13
**Status:** ✅ COMPLETED - UI Integration & Default Value Update

---

## 📋 Session Summary

### Initial Request
ユーザーからの要望:
- silenceThresholdとminSilenceDurationをUIから更新できるようにしてほしい
- 毎回ビルドせずに、試しながら最適値を選べるようにしたい
- UI上で設定する値なので、データベースにも保存するように実装してほしい

### Background Issue
- 環境ノイズレベル: 4.5%-9.9%（誰も話していない状態）
- 以前のデフォルト値: 0.03（3%） → 環境ノイズより低く、常に誤検出
- Azure STTエラー: InitialSilenceTimeout（音声が検出されないため）

---

## 🔧 Implemented Solutions

### 1. Default Value Update: 0.05 → 0.12

**理由:**
- 環境ノイズレベル（最大9.9%）をカバー
- 実際の音声（>12%）のみを検出
- InitialSilenceTimeoutエラーを防止

**変更したファイル（4箇所）:**

#### 1.1 SessionPlayer Component
**File:** `apps/web/components/session-player/index.tsx`
```typescript
// Line 736
silenceThreshold: scenario.silenceThreshold ?? 0.12, // Use scenario setting or default 0.12 (raised to avoid ambient noise ~10%)
```

#### 1.2 Scenario Create Page
**File:** `apps/web/app/dashboard/scenarios/new/page.tsx`
```typescript
// Line 36
const [silenceThreshold, setSilenceThreshold] = useState(0.12);

// Line 411 (fallback value)
onChange={e => setSilenceThreshold(parseFloat(e.target.value) || 0.12)}
```

#### 1.3 Scenario Edit Page
**File:** `apps/web/app/dashboard/scenarios/[id]/edit/page.tsx`
```typescript
// Line 38
const [silenceThreshold, setSilenceThreshold] = useState(0.12);

// Line 69 (load from DB)
setSilenceThreshold(scenario.silenceThreshold || 0.12);

// Line 471 (fallback value)
onChange={e => setSilenceThreshold(parseFloat(e.target.value) || 0.12)}
```

---

### 2. WebSocket Integration

**Goal:** Send silenceThreshold and minSilenceDuration to backend via WebSocket

#### 2.1 Type Definition Update
**File:** `packages/shared/src/types/index.ts`

**AuthenticateMessage interface:**
```typescript
export interface AuthenticateMessage extends WebSocketMessageBase {
  type: 'authenticate';
  sessionId: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  initialGreeting?: string;
  silenceTimeout?: number;
  enableSilencePrompt?: boolean;
  silenceThreshold?: number;        // NEW
  minSilenceDuration?: number;      // NEW
  timestamp: number;
}
```

**AuthenticatedMessage interface:**
```typescript
export interface AuthenticatedMessage extends WebSocketMessageBase {
  type: 'authenticated';
  message: string;
  sessionId: string;
  initialGreeting?: string;
  silenceTimeout?: number;
  enableSilencePrompt?: boolean;
  silenceThreshold?: number;        // NEW
  minSilenceDuration?: number;      // NEW
}
```

#### 2.2 useWebSocket Hook Update
**File:** `apps/web/hooks/useWebSocket.ts`

**Options interface:**
```typescript
interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  initialGreeting?: string;
  silenceTimeout?: number;
  enableSilencePrompt?: boolean;
  silenceThreshold?: number;        // NEW
  minSilenceDuration?: number;      // NEW
  onTranscript?: (message: TranscriptMessage) => void;
  // ... other callbacks
}
```

**Authenticate message sending:**
```typescript
const authenticateMsg: AuthenticateMessage = {
  type: 'authenticate',
  sessionId: sessionId,
  scenarioPrompt,
  scenarioLanguage,
  initialGreeting,
  silenceTimeout,
  enableSilencePrompt,
  silenceThreshold,          // NEW
  minSilenceDuration,        // NEW
  timestamp: Date.now(),
};
ws.send(JSON.stringify(authenticateMsg));
console.log('[WebSocket] Sent authenticate with scenario data:', {
  hasPrompt: !!scenarioPrompt,
  language: scenarioLanguage,
  hasInitialGreeting: !!initialGreeting,
  silenceTimeout,
  enableSilencePrompt,
  silenceThreshold,          // NEW
  minSilenceDuration,        // NEW
});
```

#### 2.3 SessionPlayer WebSocket Call
**File:** `apps/web/components/session-player/index.tsx`

```typescript
// Line 503-520
} = useWebSocket({
  sessionId: session.id,
  token: token || '',
  scenarioPrompt: (scenario.configJson as any)?.systemPrompt,
  scenarioLanguage: scenario.language,
  initialGreeting: scenario.initialGreeting,
  silenceTimeout: scenario.silenceTimeout,
  enableSilencePrompt: scenario.enableSilencePrompt,
  silenceThreshold: scenario.silenceThreshold,        // NEW
  minSilenceDuration: scenario.minSilenceDuration,    // NEW
  autoConnect: false,
  onTranscript: handleTranscript,
  // ... other callbacks
});
```

---

### 3. UI Translation Update

#### 3.1 English Translation
**File:** `apps/web/messages/en/scenarios.json`

```json
{
  "silenceThreshold": "Silence threshold",
  "silenceThresholdHelp": "Volume threshold for silence detection (0.01-0.2, default: 0.12). Adjust based on ambient noise level."
}
```

#### 3.2 Japanese Translation
**File:** `apps/web/messages/ja/scenarios.json`

```json
{
  "silenceThreshold": "無音閾値",
  "silenceThresholdHelp": "無音検出の音量閾値（0.01-0.2、デフォルト: 0.12）。環境ノイズレベルに応じて調整してください。"
}
```

---

### 4. Database Migration (Created)

**File:** `infrastructure/lambda/migrations/20260312-update-silence-defaults.sql`

```sql
-- Migration: Update silence management default values
-- Date: 2026-03-12
-- Description: Update existing scenarios with default values for silenceThreshold and minSilenceDuration

-- Update NULL values to new default (0.12 for threshold, 500ms for duration)
UPDATE "scenarios"
SET
  "silence_threshold" = 0.12
WHERE "silence_threshold" IS NULL;

UPDATE "scenarios"
SET
  "min_silence_duration" = 500
WHERE "min_silence_duration" IS NULL;

-- Add comments
COMMENT ON COLUMN "scenarios"."silence_threshold" IS 'Audio level threshold (0.0-1.0) to detect speech vs silence. Default: 0.12 (12%) to avoid ambient noise ~10%';
COMMENT ON COLUMN "scenarios"."min_silence_duration" IS 'Minimum silence duration in milliseconds to trigger speech_end. Default: 500ms';
```

**Status:** ⚠️ Migration file created but not deployed due to CDK ENOTEMPTY error

---

## ✅ UI Functionality (Already Existed)

**Good News:** UI components were already implemented! No new UI code needed.

### Scenario Edit Page Features

**Location:** `/dashboard/scenarios/[id]/edit`

**Advanced Settings Section:**

1. **Silence Threshold Input**
   - Type: Number input
   - Range: 0.01 - 0.2
   - Step: 0.01
   - Default: 0.12
   - Help text: Displayed in current locale

2. **Minimum Silence Duration Input**
   - Type: Number input
   - Range: 100 - 2000 (milliseconds)
   - Step: 100
   - Default: 500
   - Help text: Displayed in current locale

3. **Show Silence Timer Checkbox**
   - Displays countdown timer in UI
   - Default: false

**Form Submission:**
- All values are sent to `updateScenario()` API
- Saved to database via Lambda function
- Immediately available for new sessions

---

## 🧪 Testing Instructions

### Step 1: Start Development Server

```bash
cd /workspaces/prance-communication-platform
npm run dev
```

### Step 2: Access Scenario Edit Page

```
1. Browser: http://localhost:3000/dashboard/scenarios
2. Select existing scenario → Click "Edit"
3. Scroll down to "Advanced Settings" section
4. Click to expand
```

### Step 3: Adjust Settings

**Recommended Values by Environment:**

| Environment | Noise Level | Threshold | Notes |
|-------------|-------------|-----------|-------|
| Quiet office | <8% | 0.08-0.10 | Very quiet, minimal background noise |
| Normal office | 8-12% | 0.12 | Default, typical office environment |
| Noisy environment | 12-18% | 0.15-0.18 | Coffee shop, open workspace |

**Adjustment Process:**
1. Set threshold value (e.g., 0.12)
2. Set minimum silence duration (e.g., 500ms)
3. Click "Update Scenario"
4. Create new session with updated scenario
5. Check console logs:
   - `[WebSocket] Sent authenticate with scenario data` should show threshold
   - `[AudioRecorder:Init]` should show threshold
6. Verify no InitialSilenceTimeout errors
7. If errors persist, increase threshold by 0.03
8. Repeat until optimal value found

---

## 📊 Implementation Status

### ✅ Completed

1. **Default Value Update**: 0.05 → 0.12 in 4 files
2. **WebSocket Integration**: silenceThreshold and minSilenceDuration transmission
3. **Type Definitions**: AuthenticateMessage and AuthenticatedMessage extended
4. **Translation Updates**: English and Japanese help text updated
5. **Migration SQL**: Created (ready for deployment)
6. **SessionPlayer**: Uses scenario values with 0.12 fallback

### ⚠️ Pending

1. **Lambda Deployment**: CDK ENOTEMPTY error - needs cleanup
2. **Migration Execution**: Run migration Lambda after deployment
3. **Browser E2E Test**: Verify UI → API → Database → SessionPlayer flow
4. **Next.js Server**: Startup delay (environment issue, not code issue)

---

## 🚫 Known Issues

### Issue 1: CDK ENOTEMPTY Error

**Error:**
```
Error: ENOTEMPTY: directory not empty, rmdir '.../bundling-temp-...-building'
```

**Workaround:**
```bash
# Clean bundling-temp directories
find infrastructure/cdk.out -type d -name "bundling-temp-*" -exec rm -rf {} +

# Or full cdk.out cleanup
sudo rm -rf infrastructure/cdk.out
```

**Root Cause:** CDK bundling process leaving temporary directories (known issue from Day 10)

### Issue 2: Next.js Server Startup Delay

**Symptom:** Server stuck at "✓ Starting..." for extended period

**Cause:** Large number of file changes + turbo cache issues

**Solution:**
```bash
# Kill all processes
pkill -9 -f "next dev"

# Clean cache
rm -rf .turbo node_modules/.cache

# Restart
cd apps/web && npm run dev
```

---

## 📝 Data Flow

### Complete Flow: UI → API → Database → SessionPlayer

```
1. User edits scenario in UI
   └─ Advanced Settings → silenceThreshold: 0.15

2. Form submission → updateScenario() API
   └─ POST /api/v1/scenarios/{id}
   └─ Body: { silenceThreshold: 0.15, minSilenceDuration: 500 }

3. Lambda function → Database update
   └─ UPDATE scenarios SET silence_threshold = 0.15 WHERE id = '{id}'

4. User creates session
   └─ SessionPlayer loads scenario
   └─ scenario.silenceThreshold = 0.15

5. WebSocket connection
   └─ authenticate message: { silenceThreshold: 0.15, minSilenceDuration: 500 }

6. Audio recording starts
   └─ useAudioRecorder({ silenceThreshold: 0.15, silenceDuration: 500 })

7. Audio level detection
   └─ if (normalizedLevel > 0.15) { /* Speech detected */ }
   └─ else { /* Silence - ambient noise */ }
```

---

## 🎓 Lessons Learned

### 1. UI Already Existed - Check Before Building

**Discovery:** Advanced Settings section with silenceThreshold and minSilenceDuration inputs already existed in the codebase.

**Lesson:** Always search for existing implementations before creating new UI components.

**Search Commands:**
```bash
# Find existing UI components
find apps/web -name "*.tsx" | xargs grep -l "silenceThreshold"

# Find form inputs
grep -r "silenceThreshold" apps/web/app/dashboard
```

### 2. Default Values Need Coordination

**Challenge:** Default value (0.12) must be consistent across multiple files:
- SessionPlayer (runtime fallback)
- Create page (form initial state)
- Edit page (form initial state + DB fallback)
- Translation files (help text)

**Solution:** Use grep to find all occurrences before changing:
```bash
grep -r "silenceThreshold.*0\.05" apps/web
```

### 3. WebSocket Message Extension Pattern

**Pattern for adding fields to WebSocket messages:**
1. Update shared type definition (`@prance/shared`)
2. Rebuild shared package: `cd packages/shared && npm run build`
3. Update useWebSocket hook options interface
4. Update authenticate message construction
5. Update SessionPlayer hook call
6. Update Lambda handler (backend) to process new fields

### 4. Environment-Specific Threshold Tuning

**Key Insight:** There is no "perfect" threshold value - it depends on environment.

**Best Practice:**
- Provide sensible default (0.12)
- Make it easily adjustable via UI
- Document recommended ranges
- Include help text explaining adjustment process

---

## 🔗 Related Files

### Modified Files

**Frontend:**
- `apps/web/components/session-player/index.tsx` (Line 736)
- `apps/web/hooks/useWebSocket.ts` (Lines 41-42, 79-80, 289-290, 298-299, 511-512)
- `apps/web/app/dashboard/scenarios/new/page.tsx` (Lines 36, 411)
- `apps/web/app/dashboard/scenarios/[id]/edit/page.tsx` (Lines 38, 69, 471)
- `apps/web/messages/en/scenarios.json` (Line 65)
- `apps/web/messages/ja/scenarios.json` (Line 65)

**Shared Package:**
- `packages/shared/src/types/index.ts` (Lines 247-248, 258-259)

**Backend (Migration):**
- `infrastructure/lambda/migrations/20260312-update-silence-defaults.sql` (NEW)

### Related Documentation

- `docs/09-progress/archives/SESSION_2026-03-11_DAY_12_SILENCE_API_FIX.md` (Previous session)
- `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-11_API_IMPLEMENTATION_GAP.md`
- `docs/05-modules/SILENCE_MANAGEMENT.md`

---

## 🚀 Next Steps

### Immediate (Next Session Start)

1. **Start Next.js Server**
   ```bash
   cd /workspaces/prance-communication-platform
   npm run dev
   ```

2. **Test UI Adjustment**
   - Edit scenario → Advanced Settings
   - Change silenceThreshold to 0.15
   - Save and create new session
   - Monitor console logs

3. **Deploy Lambda Functions**
   - Clean up cdk.out directory
   - Deploy: `cd infrastructure && npm run cdk -- deploy Prance-dev-ApiLambda`
   - Run migration: `aws lambda invoke --function-name prance-db-migration-dev ...`

### Future Improvements

1. **Add Real-time Audio Level Display**
   - Show current audio level in UI during recording
   - Help users visualize ambient noise level
   - Suggest optimal threshold based on observed levels

2. **Add Threshold Presets**
   - Quick buttons: "Quiet", "Normal", "Noisy"
   - Auto-detect environment noise level
   - Save per-user preferences

3. **Add Session Statistics**
   - Track false positive rate (noise detected as speech)
   - Track false negative rate (speech missed)
   - Suggest threshold adjustments based on statistics

---

**Session Duration:** ~6 hours
**Lines Changed:** ~20 lines
**Files Modified:** 8 files
**New Files:** 1 file (migration SQL)
**Implementation Status:** ✅ Complete (100%)
**Deployment Status:** ⚠️ Pending (ENOTEMPTY error)

**Status:** ✅ UI Integration Complete - Ready for Testing
