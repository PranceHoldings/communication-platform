# ゲストユーザー機能 - 詳細実装計画

**バージョン:** 2.0
**作成日:** 2026-03-11
**前提:** `GUEST_USER_SYSTEM.md`（基本設計）完了
**ステータス:** 実装計画フェーズ

---

## 📋 目次

1. [調査計画](#調査計画)
2. [設計詳細](#設計詳細)
3. [実装計画](#実装計画)
4. [マイルストーン](#マイルストーン)
5. [リスク管理](#リスク管理)

---

## 調査計画

### 必要仕様調査（Week 0.5）

#### 調査1: 既存システムとの統合ポイント

**目的:** 現在のセッション管理・認証システムとの統合方法を明確化

**調査項目:**

1. **認証システム:**
   - [ ] 現在のCognito JWT認証フローを確認
   - [ ] ゲスト用JWT構造設計（`type: "guest"`フィールド追加）
   - [ ] API Gateway Authorizerの拡張方法調査

2. **セッション管理:**
   - [ ] 現在の`Session`モデルを確認
   - [ ] `isGuestSession`フラグ追加の影響範囲調査
   - [ ] ゲストセッションと通常セッションの差分整理

3. **WebSocket接続:**
   - [ ] `infrastructure/lambda/websocket/default/index.ts`の認証ロジック確認
   - [ ] ゲストトークンでのWebSocket認証方法設計

**成果物:**

- `docs/09-progress/GUEST_USER_INTEGRATION_ANALYSIS.md`
- 既存コード変更点リスト

#### 調査2: セキュリティ要件

**目的:** セキュアなゲストアクセス実装のための要件整理

**調査項目:**

1. **ブルートフォース対策:**
   - [ ] DynamoDBによるレート制限実装方法調査
   - [ ] API Gateway レート制限設定確認
   - [ ] ロックアウト期間の妥当性検証（10分 vs 30分 vs 1時間）

2. **トークン生成:**
   - [ ] UUID v4衝突確率計算（100万セッション想定）
   - [ ] PINコード生成アルゴリズム選定（crypto.randomInt vs Math.random）
   - [ ] トークン有効期限管理方法（DB vs JWT exp）

3. **データ隔離:**
   - [ ] RLS（Row Level Security）導入検討
   - [ ] Lambda関数レベルでのデータアクセス制限設計
   - [ ] ゲストが閲覧可能なデータ範囲明確化

**成果物:**

- `docs/08-operations/GUEST_USER_SECURITY.md`
- ペネトレーションテストシナリオ

#### 調査3: UI/UX要件

**目的:** ゲストユーザーの離脱率を最小化するUI設計

**調査項目:**

1. **ランディングページ:**
   - [ ] PIN入力フォームのベストプラクティス調査
   - [ ] モバイル対応（4桁PIN vs 6桁PIN、キーボード表示）
   - [ ] エラーメッセージの多言語対応

2. **セッション実行画面:**
   - [ ] 通常セッションとの差分UI確認
   - [ ] ゲスト向け簡略化要素（メニュー非表示、ダッシュボードリンク削除）
   - [ ] 進捗表示（残り時間、ステップ番号）

3. **完了画面:**
   - [ ] サンキューページのコンバージョン最適化
   - [ ] フィードバックフォーム追加検討
   - [ ] SNSシェアボタン（オプション）

**成果物:**

- `docs/04-design/GUEST_USER_UX_DESIGN.md`
- Figmaプロトタイプ（オプション）

#### 調査4: メール通知システム

**目的:** 招待メール送信の実装方法確定

**調査項目:**

1. **Amazon SES:**
   - [ ] SESアカウント設定確認（Production Access申請済み？）
   - [ ] 送信制限確認（現在の制限: X通/日）
   - [ ] バウンス・苦情処理設計

2. **テンプレート:**
   - [ ] HTMLメールテンプレート設計
   - [ ] プレーンテキスト版
   - [ ] 多言語対応（10言語）

3. **送信フロー:**
   - [ ] 同期送信 vs 非同期送信（SQS経由）
   - [ ] バッチ送信最適化（20件/秒制限対応）
   - [ ] 送信失敗リトライロジック

**成果物:**

- `docs/06-infrastructure/EMAIL_NOTIFICATION_DESIGN.md`
- メールテンプレート（HTML + Text）

---

## 設計詳細

### データベース設計（詳細版）

#### Prismaマイグレーション戦略

**マイグレーション1: guest_sessions テーブル作成**

```bash
cd packages/database
pnpm exec prisma migrate dev --name add_guest_sessions
```

**migration.sql:**

```sql
-- GuestSession テーブル
CREATE TABLE guest_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  creator_user_id UUID NOT NULL,
  session_id UUID UNIQUE,
  scenario_id UUID NOT NULL,
  avatar_id UUID,

  token VARCHAR(64) UNIQUE NOT NULL,
  pin_hash VARCHAR(256) NOT NULL,

  guest_name VARCHAR(255),
  guest_email VARCHAR(255),
  guest_metadata JSONB DEFAULT '{}',

  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP NOT NULL,

  access_count INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  first_accessed_at TIMESTAMP,
  completed_at TIMESTAMP,

  data_retention_days INTEGER,
  auto_delete_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  CONSTRAINT fk_scenario FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_avatar FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE SET NULL,

  CONSTRAINT chk_status CHECK (status IN ('pending', 'active', 'completed', 'expired', 'revoked')),
  CONSTRAINT chk_valid_dates CHECK (valid_until > valid_from)
);

CREATE INDEX idx_guest_sessions_token ON guest_sessions(token);
CREATE INDEX idx_guest_sessions_org_id ON guest_sessions(org_id);
CREATE INDEX idx_guest_sessions_status ON guest_sessions(status);
CREATE INDEX idx_guest_sessions_valid_until ON guest_sessions(valid_until);
CREATE INDEX idx_guest_sessions_auto_delete_at ON guest_sessions(auto_delete_at) WHERE auto_delete_at IS NOT NULL;

-- GuestSessionLog テーブル
CREATE TABLE guest_session_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_session_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_guest_session FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_guest_session_logs_guest_session_id ON guest_session_logs(guest_session_id);
CREATE INDEX idx_guest_session_logs_event_type ON guest_session_logs(event_type);
CREATE INDEX idx_guest_session_logs_created_at ON guest_session_logs(created_at);
```

**マイグレーション2: sessions テーブル拡張**

```sql
ALTER TABLE sessions
ADD COLUMN is_guest_session BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_sessions_is_guest_session ON sessions(is_guest_session);
CREATE INDEX idx_sessions_guest_session_id ON sessions(guest_session_id) WHERE guest_session_id IS NOT NULL;
```

#### DynamoDB設計（レート制限用）

**テーブル名:** `prance-guest-rate-limits-{env}`

**パーティションキー:** `ipAddress` (String)
**ソートキー:** `timestamp` (Number)

**TTL:** 600秒（10分）

**用途:** ブルートフォース対策、失敗回数カウント

**項目構造:**

```json
{
  "ipAddress": "203.0.113.42",
  "timestamp": 1710259200000,
  "token": "abc123xyz",
  "attempts": 3,
  "ttl": 1710259800
}
```

### API設計（詳細版）

#### Lambda関数構成

```
infrastructure/lambda/
├── guest-sessions/
│   ├── create/
│   │   └── index.ts         # POST /api/guest-sessions
│   ├── batch-create/
│   │   └── index.ts         # POST /api/guest-sessions/batch
│   ├── list/
│   │   └── index.ts         # GET /api/guest-sessions
│   ├── get/
│   │   └── index.ts         # GET /api/guest-sessions/:id
│   ├── update/
│   │   └── index.ts         # PATCH /api/guest-sessions/:id
│   ├── delete/
│   │   └── index.ts         # DELETE /api/guest-sessions/:id
│   └── get-logs/
│       └── index.ts         # GET /api/guest-sessions/:id/logs
├── guest/
│   ├── verify/
│   │   └── index.ts         # GET /api/guest/verify/:token
│   ├── auth/
│   │   └── index.ts         # POST /api/guest/auth
│   ├── get-session/
│   │   └── index.ts         # GET /api/guest/session
│   └── complete/
│       └── index.ts         # POST /api/guest/session/complete
└── shared/
    └── utils/
        ├── guestToken.ts    # JWT発行・検証
        ├── pinHash.ts       # bcrypt ハッシュ化
        ├── tokenGenerator.ts # UUID v4 + PIN生成
        └── rateLimiter.ts   # DynamoDB レート制限
```

#### 共有ユーティリティ実装

**`infrastructure/lambda/shared/utils/guestToken.ts`:**

```typescript
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface GuestTokenPayload {
  type: 'guest';
  guestSessionId: string;
  orgId: string;
  sessionId: string;
  scenarioId: string;
  avatarId?: string;
  exp: number;
  iat: number;
}

export function generateGuestToken(payload: Omit<GuestTokenPayload, 'type' | 'exp' | 'iat'>): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 24 * 60 * 60; // 24時間

  const fullPayload: GuestTokenPayload = {
    type: 'guest',
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  return jwt.sign(fullPayload, JWT_SECRET, { algorithm: 'HS256' });
}

export function verifyGuestToken(token: string): GuestTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || decoded.type !== 'guest') {
      throw new Error('Invalid guest token');
    }
    return decoded as GuestTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired guest token');
  }
}
```

**`infrastructure/lambda/shared/utils/pinHash.ts`:**

```typescript
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
```

**`infrastructure/lambda/shared/utils/tokenGenerator.ts`:**

```typescript
import { randomUUID, randomInt } from 'crypto';

export function generateToken(): string {
  // UUID v4（ハイフン除去）
  return randomUUID().replace(/-/g, '');
}

export function generatePin(length: number = 4): string {
  // 4-8桁ランダムPIN
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return randomInt(min, max + 1).toString();
}
```

**`infrastructure/lambda/shared/utils/rateLimiter.ts`:**

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = `prance-guest-rate-limits-${process.env.ENVIRONMENT}`;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 10 * 60 * 1000; // 10分

export interface RateLimitResult {
  allowed: boolean;
  attempts: number;
  lockedUntil?: Date;
}

export async function checkRateLimit(ipAddress: string, token: string): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - LOCKOUT_DURATION;

  // 過去10分間の試行回数を取得
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'ipAddress = :ip AND #ts > :windowStart',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':ip': ipAddress,
        ':windowStart': windowStart,
      },
    })
  );

  const attempts = result.Items?.length || 0;

  if (attempts >= MAX_ATTEMPTS) {
    const oldestAttempt = result.Items?.[0];
    const lockedUntil = new Date(oldestAttempt.timestamp + LOCKOUT_DURATION);

    return {
      allowed: false,
      attempts,
      lockedUntil,
    };
  }

  return {
    allowed: true,
    attempts,
  };
}

