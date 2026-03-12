# 無音時間管理システム設計

**作成日:** 2026-03-11
**ステータス:** 設計中
**優先度:** Phase 1.5拡張機能

---

## 概要

会話セッション中の無音時間を管理し、適切なタイミングでAIがユーザーに会話を促すシステム。

### 主要機能

1. **無音時間の設定（ユーザーカスタマイズ）**
   - シナリオ作成/編集時に無音時間を設定可能
   - プリセット: 5秒、10秒、15秒、30秒、カスタム（1-60秒）

2. **無音検出の制御**
   - 無音時間内の無音は正常動作（エラーではない）
   - AIが喋っている間は無音タイマーを停止
   - ユーザーが話し始めたらタイマーをリセット

3. **AI自動促し機能**
   - 無音時間経過後、AIが適切な促し言葉を自動生成
   - シナリオのコンテキストに応じた適切な表現を選択
   - 促し言葉の例:
     - 面接: "他に質問はありますか？"、"続けてください"
     - 語学学習: "もう少し詳しく話してみてください"
     - 研修: "どう思いますか？"、"何か疑問点はありますか？"

---

## システムアーキテクチャ

### 全体フロー

```
┌─────────────────────────────────────────────────────────────┐
│ 1. シナリオ設定（UI）                                        │
│    - silenceTimeout: 10秒                                    │
│    - enableSilencePrompt: true                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. セッション開始（Frontend）                                │
│    - WebSocket認証時にシナリオ設定を送信                     │
│    - 無音タイマー初期化                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 無音検出（Frontend - useAudioRecorder）                   │
│    - 音声入力の音量を監視                                    │
│    - silenceThreshold: 0.05 以下が silenceDuration継続       │
│    - 検出条件:                                               │
│      ✓ ユーザーが話していない（音量 < 0.05）                │
│      ✓ 最小継続時間経過（500ms）                             │
│      ✓ AIが喋っていない（isPlayingAudio: false）            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. speech_end イベント送信（WebSocket）                      │
│    - type: 'speech_end'                                      │
│    - sessionId: xxx                                          │
│    - timestamp: xxx                                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Lambda処理（WebSocket Handler）                           │
│    - 音声データをS3から取得・結合                            │
│    - Azure STT → Bedrock Claude → ElevenLabs TTS            │
│    - AI応答を生成・送信                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 無音タイマー管理（Frontend）                              │
│    - ユーザーが話していない間: タイマーカウント             │
│    - AIが話している間: タイマー停止                          │
│    - ユーザーが話し始めた: タイマーリセット                  │
└────────────────┬────────────────────────────────────────────┘
                 │ silenceTimeout 経過
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. 促しメッセージ送信（Frontend → Lambda）                  │
│    - type: 'silence_prompt_request'                          │
│    - sessionId: xxx                                          │
│    - elapsedTime: 10000 (ms)                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. AI促し生成（Lambda）                                      │
│    - シナリオコンテキストを分析                              │
│    - Bedrock Claudeに促し言葉を生成依頼                      │
│    - プロンプト例:                                           │
│      "面接中にユーザーが10秒間無言です。                     │
│       適切な促し言葉を1文で生成してください。                │
│       カジュアルすぎず、プレッシャーを与えない表現で。"      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. TTS生成・音声再生（ElevenLabs → Frontend）               │
│    - AI促し言葉を音声化                                      │
│    - ストリーミング再生                                      │
│    - 再生中は無音タイマーを停止                              │
└─────────────────────────────────────────────────────────────┘
```

---

## データモデル

### 1. Scenario追加フィールド

```typescript
interface Scenario {
  // 既存フィールド
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  visibility: Visibility;
  systemPrompt?: string;
  configJson: ScenarioConfig;
  // ...

  // 新規追加フィールド
  silenceTimeout?: number;         // 無音タイマー（秒）、デフォルト: 10
  enableSilencePrompt?: boolean;   // 無音促し機能の有効/無効、デフォルト: true
}

interface ScenarioConfig {
  // 既存フィールド
  systemPrompt?: string;
  evaluationCriteria?: string[];

  // 新規追加フィールド
  silencePromptStyle?: 'formal' | 'casual' | 'neutral'; // 促し言葉のトーン
  silencePromptExamples?: string[];  // カスタム促し言葉の例（オプション）
}
```

### 2. WebSocketメッセージ拡張

#### 新規メッセージタイプ: silence_prompt_request

```typescript
interface SilencePromptRequestMessage {
  type: 'silence_prompt_request';
  sessionId: string;
  elapsedTime: number;  // 無音時間（ミリ秒）
  timestamp: number;
}
```

