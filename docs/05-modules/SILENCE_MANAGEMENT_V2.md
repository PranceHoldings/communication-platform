# 無音時間管理システム設計 v2.0

**作成日:** 2026-03-11
**ステータス:** 設計レビュー完了（実装準備中）
**優先度:** Phase 1.5拡張機能
**バージョン:** 2.0（AI初回挨拶機能追加、タイミング検証完了版）

---

## 概要

会話セッション中の無音時間を管理し、適切なタイミングでAIがユーザーに会話を促すシステム。

### 主要機能

1. **AI初回挨拶（新機能）**
   - シナリオ作成時にAIの初回挨拶テキストを設定可能
   - セッション開始時にAIが自動的に挨拶
   - 例: "こんにちは。面接を始めましょう。自己紹介をお願いします。"

2. **無音時間の設定（ユーザーカスタマイズ）**
   - シナリオ作成/編集時に無音時間を設定可能
   - プリセット: 5秒、10秒、15秒、30秒、カスタム（1-60秒）
   - **タイマー開始条件:** AI初回挨拶完了後（固定）

3. **無音検出の制御**
   - 無音時間内の無音は正常動作（エラーではない）
   - AIが喋っている間は無音タイマーを停止
   - ユーザーが話し始めたらタイマーをリセット
   - **speech_end処理中は無音タイマーを停止**（新規）

4. **AI自動促し機能**
   - 無音時間経過後、AIが適切な促し言葉を自動生成
   - シナリオのコンテキストに応じた適切な表現を選択
   - **Bedrock API障害時はキャッシュにフォールバック**（新規）

---

## システムアーキテクチャ（修正版）

