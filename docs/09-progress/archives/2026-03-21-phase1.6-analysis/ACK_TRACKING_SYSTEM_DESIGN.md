# ACK追跡システム詳細設計 - Phase 1.6.1 Day 31

**作成日:** 2026-03-21
**バージョン:** 1.0
**ステータス:** 設計完了 - 実装準備完了

---

## 📋 概要

WebSocketでのチャンク送信に対するACK（確認応答）追跡システムの詳細設計。

**目標:**
- チャンク送信の信頼性向上（成功率 > 98%）
- 送信失敗の自動検出・リトライ
- ネットワーク遅延への対応

---

## 🏗️ アーキテクチャ

### 責務の分離

```
┌─────────────────────────────────────────────────────────┐
│ useAudioRecorder / useVideoRecorder                     │
│ - チャンク生成                                           │
│ - chunkId生成                                            │
│ - onAudioChunk(chunk, timestamp, seq, chunkId) コール    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ SessionPlayer                                           │
│ - pendingChunks Map管理                                 │
│ - ACKタイムアウト管理                                    │
│ - リトライロジック（指数バックオフ）                      │
│ - handleChunkAck() - ACK受信処理                         │
│ - handleAckTimeout() - タイムアウト・リトライ処理         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ useWebSocket                                            │
│ - WebSocket送信                                          │
│ - ACKメッセージ受信                                      │
│ - onChunkAck() コールバック                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Backend (WebSocket Handler)                             │
│ - チャンク受信                                           │
│ - S3保存                                                 │
│ - ACK送信（status: received/saved/error/duplicate）      │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 データ構造

### 1. PendingChunk Interface

```typescript
interface PendingChunk {
  chunkId: string;           // 一意ID: "audio-42-1234567890"
  data: ArrayBuffer;         // チャンクデータ
  timestamp: number;         // チャンクタイムスタンプ
  sequenceNumber: number;    // シーケンス番号
  sentAt: number;            // 送信時刻（Date.now()）
  retryCount: number;        // リトライ回数（0-3）
  type: 'audio' | 'video';   // チャンク種別
}
```

### 2. SessionPlayer State

```typescript
// Pending chunks (送信済み・ACK待ち)
const [pendingChunks, setPendingChunks] = useState<Map<string, PendingChunk>>(new Map());

// ACK timeout管理
const ackTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
```

### 3. ACK追跡統計

```typescript
interface ChunkStats {
  audioSent: number;         // 送信した音声チャンク数
  audioAcked: number;        // ACK受信済み音声チャンク数
  videoSent: number;         // 送信したビデオチャンク数
  videoAcked: number;        // ACK受信済みビデオチャンク数
  failedChunks: string[];    // 失敗したchunkIdリスト
}
```

---

## 🔄 処理フロー

### フロー1: チャンク送信 → ACK受信（正常系）

```
1. useAudioRecorder
   ↓ onAudioChunk(chunk, timestamp, seq, chunkId)

2. SessionPlayer.handleAudioChunk()
   ├─ ArrayBuffer変換
   ├─ pendingChunks.set(chunkId, {...})
   ├─ audioBuffer.addChunk() → WebSocket送信
   └─ setTimeout(handleAckTimeout, 5000) → ackTimeouts.set()

3. Backend
   ├─ audio_chunk_realtime受信
   ├─ S3保存
   └─ chunk_ack送信（status: 'saved'）

4. useWebSocket
   ↓ onChunkAck(message)

5. SessionPlayer.handleChunkAck()
   ├─ pending = pendingChunks.get(chunkId)
   ├─ clearTimeout(ackTimeout)
   ├─ ackTimeouts.delete(chunkId)
   ├─ pendingChunks.delete(chunkId)
   └─ chunkStats.audioAcked++

✅ 完了
```

### フロー2: ACKタイムアウト → リトライ（異常系）

```
1. SessionPlayer.handleAudioChunk()
   └─ setTimeout(handleAckTimeout, 5000)

2. 5秒経過（ACK未受信）
   ↓

3. SessionPlayer.handleAckTimeout(chunkId)
   ├─ pending = pendingChunks.get(chunkId)
   ├─ if (retryCount >= MAX_RETRIES) → 失敗
   │   ├─ pendingChunks.delete(chunkId)
   │   ├─ failedChunks.push(chunkId)
   │   └─ toast.error('Failed to send chunk after 3 retries')
   │
   └─ else → リトライ
       ├─ pending.retryCount++
       ├─ delay = 2^retryCount * 100ms (100ms, 200ms, 400ms)
       └─ setTimeout(() => {
           ├─ audioBuffer.addChunk() → 再送信
           └─ setTimeout(handleAckTimeout, 5000) → 新タイムアウト
         }, delay)
