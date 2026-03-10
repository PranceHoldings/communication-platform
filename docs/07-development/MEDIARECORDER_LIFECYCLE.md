# MediaRecorder Lifecycle Analysis

**作成日:** 2026-03-10
**目的:** MediaRecorder API の動作を完全に理解し、再起動メカニズムを正しく設計する

---

## MediaRecorder の基本動作

### 1. start(timeslice) の動作

```javascript
mediaRecorder.start(1000); // 1秒ごとに ondataavailable を発火
```

**重要な挙動:**
- **最初のチャンク (chunk-0)**: 完全なEBMLヘッダー (1a45dfa3) を含む
- **2番目以降 (chunk-1, 2, 3...)**: フラグメント (SimpleBlock: 43c38103) のみ
- **timeslice間隔**: 正確に1000msではなく、ブラウザの実装に依存（900-1100ms程度のブレ）

### 2. stop() の動作とイベント順序

```javascript
mediaRecorder.stop();
```

**発火するイベントの順序（CRITICAL）:**

```
1. ondataavailable (最終バッファの残存データ)
   ↓
2. onstop
```

**重要:** `stop()` を呼んだ瞬間、以下が同期的に実行される：
1. 内部バッファに残っているデータがある場合、`ondataavailable` が発火
2. その後、`onstop` が発火
3. MediaRecorder.state が 'inactive' に遷移

**タイミング図:**

```
時刻: t0          t1000       t2000       t2500 (stop呼び出し)
      |           |           |           |
      start()     chunk-0     chunk-1     chunk-2 (最終バッファ)
                  ↓           ↓           ↓
                  ondataavailable (EBML header)
                              ondataavailable (fragment)
                                          ondataavailable (fragment) ← stop()で強制発火
                                          onstop ← 直後に発火
```

---

## 再起動メカニズムの問題分析

### 問題1: 古いrecorderの最終チャンクが新しいsequence番号で送信される

**シナリオ:**

```javascript
// 状態: sequenceNumber = 5, 次のchunkは chunk-000005.webm
onSpeechEnd() {
  sequenceNumber = 0;           // ← ここでリセット
  restartRecording();
}

restartRecording() {
  oldRecorder.stop();           // ← stop()が ondataavailable を発火
  // ↑ この ondataavailable で sequenceNumber=0 が使われる！
  // → 古いrecorderの fragment が chunk-000000.webm として送信される

  newRecorder.start(1000);      // ← 新しいrecorderのEBMLヘッダーはまだ
}
```

**結果:**
- chunk-000000.webm = 古いrecorderのfragment (43c38103) ❌
- chunk-000001.webm = 新しいrecorderのEBMLヘッダー (1a45dfa3) ← 順序が逆！

### 問題2: イベントハンドラの無効化タイミング

**修正前（不完全）:**

```javascript
oldRecorder.onstop = null;     // onstopのみ無効化
oldRecorder.stop();            // ondataavailable は発火する！
```

**修正後（正しい）:**

```javascript
oldRecorder.ondataavailable = null;  // 最終チャンク送信を阻止
oldRecorder.onstop = null;           // cleanup処理を阻止
oldRecorder.stop();
```

---

## 正しい再起動シーケンス（3フェーズ設計）

### フェーズ1: 古いrecorderの停止

```javascript
console.log('[Restart-Phase1] Starting restart sequence');

// 1. イベントハンドラを完全に無効化
oldRecorder.ondataavailable = null;  // CRITICAL: 最終チャンクを阻止
oldRecorder.onstop = null;           // CRITICAL: cleanup処理を阻止

// 2. 安全に停止
if (oldRecorder.state !== 'inactive') {
  oldRecorder.stop();
}

// 3. ログ出力（検証用）
console.log('[Restart-Phase1] Old recorder stopped', {
  finalState: oldRecorder.state,
  handlersDisabled: {
    ondataavailable: oldRecorder.ondataavailable === null,
    onstop: oldRecorder.onstop === null,
  }
});
```

### フェーズ2: 状態リセット

```javascript
// 4. sequence番号をリセット（古いrecorder完全停止後）
sequenceNumber = 0;
speechEndSent = true;
lastSpeechTime = Date.now();

// 5. ログ出力
console.log('[Restart-Phase2] State reset', {
  sequenceNumber,
  speechEndSent,
  timestamp: lastSpeechTime,
});
```

### フェーズ3: 新しいrecorderの作成

