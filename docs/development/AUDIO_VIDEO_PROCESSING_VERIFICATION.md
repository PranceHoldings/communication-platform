# Audio/Video Processing Complete Verification Plan

**作成日:** 2026-03-08
**目的:** 音声・映像処理のエラー再発を完全に防ぐための包括的検証プラン

---

## 🔴 問題の根本原因

### 今回の失敗
1. **不完全なデプロイ:** esbuildで直接バンドル → ffmpegバイナリが欠落
2. **アーキテクチャミスマッチ:** ARM64環境でx64パッケージが必要
3. **CDKビルドプロセスのスキップ:** Docker内でのビルドを回避したため設定が反映されず

### 再発防止の原則
- ✅ CDKの正規デプロイプロセスを必ず使用
- ✅ 手動でのzip作成・アップロードは緊急時のみ
- ✅ デプロイ後の動作確認を必須化

---

## 📋 Phase 1: データフロー検証

### 1.1 入力データ検証

#### フロントエンド → WebSocket
```javascript
// 検証項目
✓ MediaRecorder.mimeType: 'audio/webm;codecs=opus'
✓ Blob.type: 'audio/webm;codecs=opus'
✓ データサイズ: 200-300KB（15秒録音の場合）
✓ Base64エンコード後のサイズ: <32KB（チャンク分割）

// 検証方法
console.log('[AudioRecorder] Complete recording:', {
  chunks: 52,
  size: 248273,
  type: 'audio/webm;codecs=opus'
});
```

#### WebSocket → Lambda
```typescript
// 検証項目
✓ メッセージタイプ: 'audio_data_part'
✓ chunkId: 'audio-{timestamp}-{random}'
✓ totalParts: 8-10（音声サイズに応じて）
✓ partIndex: 0 から totalParts-1
✓ data: Base64エンコード済み（各30KB以下）

// 検証方法
CloudWatch Logs:
"Received audio data part: { chunkId, partIndex, totalParts, dataSize }"
```

### 1.2 データ変換検証

#### Lambda: Base64 → Buffer
```typescript
// 検証項目
✓ Buffer.from(base64Data, 'base64')
✓ 結合後のサイズ一致: originalSize === Buffer.concat(parts).length

// 検証方法
console.log('Reassembled complete audio:', {
  chunkId,
  totalParts,
  combinedSize: completeAudioBuffer.length
});
```

#### Lambda: WebM → WAV変換
```typescript
// 検証項目
✓ 入力フォーマット検出: WebM (0x1a45dfa3)
✓ ffmpegパス存在確認: require('@ffmpeg-installer/ffmpeg').path
✓ 変換コマンド: -af "volume=3.0" -acodec pcm_s16le -ar 16000 -ac 1
✓ 出力WAVファイルサイズ: inputSize * 2-3倍

// 検証方法
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
console.log('[AudioProcessor] Converting audio with ffmpeg:', command);
console.log('[AudioProcessor] Conversion complete:', {
  inputSize,
  outputSize: wavBuffer.length
});
```

---

## 📋 Phase 2: APIコール検証

### 2.1 Azure Speech Services (STT)

#### 認証情報確認
```bash
# 環境変数検証
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables.[AZURE_SPEECH_KEY,AZURE_SPEECH_REGION]'

# 期待値
["8yuYvV7baKB7...", "eastus"]
```

#### API呼び出し検証
```typescript
// 検証項目
✓ SpeechConfig.fromSubscription(key, region)
✓ AutoDetectSourceLanguageConfig.fromLanguages(['ja-JP', 'en-US'])
✓ AudioConfig.fromWavFileInput(tempFilePath)
✓ RecognitionResult.reason === ResultReason.RecognizedSpeech

// 検証方法
console.log('[AzureSTT] Auto-detect enabled for languages:', languages);
console.log('[AzureSTT] Recognition result:', {
  reason: ResultReason[result.reason],
  text: result.text,
  language: detectedLanguage
});
```

