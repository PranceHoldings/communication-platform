# MediaRecorder Restart Test Plan

**作成日:** 2026-03-10
**対象:** Phase 1.5 Day 1-3 - Real-time audio streaming implementation

---

## テスト環境

- **URL:** http://localhost:3000
- **ブラウザ:** Chrome/Edge (Chromium-based)
- **開発者ツール:** Console を開いて実行

---

## 事前準備

### 1. ログフィルタリング設定（推奨）

ブラウザのConsoleで以下のフィルタを設定：

```
AudioRecorder
```

これにより、AudioRecorderのログのみが表示されます。

### 2. Lambda Logs 監視（別ターミナル）

```bash
# WebSocket Lambda logs
aws logs tail /aws/lambda/prance-websocket-default-dev --follow

# または、speech_end のみをフィルタ
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --filter-pattern "speech_end"
```

---

## テストケース

### TC1: 通常録音（再起動なし）

**目的:** 基本的な録音機能が動作することを確認

**手順:**
1. http://localhost:3000/sessions にアクセス
2. 新しいセッションを作成
3. 「Start」ボタンをクリック
4. 5秒間話す（再起動なし）
5. 「Stop」ボタンをクリック

**期待されるログ:**

```
[AudioRecorder:Init] Recording initialized { mimeType, timeslice: 1000, ... }
[AudioRecorder:Recording] Chunk captured { sequence: 0, size: ..., isHeader: true, expectedType: 'EBML (1a45dfa3)' }
[AudioRecorder:Restart-Phase3] ✅ Valid EBML header { expected: '1a 45 df a3', actual: '1a 45 df a3' }
[AudioRecorder:Recording] Chunk captured { sequence: 1, size: ..., isHeader: false, expectedType: 'Fragment (43c38103)' }
[AudioRecorder:Recording] Chunk captured { sequence: 2, ... }
[AudioRecorder:Recording] Chunk captured { sequence: 3, ... }
[AudioRecorder:Recording] Chunk captured { sequence: 4, ... }
[AudioRecorder:Stop] Stopping recording { state: 'recording' }
[AudioRecorder:Stop] Recording stopped (session end)
[AudioRecorder:Stop] Complete recording created { chunks: 5, size: ... }
```

**Lambda Logs期待値:**

```
[speech_end] Found N chunks in S3
[AudioProcessor] Converting N WebM chunks to WAV
[AudioProcessor] WAV conversion successful
```

**判定:**
- ✅ chunk-0のヘッダーが `1a 45 df a3` である
- ✅ 文字起こしが成功する
- ✅ エラーが発生しない

---

### TC2: 1回再起動（最重要）

**目的:** 再起動メカニズムが正しく動作することを確認

**手順:**
1. 新しいセッションを作成
2. 「Start」ボタンをクリック
3. **2秒間話す**
4. **500ms以上無音** ← ここで再起動が発生
5. **再度2秒間話す**
6. 「Stop」ボタンをクリック

**期待されるログ:**

```
# 最初のセグメント
[AudioRecorder:Init] Recording initialized
[AudioRecorder:Recording] Chunk captured { sequence: 0, isHeader: true }
[AudioRecorder:Restart-Phase3] ✅ Valid EBML header { actual: '1a 45 df a3' }
[AudioRecorder:Recording] Chunk captured { sequence: 1, isHeader: false }

# 無音検出
[AudioRecorder:Silence] Silence detected { duration: 500+, threshold: 500, willTriggerSpeechEnd: true }

# 再起動シーケンス（3フェーズ）
[AudioRecorder:Restart-Phase1] Stopping old recorder { state: 'recording', bufferedSequence: 2 }
[AudioRecorder:Restart-Phase1] Old recorder stopped { handlersDisabled: { ondataavailable: true, onstop: true } }
[AudioRecorder:Restart-Phase2] State reset { sequenceNumber: 0, speechEndSent: true }
[AudioRecorder:Restart-Phase3] New recorder created { mimeType: 'audio/webm;codecs=opus' }
[AudioRecorder:Restart-Phase3] New recorder started { state: 'recording' }

# 2番目のセグメント
[AudioRecorder:Recording] Chunk captured { sequence: 0, isHeader: true } ← 再びsequence 0から
[AudioRecorder:Restart-Phase3] ✅ Valid EBML header { actual: '1a 45 df a3' } ← 重要！
[AudioRecorder:Recording] Chunk captured { sequence: 1, isHeader: false }

# 停止
[AudioRecorder:Stop] Stopping recording
[AudioRecorder:Stop] Recording stopped (session end)
```

