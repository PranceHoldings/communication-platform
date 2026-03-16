# Session Player State Machine - Comprehensive Verification Plan

**作成日:** 2026-03-16
**目的:** セッションプレイヤーの状態遷移・イベントタイミング・UI反映の完全検証
**スコープ:** apps/web/components/session-player/index.tsx および関連フック

---

## 1. State Machine Diagram

### 1.1 Session Status States

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Status Flow                       │
└─────────────────────────────────────────────────────────────┘

IDLE (初期状態)
  │
  ├─ユーザーが "Start Session" クリック
  │
  ▼
CONNECTING (WebSocket接続中)
  │
  ├─WebSocket接続成功
  │
  ▼
READY (準備完了、初回挨拶待ち)
  │
  ├─初回AI挨拶完了 (initialGreetingCompleted = true)
  │
  ▼
ACTIVE (会話進行中)
  │
  ├─ユーザーが "Stop" クリック
  │ または
  ├─エラー発生
  │
  ▼
COMPLETED (セッション終了)
```

### 1.2 Internal State Flags

```
┌─────────────────────────────────────────────────────────────┐
│               Internal State Flags (boolean)                 │
└─────────────────────────────────────────────────────────────┘

isMicRecording          # マイク録音中（常にtrue during ACTIVE/READY）
isUserSpeaking          # ユーザー発話検出中（音声レベルベース）
isProcessing            # 処理中（STT/AI/TTS）
isPlayingAudio          # AI音声再生中
initialGreetingCompleted # 初回挨拶完了フラグ
pendingSessionEnd       # セッション終了待機中
silenceTimerEnabled     # 沈黙タイマー有効
```

### 1.3 Processing Stage States

```
┌─────────────────────────────────────────────────────────────┐
│            Processing Stage (processingStage)                │
└─────────────────────────────────────────────────────────────┘

'idle'        # 処理なし
  │
  ├─ユーザー発話終了 (speech_end)
  │
  ▼
'stt'         # 音声文字起こし中 (Azure STT)
  │
  ├─文字起こし完了 (transcript受信)
  │
  ▼
'ai'          # AI応答生成中 (Bedrock Claude)
  │
  ├─AI応答完了 (audio_response受信)
  │
  ▼
'tts'         # 音声合成中 (ElevenLabs TTS)
  │
  ├─音声再生開始
  │
  ▼
'idle'        # 処理完了、次の発話待ち
```

---

## 2. Event Timeline Mapping

### 2.1 Normal Conversation Flow (正常フロー)

```
Time  Event                        State Changes                      UI Updates
────────────────────────────────────────────────────────────────────────────────
T0    User clicks "Start"          status: IDLE → CONNECTING         Button: "Start" → disabled
                                   wsStatus: 'connecting'            Status: "Connecting..."

T1    WebSocket connected          wsStatus: 'connected'             Status: "Connected"
                                   status: CONNECTING → READY

T2    Initial AI greeting starts   isPlayingAudio: false → true      Speaker: "Playing"
                                   isProcessing: true                Processing: "tts"
                                   processingStage: 'tts'

T3    Initial greeting playing     (no state change)                 Audio waveform animating
                                                                     Duration incrementing

T4    Initial greeting ends        isPlayingAudio: true → false      Speaker: "Inactive"
                                   initialGreetingCompleted: true
                                   status: READY → ACTIVE
                                   silenceTimerEnabled: true         Silence Timer: visible

T5    Silence timer starts         (after 1s grace period)           Silence Timer: 0s → 1s → 2s...
      (no blocking conditions)     graceCompleted: true

T10   10 seconds silence           silenceTimer triggers timeout     Prompt dialog appears
                                   → onTimeout callback

─── User Speech Cycle ────────────────────────────────────────────────────────

T15   User starts speaking         isUserSpeaking: false → true      Microphone: "Recording" (pulsing)
                                   silenceTimer: reset               Silence Timer: reset to 0s

T17   User speaking (continuous)   (no state change)                 Microphone: continues pulsing
                                                                     Audio level indicator active

T20   User stops speaking          isUserSpeaking: true → false      Microphone: still "Recording"
      (silence detected > 1200ms)

T21   speech_end signal sent       isProcessing: true                Processing: "Transcribing..."
                                   processingStage: 'stt'

