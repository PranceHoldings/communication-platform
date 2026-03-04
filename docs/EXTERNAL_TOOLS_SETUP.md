# 外部ツール・サービスセットアップガイド

実装開始前に必要な外部サービスのアカウント作成、APIキー取得、初期設定の完全ガイド。

## 目次

1. [AI・会話サービス](#1-ai会話サービス)
2. [音声サービス](#2-音声サービス)
3. [画像・感情解析サービス](#3-画像感情解析サービス)
4. [アバター生成サービス](#4-アバター生成サービス)
5. [AWSサービス](#5-awsサービス)
6. [決済サービス](#6-決済サービス)
7. [ATS連携サービス](#7-ats連携サービス)
8. [開発ツール](#8-開発ツール)
9. [セットアップチェックリスト](#9-セットアップチェックリスト)

---

## 1. AI・会話サービス

### 1.1 Anthropic Claude API ⭐ 必須（Alpha版から）

**用途**: メインの会話AI

#### アカウント登録

1. **Console登録**
   - URL: https://console.anthropic.com/
   - Googleアカウントまたはメールアドレスで登録
   - 組織名の設定

2. **支払い情報登録**
   - クレジットカード情報を登録
   - 初回$5クレジット付与（トライアル）

#### APIキー取得

```bash
1. Console → Settings → API Keys
2. 「Create Key」をクリック
3. キー名を入力（例: "prance-dev", "prance-prod"）
4. APIキーをコピー（一度しか表示されない）
5. 安全な場所に保存（AWS Secrets Manager推奨）
```

**APIキー形式**: `sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

#### 料金プラン

| モデル | Input | Output | コンテキスト |
|--------|-------|--------|-------------|
| Claude Opus 4 | $15/1M tokens | $75/1M tokens | 200K tokens |
| Claude Sonnet 4 | $3/1M tokens | $15/1M tokens | 200K tokens |
| Claude Haiku 4 | $0.25/1M tokens | $1.25/1M tokens | 200K tokens |

**推奨**: Alpha版では Sonnet、品質重視の場面でOpus

#### 環境変数設定

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4
ANTHROPIC_MAX_TOKENS=2000
```

#### SDK インストール

```bash
npm install @anthropic-ai/sdk
```

#### サンプルコード

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4',
  max_tokens: 2000,
  system: 'あなたは採用担当者です。',
  messages: [
    { role: 'user', content: '自己紹介をお願いします。' }
  ],
});

console.log(message.content[0].text);
```

#### レート制限

| プラン | RPM (リクエスト/分) | TPM (トークン/分) |
|--------|-------------------|------------------|
| Free Tier | 5 | 10,000 |
| Tier 1 ($5+) | 50 | 40,000 |
| Tier 2 ($40+) | 1,000 | 80,000 |
| Tier 3 ($200+) | 2,000 | 160,000 |

**対策**: 使用量が増えたら早めにTier アップグレード申請

#### ドキュメント

- 公式ドキュメント: https://docs.anthropic.com/
- API リファレンス: https://docs.anthropic.com/en/api/
- プロンプトエンジニアリング: https://docs.anthropic.com/en/docs/prompt-engineering

#### トラブルシューティング

**問題**: `401 Unauthorized`
- APIキーが正しいか確認
- 環境変数が正しくロードされているか確認

**問題**: `429 Too Many Requests`
- レート制限超過 → リトライロジック実装
- Tier アップグレード検討

**問題**: `500 Internal Server Error`
- Anthropic側の一時的な障害
- 5分後にリトライ

---

### 1.2 OpenAI GPT-4 API（オプション、Beta版から）

**用途**: フォールバックまたはA/Bテスト用の会話AI

#### アカウント登録

1. **OpenAI Platform登録**
   - URL: https://platform.openai.com/signup
   - メールアドレスまたはGoogleアカウント
   - 電話番号認証（SMS）

2. **支払い設定**
   - Billing → Payment methods
   - クレジットカード登録
   - 初回$5クレジット（トライアル終了後は有料）

#### APIキー取得

```bash
1. Platform → API keys
2. 「Create new secret key」
3. キー名を入力（例: "prance-openai-dev"）
4. キーをコピー（再表示不可）
```

**APIキー形式**: `sk-proj-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

#### 料金プラン

| モデル | Input | Output | コンテキスト |
|--------|-------|--------|-------------|
| GPT-4 Turbo | $10/1M tokens | $30/1M tokens | 128K tokens |
| GPT-4o | $5/1M tokens | $15/1M tokens | 128K tokens |
| GPT-3.5 Turbo | $0.50/1M tokens | $1.50/1M tokens | 16K tokens |

#### 環境変数

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo
OPENAI_ORGANIZATION=org-xxxxxxxxxxxxx # オプション
```

#### SDK インストール

```bash
npm install openai
```

#### サンプルコード

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  messages: [
    { role: 'system', content: 'あなたは採用担当者です。' },
    { role: 'user', content: '自己紹介をお願いします。' }
  ],
  max_tokens: 2000,
});

console.log(completion.choices[0].message.content);
```

#### レート制限

| モデル | RPM | TPM | RPD |
|--------|-----|-----|-----|
| GPT-4 Turbo | 500 | 30,000 | 10,000 |
| GPT-4o | 5,000 | 800,000 | - |

#### ドキュメント

- 公式ドキュメント: https://platform.openai.com/docs/
- API リファレンス: https://platform.openai.com/docs/api-reference
- レート制限: https://platform.openai.com/docs/guides/rate-limits

---

### 1.3 Google Gemini API（オプション、v1.x以降）

**用途**: マルチモーダル対応、フォールバック

#### アカウント登録

1. **Google AI Studio登録**
   - URL: https://makersuite.google.com/
   - Googleアカウントでサインイン
   - 利用規約に同意

2. **Google Cloud Project作成**（本番環境用）
   - URL: https://console.cloud.google.com/
   - プロジェクト作成
   - Vertex AI API有効化

#### APIキー取得

**開発用（AI Studio）**:
```bash
1. AI Studio → Get API key
2. 「Create API key」
3. キーをコピー
```

**本番用（Google Cloud）**:
```bash
1. GCP Console → APIs & Services → Credentials
2. 「Create Credentials」→ API key
3. キーの制限設定（IPアドレス、リファラー等）
```

**APIキー形式**: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

#### 料金プラン

| モデル | Input | Output | コンテキスト |
|--------|-------|--------|-------------|
| Gemini 1.5 Pro | $1.25/1M tokens | $5/1M tokens | 2M tokens |
| Gemini 1.5 Flash | $0.075/1M tokens | $0.30/1M tokens | 1M tokens |

#### 環境変数

```bash
GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
GOOGLE_MODEL=gemini-1.5-pro
```

#### SDK インストール

```bash
npm install @google/generative-ai
```

#### サンプルコード

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const result = await model.generateContent([
  { text: 'あなたは採用担当者です。' },
  { text: '自己紹介をお願いします。' }
]);

console.log(result.response.text());
```

#### ドキュメント

- 公式ドキュメント: https://ai.google.dev/docs
- API リファレンス: https://ai.google.dev/api/rest

---

## 2. 音声サービス

### 2.1 ElevenLabs API ⭐ 必須（Alpha版から）

**用途**: TTS（音声合成）、音声クローニング

#### アカウント登録

1. **ElevenLabs登録**
   - URL: https://elevenlabs.io/
   - 「Sign Up」からアカウント作成
   - メール認証

2. **プラン選択**
   - Free: 10,000 characters/月
   - Starter ($5/月): 30,000 characters/月
   - Creator ($22/月): 100,000 characters/月、音声クローニング10個
   - Pro ($99/月): 500,000 characters/月、音声クローニング無制限

**推奨**: Alpha版はStarter、Beta版以降はCreatorまたはPro

#### APIキー取得

```bash
1. Profile → API Keys
2. 「Generate」をクリック
3. APIキーをコピー
```

**APIキー形式**: `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`（32文字の英数字）

#### 環境変数

```bash
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM # Rachel (デフォルト)
```

#### SDKインストール

```bash
npm install elevenlabs
```

#### 音声ID一覧取得

```bash
curl -X GET 'https://api.elevenlabs.io/v1/voices' \
  -H 'xi-api-key: YOUR_API_KEY'
```

**プリセット音声例**:
- Rachel (英語・女性): `21m00Tcm4TlvDq8ikWAM`
- Antoni (英語・男性): `ErXwobaYiN019PkySvjV`
- Matilda (英語・女性): `XrExE9yKIg1WjnnlVkGX`

**日本語音声**: 別途カスタム音声作成が必要

#### サンプルコード（TTS）

```typescript
import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const audio = await client.textToSpeech.convert({
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  text: 'Hello, welcome to the interview.',
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
});

// audioはReadableStream
const chunks = [];
for await (const chunk of audio) {
  chunks.push(chunk);
}
const audioBuffer = Buffer.concat(chunks);
```

#### サンプルコード（音声クローニング）

```typescript
const voice = await client.voices.add({
  name: 'Custom Voice 1',
  files: [audioFile], // File object
  description: 'User custom voice',
});

console.log('Voice ID:', voice.voice_id);
```

#### レート制限

- 無制限（プランの文字数上限内であれば）
- 同時リクエスト: 最大2（Freeプラン）、最大5（有料プラン）

#### 料金

| プラン | 月額 | 文字数 | 音声クローニング |
|--------|------|--------|----------------|
| Free | $0 | 10,000 | 1 |
| Starter | $5 | 30,000 | 3 |
| Creator | $22 | 100,000 | 10 |
| Pro | $99 | 500,000 | 無制限 |

**コスト試算**（30分セッション = 約3,000文字）:
- 100セッション/月 = 300,000文字 → Pro プラン必要

#### ドキュメント

- 公式ドキュメント: https://elevenlabs.io/docs/
- API リファレンス: https://elevenlabs.io/docs/api-reference/
- 音声一覧: https://elevenlabs.io/voice-library

#### トラブルシューティング

**問題**: 音声が途切れる
- 文章を短く分割してリクエスト
- ストリーミングAPIを使用

**問題**: 日本語発音が不自然
- `eleven_multilingual_v2` モデルを使用
- または日本語専用の音声をクローニング

---

### 2.2 Azure Speech Services ⭐ 必須（Alpha版から）

**用途**: STT（音声認識）、音声解析

#### アカウント登録

1. **Azureアカウント作成**
   - URL: https://azure.microsoft.com/free/
   - メールアドレスまたはMicrosoftアカウント
   - クレジットカード登録（初回$200クレジット付与）

2. **Cognitive Services作成**
   ```bash
   1. Azure Portal → 「リソースの作成」
   2. 「Cognitive Services」を検索
   3. 「Speech Services」を選択
   4. リソースグループ作成（例: prance-rg）
   5. リージョン選択（推奨: Japan East または East US）
   6. 価格レベル: Free (F0) または Standard (S0)
   7. 「作成」をクリック
   ```

#### APIキー取得

```bash
1. Speech Servicesリソース → 「キーとエンドポイント」
2. キー1またはキー2をコピー
3. リージョンをメモ（例: japaneast）
```

**キー形式**: `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`（32文字の16進数）

#### 環境変数

```bash
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SPEECH_REGION=japaneast
AZURE_SPEECH_ENDPOINT=https://japaneast.api.cognitive.microsoft.com/
```

#### SDK インストール

```bash
npm install microsoft-cognitiveservices-speech-sdk
```

#### サンプルコード（STT）

```typescript
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const speechConfig = sdk.SpeechConfig.fromSubscription(
  process.env.AZURE_SPEECH_KEY,
  process.env.AZURE_SPEECH_REGION
);
speechConfig.speechRecognitionLanguage = 'ja-JP';

const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

recognizer.recognizing = (s, e) => {
  console.log(`RECOGNIZING: ${e.result.text}`);
};

recognizer.recognized = (s, e) => {
  if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
    console.log(`RECOGNIZED: ${e.result.text}`);
  }
};

recognizer.startContinuousRecognitionAsync();
```

#### 料金プラン

| 機能 | Free (F0) | Standard (S0) |
|------|-----------|---------------|
| STT | 5時間/月 | $1/時間 |
| TTS | 0.5M文字/月 | $16/1M文字 |
| 音声翻訳 | 5時間/月 | $2.50/時間 |

**推奨**: 開発時はFree、本番はStandard

**コスト試算**:
- 100セッション × 30分 = 50時間 = $50/月

#### 対応言語

**STT対応（主要）**:
- 日本語 (ja-JP)
- 英語 (en-US, en-GB)
- 中国語 (zh-CN, zh-TW)
- 韓国語 (ko-KR)
- フランス語 (fr-FR)
- ドイツ語 (de-DE)
- スペイン語 (es-ES)

**全対応言語**: 100言語以上

#### ドキュメント

- 公式ドキュメント: https://learn.microsoft.com/azure/cognitive-services/speech-service/
- SDK リファレンス: https://learn.microsoft.com/javascript/api/microsoft-cognitiveservices-speech-sdk/
- クイックスタート: https://learn.microsoft.com/azure/cognitive-services/speech-service/get-started-speech-to-text

#### トラブルシューティング

**問題**: 認識精度が低い
- 言語設定を確認（ja-JP等）
- マイク品質を確認
- 静かな環境で録音

**問題**: `401 Unauthorized`
- APIキーとリージョンが一致しているか確認

---

## 3. 画像・感情解析サービス

### 3.1 Azure Face API ⭐ 必須（v1.0から）

**用途**: 感情解析、顔検出、視線方向

#### アカウント登録

1. **Face APIリソース作成**
   ```bash
   1. Azure Portal → 「リソースの作成」
   2. 「Face」を検索・選択
   3. リソースグループ: 既存または新規
   4. リージョン: Japan East推奨
   5. 価格レベル: Free (F0)
   ```

#### APIキー取得

```bash
1. Face APIリソース → 「キーとエンドポイント」
2. キー1をコピー
3. エンドポイントURLをコピー
```

#### 環境変数

```bash
AZURE_FACE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_FACE_ENDPOINT=https://japaneast.api.cognitive.microsoft.com/
```

#### SDK インストール

```bash
npm install @azure/cognitiveservices-face
```

#### サンプルコード

```typescript
import { FaceClient } from '@azure/cognitiveservices-face';
import { ApiKeyCredentials } from '@azure/ms-rest-js';

const credentials = new ApiKeyCredentials({
  inHeader: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_FACE_KEY }
});

const client = new FaceClient(credentials, process.env.AZURE_FACE_ENDPOINT);

const detectedFaces = await client.face.detectWithStream(
  imageStream,
  {
    returnFaceAttributes: [
      'emotion',
      'headPose',
      'eyeGaze'
    ]
  }
);

console.log(detectedFaces[0].faceAttributes.emotion);
// { happiness: 0.8, sadness: 0.1, ... }
```

#### 料金

| 機能 | Free (F0) | Standard (S0) |
|------|-----------|---------------|
| 顔検出 | 20トランザクション/分、30K/月 | $1/1K画像 |
| 感情認識 | 含まれる | 含まれる |

**コスト試算**:
- 100セッション × 30分 × 1fps = 180K画像 = $180/月

#### ドキュメント

- 公式ドキュメント: https://learn.microsoft.com/azure/cognitive-services/face/
- クイックスタート: https://learn.microsoft.com/azure/cognitive-services/face/quickstarts-sdk/identity-client-library

#### 重要な制約

⚠️ **プライバシー規制**:
- EUではFace APIの新規アカウント作成が制限されている場合あり
- 顔認識機能（identification）は厳格な審査が必要
- 感情検出は比較的制限が緩い

**対策**:
- 代替: AWS Rekognition、MediaPipe（セルフホスト）
- 利用規約・プライバシーポリシーの整備

---

### 3.2 MediaPipe（オプション、セルフホスト）

**用途**: 顔ランドマーク検出（ブラウザ実行可能）

#### インストール

```bash
npm install @mediapipe/face_mesh
npm install @mediapipe/camera_utils
```

#### サンプルコード

```typescript
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  }
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults((results) => {
  if (results.multiFaceLandmarks) {
    const landmarks = results.multiFaceLandmarks[0];
    // 468個のランドマークポイント
    console.log(landmarks);
  }
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720
});

camera.start();
```

#### 料金

**無料** - ブラウザで実行、外部API不要

#### ドキュメント

- 公式ドキュメント: https://google.github.io/mediapipe/solutions/face_mesh.html

---

## 4. アバター生成サービス

### 4.1 Ready Player Me ⭐ 必須（Beta版から）

**用途**: 写真から3Dアバター生成

#### アカウント登録

1. **Developer Hub登録**
   - URL: https://readyplayer.me/developers
   - 「Sign Up」からアカウント作成
   - アプリケーション作成

2. **プラン選択**
   - Free: 1,000アバター/月
   - Indie ($99/月): 10,000アバター/月
   - Pro ($499/月): 50,000アバター/月
   - Enterprise: カスタム

**推奨**: Beta版はFree、v1.0以降はIndie

#### アプリケーションID取得

```bash
1. Developer Hub → Applications
2. アプリケーション選択
3. Application IDをコピー
```

**Application ID形式**: `XXXXXXXXXXXXXXXXXXXXXXXX`

#### 環境変数

```bash
RPM_APPLICATION_ID=xxxxxxxxxxxxxxxxxxxxxxxx
RPM_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### SDK インストール

```bash
npm install @readyplayerme/rpm-react-sdk
```

#### サンプルコード（Photo Capture）

```typescript
// Photo Capture APIは2024年時点でBeta
// 正式リリース後に詳細が変更される可能性あり

const response = await fetch('https://api.readyplayer.me/v1/avatars/photo', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RPM_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imageUrl: 'https://example.com/photo.jpg',
    gender: 'male', // 'male' | 'female' | 'auto'
    bodyType: 'fullbody', // 'fullbody' | 'halfbody'
  }),
});

const { jobId } = await response.json();

// ポーリング
let glbUrl = null;
while (!glbUrl) {
  await sleep(5000);

  const statusResponse = await fetch(
    `https://api.readyplayer.me/v1/avatars/${jobId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.RPM_API_KEY}`,
      },
    }
  );

  const status = await statusResponse.json();
  if (status.status === 'completed') {
    glbUrl = status.glbUrl;
  }
}