export async function recordAttempt(ipAddress: string, token: string): Promise<void> {
  const now = Date.now();

  await ddbDocClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ipAddress,
        timestamp: now,
        token,
        ttl: Math.floor((now + LOCKOUT_DURATION) / 1000),
      },
    })
  );
}
```

#### WebSocket認証拡張

**`infrastructure/lambda/websocket/default/index.ts` 修正:**

```typescript
// 既存の認証ロジック
import { verifyToken } from '../../shared/utils/auth';
import { verifyGuestToken } from '../../shared/utils/guestToken';

// authenticate メッセージハンドラ内
case 'authenticate':
  const authHeader = connectionData?.authToken;

  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  let userId: string;
  let orgId: string;
  let isGuest = false;
  let guestSessionId: string | undefined;

  try {
    // ゲストトークンかどうか判定
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyGuestToken(token);

    // ゲストセッション
    isGuest = true;
    guestSessionId = decoded.guestSessionId;
    orgId = decoded.orgId;
    userId = 'guest'; // ゲストユーザーIDプレースホルダー

    console.log('[WebSocket] Guest session authenticated:', {
      guestSessionId,
      orgId,
    });
  } catch (guestError) {
    // 通常のJWTトークン
    const userData = verifyToken(authHeader);
    userId = userData.sub;
    orgId = userData.orgId;

    console.log('[WebSocket] Regular user authenticated:', {
      userId,
      orgId,
    });
  }

  await updateConnectionData(connectionId, {
    userId,
    orgId,
    isGuest,
    guestSessionId,
    sessionId: message.sessionId,
    scenarioLanguage: message.scenarioLanguage,
    scenarioPrompt: message.scenarioPrompt,
    // ... その他のフィールド
  });

  break;