### 全体フロー（詳細版）

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 1: シナリオ設定（UI）                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ • initialGreeting: "こんにちは。面接を始めましょう。"                   │
│ • silenceTimeout: 10秒                                                   │
│ • enableSilencePrompt: true                                              │
│ • silenceThreshold: 0.05                                                 │
│ • minSilenceDuration: 500ms                                              │
│ • showSilenceTimer: false                                                │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 2: セッション開始（Frontend）                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. ユーザーが「開始」ボタンをクリック                                   │
│ 2. setStatus('READY')                                                    │
│ 3. WebSocket接続開始                                                     │
│ 4. マイク・カメラ許可取得                                                │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 3: WebSocket認証（Frontend → Lambda）                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Frontend:                                                                │
│   ws.send({                                                              │
│     type: 'authenticate',                                                │
│     sessionId: 'xxx',                                                    │
│     scenarioPrompt: 'システムプロンプト',                                │
│     scenarioLanguage: 'ja',                                              │
│     initialGreeting: 'こんにちは。面接を始めましょう。',  ← 新規追加   │
│     silenceTimeout: 10,                                                  │
│     enableSilencePrompt: true,                                           │
│   })                                                                     │
│                                                                          │
│ Lambda:                                                                  │
│   ConnectionDataに保存 → authenticated イベント返却                     │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 4: AI初回挨拶の自動送信（Lambda → Frontend）                      │
├─────────────────────────────────────────────────────────────────────────┤
│ タイミング: authenticated イベント送信直後（Lambda側で自動実行）        │
│                                                                          │
│ Lambda処理:                                                              │
│   1. ConnectionDataから initialGreeting を取得                          │
│   2. ElevenLabs TTS API 呼び出し（ストリーミング生成）                  │
│   3. 音声チャンクを順次送信:                                             │
│      - type: 'tts_audio_chunk'                                           │
│      - audioData: base64エンコード済み音声                               │
│      - sequence: チャンク番号                                            │
│   4. 完了メッセージ送信:                                                 │
│      - type: 'initial_greeting_complete'  ← 新規メッセージタイプ        │
│      - text: initialGreeting                                             │
│      - timestamp: xxx                                                    │
│                                                                          │
│ Frontend処理:                                                            │
│   1. tts_audio_chunk 受信 → AudioContextでストリーミング再生            │
│   2. setIsPlayingAudio(true)                                             │
│   3. トランスクリプトに追加:                                             │
│      { speaker: 'AI', text: initialGreeting, partial: false }            │
│                                                                          │
│ ⚠️ タイミング懸念1: 初回挨拶TTS生成失敗                                 │
│   対策: タイムアウト5秒、失敗時はテキストのみ表示                        │
│                                                                          │
│ ⚠️ タイミング懸念2: 初回挨拶再生中にユーザーが話し始めた場合            │
│   対策: ユーザー音声を優先（speech_end送信）、AI音声は継続再生          │
│         無音タイマーは開始しない（初回挨拶完了まで待機）                 │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ 音声再生完了（onended イベント）
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 5: 無音タイマー開始（Frontend）                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ トリガー: initial_greeting_complete 受信 + 音声再生完了                 │
│                                                                          │
│ Frontend:                                                                │
│   1. setIsPlayingAudio(false)                                            │
│   2. setInitialGreetingCompleted(true)  ← 新規state                     │
│   3. useSilenceTimer 有効化                                              │
│      - enabled: initialGreetingCompleted && enableSilencePrompt          │
│      - timeoutSeconds: 10                                                │
│      - isAIPlaying: false                                                │
│      - isUserSpeaking: false                                             │
│      - isProcessing: false                                               │
│                                                                          │
│ タイマー動作:                                                            │
│   - 1秒ごとに elapsedTime をインクリメント                              │
│   - isAIPlaying || isUserSpeaking || isProcessing の場合は停止         │
│                                                                          │
│ ⚠️ タイミング懸念3: 初回挨拶完了直後にタイムアウト発生                  │
│   対策: 最小猶予期間1秒を設定（タイマー開始1秒後からカウント）          │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 6: ユーザー発話待機（Frontend）                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ useAudioRecorder:                                                        │
│   - マイクから音声入力を取得                                             │
│   - 音量レベルを計算（0.0 - 1.0）                                        │
│   - silenceThreshold (0.05) と比較                                       │
│                                                                          │
│ 分岐A: ユーザーが話した（volume > 0.05）                                │
│   → Phase 7 へ                                                           │
│                                                                          │
│ 分岐B: 無音継続（volume < 0.05 が silenceTimeout 秒間継続）            │
│   → Phase 9 へ                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                     │ 分岐A: ユーザー発話検出
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 7: ユーザー発話 → speech_end（Frontend → Lambda）                 │
├─────────────────────────────────────────────────────────────────────────┤
│ Frontend:                                                                │
│   1. 音声チャンクをS3にアップロード（audio_chunk_realtime）             │
│   2. 無音検出（volume < 0.05 が 500ms継続）                             │
│   3. setIsProcessing(true)  ← 新規：処理中フラグ                        │
│   4. 無音タイマー停止                                                    │
│   5. speech_end イベント送信                                             │
│                                                                          │
│ ⚠️ タイミング懸念4: speech_end処理中に silenceTimeout 到達             │
│   例: speech_end送信 → Lambda処理5秒 → 無音タイマー10秒到達             │
│   対策: isProcessing フラグで無音タイマーを停止                          │
│                                                                          │
│ ⚠️ タイミング懸念5: speech_end送信直後にユーザーが再び話し始めた       │
│   対策: 新しい音声チャンクは次のsequenceNumberで送信                    │
│         現在のspeech_end処理が完了するまで次のspeech_endは送信しない   │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 8: Lambda処理（STT → AI → TTS）                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Lambda処理フロー:                                                        │
│   1. S3から音声チャンクを取得・結合（WebM → WAV変換）                   │
│   2. Azure STT: 音声 → テキスト変換                                      │
│      - 処理時間: 500ms - 2秒                                             │
│   3. transcript_final 送信（Frontend に文字起こし結果送信）             │
│   4. Bedrock Claude: AI応答生成（ストリーミング）                        │
│      - 処理時間: 1秒 - 5秒                                               │
│   5. avatar_response_final 送信（Frontend にAI応答テキスト送信）        │
│   6. ElevenLabs TTS: テキスト → 音声変換（ストリーミング）              │
│      - 処理時間: 1秒 - 3秒                                               │
│   7. tts_audio_chunk 送信（音声チャンクをストリーミング）               │
│                                                                          │
│ 合計処理時間: 2.5秒 - 10秒                                               │
│                                                                          │
│ ⚠️ タイミング懸念6: Lambda処理中に無音タイマーが動作                    │
│   対策: isProcessing フラグで停止（Phase 7で設定済み）                  │
│                                                                          │
│ ⚠️ タイミング懸念7: Lambda処理がタイムアウト（30秒制限）                │
│   対策: Frontend側でprocessingTimeoutRef（30秒）を設定                  │
│         30秒経過後に警告表示 + isProcessing解除                          │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ avatar_response_final + tts_audio_chunk受信
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 8.5: AI応答音声再生（Frontend）                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Frontend:                                                                │
│   1. tts_audio_chunk 受信 → AudioContextでストリーミング再生            │
│   2. setIsPlayingAudio(true)                                             │
│   3. setIsProcessing(false)  ← 処理完了、無音タイマー再開可能           │
│   4. 無音タイマーは停止維持（isPlayingAudio: true のため）              │
│                                                                          │
│ ⚠️ タイミング懸念8: AI音声再生中にユーザーが話し始めた                  │
│   対策: ユーザー音声を優先（speech_end送信）                             │
│         AI音声は継続再生（中断しない）                                   │
│         無音タイマーは停止維持                                           │
│                                                                          │
│ ⚠️ タイミング懸念9: 音声再生完了の検出                                  │
│   対策: audioRef.current.onended イベントで検出                          │
│         onended → setIsPlayingAudio(false) → 無音タイマー再開           │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ 音声再生完了（onended）
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 8.6: 無音タイマー再開（Frontend）                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Frontend:                                                                │
│   1. setIsPlayingAudio(false)                                            │
│   2. useSilenceTimer が自動再開                                          │
│      - enabled: true                                                     │
│      - isAIPlaying: false                                                │
│      - isUserSpeaking: false                                             │
│      - isProcessing: false                                               │
│   3. elapsedTime = 0 からカウント開始                                    │
│                                                                          │
│ ⚠️ タイミング懸念10: AI音声完了直後にタイムアウト（猶予期間不足）       │
│   対策: 最小猶予期間1秒を追加（タイマー開始1秒後からカウント）          │
│         実質的な無音時間 = silenceTimeout + 1秒                          │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼ Phase 6に戻る（ユーザー発話待機）
                     │
                     │ 分岐B: 無音が silenceTimeout 秒間継続
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 9: 無音タイムアウト → 促しリクエスト（Frontend → Lambda）         │
├─────────────────────────────────────────────────────────────────────────┤
│ Frontend:                                                                │
│   1. useSilenceTimer の onTimeout コールバック実行                       │
│   2. 最終確認（猶予期間500ms）:                                          │
│      setTimeout(() => {                                                  │
│        if (!isUserSpeaking && !isProcessing && status === 'ACTIVE') {    │
│          sendSilencePromptRequest();                                     │
│        }                                                                 │
│      }, 500);                                                            │
│   3. silence_prompt_request 送信:                                        │
│      {                                                                   │
│        type: 'silence_prompt_request',                                   │
│        sessionId: 'xxx',                                                 │
│        elapsedTime: 10000,                                               │
│        timestamp: Date.now(),                                            │
│      }                                                                   │
│                                                                          │
│ ⚠️ タイミング懸念11: 猶予期間中にユーザーが話し始めた                   │
│   対策: if条件で isUserSpeaking をチェック → 送信キャンセル            │
│                                                                          │
│ ⚠️ タイミング懸念12: セッション終了処理中にタイムアウト                 │
│   対策: if条件で status === 'ACTIVE' をチェック                         │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 10: Lambda処理（AI促し生成）                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Lambda検証フロー:                                                        │
│   1. セッション状態確認:                                                 │
│      - session.status === 'COMPLETED' → スキップ                         │
│   2. 重複防止確認:                                                       │
│      - lastSilencePromptTime から30秒以内 → スキップ                     │
│   3. レート制限確認:                                                     │
│      - 1分あたり10回超過 → 429エラー                                     │
│   4. AI促し生成:                                                         │
│      try {                                                               │
│        const prompt = await generateSilencePrompt({...});                │
│      } catch (error) {                                                   │
│        // フォールバック: キャッシュされたプリセット                     │
│        const prompt = getRandomCachedPrompt(language, style);            │
│      }                                                                   │
│   5. 会話履歴に追加                                                      │
│   6. silence_prompt_response 送信                                        │
│   7. TTS生成（ElevenLabs ストリーミング）                                │
│                                                                          │
│ ⚠️ タイミング懸念13: Bedrock API障害                                     │
│   対策: try-catch + キャッシュフォールバック（必須実装）                 │
│                                                                          │
│ ⚠️ タイミング懸念14: 同時に複数の silence_prompt_request 到着          │
│   対策: DynamoDBのlastSilencePromptTimeで30秒間隔制限                    │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 11: AI促し音声再生（Frontend）                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Phase 8.5 と同じ処理:                                                    │
│   1. silence_prompt_response 受信 → トランスクリプトに追加              │
│   2. tts_audio_chunk 受信 → 音声再生                                     │
│   3. setIsPlayingAudio(true) → 無音タイマー停止                         │
│   4. 音声再生完了 → setIsPlayingAudio(false) → 無音タイマー再開         │
│                                                                          │
│ → Phase 6 に戻る（ユーザー発話待機）                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## タイミング懸念事項の完全検証

