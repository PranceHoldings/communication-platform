# AI会話フロー定義書

**バージョン:** 1.2
**作成日:** 2026-04-24
**最終更新:** 2026-04-24（v1.2 - TTSストリーミング再生 + バージイン実装）
**ステータス:** ✅ 現行実装を反映（v1.1.5 + 商用品質改善）

---

## 📋 概要

このドキュメントは、AIアバターとユーザー（人間の話者）の間で行われる音声会話の**完全なフロー**を定義する。

対象範囲：
- トリガーの種類と発火条件
- 各トリガーで行われる処理
- 管理すべき状態と遷移
- タイミング計測と反応の基準値
- エッジケースと競合状態の扱い

---

## 📐 システム境界

```
┌───────────────────────────────────────────────────────────┐
│  ブラウザ（Frontend）                                       │
│                                                            │
│  ┌─────────────────┐    ┌──────────────────────────────┐  │
│  │ AudioContext    │    │ SessionPlayer Component      │  │
│  │ (生音声解析)    │    │ ┌──────────────────────────┐ │  │
│  └────────┬────────┘    │ │ useAudioRecorder         │ │  │
│           │              │ │ useSilenceTimer          │ │  │
│           │              │ │ useAudioPlayer           │ │  │
│           │              │ │ useWebSocket             │ │  │
│           │              │ └──────────────────────────┘ │  │
│           └──────────────┤                              │  │
│                          └──────────┬───────────────────┘  │
└──────────────────────────────────── │ ───────────────────┘
                           WebSocket  │
                    ┌─────────────────▼────────────────────┐
                    │  AWS Lambda (WebSocket Default Handler) │
                    │  infrastructure/lambda/websocket/      │
                    │  default/index.ts                      │
                    │                                        │
                    │  ┌─────────┐ ┌──────────┐ ┌────────┐ │
                    │  │Audio    │ │Bedrock   │ │ElevenL │ │
                    │  │Processor│ │AI (LLM)  │ │abs TTS │ │
                    │  └────┬────┘ └────┬─────┘ └───┬────┘ │
                    └───────┼──────────┼────────────┼──────┘
                            │ Azure STT│            │
                    ┌───────▼──────────▼────────────▼──────┐
                    │  S3 (音声チャンク)                      │
                    │  DynamoDB (接続状態・会話履歴)          │
                    │  Aurora RDS (セッション記録)            │
                    └──────────────────────────────────────┘
```

---

## 🗺️ フローの全体像

```
[セッション開始]
      │
      ├─(1) セッション初期化
      │     WebSocket接続・authenticate送信
      │
      ├─(2) AI初回挨拶
      │     TTS一括生成 → audio_response URL送信 → 再生
      │
      ├─(3) ユーザー発話待機 ◄─────────────────────────────┐
      │     silenceTimer動作中                              │
      │                                                     │
      ├─(4a) ユーザー発話検出                               │
      │      speech確定(800ms継続) → restartRecording       │
      │                                                     │
      ├─(5) 音声チャンク送信(1秒ごと)                       │
      │     S3保存・ACK追跡                                 │
      │                                                     │
      ├─(6) 発話終了検出                                    │
      │     silence 500ms → speech_end送信                  │
      │                                                     │
      ├─(7) Lambda処理パイプライン                          │
      │     STT → AI → TTS                                  │
      │                                                     │
      ├─(8) AI応答ストリーミング                            │
      │     transcript → avatar_response → audio_chunk      │
      │                                                     │
      ├─(9) AI音声再生完了                                  │
      │     → silenceTimer再開 → (3)に戻る ──────────────────┘
      │
      ├─(4b) 無音タイムアウト（(3)で発生）
      │      → silence_prompt_request
      │      → AI促し生成・再生
      │      → (3)に戻る
      │
      └─(10) セッション終了
             session_end送信 → session_complete受信
```

---

## 🏷️ 状態定義

### フロントエンド状態（SessionPlayerのState）

```typescript
// セッション全体の状態
type SessionPhase =
  | 'IDLE'              // 未開始
  | 'CONNECTING'        // WebSocket接続中
  | 'AUTHENTICATING'    // authenticate送信後
  | 'GREETING'          // AI初回挨拶TTS再生中
  | 'WAITING_USER'      // ユーザー発話待機中（silenceTimer動作）
  | 'USER_SPEAKING'     // ユーザー発話中（音声チャンク送信中）
  | 'PROCESSING'        // speech_end送信済み・Lambda処理中
  | 'AI_RESPONDING'     // AI音声再生中
  | 'ENDING'            // session_end送信済み
  | 'COMPLETED'         // session_complete受信済み
  | 'ERROR';            // エラー状態

// 音声録音の状態（useAudioRecorder内）
type RecorderState =
  | 'INACTIVE'          // 未起動
  | 'RECORDING'         // 録音中（MediaRecorder active）
  | 'RESTARTING';       // restart中（新しいEBMLヘッダー生成中）

// AI応答中フラグ（isAiRespondingRef）
// trueの間はrestartRecordingを抑止する（スピーカーエコー誤検知防止）
```

### Lambda側の状態（DynamoDB ConnectionData）

```typescript
interface ConnectionData {
  // セッション識別
  connectionId: string;           // WebSocket接続ID (PK)
  sessionId?: string;             // Aurora RDS session.id
  
  // シナリオ設定
  scenarioPrompt?: string;        // AIシステムプロンプト
  scenarioLanguage?: string;      // 言語コード ('ja', 'en', ...)
  initialGreeting?: string;       // AI初回挨拶テキスト
  
  // 会話状態
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  turnCount?: number;             // 会話ターン数（上限管理）
  sessionStartTime?: number;      // セッション開始エポック(ms)
  
  // 音声チャンク管理
  realtimeAudioSequenceNumber?: number;   // 最新受信シーケンス番号
  realtimeAudioChunkCount?: number;       // 累計受信チャンク数
  realtimeAudioProcessing?: boolean;      // speech_end処理中フラグ
  lastAudioProcessingStartTime?: number;  // 処理開始タイムスタンプ
  receivedAudioChunks?: number[];         // 受信済みシーケンス番号配列
  expectedAudioSequence?: number;         // 期待する次のシーケンス番号
  lastCleanedUpSequence?: number;         // 最後に処理済みシーケンス
  
  // ビデオチャンク管理
  videoChunksCount?: number;
  receivedVideoChunks?: number[];
  expectedVideoSequence?: number;
  
  // 無音促し管理
  silenceTimeout?: number;                // 無音タイムアウト（秒）
  enableSilencePrompt?: boolean;          // 促し機能有効フラグ
  lastSilencePromptTime?: number;         // 最後の促し送信時刻
  
  // エラー管理
  lastErrorType?: string;
  errorAttemptCount?: number;
  sessionEndReceived?: boolean;           // session_end受信フラグ
  
  // TTL（自動削除）
  ttl: number;                            // Unix timestamp
}
```

### Aurora RDS セッション状態

```typescript
enum SessionStatus {
  ACTIVE     = 'ACTIVE',      // 会話進行中
  PROCESSING = 'PROCESSING',  // 最終処理中
  COMPLETED  = 'COMPLETED',   // 正常終了
  ERROR      = 'ERROR',       // エラー終了
}
```

---

## 🔔 トリガー一覧