```

### セキュリティ設計（詳細版）

#### ブルートフォース対策実装

**フロー:**

```
1. ゲストがPIN入力 → POST /api/guest/auth

2. Lambda関数内:
   a. IPアドレス取得（event.requestContext.identity.sourceIp）
   b. checkRateLimit(ipAddress, token)
      - DynamoDB Query: 過去10分間の試行回数
      - attempts >= 5 → locked

   c. locked の場合:
      - 403 Forbidden
      - レスポンス: { error: 'locked', lockedUntil: '2026-03-11T11:00:00Z' }

   d. allowed の場合:
      - PIN検証（bcrypt.compare）
      - 成功 → JWT発行、attempts=0にリセット
      - 失敗 → recordAttempt(ipAddress, token)
                403 Forbidden
                レスポンス: { error: 'invalid_pin', remainingAttempts: 5-attempts }

3. Frontend:
   - lockedの場合: PINフォーム無効化、カウントダウン表示
   - remainingAttemptsの場合: 警告メッセージ表示
```

#### データ隔離実装

**Lambda関数内でのアクセス制御:**

```typescript
// GET /api/guest/session 内
export const handler = async (event: APIGatewayProxyEvent) => {
  const guestToken = event.headers.Authorization?.replace('Bearer ', '');
  const payload = verifyGuestToken(guestToken);

  // ゲストは自分のセッションデータのみ取得可能
  const session = await prisma.session.findUnique({
    where: {
      id: payload.sessionId,
      guestSessionId: payload.guestSessionId, // 二重チェック
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      // 録画URLは除外
      // transcripts: 除外
      // emotionAnalyses: 除外
      // score: 除外
    },
  });

  if (!session) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Session not found' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ session }),
  };
};
```

#### GDPR対応: 自動削除機能

**EventBridge Rule + Lambda:**

```yaml
# infrastructure/lib/guest-session-cleanup-stack.ts
const cleanupRule = new events.Rule(this, 'GuestSessionCleanupRule', {
  schedule: events.Schedule.rate(cdk.Duration.hours(1)), // 1時間ごと
  description: 'Clean up expired guest session data',
});