console.log('Avatar GLB URL:', glbUrl);
```

#### 料金

| プラン | 月額 | アバター数 | Photo Capture |
|--------|------|-----------|--------------|
| Free | $0 | 1,000 | ✓ |
| Indie | $99 | 10,000 | ✓ |
| Pro | $499 | 50,000 | ✓ |
| Enterprise | カスタム | 無制限 | ✓ |

#### ドキュメント

- 公式ドキュメント: https://docs.readyplayer.me/
- API リファレンス: https://docs.readyplayer.me/ready-player-me/api-reference
- React SDK: https://docs.readyplayer.me/ready-player-me/integration-guides/react

---

### 4.2 Remove.bg API（オプション、Beta版から）

**用途**: 背景除去（2Dアバター生成の前処理）

#### アカウント登録

1. **Remove.bg登録**
   - URL: https://www.remove.bg/users/sign_up
   - メールアドレスで登録

2. **APIキー取得**
   - Dashboard → API
   - APIキーをコピー

#### 環境変数

```bash
REMOVEBG_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXX
```

#### サンプルコード

```typescript
const FormData = require('form-data');
const fs = require('fs');

const formData = new FormData();
formData.append('image_file', fs.createReadStream('input.jpg'));
formData.append('size', 'auto');

const response = await fetch('https://api.remove.bg/v1.0/removebg', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.REMOVEBG_API_KEY,
  },
  body: formData,
});

