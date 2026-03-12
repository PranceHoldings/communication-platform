# コード重複・無駄な処理の分析レポート

**作成日:** 2026-03-12 16:00 JST
**最終更新:** 2026-03-12 22:50 JST
**分析対象:** 音声処理フロー全体
**目的:** 無駄な多重処理とコード重複を特定し、計画的に改善する
**ステータス:** Phase A完了（25%）、Phase B-D実装待ち（75%）

---

## エグゼクティブサマリー

現在の音声処理フローには以下の問題が存在：

1. **チャンク処理ロジックの重複** - S3取得・結合が2箇所に実装
2. **音声パイプラインの二重実装** - バッチ版とストリーミング版が併存
3. **無駄なS3アクセス** - session_endで不要なListObjects呼び出し
4. **S3パス構造の混乱** - 3種類のパスが存在（1つは削除済み）

**推定削減量:** 約300行のコード削減、S3 API呼び出し削減

---

## 1. チャンク処理ロジックの重複

### 問題の詳細

**speech_end handler** (lines 503-608)
```typescript
// S3からチャンクリスト取得 → ソート → ダウンロード → 結合
const chunkPrefix = `sessions/${speechEndSessionId}/realtime-chunks/`;
const listResponse = await s3Client.send(new ListObjectsV2Command(...));
const chunkKeys = (listResponse.Contents || [])
  .map(obj => obj.Key)
  .filter((key): key is string => !!key)
  .sort(); // ⚠️ 単純なsort()

// ダウンロードループ
for (const chunkKey of chunkKeys) {
  const getResponse = await s3Client.send(new GetObjectCommand(...));
  // ...
}
```

**session_end handler** (lines 1115-1161)
```typescript
// S3からチャンクリスト取得 → ソート → ダウンロード → 結合
const chunksPrefix = `sessions/${sessionId}/audio-chunks/`;
const listResponse = await s3Client.send(new ListObjectsV2Command(...));
const sortedChunks = sortChunksByTimestampAndIndex(listResponse.Contents); // ⚠️ 共通関数使用

// ダウンロードループ
for (const chunk of sortedChunks) {
  if (!chunk.Key) continue;
  const getResponse = await s3Client.send(new GetObjectCommand(...));
  // ...
}
```

### 問題点

1. **ソートロジックの不整合**
   - speech_end: 単純な `.sort()` → ファイル名の文字列ソート
   - session_end: `sortChunksByTimestampAndIndex()` → タイムスタンプ + チャンク番号ソート
   - 結果: speech_endで不正なチャンク順序の可能性

2. **エラーハンドリングの重複**
   - ダウンロード失敗時の処理が2箇所で異なる実装

3. **保守性の低下**
   - 一方を修正してももう一方は古いまま

### 影響範囲

- **ファイル:** `infrastructure/lambda/websocket/default/index.ts`
- **重複コード量:** 約100行
- **実行頻度:** 各セッションで2回（speech_end + session_end）

---

## 2. 音声処理パイプラインの二重実装

### 問題の詳細

#### バッチ版（Phase 1 - レガシー）

**index.ts: handleAudioProcessing** (lines 1394-1500)
```typescript
async function handleAudioProcessing(
  connectionId: string,
  audioBuffer: Buffer,
  connectionData?: ConnectionData
): Promise<void> {
  // STT -> AI (バッチ) -> TTS (バッチ) -> S3保存
  const processor = getAudioProcessor();
  const result = await processor.processAudio({
    audioData: audioBuffer,
    sessionId,
    scenarioPrompt: connectionData?.scenarioPrompt,
    scenarioLanguage: connectionData?.scenarioLanguage,
    conversationHistory: connectionData?.conversationHistory || [],
  });
  // ...
}
```

**audio-processor.ts: processAudio** (lines 112-172)
```typescript
async processAudio(options: ProcessAudioOptions): Promise<ProcessAudioResult> {
  // Step 1: Save audio to S3
  // Step 2: Transcribe (Azure STT)
  // Step 3: Generate AI (Bedrock - バッチ)
  // Step 4: Synthesize (ElevenLabs - バッチ)
  // Step 5: Save response audio
}
```

#### ストリーミング版（Phase 1.5 - 現在）

**index.ts: handleAudioProcessingStreaming** (lines 1520-1700)
```typescript
async function handleAudioProcessingStreaming(
  connectionId: string,
  audioBuffer: Buffer,
  connectionData?: ConnectionData
): Promise<void> {
  // STT -> AI (ストリーミング) -> TTS (ストリーミング) -> S3保存
  const processor = getAudioProcessor();
  const result = await processor.processAudioStreaming({
    audioData: audioBuffer,
    sessionId,
    scenarioPrompt: connectionData?.scenarioPrompt,
    scenarioLanguage: connectionData?.scenarioLanguage,
    conversationHistory: connectionData?.conversationHistory || [],
    callbacks: {
      onTranscriptComplete: async (transcript: string) => { ... },
      onAIChunk: async (chunk: string) => { ... },
      onAIComplete: async (fullText: string) => { ... },
      onTTSChunk: async (audioChunk: string, isFinal: boolean) => { ... },
      onTTSComplete: async (audio: Buffer, contentType: string) => { ... },
    },
  });
}
```