```

### フロー3: 重複ACK受信

```
1. Backend
   └─ chunk_ack送信（status: 'duplicate'）

2. SessionPlayer.handleChunkAck()
   ├─ pending = pendingChunks.get(chunkId)
   ├─ if (!pending) → 既に処理済み（無視）
   │   └─ console.warn('ACK for already processed chunk')
   │
   └─ else → 通常処理（フロー1と同じ）
```

### フロー4: エラーACK受信

```
1. Backend
   └─ chunk_ack送信（status: 'error', error: {...}）

2. SessionPlayer.handleChunkAck()
   ├─ if (status === 'error')
   │   ├─ console.error('Chunk error:', error)
   │   └─ handleAckTimeout(chunkId) → リトライ
   │
   └─ else → 通常処理
```

---

## 💻 実装仕様

### 1. handleChunkAck 関数

**責務:** ACK受信時の処理

```typescript
const handleChunkAck = useCallback((message: ChunkAckMessage) => {
  const { chunkId, status, error } = message;

  console.log('[SessionPlayer] Chunk ACK received:', {
    chunkId,
    status,
    error: error?.code,
  });

  // 1. Pending chunkを取得
  const pending = pendingChunks.get(chunkId);

  if (!pending) {
    console.warn('[SessionPlayer] ACK for unknown/processed chunk:', chunkId);
    return;
  }

  // 2. タイムアウトクリア
  const timeoutId = ackTimeoutsRef.current.get(chunkId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    ackTimeoutsRef.current.delete(chunkId);
  }

  // 3. ステータスに応じた処理
  if (status === 'error') {
    console.error('[SessionPlayer] Chunk error:', error);
    // エラー時はリトライ
    handleAckTimeout(chunkId);
    return;
  }

  if (status === 'duplicate') {
    console.warn('[SessionPlayer] Duplicate chunk detected:', chunkId);
    // 重複は正常として扱う（既に保存済み）
  }

  // 4. Pendingから削除（成功）
  setPendingChunks(prev => {
    const next = new Map(prev);
    next.delete(chunkId);
    return next;
  });

  // 5. 統計更新
  setChunkStats(prev => ({
    ...prev,
    [pending.type === 'audio' ? 'audioAcked' : 'videoAcked']:
      prev[pending.type === 'audio' ? 'audioAcked' : 'videoAcked'] + 1,
  }));

}, [pendingChunks, handleAckTimeout]);
```

### 2. handleAckTimeout 関数

**責務:** ACKタイムアウト時のリトライ処理

```typescript
const handleAckTimeout = useCallback((chunkId: string) => {
  console.log('[SessionPlayer] ACK timeout:', chunkId);

  const pending = pendingChunks.get(chunkId);

  if (!pending) {
    console.warn('[SessionPlayer] Timeout for unknown chunk:', chunkId);
    return;
  }

  const MAX_RETRIES = 3;

  // 最大リトライ回数超過
  if (pending.retryCount >= MAX_RETRIES) {
    console.error(
      `[SessionPlayer] Chunk failed after ${MAX_RETRIES} retries:`,
      chunkId
    );

    // Pendingから削除
    setPendingChunks(prev => {
      const next = new Map(prev);
      next.delete(chunkId);
      return next;
    });

    // 失敗リストに追加
    setChunkStats(prev => ({
      ...prev,
      failedChunks: [...prev.failedChunks, chunkId],
    }));

    // エラー通知
    toast.error(
      `Failed to send ${pending.type} chunk after ${MAX_RETRIES} retries`,
      { duration: 5000 }
    );

    return;
  }

  // リトライ処理
  const delayMs = Math.pow(2, pending.retryCount) * 100; // 100ms, 200ms, 400ms

  console.log(
    `[SessionPlayer] Retrying chunk ${chunkId} (attempt ${pending.retryCount + 1}/${MAX_RETRIES}) after ${delayMs}ms`
  );

  setTimeout(() => {
    // リトライ回数更新
    setPendingChunks(prev => {
      const next = new Map(prev);
      const chunk = next.get(chunkId);
      if (chunk) {
        chunk.retryCount++;
        chunk.sentAt = Date.now();
      }
      return next;
    });

    // 再送信
    if (pending.type === 'audio') {
      audioBuffer.addChunk(pending.data, pending.timestamp);
    } else {
      // Video chunk resend
      sendVideoChunkRef.current?.(
        new Blob([pending.data]),
        pending.timestamp
      );
    }

    // 新しいタイムアウト設定
    const timeoutId = setTimeout(() => {
      handleAckTimeout(chunkId);
    }, 5000);

    ackTimeoutsRef.current.set(chunkId, timeoutId);
  }, delayMs);

}, [pendingChunks, audioBuffer, toast]);
```

### 3. handleAudioChunk 更新

**変更点:** chunkId対応 + Pending chunk追加

```typescript
const handleAudioChunk = useCallback(
  async (chunk: Blob, timestamp: number, sequenceNumber: number, chunkId: string) => {
    console.log('[SessionPlayer] handleAudioChunk called:', {
      chunkId,
      chunkSize: chunk.size,
      sequenceNumber,
      timestamp,
    });

    if (isConnectedRef.current && isAuthenticatedRef.current) {
      try {
        const arrayBuffer = await chunk.arrayBuffer();

        // 1. Pending chunkに追加
        setPendingChunks(prev => {
          const next = new Map(prev);
          next.set(chunkId, {
            chunkId,
            data: arrayBuffer,
            timestamp,
            sequenceNumber,
            sentAt: Date.now(),
            retryCount: 0,
            type: 'audio',
          });
          return next;
        });

        // 2. WebSocket送信（via audioBuffer）
        audioBuffer.addChunk(arrayBuffer, timestamp);

        // 3. 統計更新
        setChunkStats(prev => ({
          ...prev,
          audioSent: prev.audioSent + 1,
        }));

        // 4. ACKタイムアウト設定（5秒）
        const timeoutId = setTimeout(() => {
          handleAckTimeout(chunkId);
        }, 5000);

        ackTimeoutsRef.current.set(chunkId, timeoutId);

        console.log('[SessionPlayer] Audio chunk sent:', {
          chunkId,
          bufferStats: audioBuffer.getStats(),
        });
      } catch (error) {
        console.error('[SessionPlayer] Failed to send audio chunk:', error);
      }
    }
  },
  [isConnected, audioBuffer, handleAckTimeout]
);
```

### 4. handleVideoChunk 更新

**変更点:** chunkId対応 + Pending chunk追加

```typescript
const handleVideoChunk = useCallback(
  async (chunk: Blob, timestamp: number, chunkId: string) => {
    console.log('[SessionPlayer] handleVideoChunk called:', {
      chunkId,
      chunkSize: chunk.size,
      timestamp,
    });

    if (
      isConnectedRef.current &&
      isAuthenticated &&
      status === 'ACTIVE' &&
      sendVideoChunkRef.current
    ) {
      try {
        const arrayBuffer = await chunk.arrayBuffer();

        // 1. Pending chunkに追加
        setPendingChunks(prev => {
          const next = new Map(prev);
          next.set(chunkId, {
            chunkId,
            data: arrayBuffer,
            timestamp,
            sequenceNumber: 0, // Video doesn't use sequence
            sentAt: Date.now(),
            retryCount: 0,
            type: 'video',
          });
          return next;
        });

        // 2. WebSocket送信
        await sendVideoChunkRef.current(chunk, timestamp);

        // 3. 統計更新
        setChunkStats(prev => ({
          ...prev,
          videoSent: prev.videoSent + 1,
        }));

        // 4. ACKタイムアウト設定（5秒）
        const timeoutId = setTimeout(() => {
          handleAckTimeout(chunkId);
        }, 5000);

        ackTimeoutsRef.current.set(chunkId, timeoutId);

        console.log('[SessionPlayer] Video chunk sent:', {
          chunkId,
          size: chunk.size,
        });
      } catch (error) {
        console.error('[SessionPlayer] Failed to send video chunk:', error);
      }
    }
  },
  [isAuthenticated, status, handleAckTimeout]
);
```

### 5. useWebSocket 統合

**onChunkAck コールバック追加:**

```typescript
// useWebSocket.ts
const handleMessage = (event: MessageEvent) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'chunk_ack':
      options.onChunkAck?.(message as ChunkAckMessage);
      break;
    // ... 他のメッセージタイプ
  }
};
```

**SessionPlayer での使用:**

```typescript
const { /* ... */ } = useWebSocket({
  // ... 既存オプション
  onChunkAck: handleChunkAck, // 🆕 追加
});
```

---

## 🎯 設定値・定数

```typescript
// ACKタイムアウト
const ACK_TIMEOUT_MS = 5000; // 5秒

