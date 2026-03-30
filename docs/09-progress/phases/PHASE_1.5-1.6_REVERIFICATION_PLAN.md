# Phase 1.5-1.6 再検証計画

**作成日:** 2026-03-20
**開始日:** 2026-03-20 (Day 30)
**推定期間:** 1-2日
**優先度:** P0（最優先）
**ステータス:** 🔴 進行中

---

## 📋 目次

1. [背景・問題認識](#背景問題認識)
2. [検証目標](#検証目標)
3. [検証手順](#検証手順)
4. [想定される問題と修正](#想定される問題と修正)
5. [完了条件](#完了条件)
6. [参考資料](#参考資料)

---

## 背景・問題認識

### 発見された矛盾

**START_HERE.mdの記載:**
```
E2Eテスト: 35/35 (100%) ✅ - 全カテゴリー成功
```

**実際のテスト結果（2026-03-20）:**
```
63/73 失敗（86%失敗率）
原因: Next.js開発サーバー未起動
```

**Day 28 (2026-03-19) の記録:**
```
E2Eテスト: 21/50 (42%)
- Stage 1: 10/10 ✅
- Stage 2: 0/10 ❌
- Stage 3: 0/10 ❌
- Stage 4: 10/10 ✅
- Stage 5: 1/10 (9スキップ)

根本原因:
- セッション実行機能が未実装または動作していない
- WebSocket通信、AI会話、リアルタイム録画の統合が不完全
```

### Phase 1の完成度に関する疑問

**Phase 1の主張:**
- ✅ Phase 1-1.5: MVP・リアルタイム会話（100%完了）
- ✅ Phase 1.6: 実用レベル化（100%完了）

**実際の状況:**
- ⚠️ E2E Stage 2-3: 0/20 失敗
- ⚠️ セッションステータス遷移が動作していない
- ⚠️ WebSocket接続が確立されない可能性

### 検証の必要性

Phase 4（ベンチマークシステム）を完了しましたが、Phase 1（MVP基盤）が不完全である可能性があります。
**基盤が不完全なまま上位機能を積み上げても、信頼性の高いシステムは構築できません。**

---

## 検証目標

### 主要目標

1. **E2Eテスト全Stage成功（73/73）**
   - Stage 0-5の全テストが通ること
   - 開発サーバー起動済みの状態で実行

2. **セッション実行機能の完全動作確認**
   - セッション開始ボタンクリック → ステータス遷移
   - WebSocket接続確立
   - AI会話パイプライン（STT → AI → TTS）

3. **Phase 1の真の完成度を確認**
   - 「技術的に動く」レベルなのか
   - 「実用レベル」なのか
   - 未実装部分の洗い出し

### 副次目標

- ドキュメントの信頼性回復
- 今後の開発方針の明確化
- CI/CD パイプラインへのE2Eテスト統合検討

---

## 検証手順

### Phase 1: 環境準備（10分）

#### 1.1 開発サーバー起動

```bash
cd /workspaces/prance-communication-platform
npm run dev
```

**期待される出力:**
```
✓ Ready in 5s
○ Compiling / ...
✓ Compiled in 2s
```

#### 1.2 サーバー起動確認

```bash
# 別ターミナルで実行
curl http://localhost:3000/

# 期待: HTTP 200 OK
```

#### 1.3 ブラウザ動作確認

```
1. http://localhost:3000 にアクセス
2. ログインページが表示されること
3. テストユーザーでログイン
   - Email: test@example.com
   - Password: Test1234!
4. ダッシュボードが表示されること
```

---

### Phase 2: E2Eテスト実行（20分）

#### 2.1 全Stage実行

```bash
cd apps/web
npm run test:e2e
```

#### 2.2 結果記録

**テンプレート:**
```markdown
## E2Eテスト結果 (YYYY-MM-DD HH:MM UTC)

### 総合結果
- 成功: XX/73
- 失敗: XX/73
- スキップ: XX/73

### カテゴリ別結果

#### Stage 0: Smoke Tests
- S0-001 Home page loads: [✅/❌]
- S0-002 Login page is accessible: [✅/❌]
- S0-003 Register page is accessible: [✅/❌]
- S0-004 Dashboard redirects to login: [✅/❌]
- S0-005 Test IDs are present: [✅/❌]
- **成功率: X/5**

#### Stage 1: Basic UI Flow
- S1-001 Navigate to session list: [✅/❌]
- S1-002 Navigate to session player: [✅/❌]
- ... (全10項目)
- **成功率: X/10**

#### Stage 2: Mocked Integration
- S2-001 Initial greeting and silence timer: [✅/❌]
- S2-002 User speech → AI response cycle: [✅/❌]
- ... (全10項目)
- **成功率: X/10**
- **🔴 重点確認項目**

#### Stage 3: Full E2E
- S3-001 Real WebSocket connection: [✅/❌]
- S3-002 Initial greeting from backend: [✅/❌]
- ... (全10項目)
- **成功率: X/10**
- **🔴 重点確認項目**

#### Stage 4: Recording Function
- S4-001 Recording player loads: [✅/❌]
- ... (全10項目)
- **成功率: X/10**

#### Stage 5: Analysis & Report
- S5-001 Analysis trigger button: [✅/❌]
- ... (全10項目)
- **成功率: X/10**
```

---

### Phase 3: 問題の特定（30-60分）

#### 3.1 Stage 2-3が失敗する場合

**Step 1: WebSocket接続確認**

```bash
# ブラウザ開発者ツール（F12）
# 1. Network タブ → WS フィルタ
# 2. セッション開始ボタンをクリック
# 3. WebSocket接続が表示されるか確認

期待される表示:
- Name: ws://localhost:3000/_next/webpack-hmr (Next.js HMR)
- Name: wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev (WebSocket API)
- Status: 101 Switching Protocols
```

**WebSocket接続が確立されない場合:**
```bash
# Lambda関数ログ確認
aws logs tail /aws/lambda/prance-websocket-connect-dev --follow

# 期待されるログ:
# "WebSocket connection established: connectionId=XXXX"
```

**Step 2: セッション状態遷移確認**

```typescript
// apps/web/components/sessions/SessionPlayer.tsx
// useSessionState フックのログを確認

console.log('Session status:', sessionStatus);
// 期待される遷移:
// 'IDLE' → 'READY' → 'IN_PROGRESS' → 'COMPLETED'
```

**Step 3: Lambda関数実行確認**

```bash
# WebSocket default Lambda
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --since 5m

# 期待されるログ:
# "Message received: {"action": "startSession", "sessionId": "..."}"
# "STT processing started"
# "AI response generated: ..."
# "TTS audio sent: X bytes"
```

**Step 4: フロントエンドエラー確認**

```bash
# ブラウザ開発者ツール（F12）→ Console
# エラーメッセージ、警告を確認

期待される動作:
- エラーがない、または
- ハンドリングされたエラー（リトライ処理など）
```

#### 3.2 Stage 4-5が失敗する場合

**録画機能の確認:**
```bash
# S3に録画ファイルが保存されているか
aws s3 ls s3://prance-recordings-dev/ --recursive | grep ".webm"

# 期待: session-XXXX/recording.webm が存在
```

**解析機能の確認:**
```bash
# RDS に解析データが保存されているか
npx prisma studio

# Analysis テーブルを確認
# sessionId に対応する分析結果が存在するか
```

---

### Phase 4: 修正実施（状況に応じて）

#### 問題A: WebSocket接続が確立されない

**原因仮説:**
1. 認証トークンが正しく送信されていない
2. AWS IoT Core の接続設定が誤っている
3. CORS設定が不適切

**修正箇所:**
```typescript
// apps/web/lib/websocket/client.ts

// 修正前
const ws = new WebSocket(WS_URL);

// 修正後
const token = localStorage.getItem('accessToken');
const ws = new WebSocket(`${WS_URL}?token=${token}`);
```

**検証:**
```bash
# ブラウザコンソールで確認
console.log('WebSocket URL:', ws.url);
# 期待: wss://...amazonaws.com/dev?token=eyJhbGciOi...
```

#### 問題B: セッションステータスが遷移しない

**原因仮説:**
1. DynamoDB更新が失敗している
2. Lambda関数のIAM権限不足
3. セッションIDが正しく渡されていない

**修正箇所:**
```typescript
// infrastructure/lambda/websocket/default/index.ts

async function updateSessionStatus(
  sessionId: string,
  status: 'READY' | 'IN_PROGRESS' | 'COMPLETED'
): Promise<void> {
  console.log(`Updating session ${sessionId} to ${status}`); // ログ追加

  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: SESSION_TABLE,
      Key: { id: { S: sessionId } },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': { S: status },
        ':now': { S: new Date().toISOString() },
      },
    })
  );

  console.log(`Session ${sessionId} updated successfully`); // ログ追加
}
```

**検証:**
```bash
# Lambda関数ログ確認
aws logs tail /aws/lambda/prance-websocket-default-dev --follow

# 期待されるログ:
# "Updating session XXX to IN_PROGRESS"
# "Session XXX updated successfully"
```

#### 問題C: AI応答が返ってこない

**原因仮説:**
1. Bedrock API呼び出しエラー
2. ストリーミングレスポンスの処理が不完全
3. タイムアウト設定が短すぎる

**修正箇所:**
```typescript
// infrastructure/lambda/shared/ai/bedrock-claude.ts

try {
  const response = await bedrockClient.send(
    new InvokeModelWithResponseStreamCommand({
      modelId: MODEL_ID,
      body: JSON.stringify(requestBody),
    })
  );

  // ストリーミング処理
  if (response.body) {
    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const text = new TextDecoder().decode(chunk.chunk.bytes);
        console.log('AI chunk received:', text); // ログ追加
        // ... 処理
      }
    }
  }
} catch (error) {
  console.error('Bedrock API error:', error); // ログ追加
  throw error;
}
```

**検証:**
```bash
# Lambda関数ログ確認
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --filter-pattern "AI"

# 期待されるログ:
# "AI chunk received: {"type":"content_block_delta","delta":{"type":"text","text":"Hello"}}"
```

---

### Phase 5: 再テストと記録（20分）

#### 5.1 修正後の再テスト

```bash
# 修正後、再度E2Eテスト実行
npm run test:e2e

# 結果をスクリーンショット・テキストで保存
# playwright-report/ ディレクトリに自動保存される
```

#### 5.2 結果の比較

| 項目 | Before | After | 改善 |
|------|--------|-------|------|
| 総合成功率 | 21/50 (42%) | XX/73 | +XX% |
| Stage 0 | ?/5 | X/5 | +X |
| Stage 1 | 10/10 | X/10 | - |
| Stage 2 | 0/10 | X/10 | +X |
| Stage 3 | 0/10 | X/10 | +X |
| Stage 4 | 10/10 | X/10 | - |
| Stage 5 | 1/10 | X/10 | +X |

#### 5.3 未解決の問題の記録

```markdown
## 未解決の問題

### Issue #X: [タイトル]
- **影響:** Stage X, テストY
- **原因:** [推定原因]
- **回避策:** [一時的な回避策]
- **根本解決:** [次のステップ]
```

---

### Phase 6: ドキュメント更新（10分）

#### 6.1 START_HERE.md更新

```markdown
**E2Eテスト:** XX/73 (YY%)
- Stage 0: X/5
- Stage 1: X/10
- Stage 2: X/10 (改善: 0→X)
- Stage 3: X/10 (改善: 0→X)
- Stage 4: X/10
- Stage 5: X/10
```

#### 6.2 SESSION_HISTORY.md更新

```markdown
## 🔄 Day 30: Phase 1.5-1.6 再検証完了（2026-03-20）

### セッション概要
- **実施内容:** E2E全Stage検証、問題修正
- **所要時間:** X時間
- **状態:** [完了/一部改善/継続調査]

### 検証結果
- 総合成功率: XX/73 (YY%)
- 改善項目: Stage 2-3で+X成功

### 修正内容
1. [修正項目1]
2. [修正項目2]

### 次のステップ
- [次に取り組む内容]
```

#### 6.3 KNOWN_ISSUES.md更新

```markdown
### Issue #5: E2Eテスト大量失敗 & START_HERE.mdの誤った記載

**状態:** ✅ 解決済み / 🔄 一部改善 / 🔴 継続調査

**修正内容:**
- [修正項目1]
- [修正項目2]

**残存する問題:**
- [未解決の問題]
```

---

## 想定される問題と修正

### 問題カテゴリ1: WebSocket通信

#### 問題1-1: WebSocket接続が確立されない

**症状:**
- セッション開始ボタンをクリックしても反応なし
- ブラウザコンソールに「WebSocket connection failed」

**原因:**
- 認証トークンが正しく送信されていない
- WebSocket URLが誤っている
- Lambda Connect Handlerのエラー

**修正:**
```typescript
// apps/web/lib/websocket/client.ts
const token = localStorage.getItem('accessToken');
if (!token) {
  throw new Error('No access token found');
}

const ws = new WebSocket(`${WS_URL}?token=${token}`);
```

#### 問題1-2: WebSocket接続が途中で切断される

**症状:**
- 接続後、数秒で切断される
- 「WebSocket disconnected」エラー

**原因:**
- Pingが送信されていない（30秒でタイムアウト）
- Lambda関数がエラーで終了している

**修正:**
```typescript
// apps/web/lib/websocket/client.ts
const pingInterval = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'ping' }));
  }
}, 20000); // 20秒ごとにping
```

---

### 問題カテゴリ2: セッション状態管理

#### 問題2-1: セッションステータスが更新されない

**症状:**
- セッション開始後も「READY」のまま
- UIが「IN_PROGRESS」に遷移しない

**原因:**
- DynamoDB更新が失敗している
- IAM権限不足
- セッションIDが正しく渡されていない

**修正:**
```typescript
// infrastructure/lambda/websocket/default/index.ts
// IAM権限確認
// Lambda実行ロールに dynamodb:UpdateItem 権限が必要

// ログ追加で問題特定
console.log('Updating session:', { sessionId, status });
await updateSessionStatus(sessionId, status);
console.log('Session updated successfully');
```

---

### 問題カテゴリ3: AI会話パイプライン

#### 問題3-1: STT（文字起こし）が動作しない

**症状:**
- 音声入力後、文字起こし結果が表示されない
- 「Transcribing...」のまま

**原因:**
- Azure STTのAPIキーが無効
- 音声データ形式が不正
- Lambda関数のタイムアウト

**修正:**
```bash
# 環境変数確認
echo $AZURE_SPEECH_API_KEY
# 値が正しいか確認

# Lambda関数タイムアウト延長
# infrastructure/lib/api-lambda-stack.ts
timeout: Duration.seconds(60), // 30秒 → 60秒
```

#### 問題3-2: AI応答が生成されない

**症状:**
- 文字起こし後、AI応答が返ってこない
- 「Generating response...」のまま

**原因:**
- Bedrock APIのモデルIDが誤っている
- リクエストボディの形式が不正
- Bedrock APIのクォータ超過

**修正:**
```typescript
// infrastructure/lambda/shared/ai/bedrock-claude.ts
const MODEL_ID = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'; // 正しいモデルID

// エラーハンドリング追加
try {
  const response = await bedrockClient.send(command);
} catch (error) {
  if (error.name === 'ThrottlingException') {
    console.error('Bedrock API quota exceeded');
    // リトライロジック
  }
  throw error;
}
```

#### 問題3-3: TTS（音声合成）が動作しない

**症状:**
- AI応答テキストは表示されるが、音声が再生されない
- 「Generating speech...」のまま

**原因:**
- ElevenLabs APIキーが無効
- 音声データの形式が不正
- ブラウザの音声再生権限

**修正:**
```typescript
// infrastructure/lambda/shared/audio/tts-elevenlabs.ts
// ストリーミングAPIエンドポイント確認
const url = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`;

// ブラウザ側でユーザー操作後に再生
// apps/web/components/sessions/SessionPlayer.tsx
const handleStartSession = async () => {
  // AudioContext初期化（ユーザー操作が必要）
  const audioContext = new AudioContext();
  await audioContext.resume();
};
```

---

### 問題カテゴリ4: E2Eテスト環境

#### 問題4-1: テストデータが不足している

**症状:**
- Stage 4-5で「No recording found」
- Stage 5で「Analysis not available」

**原因:**
- テストセッションが完了していない
- テストデータベースが初期化されていない

**修正:**
```bash
# テストフィクスチャ作成
# apps/web/tests/e2e/fixtures/test-data.ts
export async function createCompletedSession() {
  // 完了済みセッションを作成
  // - sessionStatus: 'COMPLETED'
  // - recordingUrl: 's3://...'
  // - analysisId: 'analysis-...'
}
```

#### 問題4-2: テストが不安定（Flaky Tests）

**症状:**
- 同じテストが成功したり失敗したりする
- タイミング依存のエラー

**原因:**
- wait処理が不十分
- WebSocket接続の非同期処理
- アニメーション待機

**修正:**
```typescript
// apps/web/tests/e2e/stage2-mocked-integration.spec.ts
// タイムアウト延長
test('S2-001: Initial greeting', async ({ page }) => {
  await page.goto('/sessions/test-session-id');

  // waitForSelector with timeout
  await page.waitForSelector('[data-testid="ai-message"]', {
    timeout: 10000, // 5秒 → 10秒
  });

  // networkidle待機
  await page.waitForLoadState('networkidle');
});
```

---

## 完了条件

### 必須条件（Must Have）

- [ ] E2Eテスト総合成功率: **≥ 95% (70/73以上)**
- [ ] Stage 0 (Smoke Tests): **5/5 成功**
- [ ] Stage 1 (Basic UI): **10/10 成功**
- [ ] Stage 2 (Mocked Integration): **≥ 8/10 成功**
- [ ] Stage 3 (Full E2E): **≥ 8/10 成功**
- [ ] Stage 4 (Recording): **10/10 成功**
- [ ] Stage 5 (Analysis & Report): **≥ 7/10 成功**

### 重要条件（Should Have）

- [ ] セッション開始ボタンクリック → ステータス遷移確認
- [ ] WebSocket接続確立確認
- [ ] AI会話パイプライン（STT → AI → TTS）動作確認
- [ ] ドキュメント更新完了（START_HERE.md, SESSION_HISTORY.md, KNOWN_ISSUES.md）

### オプション条件（Nice to Have）

- [ ] Flaky Tests（不安定なテスト）の修正
- [ ] テスト実行時間の短縮（< 5分）
- [ ] CI/CD統合の検討

---

## 参考資料

### 関連ドキュメント

- [START_HERE.md](../../../START_HERE.md) - 次回セッション開始手順
- [KNOWN_ISSUES.md](../../07-development/KNOWN_ISSUES.md) - 既知の問題リスト
- [SESSION_HISTORY.md](../SESSION_HISTORY.md) - Day 28の記録
- [PRODUCTION_READY_ROADMAP.md](../../03-planning/releases/PRODUCTION_READY_ROADMAP.md) - Phase 1.5-1.6の定義

### E2Eテスト仕様

- `apps/web/tests/e2e/stage0-smoke.spec.ts` - Smoke Tests
- `apps/web/tests/e2e/stage1-basic-ui.spec.ts` - Basic UI Flow
- `apps/web/tests/e2e/stage2-mocked-integration.spec.ts` - Mocked Integration
- `apps/web/tests/e2e/stage3-full-e2e.spec.ts` - Full E2E
- `apps/web/tests/e2e/stage4-recording.spec.ts` - Recording Function
- `apps/web/tests/e2e/stage5-analysis-report.spec.ts` - Analysis & Report

### Lambda関数

- `infrastructure/lambda/websocket/connect/` - WebSocket接続ハンドラ
- `infrastructure/lambda/websocket/disconnect/` - WebSocket切断ハンドラ
- `infrastructure/lambda/websocket/default/` - WebSocketメッセージハンドラ

### フロントエンド

- `apps/web/components/sessions/SessionPlayer.tsx` - セッションプレイヤー
- `apps/web/lib/websocket/client.ts` - WebSocketクライアント
- `apps/web/hooks/useSessionState.ts` - セッション状態管理

---

**作成者:** Claude (AI Assistant)
**レビュー:** Phase 1.5-1.6 再検証開始前の最終確認