const buffer = await response.arrayBuffer();
fs.writeFileSync('output.png', Buffer.from(buffer));
```

#### 料金

| プラン | 月額 | 画像数 | 解像度 |
|--------|------|--------|-------|
| Free | $0 | 50 | プレビュー |
| Subscription | $9 | 40 | フルHD |
| Pay-as-you-go | - | $0.20/画像 | フルHD |

#### ドキュメント

- 公式ドキュメント: https://www.remove.bg/api

---

### 4.3 Live2D Cubism SDK（必須、2Dアバター用）

**用途**: 2Dアバターのブラウザレンダリング

#### ライセンス取得

1. **Live2D公式サイト**
   - URL: https://www.live2d.com/
   - SDK Downloads

2. **ライセンス種類**
   - **無料**: 小規模商用利用可（年間売上1000万円未満）
   - **インディー**: 年間売上1000万円以上
   - **ビジネス**: 大規模商用利用

**Prance該当**: 初期は無料ライセンス、売上拡大後にビジネスライセンス

#### SDK ダウンロード

```bash
# Cubism Web SDK
https://www.live2d.com/download/cubism-sdk/download-web/

# または npm経由
npm install @framework/live2dcubismframework
```

#### サンプルコード

```typescript
import { Live2DCubismFramework } from '@framework/live2dcubismframework';

