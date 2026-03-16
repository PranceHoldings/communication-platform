# Session Player Test IDs - Implementation Guide

**作成日:** 2026-03-16
**目的:** E2Eテスト用のdata-testid属性追加ガイド

---

## 📋 Required Test IDs

以下の`data-testid`属性をセッションプレイヤーコンポーネント（`apps/web/components/session-player/index.tsx`）に追加してください。

### 1. Main Container

```tsx
<div className="space-y-6" data-testid="session-player" role="main">
```

### 2. Status Badge

```tsx
<div
  className={`text-lg font-semibold ${getStatusColor(status)}`}
  data-testid="status-badge"
>
  {getStatusText(status)}
</div>
```

### 3. Silence Timer

```tsx
{effectiveShowSilenceTimer && status === 'ACTIVE' && initialGreetingCompleted && (
  <div
    className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 min-w-[120px]"
    data-testid="silence-timer"
  >
    <div className="text-xs text-indigo-600 font-medium uppercase tracking-wide">
      {t('sessions.player.silenceTimer.label')}
    </div>
    <div className="text-xl font-mono font-bold text-indigo-900 mt-0.5">
      {silenceElapsedTime}s / {effectiveSilenceTimeout}s
    </div>
  </div>
)}
```

### 4. Session Duration

```tsx
<div
  className="text-2xl font-mono font-bold text-gray-900 mt-1"
  data-testid="session-duration"
>
  {formatTime(currentTime)}
</div>
```

### 5. Action Buttons

```tsx
{/* Start Button */}
{status === 'IDLE' && (
  <button
    onClick={handleStart}
    data-testid="start-button"
    disabled={!token}
    className="..."
  >
    {t('sessions.player.actions.start')}
  </button>
)}

{/* Stop Button */}
{(status === 'ACTIVE' || status === 'READY') && (
  <button
    onClick={handleStop}
    data-testid="stop-button"
    className="..."
  >
    {t('sessions.player.actions.stop')}
  </button>
)}

{/* Pause Button */}
{status === 'ACTIVE' && (
  <button
    onClick={handlePause}
    data-testid="pause-button"
    className="..."
  >
    {t('sessions.player.actions.pause')}
  </button>
)}
```

### 6. Audio Indicators

#### Microphone Indicator

```tsx
{/* Find the microphone indicator section */}
<div className="..." data-testid="microphone-indicator">
  <div className="flex items-center gap-2">
    <span className="text-2xl">🎤</span>
    <div>
      <div className="text-xs text-gray-600 font-medium">
        {t('sessions.player.avatar.microphone')}
      </div>
      <div className={`text-sm font-semibold ${...}`}>
        {isMicRecording
          ? t('sessions.player.avatar.recording')
          : t('sessions.player.avatar.inactive')}
      </div>
    </div>
  </div>
</div>
```

#### Speaker Indicator

```tsx
{/* Find the speaker indicator section */}
<div className="..." data-testid="speaker-indicator">
  <div className="flex items-center gap-2">
    <span className="text-2xl">🔊</span>
    <div>
      <div className="text-xs text-gray-600 font-medium">
        {t('sessions.player.avatar.speaker')}
      </div>
      <div className={`text-sm font-semibold ${...}`}>
        {isPlayingAudio
          ? t('sessions.player.avatar.playing')
          : t('sessions.player.avatar.inactive')}
      </div>
    </div>
  </div>
</div>
```

#### Camera Indicator

```tsx
{/* Find the camera indicator section */}
<div className="..." data-testid="camera-indicator">
  <div className="flex items-center gap-2">
    <span className="text-2xl">📷</span>
    <div>
      <div className="text-xs text-gray-600 font-medium">
        {t('sessions.player.avatar.camera')}
      </div>
      <div className={`text-sm font-semibold ${...}`}>
        {isCameraActive
          ? t('sessions.player.avatar.on')
          : t('sessions.player.avatar.off')}
      </div>
    </div>
  </div>
</div>
```

### 7. Processing Stage

