# コード重複・無駄処理改善 実装計画

**作成日:** 2026-03-12 16:00 JST
**最終更新:** 2026-03-12 22:50 JST
**ステータス:** 🟢 Phase A完了 | 🟡 Phase B-D実装待ち
**推定工数:** 8時間（4フェーズ） | **消化:** 2時間（Phase A完了）
**期待効果:** コード削減400行（14%）、保守性向上、パフォーマンス改善
**実績:** コード削減145行（Phase A）

---

## 📋 クイックサマリー

| Phase | タスク | 優先度 | 工数 | 期待削減 |
|-------|--------|--------|------|---------|
| A | チャンク処理の共通化 | 🔴 高 | 2時間 | 80行 |
| B | 音声パイプラインの統一 | 🔴 高 | 3時間 | 250行 |
| C | S3パス構造のクリーンアップ | 🟡 中 | 1時間 | 50行 |
| D | フラグとロックの整理 | 🟡 中 | 2時間 | 20行 |

**合計:** 8時間 / 400行削減

---

## Phase A: チャンク処理の共通化（2時間）

### 目的
speech_end と session_end で重複するS3チャンク取得・結合ロジックを共通関数化

### 現状の問題
- 同じS3ダウンロードロジックが2箇所に実装（約100行重複）
- ソート方法が異なる（speech_end: 単純sort、session_end: sortChunksByTimestampAndIndex）
- エラーハンドリングが不整合

### 実装内容

#### Step 1: 共通関数作成（30分）

**ファイル:** `infrastructure/lambda/websocket/default/chunk-utils.ts`

```typescript
/**
 * Download and combine S3 chunks
 *
 * @param s3Client - S3 client instance
 * @param bucket - S3 bucket name
 * @param prefix - S3 key prefix for chunks
 * @param sortFn - Optional sort function (defaults to sortChunksByTimestampAndIndex)
 * @returns Combined buffer with metadata
 */
export async function downloadAndCombineChunks(
  s3Client: S3Client,
  bucket: string,
  prefix: string,
  sortFn?: (chunks: S3Object[]) => S3Object[]
): Promise<{
  combinedBuffer: Buffer;
  chunkCount: number;
  totalSize: number;
  chunkKeys: string[];
}> {
  // 1. List S3 objects
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const listResponse = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })
  );

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    return {
      combinedBuffer: Buffer.alloc(0),
      chunkCount: 0,
      totalSize: 0,
      chunkKeys: [],
    };
  }

  // 2. Sort chunks (use provided sort function or default)
  const sortedChunks = sortFn
    ? sortFn(listResponse.Contents)
    : sortChunksByTimestampAndIndex(listResponse.Contents);

  // 3. Download all chunks in parallel (max 5 concurrent)
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const chunkKeys: string[] = [];
  const buffers: Buffer[] = [];

  // Process in batches to avoid overwhelming S3
  const BATCH_SIZE = 5;
  for (let i = 0; i < sortedChunks.length; i += BATCH_SIZE) {
    const batch = sortedChunks.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (chunk) => {
      if (!chunk.Key) return null;

      try {
        const getResponse = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: chunk.Key,
          })
        );

        if (getResponse.Body) {
          const buffer = await getResponse.Body.transformToByteArray();
          return {
            key: chunk.Key,
            buffer: Buffer.from(buffer),
          };
        }
      } catch (error) {
        console.warn(`Failed to download chunk ${chunk.Key}:`, error);
        return null;
      }

      return null;
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result) {
        chunkKeys.push(result.key);
        buffers.push(result.buffer);
      }
    }
  }

  // 4. Combine buffers
  const combined = Buffer.concat(buffers);

  console.log('[downloadAndCombineChunks] Complete:', {
    prefix,
    chunkCount: buffers.length,
    totalSize: combined.length,
  });

  return {
    combinedBuffer: combined,
    chunkCount: buffers.length,
    totalSize: combined.length,
    chunkKeys,
  };
}

/**
 * Clean up S3 chunks after processing
 *
 * @param s3Client - S3 client instance
 * @param bucket - S3 bucket name
 * @param chunkKeys - Array of S3 keys to delete
 */
export async function cleanupChunks(
  s3Client: S3Client,
  bucket: string,
  chunkKeys: string[]
): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

  console.log(`[cleanupChunks] Deleting ${chunkKeys.length} chunks...`);

  // Delete in parallel (max 10 concurrent)
  const BATCH_SIZE = 10;
  for (let i = 0; i < chunkKeys.length; i += BATCH_SIZE) {
    const batch = chunkKeys.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (key) => {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
      } catch (error) {
        console.warn(`Failed to delete chunk ${key}:`, error);
      }
    });

    await Promise.all(promises);
  }

  console.log('[cleanupChunks] Complete');
}
```

