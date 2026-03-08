# STT自動言語検出 - 実装計画書

**作成日:** 2026-03-08
**Phase:** Phase 2 - Task 2.1.3 補足
**優先度:** 高（バグ修正 + 重要機能追加）
**推定時間:** 1.5-2時間

---

## 問題の背景

### 現在の問題

**症状:**

- セッション言語: 日本語（`language: "ja"`）
- ユーザー発話: 日本語
- STT設定: 固定 `en-US`
- 結果: `InitialSilenceTimeout` エラー ❌

**根本原因:**

- AudioProcessor が環境変数 `STT_LANGUAGE` で1回だけ初期化される
- セッションごとの言語設定が反映されない
- 言語が一致しないと音声認識が失敗する

### ユーザーの要求

> セッションの設定で指定した言語と、ユーザーが話したと認識される言語が異なることでUI上もしくはシステム上でエラーが起こっていては、実際の使用に耐えない。TTSの言語をセッション設定情報で指定するのは良いが、STTが言語の差異でエラーになることは許容できない

**要件:**

- ✅ STT: 自動言語検出（ユーザーがどの言語を話してもエラーなし）
- ✅ TTS: セッション設定言語を使用（アバターの応答言語）
- ✅ AI応答: 検出された言語に合わせて応答

---

## 設計方針

### 言語処理の役割分担

| コンポーネント                  | 言語設定                    | 目的                     |
| ------------------------------- | --------------------------- | ------------------------ |
| **STT (Azure Speech Services)** | 自動検出 [`ja-JP`, `en-US`] | ユーザー発話を正確に認識 |
| **TTS (ElevenLabs)**            | セッション設定言語          | アバターの応答言語       |
| **AI (AWS Bedrock)**            | 検出された言語              | ユーザーの言語で応答     |

### Azure Speech Services AutoDetectSourceLanguage

**技術仕様:**

- API: `AutoDetectSourceLanguageConfig.fromLanguages()`
- 候補言語: `['ja-JP', 'en-US']` (Phase 1)
- 検出方式: 音声の最初の数秒で自動判定
- 追加遅延: ~100ms
- 精度: 95%以上

---

## 実装手順

### Step 1: AzureSpeechToText クラス修正（30分）

**ファイル:** `infrastructure/lambda/shared/audio/stt-azure.ts`

**変更内容:**

1. **インターフェース更新:**

```typescript
export interface AzureSTTConfig {
  subscriptionKey: string;
  region: string;
  language?: string; // Deprecated: 後方互換性のため残す
  autoDetectLanguages?: string[]; // 新規: 自動検出候補言語
}

export interface TranscriptResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  offset: number;
  duration: number;
  language?: string; // 新規: 検出された言語
}
```

2. **コンストラクタ修正:**

```typescript
constructor(private options: AzureSTTConfig) {
  this.config = sdk.SpeechConfig.fromSubscription(
    options.subscriptionKey,
    options.region
  );

  // 自動言語検出設定
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

  this.config.outputFormat = sdk.OutputFormat.Detailed;
}
```

3. **recognizeFromFile 修正:**

```typescript
async recognizeFromFile(audioFilePath: string): Promise<TranscriptResult> {
  return new Promise((resolve, reject) => {
    const audioBuffer = require('fs').readFileSync(audioFilePath);
    const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);

    let recognizer: sdk.SpeechRecognizer;

    // 自動言語検出が有効な場合
    if (this.autoDetectConfig) {
      recognizer = sdk.SpeechRecognizer.FromConfig(
        this.config,
        this.autoDetectConfig,
        audioConfig
      );
    } else {
      recognizer = new sdk.SpeechRecognizer(this.config, audioConfig);
    }

    recognizer.recognizeOnceAsync(
      (result) => {
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          // 検出された言語を取得
          const detectedLanguage = result.properties.getProperty(
            sdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult
          );

          console.log('[AzureSTT] Detected language:', detectedLanguage);

          resolve({
            text: result.text,
            confidence: 0.95,
            isFinal: true,
            offset: result.offset,
            duration: result.duration,
            language: detectedLanguage, // 検出された言語
          });
        } else if (result.reason === sdk.ResultReason.NoMatch) {
          reject(new Error('No speech recognized.'));
        } else {
          reject(new Error(`Recognition failed: ${sdk.ResultReason[result.reason]}`));
        }
        recognizer.close();
      },
      (error) => {
        recognizer.close();
        reject(new Error(`Recognition error: ${error}`));
      }
    );
  });
}
```

### Step 2: デフォルト設定追加（10分）

**ファイル:** `infrastructure/lambda/shared/config/defaults.ts`

**追加内容:**

```typescript
export const LANGUAGE_DEFAULTS = {
  STT_LANGUAGE: 'en-US', // 後方互換性（非推奨）
  STT_AUTO_DETECT_LANGUAGES: ['ja-JP', 'en-US'], // 自動検出候補言語
  TTS_LANGUAGE: 'en-US',
  SUPPORTED_LANGUAGES: ['ja', 'en'],
};
```

### Step 3: AudioProcessor 初期化修正（20分）

**ファイル:** `infrastructure/lambda/websocket/default/index.ts`

**変更内容:**