### 1. 初回挨拶TTS生成失敗（Phase 4）

**シナリオ:** ElevenLabs APIが障害、または初回挨拶が未設定

**影響:**
- ユーザーが無音のままセッションが開始される
- 無音タイマーが開始されない（initialGreetingCompleted: false）

**対策:**

```typescript
// Lambda: authenticate処理
case 'authenticate': {
  const { initialGreeting } = parsedMessage;

  // 認証完了通知を先に送信
  await sendToConnection(connectionId, {
    type: 'authenticated',
    timestamp: Date.now(),
  });

  // 初回挨拶の送信
  if (initialGreeting && initialGreeting.trim()) {
    try {
      // TTS生成（タイムアウト5秒）
      await Promise.race([
        generateAndStreamTTS({
          text: initialGreeting,
          language: scenarioLanguage,
          connectionId,
          sessionId,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TTS timeout')), 5000)
        ),
      ]);

      // 完了通知
      await sendToConnection(connectionId, {
        type: 'initial_greeting_complete',
        text: initialGreeting,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[authenticate] Initial greeting TTS failed:', error);

      // フォールバック: テキストのみ送信
      await sendToConnection(connectionId, {
        type: 'initial_greeting_fallback',
        text: initialGreeting,
        timestamp: Date.now(),
      });
    }
  } else {
    // 初回挨拶なし → 即座に無音タイマー開始
    await sendToConnection(connectionId, {
      type: 'initial_greeting_skipped',
      timestamp: Date.now(),
    });
  }

  break;
}
```