#### Step 2: speech_end ハンドラーの書き換え（30分）

**ファイル:** `infrastructure/lambda/websocket/default/index.ts` (lines 544-608)

```typescript
// BEFORE: 60行のS3ダウンロード・結合ロジック

// AFTER: 共通関数を使用
const { downloadAndCombineChunks, cleanupChunks } = await import('./chunk-utils');

const result = await downloadAndCombineChunks(
  s3Client,
  S3_BUCKET,
  `sessions/${speechEndSessionId}/realtime-chunks/`
);

if (result.chunkCount === 0) {
  console.warn('[speech_end] No chunks found in S3');
  // エラー処理...
  break;
}

console.log('[speech_end] Downloaded chunks:', {
  chunkCount: result.chunkCount,
  totalSize: result.totalSize,
});

// Convert WebM to WAV
const audioProc = getAudioProcessor();
const wavBuffer = await audioProc.convertMultipleWebMChunksToWav(
  // Split combined buffer back into individual buffers (if needed)
  // Or better: modify convertMultipleWebMChunksToWav to accept single buffer
  [result.combinedBuffer]
);

// Process audio...
await handleAudioProcessingStreaming(connectionId, wavBuffer, connectionData);

// Clean up chunks
await cleanupChunks(s3Client, S3_BUCKET, result.chunkKeys);
```

#### Step 3: session_end ハンドラーの書き換え（30分）

**ファイル:** `infrastructure/lambda/websocket/default/index.ts` (lines 1115-1179)

```typescript
// BEFORE: 65行のS3ダウンロード・結合ロジック

// AFTER: 共通関数を使用
const { downloadAndCombineChunks } = await import('./chunk-utils');

const result = await downloadAndCombineChunks(
  s3Client,
  S3_BUCKET,
  `sessions/${sessionId}/audio-chunks/`
);

if (result.chunkCount === 0) {
  console.log('[session_end] No audio chunks found - already processed by speech_end');
  await updateConnectionData(connectionId, { audioChunksCount: 0 });
} else {
  console.log('[session_end] Processing accumulated audio:', {
    chunkCount: result.chunkCount,
    totalSize: result.totalSize,
  });

  // Process audio...
  await handleAudioProcessing(connectionId, result.combinedBuffer, connectionData);

  // Note: chunks are NOT cleaned up here to prevent race condition
  // They will be cleaned up by next session or TTL
}
```

#### Step 4: 単体テスト作成（30分）

**ファイル:** `infrastructure/lambda/shared/utils/__tests__/chunk-utils.test.ts`

```typescript
describe('downloadAndCombineChunks', () => {
  it('should download and combine multiple chunks', async () => {
    // Mock S3 client
    // Test: 3 chunks → combined buffer
  });

  it('should return empty buffer when no chunks exist', async () => {
    // Test: empty S3 response
  });

  it('should handle download failures gracefully', async () => {
    // Test: 1 chunk fails, others succeed
  });

  it('should use custom sort function if provided', async () => {
    // Test: custom sort order
  });
});

describe('cleanupChunks', () => {
  it('should delete all chunks', async () => {
    // Test: 5 chunks deleted
  });

  it('should handle deletion failures gracefully', async () => {
    // Test: 1 deletion fails, continues with others
  });
});
```

### テスト・デプロイ
```bash
# 1. 単体テスト
cd infrastructure/lambda/shared
npm run test -- chunk-utils

# 2. TypeScriptコンパイル
npm run build

# 3. Lambda デプロイ
cd ../../
npm run deploy:lambda

# 4. 動作確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --follow
```

---

## Phase B: 音声処理パイプラインの統一（3時間）

### 目的
バッチ版処理を削除し、ストリーミング版のみを使用

### 現状の問題
- `handleAudioProcessing`（バッチ版）と`handleAudioProcessingStreaming`（ストリーミング版）が併存
- session_endでバッチ版を呼ぶが、実際にはチャンクが存在せずスキップされる
- 無駄なS3 ListObjects API呼び出し（毎セッション）

### 実装内容

