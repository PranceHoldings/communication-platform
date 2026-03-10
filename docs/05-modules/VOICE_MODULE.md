# 音声モジュール

**バージョン:** 1.1
**最終更新:** 2026-03-08
**ステータス:** 設計完了・Phase 1実装中

---

## 目次

1. [概要](#概要)
2. [音声ソースと処理フロー](#音声ソースと処理フロー)
3. [STT (音声認識)](#stt-音声認識)
4. [TTS (音声合成)](#tts-音声合成)
5. [音声クローニング](#音声クローニング)
6. [利用規約と同意フロー](#利用規約と同意フロー)
7. [データ構造](#データ構造)
8. [API仕様](#api仕様)
9. [実装ガイド](#実装ガイド)

---

## 概要

音声モジュールは、AIアバターとユーザー間のリアルタイム音声コミュニケーションを実現する中核システムです。高品質な音声認識(STT)、自然な音声合成(TTS)、ユーザー独自の音声クローニング機能を提供します。

### 主要機能

| 機能                   | 説明                                   | プロバイダ               | アクセス権限 |
| ---------------------- | -------------------------------------- | ------------------------ | ------------ |
| **STT (音声認識)**     | ユーザー音声をリアルタイムでテキスト化 | Azure Speech Services    | 全ユーザー   |
| **TTS (音声合成)**     | テキストから自然な音声を生成           | ElevenLabs API           | 全ユーザー   |
| **プリセット音声**     | 事前用意された高品質な音声ライブラリ   | ElevenLabs               | 全ユーザー   |
| **音声クローニング**   | ユーザー音声から独自のAI音声を生成     | ElevenLabs Voice Cloning | Pro以上      |
| **多言語対応**         | 40+言語のSTT/TTS                       | Azure + ElevenLabs       | 全ユーザー   |
| **ストリーミング処理** | リアルタイム音声ストリーミング         | WebSocket (AWS IoT Core) | 全ユーザー   |

### 設計方針

- **低遅延**: STT/TTSの処理時間を最小化（目標: 200ms以内）
- **高品質**: 自然で感情豊かな音声表現
- **マルチプロバイダ**: プロバイダ障害時の自動フォールバック
- **コスト最適化**: 使用量に応じたプロバイダ選択
- **プライバシー保護**: 音声データの暗号化、適切な保持期間

---

## 音声ソースと処理フロー

### 音声ソースの種類

```
[プリセット音声]         [ファイルアップロード]         [ブラウザ録音]
     │                         │                            │
     │                  WAV/MP3/M4A受信                MediaRecorder API
     │                  品質チェック                   (推奨: 30秒～2分)
     │                  (SNR / 長さ / クリッピング)          │
     └─────────────────────┴────────────────────────────────┘
                                 │
                        ElevenLabs Voice
                        Cloning API
                        → voice_id生成 & DB保存
                                 │
                        ユーザー音声ライブラリに登録
```

### 処理フロー概要

#### 1. ユーザー音声入力 (STT)

```
ユーザーがマイクで話す
        │
        ▼
MediaRecorder API (ブラウザ)
        │
        ▼
WebSocket (AWS IoT Core)
        │
        ▼
Lambda (STT Processor)
        │
        ▼
Azure Speech Services STT
        │
        ▼
リアルタイムテキスト取得
        │
        ▼
DynamoDB (セッション状態に保存)
        │
        ▼
フロントエンドにリアルタイム表示
```

#### 2. AI音声出力 (TTS)

```
AIがテキストレスポンスを生成
        │
        ▼
Lambda (TTS Processor)
        │
        ▼
ElevenLabs TTS API
        │
        ▼
音声データ + Alignment data
        │
        ▼
S3にキャッシュ保存
        │
        ▼
フロントエンドで再生 + リップシンク
```

---

## STT (音声認識)

### Azure Cognitive Services Speech-to-Text

**選定理由:**

- 業界最高水準の認識精度
- 40+言語対応（日本語・英語含む）
- リアルタイムストリーミング対応
- カスタム音声モデル作成可能

### 技術仕様

| 項目                   | 仕様                                     |
| ---------------------- | ---------------------------------------- |
| **エンジン**           | Azure Cognitive Services Speech-to-Text  |
| **モード**             | リアルタイムストリーミング認識           |
| **サンプリングレート** | 16kHz (推奨)                             |
| **音声フォーマット**   | PCM 16-bit                               |
| **対応言語**           | 40+言語 (ja-JP, en-US, etc.)             |
| **出力**               | テキスト + タイムスタンプ + 信頼度スコア |
| **遅延**               | 200-500ms (ネットワーク環境に依存)       |

### 実装例

```typescript
// フロントエンド: ブラウザでマイク録音 → WebSocket送信
class SpeechRecognitionClient {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext;
  private websocket: WebSocket;

  constructor(
    private sessionId: string,
    private wsUrl: string
  ) {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.websocket = new WebSocket(wsUrl);
  }

  async startRecording(): Promise<void> {
    // マイク権限取得
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // MediaRecorder設定
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    // 音声データをチャンク単位でWebSocketに送信
    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        this.websocket.send(event.data);
      }
    };

    // 100msごとにデータ送信
    this.mediaRecorder.start(100);
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  onTranscriptReceived(callback: (text: string) => void): void {
    this.websocket.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript') {
        callback(data.text);
      }
    };
  }
}

// 使用例
const sttClient = new SpeechRecognitionClient(sessionId, wsUrl);

sttClient.onTranscriptReceived(text => {
  console.log('認識されたテキスト:', text);
  // UIに表示
  updateTranscript(text);
});

await sttClient.startRecording();
```

```typescript
// バックエンド: Lambda (WebSocket Handler)
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export async function handleSTTWebSocket(event: any) {
  const connectionId = event.requestContext.connectionId;
  const audioData = Buffer.from(event.body, 'base64');

  // Azure Speech Config
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY!,
    process.env.AZURE_SPEECH_REGION!
  );
  speechConfig.speechRecognitionLanguage = 'ja-JP';

  // 音声ストリーム作成
  const audioStream = sdk.AudioInputStream.createPushStream();
  audioStream.write(audioData);

  const audioConfig = sdk.AudioConfig.fromStreamInput(audioStream);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  // リアルタイム認識
  recognizer.recognizing = (s, e) => {
    // 中間結果（ユーザーがまだ話している途中）
    sendToWebSocket(connectionId, {
      type: 'transcript',
      text: e.result.text,
      isFinal: false,
    });
  };

  recognizer.recognized = (s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
      // 確定結果
      sendToWebSocket(connectionId, {
        type: 'transcript',
        text: e.result.text,
        isFinal: true,
        confidence: e.result.properties.getProperty(
          sdk.PropertyId.SpeechServiceResponse_JsonResult
        ),
      });

      // DynamoDBに保存
      saveTranscript(sessionId, {
        speaker: 'user',
        text: e.result.text,
        timestamp: Date.now(),
      });
    }
  };

  recognizer.startContinuousRecognitionAsync();
}
```

### 信頼度スコア活用

```typescript
interface TranscriptResult {
  text: string;
  confidence: number; // 0.0 - 1.0
  isFinal: boolean;
}

function handleTranscript(result: TranscriptResult) {
  if (result.isFinal) {
    if (result.confidence < 0.6) {
      // 信頼度が低い場合、ユーザーに確認
      showConfirmationDialog(`「${result.text}」と認識しましたが、もう一度お話しいただけますか？`);
    } else {
      // 高信頼度の場合、そのまま使用
      processUserInput(result.text);
    }
  }
}
```

### 自動言語検出（重要仕様）

**設計原則: STTは言語エラーを起こさない**

セッション設定言語とユーザー発話言語が異なる場合でも、システムはエラーを返さず、自動的に言語を検出して処理します。

#### 背景と理由

従来の固定言語設定では、以下の問題が発生します：

```
セッション設定: 日本語
ユーザー発話: 英語
結果: InitialSilenceTimeout エラー ❌ (実用不可)
```

実際の使用シーンでは、以下のケースが頻繁に発生します：

- 日本語セッションでユーザーが英語を混ぜて話す（例: "私の名前は John です"）
- 多言語話者が自然に言語を切り替える
- 言語設定を間違えてセッションを開始

これらすべてのケースで**エラーなく正常動作する**ことが必須要件です。

#### 言語処理の役割分担

| コンポーネント     | 言語設定                 | 目的                       |
| ------------------ | ------------------------ | -------------------------- |
| **STT (音声認識)** | 自動検出（候補言語から） | ユーザーの発話を正確に認識 |
| **TTS (音声合成)** | セッション設定言語       | アバターの応答言語         |
| **AI応答**         | 検出された言語に合わせる | ユーザーの言語で応答       |

#### Azure Speech Services 自動言語検出

**技術仕様:**

| 項目         | 値                              |
| ------------ | ------------------------------- |
| **機能名**   | AutoDetectSourceLanguageConfig  |
| **候補言語** | `['ja-JP', 'en-US']` (初期実装) |
| **検出方式** | 音声の最初の数秒で自動判定      |
| **追加遅延** | ~100ms (検出オーバーヘッド)     |
| **検出精度** | 95%以上（Azure公式値）          |

**実装例:**

```typescript
// Azure Speech Services 自動言語検出
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export class AzureSpeechToText {
  constructor(private options: AzureSTTConfig) {
    this.config = sdk.SpeechConfig.fromSubscription(options.subscriptionKey, options.region);

    // 自動言語検出設定（候補言語を指定）
    if (options.autoDetectLanguages && options.autoDetectLanguages.length > 0) {
      this.autoDetectConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(
        options.autoDetectLanguages
      );
      console.log('[AzureSTT] Auto-detect enabled for languages:', options.autoDetectLanguages);
    } else {
      // フォールバック: 固定言語
      this.config.speechRecognitionLanguage = options.language || 'en-US';
      console.log('[AzureSTT] Fixed language:', this.config.speechRecognitionLanguage);
    }

    // 詳細な認識結果を有効化
    this.config.outputFormat = sdk.OutputFormat.Detailed;
  }

  async recognizeFromFile(audioFilePath: string): Promise<TranscriptResult> {
    return new Promise((resolve, reject) => {
      const audioConfig = sdk.AudioConfig.fromWavFileInput(
        require('fs').readFileSync(audioFilePath)
      );

      let recognizer: sdk.SpeechRecognizer;

      // 自動言語検出が有効な場合
      if (this.autoDetectConfig) {
        recognizer = sdk.SpeechRecognizer.FromConfig(
          this.config,
          this.autoDetectConfig,
          audioConfig
        );
      } else {
        // 固定言語の場合
        recognizer = new sdk.SpeechRecognizer(this.config, audioConfig);
      }

      recognizer.recognizeOnceAsync(
        result => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            // 検出された言語を取得
            const detectedLanguage = result.properties.getProperty(
              sdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult
            );

            console.log('[AzureSTT] Detected language:', detectedLanguage);
            console.log('[AzureSTT] Recognized text:', result.text);

            resolve({
              text: result.text,
              confidence: 0.95,
              isFinal: true,
              offset: result.offset,
              duration: result.duration,
              language: detectedLanguage, // 検出された言語
            });
          } else if (result.reason === sdk.ResultReason.NoMatch) {
            // 音声が検出されなかった（無音またはノイズのみ）
            reject(new Error('No speech recognized. Audio may contain no detectable speech.'));
          } else {
            reject(new Error(`Recognition failed: ${sdk.ResultReason[result.reason]}`));
          }
          recognizer.close();
        },
        error => {
          recognizer.close();
          reject(new Error(`Recognition error: ${error}`));
        }
      );
    });
  }
}
```

#### 候補言語の選択指針

**初期実装（Phase 1）:**

```typescript
const CANDIDATE_LANGUAGES = ['ja-JP', 'en-US'];
```

**将来拡張（Phase 2以降）:**

```typescript
// 組織設定に基づいて候補言語を動的に変更
const CANDIDATE_LANGUAGES = getOrganizationLanguages(orgId);
// 例: ['ja-JP', 'en-US', 'zh-CN', 'ko-KR']
```

**パフォーマンス最適化:**

- 候補言語は2-4言語が最適（検出精度と速度のバランス）
- 候補が多すぎると検出精度が低下する可能性あり

#### エラーハンドリング

```typescript
// 自動言語検出が失敗した場合のフォールバック
try {
  const result = await azureSTT.recognizeFromFile(audioPath);
  console.log('Detected language:', result.language);
  console.log('Transcript:', result.text);
} catch (error) {
  if (error.message.includes('No speech recognized')) {
    // 音声入力がない場合の処理
    return {
      error: 'NO_SPEECH_DETECTED',
      message: 'Please speak clearly into the microphone.',
      suggestion: 'Check your microphone settings and try again.',
    };
  } else {
    // その他のエラー
    return {
      error: 'STT_ERROR',
      message: error.message,
    };
  }
}
```

#### 多言語会話フロー

```
ユーザー: "Hello, my name is John."
         ↓ (自動検出: en-US)
STT結果: { text: "Hello, my name is John.", language: "en-US" }
         ↓
AI処理: (英語で応答を生成)
         ↓
TTS: "Nice to meet you, John. How can I help you today?"
         ↓
ユーザー: "日本語で話してください。"
         ↓ (自動検出: ja-JP)
STT結果: { text: "日本語で話してください。", language: "ja-JP" }
         ↓
AI処理: (日本語で応答を生成)
         ↓
TTS: "承知しました。日本語でお話しします。"
```

**重要:** この仕様により、ユーザーは**言語設定を気にせず自然に会話できる**ようになります。

---

## TTS (音声合成)

### ElevenLabs API

**選定理由:**

- 業界最高レベルの自然な音声品質
- 感情表現が豊か（嬉しい、驚き、真剣など）
- Alignment data提供（リップシンクに必要）
- 多言語対応（29言語）
- Voice Cloning機能

### 技術仕様

| 項目                   | 仕様                               |
| ---------------------- | ---------------------------------- |
| **エンジン**           | ElevenLabs API                     |
| **モデル**             | eleven_multilingual_v2             |
| **出力フォーマット**   | MP3 / PCM (ストリーミング)         |
| **サンプリングレート** | 44.1kHz (高品質) / 22.05kHz (標準) |
| **ビットレート**       | 128kbps (MP3)                      |
| **遅延**               | 300-800ms（テキスト長に依存）      |
| **追加データ**         | Alignment (文字単位タイムスタンプ) |

### プリセット音声ライブラリ

初期提供する音声プリセット:

| 名前  | 性別 | 年齢層 | スタイル               | 用途                   |
| ----- | ---- | ------ | ---------------------- | ---------------------- |
| Alex  | 男性 | 30代   | Professional, Friendly | ビジネス面接           |
| Sarah | 女性 | 20代   | Warm, Friendly         | 語学学習               |
| Ken   | 男性 | 40代   | Authoritative, Formal  | フォーマルトレーニング |
| Lisa  | 女性 | 30代   | Professional, Calm     | カスタマーサービス     |
| Mike  | 男性 | 20代   | Energetic, Casual      | カジュアル会話         |
| Emma  | 女性 | 40代   | Mature, Calm           | コーチング             |

### 実装例

```typescript
// TTS生成関数
interface TTSOptions {
  text: string;
  voiceId: string;
  stability?: number; // 0.0 - 1.0 (デフォルト: 0.5)
  similarityBoost?: number; // 0.0 - 1.0 (デフォルト: 0.75)
  style?: number; // 0.0 - 1.0 (感情の強さ)
  useSpeakerBoost?: boolean;
}

interface TTSResult {
  audioUrl: string; // S3 URL
  audioData: Buffer; // 音声データ
  alignment: AlignmentData; // リップシンク用
  duration: number; // 音声の長さ（秒）
}

interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: options.text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: options.style ?? 0.0,
        use_speaker_boost: options.useSpeakerBoost ?? true,
      },
    }),
  });

  const data = await response.json();

  // 音声データをBase64デコード
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');

  // S3にアップロード（キャッシュ用）
  const audioKey = `tts/${options.voiceId}/${Date.now()}.mp3`;
  await uploadToS3(audioBuffer, audioKey);

  return {
    audioUrl: `https://cdn.prance.com/${audioKey}`,
    audioData: audioBuffer,
    alignment: data.alignment,
    duration: calculateDuration(audioBuffer),
  };
}

// 使用例
const ttsResult = await generateSpeech({
  text: 'こんにちは。今日は面接にお越しいただき、ありがとうございます。',
  voiceId: 'alex_professional',
  stability: 0.6, // 安定性高め（変動少ない）
  similarityBoost: 0.8, // 音声の忠実度高め
  style: 0.3, // 少し感情を込める
});

// 音声再生 + リップシンク
await playAudioWithLipSync(ttsResult.audioUrl, ttsResult.alignment, avatar);
```

### ストリーミング TTS（低遅延）

```typescript
// ストリーミングTTS（リアルタイム再生）
async function streamSpeech(text: string, voiceId: string): Promise<void> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  const reader = response.body!.getReader();
  const audioContext = new AudioContext();
  let audioChunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    audioChunks.push(value);

    // チャンクごとに即座に再生（低遅延）
    const audioData = await audioContext.decodeAudioData(value.buffer);
    playAudioChunk(audioData);
  }
}
```

### 感情表現の制御

```typescript
// 感情に応じたTTSパラメータ調整
const emotionToTTSParams: Record<EmotionState, Partial<TTSOptions>> = {
  neutral: {
    stability: 0.5,
    style: 0.0,
  },
  happy: {
    stability: 0.4, // 少し変動を許容
    style: 0.6, // 明るい感情を強調
  },
  serious: {
    stability: 0.7, // 安定した声
    style: 0.2, // 感情を抑える
  },
  concerned: {
    stability: 0.6,
    style: 0.4, // 心配する感情
  },
};

async function speakWithEmotion(
  text: string,
  emotion: EmotionState,
  voiceId: string
): Promise<TTSResult> {
  const params = emotionToTTSParams[emotion];
  return generateSpeech({
    text,
    voiceId,
    ...params,
  });
}
```

---

## 音声クローニング

### ElevenLabs Voice Cloning

音声クローニングにより、ユーザーは自分の声またはカスタム音声でAIアバターを話させることができます。

### 音声クローニングフロー

```
ユーザーが音声をアップロードまたは録音
        │
        ▼
音声品質チェック
  ├── SNR (Signal-to-Noise Ratio) < 20dB → 再録音要求
  ├── 長さ < 30秒 → 「もっと長く話してください」
  ├── 長さ > 5分 → 「2分以内に抑えてください」
  └── クリッピング検出 → 「マイクが近すぎます」
        │
        ▼
利用規約同意フロー
  ☑ 自分の音声またはライセンスあり
  ☑ 第三者権利侵害なし
  ☑ サービス利用規約に同意
        │
        ▼
ElevenLabs Voice Cloning API
  POST /v1/voices/add
        │
        ▼
voice_id生成（30-60秒）
        │
        ▼
DBに保存 (voices テーブル)
        │
        ▼
ユーザー音声ライブラリに追加
```

### 音声品質チェック

```typescript
interface VoiceQualityCheck {
  snr: number; // Signal-to-Noise Ratio (dB)
  duration: number; // 秒
  sampleRate: number; // Hz
  clipping: boolean; // クリッピング検出
  silenceRatio: number; // 無音区間の割合
}

async function validateVoiceRecording(audioFile: File): Promise<VoiceQualityCheck> {
  // Web Audio APIで解析
  const audioContext = new AudioContext();
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;

  // SNR計算
  const snr = calculateSNR(channelData);

  // クリッピング検出（-1.0 or 1.0に達しているサンプル）
  const clipping = channelData.some(sample => Math.abs(sample) >= 0.99);

  // 無音検出
  const silenceRatio = calculateSilenceRatio(channelData);

  return {
    snr,
    duration,
    sampleRate: audioBuffer.sampleRate,
    clipping,
    silenceRatio,
  };
}

function calculateSNR(samples: Float32Array): number {
  // RMS (Root Mean Square) 計算
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);

  // ノイズフロア推定（最も静かな10%のサンプル）
  const sortedSamples = Array.from(samples)
    .map(Math.abs)
    .sort((a, b) => a - b);
  const noiseFloor =
    sortedSamples
      .slice(0, Math.floor(sortedSamples.length * 0.1))
      .reduce((sum, val) => sum + val, 0) /
    (sortedSamples.length * 0.1);

  // SNR (dB)
  const snr = 20 * Math.log10(rms / noiseFloor);
  return snr;
}

// 品質チェック結果に基づくエラーメッセージ
function getQualityErrorMessage(check: VoiceQualityCheck): string | null {
  if (check.snr < 20) {
    return '録音環境が騒がしすぎます。静かな場所で再度録音してください。';
  }
  if (check.duration < 30) {
    return '音声が短すぎます。少なくとも30秒以上話してください。';
  }
  if (check.duration > 300) {
    return '音声が長すぎます。2分以内に抑えてください。';
  }
  if (check.clipping) {
    return 'マイクが近すぎるか、音量が大きすぎます。距離を調整してください。';
  }
  if (check.silenceRatio > 0.4) {
    return '無音区間が多すぎます。連続して話してください。';
  }
  return null; // 合格
}
```

### Voice Cloning API実装

```typescript
// Lambda: 音声クローニング
async function cloneVoice(
  userId: string,
  audioFile: Buffer,
  voiceName: string
): Promise<VoiceClone> {
  // ElevenLabs Voice Cloning API
  const formData = new FormData();
  formData.append('name', voiceName);
  formData.append('files', audioFile, 'voice.mp3');
  formData.append('description', `Custom voice for user ${userId}`);

  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    },
    body: formData,
  });

  const data = await response.json();

  // DBに保存
  const voiceClone = await prisma.voice.create({
    data: {
      id: generateUUID(),
      userId,
      name: voiceName,
      voiceId: data.voice_id, // ElevenLabs voice_id
      provider: 'elevenlabs',
      type: 'cloned',
      status: 'active',
      metadata: {
        originalAudioUrl: await uploadToS3(audioFile, `voices/${userId}/original.mp3`),
        createdAt: new Date().toISOString(),
      },
    },
  });

  return voiceClone;
}
```

### 音声プレビュー機能

```typescript
// ユーザーがクローニングした音声をテスト
async function previewClonedVoice(voiceId: string, sampleText: string): Promise<string> {
  const ttsResult = await generateSpeech({
    text: sampleText,
    voiceId,
    stability: 0.5,
    similarityBoost: 0.75,
  });

  return ttsResult.audioUrl;
}

// 使用例（フロントエンド）
const sampleTexts = [
  'こんにちは。私の名前はアレックスです。',
  'Hello, my name is Alex.',
  'How can I help you today?',
];

for (const text of sampleTexts) {
  const audioUrl = await previewClonedVoice(clonedVoiceId, text);
  playAudio(audioUrl);
  await sleep(3000); // 3秒待機
}
```

---

## 利用規約と同意フロー

音声クローニングを使用する際、法的リスクを回避するため、明示的な同意フローが必須です。

### 同意画面UI

```
┌─────────────────────────────────────────────────────┐
│  音声クローニング同意確認                           │
│                                                      │
│  アップロードまたは録音する音声について:             │
│  ☑ これは私自身の音声、または使用権を有する音声です │
│  ☑ 第三者の権利を侵害していないことを確認しました   │
│  ☑ サービス利用規約に同意します                     │
│                                                      │
│  注意事項:                                          │
│  ・他人の音声を無断で使用することは法律で禁止されています │
│  ・虚偽の同意が発覚した場合、アカウント停止の対象となります │
│  ・生成された音声は当社のポリシーに従って使用されます │
│                                                      │
│  [利用規約を読む]                                   │
│                                                      │
│                    [同意して続ける]                  │
└─────────────────────────────────────────────────────┘
```

### 同意フロー実装

```typescript
interface VoiceConsent {
  userId: string;
  consentType: 'voice_cloning';
  agreedAt: Date;
  ipAddress: string;
  userAgent: string;
  termsVersion: string; // 利用規約のバージョン
}

async function recordVoiceConsent(userId: string, request: Request): Promise<VoiceConsent> {
  const consent = await prisma.consent.create({
    data: {
      userId,
      consentType: 'voice_cloning',
      agreedAt: new Date(),
      ipAddress: request.headers.get('x-forwarded-for') || request.ip,
      userAgent: request.headers.get('user-agent'),
      termsVersion: '1.0',
    },
  });

  return consent;
}

// 同意確認チェック
async function hasVoiceCloneConsent(userId: string): Promise<boolean> {
  const consent = await prisma.consent.findFirst({
    where: {
      userId,
      consentType: 'voice_cloning',
    },
  });

  return !!consent;
}

// API呼び出し前に同意確認
export async function cloneVoiceHandler(event: APIGatewayProxyEvent) {
  const userId = event.requestContext.authorizer?.userId;

  // 同意確認
  if (!(await hasVoiceCloneConsent(userId))) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Voice cloning consent required',
        message: 'Please agree to the terms of service before cloning your voice.',
      }),
    };
  }

  // 音声クローニング処理
  // ...
}
```

### 利用規約（サンプル）

```markdown
## 音声クローニング利用規約