// モデルロード
const model = await Live2DCubismFramework.loadModel('model.model3.json');

// リップシンク（口パク）
model.setParameterValueById('ParamMouthOpenY', mouthOpenValue); // 0.0 - 1.0

// レンダリング
model.update();
model.draw();
```

#### ドキュメント

- 公式ドキュメント: https://docs.live2d.com/
- チュートリアル: https://docs.live2d.com/cubism-sdk-tutorials/top/

---

## 5. AWSサービス

### 5.1 AWS アカウント設定 ⭐ 必須（Phase 0から）

#### アカウント作成

1. **AWSアカウント作成**
   - URL: https://aws.amazon.com/
   - 「AWSアカウントを作成」
   - メールアドレス、クレジットカード、電話番号認証

2. **ルートユーザーMFA設定**
   ```bash
   1. IAM → ダッシュボード
   2. 「MFAデバイスの割り当て」
   3. 仮想MFAデバイス（Google Authenticator等）を設定
   ```

3. **IAMユーザー作成（管理者用）**
   ```bash
   1. IAM → ユーザー → 「ユーザーを追加」
   2. ユーザー名: prance-admin
   3. アクセスキー + パスワード両方を有効化
   4. グループ: Administratorsグループに追加
   5. MFA設定
   ```

#### AWS CLI設定

```bash
# AWS CLI v2インストール（macOS）
brew install awscli

