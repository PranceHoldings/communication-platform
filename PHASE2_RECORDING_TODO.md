# Phase 2 - 録画機能実装 TODO

**作成日:** 2026-03-07 20:30 JST
**ステータス:** 進行中（Task 2.1.1 - Step 3途中）

---

## 🎯 現在のタスク: Task 2.1.1 - Step 3（SessionPlayer統合）

### ✅ 完了

1. **VideoComposer コンポーネント**
   - ファイル: `apps/web/components/session-player/video-composer.tsx`
   - Canvas合成（Picture-in-Picture / Side-by-Side）
   - 30FPS リアルタイム描画

2. **useVideoRecorder フック**
   - ファイル: `apps/web/hooks/useVideoRecorder.ts`
   - MediaRecorder API統合
   - WebSocketチャンク送信対応
   - 録画状態管理

3. **多言語対応**
   - `apps/web/messages/en/sessions.json` - recording セクション追加
   - `apps/web/messages/ja/sessions.json` - recording セクション追加

4. **SessionPlayer import更新**
   - useVideoRecorder, VideoComposer をimport
   - 録画用refを追加（avatarCanvasRef, userVideoRef, compositeCanvasRef）

### ⏳ 次のステップ（続きから）

#### Step 3-1: useVideoRecorder統合（30分）

**追加場所:** `apps/web/components/session-player/index.tsx` の useAudioRecorder の後

```typescript
// useAudioRecorderの後（約277行目）に追加:

// 録画チャンクハンドラー
const handleVideoChunk = useCallback(
  (chunk: Blob, timestamp: number) => {
    if (isConnected && status === 'ACTIVE') {
      // TODO: WebSocketでビデオチャンク送信
      // 将来実装: sendVideoChunk(chunk, timestamp);
      console.log('[SessionPlayer] Video chunk:', { size: chunk.size, timestamp });
    }
  },
  [isConnected, status]
);

const handleRecordingComplete = useCallback(
  (blob: Blob) => {
    console.log('[SessionPlayer] Recording complete:', { size: blob.size });
    toast.success(t('sessions.player.recording.messages.stopped'));
  },
  [t]
);

const handleRecordingError = useCallback(
  (error: Error) => {
    console.error('[SessionPlayer] Recording error:', error);
    toast.error(t('sessions.player.recording.messages.error', { error: error.message }));
  },
  [t]
);

// VideoComposer準備完了ハンドラー
const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
  compositeCanvasRef.current = canvas;
  console.log('[SessionPlayer] Composite canvas ready');
}, []);

// useVideoRecorder統合
const {
  status: recordingStatus,
  startRecording: startVideoRecording,
  stopRecording: stopVideoRecording,
  pauseRecording: pauseVideoRecording,
  resumeRecording: resumeVideoRecording,
  duration: recordingDuration,
  error: videoRecordingError,
} = useVideoRecorder({
  canvasRef: compositeCanvasRef,
  onChunk: handleVideoChunk,
  onComplete: handleRecordingComplete,
  onError: handleRecordingError,
  chunkInterval: 1000, // 1秒ごと
});
```

#### Step 3-2: ユーザーカメラ取得（30分）

**追加場所:** セッション開始時（handleStart関数内）

```typescript
// 既存の handleStart 関数に追加:
const handleStart = useCallback(async () => {
  // ... 既存のコード ...

  // ユーザーカメラを取得
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false, // 音声は useAudioRecorder で取得済み
    });

    if (userVideoRef.current) {
      userVideoRef.current.srcObject = stream;
      userVideoRef.current.play();
      console.log('[SessionPlayer] User camera started');
    }
  } catch (error) {
    console.error('[SessionPlayer] Failed to get user camera:', error);
    toast.warning('カメラへのアクセスが拒否されました。録画機能は利用できません。');
  }

  // ... 既存のコード ...
}, [...]);
```

#### Step 3-3: 録画UIボタン追加（30分）

**追加場所:** アバター表示エリアのステータス表示部分（約542行目）