### 2.2 AWS Bedrock (AI)

#### 認証情報確認
```typescript
// 検証項目
✓ IAMロール: Lambda実行ロールにBedrock権限
✓ リージョン: us-east-1
✓ モデルID: us.anthropic.claude-sonnet-4-6

// 検証方法
console.log('[BedrockAI] Generating response:', {
  modelId,
  region,
  userMessage: transcript
});
```

### 2.3 ElevenLabs (TTS)

#### 認証情報確認
```bash
# 環境変数検証
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables.[ELEVENLABS_API_KEY,ELEVENLABS_VOICE_ID,ELEVENLABS_MODEL_ID]'

# 期待値
["sk_4f0e...", "EXAVITQu...", "eleven_flash_v2_5"]
```

#### API呼び出し検証
```typescript
// 検証項目
✓ Content-Type: application/json
✓ xi-api-key: ELEVENLABS_API_KEY
✓ レスポンス: audio/mpeg (MP3形式)
✓ サイズ: 50-200KB（テキスト長に応じて）

// 検証方法
console.log('[ElevenLabs] Generated speech:', {
  sizeBytes: audioBuffer.length,
  contentType: 'audio/mpeg'
});
```

---

## 📋 Phase 3: ライブラリ・ツール検証

### 3.1 ffmpeg検証

#### インストール確認
```bash
# Lambda関数内でのパス確認
aws lambda invoke \
  --function-name prance-websocket-default-dev \
  --payload '{"test": "ffmpeg"}' \
  /tmp/test.json

# 期待されるパス
/var/task/node_modules/@ffmpeg-installer/linux-x64/ffmpeg
```

#### バイナリ実行確認
```typescript
// 検証スクリプト
const { execSync } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

try {
  const version = execSync(`${ffmpegPath} -version`).toString();
  console.log('[ffmpeg] Version:', version.split('\n')[0]);
  // 期待: ffmpeg version 4.x.x
} catch (error) {
  console.error('[ffmpeg] ERROR:', error.message);
}
```

#### アーキテクチャ一致確認
```bash
# Lambda関数アーキテクチャ
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Architectures[0]'
# 期待: x86_64

# ffmpegパッケージ
# CDK bundling設定で @ffmpeg-installer/linux-x64 が含まれること
```

### 3.2 Azure Speech SDK検証

#### Node.jsバージョン互換性
```bash
# Lambda Runtime
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Runtime'
# 期待: nodejs22.x

# SDKバージョン
# package.json: "microsoft-cognitiveservices-speech-sdk": "^1.36.0"
```

#### ネイティブバイナリ確認
```typescript
// 検証項目
✓ node_modules/microsoft-cognitiveservices-speech-sdk/distrib/lib/linux_x64/
✓ libMicrosoft.CognitiveServices.Speech.core.so 存在確認
```

---

## 📋 Phase 4: ファイル処理検証

### 4.1 一時ファイル管理

#### /tmp ディレクトリ使用
```typescript
// 検証項目
✓ 書き込み権限: Lambda /tmp は 512MB まで使用可能
✓ ファイル名の重複回避: crypto.randomUUID()
✓ クリーンアップ: finally ブロックで必ず削除

// 実装パターン
const tempFile = `/tmp/audio-${crypto.randomUUID()}.wav`;
try {
  fs.writeFileSync(tempFile, wavBuffer);
  const result = await stt.recognizeFromFile(tempFile);
  return result;
} finally {
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
}
```

### 4.2 S3保存検証

#### 保存パス命名規則
```typescript
// 音声ファイル
sessions/{sessionId}/audio/input-{timestamp}.webm
sessions/{sessionId}/audio/ai-response-{timestamp}.mp3

// 動画ファイル
sessions/{sessionId}/recording.webm

// 一時チャンク
sessions/{sessionId}/chunks/temp/audio/{chunkId}/part-{index}.bin
sessions/{sessionId}/chunks/temp/video/{chunkId}/part-{index}.bin
```