T23   Transcript received          processingStage: 'stt' → 'ai'    Transcript: USER message added
                                                                     Processing: "Generating response..."

T25   AI response received         processingStage: 'ai' → 'tts'    Processing: "Synthesizing speech..."

T26   AI audio starts playing      isPlayingAudio: true              Speaker: "Playing"
                                   isProcessing: false               Microphone: "Recording"
                                   processingStage: 'idle'

T30   AI audio ends                isPlayingAudio: false             Speaker: "Inactive"
                                   silenceTimer: start (grace)       Silence Timer: starts counting

─── Manual Stop ──────────────────────────────────────────────────────────────

T50   User clicks "Stop"
      (while recording)

T50.1 speech_end sent              isProcessing: true                Processing: "Transcribing..."
                                   pendingSessionEnd: true           Button: "Stopping..."
                                   processingStage: 'stt'

T52   Transcript received          (pendingSessionEnd check)         Skip AI processing
                                   → Skip AI processing

T52.1 session_end sent             status: ACTIVE → COMPLETED        Status: "Completed"
                                   wsStatus: 'disconnected'          Button: "Session Ended"

─── Error Case ───────────────────────────────────────────────────────────────

T60   Error occurs                 status: any → COMPLETED           Error dialog appears
      (e.g., NO_AUDIO_DATA)        wsStatus: 'error'                 Status: "Error"
                                   isProcessing: false
```

### 2.2 Blocking Conditions Timeline

```
Condition              | T0  T2  T4  T15 T20 T26 T30 | Effect
─────────────────────────────────────────────────────────────────
isPlayingAudio         | ─   ███ ─   ─   ─   ███ ─   | Blocks silence timer
isUserSpeaking         | ─   ─   ─   ███ ─   ─   ─   | Blocks silence timer
isProcessing           | ─   ███ ─   ─   ███ ─   ─   | Blocks silence timer
isMicRecording         | ─   ███ ███ ███ ███ ███ ███ | (always true when READY/ACTIVE)
initialGreetingCompleted| ─  ─   ███ ███ ███ ███ ███ | Enables silence timer

Legend: ─ = false (not blocking), ███ = true (blocking)
```

---

## 3. Blocking Conditions Matrix

### 3.1 Silence Timer Blocking Conditions

| Condition              | Blocks Silence Timer? | Reason                                           |
| ---------------------- | --------------------- | ------------------------------------------------ |
| status !== 'ACTIVE'    | ✅ Yes                | Timer only active during conversation            |
| !initialGreetingCompleted | ✅ Yes             | Timer starts after initial AI greeting           |
| !effectiveEnableSilencePrompt | ✅ Yes         | Setting disabled                                 |
| isPlayingAudio         | ✅ Yes                | Don't timeout while AI is speaking               |
| isUserSpeaking         | ❌ No (always false)  | Speech detection handled by useAudioRecorder     |
| isMicRecording         | ❌ No (ignored)       | Microphone always recording (not speech indicator)|
| isProcessing           | ✅ Yes                | Don't timeout during STT/AI/TTS processing       |

**Critical Fix (2026-03-16):**
```typescript
// ❌ Before: 常にブロック（バグ）
isUserSpeaking: isMicRecording  // isMicRecording is always true