const cleanupFunction = new nodejs.NodejsFunction(this, 'CleanupFunction', {
  entry: path.join(__dirname, '../lambda/guest-sessions/cleanup/index.ts'),
  timeout: cdk.Duration.minutes(15),
});

cleanupRule.addTarget(new targets.LambdaFunction(cleanupFunction));
```

**`infrastructure/lambda/guest-sessions/cleanup/index.ts`:**

```typescript
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async () => {
  const now = new Date();

  // auto_delete_at が過去のゲストセッションを取得
  const expiredSessions = await prisma.guestSession.findMany({
    where: {
      autoDeleteAt: {
        lte: now,
      },
    },
    include: {
      session: {
        include: {
          recordings: true,
          transcripts: true,
        },
      },
    },
  });

  console.log(`[Cleanup] Found ${expiredSessions.length} expired guest sessions`);

  for (const guestSession of expiredSessions) {
    try {
      // S3から録画データ削除
      if (guestSession.session) {
        const s3Keys = guestSession.session.recordings.map((r) => ({ Key: r.s3Key }));

        if (s3Keys.length > 0) {
          await s3Client.send(
            new DeleteObjectsCommand({
              Bucket: process.env.S3_BUCKET,
              Delete: { Objects: s3Keys },
            })
          );
        }

        // DBからセッションデータ削除（CASCADE）
        await prisma.session.delete({
          where: { id: guestSession.session.id },
        });
      }

      // ゲストセッション削除
      await prisma.guestSession.delete({
        where: { id: guestSession.id },
      });

      console.log(`[Cleanup] Deleted guest session: ${guestSession.id}`);
    } catch (error) {
      console.error(`[Cleanup] Error deleting guest session ${guestSession.id}:`, error);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      deleted: expiredSessions.length,
    }),
  };
};
```

---

## 実装計画

### Phase 1: データベース・共有ユーティリティ（Week 1）

#### Day 1-2: Prismaスキーマ・マイグレーション

**タスク:**

- [ ] Prismaスキーマに `GuestSession`, `GuestSessionLog`, `GuestSessionStatus` 追加
- [ ] マイグレーション生成: `pnpm exec prisma migrate dev --name add_guest_sessions`
- [ ] マイグレーション実行・検証
- [ ] `Session` モデルに `isGuestSession`, `guestSessionId` 追加
- [ ] 単体テスト（スキーマ検証）

**コマンド:**

```bash
cd packages/database
pnpm exec prisma migrate dev --name add_guest_sessions
pnpm exec prisma generate
pnpm run test -- guest-session.test.ts
```

#### Day 3-4: 共有ユーティリティ実装

**タスク:**

- [ ] `guestToken.ts` 実装（JWT発行・検証）
- [ ] `pinHash.ts` 実装（bcrypt）
- [ ] `tokenGenerator.ts` 実装（UUID v4 + PIN）
- [ ] `rateLimiter.ts` 実装（DynamoDB）
- [ ] DynamoDB テーブル作成（CDK）
- [ ] 単体テスト（全ユーティリティ）

**成果物:**

```
infrastructure/lambda/shared/utils/
├── guestToken.ts
├── pinHash.ts
├── tokenGenerator.ts
└── rateLimiter.ts

