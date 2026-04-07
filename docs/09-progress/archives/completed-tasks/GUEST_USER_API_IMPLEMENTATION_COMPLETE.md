# Guest User API Implementation - Complete

**作成日:** 2026-03-13 00:15 JST
**Phase:** 2.5 - ゲストユーザー機能
**ステータス:** Week 2 API実装完了（11 Lambda関数）
**進捗:** 75% → 次回CDK統合・デプロイ

---

## 実装完了サマリー

### Lambda関数一覧（11関数）

| # | 関数名 | エンドポイント | メソッド | 認証 | 実装ファイル |
|---|--------|---------------|---------|------|-------------|
| 1 | guest-sessions-create | `/api/guest-sessions` | POST | JWT (CLIENT_ADMIN/CLIENT_USER) | `infrastructure/lambda/guest-sessions/create/index.ts` |
| 2 | guest-sessions-list | `/api/guest-sessions` | GET | JWT (CLIENT_ADMIN/CLIENT_USER) | `infrastructure/lambda/guest-sessions/list/index.ts` |
| 3 | guest-sessions-get | `/api/guest-sessions/:id` | GET | JWT (CLIENT_ADMIN/CLIENT_USER) | `infrastructure/lambda/guest-sessions/get/index.ts` |
| 4 | guest-sessions-update | `/api/guest-sessions/:id` | PATCH | JWT (CLIENT_ADMIN) | `infrastructure/lambda/guest-sessions/update/index.ts` |
| 5 | guest-sessions-delete | `/api/guest-sessions/:id` | DELETE | JWT (CLIENT_ADMIN) | `infrastructure/lambda/guest-sessions/delete/index.ts` |
| 6 | guest-sessions-batch | `/api/guest-sessions/batch` | POST | JWT (CLIENT_ADMIN/CLIENT_USER) | `infrastructure/lambda/guest-sessions/batch/index.ts` |
| 7 | guest-sessions-logs | `/api/guest-sessions/:id/logs` | GET | JWT (CLIENT_ADMIN/CLIENT_USER) | `infrastructure/lambda/guest-sessions/logs/index.ts` |
| 8 | guest-sessions-complete | `/api/guest-sessions/:id/complete` | POST | JWT (GUEST or CLIENT_ADMIN/CLIENT_USER) | `infrastructure/lambda/guest-sessions/complete/index.ts` |
| 9 | guest-verify | `/api/guest/verify/:token` | GET | なし（公開） | `infrastructure/lambda/guest/verify/index.ts` |
| 10 | guest-auth | `/api/guest/auth` | POST | なし（公開） | `infrastructure/lambda/guest/auth/index.ts` |
| 11 | guest-session-data | `/api/guest/session-data` | GET | JWT (GUEST) | `infrastructure/lambda/guest/session-data/index.ts` |

---

## 1. ゲストセッション作成（create）

**エンドポイント:** `POST /api/guest-sessions`
**認証:** JWT - CLIENT_ADMIN / CLIENT_USER
**ファイル:** `infrastructure/lambda/guest-sessions/create/index.ts`

### リクエスト

```typescript
interface CreateGuestSessionRequest {
  scenarioId: string;
  avatarId?: string;
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, any>;
  validUntil: string; // ISO 8601 date
  dataRetentionDays?: number;
  pinCode?: string; // Custom PIN (4-8 digits)
}
```

### レスポンス

```typescript
interface CreateGuestSessionResponse {
  guestSession: {
    id: string;
    token: string;
    pinCode: string; // ⚠️ Only included in creation response
    inviteUrl: string; // e.g., http://localhost:3000/guest/{token}
    status: string;
    validFrom: string;
    validUntil: string;
    createdAt: string;
  };
}
```

### 主要機能

- ✅ シナリオ・アバターの組織所有権検証
- ✅ トークン・PIN生成（カスタムPIN対応）
- ✅ 自動削除スケジュール計算（dataRetentionDays）
- ✅ 監査ログ記録（CREATED イベント）
- ✅ 招待URL生成

**重要:** PINコードは**作成時のみ**返却される。データベースには bcrypt ハッシュのみ保存。

---

## 2. ゲストセッション一覧（list）

**エンドポイント:** `GET /api/guest-sessions`
**認証:** JWT - CLIENT_ADMIN / CLIENT_USER
**ファイル:** `infrastructure/lambda/guest-sessions/list/index.ts`