```javascript
// 6. 新しいMediaRecorderインスタンス作成
const newRecorder = new MediaRecorder(stream, { mimeType });

// 7. イベントハンドラ設定
newRecorder.ondataavailable = (event) => {
  const seq = sequenceNumber++;
  console.log('[Chunk] Captured', {
    sequence: seq,
    size: event.data.size,
    isFirstChunk: seq === 0,
    expectedHeader: seq === 0 ? 'EBML (1a45dfa3)' : 'Fragment (43c38103)',
  });

  // 最初のチャンクのヘッダー検証（開発時のみ）
  if (seq === 0 && process.env.NODE_ENV === 'development') {
    verifyEBMLHeader(event.data);
  }

  onAudioChunk(event.data, Date.now(), seq);
};

newRecorder.onstop = () => {
  console.log('[Stop] Recorder stopped (session end)');
  // 完全な停止処理（session終了時のみ）
};

// 8. 新しいrecorderを開始
mediaRecorderRef.current = newRecorder;
newRecorder.start(1000);

console.log('[Restart-Phase3] New recorder started', {
  state: newRecorder.state,
  mimeType: newRecorder.mimeType,
});
```

---

## React Hooks の正しい使用パターン

### 問題: 循環依存とstale closure

**❌ 間違ったパターン:**

```javascript
const handleSpeechEnd = useCallback(() => {
  restartRecording();  // ← restartRecording が定義される前に参照
}, [restartRecording]);

const { restartRecording } = useAudioRecorder({
  onSpeechEnd: handleSpeechEnd,  // ← 循環依存
});
```

**✅ 正しいパターン (useRef pattern):**

```javascript
// 1. refを用意
const restartRecordingRef = useRef<(() => void) | null>(null);

// 2. handleSpeechEndはrefを参照（依存なし）
const handleSpeechEnd = useCallback(() => {
  if (restartRecordingRef.current) {
    restartRecordingRef.current();
  }
}, []); // ← 依存配列が空

// 3. hookから取得
const { restartRecording } = useAudioRecorder({
  onSpeechEnd: handleSpeechEnd,
});

// 4. refを更新（再レンダリング時）
useEffect(() => {
  restartRecordingRef.current = restartRecording;
}, [restartRecording]);
```

---

## ログシステム設計

### ログレベル定義

```typescript
enum LogLevel {
  DEBUG = 'DEBUG',   // 詳細なデバッグ情報（開発時のみ）
  INFO = 'INFO',     // 通常の動作情報
  WARN = 'WARN',     // 警告（動作は継続）
  ERROR = 'ERROR',   // エラー（動作停止）
}

enum LogPhase {
  INIT = 'Init',
  RECORDING = 'Recording',
  RESTART_PHASE1 = 'Restart-Phase1',
  RESTART_PHASE2 = 'Restart-Phase2',
  RESTART_PHASE3 = 'Restart-Phase3',
  STOP = 'Stop',
  ERROR = 'Error',
}
```

### ログ構造化

```typescript
interface LogContext {
  phase: LogPhase;
  sequence?: number;
  recorderState?: MediaRecordingState;
  timestamp: number;
}

class AudioRecorderLogger {
  private sessionId: string;

  log(level: LogLevel, phase: LogPhase, message: string, data?: any) {
    const prefix = `[AudioRecorder:${phase}]`;
    const context = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      level,
      ...data,
    };

    switch (level) {
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(prefix, message, context);
        }
        break;
      case LogLevel.INFO:
        console.log(prefix, message, context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, context);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, context);
        break;
    }
  }
}
```

### 必須ログ出力ポイント

#### 1. 初期化時

```javascript
logger.log(LogLevel.INFO, LogPhase.INIT, 'Recording initialized', {
  mimeType: actualMimeType,
  timeslice: 1000,
  silenceThreshold: 0.05,
  silenceDuration: 500,
});
```

#### 2. 通常録音時

```javascript
logger.log(LogLevel.DEBUG, LogPhase.RECORDING, 'Chunk captured', {
  sequence: sequenceNumber,
  size: event.data.size,
  isHeader: sequenceNumber === 0,
});

logger.log(LogLevel.DEBUG, LogPhase.RECORDING, 'Audio level', {
  level: normalizedLevel.toFixed(3),
  aboveThreshold: normalizedLevel > silenceThreshold,
});

logger.log(LogLevel.INFO, LogPhase.RECORDING, 'Silence detected', {
  duration: silenceDurationMs,
  threshold: silenceDuration,
});
```

#### 3. 再起動時（3フェーズ）

```javascript
// Phase 1
logger.log(LogLevel.INFO, LogPhase.RESTART_PHASE1, 'Stopping old recorder', {
  state: oldRecorder.state,
  bufferedSequence: sequenceNumber,
});

logger.log(LogLevel.INFO, LogPhase.RESTART_PHASE1, 'Old recorder stopped', {
  handlersDisabled: {
    ondataavailable: oldRecorder.ondataavailable === null,
    onstop: oldRecorder.onstop === null,
  },
});

// Phase 2
logger.log(LogLevel.INFO, LogPhase.RESTART_PHASE2, 'State reset', {
  sequenceNumber: 0,
  speechEndSent: true,
});

// Phase 3
logger.log(LogLevel.INFO, LogPhase.RESTART_PHASE3, 'New recorder created', {
  mimeType: newRecorder.mimeType,
});

logger.log(LogLevel.INFO, LogPhase.RESTART_PHASE3, 'New recorder started', {
  state: newRecorder.state,
});
```