| # | トリガー名 | 発生元 | 発生条件 |
|---|-----------|--------|---------|
| T1 | `SESSION_START` | Frontend | ユーザーが「開始」ボタンをクリック |
| T2 | `WS_CONNECTED` | useWebSocket | WebSocket onopen |
| T3 | `AUTHENTICATED` | Lambda | authenticate処理成功 |
| T4 | `GREETING_CHUNK` | Lambda | AI初回挨拶のTTSチャンク生成 |
| T5 | `GREETING_COMPLETE` | Lambda | AI初回挨拶TTS完了 |
| T6 | `AUDIO_LEVEL_HIGH` | useAudioRecorder (rAF) | 音量 > SPEECH_START_THRESHOLD (0.08) が 800ms継続 |
| T7 | `AUDIO_LEVEL_LOW` | useAudioRecorder (rAF) | 音量 < silenceThreshold (0.15) が 500ms継続 |
| T8 | `MEDIA_RECORDER_DATA` | MediaRecorder | ondataavailable (1秒timeslice) |
| T9 | `CHUNK_ACK` | Lambda | audio_chunk_realtime受信・S3保存完了 |
| T10 | `CHUNK_ACK_TIMEOUT` | useAudioRecorder | ACKなし 5000ms経過 |
| T11 | `SPEECH_END` | Frontend | T7トリガー後にonSpeechEnd()コールバック |
| T12 | `TRANSCRIPT_FINAL` | Lambda | Azure STT完了 |
| T13 | `AI_RESPONSE_CHUNK` | Lambda | Bedrock ストリーミングチャンク |
| T14 | `AI_RESPONSE_COMPLETE` | Lambda | Bedrock 応答完了 |
| T15 | `TTS_CHUNK` | Lambda | ElevenLabs TTSチャンク生成 |
| T16 | `TTS_COMPLETE` | Lambda | ElevenLabs TTS完了 |
| T17 | `AUDIO_PLAYBACK_ENDED` | useAudioPlayer | AudioSource.onended |
| T18 | `SILENCE_TIMEOUT` | useSilenceTimer | elapsedTime >= timeoutSeconds |
| T19 | `SESSION_END_USER` | Frontend | ユーザーが「終了」ボタンをクリック |
| T20 | `SESSION_COMPLETE` | Lambda | session_end処理完了 |
| T21 | `WS_DISCONNECTED` | useWebSocket | WebSocket onclose |
| T22 | `TURN_LIMIT_REACHED` | Lambda | turnCount >= MAX_CONVERSATION_TURNS |
| T23 | `VIDEO_CHUNK` | useWebSocket | ビデオチャンク送信（1秒ごと） |

---

## 📋 フェーズ別詳細フロー

### Phase 0: セッション開始（T1〜T3）

**概要:** WebSocket接続確立からAI側の準備完了まで

```
[ユーザーが「開始」ボタンをクリック] ────T1─────────────────────────────┐
                                                                          │
Frontend処理:                                                             │
  1. SessionPhase → 'CONNECTING'                                          │
  2. createSession() API呼び出し → sessionId取得                         │
  3. マイク・カメラのMediaStream取得                                      │
     navigator.mediaDevices.getUserMedia({audio:true, video:true})        │
  4. useWebSocket.connect() 実行                                          │
     WebSocket URL: wss://ws.app.prance.jp?token={jwt}                   │
                                                                          │
[WebSocket接続確立] ────T2────────────────────────────────────────────────┤
                                                                          │
Lambda (connect handler):                                                 │
  1. JWTトークン検証                                                      │
  2. DynamoDB に接続情報保存                                              │
     { connection_id, userId, orgId, ttl: now+86400s }                   │
                                                                          │
Frontend (onopen):                                                        │
  1. SessionPhase → 'AUTHENTICATING'                                      │
  2. authenticate メッセージ送信:                                         │
     {                                                                    │
       type: 'authenticate',                                              │
       sessionId,                                                         │
       scenarioTitle,                                                     │
       scenarioPrompt,       // AIシステムプロンプト全文                  │
       scenarioLanguage,     // 'ja' | 'en' | ...                         │
       initialGreeting,      // AI初回挨拶テキスト（任意）                │
       silenceTimeout,       // 無音タイムアウト秒数                      │
       enableSilencePrompt,  // 無音促し機能ON/OFF                        │
       wsAckTimeoutMs,       // クライアントACKタイムアウト               │
       wsMaxRetries,         // クライアントリトライ上限                  │
     }                                                                    │
                                                                          │
Lambda (authenticate handler):                                            │
  1. シナリオバリデーション（文字数・言語コード・プロンプト内容）         │
  2. ConnectionData に全パラメータ保存                                    │
     { scenarioPrompt, scenarioLanguage, initialGreeting,                 │
       conversationHistory: [], turnCount: 0,                             │
       sessionStartTime: Date.now() }                                     │
  3. authenticated メッセージ送信:                                        │
     { type: 'authenticated', timestamp, wsAckTimeoutMs, wsMaxRetries }   │
                                                                          │
[authenticated受信] ────T3────────────────────────────────────────────────┤
                                                                          │
Frontend (onAuthenticated):                                               │
  1. SessionPhase → 'GREETING'（initialGreetingがある場合）               │
     または 'WAITING_USER'（ない場合）                                    │
  2. useAudioRecorder.startRecording()                                    │
     - MediaRecorder.start(1000ms timeslice)                              │
     - AudioContext + AnalyserNode 初期化                                 │
     - monitorAudioLevel() rAFループ開始                                  │
     - audioLevel setState用 100ms interval 開始                          │
  3. useVideoRecorder.startRecording()（ある場合）                        │
  4. silenceTimer は WAITING_USER になるまで有効化しない                  │
```

**状態変化サマリー:**

| タイミング | SessionPhase | RecorderState | silenceTimer |
|-----------|-------------|---------------|--------------|
| T1直後 | CONNECTING | INACTIVE | disabled |
| T2直後 | AUTHENTICATING | INACTIVE | disabled |
| T3直後（挨拶あり） | GREETING | RECORDING | disabled |
| T3直後（挨拶なし） | WAITING_USER | RECORDING | enabled |

---

### Phase 1: AI初回挨拶（T4〜T5）

**概要:** Lambda側でTTSを生成し、フロントエンドへ完全音声URLで送信

**トリガー:** authenticated送信直後にLambdaが自動実行

**⚠️ 実装注意:** 初回挨拶（および silence_prompt_request）は、通常ターンと異なり
`audio_chunk` ストリーミングではなく、`generateSimpleSpeech` で音声全体を一括生成し
`audio_response`（CloudFront URL）で送信する。

```
Lambda (authenticated直後の自動処理):
  条件: initialGreeting が設定されている場合のみ
  
  1. avatar_response_final を先行送信（テキスト表示を音声生成より先に行う）:
     ────T4─────────────────────────────────────────────────────────┐
     {                                                               │
       type: 'avatar_response_final',                               │
       text: initialGreeting,                                       │
       timestamp,                                                   │
     }                                                              │
                                                                    │
  Frontend (onAvatarResponseFinal):                                 │
    1. 会話履歴UIに追加（speaker: 'AI'）                            │
    2. isAiRespondingRef.current = true  ← ここでセット             │
                                                                    │
  2. Azure TTS generateSimpleSpeech(initialGreeting) 呼び出し      │
     - 音声全体を一括生成（ストリーミングではない）                  │
     - S3に保存: sessions/{sessionId}/initial-greeting.mp3          │
     - CloudFront URL生成                                           │
                                                                    │
  3. audio_response 送信 ────T5────────────────────────────────────┤
     {                                                              │
       type: 'audio_response',                                      │
       audioUrl: cloudFrontUrl,                                     │
       contentType: 'audio/mpeg',                                   │
       timestamp,                                                   │
     }                                                              │
                                                                    │
  フォールバック（TTS失敗時）:                                      │
     avatar_response_final のみ送信済み（テキストのみで継続）       │
     ※ audio_response は省略、UIはテキスト表示のみ                 │
                                                                    │
Frontend (onAudioResponse):                                         │
  1. audioUrl を fetch → ArrayBuffer                                │
  2. AudioContext.decodeAudioData() → AudioBuffer                   │
  3. source.start() → 再生開始                                      │
  4. isAiResponding = true（維持）                                  │
                                                                    │
[AudioSource.onended] ────T17─────────────────────────────────────┤
                                                                    │
Frontend (onended callback):                                        │
  1. isAiRespondingRef.current = false                              │
  2. SessionPhase → 'WAITING_USER'                                  │
  3. useSilenceTimer 有効化                                         │
     - enabled: true                                                │
     - isAIPlaying: false                                           │
```

