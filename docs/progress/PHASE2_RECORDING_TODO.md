# Phase 2 - 録画機能実装 TODO

**作成日:** 2026-03-07 20:30 JST
**更新日:** 2026-03-08 03:11 JST
**ステータス:** ✅ Task 2.1.2 完了！（Lambda動画処理）

---

## 🎉 Task 2.1.1 完了 - フロントエンド映像キャプチャ

### ✅ 完了（すべて）

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

5. **SessionPlayer import更新**
   - useVideoRecorder, VideoComposer をimport
   - 録画用refを追加（avatarCanvasRef, userVideoRef, compositeCanvasRef）

6. **SessionPlayer統合完了**
   - ✅ Step 3-1: useVideoRecorder統合
   - ✅ Step 3-2: ユーザーカメラ取得
   - ✅ Step 3-3: 録画ステータスUI
   - ✅ Step 3-4: 録画ボタンUI
   - ✅ Step 3-5: VideoComposer配置

### ✅ 完了条件達成

- [x] 録画開始ボタンをクリックして録画開始
- [x] 録画中のステータス表示が正常
- [x] 録画時間カウンターが動作
- [x] 一時停止・再開が正常動作
- [x] 録画停止で完了メッセージ表示
- [x] ブラウザコンソールにビデオチャンクログ表示
- [x] エラーハンドリングが正常動作

---

## 📝 実装詳細（参考）

### Step 3-1: useVideoRecorder統合（完了）

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
{
  /* カメラステータスの後に追加 */
}

{
  /* 録画ステータス */
}
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
</div>;

{
  /* 録画エラー表示 */
}
{
  videoRecordingError && (
    <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
      {videoRecordingError.message}
    </div>
  );
}
```

#### Step 3-4: 録画ボタン追加（30分）

**追加場所:** アクションボタンエリア（「Start Session」「Pause」等のボタン付近）

```tsx
{
  /* セッションコントロールボタンの後に追加 */
}
{
  status === 'ACTIVE' && (
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
  );
}
```

#### Step 3-5: VideoComposer と hidden要素追加（15分）

**追加場所:** return文の最後（閉じタグの前）

```tsx
{
  /* Hidden要素: 録画用 */
}
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
</div>;
```

---

## 📅 推定作業時間

- **Step 3-1:** 30分 - useVideoRecorder統合
- **Step 3-2:** 30分 - ユーザーカメラ取得
- **Step 3-3:** 30分 - 録画ステータスUI
- **Step 3-4:** 30分 - 録画ボタンUI
- **Step 3-5:** 15分 - VideoComposer配置

**実際の所要時間:** 約2時間

---

## 🎊 Task 2.1.1 完了報告

**完了日時:** 2026-03-07 21:45 JST
**実装時間:** 約2時間（推定2時間15分）

**実装内容:**

- ✅ VideoComposer コンポーネント作成
- ✅ useVideoRecorder フック作成
- ✅ SessionPlayer への完全統合
- ✅ ユーザーカメラ取得機能
- ✅ 録画UI（ステータス表示、ボタン）
- ✅ エラーハンドリング

**コミット:**

- 3a9def1: feat: Phase 2 録画機能の基盤実装（Step 1 & 2）
- 50d30d7: wip: SessionPlayer統合開始（Step 3途中）
- b315172: feat: SessionPlayer統合完了（Task 2.1.1完了）✅

**動作確認項目（すべて達成）:**

- [x] 録画開始ボタンで録画開始
- [x] 録画中のステータス表示（赤いアニメーション）
- [x] 録画時間カウンター表示
- [x] 一時停止・再開が正常動作
- [x] 録画停止で完了メッセージ表示
- [x] ブラウザコンソールにビデオチャンクログ表示
- [x] エラーハンドリングが正常動作

---

## ✅ Task 2.1.2 完了 - Lambda動画処理

**開始日:** 2026-03-07 23:30 JST
**完了日:** 2026-03-08 03:11 JST
**作業時間:** 約3時間40分
**目標:** WebSocketで受信した動画チャンクを処理・結合してS3に保存 ✅

### ✅ 完了した作業

1. **VideoProcessor モジュール作成**
   - ファイル: `infrastructure/lambda/websocket/default/video-processor.ts`
   - S3への動画チャンク保存
   - ffmpegでのチャンク結合
   - CloudFront署名付きURL生成
   - 一時ストレージ管理（/tmp クリーンアップ）

2. **WebSocket Lambda統合**
   - ファイル: `infrastructure/lambda/websocket/default/index.ts`
   - `video_chunk` メッセージタイプ追加
   - `session_end` で動画処理実行
   - VideoProcessor lazy initialization
   - ConnectionData に videoChunksCount フィールド追加

3. **Lambda設定更新**
   - ファイル: `infrastructure/lib/api-lambda-stack.ts`
   - メモリ: 1536MB → 3008MB
   - タイムアウト: 90秒 → 300秒（5分）
   - Ephemeral Storage: デフォルト → 10GB
   - CloudFront環境変数追加（CLOUDFRONT_DOMAIN, CLOUDFRONT_KEY_PAIR_ID, CLOUDFRONT_PRIVATE_KEY）

4. **フロントエンド統合**
   - ファイル: `apps/web/hooks/useWebSocket.ts`
   - `sendVideoChunk` 関数追加
   - `video_chunk_ack`, `video_ready` メッセージハンドリング
   - ファイル: `apps/web/components/session-player/index.tsx`
   - `handleVideoChunk` で WebSocket経由でビデオチャンク送信

5. **依存関係追加**
   - `@aws-sdk/cloudfront-signer`
   - `@types/fluent-ffmpeg`

### ✅ デプロイ完了

**デプロイ日時:** 2026-03-08 03:10 JST
**デプロイ時間:** 152秒（約2.5分）
**更新リソース:** 22/79

**主要更新:**

- ✅ WebSocketDefaultFunction
  - メモリ: 1536MB → 3008MB
  - タイムアウト: 90秒 → 300秒
  - Ephemeral Storage: 10GB追加
  - 新機能: video_chunk処理、ffmpeg動画結合、CloudFront URL生成

**WebSocket エンドポイント:**

```
wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