#### 4. ヘッダー検証（開発時のみ）

```javascript
logger.log(LogLevel.DEBUG, LogPhase.RESTART_PHASE3, 'Verifying EBML header', {
  sequence: 0,
  size: event.data.size,
});

// ヘッダーバイト確認
const reader = new FileReader();
reader.onload = () => {
  const buffer = new Uint8Array(reader.result);
  const header = Array.from(buffer.slice(0, 4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');

  const isValid = header === '1a 45 df a3';
  logger.log(
    isValid ? LogLevel.INFO : LogLevel.ERROR,
    LogPhase.RESTART_PHASE3,
    isValid ? '✅ Valid EBML header' : '❌ Invalid EBML header',
    { expected: '1a 45 df a3', actual: header }
  );
};
reader.readAsArrayBuffer(event.data);
```

#### 5. エラー時

```javascript
logger.log(LogLevel.ERROR, LogPhase.ERROR, 'MediaRecorder error', {
  error: event,
  state: mediaRecorder.state,
});

logger.log(LogLevel.ERROR, LogPhase.ERROR, 'Invalid header detected', {
  expected: '1a 45 df a3',
  actual: headerBytes,
  sequence: sequenceNumber,
});
```

---

## テストケース定義

### TC1: 通常録音（再起動なし）
**手順:**
1. セッション開始
2. 5秒間話す
3. セッション停止

**期待結果:**
- ✅ chunk-000000.webm: EBML header (1a 45 df a3)
- ✅ chunk-000001.webm: Fragment (43 c3 81 03)
- ✅ chunk-000002.webm: Fragment
- ✅ 文字起こし成功

### TC2: 1回再起動
**手順:**
1. セッション開始
2. 話す（2秒）
3. 無音（500ms以上）
4. 話す（2秒）
5. セッション停止

**期待結果:**
- ✅ 最初のセグメント: chunk-000000 (EBML), chunk-000001 (fragment)
- ✅ speech_end イベント発火
- ✅ 2番目のセグメント: chunk-000000 (EBML), chunk-000001 (fragment)
- ✅ 両方のセグメントで文字起こし成功

### TC3: 連続再起動（3セグメント）
**手順:**
1. セッション開始
2. 話す → 無音 → 話す → 無音 → 話す
3. セッション停止

**期待結果:**
- ✅ 各セグメントでchunk-000000がEBMLヘッダー
- ✅ 各セグメントで文字起こし成功

### TC4: タイミングエッジケース
**手順:**
1. セッション開始
2. 話す（1.5秒） ← timeslice中に無音検出
3. 無音（500ms）
4. 話す

**期待結果:**
- ✅ 古いrecorderの最終チャンクが送信されない
- ✅ 新しいrecorderのchunk-000000がEBMLヘッダー

### TC5: AudioContext closure防止
**手順:**
1. セッション開始
2. 話す → 無音（再起動）
3. 音声レベルメーターを確認

**期待結果:**
- ✅ 再起動後も音声レベルメーターが動作
- ✅ "Cannot close a closed AudioContext" エラーが発生しない

---

## 検証項目チェックリスト

### 設計検証
- [ ] MediaRecorder.stop()のイベント順序を文書化
- [ ] ondataavailableとonstopの発火タイミングを文書化
- [ ] EBMLヘッダー生成条件を文書化
- [ ] React hooksの依存関係を文書化
- [ ] 3フェーズ再起動シーケンスを設計

### 実装検証
- [ ] ondataavailableをnullに設定
- [ ] onstopをnullに設定
- [ ] sequenceNumberリセットのタイミング（Phase2）
- [ ] 新しいrecorder作成のタイミング（Phase3）
- [ ] useRefパターンで循環依存回避
- [ ] ログシステム実装

### ログ検証
- [ ] 各フェーズでログ出力
- [ ] chunk-0のヘッダーバイトを検証（開発時のみ）
- [ ] エラー条件を検出
- [ ] タイムスタンプを記録
- [ ] ログレベルを適切に設定

### テスト検証
- [ ] TC1: 通常録音テスト
- [ ] TC2: 1回再起動テスト
- [ ] TC3: 連続再起動テスト
- [ ] TC4: タイミングエッジケーステスト
- [ ] TC5: AudioContext closureテスト
- [ ] Lambda logsでEBMLヘッダー確認
- [ ] ブラウザconsoleでchunk順序確認

---

## 今後の改善方針

### 1. 自動テスト
- Playwright E2Eテスト
- MediaRecorder mockテスト
- 再起動シナリオの自動化

### 2. 監視
- Sentryエラートラッキング
- CloudWatch Logs Insights
- リアルタイムアラート

### 3. ドキュメント
- API仕様書
- トラブルシューティングガイド
- デバッグログ解析方法

---

**最終更新:** 2026-03-10
**次回レビュー:** Phase 1.5完了時