**エッジケース — 初回挨拶中にユーザーが話し始めた場合:**
```
- AudioContext analyser は引き続き音量を監視
- SPEECH_START_THRESHOLD (0.08) を超えても:
  → isAiRespondingRef.current === true のためrestartRecordingは実行しない
  → ユーザーの発話は録音されない（正常動作）
  → AI挨拶完了後に再度話すようユーザーに案内が必要（UIで表示）
```

---

### Phase 2: ユーザー発話検出（T6）

**概要:** AudioContext analyser で音量を監視し、発話開始を確定する

**処理場所:** `useAudioRecorder.monitorAudioLevel()` - rAFループ（~60fps）

```
[rAFループ - 約16ms毎]
  
  1. AnalyserNode.getByteFrequencyData(dataArray)
  2. 平均音量計算: normalizedLevel = average(dataArray) / 255
  3. audioLevelRef.current = normalizedLevel
     （React stateは100ms intervalで更新）
  
  ─── 発話開始判定 ─────────────────────────────────────────────────────
  
  条件A: speechEndSentRef.current === true（前回speech_end送信済み）
    → 閾値: SPEECH_START_THRESHOLD (0.08) ← 高め設定でノイズ除去
    
  条件B: speechEndSentRef.current === false（発話進行中）
    → 閾値: silenceThreshold (0.15) ← 高め設定でエコー防止

  normalizedLevel > 現在の閾値 の場合:
    1. lastSpeechTimeRef.current = now
    2. speechStartTimeRef.current が null なら now を記録
    3. (now - speechStartTimeRef.current) >= MINIMUM_SPEECH_DURATION(800ms)?
       
       YES → 発話確定（ここでT6発火）
         チェック: isAiRespondingRef.current === true?
           YES（AI再生中）→ speechStartTimeRef.current = null にリセット
                           → restartRecording実行しない（エコー誤検知防止）
           NO（通常）    → restartRecording() 実行
                           
       NO → 待機継続（speechStartTimeRef維持）
```

**`restartRecording()` の3フェーズ処理:**

```
PHASE 1: 旧Recorderの停止
  1. audioLevelInterval クリア（積み重ね防止）
  2. oldRecorder.ondataavailable = null  ← 最終チャンク抑制
  3. oldRecorder.onstop = null           ← onstop抑制
  4. oldRecorder.stop()

PHASE 2: 状態リセット
  1. speechEndSentRef.current = true     ← 新チャンク送信抑止
  2. lastSpeechTimeRef.current = Date.now() + 2000  ← 2秒グレース期間
     ※ 理由: 新Recorderの第1チャンク（EBMLヘッダ）が到着するまで
              speech_endが発火しないよう2秒の猶予を設ける
  3. speechStartTimeRef.current = null
  ※ sequenceNumberRef はリセットしない（Lambdaの expectedAudioSequence と同期するため）

PHASE 3: 新Recorder起動
  1. new MediaRecorder(stream, {mimeType})
  2. ondataavailable ハンドラ設定
  3. newRecorder.start(1000ms)  ← 新しいEBMLヘッダー付きチャンク生成開始
  4. audioLevelInterval 再起動（100ms）
```

**`speechEndSentRef` を false に戻すタイミング:**

`restartRecording()` の Phase 2 で `speechEndSentRef.current = true` に設定した後、
`monitorAudioLevel` の呼び出し元（rAFループ内）で、`restartRecording()` 呼び出しの
直後に `speechEndSentRef.current = false` を明示的に上書きする（`useAudioRecorder.ts` 行543）。
つまり「restart完了直後」に即座に false になる。第2チャンクまで待つのではない。

```typescript
// monitorAudioLevel 内の発話確定ブロック（useAudioRecorder.ts 行537-546）
restartRecording();
// restartRecording() が内部で speechEndSentRef.current = true にセットするが、
// ここで即座に false に上書きしてチャンク送信を有効化する
speechEndSentRef.current = false;
speechStartTimeRef.current = null;
```

ただし、`ondataavailable` 内でも送信前に `!speechEndSentRef.current` をチェックするため、
restart直後から false になっていても、「EBMLヘッダチャンク（第1チャンク）」は
`speechEndSentRef.current` が false になった後に発生するため正常に送信される。

**状態変化:**

| タイミング | speechEndSentRef | RecorderState | SessionPhase |
|-----------|-----------------|---------------|--------------|
| T6発火前 | true | RECORDING | WAITING_USER |
| restartRecording Phase 1-3 実行中 | true | RESTARTING | WAITING_USER |
| restartRecording() 戻り直後 | → false（即座に上書き） | RECORDING | WAITING_USER |
| 第1チャンク（EBMLヘッダ）受信・送信 | false | RECORDING | WAITING_USER→USER_SPEAKING |
| 第2チャンク以降 | false | RECORDING | USER_SPEAKING |

---

### Phase 3: 音声チャンク送信（T8, T9, T10）

**概要:** 1秒ごとに音声チャンクをLambda経由でS3に保存する

**処理場所:** `useAudioRecorder` ondataavailable + `useWebSocket`

```
[MediaRecorder ondataavailable - 1秒ごと] ────T8──────────────────────┐
                                                                        │
  event.data.size > 0 の場合のみ処理:                                  │
  
  1. sequence = sequenceNumberRef.current
  2. recordedChunksRef.current.push(event.data)
  3. sequence === 0 の場合: EBMLヘッダ検証（開発時のみ）
  
  送信判定:
    enableRealtime === true
    AND (!speechEndSentRef.current OR bypassSpeechDetection)
    
    送信OK → sendChunkWithRetry(data, timestamp, sequence, chunkId)
              chunkId = `audio-${sequence}-${timestamp}`
              
    送信NG（スキップ）→ speech検出前チャンクのため破棄
    
  4. sequenceNumberRef.current++  ← 送信有無に関わらずインクリメント
  
  ─── sendChunkWithRetry ─────────────────────────────────────────────
  
  1. pendingChunksMap.set(chunkId, { data, timestamp, sequence, sentAt: now, retryCount: 0 })
  2. onAudioChunk(data, timestamp, sequence, chunkId) コールバック
     → useWebSocket.sendAudioChunk():
       {
         type: 'audio_chunk_realtime',
         audioData: base64(chunk),
         sequenceNumber: sequence,
         timestamp,
         chunkId,
         sessionId,
       }
     → WebSocket経由でLambdaに送信
  3. ackTimer = setTimeout(handleAckTimeout, ACK_TIMEOUT_MS=5000)
     ackTimerMap.set(chunkId, ackTimer)
```

**Lambda (audio_chunk_realtime handler):**

```
  1. レート制限チェック（20チャンク/秒）
  2. 重複チェック（receivedAudioChunks配列）
     → duplicate → chunk_ack {status: 'duplicate'} を返す
  3. シーケンス検証:
     sequenceNumber < lastCleanedUpSequence → 旧ターンのチャンク → 拒否
     sequenceNumber < expectedAudioSequence → 現ターンの遅延チャンク → 受け入れ
  4. S3保存:
     Key: sessions/{sessionId}/realtime/{timestamp}-{sequenceNumber}.webm
     ※ ファイル名フォーマット: timestamp-seq.webm（ソート関数と一致）
  5. ConnectionData 更新:
     { realtimeAudioSequenceNumber, realtimeAudioChunkCount++,
       receivedAudioChunks: [...prev, seq], expectedAudioSequence: max(prev, seq+1) }
  6. chunk_ack 送信:
     { type: 'chunk_ack', chunkId, status: 'saved', sequenceNumber, timestamp }
```