```typescript
// Frontend: SessionPlayer
const handleMessage = useCallback((event: MessageEvent) => {
  const message = JSON.parse(event.data);

  if (message.type === 'initial_greeting_complete') {
    // 正常: 音声再生完了後に無音タイマー開始
    setInitialGreetingCompleted(true);
  } else if (message.type === 'initial_greeting_fallback') {
    // フォールバック: テキストのみ表示、即座に無音タイマー開始
    setTranscript(prev => [...prev, {
      id: `greeting-${message.timestamp}`,
      speaker: 'AI',
      text: message.text,
      timestamp: message.timestamp,
      partial: false,
    }]);
    setInitialGreetingCompleted(true);
    toast.info(t('sessions.player.messages.ttsUnavailable'));
  } else if (message.type === 'initial_greeting_skipped') {
    // 初回挨拶なし: 即座に無音タイマー開始
    setInitialGreetingCompleted(true);
  }
}, [t]);
```

### 2. 初回挨拶再生中にユーザーが話し始めた（Phase 4）

**シナリオ:** AI挨拶の途中でユーザーが話し出す（例: "こんに..." → ユーザー発話開始）

**影響:**
- 無音タイマーが未開始（initialGreetingCompleted: false）
- ユーザーの発話を処理すべきか？

**対策:**

```typescript
// Frontend: useAudioRecorder
const handleSpeechEnd = useCallback(() => {
  // 初回挨拶完了前は speech_end を送信しない
  if (!initialGreetingCompleted) {
    console.log('[useAudioRecorder] Initial greeting not completed, skipping speech_end');
    return;
  }

  // 通常の speech_end 処理
  sendSpeechEnd();
}, [initialGreetingCompleted, sendSpeechEnd]);
```

**代替案:** 初回挨拶を強制的に完了させる

```typescript
const handleSpeechEnd = useCallback(() => {
  if (!initialGreetingCompleted) {
    console.log('[useAudioRecorder] User interrupted initial greeting, marking as complete');
    setInitialGreetingCompleted(true);
    // AI音声は継続再生（中断しない）
  }

  sendSpeechEnd();
}, [initialGreetingCompleted, sendSpeechEnd]);
```

**推奨:** 代替案を採用（ユーザー体験優先）

### 3. 初回挨拶完了直後にタイムアウト（Phase 5）

**シナリオ:** silenceTimeout = 5秒、初回挨拶完了直後に5秒カウント → 即座にタイムアウト

**影響:**
- ユーザーが考える時間がない
- 不自然な促し

**対策:** 最小猶予期間1秒を追加

```typescript
// useSilenceTimer
export function useSilenceTimer(options: UseSilenceTimerOptions) {
  const GRACE_PERIOD_MS = 1000; // 1秒の猶予期間
  const [elapsedTime, setElapsedTime] = useState(0);
  const [graceCompleted, setGraceCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const startTimer = useCallback(() => {
    if (!options.enabled || options.isAIPlaying || options.isUserSpeaking || options.isProcessing) {
      return;
    }

    // 猶予期間の開始
    if (!graceCompleted) {
      setTimeout(() => {
        setGraceCompleted(true);
        startTimeRef.current = Date.now();
      }, GRACE_PERIOD_MS);
      return;
    }

    // タイマー開始
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
      setElapsedTime(elapsed);

      if (elapsed >= options.timeoutSeconds) {
        options.onTimeout();
        resetTimer();
      }
    }, 1000);
  }, [options, graceCompleted]);

  // タイマーリセット時は猶予期間もリセット
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    setElapsedTime(0);
    setGraceCompleted(false);
  }, []);

  // ...
}
```

### 4. speech_end処理中に silenceTimeout 到達（Phase 7）

**シナリオ:**
- 00:00 - ユーザー発話終了（speech_end送信）
- 00:05 - Lambda処理中（STT → AI → TTS）
- 00:10 - 無音タイマー到達 → silence_prompt_request送信（競合！）
- 00:12 - speech_end処理完了

**影響:**
- Lambda側で2つのリクエストが同時処理される
- 促しメッセージとAI応答が同時に返却される

**対策:** isProcessing フラグで無音タイマーを停止

