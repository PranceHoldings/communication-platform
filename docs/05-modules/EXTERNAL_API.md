# 外部連携APIシステム

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [APIキー管理](#apiキー管理)
3. [レート制限](#レート制限)
4. [API仕様](#api仕様)
5. [Webhook統合](#webhook統合)
6. [使用状況トラッキング](#使用状況トラッキング)
7. [セキュリティ](#セキュリティ)
8. [実装ガイド](#実装ガイド)

---

## 概要

外部連携APIシステムは、他のシステムやアプリケーションがPranceプラットフォームの機能をプログラマティックに利用できるようにするための**RESTful API**を提供します。

### 主要機能

| 機能                     | 説明                                          |
| ------------------------ | --------------------------------------------- |
| **APIキー管理**          | 組織ごとのAPIキー発行・管理・無効化           |
| **階層的レート制限**     | グローバル・組織・APIキーレベルの制限         |
| **OpenAPI仕様**          | Swagger/OpenAPI 3.0準拠の自動生成ドキュメント |
| **Webhook統合**          | セッション完了、レポート生成等のイベント通知  |
| **使用状況トラッキング** | リクエスト数、データ転送量、エラー率の監視    |
| **バージョニング**       | APIバージョン管理（v1, v2...）                |
| **認証・認可**           | API Key + JWT、スコープベースの権限管理       |

### ユースケース

#### 1. ATS連携（採用管理システム）

```
ATSシステム → Prance API
1. 候補者情報を送信
2. 面接シナリオを作成
3. セッション開始URLを取得
4. 結果レポートをWebhookで受信
```

#### 2. LMS連携（学習管理システム）

```
LMSシステム → Prance API
1. 学生アカウントを一括登録
2. 語学学習シナリオを割り当て
3. セッション進捗を定期取得
4. 成績データをエクスポート
```

#### 3. カスタムアプリケーション

```
モバイルアプリ → Prance API
1. セッション一覧を取得
2. 新しいセッションを開始
3. リアルタイム会話データを送受信
4. レポートを表示
```

---

## APIキー管理

### APIキーの種類

| タイプ         | スコープ         | 有効期限                 | 用途             |
| -------------- | ---------------- | ------------------------ | ---------------- |
| **本番キー**   | フルアクセス     | 無期限（手動無効化まで） | 本番環境         |
| **テストキー** | 制限付きアクセス | 無期限                   | 開発・テスト環境 |
| **一時キー**   | 制限付きアクセス | 1-30日                   | デモ、トライアル |

### APIキーデータモデル

```typescript
interface APIKey {
  id: string; // 'key_abc123...'
  organizationId: string;
  name: string; // 'Production API Key'
  keyPrefix: string; // 'pk_live_' or 'pk_test_'
  keyHash: string; // SHA-256ハッシュ（実際のキーは保存しない）

  // 権限設定
  scopes: APIScope[]; // ['sessions:read', 'sessions:write', ...]
  environment: 'production' | 'test';

  // レート制限
  rateLimits: {
    requestsPerMinute: number; // 60
    requestsPerDay: number; // 10000
    maxConcurrentRequests: number; // 10
  };

  // 状態
  status: 'active' | 'disabled' | 'expired';
  expiresAt?: Date; // 一時キーの場合

  // 使用統計
  stats: {
    totalRequests: number;
    lastUsed?: Date;
    createdAt: Date;
  };

  // セキュリティ
  allowedIPs?: string[]; // IPホワイトリスト
  allowedDomains?: string[]; // CORSドメインホワイトリスト

  createdBy: string; // userId
  createdAt: Date;
  updatedAt: Date;
}

// APIスコープ（権限）
type APIScope =
  | 'sessions:read'
  | 'sessions:write'
  | 'sessions:delete'
  | 'scenarios:read'
  | 'scenarios:write'
  | 'reports:read'
  | 'users:read'
  | 'users:write'
  | 'webhooks:manage'
  | 'analytics:read'
  | '*'; // 全権限（スーパー管理者のみ）
```

### APIキー生成フロー

```
管理者 → APIキー管理画面
  ↓
キー生成リクエスト
  ↓
1. ランダムキー生成（cryptographically secure）
   例: pk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
  ↓
2. SHA-256ハッシュ化してDB保存
  ↓
3. 平文キーをユーザーに1回だけ表示
   ⚠️ 再表示不可（紛失時は再生成）
  ↓
4. 使用統計トラッキング開始
```

### APIキー管理UI

```
┌──────────────────────────────────────────────────────────────┐
│ API連携設定                                  [+ 新規キー作成] │
├──────────────────────────────────────────────────────────────┤
│ 📊 今月の使用状況                                             │
│ リクエスト数: 45,234 / 100,000 (45.2%)                       │
│ データ転送: 12.3 GB / 50 GB (24.6%)                          │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ アクティブなAPIキー                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🟢 Production API Key                    [本番]        │   │
│ │ pk_live_a1b2...o5p6                                    │   │
│ │ 最終使用: 2分前 | 今月: 42,150リクエスト               │   │
│ │ レート制限: 100 req/min, 50,000 req/day               │   │
│ │ 権限: sessions:*, scenarios:read, reports:read         │   │
│ │ [詳細] [無効化] [削除]                                 │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🟡 Test API Key                          [テスト]      │   │
│ │ pk_test_x9y8...z1a2                                    │   │
│ │ 最終使用: 3日前 | 今月: 3,084リクエスト                │   │
│ │ レート制限: 20 req/min, 5,000 req/day                  │   │
│ │ 権限: sessions:read, scenarios:read                    │   │
│ │ [詳細] [無効化] [削除]                                 │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📖 API ドキュメント                          [OpenAPI仕様]   │
│ https://api.prance.ai/docs                                    │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🔔 Webhook設定                               [+ 追加]         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ セッション完了イベント                                 │   │
│ │ https://your-app.com/webhooks/session-completed        │   │
│ │ [編集] [テスト送信] [削除]                             │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### APIキー生成API

```typescript
// POST /api/v1/api-keys
export const createAPIKey: APIGatewayProxyHandler = async event => {
  const { name, scopes, environment, rateLimits, expiresAt } = JSON.parse(event.body);
  const { userId, organizationId, role } = event.requestContext.authorizer;

  // 権限チェック（組織管理者以上）
  if (role !== 'client_admin' && role !== 'super_admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // APIキー生成
  const keyPrefix = environment === 'production' ? 'pk_live_' : 'pk_test_';
  const randomBytes = crypto.randomBytes(32);
  const apiKey = `${keyPrefix}${randomBytes.toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // DB保存
  const apiKeyRecord = await prisma.apiKey.create({
    data: {
      organizationId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      environment,
      rateLimits: rateLimits || {
        requestsPerMinute: environment === 'production' ? 100 : 20,
        requestsPerDay: environment === 'production' ? 50000 : 5000,
        maxConcurrentRequests: 10,
      },
      status: 'active',
      expiresAt,
      createdBy: userId,
    },
  });

  // 監査ログ
  await auditLog({
    action: 'API_KEY_CREATED',
    userId,
    organizationId,
    details: { apiKeyId: apiKeyRecord.id, name, environment },
  });

  return {
    statusCode: 201,
    body: JSON.stringify({
      id: apiKeyRecord.id,
      apiKey, // ⚠️ 1回だけ表示（再表示不可）
      message: 'API key created. Please save it securely as it cannot be retrieved again.',
    }),
  };
};
```

---

## レート制限

### 階層的レート制限

```
┌─────────────────────────────────────────┐
│ グローバルレート制限                    │
│ - すべてのリクエスト: 10,000 req/sec    │
│ - 全組織合計: 1,000,000 req/day         │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 組織レベルレート制限                    │
│ - 組織A: 1,000 req/min                  │
│ - 組織B: 5,000 req/min (Enterpriseプラン)│
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ APIキーレベルレート制限                 │
│ - キー1 (本番): 100 req/min             │
│ - キー2 (テスト): 20 req/min            │
└─────────────────────────────────────────┘
```

### レート制限実装（DynamoDB + Lua）

```typescript
// DynamoDBテーブル: RateLimits
interface RateLimitRecord {
  PK: string; // 'KEY#{apiKeyId}' or 'ORG#{organizationId}'
  SK: string; // 'WINDOW#{timestamp}#{window}'

  window: 'minute' | 'hour' | 'day';
  timestamp: number; // UNIX timestamp（ウィンドウの開始時刻）

  requestCount: number; // このウィンドウでのリクエスト数
  ttl: number; // 自動削除タイムスタンプ
}

// レート制限チェック（Lambda Authorizer）
async function checkRateLimit(apiKeyId: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const minuteWindow = Math.floor(now / 60) * 60; // 1分ウィンドウ

  const key = {
    PK: `KEY#${apiKeyId}`,
    SK: `WINDOW#${minuteWindow}#minute`,
  };

  // Atomic Increment（DynamoDB UpdateExpression）
  const result = await dynamodb.update({
    TableName: 'RateLimits',
    Key: key,
    UpdateExpression: 'ADD requestCount :inc SET #ttl = :ttl',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':inc': 1,
      ':ttl': now + 120, // 2分後に自動削除
    },
    ReturnValues: 'ALL_NEW',
  });

  const currentCount = result.Attributes.requestCount;

  // APIキーの制限を取得
  const apiKey = await getAPIKey(apiKeyId);
  const limit = apiKey.rateLimits.requestsPerMinute;

  if (currentCount > limit) {
    return false; // レート制限超過
  }

  return true; // OK
}

// Lambda Authorizer
export const authorizer: APIGatewayAuthorizerHandler = async event => {
  const apiKey = event.headers['X-API-Key'] || event.headers['x-api-key'];

  if (!apiKey) {
    throw new Error('Unauthorized');
  }

  // 1. APIキー検証
  const keyRecord = await validateAPIKey(apiKey);

  if (!keyRecord || keyRecord.status !== 'active') {
    throw new Error('Unauthorized');
  }

  // 2. レート制限チェック
  const allowed = await checkRateLimit(keyRecord.id);

  if (!allowed) {
    throw new Error('Rate limit exceeded');
  }

  // 3. 使用統計更新（非同期）
  recordAPIUsage(keyRecord.id, event).catch(console.error);

  // 4. 認可ポリシー返却
  return generatePolicy('user', 'Allow', event.methodArn, {
    organizationId: keyRecord.organizationId,
    apiKeyId: keyRecord.id,
    scopes: keyRecord.scopes,
  });
};
```

### レスポンスヘッダー

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1678901234
Retry-After: 60
```

---

## API仕様

### OpenAPI 3.0仕様

```yaml
openapi: 3.0.3
info:
  title: Prance Communication Platform API
  version: 1.0.0
  description: |
    AIアバター会話プラットフォームの外部連携API。
    セッション管理、レポート取得、Webhook統合を提供します。

servers:
  - url: https://api.prance.ai/v1
    description: Production
  - url: https://api-test.prance.ai/v1
    description: Test Environment

security:
  - ApiKeyAuth: []

paths:
  /sessions:
    get:
      summary: セッション一覧取得
      tags: [Sessions]
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, in_progress, completed, failed]
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessions:
                    type: array
                    items:
                      $ref: '#/components/schemas/Session'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

    post:
      summary: 新しいセッション作成
      tags: [Sessions]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [userId, scenarioId]
              properties:
                userId:
                  type: string
                  format: uuid
                scenarioId:
                  type: string
                  format: uuid
                metadata:
                  type: object
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'

  /sessions/{sessionId}:
    get:
      summary: セッション詳細取得
      tags: [Sessions]
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionDetail'

  /sessions/{sessionId}/report:
    get:
      summary: セッションレポート取得
      tags: [Reports]
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: format
          in: query
          schema:
            type: string
            enum: [json, pdf]
            default: json
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Report'
            application/pdf:
              schema:
                type: string
                format: binary

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

  schemas:
    Session:
      type: object
      properties:
        id:
          type: string
          format: uuid
        userId:
          type: string
          format: uuid
        scenarioId:
          type: string
          format: uuid
        status:
          type: string
          enum: [pending, in_progress, completed, failed]
        startedAt:
          type: string
          format: date-time
        completedAt:
          type: string
          format: date-time
        duration:
          type: integer
          description: Duration in seconds

    SessionDetail:
      allOf:
        - $ref: '#/components/schemas/Session'
        - type: object
          properties:
            transcript:
              type: array
              items:
                $ref: '#/components/schemas/TranscriptEntry'
            analysisResults:
              $ref: '#/components/schemas/AnalysisResults'

    Report:
      type: object
      properties:
        sessionId:
          type: string
          format: uuid
        generatedAt:
          type: string
          format: date-time
        summary:
          type: string
        scores:
          type: array
          items:
            $ref: '#/components/schemas/Score'
        recommendations:
          type: array
          items:
            type: string

    Pagination:
      type: object
      properties:
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer
        hasNext:
          type: boolean
```

### API使用例

```bash
# セッション一覧取得
curl -X GET https://api.prance.ai/v1/sessions \
  -H "X-API-Key: pk_live_a1b2c3d4..." \
  -H "Content-Type: application/json"

# 新しいセッション作成
curl -X POST https://api.prance.ai/v1/sessions \
  -H "X-API-Key: pk_live_a1b2c3d4..." \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "scenarioId": "scenario_456",
    "metadata": {
      "source": "mobile_app",
      "version": "1.2.3"
    }
  }'

# レポート取得（PDF）
curl -X GET "https://api.prance.ai/v1/sessions/session_789/report?format=pdf" \
  -H "X-API-Key: pk_live_a1b2c3d4..." \
  -o report.pdf
```

---

## Webhook統合

### Webhookイベント

| イベント            | トリガー           | ペイロード           |
| ------------------- | ------------------ | -------------------- |
| `session.started`   | セッション開始時   | Session オブジェクト |
| `session.completed` | セッション完了時   | Session + 統計情報   |
| `session.failed`    | セッション失敗時   | Session + エラー情報 |
| `report.generated`  | レポート生成完了時 | Report オブジェクト  |
| `user.created`      | ユーザー作成時     | User オブジェクト    |
| `api_key.created`   | APIキー作成時      | APIKey メタデータ    |

### Webhook設定

```typescript
interface WebhookEndpoint {
  id: string;
  organizationId: string;
  url: string; // https://your-app.com/webhooks
  events: WebhookEvent[]; // ['session.completed', 'report.generated']

  // セキュリティ
  secret: string; // HMAC-SHA256署名用シークレット

  // 再試行設定
  retryPolicy: {
    maxAttempts: number; // 3
    backoffMultiplier: number; // 2
    initialDelay: number; // 1000ms
  };

  // 状態
  status: 'active' | 'disabled' | 'failed';
  lastTriggered?: Date;
  lastSuccess?: Date;
  failureCount: number;

  createdAt: Date;
  updatedAt: Date;
}
```

### Webhook配信フロー

```
イベント発生
  ↓
EventBridge にイベント送信
  ↓
Lambda: Webhook Dispatcher
  ↓
1. 該当組織のWebhook設定を取得
  ↓
2. ペイロード構築
  ↓
3. HMAC-SHA256署名生成
  ↓
4. HTTPSリクエスト送信
  ↓
5. レスポンス確認
   ├─ 2xx → 成功
   ├─ 4xx → 永続的エラー（再試行しない）
   └─ 5xx → 一時的エラー（再試行）
  ↓
6. 失敗時は指数バックオフで再試行（最大3回）
  ↓
7. 統計情報更新
```

### Webhook署名検証

```typescript
// Webhook受信側の検証コード
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Express.jsでの使用例
app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const payload = req.body.toString('utf8');

  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(payload);

  // イベント処理
  switch (event.type) {
    case 'session.completed':
      handleSessionCompleted(event.data);
      break;
    case 'report.generated':
      handleReportGenerated(event.data);
      break;
  }

  res.status(200).json({ received: true });
});
```

### Webhookペイロード例

```json
{
  "id": "evt_1234567890",
  "type": "session.completed",
  "created": 1678901234,
  "livemode": true,
  "data": {
    "sessionId": "session_abc123",
    "userId": "user_xyz789",
    "scenarioId": "scenario_def456",
    "status": "completed",
    "startedAt": "2026-03-05T10:30:00Z",
    "completedAt": "2026-03-05T11:00:00Z",
    "duration": 1800,
    "statistics": {
      "totalTurns": 45,
      "userSpeechTime": 780,
      "avatarSpeechTime": 920,
      "silenceDuration": 100
    },
    "reportUrl": "https://api.prance.ai/v1/sessions/session_abc123/report"
  }
}
```

---

## 使用状況トラッキング

### メトリクス収集

```typescript
// DynamoDBテーブル: APIUsageStats
interface APIUsageStats {
  PK: string; // 'KEY#{apiKeyId}'
  SK: string; // 'DATE#{YYYY-MM-DD}'

  apiKeyId: string;
  organizationId: string;
  date: string; // YYYY-MM-DD

  // リクエスト統計
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;

  // エンドポイント別
  endpointStats: {
    [endpoint: string]: {
      count: number;
      avgLatency: number;
      errorRate: number;
    };
  };

  // データ転送
  bytesIn: number;
  bytesOut: number;

  // レート制限
  rateLimitExceeded: number;

  ttl: number; // 90日後に自動削除
  updatedAt: string;
}

// 使用統計記録（非同期）
async function recordAPIUsage(
  apiKeyId: string,
  request: APIGatewayEvent,
  response: APIGatewayProxyResult,
  latency: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await dynamodb.update({
    TableName: 'APIUsageStats',
    Key: {
      PK: `KEY#${apiKeyId}`,
      SK: `DATE#${today}`,
    },
    UpdateExpression: `
      ADD totalRequests :inc,
          successfulRequests :success,
          failedRequests :failed,
          bytesIn :in,
          bytesOut :out
      SET endpointStats.#endpoint = if_not_exists(endpointStats.#endpoint, :empty),
          #ttl = :ttl,
          updatedAt = :now
    `,
    ExpressionAttributeNames: {
      '#endpoint': request.path,
      '#ttl': 'ttl',
    },
    ExpressionAttributeValues: {
      ':inc': 1,
      ':success': response.statusCode < 400 ? 1 : 0,
      ':failed': response.statusCode >= 400 ? 1 : 0,
      ':in': Buffer.byteLength(JSON.stringify(request.body || '')),
      ':out': Buffer.byteLength(response.body || ''),
      ':empty': { count: 0, avgLatency: 0, errorRate: 0 },
      ':ttl': Math.floor(Date.now() / 1000) + 90 * 86400, // 90日
      ':now': new Date().toISOString(),
    },
  });
}
```

### 使用状況ダッシュボード

```
┌──────────────────────────────────────────────────────────────┐
│ API使用状況                              [期間: 過去30日]     │
├──────────────────────────────────────────────────────────────┤
│ 📊 サマリー                                                   │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ リクエスト数     45,234 / 100,000 (45.2%)              │   │
│ │ 成功率          98.7% (44,652成功 / 582失敗)           │   │
│ │ 平均レイテンシ   234ms                                  │   │
│ │ データ転送      12.3 GB / 50 GB (24.6%)                │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📈 リクエスト推移                                             │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 2000│                                        ●          │   │
│ │     │                             ●──────●              │   │
│ │ 1500│                  ●──────●                         │   │
│ │     │       ●──────●                                    │   │
│ │ 1000│   ●                                                │   │
│ │     │                                                   │   │
│ │  500│                                                   │   │
│ │    └───┬───┬───┬───┬───┬───┬───                       │   │
│ │      3/1 3/5 3/10 3/15 3/20 3/25 3/30                  │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🔝 トップエンドポイント                                       │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ GET /sessions                   18,234 (40.3%)         │   │
│ │ GET /sessions/:id/report        12,456 (27.5%)         │   │
│ │ POST /sessions                   8,901 (19.7%)         │   │
│ │ GET /scenarios                   3,456 (7.6%)          │   │
│ │ その他                            2,187 (4.8%)          │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ⚠️ エラー分析                                                 │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 429 Too Many Requests           345 (59.3%)            │   │
│ │ 404 Not Found                   156 (26.8%)            │   │
│ │ 500 Internal Server Error        52 (8.9%)             │   │
│ │ 401 Unauthorized                 29 (5.0%)             │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## セキュリティ

### APIキーのベストプラクティス

```markdown
✅ DO:

- APIキーは環境変数に保存
- 本番キーとテストキーを分離
- 定期的にキーをローテーション（90日ごと推奨）
- IPホワイトリストを設定
- スコープを最小限に制限

❌ DON'T:

- コードにハードコード
- クライアントサイド（ブラウザ）で使用
- パブリックリポジトリにコミット
- 複数環境で同じキーを使用
- 全権限（\*）スコープを付与
```

### HTTPS必須

```typescript
// Lambda AuthorizerでHTTPS強制
if (event.headers['X-Forwarded-Proto'] !== 'https') {
  throw new Error('HTTPS required');
}
```

### IPホワイトリスト

```typescript
// APIキー設定
const apiKey = {
  allowedIPs: ['203.0.113.0/24', '198.51.100.50'],
};

// 検証
function checkIPWhitelist(clientIP: string, allowedIPs: string[]): boolean {
  if (!allowedIPs || allowedIPs.length === 0) {
    return true; // ホワイトリスト未設定 = すべて許可
  }

  return allowedIPs.some(range => {
    // CIDR範囲チェック（ip-rangecheckライブラリ使用）
    return ipRangeCheck(clientIP, range);
  });
}
```

---

## 実装ガイド

### Lambda関数構成

```
infrastructure/lambda/api/
├── authorizer.ts          # APIキー認証・レート制限
├── sessions/
│   ├── list.ts            # GET /sessions
│   ├── create.ts          # POST /sessions
│   ├── get.ts             # GET /sessions/:id
│   └── getReport.ts       # GET /sessions/:id/report
├── scenarios/
│   ├── list.ts            # GET /scenarios
│   └── get.ts             # GET /scenarios/:id
└── webhooks/
    ├── dispatcher.ts      # Webhook配信
    └── retry.ts           # 再試行処理
```

### API Gateway設定（CDK）

```typescript
// infrastructure/lib/stacks/api-gateway-stack.ts
import { RestApi, LambdaIntegration, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';

const api = new RestApi(this, 'ExternalAPI', {
  restApiName: 'Prance External API',
  description: 'External integration API',
  deployOptions: {
    stageName: 'v1',
    throttlingBurstLimit: 5000,
    throttlingRateLimit: 2000,
  },
});

// Lambda Authorizer
const authorizer = new TokenAuthorizer(this, 'APIKeyAuthorizer', {
  handler: authorizerLambda,
  identitySource: 'method.request.header.X-API-Key',
  resultsCacheTtl: Duration.minutes(5),
});

// /sessions エンドポイント
const sessions = api.root.addResource('sessions');

sessions.addMethod('GET', new LambdaIntegration(listSessionsLambda), {
  authorizer,
  authorizationType: AuthorizationType.CUSTOM,
});

sessions.addMethod('POST', new LambdaIntegration(createSessionLambda), {
  authorizer,
  authorizationType: AuthorizationType.CUSTOM,
});

// /sessions/:id エンドポイント
const sessionById = sessions.addResource('{sessionId}');

sessionById.addMethod('GET', new LambdaIntegration(getSessionLambda), {
  authorizer,
  authorizationType: AuthorizationType.CUSTOM,
});
```

---

## まとめ

外部連携APIシステムは、以下の価値を提供します：

✅ **プログラマティックアクセス**: 他システムとのシームレスな統合
✅ **セキュアな認証**: APIキー + JWT、スコープベース権限管理
✅ **スケーラブル**: 階層的レート制限、DynamoDB + Lambda
✅ **リアルタイム通知**: Webhook統合でイベント駆動型連携
✅ **透明性**: 詳細な使用状況トラッキング、OpenAPI仕様
✅ **拡張性**: バージョニング対応、段階的機能追加

このシステムにより、ATS、LMS、カスタムアプリケーション等の外部システムとの統合が容易になり、プラットフォームのエコシステムが拡大します。

---

**関連ドキュメント:**

- [API設計](../development/API_DESIGN.md)
- [認証・認可](../architecture/AUTHENTICATION.md)
- [ATS連携](ATS_INTEGRATION.md)