**ACK受信時 (T9):**

```
  Frontend (handleChunkAck):
    1. ackTimerMap から chunkId の timer をクリア
    2. pendingChunksMap から削除
    3. onChunkAck コールバック通知（統計表示など）
```

**ACKタイムアウト時 (T10):**

```
  retryCount < MAX_RETRIES(3) の場合:
    backoffMs = 2^retryCount * 1000  → 1秒, 2秒, 4秒
    setTimeout(再送, backoffMs)
    pendingChunks.set(chunkId, {..., retryCount+1, sentAt: now})
    新しいackTimer設定
    
  retryCount >= MAX_RETRIES の場合:
    pendingChunksMap から削除
    onError(new Error('Failed to send audio chunk'))
    ※ セッション継続は可能（一部チャンク欠損として記録）
```

---

### Phase 4: 発話終了検出とspeech_end送信（T7, T11）

**概要:** 無音を検出してSTT処理をLambdaにトリガーする

**処理場所:** `useAudioRecorder.monitorAudioLevel()`

```
[rAFループ内 - 無音検出部分]

  normalizedLevel <= silenceThreshold(0.15) の場合:
    (now - lastSpeechTimeRef.current) >= silenceDuration(500ms)?
    AND speechEndSentRef.current === false?
    
    YES → 発話終了確定（T7→T11発火）
    
      1. speechEndSentRef.current = true  ← 重複送信防止
      2. speechStartTimeRef.current = null
      3. onSpeechEnd() コールバック実行
      
  ─── onSpeechEnd コールバック（SessionPlayer側） ───────────────────
  
  1. isProcessing = true（処理中フラグ → silenceTimerを停止）
  2. processingTimeoutRef = setTimeout(30000, () => {
       // 30秒経過後にタイムアウト処理
       isProcessing = false
       toast.error(t('errors.api.timeout'))
     })
  3. WebSocket経由で speech_end 送信:
     { type: 'speech_end', sessionId, timestamp }
  4. SessionPhase → 'PROCESSING'
```

**Lambda (speech_end handler):**

```
  前提チェック:
    1. realtimeAudioProcessing === true → スキップ（重複処理防止）
       → { type: 'error', message: 'SPEECH_END_ALREADY_PROCESSING' }
    2. realtimeAudioProcessing = true にセット（処理ロック取得）
    3. lastAudioProcessingStartTime = Date.now()
    
  チャンク収集:
    4. ListObjectsV2: s3://bucket/sessions/{sessionId}/realtime/ 一覧取得
    5. sortChunksByTimestampAndIndex(chunks)
       ソートキー: timestamp(ascending) → sequenceNumber(ascending)
       ファイル名パターン: /(\d+)-(\d+)\.\w+$/
    6. downloadAndCombineChunks: 並列ダウンロード → バッファ結合
    7. validateChunkOrder: 欠損・重複チェック
    
  音声変換:
    8. convertMultipleWebMChunksToWav(buffers):
       - chunks[0]: EBMLヘッダ + Segment + 最初のデータ → 完全なWebM
       - chunks[1+]: フラグメントのみ → chunks[0]のヘッダと結合
       - ffmpeg: silenceremove(-50dB) + volume + acompressor + alimiter
       → WAVバッファ（16bit PCM, 16kHz）
    
  ストリーミング処理パイプライン:
    9. processAudioStreaming():
       callbacks:
         onTranscriptComplete → (→ T12)
         onAIChunk            → (→ T13)
         onAIComplete         → (→ T14)
         onTTSChunk           → (→ T15)
         onTTSComplete        → (→ T16)
```

---

### Phase 5: Lambda処理パイプライン（T12〜T16）

**概要:** STT→AI→TTSのストリーミングパイプライン

#### Phase 5-A: STT（Azure Speech To Text）

```
  Azure STT (startContinuousRecognition):
    - 設定: InitialSilenceTimeoutMs=5000, EndSilenceTimeoutMs=1000
    - 言語: autoDetectLanguages（複数候補から自動判定） または 固定language
    
  onPartialResult(result):
    → transcript_partial 送信:
      { type: 'transcript_partial', text, timestamp }
    → Frontend: 会話UIにPartialテキスト表示
      
  onFinalResult(result) ────T12────────────────────────────────────────┐
    → transcript_final 送信:                                           │
      { type: 'transcript_final', text, confidence, timestamp }        │
    → Frontend:                                                        │
        1. 会話UIをFinalテキストで更新                                 │
        2. Partial表示をFinalに切り替え                                │
```

#### Phase 5-B: AI応答生成（Bedrock Claude）

```
  入力:
    - conversationHistory（過去ターン全履歴）
    - transcript（T12で確定したテキスト）
    - scenarioPrompt（システムプロンプト）
    
  Bedrock Streaming API:
    onChunk ────T13────────────────────────────────────────────────────┐
      → avatar_response_partial 送信:                                  │
        { type: 'avatar_response_partial', text: chunk, timestamp }    │
      → Frontend:                                                      │
          会話UIにストリーミングテキスト追加表示                        │
          
    onComplete ────T14─────────────────────────────────────────────────┤
      → avatar_response_final 送信:                                    │
        { type: 'avatar_response_final', text: fullText, timestamp }   │
      → Frontend:                                                      │
          Partial → Final に確定                                       │
          isAiRespondingRef.current = true  ← ここでセット             │
          ※ TTS音声チャンク到着前に設定することでスピーカーエコーによる │
             restartRecording 誤発火を防ぐ（AIレスポンス生成完了≠再生 │
             開始だが、エコーはすでに発生し得るため早めに防衛する）    │
          
  ターン上限チェック:
    turnCount + 1 >= MAX_CONVERSATION_TURNS?
    → session_limit_reached 送信:
      { type: 'session_limit_reached', turnCount, maxTurns, message }
    → Frontend: セッション終了処理へ
```

#### Phase 5-C: TTS（ElevenLabs）

```
  入力: AI応答テキスト（T14の fullText）
  
  ElevenLabs Streaming:
    onChunk ────T15────────────────────────────────────────────────────┐
      → audio_chunk 送信:                                              │
        { type: 'audio_chunk', audioData: base64(mp3), isFinal: false }│
      → Frontend (onAudioChunk):                                       │
          useAudioPlayer.playChunk(base64)                             │
          - Base64 → ArrayBuffer                                       │
          - decodeAudioData → AudioBuffer                              │
          - スケジュールキューに追加                                    │
          isAiRespondingRef.current = true（T14で既にセット済み・維持） │
          
    onComplete ────T16─────────────────────────────────────────────────┤
      → audio_chunk 送信（isFinal: true）                              │
      → audio_response 送信:                                           │
        { type: 'audio_response', audioUrl: cloudFrontUrl, timestamp } │
        ※ 完全音声をS3保存・CloudFront署名URLで配信                    │
        
  Lambda後処理（handleAudioProcessingStreaming 完了後）:
    1. S3リアルタイムチャンクの削除（cleanupChunks）
    2. ConnectionData更新:
       { realtimeAudioSequenceNumber: -1, realtimeAudioChunkCount: 0,
         realtimeAudioProcessing: false,                 ← 処理ロック解放
         lastCleanedUpSequence: lastProcessedSequence }
    3. sessionEndReceived === true の場合:
       a. Aurora RDS 更新:
          session.status = 'COMPLETED'
          session.endedAt = now
          session.durationSec = (endedAt - startedAt) / 1000
       b. session_complete 送信:
          { type: 'session_complete', sessionId, message: '...' }
          ※ session_end ハンドラを経由せず、speech_end ハンドラから送信
          
  ※ conversationHistory と turnCount の更新は handleAudioProcessingStreaming 内の
     onTTSComplete コールバックで行われる（TTS完了時に DynamoDB を更新）
```