**audio-processor.ts: processAudioStreaming** (lines 609-780)
```typescript
async processAudioStreaming(options: ProcessAudioStreamingOptions): Promise<ProcessAudioResult> {
  // Step 1: Save audio to S3
  // Step 2: Transcribe (Azure STT)
  // Step 3: Stream AI (Bedrock - ストリーミング)
  // Step 4: Synthesize (ElevenLabs - WebSocket ストリーミング)
  // Step 5: Save response audio
}
```

### 使用状況

| Handler      | 使用する処理          | 理由                              |
| ------------ | --------------------- | --------------------------------- |
| speech_end   | **ストリーミング版**  | Phase 1.5のリアルタイム処理       |
| session_end  | **バッチ版**          | レガシー互換性（実質的には未使用）|

### 問題点

1. **バッチ版は実質的に不要**
   - session_endで呼ばれるが、realtime-chunksは既にspeech_endで処理済み
   - S3に残っているチャンクがない場合はスキップされる
   - **無駄なS3 ListObjects API呼び出し**

2. **STT・S3保存ロジックの重複**
   - `saveAudioToS3()`, `transcribeAudio()` の呼び出しが両方に存在
   - どちらも同じ処理を実行（重複コード約150行）

3. **保守性の問題**
   - バグ修正やAzure STT設定変更時に2箇所修正が必要
   - バージョン不整合のリスク

### 影響範囲

- **ファイル:** `infrastructure/lambda/websocket/default/index.ts`, `audio-processor.ts`
- **重複コード量:** 約300行
- **実行頻度:** 各セッションで1回（実際にはバッチ版はスキップされる）

---

## 3. 無駄な処理の多重実行

### 現在のフロー（Phase 1.5）

```
┌────────────────────────────────────────────────────┐
│ ユーザーが話す                                      │
└─────────────┬──────────────────────────────────────┘
              ▼
┌────────────────────────────────────────────────────┐
│ audio_chunk_realtime: S3に保存                      │
│ Path: sessions/{id}/realtime-chunks/chunk-*.webm   │
└─────────────┬──────────────────────────────────────┘
              ▼
┌────────────────────────────────────────────────────┐
│ speech_end: リアルタイムチャンク処理 ✅             │
│ - S3 realtime-chunks/ から取得                     │
│ - WebM → WAV 変換                                  │
│ - STT → AI (ストリーミング) → TTS (ストリーミング)  │
│ - チャンク削除                                     │
└─────────────┬──────────────────────────────────────┘
              ▼
┌────────────────────────────────────────────────────┐
│ session_end: レガシーチャンク処理を試行 ❌          │
│ - S3 audio-chunks/ から取得を試みる                │
│ - ListObjectsV2Command実行 ⚠️ 無駄なAPI呼び出し    │
│ - 結果: 0件 → スキップ                             │
│ - 理由: このパスは使われていない                   │
└────────────────────────────────────────────────────┘
```

### 問題点

1. **無駄なS3 API呼び出し**
   - `audio-chunks/` パスは Phase 1.5 では使用されていない
   - session_end で毎回 ListObjectsV2Command を実行
   - 結果は常に0件だがAPI呼び出しは発生（コスト・レイテンシ）

2. **条件分岐の複雑化**
   - `if (audioChunksCount > 0)` チェック
   - `if (listResponse.Contents.length === 0)` チェック
   - 実際には常にfalseだがコードは残存

### 推定コスト

- S3 ListObjectsV2: $0.005 per 1,000 requests
- 想定セッション数: 1,000/month
- 無駄なコスト: 約$0.005/month（微小だが設計上の問題）

---

## 4. S3パス構造の混乱

### 現在のS3パス構造

| パス                                      | 用途                   | Phase | 状態          |
| ----------------------------------------- | ---------------------- | ----- | ------------- |
| `sessions/{id}/realtime-chunks/`          | リアルタイムチャンク   | 1.5   | ✅ 使用中      |
| `sessions/{id}/audio-chunks/`             | レガシーチャンク       | 1.0   | ⚠️ 未使用      |
| `sessions/{id}/chunks/temp/audio/`        | audio_data_part用      | 1.0   | ❌ 削除済み    |
| `sessions/{id}/audio/ai-response-*.mp3`   | AI応答音声             | 全体  | ✅ 使用中      |
| `sessions/{id}/audio/input-*.wav`         | ユーザー音声（監査用） | 全体  | ✅ 使用中      |