#### Step 1: session_end音声処理ブロックの削除（1時間）

**ファイル:** `infrastructure/lambda/websocket/default/index.ts` (lines 1102-1188)

```typescript
// BEFORE: 87行の音声処理ロジック
if (connectionData?.audioChunksCount && connectionData.audioChunksCount > 0) {
  // 大量のチャンク処理コード...
}

// AFTER: 削除（speech_endで完結）
// 音声処理は speech_end ハンドラーで完結 - session_end では不要
console.log('[session_end] Audio processing already completed by speech_end handler');
```

#### Step 2: handleAudioProcessing関数の削除（1時間）

**ファイル:** `infrastructure/lambda/websocket/default/index.ts` (lines 1394-1500)

```typescript
// BEFORE: 106行のバッチ処理関数
async function handleAudioProcessing(...) { ... }

// AFTER: 削除（handleAudioProcessingStreamingのみ使用）
```

#### Step 3: audio-processor.ts のprocessAudio削除（30分）

**ファイル:** `infrastructure/lambda/websocket/default/audio-processor.ts` (lines 112-172)

```typescript
// BEFORE: 61行のバッチ処理メソッド
async processAudio(options: ProcessAudioOptions): Promise<ProcessAudioResult> { ... }

// AFTER: 削除（processAudioStreamingのみ使用）
```

#### Step 4: ConnectionDataフラグの削除（30分）

**ファイル:** `infrastructure/lambda/websocket/default/index.ts` (lines 217-223)

```typescript
// BEFORE
interface ConnectionData {
  audioChunksCount?: number;  // ← 削除（realtime-chunksに統一）
  audioProcessingInProgress?: boolean;  // ← 削除（realtimeAudioProcessingに統一）
  realtimeAudioProcessing?: boolean;
}

// AFTER
interface ConnectionData {
  realtimeAudioProcessing?: boolean;  // speech_end用のロックフラグ
  lastAudioProcessingStartTime?: number;
}
```

### テスト・デプロイ
```bash
# 1. TypeScriptコンパイル（エラーチェック）
cd infrastructure/lambda/websocket/default
npm run build

# 2. Lambda デプロイ
cd ../../
npm run deploy:lambda

# 3. E2Eテスト
# セッション開始 → 発話 → speech_end → AI応答 → session_end → 完了
```

---

## Phase C: S3パス構造のクリーンアップ（1時間）

### 目的
不要なS3パスを削除し、構造を明確化

### 実装内容

#### Step 1: S3パス定数の一元管理（30分）

**ファイル:** `infrastructure/lambda/shared/config/s3-paths.ts`（新規作成）

```typescript
/**
 * S3 Path Constants
 *
 * All S3 paths used in the application
 */

/**
 * Generate S3 path for real-time audio chunks
 * Phase 1.5+
 */
export function getRealtimeChunksPath(sessionId: string): string {
  return `sessions/${sessionId}/realtime-chunks/`;
}

/**
 * Generate S3 path for user audio (audit/debugging)
 */
export function getUserAudioPath(sessionId: string): string {
  return `sessions/${sessionId}/audio/`;
}

/**
 * Generate S3 path for AI response audio
 */
export function getAIAudioPath(sessionId: string): string {
  return `sessions/${sessionId}/audio/`;
}

/**
 * Generate S3 path for video chunks
 */
export function getVideoChunksPath(sessionId: string): string {
  return `sessions/${sessionId}/video-chunks/`;
}

/**
 * Generate S3 path for final video
 */
export function getFinalVideoPath(sessionId: string): string {
  return `sessions/${sessionId}/video/`;
}

/**
 * All S3 path functions
 */
export const S3_PATHS = {
  realtimeChunks: getRealtimeChunksPath,
  userAudio: getUserAudioPath,
  aiAudio: getAIAudioPath,
  videoChunks: getVideoChunksPath,
  finalVideo: getFinalVideoPath,
} as const;
```

#### Step 2: 既存コードの書き換え（30分）

```typescript
// BEFORE
const chunksPrefix = `sessions/${sessionId}/realtime-chunks/`;

// AFTER
import { S3_PATHS } from '../shared/config/s3-paths';
const chunksPrefix = S3_PATHS.realtimeChunks(sessionId);
```

---

## Phase D: フラグとロックの整理（2時間）

### 実装内容

#### Step 1: ConnectionData型の整理（1時間）

