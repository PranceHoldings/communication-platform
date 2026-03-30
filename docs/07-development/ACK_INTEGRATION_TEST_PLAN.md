# ACK機能統合テスト計画書 (Phase 1.6.1)

**作成日:** 2026-03-21
**ステータス:** 統合完了・テスト準備完了
**目的:** ACK追跡システムの信頼性検証

---

## 📋 統合完了サマリー

### ✅ 実装完了項目

1. **型定義 (packages/shared/src/types/index.ts)**
   - ChunkAckMessage interface定義
   - ServerToClientMessage union型に追加

2. **Frontend ACK追跡 (apps/web/hooks/useAudioRecorder.ts)**
   - PendingChunk管理（chunkId, retryCount, sentAt）
   - ACK timeout処理（5秒）
   - Exponential backoff retry（1s, 2s, 4s）
   - 最大3回リトライ
   - handleChunkAck callback実装

3. **Backend ACK送信 (infrastructure/lambda/websocket/default/index.ts)**
   - audio_chunk_realtime handler: lines 635-661
   - video_chunk_part handler: lines 1298-1309
   - unified chunk_ack message送信
   - status: 'saved' | 'error' | 'duplicate'
   - error詳細情報（code, message, details）

4. **WebSocket routing (apps/web/hooks/useWebSocket.ts)**
   - case 'chunk_ack' handler追加
   - onChunkAckRef callback統合
   - onChunkAck option追加

5. **SessionPlayer統合 (apps/web/components/session-player/index.tsx)**
   - handleChunkAck callback実装（lines 772-825）
   - pendingChunks state管理
   - ackTimeouts管理
   - toast通知（成功・失敗）

---

## 🧪 テストシナリオ

### Test Case 1: 正常フロー（ACK受信成功）

**目的:** チャンク送信 → ACK受信 → pending削除の正常動作確認

**手順:**
1. Dev環境でセッション開始
2. マイクで音声入力（3-5秒）
3. ブラウザ DevTools Console監視
4. CloudWatch Logs確認

**期待される動作:**
```
[SessionPlayer] Audio chunk sent: { chunkId: "audio-1-1234567890", size: 4096 }
[useWebSocket] <<<< RECEIVED RAW: {"type":"chunk_ack","chunkId":"audio-1-1234567890","status":"saved","timestamp":1234567890}
[SessionPlayer] Chunk ACK received: { chunkId: "audio-1-1234567890", status: "saved" }
[SessionPlayer] Pending chunk removed: { chunkId: "audio-1-1234567890", latency: 123 }
```

**成功基準:**
- ✅ chunkId一致
- ✅ status: 'saved'
- ✅ timeout cleared
- ✅ pending chunk削除
- ✅ latency 100-500ms

---

### Test Case 2: タイムアウト・リトライ（ACK未受信）

**目的:** ACKタイムアウト時の自動リトライ動作確認

**手順:**
1. **Lambda関数の一時的停止（テスト環境のみ）**
   ```bash
   # WebSocket Lambda関数を一時的に無効化（または5秒以上の遅延を挿入）
   # 実装方法: Lambda handler内でACK送信をコメントアウト
   ```

2. セッション開始、音声入力
3. Console監視（5秒間隔でリトライログ確認）

**期待される動作:**
```
[SessionPlayer] Audio chunk sent: { chunkId: "audio-1-1234567890", retryCount: 0 }
[SessionPlayer] ACK timeout for chunk: audio-1-1234567890
[SessionPlayer] Retrying chunk (1/3) after 1000ms
[SessionPlayer] Audio chunk sent: { chunkId: "audio-1-1234567890", retryCount: 1 }
[SessionPlayer] ACK timeout for chunk: audio-1-1234567890
[SessionPlayer] Retrying chunk (2/3) after 2000ms
[SessionPlayer] Audio chunk sent: { chunkId: "audio-1-1234567890", retryCount: 2 }
[SessionPlayer] ACK timeout for chunk: audio-1-1234567890
[SessionPlayer] Retrying chunk (3/3) after 4000ms
[SessionPlayer] Audio chunk sent: { chunkId: "audio-1-1234567890", retryCount: 3 }
[SessionPlayer] Max retries exceeded for chunk: audio-1-1234567890
[Toast Error] "Failed to send audio chunk after 3 retries"
```