### 問題点

1. **使用されていないパスが残存**
   - `audio-chunks/` は Phase 1.5 で完全に置き換えられた
   - session_end でチェックされるが実際には存在しない

2. **命名の不整合**
   - `realtime-chunks` vs `audio-chunks` - 用途が不明確
   - 新規開発者が混乱するリスク

3. **ドキュメント不足**
   - どのパスが有効か、どのPhaseで使用されるか不明確

---

## 5. 改善計画（4フェーズ）

### Phase A: チャンク処理の共通化（優先度：🔴 高）

**目的:** S3チャンク取得・結合ロジックを共通関数化

**実装内容:**
```typescript
// 新規関数: chunk-utils.ts に追加
export async function downloadAndCombineChunks(
  s3Client: S3Client,
  bucket: string,
  prefix: string,
  sortFn?: (chunks: S3Object[]) => S3Object[]
): Promise<{
  combinedBuffer: Buffer;
  chunkCount: number;
  totalSize: number;
}> {
  // 1. List S3 objects
  const listResponse = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));

  // 2. Sort chunks (use provided sort function or default)
  const sortedChunks = sortFn
    ? sortFn(listResponse.Contents || [])
    : sortChunksByTimestampAndIndex(listResponse.Contents || []);

  // 3. Download all chunks
  const buffers: Buffer[] = [];
  for (const chunk of sortedChunks) {
    if (!chunk.Key) continue;
    const getResponse = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: chunk.Key }));
    if (getResponse.Body) {
      const buffer = await getResponse.Body.transformToByteArray();
      buffers.push(Buffer.from(buffer));
    }
  }

  // 4. Combine
  const combined = Buffer.concat(buffers);

  return {
    combinedBuffer: combined,
    chunkCount: buffers.length,
    totalSize: combined.length,
  };
}
```

**変更箇所:**
- speech_end handler: 共通関数を使用
- session_end handler: 共通関数を使用

**期待効果:**
- コード削減: 約80行
- バグ修正時の工数削減: 1箇所のみ修正
- テストコード作成が容易

---

### Phase B: 音声処理パイプラインの統一（優先度：🔴 高）

**目的:** バッチ版を削除し、ストリーミング版のみを使用

**実装内容:**

1. **handleAudioProcessing を削除**
   - session_end で handleAudioProcessingStreaming を使用
   - コールバックを簡略化（session_endではストリーミング不要）

2. **processAudio を削除**
   - audio-processor.ts からバッチ版を削除
   - processAudioStreaming のみを維持

3. **session_end の音声処理を削除**
   - speech_end で既に処理済みのため不要
   - `if (audioChunksCount > 0)` ブロック全体を削除

**変更箇所:**
```typescript
// BEFORE (session_end)
if (connectionData?.audioChunksCount && connectionData.audioChunksCount > 0) {
  // 100行以上のチャンク処理ロジック
  await handleAudioProcessing(connectionId, combinedAudioBuffer, connectionData);
}

// AFTER (session_end)
// 音声処理は speech_end で完結 - session_end では不要
console.log('[session_end] Audio processing already completed by speech_end');
```

**期待効果:**
- コード削減: 約250行
- S3 API呼び出し削減: ListObjectsV2 x 1回/セッション
- 保守性向上: 音声処理ロジックが単一のパスに集約

---

### Phase C: S3パス構造のクリーンアップ（優先度：🟡 中）

**目的:** 不要なS3パスを削除し、構造を明確化

**実装内容:**

1. **audio-chunks/ パスの完全削除**
   - session_end から `audio-chunks/` チェックを削除
   - ドキュメント更新

2. **S3パス命名規則の統一**
   ```typescript
   // 統一後の命名
   sessions/{id}/chunks/realtime/chunk-{seq}.webm  // リアルタイムチャンク
   sessions/{id}/audio/user-{timestamp}.wav        // ユーザー音声（監査用）
   sessions/{id}/audio/ai-{timestamp}.mp3          // AI応答音声
   sessions/{id}/video/chunks/chunk-{seq}.webm     // ビデオチャンク
   sessions/{id}/video/final.webm                  // 最終ビデオ
   ```

3. **S3パス定数の一元管理**
   ```typescript
   // shared/config/s3-paths.ts (新規)
   export const S3_PATHS = {
     REALTIME_CHUNKS: (sessionId: string) => `sessions/${sessionId}/chunks/realtime/`,
     USER_AUDIO: (sessionId: string) => `sessions/${sessionId}/audio/`,
     AI_AUDIO: (sessionId: string) => `sessions/${sessionId}/audio/`,
     VIDEO_CHUNKS: (sessionId: string) => `sessions/${sessionId}/video/chunks/`,
     FINAL_VIDEO: (sessionId: string) => `sessions/${sessionId}/video/`,
   } as const;
   ```

