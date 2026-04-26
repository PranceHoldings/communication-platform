# バグ調査レポート: セッション録画・文字起こし・型不整合 (2026-04-26)

**セッション:** Day 53  
**調査対象セッション:** `feeaa44c-f5e8-4747-a57a-671e5a1eb07f`  
**症状報告日:** 2026-04-26

---

## 概要

本セッションで発見・修正した4種類のバグを記録する。いずれも「動いているように見えるが、保存されたデータが不完全」という種類の問題で、セッション終了後の閲覧時に初めて発覚する。

---

## Bug 1: セッション録画が空 (12KB / 2秒)

### 症状
- ビデオプレーヤーは表示される (`processingStatus: COMPLETED`)
- 動画の中身はほぼ空 (`file_size_bytes: 12025`, `duration_sec: 2`)
- 音声なし

### 根本原因
**`session_end` がS3チャンクアップロード完了より先に到達する競合 (Race Condition)**

```
ブラウザ → WebSocket → Lambda: session_end        ← 先に到達
ブラウザ → S3:         video chunk N, N+1, ...     ← まだ進行中
```

`session_end` 受信直後に `videoProcessor.combineChunks()` を実行すると、
S3に存在するチャンクが0〜1個のため、12KBのほぼ空のWebMが生成される。

### DB確認で判明したこと
```sql
SELECT file_size_bytes, duration_sec FROM recordings
WHERE session_id = 'feeaa44c-...';
-- file_size_bytes: 12025, duration_sec: 2 ← 明らかに異常
```

### 修正
`session_end` ハンドラーの `combineChunks` 実行前に3秒待機を追加:

```typescript
// infrastructure/lambda/websocket/default/index.ts
// Brief wait to let any in-flight S3 uploads from the client complete
await new Promise(resolve => setTimeout(resolve, 3000));
```

### 学び
- **S3はリクエスト完了まで保証されない**: ブラウザのS3 PUT完了 ≠ `session_end` WebSocket送信完了
- **`videoChunksCount` は受信済みチャンク数**: S3に書き込まれた数ではない
- **3秒は経験的な値**: ネットワーク遅延が大きい環境では不十分な可能性あり
- **改善案**: `session_end` 時にS3の実際のチャンク数を確認し、`videoChunksCount` と一致するまで最大Nミリ秒ポーリングする

---

## Bug 2: 文字起こしが1ターンのみ保存される

### 症状
- セッション中はAI・ユーザー双方の発話がリアルタイム表示される
- セッション保存後の詳細ページでは1ターン (USER + AI) しか表示されない

### DB確認で判明したこと
```sql
SELECT speaker, text FROM transcripts
WHERE session_id = 'feeaa44c-...'
ORDER BY timestamp_start;
-- 行数: 2 (USER 1件, AI 1件のみ)
```

### 根本原因 (2件複合)

**原因A: 初回挨拶 (initialGreeting) がDBに保存されていなかった**

`authenticate` ハンドラーは initialGreeting をWebSocketで送信していたが、
`prisma.transcript.create` の呼び出しがなかった。

```typescript
// 修正前: WebSocket送信のみ、DB保存なし
await sendToConnection(connectionId, {
  type: 'avatar_response_final',
  text: initialGreeting,
  timestamp: Date.now(),
});
// ← prisma.transcript.create がなかった！
```

**原因B: 接続断・再接続後のターンがDBに保存されない**

WebSocket切断 → 自動再接続 → `authenticate` 再送信のフローで、
Lambdaサイド (`connectionData`) がリセットされる。

```
接続断 → onclose → setTimeout(connect) → onopen → authenticate送信
                                              ↓
                              Lambda: connectionData = 新規
                              sessionId = message.sessionId (正常)
                              conversationHistory = [] (リセット!)
                              turnCount = 0 (リセット!)
```

再接続後の `speech_end` 処理はセッションIDが正しく復元されるため
DBへの保存は正常に実行されるはずだが、今回のセッションでは
接続断直後に会話が終了したため、ターン2以降が保存されなかった。