### 1. 音声の所有権と使用権

- ユーザーは、アップロードまたは録音する音声について、完全な所有権または適切な使用権を有していることを保証します。
- 第三者の音声を無断で使用することは、著作権法および肖像権法に違反する可能性があります。

### 2. 禁止事項

以下の行為は固く禁止されています：

- 他人の音声を無断で複製・使用すること
- なりすまし、詐欺、その他の不正行為
- 違法、有害、脅迫的、嫌がらせ、または名誉毀損的な内容の生成

### 3. 音声データの取り扱い

- アップロードされた音声データは、音声クローニングモデルの生成にのみ使用されます。
- 音声データは暗号化され、安全に保管されます。
- ユーザーはいつでも音声データの削除を要求できます。

### 4. 免責事項

- 当社は、生成された音声の不正使用について一切の責任を負いません。
- ユーザーは、生成された音声の使用について全責任を負います。

### 5. アカウント停止

虚偽の同意または規約違反が発覚した場合、予告なくアカウントを停止する場合があります。
```

---

## データ構造

### Voicesテーブル

```typescript
interface Voice {
  id: string; // UUID
  userId: string; // 所有者ID
  organizationId: string;
  name: string; // 音声名（例: "Alex - Professional"）
  voiceId: string; // ElevenLabs voice_id
  provider: 'elevenlabs' | 'azure' | 'custom';
  type: 'preset' | 'cloned'; // プリセットまたはクローン
  status: 'active' | 'inactive' | 'processing';

