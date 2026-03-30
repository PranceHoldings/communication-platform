# E2E Backend Integration Analysis

**作成日:** 2026-03-22
**Phase:** 2準備 - バックエンド統合テスト分析

---

## 失敗の根本原因

### 1. Recording Reliability Tests (5件失敗)

**失敗箇所:**
```typescript
// phase1.6.1-integration.spec.ts: Line 41-44
await page.waitForSelector('[data-testid="recording-status"]', {
  timeout: 30000,
  state: 'visible'
});
// ❌ Timeout: recording-status never becomes visible
```

**根本原因:**

SessionPlayer コンポーネント (line 2123-2160):
```typescript
{(status === 'ACTIVE' || status === 'PAUSED') && (
  <div data-testid="recording-status">
    {/* Recording statistics */}
  </div>
)}
```

`status === 'ACTIVE'` になるには（line 1942-1968）:

```typescript
useEffect(() => {
  if (isConnected && isAuthenticated && status === 'READY') {
    setStatus('ACTIVE');
    // Start recording...
  }
}, [isConnected, isAuthenticated, status]);
```

**必要な3条件:**
1. ✅ `status === 'READY'` - ユーザーがStartボタン押下後
2. ❌ `isConnected === true` - **WebSocket接続完了**
3. ❌ `isAuthenticated === true` - **WebSocket認証完了**

**E2Eテストの現状:**
- ✅ ローカルサーバー（`npm run dev`）起動
- ❌ WebSocketサーバー（AWS IoT Core）未接続
- 結果: `isConnected === false` → ACTIVE遷移せず → `recording-status`非表示

---

### 2. Performance Benchmark Test (1件失敗)

**失敗箇所:**
```typescript
// Line 503-506
await page.waitForSelector('[data-testid="transcript-message"], [data-testid="ai-message"]', {
  timeout: 30000,
  state: 'visible'
});
// ❌ Timeout: No AI messages appear
```

**根本原因:**

AI応答メッセージの生成フロー:
1. ユーザー音声 → STT → テキスト化
2. WebSocket経由でLambda送信 (`message.text` event)
3. Lambda → Bedrock Claude → AI応答生成
4. WebSocket経由でフロントエンド受信 (`ai_response` event)
5. UIに表示 (`<div data-testid="ai-message">`)

**E2Eテストの現状:**
- ❌ WebSocket未接続 → イベント送受信不可
- ❌ Lambda呼び出しなし → AI応答生成なし
- 結果: `ai-message`永遠に表示されない

---

### 3. Session Transcript Tests (推測2件失敗)

**推測される失敗理由:**
- トランスクリプトメッセージもWebSocket経由で送受信
- `transcript-message`の表示にはWebSocket接続が必要
- E2Eテストでは同様の理由で失敗

---

## Phase 2の選択肢

### Option A: WebSocketモック実装 🟡

**アプローチ:**
- Playwright でWebSocketをモック/インターセプト
- メッセージ（`session_started`, `chunk_ack`, `ai_response`等）をシミュレート
- バックエンドなしでフロントエンドのロジックをテスト

**実装例:**
```typescript
// E2Eテスト内でWebSocketをモック
await page.route('wss://**', route => {
  // WebSocketメッセージをシミュレート
  mockWebSocket.send(JSON.stringify({
    type: 'session_started',
    payload: { sessionId: 'test-session' }
  }));

  mockWebSocket.send(JSON.stringify({
    type: 'chunk_ack',
    payload: { chunkType: 'audio', chunkIndex: 1 }
  }));

  // ...
});
```

**利点:**
- ✅ 高速実行（ネットワーク遅延なし）
- ✅ 安定（外部依存なし）
- ✅ コスト不要（AWSリソース不要）
- ✅ オフライン開発可能

**欠点:**
- ❌ 実際のバックエンドとの統合は検証できない
- ❌ WebSocketプロトコルの互換性検証不可
- ❌ Lambda関数のビジネスロジック検証不可
- ❌ 実装コスト（Mock機能の構築）