// ✅ After: 音声検出のみでブロック
isUserSpeaking: false  // useAudioRecorder が音声検出を管理
```

### 3.2 Audio Recording Blocking Conditions

| Condition           | Blocks Recording? | Reason                                   |
| ------------------- | ----------------- | ---------------------------------------- |
| status === 'IDLE'   | ✅ Yes            | Not connected yet                        |
| status === 'CONNECTING' | ✅ Yes        | WebSocket not ready                      |
| status === 'COMPLETED' | ✅ Yes         | Session ended                            |
| isPlayingAudio      | ❌ No             | Full-duplex: user can speak while AI plays |

### 3.3 Speech_end Signal Blocking Conditions

| Condition                    | Blocks speech_end? | Reason                              |
| ---------------------------- | ------------------ | ----------------------------------- |
| pendingSessionEnd === true   | ✅ Yes             | Already sent, waiting for processing |
| !wsStatus.connected          | ✅ Yes             | WebSocket disconnected              |
| Silence duration < threshold | ✅ Yes             | Not enough silence yet (1200ms)     |

---

## 4. UI State Mapping

### 4.1 Status Badge Color

| Internal Status | Display Text       | Badge Color | Icon       |
| --------------- | ------------------ | ----------- | ---------- |
| IDLE            | "Not Started"      | gray        | ⏸         |
| CONNECTING      | "Connecting..."    | yellow      | 🔄         |
| READY           | "Ready"            | green       | ✓          |
| ACTIVE          | "In Progress"      | blue        | ▶️         |
| COMPLETED       | "Completed"        | gray        | ✓          |

**Code Location:** `apps/web/components/session-player/index.tsx:1270-1290`

### 4.2 Audio Indicators

#### Microphone Status
```
State                        | Display      | Color  | Icon | Pulsing
───────────────────────────────────────────────────────────────────
!isMicRecording              | "Inactive"   | gray   | 🎤   | No
isMicRecording && !isUserSpeaking | "Recording" | red | 🎤   | No
isMicRecording && isUserSpeaking  | "Recording" | red | 🎤   | Yes
```

**Code Location:** `apps/web/components/session-player/index.tsx:1303-1318`

#### Speaker Status
```
State              | Display      | Color | Icon | Animating
─────────────────────────────────────────────────────────────
!isPlayingAudio    | "Inactive"   | gray  | 🔊   | No
isPlayingAudio     | "Playing"    | green | 🔊   | Yes (waveform)
```

**Code Location:** `apps/web/components/session-player/index.tsx:1320-1335`

#### Camera Status
```
State              | Display  | Color | Icon
────────────────────────────────────────────
!isCameraActive    | "Off"    | gray  | 📷
isCameraActive     | "On"     | green | 📷
```

**Code Location:** `apps/web/components/session-player/index.tsx:1337-1352`

### 4.3 Processing Stage Display

| processingStage | Display Text (English)       | Display Text (Japanese) | Icon |
| --------------- | ---------------------------- | ----------------------- | ---- |
| 'idle'          | (not shown)                  | (表示なし)               | -    |
| 'stt'           | "Transcribing speech..."     | "音声を文字起こし中..." | 🎤   |
| 'ai'            | "Generating AI response..."  | "AI応答を生成中..."     | 🤖   |
| 'tts'           | "Synthesizing speech..."     | "音声を合成中..."       | 🔊   |

**Code Location:** `apps/web/components/session-player/index.tsx:1354-1380`

### 4.4 Silence Timer Display

```
Condition                               | Visible | Display Format
──────────────────────────────────────────────────────────────────
!silenceTimerEnabled                    | No      | -
silenceTimerEnabled && !effectiveShowTimer | No   | -
silenceTimerEnabled && effectiveShowTimer  | Yes  | "Silence: Xs / 10s"
```

**Code Location:** `apps/web/components/session-player/index.tsx:1293-1301`

### 4.5 Action Buttons

| Status      | Primary Button | Secondary Button | Tertiary Button |
| ----------- | -------------- | ---------------- | --------------- |
| IDLE        | "Start Session" (enabled) | - | - |
| CONNECTING  | "Starting..." (disabled) | - | - |
| READY       | "Stop" (enabled, red) | - | - |
| ACTIVE      | "Stop" (enabled, red) | - | - |
| COMPLETED   | "Session Ended" (disabled) | "Back to List" (link) | - |

**Code Location:** `apps/web/components/session-player/index.tsx:1400-1430`

---

## 5. Test Cases

### 5.1 Normal Flow Test Cases

#### TC-NF-001: Initial Greeting and Silence Timer Start
**Precondition:** User logged in, scenario and avatar selected
**Steps:**
1. Click "Start Session"
2. Wait for WebSocket connection
3. Wait for initial AI greeting to complete
4. Observe silence timer

**Expected Results:**
- ✅ Status: IDLE → CONNECTING → READY → ACTIVE
- ✅ Initial greeting plays (Speaker: "Playing")
- ✅ After greeting ends: initialGreetingCompleted = true
- ✅ Silence timer becomes visible and starts counting (after 1s grace)
- ✅ Timer increments: 0s → 1s → 2s → ...

**Actual Results:** (to be filled during testing)

---

#### TC-NF-002: User Speech Detection and Processing
**Precondition:** Session ACTIVE, silence timer running
**Steps:**
1. Start speaking into microphone
2. Continue speaking for 3 seconds
3. Stop speaking
4. Wait for processing

**Expected Results:**
- ✅ When speech starts: isUserSpeaking = true, Microphone pulsing red
- ✅ Silence timer resets to 0s and stops
- ✅ When speech ends (1200ms silence): speech_end signal sent
- ✅ Processing stages: 'idle' → 'stt' → 'ai' → 'tts' → 'idle'
- ✅ Transcript appears with USER speaker
- ✅ AI response appears with ASSISTANT speaker
- ✅ AI audio plays (Speaker: "Playing")

**Actual Results:** (to be filled during testing)

---

#### TC-NF-003: Silence Prompt after 10 Seconds
**Precondition:** Session ACTIVE, no speech for 9 seconds
**Steps:**
1. Wait for silence timer to reach 10 seconds
2. Observe prompt dialog

**Expected Results:**
- ✅ At 10 seconds: silence timeout callback triggered
- ✅ Prompt dialog appears (if configured)
- ✅ Timer resets after prompt

**Actual Results:** (to be filled during testing)

---

#### TC-NF-004: Full-Duplex: User Speaks While AI Playing
**Precondition:** AI is playing audio
**Steps:**
1. While AI audio is playing, start speaking
2. Stop speaking after 2 seconds
3. Wait for AI audio to finish

**Expected Results:**
- ✅ User speech is recorded (Microphone: "Recording")
- ✅ Silence timer does NOT start (blocked by isPlayingAudio)
- ✅ After AI finishes: user's speech is processed normally
- ✅ No interference between AI playback and user recording

**Actual Results:** (to be filled during testing)

---

### 5.2 Error Handling Test Cases

#### TC-EH-001: NO_AUDIO_DATA Error
**Precondition:** Session ACTIVE
**Steps:**
1. Send very quiet audio (below threshold)
2. Stop speaking (trigger speech_end)
3. Wait for STT processing

**Expected Results:**
- ✅ Error message received: "NO_AUDIO_DATA"
- ✅ Error dialog appears with user-friendly message
- ✅ Low volume warning displayed (Italian translation available)
- ✅ Tips shown: speak louder, move closer, check settings
- ✅ Session does NOT end (user can try again)

**Actual Results:** (to be filled during testing)

---

#### TC-EH-002: WebSocket Connection Error
**Precondition:** Invalid WebSocket URL or network failure
**Steps:**
1. Start session with broken WebSocket endpoint
2. Observe error handling

**Expected Results:**
- ✅ Status: CONNECTING → error state
- ✅ Error message: "Connection failed"
- ✅ Retry button available
- ✅ Maximum retry attempts enforced (3 times)

**Actual Results:** (to be filled during testing)

---

#### TC-EH-003: AI Response Timeout
**Precondition:** AI service slow or unavailable
**Steps:**
1. Speak and trigger AI processing
2. Simulate slow AI response (> 30 seconds)

**Expected Results:**
- ✅ Processing stage shows "Generating AI response..." for extended time
- ✅ Timeout error after 30 seconds
- ✅ User-friendly error message
- ✅ Session recovers (can try again)

**Actual Results:** (to be filled during testing)

---

### 5.3 Edge Cases Test Cases

#### TC-EC-001: Manual Stop During Recording
**Precondition:** User is speaking (audio recording active)
**Steps:**
1. Start speaking
2. While speaking, click "Stop" button
3. Observe behavior

**Expected Results:**
- ✅ speech_end signal sent immediately
- ✅ pendingSessionEnd flag set to true
- ✅ Audio sent to STT for transcription
- ✅ After transcript: Skip AI processing
- ✅ Send session_end immediately
- ✅ Status: ACTIVE → COMPLETED
- ✅ No AI response plays

**Actual Results:** (to be filled during testing)

---

#### TC-EC-002: Manual Stop During Processing
**Precondition:** STT/AI/TTS processing in progress
**Steps:**
1. Trigger speech processing
2. During processing stage ('stt' or 'ai' or 'tts'), click "Stop"
3. Observe behavior

**Expected Results:**
- ✅ If during STT: wait for transcript, then skip AI, send session_end
- ✅ If during AI: wait for response, skip audio playback, send session_end
- ✅ If during TTS: wait for audio, skip playback, send session_end
- ✅ No half-played audio
- ✅ Clean transition to COMPLETED

**Actual Results:** (to be filled during testing)

---

#### TC-EC-003: Rapid Speech Bursts (< 1200ms gaps)
**Precondition:** Session ACTIVE
**Steps:**
1. Speak a word
2. Pause for 500ms (less than threshold)
3. Speak another word
4. Pause for 500ms
5. Repeat 5 times
6. Stop speaking completely (> 1200ms)

**Expected Results:**
- ✅ speech_end NOT sent during short pauses
- ✅ All words captured in single audio buffer
- ✅ speech_end sent only after final long pause (> 1200ms)
- ✅ Single transcript contains all words

**Actual Results:** (to be filled during testing)

---

#### TC-EC-004: Very Long User Speech (> 60 seconds)
**Precondition:** Session ACTIVE
**Steps:**
1. Speak continuously for 60+ seconds
2. Stop speaking

**Expected Results:**
- ✅ Audio chunks continue to be sent (every ~500ms)
- ✅ No timeout or disconnection
- ✅ speech_end sent after speech stops
- ✅ Full transcript received
- ✅ AI processes entire input

**Actual Results:** (to be filled during testing)

---

### 5.4 UI Synchronization Test Cases

#### TC-UI-001: All Indicators Update Correctly
**Precondition:** Session ACTIVE
**Steps:**
1. Go through complete conversation cycle:
   - User speaks → AI responds → Silence timer runs → User speaks again

**Expected Results:**
- ✅ Microphone: "Inactive" → "Recording" (pulsing) → "Recording" (not pulsing) → "Inactive"
- ✅ Speaker: "Inactive" → "Playing" (waveform) → "Inactive"
- ✅ Processing: "Transcribing" → "Generating" → "Synthesizing" → (hidden)
- ✅ Silence Timer: visible when idle, hidden during speech/AI/processing
- ✅ Duration: continuously incrementing
- ✅ All transitions smooth, no flickering

**Actual Results:** (to be filled during testing)

---

#### TC-UI-002: Status Badge Color Accuracy
**Precondition:** Start fresh session
**Steps:**
1. Observe status badge through all states:
   IDLE → CONNECTING → READY → ACTIVE → COMPLETED

**Expected Results:**
- ✅ IDLE: gray badge, "Not Started"
- ✅ CONNECTING: yellow badge, "Connecting..."
- ✅ READY: green badge, "Ready"
- ✅ ACTIVE: blue badge, "In Progress"
- ✅ COMPLETED: gray badge, "Completed"

**Actual Results:** (to be filled during testing)

---

#### TC-UI-003: Transcript Display Order
**Precondition:** Session ACTIVE, multiple exchanges
**Steps:**
1. Have 3 conversation exchanges:
   - User: "Hello"
   - AI: "Hi there!"
   - User: "How are you?"
   - AI: "I'm great!"
   - User: "Goodbye"
   - AI: "Bye!"

**Expected Results:**
- ✅ Transcripts appear in chronological order (oldest at top)
- ✅ Each message has correct speaker label (YOU / AI)
- ✅ Timestamps are accurate
- ✅ No duplicate messages
- ✅ Auto-scroll to latest message

**Actual Results:** (to be filled during testing)

---

## 6. Code Audit Checklist

### 6.1 State Management Audit

**File:** `apps/web/components/session-player/index.tsx`

- [ ] **Line 60-100**: All state variables declared with correct types
  - [ ] `status`: SessionStatus
  - [ ] `initialGreetingCompleted`: boolean
  - [ ] `isMicRecording`: boolean
  - [ ] `isUserSpeaking`: boolean (separate from isMicRecording)
  - [ ] `isPlayingAudio`: boolean
  - [ ] `isProcessing`: boolean
  - [ ] `processingStage`: 'idle' | 'stt' | 'ai' | 'tts'
  - [ ] `pendingSessionEnd`: boolean

- [ ] **Line 947**: useSilenceTimer hook called with correct parameters
  ```typescript
  isUserSpeaking: false,  // NOT isMicRecording
  ```

- [ ] **Line 914, 938**: Correct silence duration thresholds
  ```typescript
  silenceDuration: scenario.minSilenceDuration ?? 1000,  // >= 1000ms
  minSilenceDuration: 1200,  // organizational default
  ```

### 6.2 Event Handler Audit

- [ ] **Line 197-212**: handleTranscript checks pendingSessionEnd
  ```typescript
  if (pendingSessionEnd) {
    console.log('[SessionPlayer] Transcript received after session stop, sending session_end');
    setIsProcessing(false);
    setProcessingStage('idle');
    if (isConnectedRef.current && endSessionRef.current) {
      endSessionRef.current();
    }
    return;
  }
  ```

- [ ] **Line 362-370**: handleAudioResponse checks pendingSessionEnd
  ```typescript
  if (pendingSessionEnd) {
    console.log('[SessionPlayer] Session stopped by user, skipping AI audio response');
    if (isConnectedRef.current && endSessionRef.current) {
      endSessionRef.current();
    }
    return;
  }
  ```

- [ ] **Line 1186-1195**: handleStop sends speech_end when recording
  ```typescript
  if (wasRecording) {
    console.log('[SessionPlayer] Audio was recording, sending speech_end and waiting for audio processing');

    if (isConnectedRef.current && sendSpeechEndRef.current) {
      sendSpeechEndRef.current();
      console.log('[SessionPlayer] speech_end signal sent (session stop)');
    }

    setPendingSessionEnd(true);
    setIsProcessing(true);
    setProcessingStage('stt');
  }
  ```

### 6.3 WebSocket Message Handling Audit

**File:** `apps/web/hooks/useWebSocket.ts`

- [ ] **Line 125-140**: greeting message handling
  - [ ] Sets initialGreetingCompleted after audio plays
  - [ ] Transitions status to ACTIVE

- [ ] **Line 142-158**: transcript message handling
  - [ ] Adds USER message to transcript
  - [ ] Does NOT trigger AI processing (done in SessionPlayer)

- [ ] **Line 160-176**: audio_response message handling
  - [ ] Adds ASSISTANT message to transcript
  - [ ] Provides audio URL for playback

- [ ] **Line 178-195**: error message handling
  - [ ] Calls onError callback
  - [ ] Sets error state
  - [ ] Does NOT duplicate console.error (removed)

### 6.4 Audio Recording Audit

**File:** `apps/web/hooks/useAudioRecorder.ts`

- [ ] **Line 50-80**: Silence detection logic
  - [ ] Uses `silenceThreshold` (default: 0.15)
  - [ ] Uses `minSilenceDuration` (default: 1200ms)
  - [ ] Does NOT use hardcoded 500ms threshold

- [ ] **Line 100-130**: Audio chunk sending
  - [ ] Sends chunks every ~500ms
  - [ ] Includes sequence numbers
  - [ ] Handles WebSocket disconnection gracefully

- [ ] **Line 150-180**: speech_end signal
  - [ ] Sent only after minSilenceDuration silence
  - [ ] Includes final chunk flag
  - [ ] Resets state for next speech cycle

### 6.5 Silence Timer Audit

**File:** `apps/web/hooks/useSilenceTimer.ts`

- [ ] **Line 80-110**: startTimer blocking conditions
  ```typescript
  if (!enabled || isAIPlaying || isUserSpeaking || isProcessing) {
    console.log('[useSilenceTimer] ❌ Cannot start: blocking conditions present');
    return;
  }
  ```

- [ ] **Line 103-109**: Grace period implementation
  ```typescript
  if (!graceCompleted) {
    console.log('[useSilenceTimer] ⏳ Starting grace period (1 second)');
    graceTimerRef.current = setTimeout(() => {
      setGraceCompleted(true);
    }, GRACE_PERIOD_MS);
    return;
  }
  ```

- [ ] **Line 114-126**: Timer interval logic
  - [ ] Increments elapsedTime every second
  - [ ] Triggers onTimeout at timeoutSeconds
  - [ ] Resets timer after timeout

### 6.6 UI Rendering Audit

**File:** `apps/web/components/session-player/index.tsx`

- [ ] **Line 1270-1290**: Status badge rendering
  - [ ] Correct colors for each status
  - [ ] Correct text (i18n keys)

- [ ] **Line 1293-1301**: Silence timer display
  - [ ] Shows only when silenceTimerEnabled && effectiveShowTimer
  - [ ] Format: "Silence: Xs / 10s"

- [ ] **Line 1303-1352**: Audio indicators
  - [ ] Microphone: inactive / recording / pulsing
  - [ ] Speaker: inactive / playing
  - [ ] Camera: on / off

- [ ] **Line 1354-1380**: Processing stage display
  - [ ] Correct text for 'stt' / 'ai' / 'tts'
  - [ ] Hidden when 'idle'

- [ ] **Line 1400-1430**: Action buttons
  - [ ] "Start Session" when IDLE
  - [ ] "Stop" when READY or ACTIVE
  - [ ] "Session Ended" when COMPLETED
  - [ ] Correct disabled states

---

## 7. Acceptance Criteria

### 7.1 Functional Requirements

- [ ] **FR-001**: Session starts successfully and transitions through all states
- [ ] **FR-002**: Initial AI greeting plays before user can interact
- [ ] **FR-003**: Silence timer starts after initial greeting (with 1s grace period)
- [ ] **FR-004**: Silence timer increments every second when idle
- [ ] **FR-005**: Silence timer resets when user starts speaking
- [ ] **FR-006**: Silence timer pauses during AI playback
- [ ] **FR-007**: Silence timer pauses during processing (STT/AI/TTS)
- [ ] **FR-008**: Silence prompt appears after configured timeout (10s default)
- [ ] **FR-009**: User speech is detected and triggers processing
- [ ] **FR-010**: Speech detection uses 1200ms minimum silence duration
- [ ] **FR-011**: AI response is generated and played back
- [ ] **FR-012**: Full-duplex: user can speak while AI is playing
- [ ] **FR-013**: Manual stop during recording sends speech_end, waits for transcript, then ends session
- [ ] **FR-014**: Manual stop skips AI processing if user stopped session
- [ ] **FR-015**: No AI audio plays after user manually stopped session
- [ ] **FR-016**: Transcripts appear in correct order with correct speaker labels
- [ ] **FR-017**: Error handling shows user-friendly messages with recovery tips

### 7.2 UI/UX Requirements

- [ ] **UX-001**: Status badge shows correct color and text for each state
- [ ] **UX-002**: Microphone indicator shows "Recording" (pulsing) when user speaks
- [ ] **UX-003**: Speaker indicator shows "Playing" (animated) when AI speaks
- [ ] **UX-004**: Silence timer displays "Silence: Xs / 10s" format
- [ ] **UX-005**: Processing stage shows correct text: "Transcribing..." / "Generating..." / "Synthesizing..."
- [ ] **UX-006**: All indicators update within 100ms of state change
- [ ] **UX-007**: No flickering or jarring transitions
- [ ] **UX-008**: Buttons have correct labels and disabled states
- [ ] **UX-009**: Error dialogs are modal and user-friendly
- [ ] **UX-010**: Low volume warning appears with helpful tips (all 10 languages)

### 7.3 Performance Requirements

- [ ] **PERF-001**: Session start time < 3 seconds (WebSocket connection + initial greeting)
- [ ] **PERF-002**: STT processing time < 3 seconds (for 5-second speech)
- [ ] **PERF-003**: AI response generation < 5 seconds
- [ ] **PERF-004**: TTS synthesis time < 2 seconds
- [ ] **PERF-005**: Total response time (speech end → AI audio start) < 10 seconds
- [ ] **PERF-006**: UI updates (state changes) reflect within 100ms
- [ ] **PERF-007**: Audio playback starts within 500ms of receiving URL
- [ ] **PERF-008**: No memory leaks during 30-minute session

### 7.4 Reliability Requirements

- [ ] **REL-001**: WebSocket reconnection works (max 3 retries)
- [ ] **REL-002**: Session recovers from temporary network failure
- [ ] **REL-003**: Error handling does NOT crash the application
- [ ] **REL-004**: Session can be stopped cleanly at any point
- [ ] **REL-005**: No duplicate messages or events
- [ ] **REL-006**: All timers and intervals are properly cleaned up on unmount
- [ ] **REL-007**: No race conditions between user actions and state updates

### 7.5 Consistency Requirements

- [ ] **CONS-001**: State transitions match design specification in CLAUDE.md
- [ ] **CONS-002**: Event timing matches timeline in this document (Section 2)
- [ ] **CONS-003**: Blocking conditions match matrix in this document (Section 3)
- [ ] **CONS-004**: UI state mapping matches specification (Section 4)
- [ ] **CONS-005**: All i18n keys exist for all 10 languages
- [ ] **CONS-006**: Error messages are consistent across all error types

---

## 8. Verification Execution Plan

### Phase 1: Documentation Review (1 hour)
1. Read all design documents in `docs/05-modules/SESSION_MODULE.md`
2. Read implementation guidelines in `CLAUDE.md`
3. Compare documented design with this verification plan
4. Identify any gaps or discrepancies

### Phase 2: Code Audit (2 hours)
1. Go through Code Audit Checklist (Section 6) line by line
2. Verify each checkbox against actual code implementation
3. Document any deviations or issues found
4. Create list of code fixes needed

### Phase 3: Manual Testing (3 hours)
1. Execute all test cases in Section 5:
   - 5.1 Normal Flow (4 test cases)
   - 5.2 Error Handling (3 test cases)
   - 5.3 Edge Cases (4 test cases)
   - 5.4 UI Synchronization (3 test cases)
2. Fill in "Actual Results" for each test
3. Mark PASS/FAIL for each test
4. Document any unexpected behavior

### Phase 4: Automated Testing (2 hours)
1. Create Playwright E2E tests for critical flows:
   - TC-NF-001: Initial greeting and silence timer
   - TC-NF-002: Full conversation cycle
   - TC-EC-001: Manual stop during recording
2. Run tests and collect results
3. Integrate into CI/CD pipeline

### Phase 5: Performance Testing (2 hours)
1. Measure response times for all PERF requirements
2. Use browser DevTools Performance tab
3. Profile WebSocket message timing
4. Check memory usage over 30-minute session

### Phase 6: Fix and Verify (variable)
1. Implement fixes for failed tests
2. Re-run failed tests
3. Verify no regressions introduced
4. Update documentation if design changed

### Phase 7: Final Sign-off (1 hour)
1. Review all Acceptance Criteria (Section 7)
2. Mark all checkboxes
3. Document any known issues or limitations
4. Create summary report
5. Commit all changes

**Total Estimated Time:** 11-13 hours

---

## 9. Verification Results

### 9.1 Code Audit Results
(To be filled after Phase 2)

### 9.2 Manual Test Results
(To be filled after Phase 3)

### 9.3 Automated Test Results
(To be filled after Phase 4)

### 9.4 Performance Test Results
(To be filled after Phase 5)

### 9.5 Issues Found and Fixed
(To be filled during Phase 6)

### 9.6 Final Acceptance Status
(To be filled after Phase 7)

---

## 10. References

### Internal Documentation
- [CLAUDE.md](../../CLAUDE.md) - Project master guidelines
- [SESSION_MODULE.md](../05-modules/SESSION_MODULE.md) - Session module design
- [NULL_UNDEFINED_GUIDELINES.md](./NULL_UNDEFINED_GUIDELINES.md) - Data type consistency
- [I18N_SYSTEM_GUIDELINES.md](./I18N_SYSTEM_GUIDELINES.md) - Internationalization

### Code Files
- `apps/web/components/session-player/index.tsx` - Main session player
- `apps/web/hooks/useSilenceTimer.ts` - Silence timer hook
- `apps/web/hooks/useAudioRecorder.ts` - Audio recording hook
- `apps/web/hooks/useWebSocket.ts` - WebSocket communication hook

### Previous Bug Fixes
- 2026-03-16: Silence timer not incrementing (isUserSpeaking fix)
- 2026-03-16: Speech cut off mid-sentence (minSilenceDuration 500ms → 1200ms)
- 2026-03-16: AI response after manual stop (pendingSessionEnd checks)
- 2026-03-16: NO_AUDIO_DATA error handling (speech_end on stop)

---

**Document Status:** Draft - Awaiting verification execution
**Next Review:** After Phase 7 completion
**Owner:** Development Team