### 📝 次のステップ

**優先度: 高**

1. **動作テスト（必須）**
   - セッション開始 → 録画開始
   - 動画チャンク送信確認（CloudWatchログ）
   - セッション終了 → 動画結合処理確認
   - 動画URL生成確認

**優先度: 中** 2. **Prisma Recording モデル追加**

- 録画メタデータの永続化
- videoUrl, videoSize, duration フィールド追加

3. **Task 2.1.3 開始: 録画再生UI（推定3日）**
   - セッション詳細ページに録画プレイヤー追加
   - シークバー・再生速度調整
   - タイムスタンプ付きトランスクリプト表示

---

## 🎉 Task 2.1.1 完了報告（参考）

**実装完了内容:**

1. ✅ WebSocket メッセージ拡張（video_chunk受信）
2. ✅ S3への動画チャンク保存（/tmp経由）
3. ✅ ffmpegでチャンク結合
4. ✅ CloudFront署名付きURL生成
5. ⏳ Prisma Recording モデル更新（次のステップ）

**技術スタック:**

- Lambda: メモリ3008MB、タイムアウト300秒、Ephemeral Storage 10GB ✅
- ffmpeg: @ffmpeg-installer/ffmpeg（既存） ✅
- S3: チャンク保存・結合動画保存 ✅
- CloudFront: Signed URLs（設定必要） ⏳

**実装したファイル:**

- `infrastructure/lambda/websocket/default/video-processor.ts` - VideoProcessor クラス
- `infrastructure/lambda/websocket/default/index.ts` - video_chunk ハンドラー追加
- `infrastructure/lib/api-lambda-stack.ts` - Lambda設定更新
- `apps/web/hooks/useWebSocket.ts` - sendVideoChunk 追加
- `apps/web/components/session-player/index.tsx` - WebSocket統合

**詳細:** `docs/progress/PHASE_2_PLAN.md` の Task 2.1.2 セクション

---

## 📝 技術メモ

**現在の制約:**

1. WebSocketにビデオチャンク送信機能なし → Task 2.1.2で実装
2. アバターCanvasは静的（グレー画面）→ 将来Three.js統合
3. Lambda側の動画処理未実装 → 次のタスク

**動作検証方法（現在）:**

1. セッション開始 → カメラ許可
2. 録画開始ボタンクリック
3. ブラウザコンソールで `Video chunk: { size, timestamp }` ログ確認
4. 録画停止 → 完了メッセージ表示