```tsx
{isProcessing && processingStage !== 'idle' && (
  <div
    className="..."
    data-testid="processing-stage"
    role="status"
    aria-live="polite"
  >
    {processingStage === 'stt' && t('sessions.player.processing.stt')}
    {processingStage === 'ai' && t('sessions.player.processing.ai')}
    {processingStage === 'tts' && t('sessions.player.processing.tts')}
  </div>
)}
```

### 8. Transcript

```tsx
{/* Transcript container */}
<div
  className="..."
  data-testid="transcript"
  role="log"
  aria-label={t('sessions.player.transcript.title')}
>
  {transcript.length === 0 ? (
    <div className="text-center py-12">
      <p className="text-gray-500">{t('sessions.player.transcript.empty')}</p>
    </div>
  ) : (
    <div className="space-y-4">
      {transcript.map((item) => (
        <div
          key={item.id}
          className={`flex ${...}`}
          data-testid="transcript-message"
          data-speaker={item.speaker}
        >
          <div className={`inline-block px-4 py-2 rounded-lg ${...}`}>
            <div className="text-xs font-medium mb-1">
              {item.speaker === 'USER'
                ? t('sessions.player.transcript.you')
                : avatar.name}
            </div>
            <p className="text-sm">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

### 9. Session List (for navigation tests)

```tsx
{/* In apps/web/app/dashboard/sessions/page.tsx */}
<div className="..." data-testid="session-list">
  {/* Session cards */}
</div>
```

---

## 🔍 Where to Find These Elements

### Line Number Reference (Approximate)

| Element | File | Line Range |
|---------|------|------------|
| Main Container | index.tsx | 1568-1570 |
| Status Badge | index.tsx | 1609-1611 |
| Silence Timer | index.tsx | 1597-1606 |
| Duration | index.tsx | 1613-1615 |
| Audio Indicators | index.tsx | 1650-1750 |
| Processing Stage | index.tsx | 1850-1870 |
| Transcript | index.tsx | 1900-2000 |
| Action Buttons | index.tsx | 2100-2150 |

**Note:** Line numbers are approximate and may vary. Use search (Ctrl+F) to find specific sections.

---

## 📝 Implementation Checklist

- [ ] Main container (`data-testid="session-player"`)
- [ ] Status badge (`data-testid="status-badge"`)
- [ ] Silence timer (`data-testid="silence-timer"`)
- [ ] Session duration (`data-testid="session-duration"`)
- [ ] Start button (`data-testid="start-button"`)
- [ ] Stop button (`data-testid="stop-button"`)
- [ ] Pause button (`data-testid="pause-button"`)
- [ ] Microphone indicator (`data-testid="microphone-indicator"`)
- [ ] Speaker indicator (`data-testid="speaker-indicator"`)
- [ ] Camera indicator (`data-testid="camera-indicator"`)
- [ ] Processing stage (`data-testid="processing-stage"`)
- [ ] Transcript container (`data-testid="transcript"`)
- [ ] Transcript messages (`data-testid="transcript-message"`)
- [ ] Session list (`data-testid="session-list"`)

---

## ✅ Verification

After adding test IDs, verify them:

```bash
# Run Stage 1 tests (basic UI)
npm run test:e2e:stage1

# Expected: All 10 tests should pass
```

---

## 🎨 Best Practices

### 1. Semantic Test IDs
- Use descriptive names: `microphone-indicator`, not `mic-icon`
- Follow kebab-case convention
- Align with component purpose

### 2. Stable Selectors
- Prefer `data-testid` over class names or text content
- Text content changes with i18n, test IDs don't
- Avoid using positional selectors (`:nth-child`)

### 3. Accessibility
- Keep `role` and `aria-*` attributes
- Add `aria-label` for better screen reader support
- Don't remove semantic HTML for test IDs

### 4. Minimal Footprint
- Only add test IDs where necessary
- Don't add to every element
- Focus on interactive and dynamic elements

---

## 🔄 Maintenance

When adding new features:

1. Add corresponding `data-testid`
2. Update Page Object Model (`session-player.page.ts`)
3. Add test cases in appropriate stage
4. Update this document

---

**最終更新:** 2026-03-16
**次回レビュー:** Test ID実装完了後
