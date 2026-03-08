# 音声認識エラー診断・対策ドキュメント

**作成日:** 2026-03-08
**問題:** "No speech recognized. Reason: InitialSilenceTimeout"が頻発
**ステータス:** 🔧 徹底的な対策実装完了

---

## 📋 問題の概要

### 症状

```
No speech recognized. Reason: InitialSilenceTimeout.
This typically means the audio contains no detectable speech,
the speech is too quiet, or the audio format is incompatible.
```

### 影響

- ユーザーが音声会話を開始できない
- セッションが途中で終了する
- ユーザー体験の大幅な低下

---

## 🔍 根本原因分析

### CloudWatch Logsから判明した事実

```
[AudioProcessor] Converting audio with ffmpeg: ... -af "volume=3.0" ...
[AudioProcessor] Conversion complete: { inputSize: 513821, outputSize: 1017678 }
[AzureSTT] Audio file details: {
  path: '/tmp/audio-xxx.wav',
  size: 1017678,
  header: '5249464646870f0057415645'
}
[AzureSTT] Recognition result: {
  reason: 0,
  reasonText: 'NoMatch',
  text: '',
  duration: 51800000,
  offset: 0,
  detectedLanguage: 'N/A'
}
```

### 判明した事実

1. ✅ **WebSocketでの音声データ送信**: 正常 (513KB)
2. ✅ **ffmpeg変換**: 正常 (WebM → 1MB WAV)
3. ✅ **WAVファイル形式**: 正常 (RIFFヘッダー確認)
4. ❌ **Azure STTが音声を検出できない**: NoMatch (InitialSilenceTimeout)

### 考えられる原因

#### 原因1: 音声データに実際の音声が含まれていない（最有力）

- **マイク未接続** - デバイスが認識されていない
- **マイクミュート** - OSまたはブラウザレベルでミュート
- **マイク権限拒否** - ブラウザがマイクアクセスを拒否
- **無音を録音** - ユーザーが話していない状態で録音

#### 原因2: 音声レベルが低すぎる

- **マイク感度が低い** - デバイス設定の問題
- **環境音が小さい** - 静かな環境での録音
- **volume=3.0では不十分** - Azure STTが検出できるレベルに達していない

#### 原因3: Azure STTのタイムアウト設定が短すぎる

- **InitialSilenceTimeout**: デフォルト5秒
- **ユーザーの反応時間**: マイク許可 → 話し始めまで5秒以上かかる可能性

#### 原因4: エラーメッセージが正しく表示されない

- **ブラウザコンソールで `{}`** - ErrorMessageオブジェクトが空
- **ユーザーが問題を診断できない** - 何が原因か分からない

---

## 🛠️ 実装した対策

### 対策1: WAVファイル音声品質診断（Priority 1）

**実装箇所:** `infrastructure/lambda/websocket/default/audio-processor.ts`

**機能:**

- WAVファイルの音声サンプルを解析
- ピークレベル (Peak Level) を計算
- RMSレベル (Root Mean Square) を計算
- 音声の有無を判定 (RMS > 0.01)

**実装コード:**

```typescript
private async analyzeWavFile(wavBuffer: Buffer): Promise<{
  sampleCount: number;
  durationSeconds: number;
  peakLevel: number;
  rmsLevel: number;
  hasSpeech: boolean;
}> {
  const dataSize = wavBuffer.readUInt32LE(40);
  const sampleCount = dataSize / 2;
  const sampleRate = wavBuffer.readUInt32LE(24);
  const durationSeconds = sampleCount / sampleRate;

  let peakLevel = 0;
  let sumSquares = 0;

  for (let i = 44; i < wavBuffer.length; i += 2) {
    const sample = wavBuffer.readInt16LE(i);
    const normalizedSample = Math.abs(sample) / 32768.0;
    peakLevel = Math.max(peakLevel, normalizedSample);
    sumSquares += normalizedSample * normalizedSample;
  }

  const rmsLevel = Math.sqrt(sumSquares / sampleCount);
  const hasSpeech = rmsLevel > 0.01;

  return { sampleCount, durationSeconds, peakLevel, rmsLevel, hasSpeech };
}
```