// 最大リトライ回数
const MAX_RETRIES = 3;

// リトライ遅延（指数バックオフ）
const getRetryDelay = (retryCount: number) => Math.pow(2, retryCount) * 100;
// retryCount 0: 100ms
// retryCount 1: 200ms
// retryCount 2: 400ms
```

---

## 📊 UI表示

### 録画状態インジケーター

```tsx
<div className="recording-status">
  {/* 録画中インジケーター */}
  {status === 'ACTIVE' && (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </span>
      <span className="text-sm text-gray-700">Recording</span>
    </div>
  )}

  {/* チャンク統計 */}
  <span className="text-xs text-gray-500">
    Audio: {chunkStats.audioAcked}/{chunkStats.audioSent}
  </span>
  <span className="text-xs text-gray-500">
    Video: {chunkStats.videoAcked}/{chunkStats.videoSent}
  </span>

  {/* エラーインジケーター */}
  {chunkStats.failedChunks.length > 0 && (
    <span className="text-xs text-red-500">
      ⚠️ {chunkStats.failedChunks.length} failed
    </span>
  )}
</div>
```

---

## 🧪 テストケース

### 1. 正常系テスト

```typescript
test('should send chunk and receive ACK', async () => {
  // 1. チャンク送信
  handleAudioChunk(mockChunk, 1000, 0, 'audio-0-1000');

  // 2. Pending chunk確認
  expect(pendingChunks.has('audio-0-1000')).toBe(true);

  // 3. ACK受信
  handleChunkAck({
    type: 'chunk_ack',
    chunkId: 'audio-0-1000',
    status: 'saved',
    timestamp: Date.now(),
  });

  // 4. Pendingから削除確認
  expect(pendingChunks.has('audio-0-1000')).toBe(false);
  expect(chunkStats.audioAcked).toBe(1);
});
```

### 2. リトライテスト

```typescript
test('should retry on ACK timeout', async () => {
  jest.useFakeTimers();

  // 1. チャンク送信
  handleAudioChunk(mockChunk, 1000, 0, 'audio-0-1000');

  // 2. 5秒経過（ACK未受信）
  jest.advanceTimersByTime(5000);

  // 3. リトライ確認
  const pending = pendingChunks.get('audio-0-1000');
  expect(pending?.retryCount).toBe(1);

  // 4. さらに5秒経過
  jest.advanceTimersByTime(5200); // 5000 + 200ms delay
  expect(pending?.retryCount).toBe(2);
});
```

### 3. 最大リトライテスト

```typescript
test('should fail after max retries', async () => {
  jest.useFakeTimers();

  // 1. チャンク送信
  handleAudioChunk(mockChunk, 1000, 0, 'audio-0-1000');

  // 2. 3回リトライ
  for (let i = 0; i < 3; i++) {
    const delay = Math.pow(2, i) * 100;
    jest.advanceTimersByTime(5000 + delay);
  }

  // 3. 失敗確認
  expect(pendingChunks.has('audio-0-1000')).toBe(false);
  expect(chunkStats.failedChunks).toContain('audio-0-1000');
});
```

---

## 🔄 Backend実装（概要）

**WebSocket Handler (`infrastructure/lambda/websocket/default/index.ts`):**

```typescript
case 'audio_chunk_realtime': {
  const { data, timestamp, sequenceNumber, chunkId, contentType } = message;

  try {
    // S3保存
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: `sessions/${sessionId}/audio/chunk-${sequenceNumber}.webm`,
      Body: Buffer.from(data, 'base64'),
      ContentType: contentType,
    }));

    // ACK送信（成功）
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: 'chunk_ack',
        chunkId,
        status: 'saved',
        timestamp: Date.now(),
      }),
    }));

  } catch (error) {
    console.error('[WebSocket] Failed to save audio chunk:', error);

    // ACK送信（エラー）
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        type: 'chunk_ack',
        chunkId,
        status: 'error',
        timestamp: Date.now(),
        error: {
          code: 'S3_UPLOAD_FAILED',
          message: error.message,
        },
      }),
    }));
  }

  break;
}
```

---

## ✅ 実装チェックリスト

### Frontend

- [ ] ChunkStats state追加
- [ ] handleChunkAck実装
- [ ] handleAckTimeout実装
- [ ] handleAudioChunk更新（chunkId対応）
- [ ] handleVideoChunk更新（chunkId対応）
- [ ] useWebSocket onChunkAck統合
- [ ] 録画状態UI実装

### Backend

- [ ] audio_chunk_realtime ACK送信
- [ ] video_chunk ACK送信
- [ ] エラー時ACK送信
- [ ] 重複チェック・ACK送信

### Testing

- [ ] 単体テスト作成
- [ ] E2Eテスト作成
- [ ] ネットワーク遅延テスト
- [ ] エラーシミュレーションテスト

---

## 📈 期待される効果

### Before（現状）
- チャンク送信失敗の検出なし
- リトライなし
- ユーザーへのフィードバックなし
- 録画成功率: 不明（推定 85-90%）

### After（実装後）
- チャンク送信の即座な確認
- 自動リトライ（最大3回）
- リアルタイム統計表示
- 録画成功率: > 98% 目標

---

**最終更新:** 2026-03-21 12:00 UTC
**次回更新:** 実装完了時
**作成者:** Claude Code (Phase 1.6.1 実装設計)