### クエリパラメータ

```typescript
interface ListGuestSessionsQuery {
  status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'REVOKED';
  scenarioId?: string;
  guestEmail?: string; // 部分一致検索
  limit?: number; // 1-100 (default: 50)
  offset?: number; // (default: 0)
  sortBy?: 'createdAt' | 'validUntil' | 'accessCount'; // (default: createdAt)
  sortOrder?: 'asc' | 'desc'; // (default: desc)
}
```

### レスポンス

```typescript
interface ListGuestSessionsResponse {
  guestSessions: GuestSessionListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

### 主要機能

- ✅ 組織スコープフィルタリング（自動）
- ✅ ステータス・シナリオ・ゲストメールでフィルタリング
- ✅ ページネーション（最大100件/ページ）
- ✅ ソート（作成日・有効期限・アクセス回数）
- ✅ シナリオ・アバター・セッション情報含む

---

## 3. ゲストセッション詳細（get）

**エンドポイント:** `GET /api/guest-sessions/:id`
**認証:** JWT - CLIENT_ADMIN / CLIENT_USER
**ファイル:** `infrastructure/lambda/guest-sessions/get/index.ts`

### レスポンス

```typescript
interface GuestSessionDetail {
  id: string;
  token: string;
  status: string;
  guestName: string | null;
  guestEmail: string | null;
  guestMetadata: any;
  validFrom: string;
  validUntil: string;
  accessCount: number;
  failedAttempts: number;
  lockedUntil: string | null;
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  dataRetentionDays: number | null;
  autoDeleteAt: string | null;
  createdAt: string;
  updatedAt: string;
  scenario: { id, title, category, description };
  avatar: { id, name, type, thumbnailUrl } | null;
  session: { id, status, startedAt, endedAt, durationSec } | null;
  creator: { id, name, email };
  organization: { id, name };
  recentLogs: Array<{ id, eventType, ipAddress, userAgent, details, createdAt }>;
}
```

### 主要機能

- ✅ 全フィールド取得（21フィールド）
- ✅ 全リレーション含む（シナリオ、アバター、セッション、作成者、組織）
- ✅ 最近のログ10件取得
- ✅ 組織所有権検証

---

## 4. ゲストセッション更新（update）

**エンドポイント:** `PATCH /api/guest-sessions/:id`
**認証:** JWT - CLIENT_ADMIN のみ
**ファイル:** `infrastructure/lambda/guest-sessions/update/index.ts`

### リクエスト

```typescript
interface UpdateGuestSessionRequest {
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, any>;
  validUntil?: string; // ISO 8601 date
  dataRetentionDays?: number;
  status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'REVOKED';
}
```

### 主要機能

- ✅ 部分更新対応（指定フィールドのみ更新）
- ✅ validUntil更新時の検証（未来日付のみ）
- ✅ dataRetentionDays更新時の auto_delete_at 自動再計算
- ✅ 監査ログ記録（UPDATED イベント、変更フィールド記録）
- ✅ 組織所有権検証

**権限:** CLIENT_ADMIN のみ（CLIENT_USER は更新不可）

---

## 5. ゲストセッション削除（delete）

**エンドポイント:** `DELETE /api/guest-sessions/:id`
**認証:** JWT - CLIENT_ADMIN のみ
**ファイル:** `infrastructure/lambda/guest-sessions/delete/index.ts`

### レスポンス

```typescript
interface RevokeGuestSessionResponse {
  message: string;
  guestSession: {
    id: string;
    status: string; // 'REVOKED'
    revokedAt: string;
  };
}
```

### 主要機能

- ✅ 論理削除（ステータスをREVOKEDに変更）
- ✅ 既にREVOKED済みの場合はエラー
- ✅ 監査ログ記録（REVOKED イベント）
- ✅ 組織所有権検証

**重要:** 物理削除は行わない。ステータスをREVOKEDに変更し、以降のアクセスを拒否する。

---

## 6. ゲストセッションバッチ作成（batch）

**エンドポイント:** `POST /api/guest-sessions/batch`
**認証:** JWT - CLIENT_ADMIN / CLIENT_USER
**ファイル:** `infrastructure/lambda/guest-sessions/batch/index.ts`

### リクエスト

```typescript
interface BatchCreateGuestSessionsRequest {
  sessions: BatchGuestSessionItem[];
  sharedValidUntil?: string; // 全セッションに適用
  sharedDataRetentionDays?: number; // 全セッションに適用
}