#### 新規メッセージタイプ: silence_prompt_response

```typescript
interface SilencePromptResponseMessage {
  type: 'silence_prompt_response';
  text: string;         // AI生成の促し言葉
  timestamp: number;
}
```

### 3. ConnectionData拡張

```typescript
interface ConnectionData {
  // 既存フィールド
  connectionId: string;
  sessionId?: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  // ...

  // 新規追加フィールド
  silenceTimeout?: number;          // シナリオで設定された無音タイマー（秒）
  enableSilencePrompt?: boolean;    // 無音促し機能の有効/無効
  silencePromptStyle?: string;      // 促し言葉のトーン
  lastSilencePromptTime?: number;   // 最後の促し送信時刻（重複防止用）
}
```

---

## UI設計

### 1. シナリオ作成/編集ページ

**新規セクション: 会話設定**

```
┌─────────────────────────────────────────────────────────┐
│ 会話設定                                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ □ 無音時に会話を促す                                    │
│   [有効化すると、ユーザーが一定時間無言の場合に         │
│    AIが自動的に話を促します]                            │
│                                                          │
│   無音待機時間:                                         │
│   ┌─────────────────────────────────────┐              │
│   │ ○ 5秒   ○ 10秒   ○ 15秒   ○ 30秒  │              │
│   │ ○ カスタム: [___] 秒 (1-60)        │              │
│   └─────────────────────────────────────┘              │
│                                                          │
│   促し言葉のトーン:                                     │
│   ┌─────────────────────────────────────┐              │
│   │ ○ フォーマル  ○ カジュアル  ○ 中立 │              │
│   └─────────────────────────────────────┘              │
│                                                          │
│   カスタム促し言葉（オプション）:                       │
│   ┌─────────────────────────────────────┐              │
│   │ 例: "何かご質問はありますか？"      │              │
│   │     "続けてお話しください"           │              │
│   │     [+ 追加]                         │              │
│   └─────────────────────────────────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2. セッションプレイヤー

**無音タイマー表示（デバッグ用・オプション）**

```
┌─────────────────────────────────────────────────────────┐
│ セッション進行中                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [アバター映像]        [ユーザーカメラ]                 │
│                                                          │
│  無音タイマー: 7秒 / 10秒  ⏱️                           │
│  状態: ユーザー待機中                                    │
│                                                          │
│  [ミュート解除] [一時停止] [終了]                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 実装詳細

### Phase 1: データモデル拡張

#### 1.1 Prismaスキーマ更新

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

  // 新規追加
  silenceTimeout    Int?         @default(10)  // 秒単位、デフォルト10秒
  enableSilencePrompt Boolean?   @default(true)

  // ...他のフィールド
}
```

#### 1.2 Shared Types更新

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

  // 新規追加
  silenceTimeout?: number;
  enableSilencePrompt?: boolean;

  // ...他のフィールド
}

export interface ScenarioConfig {
  systemPrompt?: string;
  evaluationCriteria?: string[];
  silencePromptStyle?: 'formal' | 'casual' | 'neutral';
  silencePromptExamples?: string[];
}
```

### Phase 2: フロントエンド実装

#### 2.1 シナリオ作成/編集フォーム

```typescript
// apps/web/app/dashboard/scenarios/new/page.tsx
// apps/web/app/dashboard/scenarios/[id]/edit/page.tsx

const [silenceTimeout, setSilenceTimeout] = useState<number>(10);
const [enableSilencePrompt, setEnableSilencePrompt] = useState<boolean>(true);
const [silencePromptStyle, setSilencePromptStyle] = useState<'formal' | 'casual' | 'neutral'>('neutral');

// フォーム送信時
const handleSubmit = async () => {
  const scenarioData = {
    // 既存フィールド
    name,
    description,
    category,
    language,
    visibility,
    systemPrompt,

    // 新規フィールド
    silenceTimeout,
    enableSilencePrompt,
    configJson: {
      silencePromptStyle,
      // ...他の設定
    },
  };

  await api.post('/scenarios', scenarioData);
};
```

#### 2.2 無音タイマー管理フック