**推奨ケース:**
- フロントエンドのUI/UXロジックに集中したい場合
- バックエンド開発中で統合環境がまだ不安定な場合
- CI/CD での高速テスト実行が必要な場合

---

### Option B: Dev環境統合テスト 🟢

**アプローチ:**
- AWS IoT Core（Dev環境）に実際に接続
- 実際のLambda関数（WebSocket/REST API）を呼び出し
- 実際のメッセージフローをテスト

**前提条件:**
1. AWS IoT Core (Dev) が起動・設定済み
2. Lambda関数（WebSocket Handler）がデプロイ済み
3. AWS認証情報（Cognito Token）がテスト環境で取得可能

**実装例:**
```typescript
// テスト環境変数
process.env.AWS_IOT_ENDPOINT = 'a1b2c3d4e5f6g7-ats.iot.us-east-1.amazonaws.com';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_XXXXXX';
process.env.COGNITO_CLIENT_ID = 'xxxxxxxxxxxxxxxxxxxx';

// E2Eテスト - 実際のWebSocket接続
await page.goto('/dashboard/sessions/new');
// ... (シナリオ選択、アバター選択)
await page.click('button:has-text("Create")');

// 実際のWebSocket接続が確立される
await page.waitForSelector('[data-testid="recording-status"]', { timeout: 30000 });
// ✅ 成功: 実際のバックエンドが応答
```

**利点:**
- ✅ **本物の統合テスト** - フロントエンド + バックエンドの統合検証
- ✅ 実環境と同じフロー - Production環境の問題を早期発見
- ✅ Lambda関数のビジネスロジック検証
- ✅ WebSocketプロトコルの互換性検証

**欠点:**
- ❌ 遅い（ネットワーク遅延、Lambda Cold Start）
- ❌ AWSリソース必要（コスト、権限管理）
- ❌ 環境依存（Dev環境が不安定だと失敗）
- ❌ オフライン開発不可

**推奨ケース:**
- Production環境へのデプロイ前の最終検証
- バックエンド統合に関する問題のデバッグ
- システム全体のE2Eテスト（Stage 3-5相当）

---

### Option C: テスト分離（ハイブリッド） 🔵 **推奨**

**アプローチ:**
- **Unit/Integration Tests (Mock):** Option A - 高速、安定、オフライン開発
- **System E2E Tests (実統合):** Option B - 本物の統合検証
- テストピラミッドに従った階層的テスト戦略

**テスト構成:**

```
apps/web/tests/e2e/
├── unit/                       # Mock WebSocket (高速)
│   ├── session-player-ui.spec.ts
│   ├── recording-status.spec.ts
│   └── transcript-display.spec.ts
├── integration/                # Mock WebSocket (中速)
│   ├── session-flow.spec.ts
│   ├── scenario-validation.spec.ts
│   └── avatar-selection.spec.ts
└── system/                     # Real Backend (低速)
    ├── full-session-e2e.spec.ts
    ├── recording-reliability.spec.ts
    └── performance-benchmark.spec.ts
```

**実行戦略:**
```bash
# 開発中 - Mock使用（高速、毎回実行）
npm run test:e2e:mock

# Pull Request - Mock + Dev統合（中速、PR時実行）
npm run test:e2e:integration

# Deployment - 全テスト（低速、Deploy前のみ）
npm run test:e2e:full
```

**利点:**
- ✅ 両方のメリット - 高速開発 + 統合検証
- ✅ テストピラミッド準拠 - 適切なテスト配分
- ✅ CI/CDフレンドリー - 段階的実行
- ✅ 開発効率向上 - オフライン開発可能

**欠点:**
- ❌ 実装コスト高い（Mock + 実統合の両方）
- ❌ メンテナンスコスト（2つのテストセット管理）

