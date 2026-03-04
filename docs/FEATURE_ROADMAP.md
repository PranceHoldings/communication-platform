# 機能ロードマップ

各リリース段階で提供する機能の詳細仕様。ユーザーストーリー、技術要件、受け入れ基準を含む。

## 目次

- [Alpha版 - コア会話機能](#alpha版---コア会話機能)
- [Beta版 - カスタマイズ機能](#beta版---カスタマイズ機能)
- [v1.0 - 解析・レポート機能](#v10---解析レポート機能)
- [v1.x - エンタープライズ機能](#v1x---エンタープライズ機能)
- [v2.0 - グローバル展開機能](#v20---グローバル展開機能)

---

# Alpha版 - コア会話機能

**リリース目標**: 開発開始から2ヶ月後
**対象ユーザー**: 開発チーム内部
**目的**: 基本的な会話セッションが動作することを検証

## 機能一覧

### 1. 認証・アカウント管理

#### 1.1 ユーザー登録・ログイン ⭐

**ユーザーストーリー**:

```
As a ユーザー
I want メールアドレスとパスワードでアカウントを作成できる
So that プラットフォームを利用開始できる
```

**機能詳細**:

- メールアドレス + パスワードでの新規登録
- メール確認（認証コード送信）
- ログイン（JWT発行）
- パスワードリセット（メール経由）
- プロフィール編集（名前、アバター画像）

**技術要件**:

- Amazon Cognito User Pools
- JWT認証（Access Token + Refresh Token）
- トークン有効期限: Access Token 1時間、Refresh Token 30日
- パスワードポリシー: 8文字以上、大小英数字記号混在

**UI画面**:

```
┌─────────────────────────────────────┐
│  新規登録                            │
├─────────────────────────────────────┤
│  メールアドレス: [              ]  │
│  パスワード:     [              ]  │
│  パスワード確認: [              ]  │
│                                     │
│  [登録]           [ログインはこちら] │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ログイン                            │
├─────────────────────────────────────┤
│  メールアドレス: [              ]  │
│  パスワード:     [              ]  │
│  [ ] ログイン状態を保持              │
│                                     │
│  [ログイン]                         │
│  [パスワードを忘れた方]              │
│  [新規登録はこちら]                  │
└─────────────────────────────────────┘
```

**API**:

```typescript
POST / api / auth / register;
Body: {
  (email, password, name);
}
Response: {
  message: 'Verification email sent';
}

POST / api / auth / verify;
Body: {
  (email, code);
}
Response: {
  (accessToken, refreshToken, user);
}

POST / api / auth / login;
Body: {
  (email, password);
}
Response: {
  (accessToken, refreshToken, user);
}

POST / api / auth / refresh;
Body: {
  refreshToken;
}
Response: {
  accessToken;
}

POST / api / auth / forgot - password;
Body: {
  email;
}
Response: {
  message: 'Reset email sent';
}

POST / api / auth / reset - password;
Body: {
  (email, code, newPassword);
}
Response: {
  message: 'Password reset successful';
}
```

**受け入れ基準**:

- [ ] メールアドレス形式検証が動作する
- [ ] 重複メールアドレス登録を拒否する
- [ ] 認証コードが5分以内に到着する
- [ ] ログイン後にダッシュボードに遷移する
- [ ] トークン有効期限切れ時に自動リフレッシュする
- [ ] パスワードリセットが正常に動作する

**実装容易度**: ⭐ (3日)

---

#### 1.2 組織管理（基本） ⭐

**ユーザーストーリー**:

```
As a 管理者
I want 組織を作成してメンバーを招待できる
So that チームで利用できる
```

**機能詳細**:

- 組織作成（名前、ドメイン）
- ユーザー招待（メール送信）
- メンバー一覧表示
- ロール設定（管理者 / 一般ユーザー）

**技術要件**:

- Auroraテーブル: organizations, users, organization_members
- Row Level Security（組織IDによるデータ分離）

**UI画面**:

```
┌─────────────────────────────────────┐
│  組織設定                            │
├─────────────────────────────────────┤
│  組織名: [Acme Corporation     ]   │
│                                     │
│  メンバー一覧:                       │
│  ┌───────────────────────────────┐  │
│  │ john@acme.com    管理者   [編集]│  │
│  │ jane@acme.com    ユーザー [編集]│  │
│  └───────────────────────────────┘  │
│                                     │
│  [+ メンバーを招待]                  │
└─────────────────────────────────────┘
```

**API**:

```typescript
POST /api/organizations
  Body: { name }
  Response: { organization }

POST /api/organizations/:id/invitations
  Body: { email, role }
  Response: { invitation }

GET /api/organizations/:id/members
  Response: { members: [...] }

PUT /api/organizations/:id/members/:userId
  Body: { role }
  Response: { member }
```

**受け入れ基準**:

- [ ] 組織作成後に管理者として自動登録される
- [ ] 招待メールが送信される
- [ ] 招待URLから新規登録できる
- [ ] 組織外のデータにアクセスできない（RLS動作確認）

**実装容易度**: ⭐ (2日)

---

### 2. アバター

#### 2.1 プリセット3Dアバター表示 ⭐

**ユーザーストーリー**:

```
As a ユーザー
I want プリセットアバターから選択できる
So that すぐに会話を始められる
```

**機能詳細**:

- プリセット3Dアバター 3種類（ビジネス男性、ビジネス女性、カジュアル）
- Ready Player Me GLBモデル
- Three.jsでブラウザレンダリング
- 基本アニメーション（アイドル、話す）

**技術要件**:

- Three.js + React Three Fiber
- Ready Player Me GLBモデル（事前ダウンロード）
- S3保存（avatars/presets/）

**UI画面**:

```
┌─────────────────────────────────────┐
│  アバター選択                        │
├─────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐   │
│  │ 👨‍💼  │  │ 👩‍💼  │  │ 🧑‍💻  │   │
│  │ Alex  │  │ Sarah │  │ Ken   │   │
│  │[選択] │  │[選択] │  │[選択] │   │
│  └───────┘  └───────┘  └───────┘   │
│                                     │
│  プレビュー:                         │
│  ┌─────────────────────────────┐   │
│  │   [3Dアバターのレンダリング]  │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [この設定で開始]                    │
└─────────────────────────────────────┘
```

**実装**:

```typescript
// components/AvatarViewer.tsx
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

function Avatar({ modelUrl }) {
  const { scene } = useGLTF(modelUrl);
  return <primitive object={scene} />;
}

export function AvatarViewer({ avatarId }) {
  const avatarUrl = `/avatars/presets/${avatarId}.glb`;

  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Avatar modelUrl={avatarUrl} />
    </Canvas>
  );
}
```

**API**:

```typescript
GET /api/avatars/presets
  Response: {
    avatars: [
      { id: "alex", name: "Alex", type: "3d", style: "business", thumbnail: "..." },
      { id: "sarah", name: "Sarah", type: "3d", style: "business", thumbnail: "..." },
      { id: "ken", name: "Ken", type: "3d", style: "casual", thumbnail: "..." }
    ]
  }

GET /api/avatars/:id
  Response: { id, name, type, modelUrl, config }
```

**受け入れ基準**:

- [ ] 3種類のアバターがプレビュー表示される
- [ ] 3Dモデルが5秒以内にロードされる
- [ ] マウスドラッグでカメラ回転できる
- [ ] アバターのアイドルアニメーションが再生される

**実装容易度**: ⭐ (3日)

---

#### 2.2 リップシンク ⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want アバターが音声に合わせて口を動かす
So that 自然な会話体験ができる
```

**機能詳細**:

- ElevenLabs TTS Visemeデータ → ARKit Blendshapes変換
- リアルタイム口パクアニメーション
- 52種類のBlendshapes対応

**技術要件**:

- ElevenLabs `/v1/text-to-speech` API
- Viseme → Blendshapes マッピング
- Three.js morphTargets

**実装**:

```typescript
// services/lipSync.ts
const VISEME_TO_BLENDSHAPE: Record<string, string> = {
  sil: 'mouthClose', // 無音
  PP: 'mouthPucker', // p, b, m
  FF: 'mouthLowerDownRight', // f, v
  TH: 'tongueOut', // th
  DD: 'jawOpen', // d, t, n
  kk: 'jawLeft', // k, g
  CH: 'mouthSmileLeft', // ch, j
  SS: 'mouthFrownLeft', // s, z
  nn: 'mouthClose', // n, ng
  RR: 'mouthShrugUpper', // r
  aa: 'jawOpen', // a
  E: 'mouthSmileRight', // e
  I: 'mouthSmileLeft', // i
  O: 'mouthFunnel', // o
  U: 'mouthPucker', // u
};

export function applyVisemeToAvatar(avatar: THREE.SkinnedMesh, viseme: string, weight: number) {
  const blendshapeName = VISEME_TO_BLENDSHAPE[viseme];
  const morphIndex = avatar.morphTargetDictionary?.[blendshapeName];

  if (morphIndex !== undefined) {
    avatar.morphTargetInfluences![morphIndex] = weight;
  }
}
```

**受け入れ基準**:

- [ ] 音声再生と同期して口が動く
- [ ] Viseme切り替えが滑らか（補間処理）
- [ ] 無音時に口が閉じる
- [ ] 遅延 < 100ms

**実装容易度**: ⭐⭐ (5日)

---

### 3. 音声

#### 3.1 TTS（音声合成） ⭐

**ユーザーストーリー**:

```
As a システム
I want AIアバターの応答テキストを音声に変換できる
So that ユーザーと音声会話できる
```

**機能詳細**:

- ElevenLabs API統合
- プリセット音声（英語1種、日本語1種）
- ストリーミング再生
- Visemeデータ取得

**技術要件**:

- ElevenLabs API Key（Lambdaで管理）
- 音声形式: MP3 44.1kHz
- ブラウザ: Web Audio API

**実装**:

```typescript
// services/tts.ts
export async function synthesizeSpeech(
  text: string,
  voiceId: string
): Promise<{ audio: ArrayBuffer; visemes: Viseme[] }> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
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

  const audio = await response.arrayBuffer();

  // Visemeデータ取得（別APIコール）
  const visemes = await fetchVisemes(text, voiceId);

  return { audio, visemes };
}
```

**API**:

```typescript
POST /api/tts/synthesize
  Body: { text, voiceId }
  Response: { audioUrl, visemes: [...] }
```

**受け入れ基準**:

- [ ] テキスト送信後3秒以内に音声再生開始
- [ ] 日本語・英語で自然な発音
- [ ] Visemeデータが正確に取得できる
- [ ] 音声ファイルがS3に保存される

**実装容易度**: ⭐ (2日)

---

#### 3.2 STT（音声認識） ⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want マイクで話した内容がリアルタイムでテキスト化される
So that AIアバターに伝えられる
```

**機能詳細**:

- Azure Speech Services統合
- リアルタイムストリーミング認識
- 逐次字幕表示
- 日本語・英語対応

**技術要件**:

- Azure Speech SDK
- WebSocket接続
- マイク入力（MediaRecorder API）
- 音声形式: PCM 16kHz mono

**実装**:

```typescript
// hooks/useSpeechRecognition.ts
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export function useSpeechRecognition(language: 'ja-JP' | 'en-US') {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  const startListening = useCallback(async () => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );
    speechConfig.speechRecognitionLanguage = language;

    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
      setTranscript(e.result.text); // 逐次更新
    };

    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        setTranscript(e.result.text); // 確定
        onTranscriptComplete(e.result.text);
      }
    };

    recognizer.startContinuousRecognitionAsync();
    setIsListening(true);
  }, [language]);

  return { transcript, isListening, startListening, stopListening };
}
```

**UI**:

```
┌─────────────────────────────────────┐
│  セッション中                        │
├─────────────────────────────────────┤
│  [アバター映像]                      │
│                                     │
│  🎤 あなた:                         │
│  「こんにちは、よろしくお願いします」│
│  ↑ リアルタイム字幕                  │
│                                     │
│  [発話終了]                          │
└─────────────────────────────────────┘
```

**受け入れ基準**:

- [ ] マイク権限を正しく要求する
- [ ] 発話開始後1秒以内に字幕が表示される
- [ ] 認識精度 > 90%（標準的な発音）
- [ ] 無音検知で自動的に発話終了を判定

**実装容易度**: ⭐⭐ (4日)

---

### 4. シナリオ

#### 4.1 プリセットシナリオ（面接練習） ⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want 面接練習シナリオを選択して開始できる
So that 面接対策ができる
```

**機能詳細**:

- プリセットシナリオ: 「エンジニア採用面接（中級）」
- 固定システムプロンプト
- 必須トピック: 自己紹介、技術スキル、志望動機
- 制限時間: 30分

**システムプロンプト**:

```
あなたはIT企業の採用担当者です。
経験10年のHR Managerとして、技術職採用を専門としています。

【会話の目標】
以下のトピックを自然な流れでカバーしてください:
- 自己紹介・経歴
- 技術スキル確認（具体例を求める）
- チームワーク経験
- 志望動機
- キャリアビジョン

【インタラクション規則】
- 制限時間: 30分を意識すること
- 言語: 日本語で話すこと
- 一度に1つの質問のみする
- ユーザーの回答を待ってから次に進む
- 深掘り質問を積極的に行う

【最初の発言】
「本日はよろしくお願いします。まず、簡単に自己紹介をお願いできますか？」
```

**UI**:

```
┌─────────────────────────────────────┐
│  シナリオ選択                        │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ エンジニア採用面接（中級）   │   │
│  │ 制限時間: 30分              │   │
│  │ カテゴリ: 就職・採用         │   │
│  │                             │   │
│  │ トピック:                    │   │
│  │ • 自己紹介・経歴             │   │
│  │ • 技術スキル確認             │   │
│  │ • チームワーク経験           │   │
│  │ • 志望動機                   │   │
│  │ • キャリアビジョン           │   │
│  │                             │   │
│  │ [このシナリオで開始]         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**データベース**:

```sql
INSERT INTO scenarios (id, title, category, language, config_json)
VALUES (
  'scenario_interview_engineer_mid',
  'エンジニア採用面接（中級）',
  'job_interview',
  'ja',
  '{
    "maxDurationMin": 30,
    "avatarPersona": {
      "role": "採用担当者",
      "personality": "professional",
      "pressureLevel": 3
    },
    "conversationFlow": {
      "opening": "本日はよろしくお願いします。まず、簡単に自己紹介をお願いできますか？",
      "requiredTopics": [
        "自己紹介・経歴",
        "技術スキル確認",
        "チームワーク経験",
        "志望動機",
        "キャリアビジョン"
      ],
      "followUpQuestions": true
    }
  }'
);
```

**受け入れ基準**:

- [ ] シナリオ詳細が表示される
- [ ] 開始ボタンでセッションが作成される
- [ ] システムプロンプトが正しく適用される
- [ ] 冒頭発話が自動再生される

**実装容易度**: ⭐⭐ (3日)

---

### 5. セッション実行

#### 5.1 リアルタイム会話 ⭐⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want AIアバターとリアルタイムで会話できる
So that 面接練習ができる
```

**機能詳細**:

- **ユーザーカメラ映像**: getUserMedia APIでリアルタイム取得・表示
- **AIアバター映像**: Three.js/Live2Dでリアルタイムレンダリング（60fps）
- **リアルタイム文字起こし**: Azure STTストリーミング認識、話者別表示
- **WebSocket通信**: AWS IoT Core、低レイテンシ（50-200ms）
- **音声ストリーミング**: ユーザー → サーバー → Azure STT
- **Claude API統合**: 会話AI、コンテキスト保持
- **TTS音声配信**: ElevenLabs → サーバー → ユーザー、Visemeデータ含む

**UI構成（3要素統合）**:

```
┌─────────────────────────────────────────────────────────────┐
│ セッション実行中     [⚙️設定] [録画中 ●] [終了]            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  【映像表示エリア】                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐     │
│  │ AIアバター（面接官） │  │ あなた（カメラ映像）      │     │
│  │ Three.js/Live2D     │  │ getUserMedia API        │     │
│  │                     │  │                         │     │
│  │      👤             │  │      📹                 │     │
│  │  リアルタイム        │  │  リアルタイムカメラ     │     │
│  │  レンダリング 60fps  │  │  30fps (Pro)            │     │
│  │  💬 話しています     │  │  🎤 聞いています        │     │
│  │                     │  │                         │     │
│  │  1280x720 (Pro)     │  │  1280x720 (Pro)         │     │
│  └─────────────────────┘  └──────────────────────────┘     │
│                                                              │
│  【デバイス制御】                                            │
│  🎤 マイク: ON  📹 カメラ: ON  🔊 音量: 80%                │
│                                                              │
│  【リアルタイム文字起こし（会話履歴）】                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 00:12 AI:  本日はよろしくお願いします。              │  │
│  │           まず自己紹介をお願いできますか？            │  │
│  │                                                      │  │
│  │ 00:18 YOU: よろしくお願いします。私は山田太郎です。  │  │
│  │           Web開発を5年経験しています。               │  │
│  │                                                      │  │
│  │ 00:34 AI:  ありがとうございます。技術スタックは？    │  │
│  │                                                      │  │
│  │ 00:41 YOU: ReactとNode.jsを使って... (認識中💭)     │  │
│  │           ↑ 暫定テキスト（グレー、リアルタイム更新）  │  │
│  │                                                      │  │
│  │ [自動スクロール：最新の発話を常に表示]               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ⏱️ 経過: 08:34/30:00  📋 進捗: ██████░░░░ 3/5             │
└─────────────────────────────────────────────────────────────┘
```

**技術アーキテクチャ**:

```
ブラウザ                  IoT Core + Lambda            外部API
  │                            │                          │
  │── WebSocket接続 ──────────>│                          │
  │   (wss://iot-endpoint)     │                          │
  │                            │← Lambda (onConnect)      │
  │                            │  - 認証確認              │
  │                            │  - DynamoDB: 接続保存    │
  │<─ 接続確立 ────────────────│                          │
  │                            │                          │
  │── セッション開始 ──────────>│← Lambda (sessionStart)   │
  │   { type: "start",         │  - Aurora: セッション作成 │
  │     scenarioId: "..." }    │  - システムプロンプト読込 │
  │                            │                          │
  │                            │── Claude API ──────────>│
  │                            │   (冒頭発話生成)         │
  │<─ 冒頭発話テキスト ─────────│<─ AIレスポンス ──────────│
  │                            │                          │
  │                            │── ElevenLabs TTS ───────>│
  │<─ 音声 + Visemeデータ ─────│<─ 音声データ ────────────│
  │  (アバター口パク開始)       │                          │
  │                            │                          │
  │── ユーザー発話(音声) ──────>│← Lambda (audioChunk)     │
  │   ArrayBuffer chunks       │  - S3一時保存            │
  │                            │  - Azure STT呼び出し ───>│
  │<─ リアルタイム字幕 ─────────│<─ テキスト(逐次) ─────────│
  │                            │                          │
  │── 発話終了 ────────────────>│← Lambda (speechEnd)      │
  │   { type: "speech_end" }   │  - DynamoDB: 発話記録    │
  │                            │  - Claude API ──────────>│
  │                            │    (コンテキスト含む)     │
  │                            │<─ 応答テキスト ───────────│
  │                            │                          │
  │                            │── ElevenLabs TTS ───────>│
  │<─ 音声 + Visemeデータ ──────│<─ 音声データ ────────────│
```

**WebSocketメッセージ仕様**:

```typescript
// クライアント → サーバー
type ClientMessage =
  | { type: 'session_start'; scenarioId: string; avatarId: string; voiceId: string }
  | { type: 'audio_chunk'; data: ArrayBuffer }
  | { type: 'speech_end' }
  | { type: 'session_end' };

// サーバー → クライアント
type ServerMessage =
  | { type: 'session_started'; sessionId: string }
  | { type: 'transcript_partial'; text: string }
  | { type: 'transcript_final'; text: string; timestamp: number }
  | { type: 'avatar_response'; text: string }
  | { type: 'tts_audio'; data: ArrayBuffer; visemes: Viseme[] }
  | { type: 'session_complete'; duration: number };
```

**実装**:

```typescript
// hooks/useSession.ts
export function useSession() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  const startSession = useCallback(async (scenarioId, avatarId, voiceId) => {
    // WebSocket接続
    const wsUrl = await getIoTWebSocketUrl();
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'session_start',
          scenarioId,
          avatarId,
          voiceId,
        })
      );
    };

    socket.onmessage = event => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'session_started':
          setSessionId(message.sessionId);
          startRecording(message.sessionId);
          break;

        case 'transcript_partial':
          setTranscript(message.text);
          break;

        case 'avatar_response':
          displayAvatarMessage(message.text);
          break;

        case 'tts_audio':
          playAudio(message.data, message.visemes);
          break;
      }
    };

    setWs(socket);
  }, []);

  const sendAudio = useCallback(
    (audioData: ArrayBuffer) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'audio_chunk',
            data: Array.from(new Uint8Array(audioData)),
          })
        );
      }
    },
    [ws]
  );

  const endSpeech = useCallback(() => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'speech_end' }));
    }
  }, [ws]);

  return { startSession, sendAudio, endSpeech, transcript, sessionId };
}
```

**Lambda関数**:

```typescript
// lambda/websocket/sessionStart.ts
export const handler = async (event: APIGatewayWebSocketEvent) => {
  const { scenarioId, avatarId, voiceId } = JSON.parse(event.body);
  const connectionId = event.requestContext.connectionId;

  // セッション作成
  const session = await db.sessions.create({
    userId: event.requestContext.authorizer.userId,
    scenarioId,
    avatarId,
    voiceId,
    status: 'active',
    startedAt: new Date(),
  });

  // DynamoDB: WebSocket接続管理
  await dynamodb.put({
    TableName: 'websocket_connections',
    Item: {
      connectionId,
      sessionId: session.id,
      userId: event.requestContext.authorizer.userId,
      connectedAt: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 7200, // 2時間
    },
  });

  // シナリオ読み込み
  const scenario = await db.scenarios.findById(scenarioId);

  // Claude API: 冒頭発話生成
  const systemPrompt = buildSystemPrompt(scenario);
  const response = await claude.messages.create({
    model: 'claude-opus-4',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: 'セッションを開始してください' }],
  });

  const avatarText = response.content[0].text;

  // TTS: 音声合成
  const { audio, visemes } = await synthesizeSpeech(avatarText, voiceId);

  // WebSocket送信
  await sendToConnection(connectionId, {
    type: 'session_started',
    sessionId: session.id,
  });

  await sendToConnection(connectionId, {
    type: 'avatar_response',
    text: avatarText,
  });

  await sendToConnection(connectionId, {
    type: 'tts_audio',
    data: audio,
    visemes,
  });

  return { statusCode: 200 };
};
```

**受け入れ基準**:

**映像表示:**

- [ ] ユーザーカメラ映像がリアルタイムで表示される（getUserMedia API）
- [ ] AIアバター映像がリアルタイムでレンダリングされる（Three.js/Live2D、60fps）
- [ ] 両映像がサイドバイサイドで同時に表示される
- [ ] カメラON/OFF切り替えが機能する
- [ ] カメラOFF時はプレースホルダーが表示される

**リアルタイム文字起こし:**

- [ ] ユーザー発話がリアルタイムで字幕表示される（Azure STT）
- [ ] 認識中の暫定テキストが表示される（グレー、💭認識中）
- [ ] 確定テキストが会話履歴に追加される（通常色）
- [ ] AI発話が文字起こしとして表示される（青背景）
- [ ] ユーザー発話とAI発話が明確に区別される（色分け）
- [ ] タイムスタンプが各発話に付与される（00:12, 00:18等）
- [ ] 最新の発話が自動スクロールで常に表示される
- [ ] 過去の会話を手動スクロールで確認できる

**通信・会話:**

- [ ] WebSocket接続が確立する（AWS IoT Core）
- [ ] 冒頭発話が自動再生される
- [ ] AIアバターの応答が自然（会話のコンテキストを理解）
- [ ] 音声とリップシンクが同期している（Visemeデータ使用）
- [ ] WebSocket切断時に自動再接続する
- [ ] レイテンシが許容範囲内（< 500ms）

**UI制御:**

- [ ] マイク・カメラ・スピーカーの制御が機能する
- [ ] 経過時間とトピック進捗が表示される
- [ ] 録画状態インジケーターが表示される
- [ ] セッション終了ボタンが機能する

**実装容易度**: ⭐⭐⭐ (12日) ※UI統合、文字起こし表示含む

---

#### 5.2 ブラウザ録画 ⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want セッションの様子が自動的に録画される
So that 後で振り返りができる
```