#### ContentType設定
```typescript
// 検証項目
✓ audio/webm → WebM音声
✓ audio/mpeg → MP3音声
✓ video/webm → WebM動画
✓ application/octet-stream → 一時バイナリ

// 検証方法
aws s3api head-object \
  --bucket prance-recordings-dev-010438500933 \
  --key sessions/{sessionId}/audio/input-{timestamp}.webm \
  --query 'ContentType'
```

---

## 📋 Phase 5: エラーハンドリング検証

### 5.1 エラーメッセージ明確化

#### 現在の問題
```typescript
// ❌ 不明確
catch (error) {
  console.error('[handleAudioProcessing] Error:', error);
  await sendToConnection(connectionId, {
    type: 'error',
    code: 'AUDIO_PROCESSING_ERROR',
    message: 'Audio processing failed' // 原因不明
  });
}
```

#### 改善後
```typescript
// ✅ 明確
catch (error) {
  console.error('[handleAudioProcessing] Error:', error);

  let errorMessage = 'Audio processing failed';
  let errorDetails = '';

  if (error.message.includes('ffmpeg')) {
    errorMessage = 'Audio format conversion failed';
    errorDetails = 'ffmpeg not available';
  } else if (error.message.includes('InitialSilenceTimeout')) {
    errorMessage = 'No speech detected in audio';
    errorDetails = error.message;
  } else if (error.message.includes('Azure')) {
    errorMessage = 'Speech recognition failed';
    errorDetails = error.message;
  }

  await sendToConnection(connectionId, {
    type: 'error',
    code: 'AUDIO_PROCESSING_ERROR',
    message: errorMessage,
    details: errorDetails
  });
}
```

### 5.2 リトライロジック

#### STT失敗時
```typescript
// 検証項目
✓ InitialSilenceTimeout → 音声なし（リトライ不要）
✓ NetworkError → リトライ1回
✓ AuthenticationError → 即座にエラー報告

// 実装
async recognizeWithRetry(audioFile: string, maxRetries = 1): Promise<Result> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await this.recognizeFromFile(audioFile);
    } catch (error) {
      if (i === maxRetries || error.message.includes('Silence')) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

---

## 📋 Phase 6: デプロイ検証チェックリスト

### 6.1 デプロイ前確認

```bash
# 1. コードビルド確認
cd infrastructure
npm run build
# エラーがないこと

# 2. 環境変数確認
./scripts/validate-env.sh
# 全て✅であること

# 3. Dockerクリーンアップ
docker system prune -af --volumes
# ビルドキャッシュをクリア

# 4. CDKスタック確認
npm run cdk:synth
# エラーがないこと
```

### 6.2 デプロイ実行

```bash
# 必ずCDK経由でデプロイ
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# ❌ 絶対にしない
# - 直接zipアップロード
# - esbuild単独でのバンドル
# - node_modulesの手動コピー
```

### 6.3 デプロイ後確認

```bash
# 1. 関数ステータス確認
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query '[State, LastUpdateStatus, CodeSize]'
# 期待: ["Active", "Successful", 19000000]

# 2. 環境変数確認
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables' | jq keys
# 必須キーが全て存在すること

# 3. Lambda Layer確認
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Layers'
# ffmpeg layerが含まれること（将来的に）