**効果:**

- Azure STTに送信する前に音声の有無を確認
- RMSレベルが低すぎる場合は事前にエラーを返す
- ユーザーに具体的な問題（マイクミュート等）を通知

**ログ出力例:**

```
[AudioProcessor] Audio analysis: {
  durationSeconds: "31.68",
  sampleCount: 506880,
  peakLevel: "0.8512",
  rmsLevel: "0.0342",
  hasSpeech: true
}
```

---

### 対策2: 音声増幅強化（Priority 1）

**実装箇所:** `infrastructure/lambda/websocket/default/audio-processor.ts`

**変更内容:**

```typescript
// Before
const command = `${ffmpegPath} -i ${inputFile} -af "volume=3.0" -acodec pcm_s16le -ar 16000 -ac 1 -f wav ${outputFile}`;

// After
const command = `${ffmpegPath} -i ${inputFile} -af "volume=10.0,acompressor=threshold=0.089:ratio=9:attack=200:release=1000" -acodec pcm_s16le -ar 16000 -ac 1 -f wav ${outputFile}`;
```

**変更点:**

1. **volume=3.0 → 10.0**: 音量増幅を3倍 → 10倍に強化
2. **acompressor追加**: 動的音声圧縮を追加
   - `threshold=0.089`: 圧縮開始レベル (-21dBFS)
   - `ratio=9`: 圧縮比率 9:1
   - `attack=200`: アタック時間 200ms
   - `release=1000`: リリース時間 1000ms

**効果:**

- 小さい音声も確実に検出可能なレベルに増幅
- 音声のダイナミックレンジを圧縮して安定化
- Azure STTの認識精度向上

---

### 対策3: Azure STT初期サイレンスタイムアウト延長（Priority 1）

**実装箇所:** `infrastructure/lambda/shared/audio/stt-azure.ts`

**変更内容:**

```typescript
// 🔧 初期サイレンスタイムアウトを延長（5秒 → 15秒）
this.config.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '15000');

// 🔧 エンドサイレンスタイムアウトを延長（デフォルト → 2秒）
this.config.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, '2000');
```

**効果:**

- ユーザーがマイク権限を許可してから話し始めるまでの時間を確保
- 初期サイレンスでのタイムアウトエラーを大幅削減
- 発話終了の検出精度も向上

**根拠:**

- ユーザー心理: 「録音開始」ボタンを押してから実際に話し始めるまで3-10秒かかることが多い
- マイク権限ダイアログ: ブラウザがマイク許可ダイアログを表示する場合、数秒かかる

---

### 対策4: エラーメッセージ強化（Priority 1）

**実装箇所:** `infrastructure/lambda/websocket/default/index.ts`

**変更内容:**

```typescript
// sendToConnection関数 - エラーメッセージの完全なログ出力
if ((data as any).type === 'error') {
  console.log(`Sending error message to connection ${connectionId}:`, JSON.parse(jsonData));
}

// handleAudioProcessing関数 - 詳細なエラー情報
await sendToConnection(connectionId, {
  type: 'error',
  code: 'AUDIO_PROCESSING_ERROR',
  message: errorMessage,
  details: errorDetails, // スタックトレース追加
  timestamp: Date.now(), // タイムスタンプ追加
});
```

**効果:**

- ブラウザコンソールに完全なエラーメッセージが表示される
- ユーザーが問題を自己診断できる
- サポート時の問題特定が容易になる

---

### 対策5: 事前エラー検出（Priority 1）

**実装箇所:** `infrastructure/lambda/websocket/default/audio-processor.ts`

**ロジック:**