**機能詳細**:

- **ユーザーカメラ映像録画**（MediaRecorder API）
  - リアルタイムでブラウザUI上に表示
  - 解像度: 640x480 (Free) / 1280x720 (Pro) / 1920x1080 (Enterprise)
  - フレームレート: 24fps (Free) / 30fps (Pro) / 60fps (Enterprise)
  - カメラON/OFF制御可能（プライバシー保護）

- **アバター映像録画**（Canvas captureStream）
  - Three.js/Live2Dレンダリング結果を60fpsでキャプチャ
  - リアルタイム口パク・表情変化を録画
  - 音声トラック含む（ElevenLabs TTS出力）

- **サイドバイサイドUI表示**
  - セッション実行中、ユーザーとアバターを並べて表示
  - リアルタイム字幕（Azure STT）
  - 録画状態インジケーター、経過時間、進捗表示

- **ファイル形式・品質**
  - WebM (VP9 + Opus)
  - ビットレート: 1.5 Mbps (Free) / 2.5 Mbps (Pro) / 5 Mbps (Enterprise)
  - 推定ファイルサイズ（30分Pro）: ユーザー 562.5 MB、アバター 562.5 MB

- **S3アップロード（署名付きURL）**
  - セッション終了時、自動アップロード
  - ライフサイクル管理: 7日 (Free) / 90日 (Pro) / 無制限 (Enterprise)