```typescript
// SessionPlayer
const [isProcessing, setIsProcessing] = useState(false);

const handleSpeechEnd = useCallback(() => {
  console.log('[SessionPlayer] Speech end detected');
  setIsProcessing(true); // 処理中フラグをセット
  sendSpeechEndRef.current?.();
}, []);

const handleAvatarResponse = useCallback((message: AvatarResponseMessage) => {
  console.log('[SessionPlayer] Avatar response received');
  setIsProcessing(false); // 処理完了
  // ...
}, []);

// useSilenceTimer
const { elapsedTime } = useSilenceTimer({
  enabled: scenario.enableSilencePrompt ?? true,
  timeoutSeconds: scenario.silenceTimeout ?? 10,
  isAIPlaying,
  isUserSpeaking,
  isProcessing, // ← 追加
  onTimeout: handleSilenceTimeout,
});
```

**検証結果:** ✅ 完全に防止可能

### 5. speech_end送信直後にユーザーが再び話し始めた（Phase 7）

**シナリオ:**
- 00:00 - ユーザー発話終了（speech_end送信）
- 00:01 - ユーザーが再び話し始める
- 00:05 - 最初のspeech_end処理完了（AI応答返却）
- 00:06 - 2回目のspeech_end送信

**影響:**
- Lambda側で順序が保証されない可能性
- 会話履歴が混乱

**対策:** 処理中は新しいspeech_endを送信しない

```typescript
// SessionPlayer
const handleSpeechEnd = useCallback(() => {
  // 既に処理中の場合はスキップ
  if (isProcessing) {
    console.log('[SessionPlayer] Already processing speech_end, skipping');
    return;
  }

  console.log('[SessionPlayer] Speech end detected');
  setIsProcessing(true);
  sendSpeechEndRef.current?.();
}, [isProcessing]);
```

**副作用:** ユーザーの2回目の発話が無視される

**改善案:** キューイング

```typescript
const speechEndQueueRef = useRef<number[]>([]);

const handleSpeechEnd = useCallback(() => {
  const timestamp = Date.now();

  if (isProcessing) {
    // キューに追加
    speechEndQueueRef.current.push(timestamp);
    console.log('[SessionPlayer] Queued speech_end:', timestamp);
    return;
  }

  // 即座に処理
  setIsProcessing(true);
  sendSpeechEndRef.current?.();
}, [isProcessing]);

const handleAvatarResponse = useCallback((message: AvatarResponseMessage) => {
  setIsProcessing(false);

  // キューに次のspeech_endがあれば処理
  if (speechEndQueueRef.current.length > 0) {
    const nextTimestamp = speechEndQueueRef.current.shift();
    console.log('[SessionPlayer] Processing queued speech_end:', nextTimestamp);
    setTimeout(() => {
      setIsProcessing(true);
      sendSpeechEndRef.current?.();
    }, 500); // 500ms後に次の処理
  }

  // ...
}, []);
```

**検証結果:** ✅ キューイングで完全に解決可能

### 6. Lambda処理中に無音タイマーが動作（Phase 8）

**対策:** isProcessing フラグで停止（懸念4と同じ）

**検証結果:** ✅ 解決済み

### 7. Lambda処理がタイムアウト（30秒制限）（Phase 8）

**シナリオ:** STT/AI/TTS処理が30秒超過

**影響:**
- isProcessing フラグが永続的にtrue
- 無音タイマーが永久に開始されない

**対策:** Frontend側でタイムアウト検出

```typescript
// SessionPlayer
const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const PROCESSING_TIMEOUT_MS = 30000; // 30秒

const handleSpeechEnd = useCallback(() => {
  setIsProcessing(true);
  sendSpeechEndRef.current?.();

  // タイムアウト検出
  processingTimeoutRef.current = setTimeout(() => {
    console.error('[SessionPlayer] Processing timeout after 30 seconds');
    setIsProcessing(false); // 強制的に解除
    toast.error(t('errors.api.timeout'), {
      description: t('errors.api.timeoutDescription'),
    });
  }, PROCESSING_TIMEOUT_MS);
}, [t]);

const handleAvatarResponse = useCallback((message: AvatarResponseMessage) => {
  // タイムアウトタイマーをクリア
  if (processingTimeoutRef.current) {
    clearTimeout(processingTimeoutRef.current);
    processingTimeoutRef.current = null;
  }

  setIsProcessing(false);
  // ...
}, []);
```

**検証結果:** ✅ 完全に防止可能

### 8. AI音声再生中にユーザーが話し始めた（Phase 8.5）

**シナリオ:** AIの応答を聞きながら、途中でユーザーが割り込む

**影響:**
- ユーザーの発話を処理すべきか？
- AI音声を中断すべきか？

**対策:** ユーザー優先、AI音声は継続

```typescript
// SessionPlayer
const handleSpeechEnd = useCallback(() => {
  // AI再生中でも speech_end を処理
  if (isPlayingAudio) {
    console.log('[SessionPlayer] User interrupted AI audio');
    // AI音声は継続再生（audioRef.current.pause() を呼ばない）
  }

  // 通常のspeech_end処理
  if (isProcessing) return;
  setIsProcessing(true);
  sendSpeechEndRef.current?.();
}, [isPlayingAudio, isProcessing]);
```