# または（Linux）
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# プロファイル設定
aws configure --profile prance-dev
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: ap-northeast-1
# Default output format: json

# 確認
aws sts get-caller-identity --profile prance-dev
```

#### AWS CDK設定

```bash
# CDK CLI インストール
npm install -g aws-cdk

# CDKブートストラップ（初回のみ）
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1 --profile prance-dev

# 確認
cdk --version
```

#### 環境変数

```bash
AWS_PROFILE=prance-dev
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=123456789012
```

---

### 5.2 主要AWSサービス一覧

以下のサービスはAWSアカウント内で自動的に利用可能。個別のAPIキー取得は不要。

#### サービス別のセットアップ

**Amazon Cognito**
- CDKでUser Pool作成
- App Client ID/Secret取得
- カスタムドメイン設定

**Aurora Serverless v2**
- CDKでクラスター作成
- Secrets Managerで認証情報管理
- VPCエンドポイント設定

**DynamoDB**
- CDKでテーブル作成
- GSI（Global Secondary Index）設計
- バックアップ設定

**S3**
- CDKでバケット作成
- CORS設定
- Lifecycle Policy設定

**Lambda**
- CDKで関数デプロイ
- Layer設定（Prisma、Puppeteer等）
- 環境変数・Secrets Manager統合

**API Gateway**
- CDKでREST API/WebSocket API作成
- Lambda統合
- Usage Plan設定

**IoT Core**
- CDKでThingTypePolicy作成
- WebSocket エンドポイント取得
- 証明書管理

詳細は `infrastructure/` ディレクトリのCDKコードを参照。

---

## 6. 決済サービス

### 6.1 Stripe（v1.3から必須）

**用途**: クレジットカード決済、サブスクリプション管理

#### アカウント登録

1. **Stripe登録**
   - URL: https://dashboard.stripe.com/register
   - メールアドレスで登録
   - ビジネス情報入力

2. **本人確認**
   - 身分証明書アップロード
   - 銀行口座登録

#### APIキー取得

```bash
1. Developers → API keys