---

### Phase 6: AI音声再生と次ターンへの遷移（T17）

**概要:** TTS音声を順次再生し、完了後にユーザー発話待機に戻る

```
[useAudioPlayer - チャンク再生キュー]

  playChunk(base64):
    1. base64 → ArrayBuffer
    2. audioContext.decodeAudioData(buffer) → AudioBuffer
    3. source = audioContext.createBufferSource()
    4. source.buffer = audioBuffer
    5. source.connect(audioContext.destination)
    6. スケジュール: source.start(nextStartTime)
    7. nextStartTime += audioBuffer.duration
    8. source.onended = () => {
         isPlayingRef.current = false
         onChunkEnded()
       }

[最後のチャンクの onended] ────T17───────────────────────────────────┐
                                                                       │
  Frontend処理:                                                        │
    1. isAiRespondingRef.current = false                               │
    2. isPlayingAudio = false                                          │
    3. isProcessing = false                                            │
    4. SessionPhase → 'WAITING_USER'                                   │
    5. processingTimeoutRef のタイマーをクリア                          │
    6. useSilenceTimer の enabled条件を充足                            │
       → GRACE_PERIOD(1秒)経過後にタイマー開始                        │
    7. restartRecording() を実行（T17プリエンプティブ restart）         │
       ※ 次の発話に備えて新しいEBMLヘッダを生成する「準備用restart」
```

**2回連続 restartRecording の仕組み（重要）:**

```
AI応答フローでは restartRecording が2回呼ばれる:

[1回目] T17（AI音声再生完了）時:
  SessionPlayer の handleAudioEnded() で呼び出す。
  目的: 次の発話を受け付けるための「スタンバイ状態」を作る。
  結果: speechEndSentRef=true（チャンク送信はまだ停止）
        lastSpeechTimeRef + 2000ms グレース期間
        新しいMediaRecorderが start(1000ms) → EBMLヘッダチャンク生成開始

[2回目] T6（ユーザー発話確定 800ms）時:
  monitorAudioLevel の発話確定ロジックで呼び出す。
  目的: 実際の発話が確定したため、新しいEBMLヘッダ付きで改めて録音開始。
        直前のスタンバイRecorderの音声（無音）は破棄。
  結果: speechEndSentRef = false（チャンク送信を有効化）
        以降のチャンクが Lambda に送信される

この2段階設計の理由:
  - T17時点でrestartしないと: 次ターンのEBMLヘッダが遅延する
  - T6時点で再restartするのは: T17〜T6の間の無音チャンクをLambdaに
    送信しないため（speechEndSentRef=true が送信を防ぐ）
  - T17→T6の間に AI エコーが来ても isAiRespondingRef=false になった
    直後に speechStartTimeRef をリセットして再確認を要求する
```

**useSilenceTimer の動作:**

```
  Timer開始条件（すべて満たすこと）:
    - enabled === true（enableSilencePrompt設定）
    - isAIPlaying === false
    - isUserSpeaking === false
    - isProcessing === false
    
  Timer停止条件（いずれかが true）:
    - isAIPlaying === true   → リセット（即座）
    - isUserSpeaking === true → リセット（即座）
    - isProcessing === true  → リセット（即座）
    
  Timer動作:
    1. GRACE_PERIOD(1秒)開始 → graceCompleted = false
    2. 1秒後 → graceCompleted = true → setInterval(1秒)開始
    3. elapsed >= timeoutSeconds → onTimeout() → resetTimer()
```

---

### Phase 7: 無音タイムアウトと促し（T18）

**概要:** 設定時間内にユーザーが発話しない場合、AIが促す

```
[useSilenceTimer.onTimeout] ────T18────────────────────────────────────┐
                                                                        │
  Frontend (onSilenceTimeout):                                          │
    500ms猶予後に最終確認:                                             │
    if (isUserSpeaking) return        // 発話開始していたらキャンセル   │
    if (isProcessing) return          // 処理中ならキャンセル           │
    if (status !== 'ACTIVE') return   // 終了中ならキャンセル           │
    
    → silence_prompt_request 送信:
      { type: 'silence_prompt_request', sessionId, elapsedTime, timestamp }
```

**Lambda (silence_prompt_request handler):**

```
  バリデーション:
    1. lastSilencePromptTime から30秒未満 → スキップ（重複防止）
    ※ session.status チェックなし（DynamoDB sessionEndReceived で代用）
    
  lastSilencePromptTime = Date.now() で即時更新（原子的）
  
  促し生成:
    generateSilencePrompt() ユーティリティ:
      - conversationHistory + scenarioPrompt + scenarioLanguage を入力
      - Bedrock Claude API で文脈に応じた促し文を生成
      - 失敗時フォールバック: プリセット促し文 or 
        最終フォールバック: 'ご質問はありますか？' / 'Do you have any questions?'
      
  ⚠️ 応答メッセージ: silence_prompt_response ではなく avatar_response_final を使用
    { type: 'avatar_response_final', text: promptText, timestamp }
    ※ Lambda は silence_prompt_response を送信しない（実装確認済み）
    ※ Frontend は通常の AI 応答と同じハンドラで処理する
    
  TTS生成（通常ターンと異なる）:
    generateSimpleSpeech(promptText)  ← ストリーミングではなく一括生成
    → S3保存: sessions/{sessionId}/silence-prompt-{timestamp}.mp3
    → CloudFront URL 生成
    
  音声送信:
    { type: 'audio_response', audioUrl: cloudFrontUrl, contentType, timestamp }
    ※ audio_chunk ストリーミングではなく audio_response URL方式
    
  会話履歴に追加:
    conversationHistory.push({ role: 'assistant', content: promptText })
```

**Frontend (onAvatarResponseFinal + onAudioResponse):**

```
  onAvatarResponseFinal（通常 AI 応答と同じハンドラ）:
    1. 会話UIに追加（speaker: 'AI'）
    2. isAiRespondingRef.current = true
    
  onAudioResponse（通常の audio_response と同じハンドラ）:
    → Phase 6（AI音声再生）と同じフローへ（audioUrl を fetch して再生）
```

---

### Phase 8: セッション終了（T19〜T20）

**概要:** セッションを正常終了させ、録画・解析処理を開始する

```
[ユーザーが「終了」ボタンをクリック or session_limit_reached] ────T19─┐
                                                                        │
  Frontend処理:                                                         │
    1. SessionPhase → 'ENDING'                                          │
    2. useAudioRecorder.stopRecording()                                 │
       - MediaRecorder.stop() → onstopで最終チャンク生成               │
       - stream.getTracks().forEach(t => t.stop())                      │
       - AudioContext.close()                                           │
       - rAFループ停止                                                  │
    3. useVideoRecorder.stopRecording()                                 │
    4. session_end 送信:                                                │
       { type: 'session_end', sessionId,                                │
         totalAudioChunks: sequenceNumber,                              │
         totalVideoChunks: videoSequence, timestamp }                   │
```

**Lambda (session_end handler):**

```
  realtimeAudioProcessing === true の場合:
    → sessionEndReceived = true にセット
    → speech_end処理完了後に自動的に session_complete が送信される
    
  realtimeAudioProcessing === false の場合:
    1. ビデオ処理（videoChunksCount > 0 の場合）:
       - VideoProcessor.combineVideoChunks() → S3保存
       - recording レコード作成（processingStatus='PROCESSING'）
       - 録画Lambda を非同期 invoke（合成・解析）
    2. Aurora RDS 更新:
       session.status = 'COMPLETED'
       session.endedAt = now
       session.durationSec = (endedAt - startedAt) / 1000
    3. session_complete 送信 ────T20────────────────────────────────────
       { type: 'session_complete', sessionId,
         message: 'Session ended successfully' }
       ※ audioStats/videoStats は現在のsession_completeには含まれない
    4. 解析Lambda非同期呼び出しは recording Lambda 内で処理
```