interface BatchGuestSessionItem {
  scenarioId: string;
  avatarId?: string;
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, any>;
  validUntil?: string; // 個別指定（sharedより優先）
  dataRetentionDays?: number;
  pinCode?: string;
}
```

### レスポンス

```typescript
interface BatchCreateGuestSessionsResponse {
  results: BatchGuestSessionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

interface BatchGuestSessionResult {
  success: boolean;
  guestSession?: {
    id: string;
    token: string;
    pinCode: string;
    inviteUrl: string;
    guestName: string | null;
    guestEmail: string | null;
  };
  error?: string;
  index: number;
}
```

### 主要機能

- ✅ 最大100セッション一括作成
- ✅ 個別結果返却（成功/失敗の詳細）
- ✅ 共有パラメータ（validUntil, dataRetentionDays）
- ✅ エラーハンドリング（1件失敗しても全体は継続）
- ✅ 監査ログ記録（各セッションごと、batchIndex記録）

**用途:** 採用面接で複数候補者を一括招待、研修受講者を一括登録など

---

## 7. ゲストセッションログ（logs）

**エンドポイント:** `GET /api/guest-sessions/:id/logs`
**認証:** JWT - CLIENT_ADMIN / CLIENT_USER
**ファイル:** `infrastructure/lambda/guest-sessions/logs/index.ts`

### クエリパラメータ

```typescript
interface GetGuestSessionLogsQuery {
  eventType?: string; // CREATED, AUTH_SUCCESS, AUTH_FAILED, TOKEN_VERIFIED, UPDATED, REVOKED, COMPLETED
  limit?: number; // 1-200 (default: 50)
  offset?: number; // (default: 0)
}
```

### レスポンス

```typescript
interface GetGuestSessionLogsResponse {
  logs: GuestSessionLogItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

### 主要機能

- ✅ イベントタイプフィルタリング
- ✅ ページネーション（最大200件/ページ）
- ✅ 降順ソート（最新ログが最初）
- ✅ IPアドレス・User Agent記録
- ✅ 詳細情報（details JSON）

**イベントタイプ:**
- `CREATED` - セッション作成
- `TOKEN_VERIFIED` - トークン検証（PIN入力前）
- `AUTH_SUCCESS` - 認証成功
- `AUTH_FAILED` - 認証失敗
- `UPDATED` - セッション更新
- `REVOKED` - セッション削除
- `COMPLETED` - セッション完了

---

## 8. ゲストセッション完了（complete）

**エンドポイント:** `POST /api/guest-sessions/:id/complete`
**認証:** JWT - GUEST または CLIENT_ADMIN / CLIENT_USER
**ファイル:** `infrastructure/lambda/guest-sessions/complete/index.ts`

### レスポンス

```typescript
interface CompleteGuestSessionResponse {
  message: string;
  guestSession: {
    id: string;
    status: string; // 'COMPLETED'
    completedAt: string;
  };
}
```

### 主要機能

- ✅ ゲスト自身が完了可能（guestSessionId一致確認）
- ✅ 内部ユーザーも完了可能（組織一致確認）
- ✅ ステータスをCOMPLETEDに変更
- ✅ 既にCOMPLETED/REVOKED/EXPIREDの場合はエラー
- ✅ 監査ログ記録（COMPLETED イベント、完了者記録）

**用途:** ゲストが面接・研修を終了した際に呼び出す

---

## 9. ゲストトークン検証（verify）

**エンドポイント:** `GET /api/guest/verify/:token`
**認証:** なし（公開）
**ファイル:** `infrastructure/lambda/guest/verify/index.ts`

### レスポンス

```typescript
interface VerifyTokenResponse {
  valid: boolean;
  guestSession?: {
    id: string;
    status: string;
    validUntil: string;
    scenario: { title, category };
    organization: { name };
    avatar?: { name, thumbnailUrl };
  };
  error?: string;
}
```

### 主要機能

- ✅ PIN入力前の事前検証
- ✅ トークン存在確認
- ✅ 有効期限チェック（expired → EXPIRED更新）
- ✅ ステータスチェック（REVOKED, EXPIRED, COMPLETED）
- ✅ ロック状態チェック（lockedUntil）
- ✅ シナリオ・組織・アバター情報返却
- ✅ 監査ログ記録（TOKEN_VERIFIED イベント）

**用途:** ゲストがURLにアクセスした際、PIN入力画面を表示する前に呼び出す

---

## 10. ゲスト認証（auth）

**エンドポイント:** `POST /api/guest/auth`
**認証:** なし（公開）
**ファイル:** `infrastructure/lambda/guest/auth/index.ts`

### リクエスト

```typescript
interface AuthRequest {
  token: string;
  pinCode: string;
}
```

### レスポンス

```typescript
interface AuthResponse {
  success: boolean;
  accessToken?: string; // ゲスト用JWT
  guestSession?: {
    id: string;
    sessionId: string | null;
    scenarioId: string;
    avatarId: string | null;
    status: string;
  };
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: string;
}
```

### 主要機能

- ✅ レート制限統合（checkRateLimit, recordAttempt, resetAttempts）
- ✅ IPアドレス + トークン単位の制限
- ✅ PIN検証（bcrypt、タイミングアタック耐性）
- ✅ 失敗回数記録（failedAttempts）
- ✅ 自動ロック（5回失敗 → 10分ロック）
- ✅ JWT発行（ゲスト用トークン）
- ✅ ステータス更新（PENDING → ACTIVE）
- ✅ 監査ログ記録（AUTH_SUCCESS / AUTH_FAILED イベント）

**セキュリティ機能:**
- DynamoDB レート制限（5失敗/IP・トークン → 10分ロック）
- ゲストセッション側ロック（5失敗 → 10分ロック）
- 指数バックオフ（1分 → 2分 → 4分 → 8分 → 10分）

**レスポンスステータスコード:**
- `200` - 認証成功
- `401` - PIN無効（remainingAttempts付き）
- `403` - ロック中（lockedUntil付き）
- `404` - トークン無効
- `429` - レート制限超過

---

## 11. ゲストセッションデータ（session-data）

**エンドポイント:** `GET /api/guest/session-data`
**認証:** JWT - GUEST のみ
**ファイル:** `infrastructure/lambda/guest/session-data/index.ts`

### レスポンス

```typescript
interface GuestSessionData {
  session: {
    id: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    durationSec: number | null;
  } | null;
  recording: {
    id: string;
    type: string;
    s3Key: string;
    url: string | null;
    durationSec: number | null;
    status: string;
    createdAt: string;
  } | null;
  transcript: {
    id: string;
    fullText: string;
    wordCount: number;
    language: string;
    confidence: number;
    speakers: Array<{ speaker, text, startTimeSec, endTimeSec }>;
    createdAt: string;
  } | null;
  analysis: {
    id: string;
    overallScore: number;
    sentiment: string;
    metrics: any;
    insights: any;
    createdAt: string;
  } | null;
}
```

### 主要機能

- ✅ ゲスト自身のセッションデータのみ取得（guestSessionId一致確認）
- ✅ 録画（MERGED タイプのみ）取得
- ✅ 文字起こし取得
- ✅ 解析結果取得
- ✅ セッション未作成時はnull返却（エラーなし）

**用途:** ゲストが面接・研修終了後、自分の録画・評価を確認する（設定により制限可能）

---

## 共通設計パターン

### 1. 認証・認可

```typescript
// JWT検証
const authHeader = event.headers.Authorization || event.headers.authorization;
const userData = verifyToken(authHeader);

// ロールチェック
if (userData.role !== 'CLIENT_ADMIN' && userData.role !== 'CLIENT_USER') {
  return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
}

// 組織スコープチェック
if (guestSession.orgId !== userData.orgId) {
  return { statusCode: 403, body: JSON.stringify({ error: 'Not your organization' }) };
}
```

### 2. エラーハンドリング

```typescript
try {
  // 処理
} catch (error) {
  console.error('[FunctionName] Error:', error);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'Internal server error' }),
  };
} finally {
  await prisma.$disconnect();
}
```

### 3. CORS対応

```typescript
headers: {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}
```

### 4. 監査ログ記録

```typescript
await prisma.guestSessionLog.create({
  data: {
    guestSessionId: guestSession.id,
    eventType: 'CREATED',
    ipAddress: event.requestContext?.identity?.sourceIp || null,
    userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
    details: {
      createdBy: userData.sub,
      // その他の詳細情報
    },
  },
});
```

### 5. ページネーション

```typescript
const [items, total] = await Promise.all([
  prisma.model.findMany({
    where,
    orderBy,
    skip: offset,
    take: limit,
  }),
  prisma.model.count({ where }),
]);

return {
  items,
  pagination: {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  },
};
```

---

## 次回タスク: CDK統合（Week 2 Day 3-7）

### 1. API Gateway統合

`infrastructure/lib/api-lambda-stack.ts` に追加:

```typescript
// Guest Session Management
const guestSessionsCreateFn = new NodejsFunction(this, 'GuestSessionsCreateFunction', {
  entry: path.join(__dirname, '../lambda/guest-sessions/create/index.ts'),
  handler: 'handler',
  environment: { ...commonEnv },
  // ... Lambda設定
});

// API Gateway統合
const guestSessions = api.root.addResource('guest-sessions');
guestSessions.addMethod('POST', new LambdaIntegration(guestSessionsCreateFn), {
  authorizer: jwtAuthorizer,
});
guestSessions.addMethod('GET', new LambdaIntegration(guestSessionsListFn), {
  authorizer: jwtAuthorizer,
});

const guestSession = guestSessions.addResource('{id}');
guestSession.addMethod('GET', new LambdaIntegration(guestSessionsGetFn), {
  authorizer: jwtAuthorizer,
});
// ... 他のメソッド
```

### 2. Lambda関数デプロイ設定

```bash
# CDKスタック更新
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# デプロイ時間: 約3-5分（11関数）
# 期待結果: 11個の新しいLambda関数がデプロイされる
```

### 3. WebSocket認証拡張

`infrastructure/lambda/websocket/default/index.ts`:

```typescript
// ゲストトークンサポート追加
import { verifyToken, verifyGuestToken, isGuestToken } from '../../shared/auth/jwt';

// 認証処理
const token = event.queryStringParameters?.token;
const payload = isGuestToken(token)
  ? verifyGuestToken(token)
  : verifyToken(token);

// ゲストの場合はguestSessionIdを接続情報に保存
if (payload.role === 'GUEST') {
  connectionData.guestSessionId = payload.guestSessionId;
}
```

### 4. 単体テスト作成

```bash
# テストファイル作成
infrastructure/lambda/guest-sessions/create/__tests__/index.test.ts
infrastructure/lambda/guest-sessions/list/__tests__/index.test.ts
# ... 各Lambda関数

# テスト実行
cd infrastructure/lambda
npm test

# 期待結果: 全テスト合格
```

### 5. 統合テスト

```bash
# APIエンドポイントテスト
curl -X POST https://API_URL/dev/api/v1/guest-sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"...","validUntil":"2026-12-31T23:59:59Z"}'

# レスポンス確認
# { "guestSession": { "id": "...", "token": "...", "pinCode": "...", "inviteUrl": "..." } }
```

---

## 実装完了チェックリスト

### Lambda関数実装

- [x] guest-sessions/create - ゲストセッション作成
- [x] guest-sessions/list - 一覧取得
- [x] guest-sessions/get - 詳細取得
- [x] guest-sessions/update - 更新
- [x] guest-sessions/delete - 削除（論理削除）
- [x] guest-sessions/batch - バッチ作成
- [x] guest-sessions/logs - ログ取得
- [x] guest-sessions/complete - セッション完了
- [x] guest/verify - トークン検証（既存）
- [x] guest/auth - 認証（既存）
- [x] guest/session-data - セッションデータ取得

### 共通ユーティリティ

- [x] guest-token.ts - ゲストJWT生成・検証（sessionIdをoptionalに修正）
- [x] pinHash.ts - PIN ハッシュ化・検証
- [x] tokenGenerator.ts - トークン・PIN生成
- [x] rateLimiter.ts - レート制限

### データベーススキーマ

- [x] GuestSession モデル（21フィールド）
- [x] GuestSessionLog モデル（7フィールド）
- [x] Session モデル拡張（isGuestSession, guestSessionId）
- [x] リレーション追加（6モデル）
- [x] マイグレーションSQL生成

### 次回タスク

- [ ] CDK API Gateway統合（11エンドポイント）
- [ ] Lambda関数デプロイ設定
- [ ] WebSocket認証拡張（ゲストトークン対応）
- [ ] 単体テスト作成（11 Lambda関数）
- [ ] 統合テスト実行
- [ ] ドキュメント更新（API仕様書）

---

## パフォーマンス見積もり

### レスポンス時間（推定）

| エンドポイント | 推定時間 | 備考 |
|---------------|---------|------|
| POST /guest-sessions | 200-300ms | トークン・PIN生成含む |
| GET /guest-sessions | 100-200ms | ページネーション、最大100件 |
| GET /guest-sessions/:id | 150-250ms | 全リレーション取得 |
| PATCH /guest-sessions/:id | 100-200ms | 部分更新 |
| DELETE /guest-sessions/:id | 100-150ms | ステータス更新のみ |
| POST /guest-sessions/batch | 2-5秒 | 100件一括作成時 |
| GET /guest-sessions/:id/logs | 100-200ms | ページネーション |
| POST /guest-sessions/:id/complete | 100-150ms | ステータス更新 |
| GET /guest/verify/:token | 100-150ms | トークン検証のみ |
| POST /guest/auth | 300-500ms | bcrypt検証 + レート制限チェック |
| GET /guest/session-data | 200-300ms | 録画・解析データ取得 |

### Lambda関数メモリ推奨値

- 通常処理: 256MB（create, list, get, update, delete, complete, verify, session-data）
- バッチ処理: 512MB（batch - 100件一括作成時）
- 認証処理: 512MB（auth - bcrypt計算負荷）
- ログ取得: 256MB（logs）

### DynamoDB容量（レート制限テーブル）

- オンデマンド課金
- 推定: 1,000 認証試行/日 = $0.25/月
- TTL自動クリーンアップ（10分）

### Aurora Serverless v2容量

- GuestSession: 約1KB/レコード
- GuestSessionLog: 約500B/レコード
- 推定: 10,000ゲストセッション = 10MB
- 推定: 100,000ログエントリ = 50MB

---

## セキュリティ考慮事項

### 1. PIN保護

- ✅ bcrypt ハッシュ化（SALT_ROUNDS=10）
- ✅ タイミングアタック耐性
- ✅ PINは**作成時のみ**返却（DB保存なし）

### 2. レート制限

- ✅ DynamoDB ベース（IPアドレス + トークン単位）
- ✅ 指数バックオフ（1分 → 2分 → 4分 → 8分 → 10分）
- ✅ 自動ロック解除（TTL 10分）

### 3. 二重ロック機構

- ✅ DynamoDBレート制限（IP単位）
- ✅ GuestSessionロック（セッション単位）

### 4. データ隔離

- ✅ 組織スコープフィルタリング（自動）
- ✅ ゲストは自己データのみアクセス可能

### 5. 監査ログ

- ✅ 全イベント記録（CREATED, AUTH_SUCCESS, AUTH_FAILED等）
- ✅ IPアドレス・User Agent記録
- ✅ 詳細情報（details JSON）

### 6. 自動削除

- ✅ dataRetentionDays設定（GDPR対応）
- ✅ auto_delete_at自動計算
- ✅ 定期実行Lambda（別途実装予定）

---

## まとめ

### 完了内容

- ✅ 11 Lambda関数実装完了
- ✅ 包括的なエラーハンドリング
- ✅ セキュリティ機能統合（レート制限、PIN保護）
- ✅ 監査ログ記録
- ✅ CORS対応
- ✅ 型安全な実装（TypeScript）

### 次回タスク

1. **CDK統合** - API Gateway 11エンドポイント追加
2. **Lambda関数デプロイ** - 11関数デプロイ
3. **WebSocket認証拡張** - ゲストトークン対応
4. **単体テスト** - 11関数のテスト作成・実行
5. **統合テスト** - APIエンドポイント動作確認

### 推定工数

- CDK統合: 1日
- Lambda関数デプロイ: 0.5日
- WebSocket認証拡張: 0.5日
- 単体テスト: 1-2日
- 統合テスト: 0.5日

**合計:** 3-5日（Week 2 Day 3-7）

---

**次回セッション開始時:**
「前回の続きから始めます。START_HERE.mdを確認してください。」

**推奨アクション:**
Phase 2.5 Week 2 Day 3-7 - CDK統合・デプロイ実装
