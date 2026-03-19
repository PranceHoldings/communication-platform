# エラーハンドリング統合ガイド

**Phase 1.6: エラーハンドリング強化**

## 概要

このガイドでは、新しいエラーハンドリングコンポーネント（`ConnectionStatus` と `ErrorGuidance`）をSessionPlayerに統合する方法を説明します。

## コンポーネント

### 1. ConnectionStatus

WebSocket接続状態をビジュアル表示するコンポーネント。

**機能:**
- 5つの接続状態（disconnected, connecting, connected, reconnecting, error）
- 自動的に表示/非表示（connectedは3秒後に自動で非表示）
- 再接続試行のプログレスインジケーター
- 多言語対応

**使用方法:**

```tsx
import { ConnectionStatus, useConnectionState } from '@/components/error-handling';
import { useWebSocket } from '@/hooks/useWebSocket';

function SessionPlayer() {
  const { isConnected, isConnecting, error } = useWebSocket({...});

  const { connectionState, reconnectAttempt, maxReconnectAttempts } = useConnectionState({
    isConnected,
    isConnecting,
    error,
  });

  return (
    <div>
      <ConnectionStatus
        state={connectionState}
        error={error}
        reconnectAttempt={reconnectAttempt}
        maxReconnectAttempts={maxReconnectAttempts}
      />
      {/* Rest of component */}
    </div>
  );
}
```

### 2. ErrorGuidance

エラーの種類に応じた詳細なガイダンスを表示するコンポーネント。

**機能:**
- 6つのエラーカテゴリ（microphone, websocket, audio, api, session, network）
- カテゴリ別のアイコン・カラー・メッセージ
- マイクエラー時のブラウザ別指示
- 再試行・閉じるボタン
- エラー詳細の表示/非表示
- 多言語対応

**使用方法:**

```tsx
import { ErrorGuidance } from '@/components/error-handling';

function SessionPlayer() {
  const [error, setError] = useState<ErrorDetails | null>(null);

  const handleError = (errorMessage: ErrorMessage) => {
    setError({
      code: errorMessage.code,
      message: errorMessage.message,
      originalError: errorMessage.details,
    });
  };

  const handleRetry = () => {
    // Retry logic
    setError(null);
    connect();
  };

  return (
    <div>
      {error && (
        <ErrorGuidance
          error={error}
          onRetry={handleRetry}
          onDismiss={() => setError(null)}
          showDetails={true}
        />
      )}
      {/* Rest of component */}
    </div>
  );
}
```

## SessionPlayerへの統合

### Step 1: インポート追加

```tsx
import {
  ConnectionStatus,
  ErrorGuidance,
  useConnectionState,
  type ErrorCategory
} from '@/components/error-handling';
import type { ErrorDetails } from '@/hooks/useErrorMessage';
```

### Step 2: ステート管理

```tsx
// エラー状態（既存のerrorMessageステートを置き換え）
const [currentError, setCurrentError] = useState<ErrorDetails | null>(null);

// 接続状態（useWebSocketの返り値を使用）
const { connectionState, reconnectAttempt, maxReconnectAttempts } = useConnectionState({
  isConnected,
  isConnecting,
  error,
});
```

### Step 3: エラーハンドラー更新

```tsx
const handleError = useCallback((message: ErrorMessage) => {
  console.error('[SessionPlayer] Error received:', message);

  // ErrorGuidanceで使用する形式に変換
  setCurrentError({
    code: message.code || 'UNKNOWN_ERROR',
    message: message.message || 'An unknown error occurred',
    originalError: message.details ? JSON.stringify(message.details, null, 2) : undefined,
  });

  // Toast通知（オプション）
  toast.error(getErrorMessage(message));
}, [getErrorMessage]);
```

### Step 4: レンダリング

```tsx
return (
  <div className="relative h-full">
    {/* 接続状態表示（画面右上） */}
    <ConnectionStatus
      state={connectionState}
      error={error}
      reconnectAttempt={reconnectAttempt}
      maxReconnectAttempts={maxReconnectAttempts}
    />

    {/* エラーガイダンス（画面中央または下部） */}
    {currentError && (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-md px-4">
        <ErrorGuidance
          error={currentError}
          onRetry={() => {
            setCurrentError(null);
            connect();
          }}
          onDismiss={() => setCurrentError(null)}
          showDetails={true}
        />
      </div>
    )}

    {/* 既存のUI */}
    <VideoComposer ... />
    {/* ... */}
  </div>
);
```

## 翻訳キー