- **プライバシー設定**
  - セッション前: カメラON/OFF選択
  - セッション中: カメラ・マイク切り替え可能
  - 録画後: いつでも削除可能

**実装**:

```typescript
// hooks/useRecording.ts
export function useRecording(sessionId: string) {
  const [isRecording, setIsRecording] = useState(false);
  const userRecorderRef = useRef<MediaRecorder | null>(null);
  const avatarRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = useCallback(async () => {
    // ユーザーカメラ
    const userStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });

    userRecorderRef.current = new MediaRecorder(userStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000,
    });

    const userChunks: Blob[] = [];
    userRecorderRef.current.ondataavailable = e => {
      userChunks.push(e.data);
    };

    userRecorderRef.current.onstop = async () => {
      const blob = new Blob(userChunks, { type: 'video/webm' });
      await uploadToS3(blob, `${sessionId}/user.webm`);
    };

    userRecorderRef.current.start(1000); // 1秒ごとにチャンク

    // アバターCanvas
    const avatarCanvas = document.getElementById('avatar-canvas') as HTMLCanvasElement;
    const avatarStream = avatarCanvas.captureStream(30); // 30 FPS

    avatarRecorderRef.current = new MediaRecorder(avatarStream, {
      mimeType: 'video/webm;codecs=vp9',
    });

    const avatarChunks: Blob[] = [];
    avatarRecorderRef.current.ondataavailable = e => {
      avatarChunks.push(e.data);
    };

    avatarRecorderRef.current.onstop = async () => {
      const blob = new Blob(avatarChunks, { type: 'video/webm' });
      await uploadToS3(blob, `${sessionId}/avatar.webm`);
    };

    avatarRecorderRef.current.start(1000);
    setIsRecording(true);
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    userRecorderRef.current?.stop();
    avatarRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  return { isRecording, startRecording, stopRecording };
}

async function uploadToS3(blob: Blob, key: string) {
  // 署名付きURL取得
  const { uploadUrl } = await fetch('/api/recordings/upload-url', {
    method: 'POST',
    body: JSON.stringify({ key }),
  }).then(r => r.json());

  // S3アップロード
  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'video/webm' },
  });
}
```