**期待効果:**
- コードの可読性向上
- S3パス変更時の修正箇所削減
- 新規開発者のオンボーディング時間短縮

---

### Phase D: フラグとロックの整理（優先度：🟡 中）

**目的:** 不要なフラグを削除し、処理フローを簡潔化

**実装内容:**

1. **フラグの統合**
   ```typescript
   // BEFORE
   interface ConnectionData {
     audioProcessingInProgress?: boolean;     // audio_data_part用（削除済み）
     realtimeAudioProcessing?: boolean;       // speech_end用（使用中）
     sessionEndReceived?: boolean;            // session_end待機用
   }

   // AFTER
   interface ConnectionData {
     audioProcessing?: boolean;               // 統合フラグ
     audioProcessingStartTime?: number;       // タイムアウト検出用
   }
   ```

2. **ロックメカニズムの見直し**
   - DynamoDB conditional write は維持
   - TTLを5分 → 2分に短縮（Lambda timeout 15分を考慮）

3. **不要なフラグの削除**
   - `audioChunksCount` - realtime-chunks/ に統一したため不要
   - `currentAudioChunkId` - audio_data_part削除により不要

**期待効果:**
- ConnectionData型の簡素化
- 条件分岐の削減
- バグ発生リスクの低減

---

## 6. 実装順序とリスク評価

| Phase | タスク                     | 優先度 | リスク | 工数   | 依存関係 |
| ----- | -------------------------- | ------ | ------ | ------ | -------- |
| A     | チャンク処理の共通化       | 🔴 高   | 低     | 2時間  | なし     |
| B     | 音声パイプラインの統一     | 🔴 高   | 中     | 3時間  | Phase A  |
| C     | S3パス構造のクリーンアップ | 🟡 中   | 低     | 1時間  | Phase B  |
| D     | フラグとロックの整理       | 🟡 中   | 中     | 2時間  | Phase B  |

**合計推定工数:** 8時間
**推定削減コード量:** 約400行

---

## 7. テスト計画

### 単体テスト

1. **downloadAndCombineChunks 関数**
   - 正常系: 複数チャンク結合
   - 異常系: チャンク欠損時の挙動
   - 異常系: S3エラー時のリトライ

2. **processAudioStreaming 関数**
   - 正常系: STT → AI → TTS パイプライン
   - 異常系: Azure STT失敗時のエラーハンドリング
   - 異常系: Bedrock タイムアウト時の挙動

### 統合テスト

1. **speech_end → session_end フロー**
   - 音声処理が重複しないことを確認
   - S3チャンクが正しく削除されることを確認

2. **E2Eテスト**
   - ユーザーが話す → AI応答 → 音声再生
   - 複数回の発話 → 会話履歴の正確性

### 回帰テスト

- Phase 1.5 Day 12 の音声バグが再発しないことを確認
- 沈黙タイマーが正常に動作することを確認

---

## 8. ロールバック計画

各Phaseは独立しているため、個別にロールバック可能：

1. **Phase A失敗時**
   - 共通関数削除
   - speech_end, session_end を元のコードに戻す

2. **Phase B失敗時**
   - handleAudioProcessing 復活
   - session_end で元のロジックを使用

3. **Phase C/D失敗時**
   - Phase A/Bの成果は維持可能

---

## 9. 期待効果

### 定量的効果

| 指標                    | 現在    | 改善後  | 削減率 |
| ----------------------- | ------- | ------- | ------ |
| コード行数              | 2,800行 | 2,400行 | 14%    |
| 重複コード              | 400行   | 0行     | 100%   |
| S3 API呼び出し/セッション | 6回     | 5回     | 17%    |
| 音声処理関数            | 4個     | 2個     | 50%    |

### 定性的効果

1. **保守性の向上**
   - バグ修正時の変更箇所削減
   - コードレビューの効率化

2. **可読性の向上**
   - 処理フローが明確化
   - 新規開発者のオンボーディング時間短縮

3. **パフォーマンス向上**
   - 無駄なS3 API呼び出し削減
   - Lambda実行時間の短縮

4. **コスト削減**
   - S3 API呼び出し削減（微小だが設計として正しい）

---

## 10. 結論

現在の音声処理フローには、Phase 1 → Phase 1.5 への移行過程で残存したレガシーコードによる重複と無駄が多数存在します。

**最優先対応:**
- Phase A: チャンク処理の共通化
- Phase B: 音声パイプラインの統一

これにより約350行のコード削減と、保守性の大幅な向上が期待できます。

---

**次のアクション:**
1. この分析レポートをレビュー
2. Phase A の実装開始
3. テスト実行
4. Phase B の実装開始