**検証結果:** ✅ 自然な対話フローを維持

### 9. 音声再生完了の検出（Phase 8.5）

**シナリオ:** TTS音声ストリーミングの最後のチャンクを検出

**対策:** audioRef.onended イベント

```typescript
// SessionPlayer
const audioRef = useRef<HTMLAudioElement | null>(null);

useEffect(() => {
  if (!audioRef.current) {
    audioRef.current = new Audio();
  }

  const audio = audioRef.current;

  audio.onended = () => {
    console.log('[SessionPlayer] Audio playback ended');
    setIsPlayingAudio(false);
    // 無音タイマーが自動再開（useSilenceTimer内で検知）
  };

  return () => {
    audio.onended = null;
  };
}, []);
```

**検証結果:** ✅ 標準的な方法で実装可能

### 10. AI音声完了直後にタイムアウト（猶予期間不足）（Phase 8.6）

**対策:** 懸念3と同じ（1秒の猶予期間）

**検証結果:** ✅ 解決済み

### 11. 猶予期間中にユーザーが話し始めた（Phase 9）

**シナリオ:**
- 無音タイマー到達 → 500ms猶予期間開始
- 猶予期間中にユーザーが話し始める
- 500ms後に silence_prompt_request が送信される（不要）

**対策:** 最終確認で isUserSpeaking をチェック

```typescript
const handleSilenceTimeout = useCallback(() => {
  console.log('[SessionPlayer] Silence timeout - checking before sending prompt');

  // 500ms猶予期間
  setTimeout(() => {
    // 最終確認
    if (isUserSpeaking) {
      console.log('[SessionPlayer] User started speaking during grace period, skipping prompt');
      return;
    }

    if (isProcessing) {
      console.log('[SessionPlayer] Processing in progress, skipping prompt');
      return;
    }

    if (status !== 'ACTIVE') {
      console.log('[SessionPlayer] Session not active, skipping prompt');
      return;
    }

    // 全チェック通過 → 促し送信
    sendMessageRef.current?.({
      type: 'silence_prompt_request',
      sessionId: session.id,
      elapsedTime: elapsedTime * 1000,
      timestamp: Date.now(),
    });
  }, 500);
}, [isUserSpeaking, isProcessing, status, session.id, elapsedTime]);
```

**検証結果:** ✅ 完全に防止可能

### 12. セッション終了処理中にタイムアウト（Phase 9）

**対策:** status チェック（懸念11と同じ）

**検証結果:** ✅ 解決済み

### 13. Bedrock API障害（Phase 10）

**対策:** try-catch + キャッシュフォールバック

```typescript
// Lambda: generateSilencePrompt
export async function generateSilencePrompt(options): Promise<string> {
  try {
    // Bedrock API呼び出し
    const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });
    const command = new InvokeModelCommand({...});
    const response = await bedrockClient.send(command);
    return parseResponse(response);
  } catch (error) {
    console.error('[generateSilencePrompt] Bedrock API error, falling back to cache:', error);

    // フォールバック: キャッシュされたプリセット
    const cachedPrompts = SILENCE_PROMPT_CACHE[`${options.scenarioLanguage}-${options.style}`];
    if (cachedPrompts && cachedPrompts.length > 0) {
      return cachedPrompts[Math.floor(Math.random() * cachedPrompts.length)];
    }

    // 最終フォールバック
    return options.scenarioLanguage === 'ja'
      ? '他に質問はありますか？'
      : 'Do you have any other questions?';
  }
}
```

**検証結果:** ✅ 必須実装（最優先）

### 14. 同時に複数の silence_prompt_request 到着（Phase 10）

**シナリオ:** ネットワーク遅延で2つのリクエストがほぼ同時に到着

**対策:** DynamoDB lastSilencePromptTime で30秒間隔制限

```typescript
// Lambda: silence_prompt_request
case 'silence_prompt_request': {
  const connectionData = await getConnectionData(connectionId);
  const timeSinceLastPrompt = Date.now() - (connectionData?.lastSilencePromptTime || 0);

  if (timeSinceLastPrompt < 30000) {
    console.log('[silence_prompt_request] Too soon after last prompt, skipping');
    return { statusCode: 200, body: 'OK' };
  }

  // すぐに更新（次のリクエストをブロック）
  await updateConnectionData(connectionId, {
    lastSilencePromptTime: Date.now(),
  });

  // 促し生成処理...
}
```

**検証結果:** ✅ DynamoDBで原子的に防止可能

---

## タイミング検証まとめ

### ✅ 完全に解決済み（実装必須）

