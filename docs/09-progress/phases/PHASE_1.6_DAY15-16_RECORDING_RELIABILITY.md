# Phase 1.6 Day 15-16: Recording Reliability Improvements

**作成日:** 2026-03-14
**Phase:** 1.6 (既存機能の実用化)
**ステータス:** 計画中
**担当:** Recording Reliability

---

## 📋 目標

録画機能を本番環境で使用可能なレベルに引き上げる。
ネットワーク障害やパケットロスがあっても、確実にビデオチャンクを転送・保存する。

**Phase 1.6完了基準:**
- ✅ 99%以上のチャンク成功率（10Mbpsネットワークで10分録画）
- ✅ ネットワーク障害からの自動復旧（3秒以内）
- ✅ チャンク欠損の自動検出・再送
- ✅ エラーハンドリングの完全実装

---

## 🔍 現状分析

### Frontend録画フロー（useVideoRecorder.ts）

```typescript
// Current Implementation
MediaRecorder → onChunk callback (1秒間隔)
                    ↓
            onChunk(blob, timestamp)
                    ↓
            WebSocket.send()  // Fire-and-forget ❌
```

**問題点:**
- ❌ チャンク送信後に確認を待たない（Fire-and-forget）
- ❌ 送信失敗時のリトライなし
- ❌ シーケンス番号なし
- ❌ ACKタイムアウトなし

### WebSocket送信フロー（useWebSocket.ts）

```typescript
// Current Implementation
sendVideoChunk(blob)
    ↓
Split into parts (32KB each)
    ↓
for each part: sendMessage({ type: 'video_chunk_part', ... })  // Fire-and-forget ❌
    ↓
console.log('Video chunk acknowledged:', message)  // ログだけ ❌
```

**問題点:**
- ❌ ACK受信を待たない
- ❌ タイムアウトハンドリングなし
- ❌ リトライキューなし
- ❌ 重複送信検出なし

### Backend受信フロー（WebSocket default handler）

```typescript
// Current Implementation
case 'video_chunk_part':
    ↓
Save to S3
    ↓
Send ACK  // シーケンス検証なし ❌
```

**問題点:**
- ❌ シーケンス番号検証なし
- ❌ ギャップ検出なし
- ❌ 重複チェックなし
- ❌ チェックサム検証なし

### Video組み立てフロー（video-processor.ts）

```typescript
// Current Implementation
combineChunks()
    ↓
List all chunks from S3
    ↓
Sort by timestamp and index
    ↓
ffmpeg concat  // ギャップ検出なし ❌
```

**問題点:**
- ❌ 欠損チャンク検出なし（ffmpeg実行前）
- ❌ シーケンス連続性検証なし
- ❌ エラー時のリカバリなし

---

## 🎯 実装タスク

### Task 1: ACK確認機構（3-4時間）

**目標:** チャンク送信後にACK受信を確認、タイムアウト時は再送

**実装箇所:** `apps/web/hooks/useWebSocket.ts`

**設計:**

```typescript
interface PendingChunk {
  chunkId: string;
  data: Blob;
  timestamp: number;
  sequenceNumber: number;
  partIndex: number;
  totalParts: number;
  sentAt: number;
  retryCount: number;
  timeoutHandle?: NodeJS.Timeout;
}

// Pending chunks map
const pendingChunksRef = useRef<Map<string, PendingChunk>>(new Map());
const sequenceNumberRef = useRef<number>(0);

// Settings
const ACK_TIMEOUT = 5000; // 5秒
const MAX_RETRY = 3;
const RETRY_BACKOFF_BASE = 1000; // 1秒
```

**実装ステップ:**

1. **シーケンス番号追加**
   ```typescript
   // video_chunk_part メッセージに sequenceNumber 追加
   interface VideoChunkPartMessage {
     type: 'video_chunk_part';
     chunkId: string;
     sequenceNumber: number; // 🆕 グローバルシーケンス番号
     partIndex: number;
     totalParts: number;
     data: string;
     timestamp: number;
   }
   ```

2. **Pending Chunks管理**
   ```typescript
   const sendVideoChunk = useCallback(async (chunk: Blob, timestamp: number) => {
     const chunkId = generateUUID();
     const sequenceNumber = sequenceNumberRef.current++;

     // Add to pending map
     pendingChunksRef.current.set(chunkId, {
       chunkId,
       data: chunk,
       timestamp,
       sequenceNumber,
       partIndex: 0,
       totalParts,
       sentAt: Date.now(),
       retryCount: 0,
     });

     // Send with timeout
     await sendChunkWithTimeout(chunkId);
   }, []);
   ```