  // メタデータ
  metadata: VoiceMetadata;

  // タイムスタンプ
  createdAt: Date;
  updatedAt: Date;
}

interface VoiceMetadata {
  language?: string; // 'ja-JP', 'en-US'
  gender?: 'male' | 'female' | 'neutral';
  ageRange?: string; // '20s', '30s', '40s', '50s+'
  style?: string; // 'professional', 'friendly', 'casual'

  // クローン音声の場合
  originalAudioUrl?: string; // 元音声ファイルのURL
  qualityScore?: number; // 0.0 - 1.0
  duration?: number; // 元音声の長さ（秒）

  // 使用統計
  usageCount?: number; // 使用回数
  lastUsedAt?: string;
}
```

### Prismaスキーマ

```prisma
model Voice {
  id             String   @id @default(uuid())
  userId         String
  organizationId String
  name           String
  voiceId        String   @unique // ElevenLabs voice_id
  provider       VoiceProvider
  type           VoiceType
  status         VoiceStatus

  metadata       Json

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
  sessions       Session[]

  @@index([userId])
  @@index([organizationId])
  @@index([voiceId])
  @@map("voices")
}

enum VoiceProvider {
  ELEVENLABS
  AZURE
  CUSTOM
}

enum VoiceType {
  PRESET
  CLONED
}