**API**:

```typescript
POST /api/recordings/upload-url
  Body: { key: "session_xxx/user.webm" }
  Response: { uploadUrl: "https://s3.amazonaws.com/..." }

POST /api/recordings
  Body: { sessionId, type: "user" | "avatar", s3Key }
  Response: { recording }
```

**受け入れ基準**:

- [ ] セッション開始前にカメラON/OFFを選択できる
- [ ] セッション実行中、ユーザーとアバターがサイドバイサイドで表示される
- [ ] セッション開始と同時に録画開始（両方同時）
- [ ] ユーザーカメラとアバターの両方が録画される（WebM形式）
- [ ] セッション中、カメラ・マイクのON/OFF切り替えができる
- [ ] リアルタイム字幕が表示される（Azure STT）
- [ ] 録画中インジケーターと経過時間が表示される
- [ ] セッション終了後、自動的にS3にアップロードされる（並列、署名付きURL）
- [ ] ファイルサイズがプラン設定に従う（Pro: 30分で約560MB/ファイル）
- [ ] アップロード完了後、バックエンドに通知され処理開始される
- [ ] ユーザーが録画をいつでも削除できる

**実装容易度**: ⭐⭐ (6日) ※UIとプライバシー設定を含む

---

### 6. 録画再生

#### 6.1 基本動画プレイヤー ⭐

**ユーザーストーリー**:

```
As a ユーザー
I want セッション終了後に録画を再生できる
So that 自分のパフォーマンスを確認できる
```

**機能詳細**:

- **合成動画再生**（combined\_{session_id}.mp4）
  - サイドバイサイド表示（左: AIアバター、右: ユーザー）
  - MediaConvertで合成済み、H.264/MP4形式
  - CloudFront CDN経由で配信（署名付きURL、低レイテンシ）

- **再生コントロール**
  - 再生/一時停止、10秒スキップ（前後）
  - シークバー（クリックで任意の位置に移動）
  - 再生速度変更（0.75x / 1x / 1.5x）
  - 音量調整

- **トランスクリプト表示（基本版）**
  - 話者別表示（AI / YOU）
  - タイムスタンプ付き
  - クリックで該当箇所にジャンプ
  - 動画再生に合わせてハイライト・自動スクロール

- **ダウンロード・共有**
  - ローカルダウンロード（Pro以上）
  - 限定共有リンク生成（有効期限付き）

**UI**:

```
┌──────────────────────────────────────────────────────────────┐
│  セッション録画 - 2026/03/04 14:30            [共有] [DL]   │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐  ┌────────────────────────────┐  │
│  │     AIアバター映像      │  │      ユーザー映像          │  │
│  │                        │  │                            │  │
│  │                        │  │                            │  │
│  │   (合成済みMP4)        │  │                            │  │
│  └────────────────────────┘  └────────────────────────────┘  │
│  │████████████░░░░░░░░░░░│  12:34 / 30:00    [×0.75][×1][×1.5]│
│  [◀10s] [▶/⏸] [10s▶]   🔊─────                              │
├──────────────────────────────────────────────────────────────┤
│  トランスクリプト          感情グラフ                         │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │00:03 AI  本日はよろし│  │自信度 ──▄▄▄▄▄▂▂▄▄▄▄▄▄▄▃▃──→│  │
│  │         くお願いしま │  │緊張度 ──▃▃▂▂▂▄▄▂▂▂▂▂▂▃▃▂──→│  │
│  │         す。まず...  │  │       0分  10分  20分  30分   │  │
│  │                      │  └──────────────────────────────┘  │
│  │▶ 00:08 YOU よろしく  │  ハイライト                        │
│  │         お願いします │  ┌──────────────────────────────┐  │
│  │   ← 現在再生中        │  │ ★ 08:23 技術説明が具体的     │  │
│  │                      │  │ ▲ 15:41 視線が外れる傾向     │  │
│  │  00:15 AI まず自己紹 │  │ ★ 22:09 志望動機が明確       │  │
│  │         介をお願いで │  │                          [▶]  │  │
│  └──────────────────────┘  └──────────────────────────────┘  │
│                                                               │
│  [レポートを見る]  [削除]                                     │
└──────────────────────────────────────────────────────────────┘
```

**実装**:

```typescript
// components/SessionPlayer.tsx
export function SessionPlayer({ sessionId }: { sessionId: string }) {
  const { session, recording, transcript } = useSession(sessionId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // 動画時間更新時、トランスクリプトをハイライト
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // 該当するトランスクリプトエントリーを見つけてハイライト
      const activeEntry = transcript.find(
        e => video.currentTime >= e.timestampStart &&
             video.currentTime <= e.timestampEnd
      );
      if (activeEntry) {
        highlightTranscriptEntry(activeEntry.id);
        scrollTranscriptToEntry(activeEntry.id);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [transcript]);

  const seekToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  return (
    <div className="session-player">
      {/* 合成動画（サイドバイサイド） */}
      <div className="video-container">
        <video
          ref={videoRef}
          src={recording.combined.url}  // combined_{session_id}.mp4
          controls
          className="combined-video"
        >
          {/* WebVTT字幕トラック */}
          <track kind="subtitles" src={recording.vttUrl} label="日本語" />
        </video>
      </div>

      {/* カスタムコントロール */}
      <div className="controls">
        <button onClick={() => seekToTime(currentTime - 10)}>◀10s</button>
        <button onClick={() => videoRef.current?.play()}>▶</button>
        <button onClick={() => videoRef.current?.pause()}>⏸</button>
        <button onClick={() => seekToTime(currentTime + 10)}>10s▶</button>

        <div className="playback-rate">
          {[0.75, 1, 1.5].map(rate => (
            <button
              key={rate}
              onClick={() => {
                setPlaybackRate(rate);
                if (videoRef.current) videoRef.current.playbackRate = rate;
              }}
              className={playbackRate === rate ? 'active' : ''}
            >
              ×{rate}
            </button>
          ))}
        </div>
      </div>

      {/* トランスクリプト（クリック可能） */}
      <div className="transcript">
        {transcript.map((entry) => (
          <div
            key={entry.id}
            className={`transcript-entry ${currentTime >= entry.timestampStart && currentTime <= entry.timestampEnd ? 'active' : ''}`}
            onClick={() => seekToTime(entry.timestampStart)}
          >
            <span className="timestamp">{formatTime(entry.timestampStart)}</span>
            <span className="speaker">{entry.speaker}</span>
            <span className="text">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**API**:

```typescript
GET /api/sessions/:id
  Response: {
    id, userId, scenarioId, status,
    startedAt, endedAt, duration,
    recordingStatus: "processing" | "completed" | "failed"
  }

GET /api/sessions/:id/recordings
  Response: {
    // メイン再生用（合成済み、サイドバイサイド表示）
    combined: {
      url: "https://cdn.prance.com/combined_xxx.mp4",  // CloudFront CDN
      type: "combined",
      format: "mp4",
      duration: 1812,  // 秒
      size: 675000000  // bytes (675 MB)
    },

    // 生ファイル（オプション、ダウンロード用）
    user: {
      url: "https://cdn.prance.com/user_xxx.webm",
      type: "user",
      format: "webm"
    },
    avatar: {
      url: "https://cdn.prance.com/avatar_xxx.webm",
      type: "avatar",
      format: "webm"
    },

    // WebVTT字幕ファイル
    vttUrl: "https://cdn.prance.com/transcript_xxx.vtt",

    // サムネイル
    thumbnail: "https://cdn.prance.com/thumb_xxx.jpg"
  }

GET /api/sessions/:id/transcript
  Response: {
    entries: [
      { id, speaker: "AI", text: "...", timestampStart: 3.2, timestampEnd: 8.5 },
      { id, speaker: "USER", text: "...", timestampStart: 8.5, timestampEnd: 15.3 }
    ]
  }