**推奨ケース:**
- 長期的なプロジェクト開発
- チーム開発（複数開発者）
- CI/CD パイプラインが整備されている場合

---

## 推奨アプローチ

### Phase 2.1: Mock実装（短期） - 2-3日

**目的:** フロントエンドロジックの検証、開発効率向上

**実装内容:**
1. WebSocketモック関数作成 (`apps/web/tests/e2e/mocks/websocket-mock.ts`)
2. Phase 1失敗テストをMock版に書き換え（5件）
3. Mock使用テストを `test:e2e:mock` として分離

**期待効果:**
- ✅ E2E成功率: 25% → 60-70%（録画関連テスト通過）
- ✅ 実行速度: 2-3分 → 1分以下
- ✅ オフライン開発可能

---

### Phase 2.2: 統合テスト実装（中期） - 1週間

**目的:** 本物の統合検証、Production環境への自信

**前提条件:**
1. Dev環境のWebSocketサーバーが安定稼働
2. Lambda関数が正常動作
3. テスト用Cognito認証情報が準備済み

**実装内容:**
1. AWS接続ユーティリティ (`apps/web/tests/e2e/utils/aws-connection.ts`)
2. Phase 1失敗テストを実統合版に書き換え（5件）
3. 統合テストを `test:e2e:integration` として分離

**期待効果:**
- ✅ E2E成功率: 60-70% → 90-95%（実バックエンド検証）
- ✅ Production問題の早期発見
- ✅ デプロイ前の自信向上

---

### Phase 2.3: CI/CD統合（長期） - 2-3日

**目的:** 自動化、継続的品質保証

**実装内容:**
1. GitHub Actions ワークフロー作成
2. Mock Tests: PRごとに実行（5分以内）
3. Integration Tests: main branchマージ時実行（15分以内）
4. System Tests: デプロイ前に実行（30分以内）

**期待効果:**
- ✅ 自動品質ゲート
- ✅ リグレッション防止
- ✅ チーム開発の生産性向上

---

## 次のアクション

### 推奨: Phase 2.1（Mock実装）から開始

**理由:**
1. **即時価値** - 現在失敗中の5テストを短期間で修正可能
2. **低リスク** - AWS環境への依存なし
3. **高速開発** - オフライン開発、即座フィードバック
4. **段階的実装** - Phase 2.2への自然な移行パス

**初回実装ターゲット:**
- ✅ should track chunk ACKs during recording
- ✅ should display recording statistics in real-time (Day 34)

これら2テストをMock版に書き換えて、成功確認後に残り3テストを実装。

---

## 技術的詳細

### WebSocket Mock実装例

```typescript
// apps/web/tests/e2e/mocks/websocket-mock.ts
export class MockWebSocketServer {
  private messages: Map<string, (data: any) => void> = new Map();

  constructor(private page: Page) {}

  async setup() {
    // Intercept WebSocket creation
    await this.page.addInitScript(() => {
      const OriginalWebSocket = (window as any).WebSocket;
      (window as any).WebSocket = class MockWebSocket {
        constructor(url: string) {
          console.log('[MockWebSocket] Created:', url);
          // Store instance for later message injection
          (window as any).__mockWS = this;
        }

        send(data: string) {
          console.log('[MockWebSocket] Sent:', data);
          const parsed = JSON.parse(data);
          // Simulate server response
          setTimeout(() => {
            if (parsed.type === 'message.text') {
              this.onmessage?.({ data: JSON.stringify({
                type: 'ai_response',
                payload: { text: 'Mock AI response' }
              })});
            }
          }, 100);
        }

        addEventListener(event: string, handler: Function) {
          if (event === 'message') {
            this.onmessage = handler;
          }
        }

        onmessage: Function | null = null;
      };
    });
  }

  async simulateSessionStart() {
    await this.page.evaluate(() => {
      (window as any).__mockWS?.onmessage?.({ data: JSON.stringify({
        type: 'session_started',
        payload: { sessionId: 'test-session' }
      })});
    });
  }

  async simulateChunkAck(chunkType: 'audio' | 'video', chunkIndex: number) {
    await this.page.evaluate((args) => {
      (window as any).__mockWS?.onmessage?.({ data: JSON.stringify({
        type: 'chunk_ack',
        payload: args
      })});
    }, { chunkType, chunkIndex });
  }

  async simulateAIResponse(text: string) {
    await this.page.evaluate((aiText) => {
      (window as any).__mockWS?.onmessage?.({ data: JSON.stringify({
        type: 'ai_response',
        payload: { text: aiText }
      })});
    }, text);
  }
}
```