**成功基準:**
- ✅ 5秒後に自動リトライ開始
- ✅ Exponential backoff適用（1s → 2s → 4s）
- ✅ 最大3回リトライ
- ✅ 最終的にエラートースト表示
- ✅ pending chunk削除

---

### Test Case 3: ACKエラー（Backend error）

**目的:** Backend側のエラー（S3アップロード失敗等）時の動作確認

**手順:**
1. **Lambda関数でエラーACK送信をシミュレート**
   ```typescript
   // infrastructure/lambda/websocket/default/index.ts
   // 一時的に以下のコードを追加
   await sendToConnection(connectionId, {
     type: 'chunk_ack',
     chunkId: rtChunkId,
     status: 'error',
     timestamp: Date.now(),
     error: {
       code: 'S3_UPLOAD_FAILED',
       message: 'Failed to upload audio chunk to S3',
       details: { bucket: 'test-bucket', key: 'test-key' }
     }
   });
   ```

2. セッション開始、音声入力
3. Console監視

**期待される動作:**
```
[SessionPlayer] Chunk ACK received: { chunkId: "audio-1-1234567890", status: "error" }
[SessionPlayer] Chunk error - retrying (1/3): S3_UPLOAD_FAILED
[SessionPlayer] Audio chunk sent: { chunkId: "audio-1-1234567890", retryCount: 1 }
[SessionPlayer] Chunk ACK received: { chunkId: "audio-1-1234567890", status: "error" }
[SessionPlayer] Chunk error - retrying (2/3): S3_UPLOAD_FAILED
...
[SessionPlayer] Max retries exceeded for chunk: audio-1-1234567890
[Toast Error] "Failed to send audio chunk: S3_UPLOAD_FAILED"
```

**成功基準:**
- ✅ error ACK受信
- ✅ エラー詳細表示（code, message）
- ✅ 自動リトライ開始
- ✅ 最大3回リトライ後にエラー通知
- ✅ CloudWatch Logsにエラー記録

---

### Test Case 4: Duplicate ACK（重複ACK）

**目的:** 既に処理済みのchunkIdに対するACK受信時の動作確認

**手順:**
1. 正常なセッション実行
2. Backend側で同じchunkIdに対して複数回ACK送信（テスト用）
3. Console監視

**期待される動作:**
```
[SessionPlayer] Chunk ACK received: { chunkId: "audio-1-1234567890", status: "saved" }
[SessionPlayer] Pending chunk removed: { chunkId: "audio-1-1234567890" }
[SessionPlayer] Chunk ACK received: { chunkId: "audio-1-1234567890", status: "duplicate" }
[SessionPlayer] ACK for unknown/processed chunk: audio-1-1234567890
```

**成功基準:**
- ✅ 1回目のACKで正常削除
- ✅ 2回目のACKで警告ログのみ（エラーなし）
- ✅ アプリケーション動作に影響なし

---

### Test Case 5: 録画成功率測定（実運用シミュレーション）

**目的:** 実際のセッションでの録画信頼性測定

**手順:**
1. Dev環境で10セッション実行（各30秒）
2. 各セッションで10-20チャンク送信
3. 統計情報収集:
   - 送信チャンク総数
   - 成功ACK数
   - リトライ数
   - 最終失敗数
   - 平均latency

**期待される結果:**
```
録画成功率: 99%+ (目標: 99.9%)
平均latency: 100-300ms
リトライ率: <1%
最終失敗率: <0.1%
```