**Lambda Logs期待値:**

```
# 最初のセグメント
[speech_end] Found 2 chunks in S3
[speech_end] Downloaded sessions/.../chunk-000000.webm: ... bytes
[speech_end] Downloaded sessions/.../chunk-000001.webm: ... bytes
[AudioProcessor] Converting 2 WebM chunks to WAV
[AudioProcessor] First chunk has EBML header: 1a45dfa3 ✅
[AudioProcessor] WAV conversion successful
[STT] Transcript: "..." (最初の発話内容)

# 2番目のセグメント
[speech_end] Found 2 chunks in S3
[speech_end] Downloaded sessions/.../chunk-000000.webm: ... bytes ← 再び chunk-000000
[AudioProcessor] First chunk has EBML header: 1a45dfa3 ✅ ← 重要！
[AudioProcessor] WAV conversion successful
[STT] Transcript: "..." (2番目の発話内容)
```

**判定:**
- ✅ 3フェーズログが全て出力される
- ✅ 両方のセグメントでchunk-000000がEBMLヘッダー (`1a 45 df a3`)
- ✅ Lambda logsで "First chunk has EBML header: 1a45dfa3" が2回表示される
- ✅ 両方のセグメントで文字起こし成功
- ✅ "Cannot close a closed AudioContext" エラーが発生しない
- ✅ "Invalid EBML header" エラーが発生しない

---

### TC3: 連続再起動（3セグメント）

**目的:** 複数回の再起動が正しく動作することを確認

**手順:**
1. 新しいセッションを作成
2. 「Start」ボタンをクリック
3. **話す（2秒）→ 無音（500ms）→ 話す（2秒）→ 無音（500ms）→ 話す（2秒）**
4. 「Stop」ボタンをクリック

**期待されるログ:**

```
# 1番目のセグメント
[AudioRecorder:Recording] Chunk captured { sequence: 0, isHeader: true }
[AudioRecorder:Restart-Phase3] ✅ Valid EBML header

# 再起動1回目
[AudioRecorder:Silence] Silence detected
[AudioRecorder:Restart-Phase1] Stopping old recorder
[AudioRecorder:Restart-Phase2] State reset { sequenceNumber: 0 }
[AudioRecorder:Restart-Phase3] New recorder started

# 2番目のセグメント
[AudioRecorder:Recording] Chunk captured { sequence: 0, isHeader: true }
[AudioRecorder:Restart-Phase3] ✅ Valid EBML header

# 再起動2回目
[AudioRecorder:Silence] Silence detected
[AudioRecorder:Restart-Phase1] Stopping old recorder
[AudioRecorder:Restart-Phase2] State reset { sequenceNumber: 0 }
[AudioRecorder:Restart-Phase3] New recorder started

# 3番目のセグメント
[AudioRecorder:Recording] Chunk captured { sequence: 0, isHeader: true }
[AudioRecorder:Restart-Phase3] ✅ Valid EBML header

[AudioRecorder:Stop] Recording stopped
```

**判定:**
- ✅ 3回とも "✅ Valid EBML header" が表示される
- ✅ 3回ともLambda logsで文字起こし成功
- ✅ エラーが発生しない

---

### TC4: タイミングエッジケース

**目的:** チャンク送信中に無音検出が発生した場合の動作を確認

**手順:**
1. 新しいセッションを作成
2. 「Start」ボタンをクリック
3. **1.5秒話す**（timeslice 1000msの途中）
4. **すぐに無音（500ms）**
5. **再度話す**
6. 「Stop」ボタンをクリック

**期待されるログ:**

```
[AudioRecorder:Recording] Chunk captured { sequence: 0 }
[AudioRecorder:Silence] Silence detected { duration: 500+, ... }

# タイミングに関わらず、正しく再起動
[AudioRecorder:Restart-Phase1] Stopping old recorder
[AudioRecorder:Restart-Phase1] Old recorder stopped { handlersDisabled: { ondataavailable: true, ... } }
[AudioRecorder:Restart-Phase2] State reset { sequenceNumber: 0 }
[AudioRecorder:Restart-Phase3] New recorder started

[AudioRecorder:Recording] Chunk captured { sequence: 0, isHeader: true }
[AudioRecorder:Restart-Phase3] ✅ Valid EBML header
```