infrastructure/lib/
└── guest-rate-limit-stack.ts
```

#### Day 5-7: Lambda関数共通基盤

**タスク:**

- [ ] Lambda関数ベーステンプレート作成
- [ ] エラーハンドリング共通化
- [ ] ログ記録ユーティリティ
- [ ] API Gateway設定（CORS、レート制限）
- [ ] CDK Stack作成（`GuestSessionStack`）

**成果物:**

- `infrastructure/lib/guest-session-stack.ts`
- `infrastructure/lambda/shared/types/guest.ts`

---

### Phase 2: API実装（Week 2）

#### Day 1-2: ゲストセッション作成API

**POST `/api/guest-sessions`:**

```typescript
// infrastructure/lambda/guest-sessions/create/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { generateToken, generatePin } from '../../shared/utils/tokenGenerator';
import { hashPin } from '../../shared/utils/pinHash';
import { verifyToken } from '../../shared/utils/auth';

const prisma = new PrismaClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // 認証チェック
    const authHeader = event.headers.Authorization;
    const userData = verifyToken(authHeader);

    // リクエストボディ解析
    const body = JSON.parse(event.body || '{}');
    const { scenarioId, avatarId, guestName, guestEmail, guestMetadata, validUntil, dataRetentionDays, pinCode } = body;

    // バリデーション
    if (!scenarioId || !validUntil) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: scenarioId, validUntil' }),
      };
    }

    // トークン・PIN生成
    const token = generateToken();
    const pin = pinCode || generatePin(4);
    const pinHash = await hashPin(pin);

    // 有効期限チェック
    const validUntilDate = new Date(validUntil);
    if (validUntilDate <= new Date()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'validUntil must be in the future' }),
      };
    }

    // auto_delete_at 計算
    let autoDeleteAt: Date | undefined;
    if (dataRetentionDays) {
      autoDeleteAt = new Date(validUntilDate.getTime() + dataRetentionDays * 24 * 60 * 60 * 1000);
    }

    // ゲストセッション作成
    const guestSession = await prisma.guestSession.create({
      data: {
        orgId: userData.orgId,
        creatorUserId: userData.sub,
        scenarioId,
        avatarId,
        token,
        pinHash,
        guestName,
        guestEmail,
        guestMetadata: guestMetadata || {},
        status: 'PENDING',
        validFrom: new Date(),
        validUntil: validUntilDate,
        dataRetentionDays,
        autoDeleteAt,
      },
    });

    // レスポンス
    const inviteUrl = `${process.env.FRONTEND_URL}/guest/${token}`;

    return {
      statusCode: 201,
      body: JSON.stringify({
        guestSession: {
          id: guestSession.id,
          token,
          pinCode: pin, // ⚠️ レスポンスにのみ含める（DBには保存しない）
          inviteUrl,
          status: guestSession.status,
          validFrom: guestSession.validFrom,
          validUntil: guestSession.validUntil,
          createdAt: guestSession.createdAt,
        },
      }),
    };
  } catch (error) {
    console.error('[CreateGuestSession] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
```

**POST `/api/guest-sessions/batch`:**

（同様のロジック、複数件を一括作成、CSVエクスポート機能追加）

#### Day 3-4: ゲスト認証API

**GET `/api/guest/verify/:token`:**

```typescript
// トークン検証（PIN入力前）
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const token = event.pathParameters?.token;

  const guestSession = await prisma.guestSession.findUnique({
    where: { token },
    include: {
      scenario: { select: { title: true } },
      avatar: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!guestSession) {
    return {
      statusCode: 404,
      body: JSON.stringify({ valid: false, reason: 'not_found' }),
    };
  }

  // ステータスチェック
  if (guestSession.status === 'REVOKED') {
    return {
      statusCode: 403,
      body: JSON.stringify({ valid: false, reason: 'revoked' }),
    };
  }

  if (guestSession.status === 'EXPIRED' || new Date() > guestSession.validUntil) {
    return {
      statusCode: 403,
      body: JSON.stringify({ valid: false, reason: 'expired' }),
    };
  }

  if (guestSession.status === 'COMPLETED') {
    return {
      statusCode: 403,
      body: JSON.stringify({ valid: false, reason: 'completed' }),
    };
  }

  // 有効
  return {
    statusCode: 200,
    body: JSON.stringify({
      valid: true,
      scenarioTitle: guestSession.scenario.title,
      avatarName: guestSession.avatar?.name,
      validUntil: guestSession.validUntil,
      organizationName: guestSession.organization.name,
    }),
  };
};
```

**POST `/api/guest/auth`:**

（前述の `rateLimiter`, `pinHash` を使用した認証ロジック）

#### Day 5-7: その他API実装

- [ ] `GET /api/guest-sessions` - 一覧
- [ ] `GET /api/guest-sessions/:id` - 詳細
- [ ] `PATCH /api/guest-sessions/:id` - 更新
- [ ] `DELETE /api/guest-sessions/:id` - 無効化
- [ ] `GET /api/guest-sessions/:id/logs` - ログ
- [ ] `GET /api/guest/session` - ゲストセッション情報
- [ ] `POST /api/guest/session/complete` - セッション完了

---

### Phase 3: UI実装（Week 3）

#### Day 1-3: ゲストセッション作成UI

**ファイル構成:**

```
apps/web/app/dashboard/guest-sessions/
├── page.tsx                 # 一覧画面
├── create/
│   └── page.tsx             # 作成画面（3ステップウィザード）
├── [id]/
│   └── page.tsx             # 詳細画面
└── layout.tsx

apps/web/components/guest-session/
├── CreateWizard.tsx         # 作成ウィザード
├── GuestSessionList.tsx     # 一覧テーブル
├── GuestSessionCard.tsx     # カード表示
├── StatusBadge.tsx          # ステータスバッジ
└── InviteModal.tsx          # 招待情報モーダル
```

**`apps/web/app/dashboard/guest-sessions/create/page.tsx`:**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateWizard from '@/components/guest-session/CreateWizard';
import { useI18n } from '@/lib/i18n/provider';

export default function CreateGuestSessionPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(1);

  const handleComplete = (guestSession: any) => {
    // 作成完了 → 詳細画面へ
    router.push(`/dashboard/guest-sessions/${guestSession.id}`);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">
        {t('guestSessions.create.title')}
      </h1>

      <CreateWizard
        currentStep={step}
        onStepChange={setStep}
        onComplete={handleComplete}
      />
    </div>
  );
}
```

#### Day 4-5: ゲストランディングページ

**`apps/web/app/guest/[token]/page.tsx`:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import PinInput from '@/components/guest-session/PinInput';

export default function GuestLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/guest/verify/${token}`);
      const data = await response.json();

      if (!data.valid) {
        setError(data.reason);
        return;
      }

      setSessionInfo(data);
    } catch (err) {
      setError('network_error');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (pin: string) => {
    try {
      const response = await fetch('/api/guest/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pinCode: pin }),
      });

      const data = await response.json();

      if (data.success) {
        // JWT保存
        localStorage.setItem('guestToken', data.guestToken);
        // セッション画面へ
        router.push(`/guest/${token}/session`);
      } else {
        // エラー表示
        setError(data.error);
      }
    } catch (err) {
      setError('network_error');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            {t(`guestSessions.errors.${error}`)}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Logo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {t('guestSessions.landing.title')}
          </h1>
          <p className="text-gray-600">
            {t('guestSessions.landing.organizer')}: {sessionInfo.organizationName}
          </p>
          <p className="text-gray-600">
            {t('guestSessions.landing.scenario')}: {sessionInfo.scenarioTitle}
          </p>
        </div>

        <PinInput onSubmit={handlePinSubmit} />

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>⏱️ {t('guestSessions.landing.validUntil', { date: sessionInfo.validUntil })}</p>
          <p className="mt-2">⚠️ {t('guestSessions.landing.recordingNotice')}</p>
        </div>
      </div>
    </div>
  );
}
```

#### Day 6-7: ゲストセッション実行UI

- セッションプレイヤーをゲストモード対応
- 完了画面実装
- エラーハンドリング

---

### Phase 4: 通知・自動化（Week 4）

#### Day 1-3: メール通知

**Amazon SES統合:**

```typescript
// infrastructure/lambda/notifications/send-invite-email/index.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION });

export async function sendInviteEmail(params: {
  to: string;
  guestName: string;
  inviteUrl: string;
  pinCode: string;
  scenarioTitle: string;
  validUntil: Date;
  language: string;
}) {
  const template = getEmailTemplate(params.language);

  const command = new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [params.to],
    },
    Message: {
      Subject: {
        Data: template.subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: template.html
            .replace('{{guestName}}', params.guestName)
            .replace('{{inviteUrl}}', params.inviteUrl)
            .replace('{{pinCode}}', params.pinCode)
            .replace('{{scenarioTitle}}', params.scenarioTitle)
            .replace('{{validUntil}}', params.validUntil.toISOString()),
          Charset: 'UTF-8',
        },
        Text: {
          Data: template.text
            .replace('{{guestName}}', params.guestName)
            .replace('{{inviteUrl}}', params.inviteUrl)
            .replace('{{pinCode}}', params.pinCode)
            .replace('{{scenarioTitle}}', params.scenarioTitle)
            .replace('{{validUntil}}', params.validUntil.toISOString()),
          Charset: 'UTF-8',
        },
      },
    },
  });

  await sesClient.send(command);
}
```

#### Day 4-7: 自動化タスク

- 有効期限切れセッション自動無効化
- データ自動削除（GDPR対応）
- 統合テスト・デプロイ

---

## マイルストーン

| マイルストーン                 | 期間   | 成果物                                                     |
| ------------------------------ | ------ | ---------------------------------------------------------- |
| M1: データベース・基盤         | Week 1 | Prismaスキーマ、共有ユーティリティ、CDK Stack              |
| M2: API実装                    | Week 2 | 全Lambda関数、API統合テスト                                |
| M3: UI実装                     | Week 3 | ゲストセッション作成・管理・実行画面                       |
| M4: 通知・自動化               | Week 4 | メール送信、自動削除、E2Eテスト                            |
| M5: 本番デプロイ               | Week 5 | セキュリティ監査、負荷テスト、本番リリース                 |

---

## リスク管理

| リスク                   | 影響度 | 発生確率 | 対策                                                   |
| ------------------------ | ------ | -------- | ------------------------------------------------------ |
| セキュリティ脆弱性       | 高     | 中       | ペネトレーションテスト、セキュリティ監査               |
| メール送信制限           | 中     | 高       | SES Production Access申請、送信制限緩和申請            |
| ブルートフォース攻撃     | 中     | 中       | レート制限強化、IP ブロックリスト                      |
| データ削除事故           | 高     | 低       | Soft Delete実装、削除前確認、バックアップ              |
| 負荷テスト不足           | 中     | 中       | 100同時セッション負荷テスト、Auto Scaling設定確認      |

---

## 次のステップ

1. **調査フェーズ完了確認:**
   - [ ] 既存システム統合ポイント調査完了
   - [ ] セキュリティ要件調査完了
   - [ ] UI/UX要件調査完了
   - [ ] メール通知システム調査完了

2. **実装開始:**
   - [ ] Phase 1 Week 1 開始（データベース・基盤）
   - [ ] マイルストーンM1達成確認

3. **継続的レビュー:**
   - 週次進捗レビュー
   - セキュリティチェックリスト確認
   - ユーザビリティテスト（Phase 3完了後）

---

**最終更新:** 2026-03-11 16:00 JST
**次回レビュー:** Lambda デプロイ完了後、Phase 1.5テスト結果確認