**Lambda (disconnect handler) - 異常切断時:**

```
  DynamoDB から connectionData 取得
  session.status === 'ACTIVE' の場合:
    → session.status = 'COMPLETED'
    → session.endedAt = now
    → durationSec 算出・保存
  接続レコード削除
```

**Frontend (onSessionComplete):**

```
  1. SessionPhase → 'COMPLETED'
  2. useSilenceTimer 無効化
  3. セッション完了UIに遷移
  4. 録画・解析結果のポーリングまたはWebSocket受信待ち
```

---

## 🎬 録画データライフサイクル

セッション中に生成されるビデオ録画データの保存・管理フローを説明する。
S3とDBの関係を正確に理解することで、不整合（DBにレコードあり・S3に実態なし）の検出と原因特定が可能になる。

### S3保存パス体系

```
s3://prance-recordings-{env}-{account}/
│
├── sessions/{sessionId}/video-chunks/          ← セッション中に1秒ごとに保存
│   ├── {timestamp}-{sequenceNumber}.webm       ← 例: 1000-0.webm, 2016-1.webm
│   └── ...（セッション中のチャンク全件）
│
├── sessions/{sessionId}/realtime-chunks/       ← 音声チャンク（STT用）
│   └── {timestamp}-{sequenceNumber}.webm
│
└── sessions/{sessionId}/recording.webm         ← 最終合成ファイル（CDN配信対象）
```

### ビデオデータのライフサイクル

```
[セッション中]
  useVideoRecorder.ondataavailable (1秒ごと)
    → WebSocket: { type: 'video_chunk', videoData: base64, ... }
    → Lambda (video_chunk_realtime handler)
    → S3保存: sessions/{sessionId}/video-chunks/{timestamp}-{seq}.webm
    → DB: videoChunksCount++ (DynamoDB ConnectionData)

[session_end受信時 - VideoProcessor.combineChunks()]
  1. S3 ListObjects: sessions/{sessionId}/video-chunks/ 一覧取得
  2. タイムスタンプ→シーケンス番号でソート
  3. 並列ダウンロード（4チャンク同時）→ /tmp/ に展開
  4. ffmpeg -f concat: 全チャンクを結合
  5. S3アップロード: sessions/{sessionId}/recording.webm  ← 最終ファイル
  6. DB更新:
     - recordings.processing_status: PROCESSING → COMPLETED
     - recordings.cdn_url: CloudFront URL
     - recordings.file_size_bytes: 実ファイルサイズ
     - recordings.duration_sec: ffmpeg出力から算出
  7. 一時ファイル削除: /tmp/video-{sessionId}-{timestamp}/
```

### DBレコードの作成タイミング

```
session_end受信
  ↓
recordings.create({ processingStatus: 'PROCESSING', ... })  ← 先にDBレコード作成
  ↓
VideoProcessor.combineChunks()  ← 実際のS3処理
  ↓
  成功: recordings.update({ processingStatus: 'COMPLETED', s3Key, cdnUrl, ... })
  失敗: recordings.update({ processingStatus: 'ERROR', errorMessage })
```

**重要:** DBレコードは `combineChunks()` 開始前に `PROCESSING` で作成される。
処理失敗時も `ERROR` ステータスで更新されるため、
`COMPLETED` でありながらS3に実態がない状態は通常フローでは発生しない。

### ⚠️ S3/DB不整合が発生するケース

以下のケースでは「DBにCOMPLETEDレコードあり・S3に実態なし」の状態になる：

#### ケース1: `seed-recording-data.ts` によるテストシード（最多）

```typescript
// infrastructure/lambda/test/seed-recording-data.ts
await prisma.recording.create({
  data: {
    s3Key: 'sessions/{id}/recording.webm',   // S3パスをDBに書くだけ
    fileSizeBytes: BigInt(5242880),           // 5MB固定値（フェイク）
    processingStatus: 'COMPLETED',
    // ↑ S3への実ファイルアップロードは一切行わない
  },
});
```

シードデータの特徴（見分け方）：
- `file_size_bytes = 5242880`（ちょうど5MB）
- `duration_sec = 120`（ちょうど2分）
- `video_chunks_count = 24`（固定値）
- `created_at = processed_at`（同一ミリ秒）
- S3を確認するとオブジェクトが存在しない

#### ケース2: `combineChunks()` が成功したが後続のS3アップロードが失敗

DynamoDB ConnectionDataの `videoChunksCount` が 0 の場合、combineChunks はスキップされ
DB録画レコードも作成されないため、実際には `COMPLETED` + S3なしにはならない。

#### ケース3: S3バケットのライフサイクルポリシーによる自動削除

現在のdev環境ではライフサイクルポリシーは設定されていないが、
設定した場合は実態のないCOMPLETEDレコードが残り得る。

### 不整合の確認方法

```bash
# 1. DBのCOMPLETE録画一覧確認
bash scripts/db-query.sh "SELECT session_id, file_size_bytes, video_chunks_count FROM recordings WHERE processing_status = 'COMPLETED'"

# 2. S3の実ファイル確認
aws s3 ls s3://prance-recordings-dev-010438500933/sessions/{session_id}/ --recursive | grep "recording.webm"

# 3. ファイルが存在しない場合、シードデータか確認（file_size_bytes=5242880 が目印）
```

### E2Eテスト用の対処方法

シードデータ（S3なし）でE2E録画テストを実行する場合、ダミーファイルをS3にアップロードする：

```bash
# 60秒のテスト動画を生成してS3にアップロード
ffmpeg -f lavfi -i "color=c=blue:s=1280x720:d=60" \
       -f lavfi -i "sine=frequency=440:duration=60" \
       -c:v libvpx-vp9 -b:v 200k -c:a libopus -t 60 \
       /tmp/test-recording.webm

aws s3 cp /tmp/test-recording.webm \
  s3://prance-recordings-dev-010438500933/sessions/{session_id}/recording.webm \
  --content-type video/webm
```

**恒久解決策:** `seed-recording-data.ts` にS3アップロード処理を追加し、
シードと同時に実ファイルもS3に作成する。

---

## 🚀 v1.2 商用品質改善（2026-04-24実装）

### 1. TTSストリーミングリアルタイム再生

**改善前（v1.1）:**
```
Lambda: audio_chunk（無視） → onTTSComplete → S3保存 → audio_response URL送信
Frontend: audio_response受信 → HTMLAudioElement.play(URL)
レイテンシ: TTS全チャンク完了 + S3保存 + URL取得 = +500ms～2s
```

**改善後（v1.2）:**
```
Lambda: audio_chunk（MP3チャンク送信） → ... → onTTSComplete → audio_response URL送信
Frontend: audio_chunk受信 → Web Audio API decodeAudioData → 即座に再生キュー追加
レイテンシ削減: 最初のチャンク到着から再生開始 ≈ -1s～2s
```

**実装ファイル:**
- `apps/web/hooks/useAudioPlayer.ts` — `playChunk()`で各MP3チャンクをデコード・スケジュール再生
- `apps/web/components/session-player/index.tsx` — `handleTTSAudioChunk`でWeb Audio APIに転送

**audio_response URLとの関係:**
- `audio_chunk`が届いてWeb Audio APIが再生中の場合、後から届く`audio_response` URLは無視される（重複再生防止）
- Web Audio APIが未初期化の場合（まれ）は従来の`audio_response` URL再生にフォールバック

### 2. バージイン（Barge-in）