```

**受け入れ基準**:

- [ ] 合成動画（combined.mp4）が正常に再生される（サイドバイサイド表示）
- [ ] ユーザーとアバターの映像が同期して再生される
- [ ] CloudFront CDN経由で低レイテンシ配信される（署名付きURL）
- [ ] トランスクリプトが話者別・タイムスタンプ付きで表示される
- [ ] トランスクリプトをクリックすると該当箇所にジャンプする
- [ ] 動画再生に合わせてトランスクリプトがハイライト・自動スクロールされる
- [ ] 再生/一時停止、10秒スキップ（前後）が機能する
- [ ] シークバーで任意の位置に移動できる
- [ ] 再生速度変更（0.75x / 1x / 1.5x）ができる
- [ ] 音量調整ができる
- [ ] ダウンロードボタンが機能する（Pro以上）
- [ ] 共有リンク生成ができる（有効期限付き）
- [ ] 削除ボタンでセッションを削除できる

**実装容易度**: ⭐ (5日) ※同期プレイヤー、カスタムコントロール含む

---

## Alpha版 技術スタック

### フロントエンド

- **フレームワーク**: Next.js 15 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **3D**: Three.js + React Three Fiber
- **状態管理**: Zustand
- **API通信**: TanStack Query

### バックエンド

- **API**: AWS API Gateway (REST/WebSocket)
- **コンピュート**: AWS Lambda (Node.js 20)
- **認証**: Amazon Cognito
- **データベース**: Aurora Serverless v2 (PostgreSQL)
- **NoSQL**: DynamoDB
- **ストレージ**: Amazon S3
- **CDN**: CloudFront

### 外部API

- **会話AI**: Claude API (Anthropic)
- **TTS**: ElevenLabs API
- **STT**: Azure Speech Services

### インフラ

- **IaC**: AWS CDK (TypeScript)
- **CI/CD**: GitHub Actions

---

## Alpha版 開発スケジュール

```
Week 1-2: インフラ基盤構築
  - AWS CDK設定
  - Cognito、Aurora、DynamoDB
  - S3、CloudFront

Week 3-4: 認証・組織管理
  - ユーザー登録・ログイン
  - 組織作成・招待

Week 5-6: アバター基本機能
  - プリセット3Dアバター表示
  - リップシンク実装

Week 7: 音声機能
  - TTS統合
  - STT統合

Week 8: シナリオ
  - プリセットシナリオ作成
  - システムプロンプト設定

Week 9-10: セッション実行（最難関）
  - WebSocket通信
  - リアルタイム会話フロー
  - Claude API統合

Week 11: 録画機能
  - MediaRecorder実装
  - S3アップロード

Week 12: 録画再生
  - 動画プレイヤー
  - トランスクリプト表示

Week 13-14: テスト・バグ修正
  - 統合テスト
  - パフォーマンス最適化
```

---

## Alpha版 リスクと対策

| リスク                | 影響度 | 発生確率 | 対策                                 |
| --------------------- | ------ | -------- | ------------------------------------ |
| WebSocket不安定       | 高     | 中       | 自動再接続、エラーハンドリング強化   |
| TTS/STT遅延           | 中     | 中       | キャッシング、プリロード             |
| Claude API コスト超過 | 高     | 低       | 使用量監視、アラート設定             |
| リップシンク精度不足  | 中     | 中       | Visemeマッピング調整、フォールバック |
| 録画ファイル巨大化    | 中     | 中       | ビットレート制限、圧縮設定最適化     |

---

# Beta版 - カスタマイズ機能

**リリース目標**: 開発開始から3.5ヶ月後
**対象ユーザー**: 10-50組織（招待制）
**目的**: MVPとしてのプロダクトマーケットフィットを検証

## 機能一覧サマリー

| #   | 機能                           | 実装容易度 | 優先度 | 期間 |
| --- | ------------------------------ | ---------- | ------ | ---- |
| 1   | アバター拡充（プリセット追加） | ⭐         | 高     | 3日  |
| 2   | アバター選択UI                 | ⭐⭐       | 高     | 5日  |
| 3   | カスタムアバター作成（3D）     | ⭐⭐⭐     | 中     | 7日  |
| 4   | カスタムアバター作成（2D）     | ⭐⭐⭐     | 中     | 7日  |
| 5   | 音声プリセット追加             | ⭐         | 高     | 2日  |
| 6   | 音声クローニング               | ⭐⭐       | 中     | 5日  |
| 7   | シナリオ拡充（5種類）          | ⭐⭐       | 高     | 5日  |
| 8   | シナリオビルダーUI             | ⭐⭐⭐     | 高     | 10日 |
| 9   | AIプロンプト管理UI             | ⭐⭐⭐     | 高     | 10日 |
| 10  | AIプロバイダ管理UI             | ⭐⭐⭐     | 中     | 10日 |

## 主要機能詳細

### 1. アバター選択UI ⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want カテゴリやスタイルでアバターをフィルタリングして選択できる
So that 自分に合ったアバターを簡単に見つけられる
```

**機能詳細**:

- プリセットアバター20種類（3D）、10種類（2D）
- カテゴリフィルタ: ビジネス、カジュアル、フレンドリー、フォーマル
- タイプフィルタ: 2D / 3D
- リアルタイムプレビュー
- サンプル音声でのテスト再生

**UI画面**:

```
┌──────────────────────────────────────────────────────────────┐
│ アバター選択                                    [マイアバター] │
├──────────────────────────────────────────────────────────────┤
│ 📂 カテゴリ: [すべて▼] [2Dアニメ] [3Dリアル]                │
│ 🎨 スタイル: [すべて▼] [ビジネス] [カジュアル] [フレンドリー]│
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ プリセットアバター                           [並び順▼] │   │
│ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │   │
│ │ │ 👩‍💼│ │ 👨‍💼│ │ 🧑‍🎓│ │ 👩‍🏫│ │ 🧑‍💻│ │ 👨‍⚕️│ ...     │   │
│ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘         │   │
│ │ Alex   Sarah  Ken    Lisa   Mike   Emma            │   │
│ │ 3D     3D     2D     3D     2D     3D              │   │
│ │ [選択] [選択] [選択] [選択] [選択] [選択]          │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ プレビュー: Alex (3D・ビジネス)                        │   │
│ │ ┌──────────────────────────────────────┐              │   │
│ │ │  [3Dアバターのリアルタイムレンダリング] │              │   │
│ │ │  マウスドラッグで回転可能               │              │   │
│ │ └──────────────────────────────────────┘              │   │
│ │ サンプル音声: [▶ 自己紹介を聞く]                       │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│                                          [この設定で開始]     │
└──────────────────────────────────────────────────────────────┘
```

**API**:

```typescript
GET /api/avatars/presets?type=3d&style=business
  Response: {
    avatars: [
      {
        id: "alex",
        name: "Alex",
        type: "3d",
        style: "business",
        gender: "male",
        thumbnailUrl: "...",
        modelUrl: "...",
        sampleAudioUrl: "..."
      },
      // ...
    ],
    total: 20
  }
```

**受け入れ基準**:

- [ ] フィルタ変更でアバター一覧が更新される
- [ ] プレビューが3秒以内にロードされる
- [ ] サンプル音声が再生できる
- [ ] 選択したアバターがセッションで使用される

**実装容易度**: ⭐⭐ (5日)

---

### 2. カスタムアバター作成（3D） ⭐⭐⭐

**ユーザーストーリー**:

```
As a Proユーザー
I want 自分の写真から3Dアバターを作成できる
So that よりパーソナライズされた体験ができる
```

**機能詳細**:

- 画像アップロード（顔写真）
- Ready Player Me Photo Capture API統合
- 自動3Dモデル生成（1-2分）
- プレビュー・確認
- 個人ライブラリに保存

**フロー**:

```
1. 画像選択
   └─ ファイルアップロード or カメラ撮影

2. 品質チェック
   └─ 顔検出（MediaPipe）
   └─ 解像度・明るさチェック

3. Ready Player Me API呼び出し
   └─ POST /v1/avatars/photo
   └─ 生成ジョブID取得

4. 生成待機（ポーリング）
   └─ GET /v1/avatars/{jobId}
   └─ 進捗表示（0% → 100%）

5. GLBモデル取得
   └─ S3保存
   └─ DBに登録

6. プレビュー表示
   └─ ユーザー確認
   └─ 保存 or 再作成
```

**UI**:

```
┌──────────────────────────────────────────────────────────────┐
│ カスタムアバター作成（3D）                            [閉じる] │
├──────────────────────────────────────────────────────────────┤
│ Step 1: 写真をアップロード                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 📷                                                     │   │
│ │ 写真を選択またはドラッグ&ドロップ                      │   │
│ │                                                        │   │
│ │ [ファイルを選択]  [カメラで撮影]                      │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ℹ️ ポイント:                                                 │
│ • 正面を向いた顔写真を使用してください                        │
│ • 明るい場所で撮影された写真が最適です                        │
│ • 帽子やサングラスは外してください                            │
└──────────────────────────────────────────────────────────────┘

（生成中画面）
┌──────────────────────────────────────────────────────────────┐
│ 3Dアバターを生成中...                                         │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🔄                                                     │   │
│ │ あなたの3Dアバターを作成しています                     │   │
│ │                                                        │   │
│ │ ████████████░░░░░░░░ 65%                             │   │
│ │                                                        │   │
│ │ 推定残り時間: 約45秒                                   │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 生成ステータス: 顔認識完了 → 3Dモデル構築中                   │
└──────────────────────────────────────────────────────────────┘

（完成画面）
┌──────────────────────────────────────────────────────────────┐
│ 3Dアバター完成！                                              │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐                     │
│ │  [生成された3Dアバターのプレビュー]   │                     │
│ │  マウスで回転して確認できます         │                     │
│ └──────────────────────────────────────┘                     │
│                                                               │
│ 名前: [マイアバター1                    ]                    │
│                                                               │
│ [このアバターを保存]  [再作成する]                            │
└──────────────────────────────────────────────────────────────┘
```