```typescript
// apps/web/hooks/useSilenceTimer.ts

interface UseSilenceTimerOptions {
  enabled: boolean;
  timeoutSeconds: number;
  isAIPlaying: boolean;
  isUserSpeaking: boolean;
  onTimeout: () => void;
}

export function useSilenceTimer(options: UseSilenceTimerOptions) {
  const { enabled, timeoutSeconds, isAIPlaying, isUserSpeaking, onTimeout } = options;

  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // タイマー開始
  const startTimer = useCallback(() => {
    if (!enabled || isAIPlaying || isUserSpeaking) return;

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
      setElapsedTime(elapsed);

      if (elapsed >= timeoutSeconds) {
        onTimeout();
        resetTimer();
      }
    }, 1000);
  }, [enabled, isAIPlaying, isUserSpeaking, timeoutSeconds, onTimeout]);

  // タイマーリセット
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    setElapsedTime(0);
  }, []);

  // タイマー停止（AI再生中）
  useEffect(() => {
    if (isAIPlaying || isUserSpeaking) {
      resetTimer();
    } else if (enabled && !timerRef.current) {
      startTimer();
    }
  }, [isAIPlaying, isUserSpeaking, enabled, startTimer, resetTimer]);

  // クリーンアップ
  useEffect(() => {
    return () => resetTimer();
  }, [resetTimer]);

  return { elapsedTime, resetTimer };
}
```

#### 2.3 SessionPlayer統合

```typescript
// apps/web/components/session-player/index.tsx

import { useSilenceTimer } from '@/hooks/useSilenceTimer';

export function SessionPlayer({ session, avatar, scenario }: SessionPlayerProps) {
  // 既存のstate
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // 無音タイマー
  const { elapsedTime, resetTimer } = useSilenceTimer({
    enabled: scenario.enableSilencePrompt ?? true,
    timeoutSeconds: scenario.silenceTimeout ?? 10,
    isAIPlaying: isPlayingAudio,
    isUserSpeaking,
    onTimeout: handleSilenceTimeout,
  });

  // 無音タイムアウト時の処理
  const handleSilenceTimeout = useCallback(() => {
    console.log('[SessionPlayer] Silence timeout - requesting AI prompt');

    if (sendMessageRef.current) {
      sendMessageRef.current({
        type: 'silence_prompt_request',
        sessionId: session.id,
        elapsedTime: elapsedTime * 1000,
        timestamp: Date.now(),
      });
    }
  }, [session.id, elapsedTime]);

  // 音声入力検出時（useAudioRecorder）
  const handleVolumeChange = useCallback((volume: number) => {
    const speaking = volume > 0.05;
    setIsUserSpeaking(speaking);

    if (speaking) {
      resetTimer(); // ユーザーが話し始めたらタイマーリセット
    }
  }, [resetTimer]);

  // WebSocket メッセージハンドラー拡張
  const handleMessage = useCallback((event: MessageEvent) => {
    const message = JSON.parse(event.data);

    if (message.type === 'silence_prompt_response') {
      // AI促し言葉を受信
      console.log('[SessionPlayer] Received silence prompt:', message.text);

      setTranscript(prev => [
        ...prev,
        {
          id: `prompt-${message.timestamp}`,
          speaker: 'AI',
          text: message.text,
          timestamp: message.timestamp,
          partial: false,
        },
      ]);

      // TTS音声も再生される（既存のaudio_response処理）
    }

    // 既存のメッセージ処理...
  }, []);

  // ...
}
```

### Phase 3: Lambda実装

#### 3.1 WebSocket Handler拡張

```typescript
// infrastructure/lambda/websocket/default/index.ts

case 'silence_prompt_request': {
  const { sessionId, elapsedTime } = parsedMessage as SilencePromptRequestMessage;

  console.log('[silence_prompt_request] Generating AI prompt for silence:', {
    sessionId,
    elapsedTime: `${elapsedTime}ms`,
  });

  // ConnectionDataから設定取得
  const connectionData = await getConnectionData(connectionId);
  const silencePromptStyle = connectionData?.silencePromptStyle || 'neutral';
  const conversationHistory = connectionData?.conversationHistory || [];

  // AI促し言葉を生成
  const promptText = await generateSilencePrompt({
    sessionId,
    elapsedTime,
    conversationHistory,
    style: silencePromptStyle,
    scenarioLanguage: connectionData?.scenarioLanguage || 'ja',
  });

  // 会話履歴に追加
  conversationHistory.push({
    role: 'assistant',
    content: promptText,
  });

  await updateConnectionData(connectionId, {
    conversationHistory,
    lastSilencePromptTime: Date.now(),
  });

  // クライアントに促しテキストを送信
  await sendToConnection(connectionId, {
    type: 'silence_prompt_response',
    text: promptText,
    timestamp: Date.now(),
  });

  // TTS生成（ストリーミング）
  await generateAndStreamTTS({
    text: promptText,
    language: connectionData?.scenarioLanguage || 'ja',
    connectionId,
    sessionId,
  });

  break;
}
```