テストモード:
  - Publishable key: pk_test_[YOUR_TEST_PUBLISHABLE_KEY]
  - Secret key: sk_test_[YOUR_TEST_SECRET_KEY]

本番モード（本人確認完了後）:
  - Publishable key: pk_live_[YOUR_PUBLISHABLE_KEY_HERE]
  - Secret key: sk_live_[YOUR_SECRET_KEY_HERE]
```

#### 環境変数

```bash
# テスト環境
STRIPE_SECRET_KEY=sk_test_[YOUR_TEST_KEY]
STRIPE_PUBLISHABLE_KEY=pk_test_[YOUR_TEST_KEY]
STRIPE_WEBHOOK_SECRET=whsec_[YOUR_WEBHOOK_SECRET]

# 本番環境
STRIPE_SECRET_KEY=sk_live_[YOUR_LIVE_KEY]
STRIPE_PUBLISHABLE_KEY=pk_live_[YOUR_LIVE_KEY]
STRIPE_WEBHOOK_SECRET=whsec_[YOUR_WEBHOOK_SECRET]
```

#### SDK インストール

```bash
npm install stripe @stripe/stripe-js
```

#### サンプルコード

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// サブスクリプション作成
const subscription = await stripe.subscriptions.create({
  customer: 'cus_XXXXXX',
  items: [{ price: 'price_XXXXXX' }],
  trial_period_days: 14,
});

console.log(subscription.id);
```

#### 料金

- **決済手数料**: 3.6% + ¥0
- **月額料金**: 無料

#### ドキュメント

- 公式ドキュメント: https://stripe.com/docs
- API リファレンス: https://stripe.com/docs/api

---

## 7. ATS連携サービス

### 7.1 Greenhouse（v2.0から）

**用途**: 採用管理システム連携（海外）

#### アカウント・API登録

1. **Greenhouse契約**
   - 営業担当に連絡: https://www.greenhouse.io/contact
   - Enterprise プラン必要

2. **API Access申請**
   ```bash
   1. Greenhouse管理画面 → Configure → Dev Center
   2. API Credentials → Create New API Key
   3. Permissions設定（Candidates, Jobs, Scorecards等）
   ```

#### APIキー取得

**API Key形式**: Basic認証（Base64エンコード）

```bash
echo -n "API_KEY:" | base64
# 出力: QVBJXxxxxxxxxxxxxxxxOg==
```

#### 環境変数

```bash
GREENHOUSE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
GREENHOUSE_API_URL=https://harvest.greenhouse.io/v1
```

#### サンプルコード

```typescript
const response = await fetch('https://harvest.greenhouse.io/v1/candidates', {
  headers: {
    'Authorization': `Basic ${Buffer.from(process.env.GREENHOUSE_API_KEY + ':').toString('base64')}`,
  },
});

const candidates = await response.json();
```