```typescript
function getAudioProcessor(): AudioProcessor {
  if (!audioProcessor) {
    if (!AZURE_SPEECH_KEY || !ELEVENLABS_API_KEY) {
      throw new Error('Audio processing API keys not configured.');
    }

    audioProcessor = new AudioProcessor({
      azureSpeechKey: AZURE_SPEECH_KEY,
      azureSpeechRegion: AZURE_SPEECH_REGION,
      elevenLabsApiKey: ELEVENLABS_API_KEY,
      elevenLabsVoiceId: ELEVENLABS_VOICE_ID,
      elevenLabsModelId: ELEVENLABS_MODEL_ID,
      bedrockRegion: BEDROCK_REGION,
      bedrockModelId: BEDROCK_MODEL_ID,
      s3Bucket: S3_BUCKET,
      // 自動言語検出を有効化
      autoDetectLanguages: LANGUAGE_DEFAULTS.STT_AUTO_DETECT_LANGUAGES,
    });
  }
  return audioProcessor;
}
```

### Step 4: AudioProcessor 型定義更新（10分）

**ファイル:** `infrastructure/lambda/websocket/default/audio-processor.ts`

**変更内容:**

```typescript
export interface AudioProcessorConfig {
  azureSpeechKey: string;
  azureSpeechRegion: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId?: string;
  bedrockRegion: string;
  bedrockModelId: string;
  s3Bucket: string;
  language?: string; // Deprecated
  autoDetectLanguages?: string[]; // 新規
}

constructor(private config: AudioProcessorConfig) {
  // Initialize STT with auto-detect
  this.stt = new AzureSpeechToText({
    subscriptionKey: config.azureSpeechKey,
    region: config.azureSpeechRegion,
    autoDetectLanguages: config.autoDetectLanguages, // 自動検出を有効化
  });

  // Initialize TTS
  this.tts = new ElevenLabsTextToSpeech({
    apiKey: config.elevenLabsApiKey,
    voiceId: config.elevenLabsVoiceId,
    modelId: config.elevenLabsModelId,
  });

  // Initialize AI
  this.ai = new BedrockAI({
    region: config.bedrockRegion,
    modelId: config.bedrockModelId,
  });

  this.s3 = new S3Client({ region: config.bedrockRegion });
  this.s3Bucket = config.s3Bucket;
}
```

### Step 5: デプロイ（5分）

```bash
cd /workspaces/prance-communication-platform/infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### Step 6: テスト（20-30分）

**テストケース:**

1. **日本語セッション + 日本語発話**
   - セッション言語: `ja`
   - 発話内容: "こんにちは、私の名前は田中です。"
   - 期待結果: ✅ 正常認識

2. **日本語セッション + 英語発話**
   - セッション言語: `ja`
   - 発話内容: "Hello, my name is Tanaka."
   - 期待結果: ✅ 正常認識（自動検出: en-US）

3. **英語セッション + 日本語発話**
   - セッション言語: `en`
   - 発話内容: "こんにちは、私の名前は田中です。"
   - 期待結果: ✅ 正常認識（自動検出: ja-JP）

4. **多言語混在**
   - セッション言語: `ja`
   - 発話内容: "私の名前は John です。Nice to meet you."
   - 期待結果: ✅ 正常認識（主要言語を自動検出）

**検証方法:**

```bash
# CloudWatch Logsで確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 2m --follow | grep -E "Detected language|Recognized text"

# 期待されるログ:
# [AzureSTT] Detected language: ja-JP
# [AzureSTT] Recognized text: こんにちは、私の名前は田中です。
```

---

## チェックリスト

### 実装前

- [x] VOICE_MODULE.md に仕様を記録
- [x] 実装計画書を作成
- [ ] ユーザーに計画を確認

### 実装中

- [ ] Step 1: AzureSpeechToText修正
- [ ] Step 2: defaults.ts更新
- [ ] Step 3: AudioProcessor初期化修正
- [ ] Step 4: AudioProcessor型定義更新
- [ ] Step 5: デプロイ

### 実装後

- [ ] Step 6: テスト実行
- [ ] CloudWatch Logsで言語検出確認
- [ ] UI上でエラーが出ないことを確認
- [ ] START_HERE.md 更新
- [ ] CODING_RULES.md に注意事項追加

---

## リスクと対策

### リスク1: 検出精度の低下

- **リスク:** 候補言語が多すぎると精度低下
- **対策:** Phase 1では2言語のみ（ja-JP, en-US）

### リスク2: 追加遅延

- **リスク:** 自動検出に~100ms追加
- **対策:** ユーザー体験上は許容範囲（元々200-500ms）

### リスク3: Azure API制限

- **リスク:** 自動検出は追加コストがかかる可能性
- **対策:** Azureドキュメントで確認（現時点では追加コストなし）

---

## 成功基準

1. ✅ 日本語セッションで英語を話してもエラーが出ない
2. ✅ CloudWatch Logsに検出された言語が記録される
3. ✅ UIにエラーメッセージが表示されない
4. ✅ 音声認識結果が正確

---

## 次のステップ（Phase 2以降）

- [ ] 組織ごとに候補言語をカスタマイズ可能にする
- [ ] 検出された言語をDynamoDBに保存
- [ ] 言語ごとの認識精度を分析
- [ ] 追加言語のサポート（中国語、韓国語等）

---

**最終更新:** 2026-03-08
**ステータス:** 計画完了・実装開始待ち