3. **タイムアウト・リトライ**
   ```typescript
   const sendChunkWithTimeout = async (chunkId: string) => {
     const pending = pendingChunksRef.current.get(chunkId);
     if (!pending) return;

     // Set timeout
     const timeoutHandle = setTimeout(() => {
       handleChunkTimeout(chunkId);
     }, ACK_TIMEOUT);

     pending.timeoutHandle = timeoutHandle;

     // Send chunk
     await sendChunkParts(pending);
   };

   const handleChunkTimeout = (chunkId: string) => {
     const pending = pendingChunksRef.current.get(chunkId);
     if (!pending) return;

     if (pending.retryCount >= MAX_RETRY) {
       console.error(`[WebSocket] Chunk ${chunkId} failed after ${MAX_RETRY} retries`);
       pendingChunksRef.current.delete(chunkId);
       // Notify error handler
       onError?.(new Error(`Chunk ${chunkId} transmission failed`));
       return;
     }

     // Exponential backoff
     const backoff = RETRY_BACKOFF_BASE * Math.pow(2, pending.retryCount);
     pending.retryCount++;

     console.warn(`[WebSocket] Chunk ${chunkId} timeout, retry ${pending.retryCount}/${MAX_RETRY} in ${backoff}ms`);

     setTimeout(() => {
       sendChunkWithTimeout(chunkId);
     }, backoff);
   };
   ```

4. **ACK受信ハンドリング**
   ```typescript
   case 'video_chunk_ack':
     const { chunkId, sequenceNumber } = message;

     // Clear pending chunk
     const pending = pendingChunksRef.current.get(chunkId);
     if (pending) {
       clearTimeout(pending.timeoutHandle);
       pendingChunksRef.current.delete(chunkId);
       console.log(`[WebSocket] Chunk ${chunkId} (seq ${sequenceNumber}) acknowledged`);
     }
     break;
   ```

**検証方法:**
```bash
# Chrome DevTools → Network → Throttling → Fast 3G
# 録画開始 → チャンク送信 → ACK確認
# ネットワーク切断 → 5秒後にリトライ確認
# 3回リトライ失敗 → エラーハンドリング確認
```

---

### Task 2: シーケンス番号検証（2-3時間）

**目標:** Backendでシーケンス番号を検証、ギャップ検出

**実装箇所:** `infrastructure/lambda/websocket/default/index.ts`

**設計:**

```typescript
// DynamoDB Session State に追加
interface SessionState {
  // ... existing fields
  videoSequence: {
    lastReceivedSeq: number;
    missingSeqs: number[];
    receivedChunks: string[]; // chunkId array
  };
}
```

**実装ステップ:**

1. **シーケンス番号検証**
   ```typescript
   case 'video_chunk_part':
     const { chunkId, sequenceNumber, partIndex, totalParts, data } = message;

     // Get session state
     const sessionState = await getSessionState(connectionId);
     if (!sessionState) {
       throw new Error('Session not found');
     }

     const { videoSequence } = sessionState;

     // Check sequence number
     if (sequenceNumber <= videoSequence.lastReceivedSeq) {
       console.warn(`[video_chunk_part] Duplicate or out-of-order chunk: seq ${sequenceNumber} <= last ${videoSequence.lastReceivedSeq}`);
       // Send ACK anyway (idempotent)
       await sendAck(connectionId, chunkId, sequenceNumber);
       return successResponse;
     }

     // Detect gap
     if (sequenceNumber > videoSequence.lastReceivedSeq + 1) {
       const gap = sequenceNumber - videoSequence.lastReceivedSeq - 1;
       console.warn(`[video_chunk_part] Gap detected: ${gap} chunks missing`);

       // Add missing sequences
       for (let i = videoSequence.lastReceivedSeq + 1; i < sequenceNumber; i++) {
         videoSequence.missingSeqs.push(i);
       }
     }

     // Process chunk
     await processVideoChunk(chunkId, data, sequenceNumber);

     // Update sequence state
     videoSequence.lastReceivedSeq = sequenceNumber;
     videoSequence.receivedChunks.push(chunkId);
     await updateSessionState(connectionId, { videoSequence });

     // Send ACK
     await sendAck(connectionId, chunkId, sequenceNumber);
   ```

2. **再送要求メッセージ**
   ```typescript
   // Clientに欠損シーケンスを通知
   if (videoSequence.missingSeqs.length > 0) {
     await postToConnection(connectionId, {
       type: 'video_chunk_missing',
       missingSequences: videoSequence.missingSeqs,
     });
   }
   ```