### Mock使用テスト例

```typescript
// apps/web/tests/e2e/mock/recording-reliability.spec.ts
import { test, expect } from '@playwright/test';
import { MockWebSocketServer } from '../mocks/websocket-mock';
import { LoginPage } from '../page-objects/login-page';
import { NewSessionPage } from '../page-objects/new-session-page';

test.describe('Recording Reliability (Mock)', () => {
  let mockWS: MockWebSocketServer;

  test.beforeEach(async ({ page }) => {
    // Setup WebSocket mock
    mockWS = new MockWebSocketServer(page);
    await mockWS.setup();

    // Login
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(
      process.env.TEST_USER_EMAIL || 'admin@prance.com',
      process.env.TEST_USER_PASSWORD || 'Admin2026!Prance'
    );
  });

  test('should track chunk ACKs during recording', async ({ page }) => {
    // Navigate to session
    const newSessionPage = new NewSessionPage(page);
    await newSessionPage.goto();
    await newSessionPage.selectScenario(0);
    await newSessionPage.clickNext();
    await newSessionPage.selectAvatar(0);
    await newSessionPage.clickNext();

    // Start session
    await page.click('button:has-text("Create"), button:has-text("作成")');
    await page.waitForURL('**/dashboard/sessions/**', { timeout: 30000 });

    // Wait for Start button to appear (status: IDLE → READY)
    await page.waitForSelector('button:has-text("Start"), button:has-text("開始")');
    await page.click('button:has-text("Start"), button:has-text("開始")');

    // Simulate WebSocket messages
    await mockWS.simulateSessionStart();

    // Wait for recording status to appear (status: READY → ACTIVE)
    await page.waitForSelector('[data-testid="recording-status"]', { timeout: 5000 });
    const recordingStatus = await page.locator('[data-testid="recording-status"]');
    await expect(recordingStatus).toBeVisible();

    // Verify initial stats (0/0)
    await expect(recordingStatus).toContainText('Audio:');
    await expect(recordingStatus).toContainText('Video:');

    // Simulate chunk ACKs
    for (let i = 1; i <= 5; i++) {
      await mockWS.simulateChunkAck('audio', i);
      await page.waitForTimeout(100); // Allow UI to update
    }

    for (let i = 1; i <= 3; i++) {
      await mockWS.simulateChunkAck('video', i);
      await page.waitForTimeout(100);
    }

    // Verify stats updated
    const audioStats = await recordingStatus.locator('text=/Audio:.*\\d+\\/\\d+/');
    const videoStats = await recordingStatus.locator('text=/Video:.*\\d+\\/\\d+/');

    const audioText = await audioStats.textContent();
    const videoText = await videoStats.textContent();

    console.log('[Recording Stats]', { audio: audioText, video: videoText });

    // Verify non-zero chunks
    expect(audioText).toMatch(/Audio:.*[1-9]\d*\/\d+/); // Audio: X/Y where X > 0
    expect(videoText).toMatch(/Video:.*[1-9]\d*\/\d+/); // Video: X/Y where X > 0

    // Stop session
    await page.click('[data-testid="stop-button"]');
  });
});
```

---

**次回更新予定:** Phase 2.1実装開始時