**改善前（v1.1）:**
- AI発話中にユーザーが発話しても、800ms確認後に「AIが応答中」と判定して`restartRecording()`を抑制
- ユーザーはAI発話が完全に終わるまで話しても無視される

**改善後（v1.2）:**
```
ユーザー発話（AI応答中）
  → AudioContext analyser: 800ms以上の音声確認
  → onBargeIn() 呼び出し
  → audioPlayer.stop() — Web Audio APIストリーミング停止
  → audioRef.current.pause() — HTMLAudioElement停止（フォールバック）
  → isPlayingAudioRef.current = false
  → useAudioRecorder: restartRecording() 実行
  → 次の発話を録音・送信
```

**実装ファイル:**
- `apps/web/hooks/useAudioRecorder.ts` — AI応答中の確認済み発話検出時に`onBargeIn?.()`呼び出し
- `apps/web/components/session-player/index.tsx` — `handleBargeIn`で両方の音声再生を停止

**Lambda側の整合性:**
- Lambda側は`realtimeAudioProcessing`フラグで前ターンの処理完了を保証
- バージインで新たな`speech_end`が届いた場合、前ターン処理完了後にキュー実行

---

## ⏱️ タイミング基準値

### フロントエンド側の閾値

| 定数名 | 値 | 用途 |
|-------|-----|------|
| `MINIMUM_SPEECH_DURATION` | 800ms | 発話確定に必要な連続音量継続時間 |
| `SPEECH_START_THRESHOLD` | 0.08 | 発話開始判定の音量閾値（高め） |
| `silenceThreshold` | 0.15 | 発話終了判定の音量閾値 |
| `silenceDuration` | 500ms | この時間無音が続いたらspeech_end |
| `ACK_TIMEOUT_MS` | 5000ms | チャンクACK待ちタイムアウト |
| `MAX_RETRIES` | 3回 | チャンク送信リトライ上限 |
| `RETRY_BACKOFF` | 1s, 2s, 4s | 指数バックオフ |
| `GRACE_PERIOD_MS` | 1000ms | silenceTimer開始猶予期間 |
| `PROCESSING_TIMEOUT` | 30000ms | Lambda処理タイムアウト（Frontend側） |
| `lastSpeechTimeRef grace` | +2000ms | restartRecording後のspeech_end抑止 |

### Lambda側の閾値

| 定数名 | 値 | 用途 |
|-------|-----|------|
| `STT InitialSilenceTimeout` | 5000ms | Azure STT初期無音タイムアウト |
| `STT EndSilenceTimeout` | 1000ms | Azure STT終了無音タイムアウト |
| `VIDEO_LOCK_TTL_SECONDS` | 300秒 | ビデオチャンク処理ロックTTL |
| `DYNAMODB_CONNECTION_TTL` | 86400秒 | WebSocket接続レコードTTL |
| `silencePromptCooldown` | 30秒 | 促し送信の最小間隔 |
| `heartbeat interval` | 30秒 | WebSocket接続維持ping間隔 |
| `MAX_RECONNECT_ATTEMPTS` | 5回 | WebSocket再接続上限 |
| `reconnect backoff` | ~30秒まで | 指数バックオフ（1s, 2s, 4s, 8s, 16s） |

### 期待されるエンドツーエンドレイテンシ

| フェーズ | 目標値 | 最大許容値 |
|---------|-------|-----------|
| speech_end → transcript_partial | < 500ms | 2000ms |
| transcript_partial → transcript_final | < 2000ms | 5000ms |
| transcript_final → avatar_response_partial | < 1000ms | 3000ms |
| avatar_response_final → 最初のaudio_chunk | < 500ms | 2000ms |
| 合計（speech_end → 音声再生開始） | < 3000ms | 10000ms |

---

## 🔀 競合状態と対処

### CS-1: speech_end処理中に新しいspeech_endが発生

**発生条件:** 1回目のspeech_endをLambdaが処理中に、ユーザーが再び話してsilenceDurationを経過

**対処:**
```
Lambda:
  realtimeAudioProcessing === true → 2回目のspeech_endをスキップ
  → { type: 'error', message: 'SPEECH_END_ALREADY_PROCESSING' }

Frontend:
  isProcessing === true → onSpeechEnd コールバックをキューに積むか無視
```

**現在の実装:** Lambda側でスキップ（フロントエンドのisProcessingフラグでも防止）

---

### CS-2: AI再生中にユーザーが発話開始

**発生条件:** AI TTS再生中にユーザーが話す（割り込み）

**対処:**
```
useAudioRecorder:
  isAiRespondingRef.current === true
  → SPEECH_START確定しても restartRecording を実行しない
  → 発話は無視（スピーカーエコーと区別不可能なため）

ユーザーへの案内:
  AI音声再生中はマイクアイコンを「待機中」に変更し
  AIが話し終わったら話すよう視覚的に誘導
```

---

### CS-3: silenceTimeout と speech_end の競合

**発生条件:** speech_endを送信後にLambda処理が遅れ、silenceTimerがタイムアウト

**対処:**
```
Frontend:
  speech_end送信時に isProcessing = true をセット
  useSilenceTimer: isProcessing === true → タイマー即座停止・リセット
  → silence_prompt_request は送信されない
```

---

### CS-4: session_end とspeech_end の競合

**発生条件:** speech_end処理中にユーザーがセッション終了ボタンを押す

**対処:**
```
Lambda:
  session_end受信時に realtimeAudioProcessing === true なら:
    → sessionEndReceived = true をセット（DynamoDB）
    → speech_end処理は継続
    → speech_end処理完了後（Phase 5-C Lambda後処理で）:
         1. updatedConnectionData.sessionEndReceived を確認
         2. Aurora RDS: session.status = 'COMPLETED'（ここで更新）
         3. session_complete を送信
    → session_end ハンドラ側は何もしない

Frontend:
  SessionPhase → 'ENDING' にセットしても
  既存のProcessing処理は継続させる（強制終了しない）
  
Aurora RDS 更新の2つのパス:
  パス1: session_end → realtimeAudioProcessing===false → 直接更新
  パス2: session_end → sessionEndReceived=true → speech_end完了後に更新
```

---

### CS-5: WebSocket再接続中のチャンク欠損

**発生条件:** 一時的なWebSocket切断で音声チャンクが届かない

**対処:**
```
useWebSocket:
  MAX_RECONNECT_ATTEMPTS(5回) まで指数バックオフで自動再接続
  再接続成功後: 保留中のチャンクを再送（pendingChunksMap から）
  MAX試行超過: onError 通知 → UI でユーザーに通知

Lambda (disconnect handler):
  session.status を COMPLETED に更新しない
  （意図的切断でない場合の保護）
  ※ session_end を受信した場合のみ COMPLETED に更新
```

---

## 📊 状態遷移マトリクス

### SessionPhase の完全な遷移表

| 現在の状態 | トリガー | 次の状態 | 条件 |
|-----------|---------|---------|------|
| IDLE | T1 (START) | CONNECTING | - |
| CONNECTING | T2 (WS_CONNECTED) | AUTHENTICATING | - |
| CONNECTING | T21 (WS_ERROR) | ERROR | - |
| AUTHENTICATING | T3 (AUTHENTICATED) | GREETING | initialGreeting あり |
| AUTHENTICATING | T3 (AUTHENTICATED) | WAITING_USER | initialGreeting なし |
| GREETING | T4 (AVATAR_RESPONSE_FINAL) | GREETING | テキスト表示 |
| GREETING | T17 (AUDIO_ENDED) | WAITING_USER | 挨拶音声再生完了 |
| WAITING_USER | T6 (SPEECH_DETECTED) | USER_SPEAKING | - |
| WAITING_USER | T18 (SILENCE_TIMEOUT) | WAITING_USER | 促し送信後に戻る |
| WAITING_USER | T19 (SESSION_END) | ENDING | - |
| USER_SPEAKING | T11 (SPEECH_END) | PROCESSING | - |
| USER_SPEAKING | T19 (SESSION_END) | ENDING | - |
| PROCESSING | T15 (TTS_CHUNK) | AI_RESPONDING | 最初のTTSチャンク到着 |
| PROCESSING | T22 (TURN_LIMIT) | ENDING | - |
| PROCESSING | T19 (SESSION_END) | ENDING | - |
| AI_RESPONDING | T17 (AI_AUDIO_ENDED) | WAITING_USER | 全チャンク再生完了 |
| AI_RESPONDING | T22 (TURN_LIMIT) | ENDING | - |
| AI_RESPONDING | T19 (SESSION_END) | ENDING | - |
| ENDING | T20 (SESSION_COMPLETE) | COMPLETED | - |
| * | T21 (WS_DISCONNECTED) | ERROR | 再接続失敗時 |