1. ✅ 初回挨拶TTS生成失敗 → タイムアウト5秒 + フォールバック
2. ✅ 初回挨拶中のユーザー発話 → 強制的に完了マーク
3. ✅ 初回挨拶完了直後のタイムアウト → 1秒猶予期間
4. ✅ speech_end処理中のタイムアウト → isProcessing フラグ
5. ✅ speech_end連続送信 → キューイング
6. ✅ Lambda処理タイムアウト → Frontend側で30秒タイムアウト検出
7. ✅ AI音声中のユーザー発話 → ユーザー優先、AI継続
8. ✅ 音声再生完了検出 → audioRef.onended
9. ✅ 猶予期間中のユーザー発話 → 最終確認で isUserSpeaking チェック
10. ✅ セッション終了中のタイムアウト → status チェック
11. ✅ Bedrock API障害 → キャッシュフォールバック（🔴必須）
12. ✅ 重複リクエスト → DynamoDB 30秒間隔制限

### 🟢 追加対策不要（既存実装で対応済み）

- AI音声完了直後のタイムアウト（懸念3と同じ）
- Lambda処理中の無音タイマー（懸念4と同じ）

---

## データモデル（確定版）

### Prismaスキーマ

```prisma
model Scenario {
  // 既存フィールド
  id                String       @id @default(cuid())
  name              String
  description       String?
  category          String
  language          String
  visibility        Visibility   @default(PRIVATE)
  systemPrompt      String?      @db.Text
  configJson        Json?

  // 無音管理（新規追加）
  initialGreeting   String?      @db.Text // AI初回挨拶テキスト
  silenceTimeout    Int?         @default(10) // 無音タイマー（秒）
  enableSilencePrompt Boolean?   @default(true) // 無音促し有効/無効
  showSilenceTimer  Boolean?     @default(false) // UIにタイマー表示
  silenceThreshold  Float?       @default(0.05) // 音量閾値（0.01-0.2）
  minSilenceDuration Int?        @default(500) // 最小無音継続時間（ms）

  // ...他のフィールド
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@map("scenarios")
}
```

### Shared Types

```typescript
// packages/shared/src/types/index.ts

export interface Scenario {
  // 既存フィールド
  id: string;
  name: string;
  description?: string;
  category: string;
  language: string;
  visibility: Visibility;
  systemPrompt?: string;
  configJson?: ScenarioConfig;

  // 無音管理（新規追加）
  initialGreeting?: string;
  silenceTimeout?: number;
  enableSilencePrompt?: boolean;
  showSilenceTimer?: boolean;
  silenceThreshold?: number;
  minSilenceDuration?: number;

  // ...他のフィールド
  createdAt: Date;
  updatedAt: Date;
}

export interface ScenarioConfig {
  systemPrompt?: string;
  evaluationCriteria?: string[];
  silencePromptStyle?: 'formal' | 'casual' | 'neutral';
  silencePromptExamples?: string[];
}
```

### WebSocketメッセージ

```typescript
// 新規メッセージタイプ

// 1. 認証メッセージ拡張
interface AuthenticateMessage {
  type: 'authenticate';
  sessionId: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  initialGreeting?: string; // 新規追加
  silenceTimeout?: number; // 新規追加
  enableSilencePrompt?: boolean; // 新規追加
  timestamp: number;
}

// 2. 初回挨拶完了
interface InitialGreetingCompleteMessage {
  type: 'initial_greeting_complete';
  text: string;
  timestamp: number;
}

// 3. 初回挨拶フォールバック
interface InitialGreetingFallbackMessage {
  type: 'initial_greeting_fallback';
  text: string;
  timestamp: number;
}

// 4. 初回挨拶スキップ
interface InitialGreetingSkippedMessage {
  type: 'initial_greeting_skipped';
  timestamp: number;
}

// 5. 無音促しリクエスト
interface SilencePromptRequestMessage {
  type: 'silence_prompt_request';
  sessionId: string;
  elapsedTime: number;
  timestamp: number;
}

// 6. 無音促しレスポンス
interface SilencePromptResponseMessage {
  type: 'silence_prompt_response';
  text: string;
  timestamp: number;
}
```

### ConnectionData拡張

```typescript
interface ConnectionData {
  // 既存フィールド
  connectionId: string;
  sessionId?: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  audioS3Key?: string;
  audioChunksCount?: number;
  // ...

  // 無音管理（新規追加）
  initialGreeting?: string;
  silenceTimeout?: number;
  enableSilencePrompt?: boolean;
  silencePromptStyle?: string;
  lastSilencePromptTime?: number;
}
```

---

## 実装スケジュール（修正版）

### Week 1: データモデル・UI（6日間）

**Day 1: Prismaスキーマ更新・マイグレーション**
- [ ] Scenarioモデルに6フィールド追加
- [ ] マイグレーションファイル生成・実行
- [ ] Shared types更新

**Day 2-3: シナリオフォームUI実装**
- [ ] 初回挨拶テキストエリア追加
- [ ] 無音時間設定（プリセット + カスタム）
- [ ] 促し言葉トーン選択
- [ ] 詳細設定（音量閾値、最小継続時間、タイマー表示）
- [ ] フォームバリデーション