**実装**:

```typescript
// services/avatarGeneration.ts
export async function generate3DAvatarFromPhoto(imageFile: File, userId: string): Promise<Avatar> {
  // 1. 画像アップロード
  const imageUrl = await uploadToS3(imageFile, `temp/${userId}/photo.jpg`);

  // 2. Ready Player Me API呼び出し
  const jobResponse = await fetch('https://api.readyplayer.me/v1/avatars/photo', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RPM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageUrl,
      gender: 'auto',
      bodyType: 'fullbody',
    }),
  });

  const { jobId } = await jobResponse.json();

  // 3. ポーリング（生成完了まで待機）
  let glbUrl: string | null = null;
  while (!glbUrl) {
    await sleep(5000); // 5秒待機

    const statusResponse = await fetch(`https://api.readyplayer.me/v1/avatars/${jobId}`, {
      headers: {
        Authorization: `Bearer ${process.env.RPM_API_KEY}`,
      },
    });

    const status = await statusResponse.json();

    if (status.status === 'completed') {
      glbUrl = status.glbUrl;
    } else if (status.status === 'failed') {
      throw new Error('Avatar generation failed');
    }

    // 進捗通知（WebSocket経由でフロントエンドに送信）
    await notifyProgress(userId, status.progress);
  }

  // 4. GLBモデルダウンロード → S3保存
  const glbResponse = await fetch(glbUrl);
  const glbBuffer = await glbResponse.arrayBuffer();
  const s3Key = `avatars/custom/${userId}/${Date.now()}.glb`;
  await uploadToS3(glbBuffer, s3Key);

  // 5. DB保存
  const avatar = await db.avatars.create({
    userId,
    name: 'マイアバター',
    type: '3d',
    source: 'generated',
    modelUrl: `https://cdn.example.com/${s3Key}`,
  });

  return avatar;
}
```

**受け入れ基準**:

- [ ] 写真アップロード後2分以内に3Dモデル生成完了
- [ ] 生成進捗がリアルタイム表示される
- [ ] 生成失敗時にエラーメッセージ表示
- [ ] 生成されたアバターがセッションで使用可能

**実装容易度**: ⭐⭐⭐ (7日)

---

### 3. シナリオビルダーUI ⭐⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want 自分専用のシナリオを作成できる
So that 特定の状況の練習ができる
```

**機能詳細**:

- シナリオ基本情報設定（タイトル、カテゴリ、言語、制限時間）
- アバターキャラクター設定（役割、性格、圧力レベル）
- 会話フロー設定（開始の一言、必須トピック）
- 評価基準設定（項目、重み付け）
- プレビュー & テスト実行

**UI画面**:

```
┌──────────────────────────────────────────────────────────────┐
│ シナリオビルダー                      [プレビュー] [保存]     │
├──────────────────────────────────────────────────────────────┤
│ ① 基本設定                                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ タイトル: [営業ロールプレイング - 新規顧客開拓       ]│   │
│ │ カテゴリ: [カスタマーサービス ▼]                      │   │
│ │ 言語:     [日本語 ▼]                                  │   │
│ │ 制限時間: [20    ] 分                                 │   │
│ │ 公開範囲: ○ 自分のみ  ○ 組織内共有  ○ 公開           │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ② アバターキャラクター設定                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 役割:    [購買担当者                              ]   │   │
│ │ 性格:    [skeptical ▼] (懐疑的)                      │   │
│ │ 圧力レベル: ●●●○○ (3/5)                             │   │
│ │ 背景設定:                                             │   │
│ │ [大手企業の購買担当。予算に厳しく、具体的な      ]   │   │
│ │ [ROIデータを求める。過去に似た商品で失敗した     ]   │   │
│ │ [経験があり、慎重な姿勢。                        ]   │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ③ 会話フロー設定                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 開始の一言:                                           │   │
│ │ [お忙しいところすみません。どのようなご用件      ]   │   │
│ │ [でしょうか？                                    ]   │   │
│ │                                                        │   │
│ │ 必須トピック: (ドラッグで並び替え)                    │   │
│ │ ☰ 商品・サービス説明                                  │   │
│ │ ☰ 価格・導入コスト                                    │   │
│ │ ☰ ROI・効果測定                                       │   │
│ │ ☰ 競合比較                                            │   │
│ │ ☰ 導入事例                                            │   │
│ │ [+ トピック追加]                                      │   │
│ │                                                        │   │
│ │ 深掘り質問: ☑ 有効                                   │   │
│ │ 移行スタイル: ○ 自然  ○ 構造的                      │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ④ 評価基準設定（オプション）                                  │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ☑ 評価機能を有効化                                    │   │
│ │                                                        │   │
│ │ 論理的説明力: ████░░░░░░ 40%                        │   │
│ │ 顧客理解度:   ██████░░░░ 30%                        │   │
│ │ 提案力:       ██████░░░░ 30%                        │   │
│ │              合計: 100%                              │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ [キャンセル]                          [下書き保存] [公開]     │
└──────────────────────────────────────────────────────────────┘
```

**データ構造**:

```typescript
interface ScenarioConfig {
  id: string;
  userId: string;
  orgId: string;

  // 基本設定
  title: string;
  category: 'job_interview' | 'language' | 'customer_service' | 'sales' | 'custom';
  language: 'ja' | 'en';
  maxDurationMin: number;
  visibility: 'private' | 'organization' | 'public';

  // アバターキャラクター
  avatarPersona: {
    role: string;
    personality: 'friendly' | 'professional' | 'strict' | 'skeptical' | 'casual';
    pressureLevel: 1 | 2 | 3 | 4 | 5;
    background: string;
  };

  // 会話フロー
  conversationFlow: {
    opening: string;
    requiredTopics: string[];
    followUpQuestions: boolean;
    transitionStyle: 'natural' | 'structured';
  };

  // 評価基準（オプション）
  evaluationCriteria?: {
    metric: string;
    weight: number;
    rubric: string;
  }[];
}
```

**API**:

```typescript
POST /api/scenarios
  Body: ScenarioConfig
  Response: { scenario }

GET /api/scenarios?visibility=private
  Response: { scenarios: [...] }

PUT /api/scenarios/:id
  Body: Partial<ScenarioConfig>
  Response: { scenario }

DELETE /api/scenarios/:id
  Response: { message: "Deleted" }

POST /api/scenarios/:id/test
  Body: { message: "テストメッセージ" }
  Response: { avatarResponse: "..." }
```

**受け入れ基準**:

- [ ] シナリオ作成後に一覧に表示される
- [ ] 作成したシナリオでセッション実行できる
- [ ] トピックの並び順がAIアバターの会話順序に反映される
- [ ] テスト機能でAIアバターの応答を確認できる

**実装容易度**: ⭐⭐⭐ (10日)

---

### 4. AIプロンプト管理UI（管理者） ⭐⭐⭐

**ユーザーストーリー**:

```
As a 管理者
I want システムプロンプトを編集してAIアバターの振る舞いをカスタマイズできる
So that 組織固有のニーズに対応できる
```

**機能詳細**:

- プロンプトテンプレート一覧・作成・編集
- 変数システム（動的変数注入）
- バージョン管理（変更履歴、ロールバック）
- テスト実行（リアルタイムプレビュー）
- エクスポート/インポート（JSON/YAML）

**UI画面**:

```
┌──────────────────────────────────────────────────────────────┐
│ AIプロンプト管理 (管理者専用)              [+ 新規テンプレート] │
├──────────────────────────────────────────────────────────────┤
│ 📋 プロンプトテンプレート一覧                                 │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ✏️ Default Interview Template           [編集] [複製] [削除]│
│ │    シナリオ: job_interview | 更新: 2026-03-01          │   │
│ │    使用中: 15セッション                                 │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ ✏️ Language Learning Template           [編集] [複製] [削除]│
│ │    シナリオ: language | 更新: 2026-02-28              │   │
│ │    使用中: 8セッション                                  │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

（編集画面）
┌──────────────────────────────────────────────────────────────┐
│ プロンプトテンプレート編集: Default Interview Template       │
├──────────────────────────────────────────────────────────────┤
│ 📝 システムプロンプト                     [変数一覧] [テスト] │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ あなたは{{role}}です。                                 │   │
│ │                                                        │   │
│ │ 【キャラクター設定】                                   │   │
│ │ 性格: {{personality}}                                 │   │
│ │ 背景: {{background}}                                  │   │
│ │ 圧力レベル: {{pressure_level}}/5                      │   │
│ │                                                        │   │
│ │ 【会話の目標】                                         │   │
│ │ 以下のトピックを自然な流れでカバーすること:            │   │
│ │ {{#each required_topics}}                             │   │
│ │ - {{this}}                                            │   │
│ │ {{/each}}                                             │   │
│ │                                                        │   │
│ │ 【インタラクション規則】                               │   │
│ │ - 深掘り質問: {{follow_up_questions}}                │   │
│ │ - 制限時間: {{max_duration_min}}分を意識すること      │   │
│ │ - 一度に1つの質問のみする                             │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 🧪 テスト実行                                                 │
│ サンプルシナリオ: [エンジニア採用面接 ▼]                     │
│ テストメッセージ: [私は5年間バックエンド開発を...    ]       │
│                                                [実行] [結果]  │
│                                                               │
│ 📊 パフォーマンス設定                                         │
│ Temperature: [0.7    ] (0.0-1.0)                             │
│ Max Tokens:  [2000   ]                                       │
│                                                               │
│ [キャンセル]  [下書き保存]               [保存して適用]      │
└──────────────────────────────────────────────────────────────┘
```

**受け入れ基準**:

- [ ] プロンプト編集後、新規セッションで反映される
- [ ] 変数が正しく置換される
- [ ] テスト実行でAI応答を確認できる
- [ ] バージョン履歴から過去のプロンプトを閲覧できる
- [ ] ロールバックで以前のバージョンに戻せる

**実装容易度**: ⭐⭐⭐ (10日)

---

### 5. AIプロバイダ管理UI（管理者） ⭐⭐⭐

**ユーザーストーリー**:

```
As a 管理者
I want AIプロバイダ（Claude/GPT-4等）を切り替えられる
So that コストと品質のバランスを最適化できる
```

**機能詳細**:

- プロバイダ一覧・追加・編集
- プロバイダごとの設定（APIキー、モデル、リージョン）
- アクティブプロバイダ切り替え
- 使用量トラッキング
- コストダッシュボード

**UI画面**:

```
┌──────────────────────────────────────────────────────────────┐
│ AIプロバイダ管理 (管理者専用)                    [設定保存]  │
├──────────────────────────────────────────────────────────────┤
│ 🤖 会話AI (Conversation AI)                                  │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ アクティブプロバイダ: [Anthropic Claude ▼]      [変更]│   │
│ │                                                        │   │
│ │ 利用可能なプロバイダ:                                  │   │
│ │  ● Anthropic Claude (claude-opus-4)        ✓ 設定済み │   │
│ │  ○ OpenAI GPT-4 Turbo                      ⚙️ 未設定  │   │
│ │  ○ Google Gemini Pro                       ⚙️ 未設定  │   │
│ │                                                        │   │
│ │ 設定:                                                  │   │
│ │ API Key: [●●●●●●●●●●●●●●●●●●●●]         [更新]      │   │
│ │ Model:   [claude-opus-4 ▼]                            │   │
│ │ Region:  [us-east-1 ▼]                                │   │
│ │                                              [接続テスト]│   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 📊 使用状況ダッシュボード                                     │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 今月のAPI使用量                                        │   │
│ │                                                        │   │
│ │ 会話AI:    12,450 tokens  ($8.73)   ████████░░ 82%    │   │
│ │ TTS:       8,320 characters ($4.16)  ████░░░░░░ 45%    │   │
│ │ STT:       152 minutes ($1.52)       ██░░░░░░░░ 15%    │   │
│ │                                                        │   │
│ │ 月次予算上限: $100.00 | 使用額: $14.41 | 残り: $85.59 │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ [キャンセル]                                    [保存]       │
└──────────────────────────────────────────────────────────────┘
```

**受け入れ基準**:

- [ ] プロバイダ切り替え後、新規セッションで反映される
- [ ] 接続テストで正常性を確認できる
- [ ] 使用量が正確にトラッキングされる
- [ ] 予算上限超過時にアラートが表示される

**実装容易度**: ⭐⭐⭐ (10日)

---

## Beta版 技術的マイルストーン

**Week 1-2: アバター拡充**

- [ ] プリセットアバター30種類準備
- [ ] アバター選択UI実装
- [ ] リアルタイムプレビュー

**Week 3-4: カスタムアバター**

- [ ] Ready Player Me統合
- [ ] AnimeGAN統合（2D）
- [ ] 生成ワークフロー

**Week 5: 音声拡充**

- [ ] 音声プリセット10種類
- [ ] 音声クローニング機能

**Week 6-7: シナリオ**

- [ ] プリセットシナリオ5種類
- [ ] シナリオビルダーUI

**Week 8-10: AI管理**

- [ ] プロンプト管理UI
- [ ] プロバイダ管理UI
- [ ] 使用量トラッキング

**Week 11-12: テスト・改善**

- [ ] Beta顧客フィードバック収集
- [ ] バグ修正・UX改善

---

## Beta版 成功基準

**定量指標**:

- [ ] 30組織以上登録
- [ ] 月間アクティブ率 > 60%
- [ ] セッション完了率 > 80%
- [ ] 週次リテンション（W1） > 40%
- [ ] NPS > 30

**定性指標**:

- [ ] 顧客インタビュー 20件以上
- [ ] 「代替手段がない」 > 50%
- [ ] 有料化意向 > 30%

**技術指標**:

- [ ] システム稼働率 > 99%
- [ ] P95 APIレスポンスタイム < 500ms
- [ ] エラー率 < 1%

---

# v1.0 - 解析・レポート機能

**リリース目標**: 開発開始から5.5ヶ月後
**対象ユーザー**: 一般公開
**目的**: プロダクションレディなSaaSとして提供

## 機能一覧サマリー

| #   | 機能                           | 実装容易度 | 優先度 | 期間 |
| --- | ------------------------------ | ---------- | ------ | ---- |
| 1   | 感情解析（Azure Face API）     | ⭐⭐⭐     | 高     | 7日  |
| 2   | 音声特徴解析（Azure Speech）   | ⭐⭐       | 高     | 5日  |
| 3   | AIレポート自動生成             | ⭐⭐⭐     | 高     | 10日 |
| 4   | レポートPDFエクスポート        | ⭐⭐       | 高     | 5日  |
| 5   | 感情タイムライングラフ         | ⭐⭐       | 中     | 5日  |
| 6   | ハイライトシーン抽出           | ⭐⭐⭐     | 中     | 7日  |
| 7   | トランスクリプト同期プレイヤー | ⭐⭐       | 高     | 7日  |
| 8   | プラン・課金システム           | ⭐⭐⭐     | 高     | 10日 |
| 9   | 使用量制限・クォータ管理       | ⭐⭐       | 高     | 5日  |
| 10  | 管理者ダッシュボード           | ⭐⭐       | 中     | 7日  |

## 主要機能詳細

### 1. AIレポート自動生成 ⭐⭐⭐

**ユーザーストーリー**:

```
As a ユーザー
I want セッション終了後に自動的に詳細なフィードバックレポートが生成される
So that 客観的な評価と改善点を知ることができる
```

**機能詳細**:

- Claude APIによる会話内容評価
- 評価基準ごとのスコア算出（0-100点）
- 強み・改善点の自動抽出
- ハイライト発言の特定
- パーソナライズド改善提案

**レポート構成**:

```markdown
# 面接評価レポート

**セッション**: エンジニア採用面接（中級）
**日時**: 2026-03-04 14:30
**時間**: 28分12秒

## 総合スコア

**73/100** (良好)

## 項目別評価

### 論理的説明力: 78/100 (良好)

技術的な説明が具体的で、例を交えて説明できていました。
特に、パフォーマンス最適化の事例（08:23）は優れています。

### アイコンタクト: 61/100 (要改善)

前半は良好でしたが、14分頃から視線が外れる傾向が見られました。
緊張が高まった場面でアイコンタクトを意識しましょう。

### 話速・間合い: 85/100 (優秀)

一貫して適切な話速（平均 142 WPM）を維持できています。
間の取り方も自然で、聞き手に配慮した話し方です。

### 語彙・表現力: 65/100 (普通)

業界用語は適切に使用できていますが、表現のバリエーションが
やや限定的です。より多様な表現を身につけましょう。

## 感情推移

[グラフ: 自信度・緊張度の時系列変化]

序盤は適度な緊張感で良好なスタート。
中盤（15分頃）に緊張が高まりましたが、後半で回復しています。

## ハイライトシーン

⭐ **08:23 - 技術説明が具体的**
「Reactのメモ化を活用して、再レンダリングを30%削減しました」
→ 具体的な数値と手法を明示した優れた説明

⚠️ **15:41 - チーム衝突の説明が曖昧**
「いろいろありましたが、最終的には解決しました」
→ STAR法を用いてより構造的に説明すると良い

⭐ **22:09 - 志望動機が明確**
「御社のミッション『XXX』に共感し...」
→ 企業研究が十分で、熱意が伝わる

## 改善提案

1. **アイコンタクトの維持**
   - カメラを意識した練習を行う
   - 緊張時こそ意識的に視線を向ける

2. **フィラーの削減**
   - 「えー」「あー」が計14回検出されました
   - 無音の間を恐れず、考える時間を取る

3. **エピソードの構造化**
   - STAR法（状況・課題・行動・結果）を活用
   - 具体的な数値・成果を盛り込む

## 次のステップ

- [ ] アイコンタクト強化のため「カメラ目線練習」シナリオを試す
- [ ] STAR法の練習問題に取り組む
- [ ] より難易度の高い「エンジニア採用面接（上級）」に挑戦
```