**測定方法:**
```typescript
// SessionPlayer内に統計カウンター追加
const stats = useRef({
  totalChunks: 0,
  successfulAcks: 0,
  retries: 0,
  failures: 0,
  latencies: [] as number[],
});

// セッション終了時に統計表示
console.log('[ACK Statistics]', {
  successRate: (stats.current.successfulAcks / stats.current.totalChunks * 100).toFixed(2) + '%',
  avgLatency: (stats.current.latencies.reduce((a, b) => a + b, 0) / stats.current.latencies.length).toFixed(2) + 'ms',
  retryRate: (stats.current.retries / stats.current.totalChunks * 100).toFixed(2) + '%',
  failureRate: (stats.current.failures / stats.current.totalChunks * 100).toFixed(2) + '%',
});
```

**成功基準:**
- ✅ 録画成功率 ≥ 99%
- ✅ 平均latency ≤ 500ms
- ✅ リトライ率 ≤ 2%
- ✅ 最終失敗率 ≤ 0.5%

---

## 🔧 テスト実行環境

### 必須設定

**環境変数:**
```bash
NEXT_PUBLIC_WS_ENDPOINT=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
DATABASE_URL=postgresql://pranceadmin:...@...cluster-....us-east-1.rds.amazonaws.com:5432/prance
```

**Lambda関数デプロイ:**
```bash
cd infrastructure
npm run deploy:lambda
```

**フロントエンド起動:**
```bash
npm run dev
```

---

## 📊 テスト結果記録テンプレート

### Test Execution Report

**日時:** YYYY-MM-DD HH:MM UTC
**テスター:** [Name]
**環境:** Dev / Staging / Production

#### Test Case 1: 正常フロー
- [ ] Pass / [ ] Fail
- チャンク送信数: ___
- 成功ACK数: ___
- 平均latency: ___ ms
- 備考: ___

#### Test Case 2: タイムアウト・リトライ
- [ ] Pass / [ ] Fail
- リトライ回数: ___
- Backoff時間: 1s, 2s, 4s (✓ / ✗)
- エラートースト表示: (✓ / ✗)
- 備考: ___

#### Test Case 3: ACKエラー
- [ ] Pass / [ ] Fail
- エラーコード検出: (✓ / ✗)
- リトライ実行: (✓ / ✗)
- 最終エラー通知: (✓ / ✗)
- 備考: ___

#### Test Case 4: Duplicate ACK
- [ ] Pass / [ ] Fail
- 警告ログ出力: (✓ / ✗)
- アプリ動作影響: (✓ なし / ✗ あり)
- 備考: ___

#### Test Case 5: 録画成功率
- [ ] Pass / [ ] Fail
- セッション数: ___ / 10
- 録画成功率: ___ %
- 平均latency: ___ ms
- リトライ率: ___ %
- 最終失敗率: ___ %
- 備考: ___

---

## 🚨 既知の問題・注意事項

### 1. WebSocketメッセージ順序

**問題:** ネットワーク遅延により、ACKメッセージが遅延チャンクより先に到着する可能性

**対策:** pending chunk存在チェック（既に実装済み）

### 2. Lambda Cold Start

**問題:** Lambda cold start時、ACK送信が5秒以上遅延する可能性

**対策:** Provisioned Concurrency設定（将来対応）

### 3. CloudWatch Logs遅延

**問題:** CloudWatch Logsの表示が実際のイベントから10-30秒遅延

**対策:** ブラウザConsoleログを主に使用

---

## 📝 次のステップ

### Phase 1.6.1完了条件

- [ ] Test Case 1-5すべてPass
- [ ] 録画成功率 ≥ 99%
- [ ] ドキュメント更新（START_HERE.md, SESSION_HISTORY.md）
- [ ] Task #7を「completed」に更新

### Phase 1.6.2（オプション・将来対応）

- Video chunk ACK統合（現在はaudio chunkのみ）
- 統計ダッシュボード（録画成功率リアルタイム表示）
- Retry戦略最適化（動的backoff調整）

---

**最終更新:** 2026-03-21
**ステータス:** テスト実行待ち