enum VoiceStatus {
  ACTIVE
  INACTIVE
  PROCESSING
}
```

---

## API仕様

### GET /api/v1/voices

音声ライブラリ一覧取得

**Query Parameters:**

```typescript
{
  type?: 'preset' | 'cloned';
  language?: string;
  page?: number;
  limit?: number;
}
```

**Response:**

```typescript
{
  voices: Voice[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
```

### POST /api/v1/voices/clone

音声クローニング開始

**Request Body:**

```typescript
{
  name: string;
  audioUrl: string; // アップロード済み音声ファイルのURL
  consentAgreed: boolean; // 利用規約同意
}
```

**Response:**

```typescript
{
  jobId: string;
  status: 'processing';
  estimatedTime: number; // 秒
}
```

### GET /api/v1/voices/clone/:jobId

クローニングジョブのステータス確認

**Response:**

```typescript
{
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  voice?: Voice; // 完了時のみ
  error?: string; // 失敗時のみ
}
```

### POST /api/v1/tts/generate

TTS音声生成

**Request Body:**

```typescript
{
  text: string;
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}
```

**Response:**

```typescript
{
  audioUrl: string;
  duration: number;
  alignment: AlignmentData;
}
```

### POST /api/v1/stt/transcribe (WebSocket)

リアルタイムSTT

**WebSocket Message (送信):**

```typescript
{
  type: 'audio_chunk';
  data: ArrayBuffer; // 音声データ
  sessionId: string;
}
```

**WebSocket Message (受信):**

```typescript
{
  type: 'transcript';
  text: string;
  isFinal: boolean;
  confidence: number;
}
```

---

## 実装ガイド

### フロントエンド: 音声録音UI

```typescript
// components/voice/VoiceRecorder.tsx
import { useState, useRef } from 'react';

export function VoiceRecorder({ onRecordingComplete }: { onRecordingComplete: (audioBlob: Blob) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      chunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      onRecordingComplete(audioBlob);
      chunksRef.current = [];
    };

    mediaRecorder.start();
    setIsRecording(true);

    // 録音時間カウント
    const startTime = Date.now();
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // 5分で自動停止
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        stopRecording();
      }
      clearInterval(interval);
    }, 300000);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    setDuration(0);
  }

  return (
    <div className="voice-recorder">
      <div className="recording-indicator">
        {isRecording && (
          <>
            <span className="recording-dot">●</span>
            <span>録音中... {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>
          </>
        )}
      </div>

      {!isRecording ? (
        <button onClick={startRecording}>🎤 録音開始</button>
      ) : (
        <button onClick={stopRecording}>⏹ 録音停止</button>
      )}

      <p className="hint">
        ヒント: 静かな環境で、30秒以上2分以内を目安に話してください。
      </p>
    </div>
  );
}
```

### バックエンド: Step Functions (音声クローニング)

```json
{
  "Comment": "Voice Cloning Workflow",
  "StartAt": "ValidateAudio",
  "States": {
    "ValidateAudio": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:voice-validate-audio",
      "Next": "CheckConsent"
    },
    "CheckConsent": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:voice-check-consent",
      "Next": "CallElevenLabs"
    },
    "CallElevenLabs": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:voice-clone-elevenlabs",
      "Next": "SaveToDatabase"
    },
    "SaveToDatabase": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:voice-save-db",
      "End": true
    }
  }
}
```

---

## まとめ

音声モジュールは、Pranceプラットフォームのリアルタイムコミュニケーションを支える重要なコンポーネントです。Azure Speech ServicesとElevenLabs APIの組み合わせにより、高精度な音声認識と自然な音声合成を実現します。

**主要な設計原則（Phase 1実装）:**

- ✅ **STT自動言語検出**: ユーザーがどの言語を話してもエラーなく認識
- ✅ **TTS言語設定**: セッション設定に基づいてアバターの応答言語を決定
- ✅ **多言語会話対応**: 言語を切り替えても自然に会話が継続
- ✅ **音声クローニング**: ユーザーは独自の音声でAIアバターをカスタマイズ可能

**Phase 1実装状況（2026-03-08）:**

- ✅ Azure STT基本統合
- 🔄 自動言語検出実装中（候補言語: ja-JP, en-US）
- ✅ ElevenLabs TTS統合
- 📋 音声クローニング（Phase 2以降）

**次のステップ:**

- [アバターモジュール](AVATAR_MODULE.md) - アバター管理とリップシンク
- [シナリオエンジン](SCENARIO_ENGINE.md) - 会話フロー制御
- [セッション録画](SESSION_RECORDING.md) - リアルタイム文字起こしと録画

---

**最終更新:** 2026-03-08
**重要な変更:** STT自動言語検出の仕様追加
**次回レビュー予定:** Phase 1 完了時