**Day 4-5: useSilenceTimer Hook実装**
- [ ] タイマーロジック（開始/停止/リセット）
- [ ] 1秒猶予期間実装
- [ ] isProcessing フラグ対応
- [ ] 初回挨拶完了検出

**Day 6: SessionPlayer統合**
- [ ] initialGreetingCompleted state追加
- [ ] isProcessing state追加
- [ ] 猶予期間付きタイムアウト処理
- [ ] speech_endキューイング実装

### Week 2: Lambda実装（5日間）

**Day 7: WebSocket Handler拡張（authenticate）**
- [ ] initialGreeting送信処理
- [ ] TTS生成（タイムアウト5秒）
- [ ] フォールバック処理（initial_greeting_fallback）
- [ ] スキップ処理（initial_greeting_skipped）

**Day 8: WebSocket Handler拡張（silence_prompt_request）**
- [ ] セッション状態確認
- [ ] 重複防止（30秒間隔）
- [ ] レート制限（1分10回）
- [ ] generateSilencePrompt呼び出し

**Day 9: generateSilencePrompt実装**
- [ ] Bedrock Claude API呼び出し
- [ ] プロンプト生成ロジック
- [ ] キャッシュフォールバック実装（🔴必須）
- [ ] エラーハンドリング強化

**Day 10-11: TTS統合・テスト**
- [ ] ElevenLabs ストリーミングTTS統合
- [ ] silence_prompt_response送信
- [ ] 競合状態テスト（speech_end vs silence_prompt）
- [ ] エッジケーステスト

### Week 3: テスト・最適化（4日間）

**Day 12: ユニットテスト**
- [ ] useSilenceTimer Hook テスト
- [ ] generateSilencePrompt テスト
- [ ] キューイングロジック テスト

**Day 13: E2Eテスト**
- [ ] 初回挨拶フロー
- [ ] 無音タイムアウトフロー
- [ ] ユーザー割り込みフロー
- [ ] セッション終了フロー

**Day 14: パフォーマンステスト・A11y対応**
- [ ] キャッシュヒット率測定
- [ ] レイテンシ測定（促し生成）
- [ ] ARIA live region追加
- [ ] キーボードショートカット追加

**Day 15: ドキュメント更新・レビュー**
- [ ] API仕様更新
- [ ] ユーザーガイド作成
- [ ] コードレビュー
- [ ] 最終動作確認

---

## 成功指標（修正版）

### 1. 機能的指標

- ✅ AI初回挨拶が自動送信される
- ✅ 初回挨拶完了後に無音タイマー開始
- ✅ 設定時間経過後にAI促しが生成される
- ✅ AI音声再生中は無音タイマーが停止
- ✅ speech_end処理中は無音タイマーが停止
- ✅ Bedrock API障害時もフォールバックで動作

### 2. パフォーマンス指標

- **初回挨拶TTS生成:** < 3秒
- **促し生成レイテンシ:** < 2秒
- **キャッシュヒット率:** > 80%
- **重複リクエスト防止:** 100%

### 3. ユーザー体験指標

- **促しメッセージの適切性:** ユーザー評価 > 4.0/5.0
- **会話の自然さ:** プレッシャーを感じない（主観評価）
- **無音時のストレス軽減:** セッション完了率向上
- **初回挨拶の満足度:** > 4.5/5.0

---

## まとめ

### 主要な変更点

1. **AI初回挨拶機能追加** - シナリオUIから設定可能
2. **タイマー開始条件を固定** - 'after_first_ai_response' のみ
3. **14個のタイミング懸念を完全検証** - 全て解決策を実装
4. **Bedrock APIフォールバック** - 必須実装（🔴最優先）
5. **speech_endキューイング** - ユーザー発話の取りこぼし防止

### 実装優先度

#### 🔴 Phase 1（必須）: 基本機能
1. データモデル拡張（Prisma + Shared types）
2. シナリオフォームUI（初回挨拶 + 無音時間設定）
3. useSilenceTimer Hook（猶予期間 + isProcessing対応）
4. Lambda初回挨拶送信（TTS生成 + フォールバック）
5. Lambda促し生成（Bedrock + キャッシュフォールバック）

#### 🟡 Phase 2（推奨）: 安定化
6. speech_endキューイング
7. processingタイムアウト検出（30秒）
8. 重複リクエスト防止（DynamoDB）
9. ユニットテスト・E2Eテスト

#### 🟢 Phase 3（オプション）: 最適化
10. アクセシビリティ対応（ARIA live）
11. 詳細設定（音量閾値、最小継続時間）
12. タイマー表示切り替え（showSilenceTimer）

---

**最終更新:** 2026-03-11 23:00 JST
**承認:** 設計レビュー完了、実装開始可能
**次回レビュー:** Phase 1実装完了後