```tsx
{/* カメラステータスの後に追加 */}

{/* 録画ステータス */}
<div className="flex items-center justify-between text-sm">
  <div className="flex items-center text-gray-600">
    <svg
      className={`w-4 h-4 mr-2 ${
        recordingStatus === 'recording' ? 'text-red-500 animate-pulse' : ''
      }`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <circle cx="10" cy="10" r="8" />
    </svg>
    <span>{t('sessions.player.recording.title')}:</span>
  </div>
  <div className="flex items-center gap-2">
    <span
      className={`font-medium ${
        recordingStatus === 'recording' ? 'text-red-600' : 'text-gray-500'
      }`}
    >
      {t(`sessions.player.recording.status.${recordingStatus}`)}
    </span>
    {recordingStatus === 'recording' && (
      <span className="text-xs text-gray-500">
        {t('sessions.player.recording.duration', {
          duration: `${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, '0')}`,
        })}
      </span>
    )}
  </div>
</div>

{/* 録画エラー表示 */}
{videoRecordingError && (
  <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
    {videoRecordingError.message}
  </div>
)}
```

#### Step 3-4: 録画ボタン追加（30分）

**追加場所:** アクションボタンエリア（「Start Session」「Pause」等のボタン付近）

```tsx
{/* セッションコントロールボタンの後に追加 */}
{status === 'ACTIVE' && (
  <div className="flex gap-2 mt-4">
    {recordingStatus === 'idle' && (
      <button
        onClick={startVideoRecording}
        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" />
        </svg>
        {t('sessions.player.recording.start')}
      </button>
    )}
    {recordingStatus === 'recording' && (
      <>
        <button
          onClick={pauseVideoRecording}
          className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {t('sessions.player.recording.pause')}
        </button>
        <button
          onClick={stopVideoRecording}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {t('sessions.player.recording.stop')}
        </button>
      </>
    )}
    {recordingStatus === 'paused' && (
      <>
        <button
          onClick={resumeVideoRecording}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {t('sessions.player.recording.resume')}
        </button>
        <button
          onClick={stopVideoRecording}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {t('sessions.player.recording.stop')}
        </button>
      </>
    )}
  </div>
)}
```

#### Step 3-5: VideoComposer と hidden要素追加（15分）

**追加場所:** return文の最後（閉じタグの前）

```tsx
{/* Hidden要素: 録画用 */}
<div className="hidden">
  {/* アバター用Canvas（将来Three.js統合用） */}
  <canvas ref={avatarCanvasRef} width={1280} height={720} />

  {/* ユーザーカメラ */}
  <video ref={userVideoRef} autoPlay playsInline muted />

  {/* VideoComposer - アバター + ユーザーカメラ合成 */}
  <VideoComposer
    avatarCanvasRef={avatarCanvasRef}
    userVideoRef={userVideoRef}
    layout="picture-in-picture"
    width={1280}
    height={720}
    onCanvasReady={handleCanvasReady}
  />
</div>
```

---

## 📅 推定作業時間

- **Step 3-1:** 30分 - useVideoRecorder統合
- **Step 3-2:** 30分 - ユーザーカメラ取得
- **Step 3-3:** 30分 - 録画ステータスUI
- **Step 3-4:** 30分 - 録画ボタンUI
- **Step 3-5:** 15分 - VideoComposer配置

**合計:** 約2時間15分

---

## ✅ 完了条件

- [ ] 録画開始ボタンをクリックして録画開始
- [ ] 録画中のステータス表示が正常
- [ ] 録画時間カウンターが動作
- [ ] 一時停止・再開が正常動作
- [ ] 録画停止で完了メッセージ表示
- [ ] ブラウザコンソールにビデオチャンクログ表示
- [ ] エラーハンドリングが正常動作

---

## 🚀 次のタスク（Task 2.1.2）

**Lambda動画処理実装**
- 動画チャンク受信・保存
- ffmpegでチャンク結合
- CloudFront署名付きURL生成

**詳細:** `docs/progress/PHASE_2_PLAN.md`

---

**注意事項:**
1. 現在のWebSocketにはビデオチャンク送信機能がないため、Step 3-1ではログ出力のみ
2. Lambda側の実装（Task 2.1.2）でWebSocket拡張が必要
3. アバターCanvas（avatarCanvasRef）は現在静的。将来Three.js統合で動的に