#### ドキュメント

- API ドキュメント: https://developers.greenhouse.io/harvest.html

---

### 7.2 その他ATS

**Lever**: https://hire.lever.co/developer/documentation
**Workday**: https://community.workday.com/sites/default/files/file-hosting/productionapi/index.html

**国内ATS（HRMOS、ジョブカン、採用一括かんりくん）**:
- 各社営業担当に個別連絡
- API提供状況は要確認

---

## 8. 開発ツール

### 8.1 GitHub

**用途**: ソースコード管理、CI/CD

#### リポジトリ作成（完了済み）

✅ https://github.com/PranceHoldings/communication-platform

#### Personal Access Token取得

```bash
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Scopes: repo, workflow, admin:org
4. トークンをコピー
```

#### 環境変数

```bash
GITHUB_TOKEN=ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

### 8.2 Sentry（エラートラッキング）

**用途**: リアルタイムエラー監視

#### アカウント登録

1. **Sentry登録**
   - URL: https://sentry.io/signup/
   - GitHub連携推奨

2. **プロジェクト作成**
   - Platform: React / Node.js
   - プロジェクト名: prance-web / prance-api

#### DSN取得

```bash
1. プロジェクト → Settings → Client Keys (DSN)
2. DSNをコピー
```

**DSN形式**: `https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@oXXXXXX.ingest.sentry.io/XXXXXXX`

#### 環境変数

```bash
SENTRY_DSN=https://xxxxxxxxxxxxx@oxxxxxx.ingest.sentry.io/xxxxxxx
SENTRY_AUTH_TOKEN=xxxxxxxxxxxxx
```

#### SDK インストール

```bash
npm install @sentry/nextjs @sentry/node
```

---

## 9. セットアップチェックリスト

### Phase 0（インフラ基盤） - 必須サービス

#### AWS関連
- [ ] AWSアカウント作成
- [ ] ルートユーザーMFA設定
- [ ] IAM管理者ユーザー作成
- [ ] AWS CLI設定（プロファイル: prance-dev）
- [ ] AWS CDK インストール・ブートストラップ
- [ ] Secrets Manager準備

#### 開発環境
- [ ] Node.js 20.x インストール
- [ ] Docker Desktop インストール
- [ ] VS Code + Dev Container拡張機能
- [ ] GitHubリポジトリクローン
- [ ] `.env.local` ファイル作成

---

### Alpha版開発 - 必須サービス

#### AI・会話
- [ ] Anthropic Claude API
  - [ ] アカウント登録
  - [ ] APIキー取得（開発用）
  - [ ] Secrets Managerに保存
  - [ ] SDK インストール

#### 音声
- [ ] ElevenLabs
  - [ ] アカウント登録（Starter以上推奨）
  - [ ] APIキー取得
  - [ ] プリセット音声ID確認
  - [ ] Secrets Managerに保存

- [ ] Azure Speech Services
  - [ ] Azureアカウント作成
  - [ ] Speech Servicesリソース作成
  - [ ] APIキー・リージョン取得
  - [ ] Secrets Managerに保存

---

### Beta版開発 - 追加サービス

#### アバター生成
- [ ] Ready Player Me
  - [ ] Developer Hub登録
  - [ ] Application ID取得
  - [ ] APIキー取得（Photo Capture用）
  - [ ] Secrets Managerに保存

- [ ] Remove.bg（オプション）
  - [ ] アカウント登録
  - [ ] APIキー取得

- [ ] Live2D Cubism SDK
  - [ ] SDKダウンロード
  - [ ] ライセンス確認（無料範囲内か）

---

### v1.0開発 - 追加サービス

#### 感情解析
- [ ] Azure Face API
  - [ ] Face APIリソース作成
  - [ ] APIキー・エンドポイント取得
  - [ ] プライバシー規制確認
  - [ ] Secrets Managerに保存

#### エラー監視
- [ ] Sentry
  - [ ] アカウント登録
  - [ ] プロジェクト作成（web/api）
  - [ ] DSN取得
  - [ ] SDK統合

---

### v1.3開発 - 決済サービス

#### 決済
- [ ] Stripe
  - [ ] アカウント登録
  - [ ] 本人確認（時間がかかる場合あり）
  - [ ] テストモードAPIキー取得
  - [ ] Webhook エンドポイント設定
  - [ ] 本番モードAPIキー取得（リリース直前）

---

### v2.0開発 - ATS連携

#### ATS
- [ ] Greenhouse（企業契約必要）
  - [ ] 営業担当に連絡
  - [ ] Enterprise プラン契約
  - [ ] API Access申請
  - [ ] APIキー取得

- [ ] その他ATS（個別対応）

---

## 10. Secrets Manager設定例

すべてのAPIキー・認証情報はAWS Secrets Managerで管理：

```typescript
// Secrets Manager設定例（CDKコード）
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const secrets = new secretsmanager.Secret(this, 'PranceSecrets', {
  secretName: 'prance/api-keys',
  description: 'API keys and credentials for Prance Platform',
  generateSecretString: {
    secretStringTemplate: JSON.stringify({
      // AI
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',

      // 音声
      ELEVENLABS_API_KEY: '',
      AZURE_SPEECH_KEY: '',
      AZURE_SPEECH_REGION: '',

      // 画像・感情解析
      AZURE_FACE_KEY: '',
      AZURE_FACE_ENDPOINT: '',

      // アバター
      RPM_APPLICATION_ID: '',
      RPM_API_KEY: '',
      REMOVEBG_API_KEY: '',

      // 決済
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',

      // ATS
      GREENHOUSE_API_KEY: '',
    }),
    generateStringKey: 'dummy', // ダミー自動生成キー
  },
});
```

**重要**: CDKデプロイ後、AWS ConsoleでSecrets Managerの値を手動で更新すること。

---

## 11. コスト試算（開発環境）

### Alpha版（月間）

| サービス | 使用量 | 月額コスト |
|---------|-------|----------|
| Claude API | 10Mトークン | $30 |
| ElevenLabs | 30K文字 | $5 |
| Azure Speech | 10時間 | $10 |
| AWS（小規模） | - | $50 |
| **合計** | | **$95** |

### Beta版（月間、30組織想定）

| サービス | 使用量 | 月額コスト |
|---------|-------|----------|
| Claude API | 50Mトークン | $150 |
| ElevenLabs | 100K文字 | $22 |
| Azure Speech | 50時間 | $50 |
| Ready Player Me | 3,000アバター | $0（Free範囲内） |
| AWS | - | $200 |
| **合計** | | **$422** |

### v1.0（月間、200組織想定）

| サービス | 使用量 | 月額コスト |
|---------|-------|----------|
| Claude API | 300Mトークン | $900 |
| ElevenLabs | 500K文字 | $99 |
| Azure Speech | 300時間 | $300 |
| Azure Face | 180K画像 | $180 |
| Ready Player Me | 5,000アバター | $0 |
| AWS | - | $800 |
| Stripe | 手数料 | 変動 |
| **合計** | | **$2,279** |

---

## 12. よくある質問

### Q1: 開発環境と本番環境でAPIキーは分けるべきか？

**A**: はい、必ず分けてください。

- 開発: `prance-dev` プロファイル、テストモードAPIキー
- 本番: `prance-prod` プロファイル、本番モードAPIキー

Secrets Managerも環境ごとに分離：
- `prance/dev/api-keys`
- `prance/prod/api-keys`

---

### Q2: 無料枠はどこまで使えるか？

**Alpha版開発では以下を無料範囲内で実施可能**:

- Claude API: $5クレジット
- ElevenLabs: 10K文字/月（Free）
- Azure: $200クレジット（初回のみ）
- Ready Player Me: 1,000アバター/月
- AWS: 多数のサービスで12ヶ月無料枠

ただし、**Beta版以降は有料プラン必須**。

---

### Q3: APIキーが漏洩したらどうする？

**即座に以下を実施**:

1. 該当APIキーを無効化・削除
2. 新しいAPIキーを発行
3. Secrets Manager更新
4. Lambda環境変数更新（再デプロイ）
5. GitHub Secrets更新（CI/CD用）
6. 漏洩したキーの使用履歴を確認
7. 必要に応じてサービス提供元に連絡

---

### Q4: セットアップの優先順位は？

**Phase 0（最優先）**:
1. AWS（すべての基盤）
2. GitHub（ソースコード管理）

**Alpha版開発（高優先）**:
1. Claude API（会話AI）
2. ElevenLabs（TTS）
3. Azure Speech（STT）

**その他は開発進行に合わせて順次**。

---

## まとめ

✅ **Alpha版開発開始に必要な最小セットアップ**:
1. AWS アカウント + CLI/CDK設定
2. Claude API
3. ElevenLabs
4. Azure Speech Services
5. GitHub

上記5つがあれば、Alpha版のコア会話機能開発を開始可能。

その他のサービスは開発フェーズに応じて順次セットアップ。

---

**最終更新**: 2026-03-04
**次回更新**: Phase 0完了時（インフラ構築後）