```typescript
if (!analysis.hasSpeech) {
  console.warn('[AudioProcessor] WARNING: Audio RMS level too low, may not contain speech');
  throw new Error(
    `Audio quality check failed: RMS level ${analysis.rmsLevel.toFixed(4)} is too low. ` +
      `This typically means the microphone is muted, not working, or the audio is too quiet. ` +
      `Please check your microphone settings and speak louder.`
  );
}
```

**効果:**

- Azure STTに送信する前に問題を検出
- Azure STT APIコストを削減（無駄なリクエストを防ぐ）
- ユーザーに具体的な対処法を提示

---

## 📊 期待される改善効果

| 指標                            | 改善前             | 改善後（予測）   | 改善率    |
| ------------------------------- | ------------------ | ---------------- | --------- |
| **InitialSilenceTimeout発生率** | 高頻度             | <5%              | -95%      |
| **音声認識成功率**              | 低                 | >90%             | +大幅改善 |
| **ユーザー体験**                | 悪い（エラー多発） | 良好（事前診断） | +++       |
| **サポート問い合わせ**          | 多い               | 大幅削減         | -70%      |

---

## 🧪 検証方法

### テストケース1: 正常な音声

```bash
# セッション開始 → マイク権限許可 → 録音 → 話す → 停止
# 期待結果: 音声認識成功
```

### テストケース2: マイクミュート

```bash
# マイクをミュート → 録音 → 話す → 停止
# 期待結果: 事前エラー検出
# エラー: "Audio quality check failed: RMS level 0.0000 is too low.
#         This typically means the microphone is muted..."
```

### テストケース3: 無音録音

```bash
# 録音 → 何も話さない → 停止
# 期待結果: 事前エラー検出
# エラー: "Audio quality check failed: RMS level 0.0012 is too low..."
```

### テストケース4: 小さい音声

```bash
# 録音 → 小さい声で話す → 停止
# 期待結果: volume=10.0 + acompressor で増幅 → 認識成功
```

### CloudWatch Logs確認

```bash
aws logs tail /aws/lambda/prance-websocket-default-dev --follow | grep -E "Audio analysis|RMS|InitialSilence"
```

**期待されるログ:**

```
[AudioProcessor] Audio analysis: {
  durationSeconds: "31.68",
  sampleCount: 506880,
  peakLevel: "0.8512",
  rmsLevel: "0.0342",
  hasSpeech: true
}
[AzureSTT] InitialSilenceTimeout set to 15000ms
[AzureSTT] Recognition result: {
  reason: 3,
  reasonText: 'RecognizedSpeech',
  text: 'こんにちは',
  ...
}
```

---

## 🚀 デプロイ手順

```bash
# 1. Lambda関数デプロイ
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# 2. デプロイ確認
aws lambda get-function --function-name prance-websocket-default-dev \
  --query 'Configuration.LastModified' --output text

# 3. ログ監視
aws logs tail /aws/lambda/prance-websocket-default-dev --follow
```

---

## 📝 今後の改善案

### 改善案1: フロントエンドマイクテスト機能（Priority 2）

- セッション開始前にマイクの動作確認
- リアルタイム音声レベルメーター表示
- 「マイクテスト」ボタンを追加

### 改善案2: Azure STT代替プロバイダ（Priority 3）

- Google Cloud Speech-to-Text
- AWS Transcribe
- Whisper API
- → 1つのプロバイダが失敗した場合のフォールバック

### 改善案3: ブラウザ側での音声前処理（Priority 3）

- Web Audio API で音声増幅
- ノイズキャンセリング
- 無音区間の自動削除

---

## 📚 参考資料

### Azure Speech Services

- [Timeouts Documentation](https://aka.ms/csspeech/timeouts)
- [Recognition Error Codes](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/how-to-recognize-speech)

### ffmpeg Audio Filters

- [volume filter](https://ffmpeg.org/ffmpeg-filters.html#volume)
- [acompressor filter](https://ffmpeg.org/ffmpeg-filters.html#acompressor)

---

**最終更新:** 2026-03-08 07:30 JST
**次回レビュー:** デプロイ後の検証完了時
