# エラーハンドリング実装ガイド

**作成日:** 2026-03-10
**Phase 1.5 Day 8-9:** エラーハンドリング強化完了

---

## 概要

このドキュメントでは、Phase 1.5で実装したエラーハンドリング・リトライロジックの使用方法と実装パターンを説明します。

---

## 目次

1. [フロントエンドエラーハンドリング](#フロントエンドエラーハンドリング)
2. [バックエンドリトライロジック](#バックエンドリトライロジック)
3. [エラーログ](#エラーログ)
4. [ベストプラクティス](#ベストプラクティス)

---

## フロントエンドエラーハンドリング

### useErrorMessage Hook

**場所:** `apps/web/hooks/useErrorMessage.ts`

**使用方法:**

```typescript
import { useErrorMessage } from '@/hooks/useErrorMessage';

function MyComponent() {
  const { getErrorMessage, getMicrophoneInstructions } = useErrorMessage();

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    // エラーコードから多言語メッセージを取得
    const message = getErrorMessage(error);
    toast.error(message);

    // マイクエラーの場合はブラウザ固有の手順を表示
    if (error.name === 'NotAllowedError') {
      const instructions = getMicrophoneInstructions();
      toast.info(instructions);
    }
  }
}
```

### エラーコード一覧

| エラーコード | 説明 | 自動リトライ |
|------------|------|------------|
| `MICROPHONE_PERMISSION_DENIED` | マイク許可拒否 | ❌ |
| `MICROPHONE_NOT_FOUND` | マイクなし | ❌ |
| `MICROPHONE_NOT_READABLE` | マイク使用中 | ❌ |
| `BROWSER_NOT_SUPPORTED` | ブラウザ非対応 | ❌ |
| `LOW_VOLUME` | 音量不足 | ❌ |
| `WEBSOCKET_CONNECTION_FAILED` | WebSocket接続失敗 | ✅ (自動再接続) |
| `WEBSOCKET_TIMEOUT` | WebSocket タイムアウト | ✅ (自動再接続) |
| `API_TIMEOUT` | API処理タイムアウト | ✅ (バックエンド) |

### ブラウザ互換性チェック

**場所:** `apps/web/lib/browser-check.ts`

**使用方法:**

```typescript
import { checkBrowserCapabilities, detectBrowser } from '@/lib/browser-check';

function MyComponent() {
  useEffect(() => {
    const capabilities = checkBrowserCapabilities();

    if (!capabilities.isSupported) {
      console.error('Unsupported features:', capabilities.unsupportedFeatures);
      toast.error('お使いのブラウザは対応していません');
    }

    const browser = detectBrowser();
    console.log('Browser:', browser.name, browser.version);
  }, []);
}
```

### タイムアウト処理

**場所:** `apps/web/components/session-player/index.tsx`

**実装例:**

```typescript
// 30秒タイムアウト検出
const processingStartTimeRef = useRef<number | null>(null);
const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const PROCESSING_TIMEOUT_MS = 30000;

const handleProcessingUpdate = useCallback((message) => {
  if (!processingStartTimeRef.current) {
    processingStartTimeRef.current = Date.now();

    processingTimeoutRef.current = setTimeout(() => {
      toast.warning(t('errors.api.timeout'), { duration: 5000 });
    }, PROCESSING_TIMEOUT_MS);
  }
}, []);

// 成功時にタイムアウトをクリア
const handleSuccess = useCallback(() => {
  if (processingTimeoutRef.current) {
    clearTimeout(processingTimeoutRef.current);
    processingTimeoutRef.current = null;
  }
  processingStartTimeRef.current = null;
}, []);
```

---

## バックエンドリトライロジック

### リトライユーティリティ

**場所:** `infrastructure/lambda/shared/utils/retry.ts`

### 基本的な使用方法

```typescript
import { retryWithBackoff } from '../../shared/utils/retry';

async function callExternalAPI() {
  const result = await retryWithBackoff(
    // リトライ対象の関数
    () => externalAPICall(),
    {
      maxAttempts: 3,        // 最大3回試行
      initialDelay: 1000,    // 初回リトライ: 1秒待機
      maxDelay: 10000,       // 最大遅延: 10秒
      backoffFactor: 2,      // 指数バックオフ係数
      retryableErrors: [     // リトライ対象エラー
        'timeout',
        'connection',
        'throttl',
      ],
      onRetry: (error, attempt, delay) => {
        console.warn('[API] Retrying:', {
          error: error.message,
          attempt,
          nextRetryIn: delay,
        });
      },
    }
  );

  console.log('[API] Completed:', {
    attempts: result.attempts,
    totalDelay: result.totalDelay,
  });

  return result.result;
}
```

### デフォルトのリトライ可能エラー

**HTTP ステータスコード:**
- 408 (Request Timeout)
- 429 (Too Many Requests)
- 500 (Internal Server Error)
- 502 (Bad Gateway)
- 503 (Service Unavailable)
- 504 (Gateway Timeout)

**エラーパターン:**
- `timeout`
- `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ENETUNREACH`
- `throttl`, `rate limit`, `too many requests`

### API統合例

#### Azure STT API

```typescript
// infrastructure/lambda/shared/audio/stt-azure.ts

async recognizeFromFile(audioFilePath: string): Promise<TranscriptResult> {
  const result = await retryWithBackoff(
    () => this._recognizeFromFileInternal(audioFilePath),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      retryableErrors: [
        'timeout',
        'connection',
        'throttl',
        'rate limit',
        'service unavailable',
      ],
    }
  );

  return result.result;
}
```

#### AWS Bedrock AI API

```typescript
// infrastructure/lambda/shared/ai/bedrock.ts

async generateResponse(options: GenerateResponseOptions): Promise<AIResponse> {
  const result = await retryWithBackoff(
    () => this._generateResponseInternal(options),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      retryableErrors: [
        'ThrottlingException',
        'ServiceUnavailableException',
        'InternalServerException',
        'timeout',
        'connection',
      ],
    }
  );

  return result.result;
}
```

#### ElevenLabs TTS API

```typescript
// infrastructure/lambda/shared/audio/tts-elevenlabs.ts

async generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const result = await retryWithBackoff(
    () => this._generateSpeechInternal(options),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      retryableErrors: [
        'timeout',
        'connection',
        'quota',
        'rate limit',
        '429',
        '503',
      ],
    }
  );

  return result.result;
}
```

### リトライ動作

**例: 3回リトライの場合**

```
試行1: 失敗 → 1秒待機
試行2: 失敗 → 2秒待機 (1秒 * 2^1)
試行3: 成功

総試行回数: 3
総遅延時間: 3秒
```

---

## エラーログ

### 構造化ログ

**場所:** `infrastructure/lambda/shared/utils/error-logger.ts`

### 使用方法

```typescript
import { logError, logWarning, logInfo, createErrorContext } from '../../shared/utils/error-logger';

// Lambda ハンドラー
export const handler = async (event: any) => {
  const context = createErrorContext(event);

  try {
    // 処理
    logInfo('Processing started', { sessionId: 'xxx' }, context);

    const result = await someOperation();

    logInfo('Processing completed', { result }, context);

    return { statusCode: 200 };
  } catch (error) {
    logError('Processing failed', error, {
      ...context,
      sessionId: 'xxx',
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
```

### ログ出力形式

```json
{
  "timestamp": "2026-03-10T22:00:00.000Z",
  "level": "ERROR",
  "message": "Processing failed",
  "error": {
    "name": "Error",
    "message": "Connection timeout",
    "code": "ETIMEDOUT",
    "stack": "Error: Connection timeout\n    at ..."
  },
  "context": {
    "functionName": "prance-websocket-default-dev",
    "requestId": "abc-123",
    "sessionId": "session-456"
  }
}
```

### CloudWatch Logs Insights クエリ

```
# エラー一覧
fields @timestamp, level, message, error.message, context.sessionId
| filter level = "ERROR"
| sort @timestamp desc
| limit 50

# リトライ統計
fields context.attempts, context.totalDelay
| filter message like /completed/
| filter context.attempts > 1
| stats count() as successAfterRetry,
        avg(context.attempts) as avgAttempts,
        avg(context.totalDelay) as avgDelay
```

---

## ベストプラクティス

### 1. リトライ対象の選択

**✅ リトライすべき:**
- ネットワーク一時的エラー（timeout, connection reset）
- サービス一時的障害（500, 502, 503, 504）
- レート制限（429, ThrottlingException）

**❌ リトライすべきでない:**
- 認証エラー（401, 403）
- クライアントエラー（400, 404）
- 検証エラー（ValidationException）

### 2. リトライ設定の調整

**API レスポンス時間に応じて調整:**

| API | 平均応答時間 | 推奨maxAttempts | 推奨initialDelay |
|-----|------------|----------------|-----------------|
| Azure STT | 1-3秒 | 3 | 1000ms |
| AWS Bedrock | 2-5秒 | 3 | 1000ms |
| ElevenLabs TTS | 1-2秒 | 3 | 1000ms |

### 3. エラーメッセージの多言語化

```typescript
// ❌ ハードコード
toast.error('Microphone permission denied');

// ✅ 多言語対応
const { getErrorMessage } = useErrorMessage();
const message = getErrorMessage(error);
toast.error(message);
```

### 4. ユーザーへのフィードバック

```typescript
// ❌ 技術的なエラーメッセージ
toast.error('ECONNRESET: Connection reset by peer');

// ✅ ユーザーフレンドリー
toast.error(t('errors.networkError'), {
  action: {
    label: t('errors.actions.retry'),
    onClick: () => retryOperation(),
  },
});
```

### 5. ログの粒度

```typescript
// 通常時: INFO
logInfo('STT processing started', { audioSize: 12345 });

// 警告: WARN
logWarning('Low audio volume detected', { rms: 0.005 });

// エラー: ERROR
logError('STT processing failed', error, { sessionId: 'xxx' });
```

---

## トラブルシューティング

### リトライが機能しない

**原因:**
- エラーがリトライ対象ではない
- maxAttemptsが1に設定されている

**解決策:**
```typescript
// エラーメッセージを確認
console.log('Error:', error.message, error.code);

// retryableErrorsに追加
retryableErrors: ['CustomErrorPattern']
```

### リトライが多すぎる

**原因:**
- 根本的な問題（APIキー無効、ネットワーク切断）

**解決策:**
1. CloudWatch Logsでエラーパターン確認
2. 非リトライ可能エラーに分類
3. 根本原因を修正

### ログが見つからない

**原因:**
- ログがJSON形式ではない

**解決策:**
```typescript
// ❌ 文字列ログ
console.error('Error:', error);

// ✅ 構造化ログ
logError('Operation failed', error, context);
```

---

## 参考リンク

- [retry.ts実装](/infrastructure/lambda/shared/utils/retry.ts)
- [error-logger.ts実装](/infrastructure/lambda/shared/utils/error-logger.ts)
- [CloudWatch Alerts設定](/docs/08-operations/CLOUDWATCH_ALERTS.md)
- [useErrorMessage Hook](/apps/web/hooks/useErrorMessage.ts)