### 修正
原因Aのみ修正（initialGreeting のDB保存追加）:

```typescript
// infrastructure/lambda/websocket/default/index.ts
const greetingTimestamp = Date.now();
try {
  await prisma.transcript.create({
    data: {
      sessionId,
      speaker: 'AI',
      text: initialGreeting,
      timestampStart: greetingTimestamp,
      timestampEnd: greetingTimestamp,
      confidence: 1.0,
    },
  });
} catch (dbError) {
  console.error('[authenticate] Failed to save initial greeting transcript:', dbError);
}
```

原因Bは別途対応が必要（接続断後の `connectionData` 復元）。

### 学び
- **WebSocket送信 ≠ DB保存**: 画面に表示されるからDBに保存されているとは限らない
- **WebSocket送信とDB保存は必ずペアで実装**: どちらか一方を追加する際は必ず両方確認する
- **接続断後のステート復元が未実装**: `connectionData` (DynamoDB) は接続ごとに新規作成される。再接続時に既存エントリを引き継ぐ仕組みが必要（`sessionId` をキーに検索して既存 `conversationHistory` を復元）

---

## Bug 3: "Connection Error" 表示が消えない

### 症状
- WebSocket切断→再接続が成功した後も、UIに赤いドット + "Connection Error" が残る
- 会話は実際には進んでいる

### 根本原因
`ws.onerror` イベントで `setError('WebSocket connection error')` が呼ばれる。
`ws.onopen` で `setError(null)` が呼ばれるが、
`onerror → onclose → reconnect → onopen` のシーケンスで
タイミングによってはエラーが再設定される可能性がある。

真の「セッション使用可能」状態は `authenticated` メッセージ受信後であるが、
このタイミングで `setError(null)` が呼ばれていなかった。

### 修正

```typescript
// apps/web/hooks/useWebSocket.ts
case 'authenticated':
  // Clear any lingering connection error — session is now fully authenticated
  setError(null);
  // ... 既存の処理
  break;
```

### 学び
- **UIエラー状態のクリアは「実際に正常」になった時点で行う**: `onopen` は接続確立だが `authenticated` がセッション使用可能の確認
- **接続状態を3段階で管理**: `connecting → connected → authenticated`

---

## Bug 4: シナリオ API の型不整合 (複数箇所)

### 症状
- シナリオ詳細ページで `showSilenceTimer: undefined`
- シナリオ編集ページで `Cannot read properties of undefined (reading 'systemPrompt')`
- 組織設定ページ遷移後に `showSilenceTimer: undefined` に戻る

### 根本原因
**`scenarios/get` Lambda が `CachedScenario` 形状を返していた**

```typescript
// 修正前: キャッシュ用の狭い型を返していた
return successResponse(cachedScenario);
// cachedScenario = { scenarioId, title, systemPrompt, ... } ← id なし、configJson なし

// 修正後: DBから取得したフル形状を返す
return successResponse(dbScenario);
// dbScenario = { id, title, category, configJson, orgId, showSilenceTimer, ... }
```

`CachedScenario` はWebSocket/AIパイプライン用の軽量型であり、
フロントエンドに返す型ではない。

**`organizations/settings` Lambda がデフォルト値をマージしていなかった**

設定が未保存の場合 `{}` を返していた。フロントエンドは
`orgSettings.showSilenceTimer` などを直接参照するため `undefined` になった。

### 修正
- `scenarios/get`: `dbScenario` を直接 `successResponse` で返すよう変更
- `organizations/settings`: `DEFAULT_ORGANIZATION_SETTINGS` とマージして返す
- `CachedScenario` インターフェースに silence フィールド追加（WebSocket側の整合性）

### 学び: **型の二重目的 (Dual-Purpose Type) アンチパターン**

```
CachedScenario = WebSocketパイプライン用の最適化型
Scenario       = フロントエンドAPI用のフル型
```