3. **重複チャンク検出**
   ```typescript
   // Check if chunk already received
   if (videoSequence.receivedChunks.includes(chunkId)) {
     console.log(`[video_chunk_part] Duplicate chunk ${chunkId}, skipping storage`);
     await sendAck(connectionId, chunkId, sequenceNumber);
     return successResponse;
   }
   ```

**検証方法:**
```bash
# Lambda関数デプロイ
npm run deploy:lambda

# CloudWatch Logs確認
aws logs tail /aws/lambda/prance-websocket-default-dev --follow

# テスト: 故意にチャンク欠損させる
# - Client側でランダムに一部チャンクをスキップ
# - Backend側でギャップ検出ログ確認
```

---

### Task 3: チャンク整合性検証（2-3時間）

**目標:** SHA-256ハッシュでチャンク破損を検出

**実装箇所:**
- Frontend: `apps/web/hooks/useWebSocket.ts`
- Backend: `infrastructure/lambda/websocket/default/index.ts`

**設計:**

```typescript
// video_chunk_part メッセージに hash 追加
interface VideoChunkPartMessage {
  type: 'video_chunk_part';
  chunkId: string;
  sequenceNumber: number;
  partIndex: number;
  totalParts: number;
  data: string; // Base64
  hash: string; // SHA-256 hash (hex) 🆕
  timestamp: number;
}
```

**実装ステップ:**

1. **Frontend: ハッシュ生成**
   ```typescript
   import { createHash } from 'crypto';

   const sendVideoChunk = useCallback(async (chunk: Blob, timestamp: number) => {
     const arrayBuffer = await chunk.arrayBuffer();
     const bytes = new Uint8Array(arrayBuffer);

     // Calculate SHA-256 hash
     const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
     const hashArray = Array.from(new Uint8Array(hash));
     const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

     // ... split into parts

     // Send with hash
     sendMessage({
       type: 'video_chunk_part',
       chunkId,
       sequenceNumber,
       partIndex,
       totalParts,
       data: base64,
       hash: hashHex,
       timestamp,
     });
   }, []);
   ```

2. **Backend: ハッシュ検証**
   ```typescript
   case 'video_chunk_part':
     const { chunkId, data, hash } = message;

     // Decode Base64
     const buffer = Buffer.from(data, 'base64');

     // Calculate hash
     const crypto = require('crypto');
     const calculatedHash = crypto.createHash('sha256').update(buffer).digest('hex');

     // Verify hash
     if (calculatedHash !== hash) {
       console.error(`[video_chunk_part] Hash mismatch for chunk ${chunkId}`);
       console.error(`  Expected: ${hash}`);
       console.error(`  Calculated: ${calculatedHash}`);

       // Send error response
       await postToConnection(connectionId, {
         type: 'video_chunk_error',
         chunkId,
         error: 'HASH_MISMATCH',
         message: 'Chunk data corrupted during transmission',
       });

       return errorResponse(400, 'Chunk hash mismatch');
     }

     // Hash verified, proceed with storage
     await saveVideoChunk(chunkId, buffer, sequenceNumber);
   ```

**検証方法:**
```bash
# テスト: 故意にデータを破損させる
# - Client側でBase64データに1文字変更
# - Backend側でハッシュ不一致エラー確認
# - Client側でリトライ動作確認
```

---

### Task 4: ビデオ組み立て時のギャップ検出（1-2時間）

**目標:** ffmpeg実行前にチャンク欠損を検出

**実装箇所:** `infrastructure/lambda/websocket/default/video-processor.ts`

**実装ステップ:**

1. **シーケンス連続性チェック**
   ```typescript
   async combineChunks(sessionId: string): Promise<VideoCombineResult> {
     // ... list chunks

     // Extract sequence numbers from metadata
     const sequences = sortedChunks.map(chunk => {
       const metadata = chunk.Metadata || {};
       return parseInt(metadata.sequenceNumber || '0', 10);
     }).sort((a, b) => a - b);

     // Detect gaps
     const gaps: number[] = [];
     for (let i = 1; i < sequences.length; i++) {
       const expected = sequences[i - 1]! + 1;
       const actual = sequences[i]!;
       if (actual !== expected) {
         for (let seq = expected; seq < actual; seq++) {
           gaps.push(seq);
         }
       }
     }

     if (gaps.length > 0) {
       console.warn(`[VideoProcessor] Detected ${gaps.length} missing chunks:`, gaps);
       throw new Error(`Cannot combine video: ${gaps.length} chunks missing (sequences: ${gaps.join(', ')})`);
     }

     // Proceed with ffmpeg
     // ...
   }
   ```