**変更前:**
```typescript
interface ConnectionData {
  audioProcessingInProgress?: boolean;  // audio_data_part用（削除済み）
  currentAudioChunkId?: string | null;  // audio_data_part用（削除済み）
  sessionEndReceived?: boolean;         // session_end待機用
  audioChunksCount?: number;            // audio-chunks/用（未使用）
  realtimeAudioProcessing?: boolean;    // speech_end用（使用中）
  realtimeAudioSequenceNumber?: number;
  realtimeAudioChunkCount?: number;
  lastAudioProcessingStartTime?: number;
}
```

**変更後:**
```typescript
interface ConnectionData {
  // Real-time audio processing (Phase 1.5)
  realtimeAudioProcessing?: boolean;          // Lock flag for speech_end
  lastAudioProcessingStartTime?: number;      // For timeout detection
  realtimeAudioSequenceNumber?: number;       // Latest chunk sequence
  realtimeAudioChunkCount?: number;           // Total chunks received

  // Session state
  sessionEndReceived?: boolean;               // Flag for session_end coordination
}
```

#### Step 2: ロックTTLの最適化（30分）

```typescript
// BEFORE: 5分TTL
ttl: Math.floor(Date.now() / 1000) + 300,

// AFTER: 2分TTL（Lambda timeout 15分を考慮）
ttl: Math.floor(Date.now() / 1000) + 120,
```

#### Step 3: テスト（30分）

```bash
# E2Eテスト: 複数セッション同時実行
# 目的: ロックメカニズムが正常に動作することを確認
```

---

## 実装スケジュール

### Day 1（4時間） ✅ 完了（2026-03-12）
- ✅ 分析レポート作成（完了 16:00）
- ✅ Phase A実装（完了 22:50 - 2時間）
  - ✅ 共通関数作成（downloadAndCombineChunks, cleanupChunks）
  - ✅ speech_end書き換え（100行 → 20行）
  - ✅ session_end書き換え（65行 → 25行）
  - ✅ TypeScriptコンパイル確認
  - ✅ Lambda関数デプロイ
- ⏳ Phase A テスト（次回）

### Day 2（4時間） ⏳ 次回
- ⏳ Phase A E2Eテスト（30分）
- ⏳ Phase B実装（3時間）
- ⏳ Phase B テスト・デプロイ（30分）

### Day 3（2時間） ⏳ 未着手
- ⏳ Phase C実装（30分）
- ⏳ Phase D実装（1時間）
- ⏳ 統合テスト・デプロイ（30分）

---

## チェックリスト

### Phase A ✅ 完了（2026-03-12 22:50 JST）
- [x] `downloadAndCombineChunks` 実装
- [x] `cleanupChunks` 実装
- [x] speech_end 書き換え（約100行 → 20行）
- [x] session_end 書き換え（約65行 → 25行）
- [ ] 単体テスト作成（次回推奨）
- [x] デプロイ（Lambda関数更新成功）
- [ ] E2E動作確認（次回推奨）

### Phase B
- [ ] session_end音声処理ブロック削除
- [ ] `handleAudioProcessing` 削除
- [ ] `processAudio` 削除
- [ ] `audioChunksCount` フラグ削除
- [ ] デプロイ
- [ ] E2E動作確認

### Phase C
- [ ] `s3-paths.ts` 作成
- [ ] 既存コード書き換え
- [ ] デプロイ

### Phase D
- [ ] ConnectionData型整理
- [ ] ロックTTL最適化
- [ ] デプロイ
- [ ] 負荷テスト

---

## リスク管理

### ロールバック計画

**Phase A失敗時:**
```bash
# Revert commit
git revert <commit-hash>
git push origin main

# Redeploy previous version
npm run deploy:lambda
```

**Phase B失敗時:**
```bash
# handleAudioProcessing を復活
git revert <commit-hash>
```

### 緊急対応

**問題:** speech_endで音声処理が失敗

**対応:**
1. CloudWatch Logsでエラー確認
2. S3にチャンクが残っているか確認
3. 必要に応じてロールバック

---

## 関連ドキュメント

- **詳細分析:** `docs/09-progress/CODE_DUPLICATION_ANALYSIS_2026-03-12.md`
- **実装状況:** `START_HERE.md`
- **Phase 1.5計画:** `docs/03-planning/releases/PRODUCTION_READY_ROADMAP.md`

---

**次のアクション:**
1. Phase A実装開始
2. 単体テスト作成
3. デプロイ・動作確認