この2つを混同すると、「フロントエンドに必要なフィールドが欠ける」か
「WebSocketに不要な大きなペイロードを渡す」かのどちらかになる。

**ルール:** Lambda関数の `return successResponse()` に渡すオブジェクトの型は
常にフロントエンドの `@prance/shared` 型と一致させる。

---

## Bug 5: シナリオ編集ページのアクセス制御欠如

### 症状
- 他組織の PUBLIC シナリオの編集ページ URL に直接アクセスできる
- 保存ボタンを押すと API が 403 を返す（Lambda側は正常）

### 根本原因
シナリオ詳細ページでは「編集ボタン」を `canEdit` 条件でガードしていたが、
`/dashboard/scenarios/:id/edit` URL への直接ナビゲーションは防げていなかった。

### 修正
編集ページの `loadScenario` 後にアクセス制御チェックを追加:

```typescript
// apps/web/app/dashboard/scenarios/[id]/edit/page.tsx
const currentUser = authApi.getCurrentUser();
if (currentUser && scenario.orgId !== currentUser.orgId && currentUser.role !== 'SUPER_ADMIN') {
  toast.error(t('scenarios.detail.readOnly'));
  router.push(`/dashboard/scenarios/${scenarioId}`);
  return;
}
```

### 学び
- **ボタン非表示はセキュリティではない**: URLへの直接アクセスは防げない
- **フロントエンドのアクセス制御は UX 改善**: 真の保護はバックエンドが担う
- **ただし UX のために両方必要**: バックエンド403だけでは体験が悪い

---

## 未解決の問題

### 接続断後の conversationHistory 復元
**優先度:** Medium

再接続時に DynamoDB の既存 `connectionData` を `sessionId` で検索し、
`conversationHistory` / `turnCount` を復元する仕組みが必要。

現状:
```
再接続 → authenticate → connectionData = { conversationHistory: [] }
                                       ← 以前のターン履歴が消える
```

改善案:
```typescript
// authenticate ハンドラー内
const existingData = await getConnectionDataBySessionId(sessionId);
if (existingData) {
  conversationHistory = existingData.conversationHistory;
  turnCount = existingData.turnCount;
}
```

### ビデオチャンク数の S3 実績値との照合
**優先度:** Low

現状の3秒固定待機ではなく、S3の実際のチャンク数が `videoChunksCount` に一致するまで
ポーリングする実装の方が確実。

---

## 修正ファイル一覧

| ファイル | 修正内容 |
|---------|---------|
| `infrastructure/lambda/websocket/default/index.ts` | initialGreeting DB保存、video combine 3秒待機 |
| `infrastructure/lambda/scenarios/get/index.ts` | CachedScenario → dbScenario フル形状返却 |
| `infrastructure/lambda/organizations/settings/index.ts` | デフォルト値マージ |
| `infrastructure/lambda/guest-sessions/get/index.ts` | successResponse ラッパー適用 |
| `infrastructure/lambda/sessions/create/index.ts` | 重複 startedAt フィールド削除 |
| `infrastructure/lambda/shared/scenario/cache.ts` | CachedScenario に silence フィールド追加 |
| `apps/web/hooks/useWebSocket.ts` | authenticated 受信時に wsError クリア |
| `apps/web/app/dashboard/scenarios/[id]/edit/page.tsx` | 所有組織チェック・リダイレクト追加 |
| `apps/web/app/dashboard/scenarios/[id]/page.tsx` | canEdit ガード・readOnly メッセージ |
| `apps/web/lib/i18n/messages.ts` | languages 名前空間追加 |
| `apps/web/messages/*/scenarios.json` (10言語) | readOnly キー追加 |
| `apps/web/messages/*/errors.json` (10言語) | websocket.title 翻訳修正 |

---

## デプロイ情報

| 環境 | タイムスタンプ | Lambda | Next.js |
|------|-------------|--------|---------|
| dev  | 2026-04-26 | `prance-websocket-default-dev` 更新 | BUILD_ID: `nTT4-Kz15OePJ49fjleF0` |