**判定:**
- ✅ 古いrecorderの最終チャンクが送信されない（handlersDisabled: true）
- ✅ 新しいrecorderのchunk-0がEBMLヘッダー
- ✅ Lambda logsで "First chunk has EBML header: 1a45dfa3"

---

### TC5: 音声レベルメーター継続性

**目的:** 再起動後もAudioContextが正しく動作することを確認

**手順:**
1. 新しいセッションを作成
2. 「Start」ボタンをクリック
3. **話す → 無音（再起動） → 話す**
4. **画面上の音声レベルメーターを観察**

**期待される動作:**
- ✅ 再起動前: メーターが音声レベルに応じて動く
- ✅ 再起動中: メーターが一時的に0になる（無音時）
- ✅ 再起動後: メーターが再び音声レベルに応じて動く
- ✅ "Cannot close a closed AudioContext" エラーが発生しない

**期待されるログ:**

```
[AudioRecorder:Recording] Audio level { level: '0.XXX', aboveThreshold: true }
[AudioRecorder:Silence] Silence detected
[AudioRecorder:Restart-Phase1] Stopping old recorder
[AudioRecorder:Restart-Phase3] New recorder started
[AudioRecorder:Recording] Audio level { level: '0.XXX', aboveThreshold: true } ← 再起動後も継続
```

---

## エラーパターンと対処

### エラー1: Invalid EBML header

**ログ:**
```
[AudioRecorder:Restart-Phase3] ❌ Invalid EBML header { expected: '1a 45 df a3', actual: '43 c3 81 03' }
```

**原因:** 古いrecorderの最終チャンクが送信されている

**確認ポイント:**
- `[Restart-Phase1] Old recorder stopped { handlersDisabled: { ondataavailable: true } }` が表示されているか？
- false の場合、ondataavailable が無効化されていない

**対処:** `restartRecording()` の Phase 1 で `oldRecorder.ondataavailable = null` を確認

---

### エラー2: Cannot close a closed AudioContext

**ログ:**
```
Uncaught (in promise) DOMException: Failed to execute 'close' on 'AudioContext': Cannot close a closed AudioContext
```

**原因:** 古いrecorderのonstopが発火してAudioContextを閉じている

**確認ポイント:**
- `[Restart-Phase1] Old recorder stopped { handlersDisabled: { onstop: true } }` が表示されているか？
- false の場合、onstop が無効化されていない

**対処:** `restartRecording()` の Phase 1 で `oldRecorder.onstop = null` を確認

---

### エラー3: Sequence number not reset

**ログ:**
```
[AudioRecorder:Recording] Chunk captured { sequence: 5, isHeader: false }  ← 再起動後なのにsequenceが継続
```

**原因:** sequenceNumberRefのリセットタイミングが間違っている

**確認ポイント:**
- `[Restart-Phase2] State reset { sequenceNumber: 0 }` が表示されているか？
- Phase 1 の後、Phase 3 の前に実行されているか？

**対処:** `restartRecording()` の Phase 2 で `sequenceNumberRef.current = 0` を確認

---

## 成功基準（All Pass）

### ブラウザConsole

- [ ] TC1-TC5 全てで期待されるログが出力される
- [ ] "✅ Valid EBML header" が全セグメントで表示される
- [ ] エラーログが一切表示されない
- [ ] 音声レベルメーターが再起動後も動作する

### Lambda Logs

- [ ] 全セグメントで "First chunk has EBML header: 1a45dfa3"
- [ ] 全セグメントで文字起こし成功
- [ ] "ERROR: First chunk does not have EBML header" が表示されない
- [ ] "Failed to process speech" が表示されない

### 機能確認

- [ ] 文字起こしが正しく表示される
- [ ] AI応答が返ってくる（Phase 1.5 Day 4-5で実装予定）
- [ ] TTS音声が再生される（Phase 1.5 Day 6-7で実装予定）

---

## 次のステップ

全テストケースがPassした場合：
1. ✅ MediaRecorder再起動メカニズムの設計・実装完了
2. → Phase 1.5 Day 4-5: リアルタイムAI応答（Bedrock Claude Streaming API）
3. → Phase 1.5 Day 6-7: リアルタイムTTS（ElevenLabs Streaming API）

テスト失敗した場合：
1. エラーパターンと対処を参照
2. ログを徹底的に確認
3. 設計ドキュメント `/docs/07-development/MEDIARECORDER_LIFECYCLE.md` を再読
4. 修正後、全テストケースを再実行

---

**作成者:** Claude Code
**最終更新:** 2026-03-10