2. **エラーレスポンス改善**
   ```typescript
   try {
     const result = await videoProcessor.combineChunks(sessionId);
     // ...
   } catch (error) {
     if (error.message.includes('missing chunks')) {
       // Send detailed error to client
       await postToConnection(connectionId, {
         type: 'video_processing_error',
         error: 'MISSING_CHUNKS',
         message: error.message,
       });
     }
     throw error;
   }
   ```

**検証方法:**
```bash
# テスト: 故意にチャンク欠損
# - S3から特定チャンクを削除
# - session_end 実行
# - ギャップ検出エラー確認
```

---

## 📊 型定義更新

### packages/shared/src/types/index.ts

```typescript
// VideoChunkPartMessage に sequenceNumber と hash 追加
export interface VideoChunkPartMessage extends WebSocketMessageBase {
  type: 'video_chunk_part';
  chunkId: string;
  sequenceNumber: number; // 🆕
  partIndex: number;
  totalParts: number;
  data: string; // Base64 encoded
  hash: string; // SHA-256 hash (hex) 🆕
  timestamp: number;
}

// VideoChunkAckMessage に sequenceNumber 追加
export interface VideoChunkAckMessage extends WebSocketMessageBase {
  type: 'video_chunk_ack';
  chunkId: string;
  sequenceNumber: number; // 🆕
  chunksReceived: number;
  timestamp: number;
}

// 新規: 欠損チャンク通知メッセージ
export interface VideoChunkMissingMessage extends WebSocketMessageBase {
  type: 'video_chunk_missing';
  missingSequences: number[];
}

// 新規: チャンクエラーメッセージ
export interface VideoChunkErrorMessage extends WebSocketMessageBase {
  type: 'video_chunk_error';
  chunkId: string;
  error: 'HASH_MISMATCH' | 'SEQUENCE_ERROR' | 'STORAGE_ERROR';
  message: string;
}
```

---

## 🧪 テスト計画

### 単体テスト

1. **useWebSocket.test.ts**
   - ACKタイムアウト → リトライ
   - 3回リトライ失敗 → エラー
   - シーケンス番号の連続性
   - 重複チャンク送信抑制

2. **video-processor.test.ts**
   - シーケンスギャップ検出
   - ハッシュ不一致エラー
   - 重複チャンク無視

### 統合テスト

3. **E2E Recording Test**
   ```bash
   # ネットワーク障害シミュレーション
   # - 録画開始
   # - 10秒後にネットワーク切断（Chrome DevTools Offline）
   # - 5秒後に再接続
   # - リトライ動作確認
   # - 録画完了 → ビデオ再生確認
   ```

4. **Stress Test**
   ```bash
   # 長時間録画（10分）
   # - Fast 3G ネットワーク
   # - 全チャンク正常送信確認
   # - ACK受信率 > 99%
   ```

### パフォーマンステスト

5. **CloudWatch Metrics**
   - Average chunk latency < 500ms
   - ACK response time < 200ms
   - Retry rate < 1%
   - Success rate > 99%

---

## 📈 成功基準

| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| **チャンク成功率** | > 99% | CloudWatch Metrics |
| **ACK応答時間** | < 200ms | Lambda実行時間 |
| **リトライ率** | < 1% | カスタムメトリクス |
| **ネットワーク復旧時間** | < 3秒 | E2Eテスト |
| **ハッシュ不一致率** | < 0.01% | Lambda Logs |

---

## 🚀 デプロイ手順

```bash
# 1. 型定義更新
cd packages/shared
npm run build

# 2. Frontend更新
cd apps/web
npm run build

# 3. Lambda関数デプロイ
cd infrastructure
npm run deploy:lambda

# 4. E2Eテスト実行
npm run test:e2e -- recording-reliability.spec.ts

# 5. CloudWatch Metrics確認
npm run perf:metrics
```

---

## 📝 ドキュメント更新

- [ ] `docs/05-modules/RECORDING_MODULE.md` - 録画モジュール詳細
- [ ] `docs/07-development/RECORDING_RELIABILITY_GUIDE.md` - 実装ガイド
- [ ] `START_HERE.md` - Phase 1.6進捗更新

---

**推定作業時間:** 8-12時間
**優先度:** 🔴 最優先
**担当者:** Claude Code
**開始予定:** 2026-03-14

---

**最終更新:** 2026-03-14 17:00 JST