### 必要な翻訳キー（既に追加済み）

**`messages/en/common.json` および `messages/ja/common.json`:**
```json
{
  "connectionStatus": {
    "disconnected": "Disconnected / 未接続",
    "connecting": "Connecting... / 接続中...",
    "connected": "Connected / 接続済み",
    "reconnecting": "Reconnecting... ({attempt}/{maxAttempts}) / 再接続中... ({attempt}/{maxAttempts})",
    "error": "Connection Error / 接続エラー"
  }
}
```

**`messages/en/errors.json` および `messages/ja/errors.json`:**
```json
{
  "microphone": {
    "title": "Microphone Error / マイクエラー",
    "permissionDenied": "...",
    "instructions": {
      "chrome": "...",
      "firefox": "...",
      "safari": "...",
      "edge": "..."
    }
  },
  "websocket": {
    "title": "Connection Error / 接続エラー",
    "connectionFailed": "...",
    "connectionLost": "...",
    "reconnecting": "...",
    "reconnectFailed": "...",
    "authenticationFailed": "...",
    "timeout": "..."
  },
  "audio": {...},
  "api": {...},
  "session": {...},
  "actions": {
    "retry": "Retry / 再試行",
    "dismiss": "Dismiss / 閉じる",
    "viewDetails": "View Details / 詳細を表示"
  }
}
```

## テスト

### 手動テスト

1. **接続状態テスト:**
   - セッション開始時に「Connecting...」が表示されること
   - 接続完了後に「Connected」が3秒間表示され、自動的に消えること
   - ネットワーク切断時に「Reconnecting...」が表示されること
   - 再接続失敗時に「Connection Error」が表示されること

2. **エラーガイダンステスト:**
   - マイク権限拒否時に、ブラウザ別の指示が表示されること
   - WebSocket接続エラー時に、適切なエラーメッセージが表示されること
   - 再試行ボタンクリック時に、正しく再接続が試行されること
   - 閉じるボタンクリック時に、エラーガイダンスが非表示になること

### E2Eテスト

```typescript
// tests/e2e/session-player-error-handling.spec.ts
test('shows connection status during session', async ({ page }) => {
  await page.goto('/dashboard/sessions/new');

  // Start session
  await page.click('[data-testid="start-session"]');

  // Wait for connecting status
  await expect(page.locator('[role="status"]')).toContainText('Connecting');

  // Wait for connected status
  await expect(page.locator('[role="status"]')).toContainText('Connected');

  // Should auto-hide after 3 seconds
  await page.waitForTimeout(4000);
  await expect(page.locator('[role="status"]')).not.toBeVisible();
});

test('shows error guidance on microphone permission denied', async ({ page, context }) => {
  // Deny microphone permission
  await context.grantPermissions([], { permissions: ['microphone'] });

  await page.goto('/dashboard/sessions/new');
  await page.click('[data-testid="start-session"]');

  // Should show microphone error guidance
  await expect(page.locator('text=Microphone Error')).toBeVisible();
  await expect(page.locator('text=マイクへのアクセスが拒否されました')).toBeVisible();

  // Should show browser-specific instructions
  await expect(page.locator('text=Chrome')).toBeVisible();

  // Should have retry button
  await expect(page.locator('button:has-text("Retry")')).toBeVisible();
});
```

## ベストプラクティス

1. **ConnectionStatusは常に表示する:** セッション中は常にConnectionStatusを表示し、ユーザーに接続状態を可視化します。

2. **ErrorGuidanceは致命的なエラーのみ:** 重要でないエラーはToast通知のみで、致命的なエラー（マイク権限拒否、接続失敗など）はErrorGuidanceで詳細に表示します。

3. **再試行ロジックの実装:** ErrorGuidanceの再試行ボタンは、実際に問題を解決できる場合にのみ表示します（例：マイク権限は再試行で解決できない）。

4. **エラーの自動回復:** 可能な限り自動回復を試み、ユーザーの操作を最小限に抑えます（WebSocket再接続など）。

5. **アクセシビリティ:** `role="status"` と `aria-live="polite"` を使用して、スクリーンリーダーに対応します。

## 今後の拡張

- **エラー履歴:** 複数のエラーを履歴として表示
- **エラー統計:** セッション中のエラー発生回数を記録
- **カスタムエラーアクション:** エラーごとに異なるアクションボタンを表示
- **エラー通知の設定:** ユーザーが通知レベルをカスタマイズ可能に

---

**作成日:** 2026-03-20
**Phase:** 1.6 - エラーハンドリング強化