# 4. テスト実行
# - 日本語音声テスト
# - 英語音声テスト
# - 長時間録音テスト（30秒）
```

---

## 📋 Phase 7: 統合テスト手順

### 7.1 音声処理テスト

#### テストケース1: 日本語短文
```
入力: "こんにちは、今日はいい天気ですね"
期待結果:
✓ STT検出言語: ja-JP
✓ 文字起こし: 正確な日本語テキスト
✓ AI応答: 日本語で返答
✓ TTS: 日本語音声（MP3）
✓ エラーなし
```

#### テストケース2: 英語短文
```
入力: "Hello, how are you today?"
期待結果:
✓ STT検出言語: en-US
✓ 文字起こし: 正確な英語テキスト
✓ AI応答: 英語で返答
✓ TTS: 英語音声（MP3）
✓ エラーなし
```

#### テストケース3: 長時間録音
```
入力: 30秒の日本語会話
期待結果:
✓ 音声データサイズ: 500-800KB
✓ チャンク分割: 15-20パート
✓ S3保存成功
✓ 全チャンク結合成功
✓ STT認識成功
```

### 7.2 動画処理テスト

#### テストケース1: 標準録画
```
入力: 15秒のWebM動画（1280x720）
期待結果:
✓ チャンク送信成功
✓ S3保存成功
✓ 再生可能な動画ファイル
```

### 7.3 エラーケーステスト

#### テストケース1: 無音録音
```
入力: 15秒の無音
期待結果:
✓ エラーメッセージ: "No speech detected in audio"
✓ ユーザーへの明確なフィードバック
```

#### テストケース2: ネットワークエラー
```
シミュレーション: Azure STT接続失敗
期待結果:
✓ リトライ実行
✓ エラーメッセージ: "Speech recognition failed"
✓ 詳細ログ記録
```

---

## 📋 Phase 8: 監視・ログ検証

### 8.1 CloudWatch Logs確認項目

```bash
# 必須ログ出力
✓ [AudioProcessor] Initializing with auto-detect languages
✓ [AzureSTT] Auto-detect enabled for languages
✓ [AzureSTT] Detected language: {language}
✓ [AudioProcessor] Transcription: {text}
✓ [AudioProcessor] AI Response: {text}
✓ [AudioProcessor] Pipeline complete

# エラー時の詳細ログ
✓ [AudioProcessor] Pipeline failed: {error}
✓ スタックトレース完全出力
```

### 8.2 メトリクス監視

```bash
# Lambda関数メトリクス
✓ Duration: <10秒（音声処理）
✓ Memory Used: <2GB
✓ Errors: 0
✓ Throttles: 0

# S3メトリクス
✓ PutObject成功率: 100%
✓ GetObject成功率: 100%
```

---

## 🎯 完全対処の成功基準

### 必須条件（全て満たすこと）

1. ✅ **ffmpegバイナリが正しく動作**
   - Lambda関数内で実行可能
   - アーキテクチャ一致（x86_64）
   - WebM→WAV変換成功

2. ✅ **STT自動言語検出が動作**
   - ja-JP, en-US 両方認識
   - 検出言語がログに出力される
   - InitialSilenceTimeoutエラーなし（有効な音声の場合）

3. ✅ **音声データフロー完全動作**
   - フロントエンド: チャンク分割送信
   - Lambda: チャンク受信・結合
   - S3: 保存・取得成功
   - Azure: STT認識成功
   - ElevenLabs: TTS生成成功

4. ✅ **エラーハンドリング明確化**
   - エラーメッセージが具体的
   - ユーザーに分かりやすいフィードバック
   - CloudWatchに詳細ログ

5. ✅ **デプロイプロセス標準化**
   - CDK経由でのみデプロイ
   - デプロイ後の自動確認スクリプト
   - ロールバック手順の文書化

---

## 📝 次回エラー発生時の対応手順

1. **CloudWatchログを最初に確認**
   ```bash
   aws logs tail /aws/lambda/prance-websocket-default-dev --since 10m
   ```

2. **エラーメッセージで検索**
   - "ffmpeg" → ffmpeg関連問題
   - "InitialSilenceTimeout" → 音声認識問題
   - "Azure" → STT API問題
   - "ElevenLabs" → TTS API問題

3. **このドキュメントの該当セクションを参照**

4. **修正後は必ずテストケース実行**

---

**最終更新:** 2026-03-08 02:00 JST
**次回レビュー:** デプロイ成功後、全テストケース実行時