**実装**:

```typescript
// services/reportGeneration.ts
export async function generateReport(sessionId: string): Promise<Report> {
  // 1. セッションデータ取得
  const session = await db.sessions.findById(sessionId);
  const transcript = await db.transcripts.find({ sessionId });
  const emotionData = await db.emotionData.find({ sessionId });
  const audioAnalysis = await db.audioAnalysis.findOne({ sessionId });
  const scenario = await db.scenarios.findById(session.scenarioId);

  // 2. Claude APIでレポート生成
  const reportPrompt = buildReportPrompt(scenario, transcript, emotionData, audioAnalysis);

  const response = await claude.messages.create({
    model: 'claude-opus-4',
    max_tokens: 4000,
    system: REPORT_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: reportPrompt }],
  });

  const reportContent = response.content[0].text;

  // 3. スコア抽出・構造化
  const structuredReport = parseReportContent(reportContent);

  // 4. DB保存
  const report = await db.reports.create({
    sessionId,
    overallScore: structuredReport.overallScore,
    sectionScores: structuredReport.sectionScores,
    aiFeedback: reportContent,
    highlights: structuredReport.highlights,
    recommendations: structuredReport.recommendations,
    generatedAt: new Date(),
  });

  return report;
}

const REPORT_GENERATION_SYSTEM_PROMPT = `
あなたはキャリアコーチ・評価専門家です。
セッションのトランスクリプトと解析データから、詳細な評価レポートを生成してください。

【評価の原則】
- 客観的かつ建設的なフィードバック
- 具体的な改善提案（実行可能なアクション）
- ポジティブな点を必ず含める（バランス重視）
- 数値データを活用した根拠ある評価

【レポート形式】
1. 総合スコア（0-100）
2. 項目別評価（各0-100）
3. 感情推移の分析
4. ハイライトシーン（良い点・改善点）
5. 具体的な改善提案（3-5項目）
6. 次のステップ

言語: 日本語
トーン: 励ましと成長を促す
`;
```

**受け入れ基準**:

- [ ] セッション終了後10分以内にレポート生成完了
- [ ] スコアが評価基準と整合している
- [ ] ハイライトシーンのタイムスタンプが正確
- [ ] 改善提案が具体的で実行可能

**実装容易度**: ⭐⭐⭐ (10日)

---

### 2. プラン・課金システム ⭐⭐⭐

**ユーザーストーリー**:

```
As a 組織管理者
I want 有料プランにアップグレードできる
So that より多くのセッション数と高度な機能を利用できる
```

**機能詳細**:

- Freeプラン（5セッション/月）
- Proプラン（$99/月、50セッション/月）
- Enterpriseプラン（カスタム見積もり）
- プラン比較ページ
- 請求書払い（初期はEnterpriseのみ）
- 使用量・クォータ監視

**プラン比較ページ**:

```
┌──────────────────────────────────────────────────────────────┐
│ プラン選択                                                    │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│ │  Free    │  │   Pro    │  │Enterprise│                   │
│ │          │  │ おすすめ │  │          │                   │
│ │  $0/月   │  │ $99/月   │  │ カスタム │                   │
│ │          │  │          │  │          │                   │
│ │ 5セッション│ │50セッション│ │無制限    │                   │
│ │ 7日保存  │  │ 90日保存 │  │ 無制限   │                   │
│ │ 3ユーザー│  │ 50ユーザー│ │ 無制限   │                   │
│ │          │  │          │  │          │                   │
│ │ 基本機能 │  │ AI管理   │  │ SSO      │                   │
│ │          │  │ ベンチマーク│ │ API連携  │                   │
│ │          │  │ カスタム │  │ ATS統合  │                   │
│ │          │  │ アバター │  │ 専任     │                   │
│ │          │  │          │  │ サポート │                   │
│ │          │  │          │  │          │                   │
│ │[現在のプラン]│[アップグレード]│[お問い合わせ]│                 │
│ └──────────┘  └──────────┘  └──────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

**使用状況ダッシュボード**:

```
┌──────────────────────────────────────────────────────────────┐
│ 使用状況                                          2026-03-04  │
├──────────────────────────────────────────────────────────────┤
│ 現在のプラン: Pro ($99/月)              [プラン変更]         │
│                                                               │
│ 今月の使用量:                                                 │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ セッション数:   23 / 50   ████████░░░░░░ 46%          │   │
│ │ 録画保存容量:   12GB / 100GB ███░░░░░░░░░ 12%         │   │
│ │ ユーザー数:     8 / 50    ███░░░░░░░░░░ 16%          │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 次回請求日: 2026-04-01                                        │
│ 請求額: $99.00                                                │
│                                                               │
│ [請求履歴を見る]  [支払い方法を変更]                         │
└──────────────────────────────────────────────────────────────┘
```

**データベース**:

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  plan_id VARCHAR(50) NOT NULL, -- 'free', 'pro', 'enterprise'
  status VARCHAR(20) NOT NULL, -- 'trial', 'active', 'past_due', 'canceled'
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  trial_end_date TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  sessions_used INT DEFAULT 0,
  sessions_limit INT NOT NULL,
  storage_used_gb NUMERIC(10,2) DEFAULT 0,
  storage_limit_gb NUMERIC(10,2) NOT NULL,
  users_count INT DEFAULT 0,
  users_limit INT NOT NULL
);
```

**受け入れ基準**:

- [ ] プラン比較ページが表示される
- [ ] アップグレード後に機能が有効化される
- [ ] 使用量がリアルタイムで更新される
- [ ] 上限超過時にアラート表示される
- [ ] 請求書が自動発行される（Enterpriseのみ）

**実装容易度**: ⭐⭐⭐ (10日)

---

## v1.0 リリース判断基準

### Go判断（v1.x移行）

- [ ] ローンチ後1ヶ月で200組織以上登録
- [ ] 有料プラン契約 > 20組織
- [ ] P0/P1バグ解決済み
- [ ] セキュリティ監査クリア
- [ ] システム稼働率 > 99.5%

### Delay判断（リリース延期）

- [ ] セキュリティ脆弱性（高・重大）の発見
- [ ] データ損失リスクのある不具合
- [ ] 法務・コンプライアンス問題

---

# v1.x - エンタープライズ機能

**リリース目標**: 開発開始から9.5ヶ月後
**対象ユーザー**: Enterprise顧客
**目的**: 高付加価値機能の提供

## リリース計画

### v1.1 - ベンチマーク機能（1ヶ月）⭐⭐⭐⭐

- ユーザープロファイル自動算出
- 組織内ベンチマーク比較
- 成長トラッキング
- パーソナライズド改善提案

### v1.2 - 外部API連携（1ヶ月）⭐⭐⭐

- APIキー発行・管理
- RESTful API
- レート制限
- Webhook通知

### v1.3 - Stripe決済統合（1週間）⭐⭐

- クレジットカード決済
- サブスクリプション自動更新
- プラン変更

### v1.4 - セキュリティ・SSO（2週間）⭐⭐⭐

- SAML 2.0 SSO
- MFA強制オプション
- IP制限

### v1.5 - カスタムレポート（3週間）⭐⭐⭐

- レポートテンプレートビルダー
- カスタム評価基準
- ブランディング

---

# v2.0 - グローバル展開機能

**リリース目標**: 開発開始から13.5ヶ月後
**対象ユーザー**: グローバル市場
**目的**: 多言語対応とエコシステム構築

## 機能一覧

### 1. 多言語対応（4週間）⭐⭐⭐

- UI多言語化（日英中仏独）
- シナリオ多言語対応
- 多言語TTS/STT

### 2. ATS連携（6週間）⭐⭐⭐⭐

- 国内ATS 3社統合
- 海外ATS 3社統合
- 候補者データ同期
- 結果自動送信

### 3. プラグインシステム（6週間）⭐⭐⭐⭐

- プラグインSDK
- プラグイン管理UI
- サンドボックス実行
- 公式プラグイン開発

---

## 全体スケジュール概要

```
月   0     2     3.5    5.5    6.5    7.5  8  8.5  9.5      13.5
     │─────│─────│──────│──────│──────│───│───│───│─────────│
     │     │     │      │      │      │   │   │   │         │
   Phase  Alpha Beta  v1.0   v1.1  v1.2 v1.3 v1.4 v1.5     v2.0
     0      版   版   一般  ベンチ API Stripe SSO カスタム グローバル
   基盤   内部  限定   公開  マーク 連携 決済      レポート  展開
```

---

**最終更新**: 2026-03-04
**作成者**: AI Platform Team
**レビュー**: 実装フェーズ開始前に更新予定