#### 3.2 AI促し生成関数

```typescript
// infrastructure/lambda/websocket/default/generateSilencePrompt.ts

interface GenerateSilencePromptOptions {
  sessionId: string;
  elapsedTime: number;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  style: 'formal' | 'casual' | 'neutral';
  scenarioLanguage: string;
}

export async function generateSilencePrompt(
  options: GenerateSilencePromptOptions
): Promise<string> {
  const { elapsedTime, conversationHistory, style, scenarioLanguage } = options;

  // Bedrock Claude APIを呼び出し
  const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const systemPrompt = `あなたは会話を円滑に進める役割です。
ユーザーが${Math.floor(elapsedTime / 1000)}秒間無言です。
適切な促し言葉を1文で生成してください。

条件:
- トーン: ${style === 'formal' ? 'フォーマル' : style === 'casual' ? 'カジュアル' : '中立'}
- 言語: ${scenarioLanguage}
- プレッシャーを与えない自然な表現
- 簡潔に（15文字以内推奨）

会話履歴:
${conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

促し言葉のみを出力してください。`;

  const command = new InvokeModelCommand({
    modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 50,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: systemPrompt,
        },
      ],
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const promptText = responseBody.content[0].text.trim();

  console.log('[generateSilencePrompt] Generated prompt:', promptText);

  return promptText;
}
```

---

## テスト計画

### 1. ユニットテスト

#### useSilenceTimer Hook

```typescript
describe('useSilenceTimer', () => {
  it('should start timer when enabled and not AI playing', () => {
    // ...
  });

  it('should stop timer when AI starts playing', () => {
    // ...
  });

  it('should reset timer when user starts speaking', () => {
    // ...
  });

  it('should call onTimeout after timeout duration', () => {
    // ...
  });
});
```

#### generateSilencePrompt Function

```typescript
describe('generateSilencePrompt', () => {
  it('should generate formal prompt', async () => {
    const prompt = await generateSilencePrompt({
      sessionId: 'test',
      elapsedTime: 10000,
      conversationHistory: [],
      style: 'formal',
      scenarioLanguage: 'ja',
    });

    expect(prompt).toMatch(/ありますか|ください$/);
  });

  it('should generate casual prompt', async () => {
    const prompt = await generateSilencePrompt({
      sessionId: 'test',
      elapsedTime: 10000,
      conversationHistory: [],
      style: 'casual',
      scenarioLanguage: 'ja',
    });

    expect(prompt).toBeDefined();
  });
});
```

### 2. 統合テスト

#### E2E テスト

```typescript
test('Silence management E2E flow', async ({ page }) => {
  // 1. シナリオ作成（無音時間: 5秒）
  await page.goto('/dashboard/scenarios/new');
  await page.fill('input[name="name"]', 'Silence Test Scenario');
  await page.check('input[name="enableSilencePrompt"]');
  await page.click('input[value="5"]'); // 5秒設定
  await page.click('button:has-text("作成")');

  // 2. セッション開始
  await page.goto('/dashboard/sessions/new');
  // シナリオ選択...
  await page.click('button:has-text("開始")');

  // 3. マイクをミュート（無音状態をシミュレート）
  await page.click('button[aria-label="ミュート"]');

  // 4. 5秒後にAI促しメッセージが表示される
  await page.waitForSelector('text=/何か|質問|続けて/', { timeout: 6000 });

  // 5. トランスクリプトにAI促しが追加される
  const transcript = await page.textContent('.transcript-container');
  expect(transcript).toContain('質問');
});
```

---

## パフォーマンス考慮事項

### 1. 促しメッセージのキャッシュ

**問題:** 毎回Bedrock APIを呼び出すとコストとレイテンシが増加

**解決策:** よく使われる促し言葉をキャッシュ

```typescript
// Lambda層でキャッシュ
const SILENCE_PROMPT_CACHE: Record<string, string[]> = {
  'ja-formal': [
    '他に質問はありますか？',
    '続けてお話しください。',
    'どのようにお考えですか？',
  ],
  'ja-casual': [
    'どう思う？',
    '他にある？',
    '続けて話してみて。',
  ],
  'en-formal': [
    'Do you have any other questions?',
    'Please continue.',
    'What are your thoughts?',
  ],
  // ...
};

function getRandomCachedPrompt(language: string, style: string): string {
  const key = `${language}-${style}`;
  const prompts = SILENCE_PROMPT_CACHE[key] || SILENCE_PROMPT_CACHE['ja-neutral'];
  return prompts[Math.floor(Math.random() * prompts.length)];
}
```

### 2. 促し頻度制限

**問題:** 短時間に何度も促しが発生する可能性

**解決策:** 最小間隔を設定（例: 前回の促しから30秒以内は再送しない）

```typescript
const MIN_PROMPT_INTERVAL_MS = 30000; // 30秒

case 'silence_prompt_request': {
  const connectionData = await getConnectionData(connectionId);
  const lastPromptTime = connectionData?.lastSilencePromptTime || 0;
  const timeSinceLastPrompt = Date.now() - lastPromptTime;

  if (timeSinceLastPrompt < MIN_PROMPT_INTERVAL_MS) {
    console.log('[silence_prompt_request] Too soon after last prompt, skipping');
    return { statusCode: 200, body: 'OK' };
  }

  // 促し生成処理...
}
```

---

## セキュリティ考慮事項

### 1. 促しメッセージの検証

生成されたAI促し言葉が不適切な内容を含まないか検証

```typescript
function validatePromptText(text: string): boolean {
  // 不適切なキーワード検出
  const forbiddenPatterns = [
    /暴力/,
    /差別/,
    // ...
  ];

  return !forbiddenPatterns.some(pattern => pattern.test(text));
}
```

### 2. レート制限

無音促しリクエストの頻度を制限し、API乱用を防止

```typescript
// DynamoDBでレート制限管理
const rateLimitKey = `silence_prompt_rate_${connectionId}`;
const requestCount = await incrementRateLimit(rateLimitKey, 60); // 1分あたり

if (requestCount > 5) {
  console.warn('[silence_prompt_request] Rate limit exceeded');
  return { statusCode: 429, body: 'Too Many Requests' };
}
```

---

## 多言語対応

### 促し言葉の翻訳

```typescript
// apps/web/messages/ja/scenarios.json
{
  "silenceManagement": {
    "title": "無音時の会話促し",
    "enablePrompt": "無音時に会話を促す",
    "timeoutLabel": "無音待機時間",
    "styleLabel": "促し言葉のトーン",
    "styles": {
      "formal": "フォーマル",
      "casual": "カジュアル",
      "neutral": "中立"
    },
    "presets": {
      "5sec": "5秒",
      "10sec": "10秒",
      "15sec": "15秒",
      "30sec": "30秒",
      "custom": "カスタム"
    }
  }
}

// apps/web/messages/en/scenarios.json
{
  "silenceManagement": {
    "title": "Silence Prompt",
    "enablePrompt": "Prompt conversation during silence",
    "timeoutLabel": "Silence timeout",
    "styleLabel": "Prompt tone",
    "styles": {
      "formal": "Formal",
      "casual": "Casual",
      "neutral": "Neutral"
    },
    "presets": {
      "5sec": "5 seconds",
      "10sec": "10 seconds",
      "15sec": "15 seconds",
      "30sec": "30 seconds",
      "custom": "Custom"
    }
  }
}
```

---

## 実装スケジュール

### Week 1: データモデル・UI

- Day 1-2: Prismaスキーマ更新、マイグレーション実行
- Day 3-4: シナリオ作成/編集フォームにUI追加
- Day 5: useSilenceTimer Hook実装

### Week 2: Lambda実装

- Day 6-7: WebSocket Handler拡張（silence_prompt_request処理）
- Day 8-9: generateSilencePrompt関数実装
- Day 10: TTS統合

### Week 3: テスト・最適化

- Day 11-12: ユニットテスト作成
- Day 13-14: E2Eテスト作成
- Day 15: パフォーマンス最適化（キャッシュ、レート制限）

---

## 成功指標

1. **機能的指標**
   - ✅ ユーザーが無音時間を設定可能
   - ✅ 設定時間経過後、AIが適切な促しを生成
   - ✅ AI音声再生中は無音タイマーが停止

2. **パフォーマンス指標**
   - 促し生成レイテンシ: < 2秒
   - Bedrock API呼び出し: キャッシュヒット率 > 80%
   - フロントエンドタイマー精度: ±500ms以内

3. **ユーザー体験指標**
   - 促しメッセージの適切性: ユーザー評価 > 4.0/5.0
   - 会話の自然さ: プレッシャーを感じない（主観評価）
   - 無音時のストレス軽減: セッション完了率向上

---

**最終更新:** 2026-03-11
**次回レビュー:** Phase 1.5完了後