**補足: PROCESSING → AI_RESPONDING の遷移タイミング:**
```
PROCESSING 状態は speech_end 送信後から AI 音声再生開始まで。
最初の audio_chunk（T15）を受信して再生を開始した時点で AI_RESPONDING へ遷移する。
両状態の実用的な違い:
  - PROCESSING: isProcessing=true、silenceTimer停止、AI応答待ち
  - AI_RESPONDING: isPlayingAudio=true、isAiRespondingRef=true、音声再生中
```

---

## 🧩 コンポーネント・フック間の依存関係

```
SessionPlayer (Component)
    │
    ├── useWebSocket          ← WebSocket接続・メッセージ送受信
    │     └── sendMessage()  ← audio_chunk_realtime, speech_end, session_end
    │     └── onMessage()    ← chunk_ack, transcript_*, avatar_response_*, audio_chunk
    │
    ├── useAudioRecorder      ← マイク録音・発話検出
    │     └── onAudioChunk   → useWebSocket.sendAudioChunk()
    │     └── onSpeechEnd    → SessionPlayer.handleSpeechEnd()
    │     └── onChunkAck     ← useWebSocket.onChunkAck()
    │     └── isAiRespondingRef ← SessionPlayer から渡す（restartRecording制御）
    │
    ├── useAudioPlayer        ← AI音声再生
    │     └── playChunk()    ← SessionPlayer.onAudioChunk()
    │     └── onPlaybackEnded → SessionPlayer.handleAudioEnded()
    │
    ├── useSilenceTimer       ← 無音タイムアウト管理
    │     └── onTimeout()    → SessionPlayer.handleSilenceTimeout()
    │     └── isAIPlaying    ← SessionPlayer.isPlayingAudio
    │     └── isUserSpeaking ← SessionPlayer.isUserSpeaking
    │     └── isProcessing   ← SessionPlayer.isProcessing
    │
    ├── useVideoRecorder      ← カメラ録画・ビデオチャンク送信
    │     └── onVideoChunk   → useWebSocket.sendVideoChunk()
    │
    └── useAudioVisualizer    ← 音量可視化（表示のみ）
          └── audioLevel     ← useAudioRecorder.audioLevel
```

---

## ❌ アンチパターン

### AP-1: 処理中にspeech_endを重複送信

```typescript
// ❌ 悪い実装
const handleSpeechEnd = () => {
  sendMessage({ type: 'speech_end' }); // isProcessingチェックなし
};

// ✅ 正しい実装
const handleSpeechEnd = () => {
  if (isProcessing) return; // 処理中なら送信しない
  setIsProcessing(true);
  sendMessage({ type: 'speech_end' });
};
```

### AP-2: AI再生中のrestartRecording

```typescript
// ❌ 悪い実装（エコーをユーザー発話と誤検知）
if (speechDuration >= MINIMUM_SPEECH_DURATION) {
  restartRecording(); // AI再生中かどうか確認しない
}

// ✅ 正しい実装
if (speechDuration >= MINIMUM_SPEECH_DURATION) {
  if (isAiRespondingRef.current) return; // AI再生中はスキップ
  restartRecording();
}
```

### AP-3: silenceTimerをProcessing中に動作させる

```typescript
// ❌ 悪い実装
useSilenceTimer({ enabled: true }); // 常に有効

// ✅ 正しい実装
useSilenceTimer({
  enabled: enableSilencePrompt,
  isProcessing, // speech_end処理中はタイマー停止
  isAIPlaying,  // AI再生中はタイマー停止
  isUserSpeaking,
});
```

### AP-4: シーケンス番号のリセット

```typescript
// ❌ 悪い実装（restart時にリセット）
speechEndSentRef.current = true;
sequenceNumberRef.current = 0; // ← Lambda の expectedAudioSequence と不一致

// ✅ 正しい実装（リセットしない）
speechEndSentRef.current = true;
// sequenceNumber はセッション全体でインクリメントし続ける
```

### AP-5: ACKなしでチャンク送信

```typescript
// ❌ 悪い実装（ACK追跡なし）
onAudioChunk(data, timestamp, sequence);

// ✅ 正しい実装（ACK追跡あり）
sendChunkWithRetry(data, timestamp, sequence, chunkId);
// pendingChunksMap に記録 + タイムアウトタイマー設定
```

---

## 📁 関連ファイル

### フロントエンド

| ファイル | 役割 |
|---------|------|
| `apps/web/hooks/useAudioRecorder.ts` | マイク録音・発話検出・チャンク送信・ACK追跡 |
| `apps/web/hooks/useWebSocket.ts` | WebSocket接続・メッセージ送受信・再接続 |
| `apps/web/hooks/useAudioPlayer.ts` | AI音声チャンク順次再生 |
| `apps/web/hooks/useSilenceTimer.ts` | 無音タイムアウト管理 |
| `apps/web/hooks/useVideoRecorder.ts` | カメラ録画・ビデオチャンク送信 |
| `apps/web/hooks/useAudioVisualizer.ts` | 音量可視化 |
| `apps/web/components/session-player/index.tsx` | 会話UIの統合コンポーネント |

### Lambda

| ファイル | 役割 |
|---------|------|
| `infrastructure/lambda/websocket/default/index.ts` | WebSocketメッセージハンドラ（メイン） |
| `infrastructure/lambda/websocket/default/audio-processor.ts` | STT→AI→TTSパイプライン |
| `infrastructure/lambda/websocket/default/video-processor.ts` | ビデオチャンク処理・合成 |
| `infrastructure/lambda/websocket/default/chunk-utils.ts` | チャンクソート・検証・結合 |
| `infrastructure/lambda/websocket/connect/index.ts` | WebSocket接続ハンドラ |
| `infrastructure/lambda/websocket/disconnect/index.ts` | WebSocket切断ハンドラ |
| `infrastructure/lambda/shared/audio/stt-azure.ts` | Azure STT統合 |
| `infrastructure/lambda/shared/audio/tts-elevenlabs.ts` | ElevenLabs TTS統合 |
| `infrastructure/lambda/shared/audio/tts-azure.ts` | Azure TTS統合（フォールバック） |
| `infrastructure/lambda/shared/ai/bedrock.ts` | Bedrock Claude AI統合 |

### 関連ドキュメント

| ドキュメント | 内容 |
|------------|------|
| `docs/05-modules/SILENCE_MANAGEMENT_V2.md` | 無音タイムアウト・AI促し詳細設計 |
| `docs/05-modules/VOICE_MODULE.md` | STT/TTS機能概要 |
| `docs/07-development/MEDIARECORDER_LIFECYCLE.md` | MediaRecorder API・EBML詳細 |
| `docs/07-development/ROOT_CAUSE_ANALYSIS.md` | 過去のバグと根本原因 |

---

**最終更新:** 2026-04-24（v1.2 - TTSストリーミング再生・バージイン実装）
**次回レビュー:** ストリーミングSTT実装後
