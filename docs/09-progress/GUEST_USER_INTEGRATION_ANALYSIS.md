# ゲストユーザー機能 - 既存システム統合分析

**作成日:** 2026-03-11
**ステータス:** 調査フェーズ（Week 0.5）

---

## 📋 目次

1. [既存認証システム分析](#既存認証システム分析)
2. [セッション管理分析](#セッション管理分析)
3. [WebSocket接続分析](#websocket接続分析)
4. [統合ポイント設計](#統合ポイント設計)
5. [実装方針](#実装方針)

---

## 既存認証システム分析

### 現在のJWT認証フロー

```
┌─────────┐         ┌──────────────┐         ┌─────────────┐
│ Client  │         │ API Gateway  │         │ Lambda      │
└────┬────┘         └──────┬───────┘         └──────┬──────┘
     │                     │                        │
     │ 1. POST /login      │                        │
     │────────────────────>│                        │
     │   {email, password} │                        │
     │                     │  2. Invoke             │
     │                     │───────────────────────>│
     │                     │                        │
     │                     │  3. JWT発行            │
     │                     │<───────────────────────│
     │  4. JWT返却         │  {accessToken, ...}    │
     │<────────────────────│                        │
     │                     │                        │
     │ 5. API Request      │                        │
     │────────────────────>│                        │
     │  Authorization:     │                        │
     │  Bearer <JWT>       │  6. Lambda Authorizer  │
     │                     │───────────────────────>│
     │                     │     verifyToken()      │
     │                     │                        │
     │                     │  7. Allow Policy       │
     │                     │<───────────────────────│
     │                     │    + context {userId,  │
     │                     │       email, role,     │
     │                     │       orgId}           │
     │                     │                        │
     │                     │  8. Lambda実行         │
     │                     │───────────────────────>│
     │                     │  event.requestContext  │
     │                     │    .authorizer         │
     │                     │                        │
     │  9. Response        │                        │
     │<────────────────────│                        │
```

### JWTペイロード構造

**現在の構造:**

```typescript
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';
  orgId: string;
  iat?: number;  // 発行時刻
  exp?: number;  // 有効期限
}
```

**ゲストユーザー用に拡張が必要:**

```typescript
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';  // ✅ GUEST追加
  orgId: string;

  // ゲスト専用フィールド（オプション）
  type?: 'user' | 'guest';  // ✅ ユーザータイプ識別
  guestSessionId?: string;  // ✅ ゲストセッションID
  sessionId?: string;       // ✅ 紐づくセッションID

  iat?: number;
  exp?: number;
}
```

### 既存JWT生成コード

**場所:** `infrastructure/lambda/shared/auth/jwt.ts`

```typescript
// 現在の実装
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });  // 24時間
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    // エラーハンドリング
  }
};
```

**統合ポイント:**

- ✅ **再利用可能:** 既存の`generateAccessToken`関数をそのまま使用可能
- ✅ **検証ロジック:** `verifyToken`も再利用可能
- ⚠️ **型定義拡張が必要:** `JWTPayload`に`type`と`guestSessionId`を追加

---

## セッション管理分析

### 現在のセッション作成フロー

**Lambda関数:** `infrastructure/lambda/sessions/create/index.ts`

```typescript
// 簡略化した疑似コード
export const handler = async (event) => {
  const user = getUserFromEvent(event);  // JWT検証

  const session = await prisma.session.create({
    data: {
      userId: user.userId,
      orgId: user.orgId,
      scenarioId: body.scenarioId,
      avatarId: body.avatarId,
      status: 'ACTIVE',
    },
  });

  return { statusCode: 201, body: JSON.stringify({ session }) };
};
```

### Prismaスキーマ（Session）

**現在の構造:**

```prisma
model Session {
  id               String        @id @default(uuid())
  userId           String        @map("user_id")
  orgId            String        @map("org_id")
  scenarioId       String?       @map("scenario_id")
  avatarId         String?       @map("avatar_id")
  status           SessionStatus @default(ACTIVE)
  startedAt        DateTime      @default(now()) @map("started_at")
  endedAt          DateTime?     @map("ended_at")
  durationSec      Int?          @map("duration_sec")
  metadataJson     Json?         @map("metadata_json")

  user             User          @relation(fields: [userId], references: [id])
  organization     Organization  @relation(fields: [orgId], references: [id])
  scenario         Scenario?     @relation(fields: [scenarioId], references: [id])
  avatar           Avatar?       @relation(fields: [avatarId], references: [id])

  // ... その他のリレーション
}
```

**ゲストユーザー対応のための拡張:**

```prisma
model Session {
  // ... 既存フィールド

  // ✅ ゲストセッション対応フィールド（追加）
  isGuestSession Boolean @default(false) @map("is_guest_session")
  guestSessionId String? @map("guest_session_id")

  // ✅ ゲストセッションリレーション（追加）
  guestSession   GuestSession? @relation(fields: [guestSessionId], references: [id])

  @@index([isGuestSession])
  @@index([guestSessionId])
}
```

### 統合ポイント

1. **セッション作成ロジックの分岐:**
   ```typescript
   // 通常ユーザー
   if (user.type === 'user') {
     const session = await prisma.session.create({
       data: {
         userId: user.userId,
         orgId: user.orgId,
         isGuestSession: false,
         // ...
       },
     });
   }

   // ゲストユーザー
   if (user.type === 'guest') {
     const session = await prisma.session.create({
       data: {
         userId: guestSession.creatorUserId,  // 作成者のID
         orgId: user.orgId,
         isGuestSession: true,
         guestSessionId: user.guestSessionId,
         // ...
       },
     });
   }
   ```

2. **データアクセス制御:**
   ```typescript
   // ゲストは自己のセッションのみ取得可能
   if (user.type === 'guest') {
     const session = await prisma.session.findUnique({
       where: {
         id: sessionId,
         guestSessionId: user.guestSessionId,  // 二重チェック
       },
       select: {
         id: true,
         status: true,
         startedAt: true,
         // 録画URLは除外
         // transcripts: 除外
         // score: 除外
       },
     });
   }
   ```

---

## WebSocket接続分析

### 現在のWebSocket認証フロー

**Lambda関数:** `infrastructure/lambda/websocket/default/index.ts`

**authenticate メッセージハンドラ（現在）:**

```typescript
case 'authenticate':
  const sessionId = message.sessionId as string;
  const scenarioLanguage = (message as any).scenarioLanguage || DEFAULT_SCENARIO_LANGUAGE;

  // DynamoDBに接続データを保存
  await updateConnectionData(connectionId, {
    sessionId,
    conversationHistory: initialConversationHistory,
    scenarioLanguage,
    scenarioPrompt,
    initialGreeting,
    silenceTimeout,
    enableSilencePrompt,
  });

  // 認証完了通知
  await sendToConnection(connectionId, {
    type: 'authenticated',
    message: 'Session initialized',
    sessionId,
  });
  break;
```

### ゲストユーザー対応のための拡張

**修正後の authenticate ハンドラ:**

```typescript
case 'authenticate':
  const authHeader = connectionData?.authToken;  // ✅ JWT取得

  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  let userId: string;
  let orgId: string;
  let isGuest = false;
  let guestSessionId: string | undefined;

  try {
    // ✅ ゲストトークンかどうか判定
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);

    if (decoded.type === 'guest') {
      // ✅ ゲストセッション
      isGuest = true;
      guestSessionId = decoded.guestSessionId;
      orgId = decoded.orgId;
      userId = 'guest';  // プレースホルダー

      console.log('[WebSocket] Guest session authenticated:', {
        guestSessionId,
        orgId,
      });
    } else {
      // 通常ユーザー
      userId = decoded.userId;
      orgId = decoded.orgId;

      console.log('[WebSocket] Regular user authenticated:', {
        userId,
        orgId,
      });
    }
  } catch (error) {
    console.error('[WebSocket] Authentication failed:', error);
    throw new Error('Invalid or expired token');
  }

  // DynamoDBに接続データを保存
  await updateConnectionData(connectionId, {
    userId,
    orgId,
    isGuest,  // ✅ ゲストフラグ
    guestSessionId,  // ✅ ゲストセッションID
    sessionId: message.sessionId,
    // ... その他のフィールド
  });

  break;
```

### DynamoDB接続データ構造の拡張

**現在の構造:**

```typescript
interface ConnectionData {
  connectionId: string;
  userId?: string;
  sessionId?: string;
  conversationHistory?: any[];
  scenarioLanguage?: string;
  scenarioPrompt?: string;
  // ...
}
```

**ゲスト対応後:**

```typescript
interface ConnectionData {
  connectionId: string;
  userId?: string;
  sessionId?: string;

  // ✅ ゲスト関連フィールド（追加）
  isGuest?: boolean;
  guestSessionId?: string;

  conversationHistory?: any[];
  scenarioLanguage?: string;
  scenarioPrompt?: string;
  // ...
}
```

---

## 統合ポイント設計

### 統合ポイント1: JWT生成・検証

**既存コード:** `infrastructure/lambda/shared/auth/jwt.ts`

**修正内容:**

1. **型定義拡張:**
   ```typescript
   // infrastructure/lambda/shared/types/index.ts
   export interface JWTPayload {
     userId: string;
     email: string;
     role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';  // ✅
     orgId: string;
     type?: 'user' | 'guest';  // ✅
     guestSessionId?: string;  // ✅
     sessionId?: string;       // ✅
     iat?: number;
     exp?: number;
   }
   ```

2. **ゲスト用JWT生成関数（新規作成）:**
   ```typescript
   // infrastructure/lambda/shared/auth/guest-token.ts
   export const generateGuestToken = (payload: {
     guestSessionId: string;
     orgId: string;
     sessionId: string;
   }): string => {
     const fullPayload: JWTPayload = {
       userId: 'guest',  // プレースホルダー
       email: 'guest@system',  // プレースホルダー
       role: 'GUEST',
       type: 'guest',
       orgId: payload.orgId,
       guestSessionId: payload.guestSessionId,
       sessionId: payload.sessionId,
     };

     return generateAccessToken(fullPayload);  // 既存関数を再利用
   };
   ```

3. **検証ロジック拡張:**
   ```typescript
   // 既存の verifyToken() は変更不要（そのまま使用）

   // ゲストトークン専用検証（オプション）
   export const verifyGuestToken = (token: string): JWTPayload => {
     const decoded = verifyToken(token);  // 既存関数を再利用

     if (decoded.type !== 'guest') {
       throw new AuthenticationError('Not a guest token');
     }

     return decoded;
   };
   ```

### 統合ポイント2: Lambda Authorizer

**既存コード:** `infrastructure/lambda/auth/authorizer/index.ts`

**修正内容:**

**⚠️ ゲストユーザーは Lambda Authorizer を通さない**

ゲストユーザーは専用エンドポイント（`/api/guest/*`）を使用し、Lambda Authorizer をバイパスします。

**理由:**
- Lambda Authorizer は内部ユーザー（SUPER_ADMIN, CLIENT_ADMIN, CLIENT_USER）用
- ゲストユーザーは独自の認証フロー（トークン + PIN）
- API Gateway の設定で `/api/guest/*` パスは Authorizer を適用しない

**API Gateway設定（CDK）:**

```typescript
// infrastructure/lib/api-lambda-stack.ts

// 内部ユーザーAPI（Authorizerあり）
const usersResource = api.root.addResource('api').addResource('v1').addResource('users');
usersResource.addMethod('GET', new apigateway.LambdaIntegration(listUsersFunction), {
  authorizer: authorizer,  // ✅ Lambda Authorizer適用
});

// ゲストユーザーAPI（Authorizerなし）
const guestResource = api.root.addResource('api').addResource('guest');
guestResource.addResource('verify').addResource('{token}').addMethod(
  'GET',
  new apigateway.LambdaIntegration(verifyGuestTokenFunction),
  {
    authorizer: undefined,  // ✅ Authorizerなし（Public）
  }
);

guestResource.addResource('auth').addMethod(
  'POST',
  new apigateway.LambdaIntegration(authGuestFunction),
  {
    authorizer: undefined,  // ✅ Authorizerなし（Public）
  }
);

guestResource.addResource('session').addMethod(
  'GET',
  new apigateway.LambdaIntegration(getGuestSessionFunction),
  {
    authorizer: undefined,  // ❌ Authorizerなし
    // ⚠️ Lambda関数内でゲストJWT検証を行う
  }
);
```

### 統合ポイント3: WebSocket接続

**既存コード:** `infrastructure/lambda/websocket/default/index.ts`

**修正内容:**

前述の「WebSocket接続分析」セクションで詳細を記載済み。

**主な変更点:**
1. `authenticate` メッセージハンドラでゲストトークン検証
2. DynamoDB接続データに `isGuest`, `guestSessionId` 追加
3. ゲストの場合は `userId` を `'guest'` プレースホルダーに設定

---

## 実装方針

### Phase 1: 型定義・共通ユーティリティ（Week 1 Day 1-4）

**タスク:**

1. **型定義拡張:**
   - [ ] `JWTPayload` に `type`, `guestSessionId`, `sessionId` 追加
   - [ ] `ConnectionData` に `isGuest`, `guestSessionId` 追加

2. **ゲスト用JWT関数作成:**
   - [ ] `generateGuestToken()` 実装
   - [ ] `verifyGuestToken()` 実装（オプション）
   - [ ] 単体テスト作成

3. **PINハッシュユーティリティ:**
   - [ ] `hashPin()` 実装（bcrypt）
   - [ ] `verifyPin()` 実装
   - [ ] 単体テスト作成

4. **トークン生成ユーティリティ:**
   - [ ] `generateToken()` 実装（UUID v4）
   - [ ] `generatePin()` 実装（4-8桁ランダム）
   - [ ] 単体テスト作成

**成果物:**

```
infrastructure/lambda/shared/
├── auth/
│   ├── jwt.ts                    # 既存（修正なし）
│   └── guest-token.ts            # ✅ 新規作成
├── utils/
│   ├── pinHash.ts                # ✅ 新規作成
│   └── tokenGenerator.ts         # ✅ 新規作成
└── types/
    └── index.ts                  # ✅ JWTPayload拡張
```

### Phase 2: Prismaスキーマ・マイグレーション（Week 1 Day 5-7）

**タスク:**

1. **Prismaスキーマ追加:**
   - [ ] `GuestSession` モデル作成
   - [ ] `GuestSessionLog` モデル作成
   - [ ] `GuestSessionStatus` Enum作成
   - [ ] `Session` モデルに `isGuestSession`, `guestSessionId` 追加

2. **マイグレーション生成:**
   ```bash
   cd packages/database
   pnpm exec prisma migrate dev --name add_guest_sessions
   ```

3. **マイグレーション実行・検証:**
   - [ ] ローカルデータベースで実行
   - [ ] テストデータ投入
   - [ ] リレーション動作確認

**成果物:**

```
packages/database/
├── prisma/
│   ├── schema.prisma             # ✅ GuestSession追加
│   └── migrations/
│       └── YYYYMMDDHHMMSS_add_guest_sessions/
│           └── migration.sql     # ✅ 新規マイグレーション
```

### Phase 3: WebSocket認証拡張（Week 2 Day 1-2）

**タスク:**

1. **authenticate ハンドラ修正:**
   - [ ] ゲストトークン検証ロジック追加
   - [ ] `isGuest`, `guestSessionId` をDynamoDBに保存
   - [ ] エラーハンドリング強化

2. **DynamoDB接続データスキーマ更新:**
   - [ ] `ConnectionData` 型定義更新
   - [ ] 既存コードへの影響確認

3. **単体テスト:**
   - [ ] 通常ユーザー認証テスト
   - [ ] ゲストユーザー認証テスト
   - [ ] 無効なトークンテスト

**成果物:**

```
infrastructure/lambda/websocket/default/
└── index.ts                      # ✅ authenticate ハンドラ修正
```

### Phase 4: API Gateway設定（Week 2 Day 3-4）

**タスク:**

1. **CDK Stack更新:**
   - [ ] `/api/guest/*` リソース作成
   - [ ] Lambda Authorizer適用除外設定
   - [ ] CORS設定

2. **Lambda関数作成:**
   - [ ] `GET /api/guest/verify/:token` 関数
   - [ ] `POST /api/guest/auth` 関数
   - [ ] `GET /api/guest/session` 関数

3. **デプロイ・検証:**
   - [ ] dev環境デプロイ
   - [ ] Postmanでエンドポイントテスト

**成果物:**

```
infrastructure/
├── lib/
│   └── api-lambda-stack.ts       # ✅ ゲストAPIリソース追加
└── lambda/
    └── guest/
        ├── verify/
        │   └── index.ts          # ✅ 新規作成
        ├── auth/
        │   └── index.ts          # ✅ 新規作成
        └── get-session/
            └── index.ts          # ✅ 新規作成
```

---

## まとめ

### 既存システムとの互換性

- ✅ **JWT生成・検証:** 既存関数を再利用可能、拡張のみ
- ✅ **Lambda Authorizer:** 変更不要、ゲストAPIはバイパス
- ✅ **セッション管理:** フラグ追加のみ、既存ロジックに影響なし
- ✅ **WebSocket接続:** authenticate ハンドラのみ修正

### リスク評価

| リスク                     | 影響度 | 発生確率 | 対策                                   |
| -------------------------- | ------ | -------- | -------------------------------------- |
| JWT型定義変更の影響        | 低     | 低       | オプショナルフィールドのみ追加         |
| WebSocket認証ロジックの複雑化 | 中     | 中       | 単体テスト強化、エラーハンドリング明確化 |
| API Gateway設定ミス        | 中     | 低       | CDK型チェック、デプロイ前検証          |
| DynamoDB接続データ肥大化   | 低     | 低       | TTL設定（30分）                        |

### 次のステップ

1. ✅ **調査完了** - この統合分析ドキュメント
2. ⏳ **Phase 1 Week 1** - 型定義・共通ユーティリティ実装
3. ⏳ **Phase 2 Week 2** - API実装
4. ⏳ **Phase 3 Week 3** - UI実装

---

**最終更新:** 2026-03-11 16:45 JST
**次回レビュー:** Phase 1 Week 1 完了時
