# ゲストユーザーシステム（Guest User System）

**バージョン:** 1.0
**作成日:** 2026-03-09
**ステータス:** 設計完了・実装予定 (Phase 2.5)

---

## 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [データモデル](#データモデル)
4. [API設計](#api設計)
5. [セキュリティ設計](#セキュリティ設計)
6. [フロントエンド実装](#フロントエンド実装)
7. [ユースケース](#ユースケース)
8. [実装フェーズ](#実装フェーズ)
9. [テスト戦略](#テスト戦略)

---

## 概要

### 目的

**ゲストユーザーシステム**は、プラットフォームへのログイン登録なしで、外部ユーザー（候補者・受講者等）がセッションに参加できる機能を提供します。

### ビジネス価値

**採用面接の効率化:**
- 候補者にアカウント登録を要求せず、URLとパスワードのみでアクセス可能
- 面接の自動録画・文字起こし・評価により、一次スクリーニングを自動化
- 採用担当者の作業時間を70-80%削減（手動評価 → 自動評価）

**研修・教育の標準化:**
- 受講者評価を自動化・定量化
- 複数受講者の評価を統一基準で比較
- 個別フィードバックを自動生成

**スケーラビリティ:**
- 数百〜数千人の候補者を同時に処理可能
- 人的リソースを増やさずに評価規模を拡大

### 主要機能

| 機能                     | 説明                                           | 対象ユーザー         |
| ------------------------ | ---------------------------------------------- | -------------------- |
| ゲストセッション作成     | URLとパスワードを生成                          | 内部ユーザー         |
| ゲストアクセス           | URL経由でログイン不要アクセス                  | ゲストユーザー       |
| 自動録画                 | 動画・音声・文字起こしを自動保存               | システム             |
| 自動評価                 | AI による表情・音声・会話内容の自動評価        | システム             |
| 評価レポート閲覧         | 録画と評価結果を閲覧・分析                     | 内部ユーザー         |
| データアクセス制限       | ゲストは自己データを閲覧不可                   | システム（セキュリティ） |

---

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │  Internal User UI    │  │   Guest User UI          │   │
│  │  - Session Creation  │  │   - Password Entry       │   │
│  │  - Evaluation View   │  │   - Session Player       │   │
│  └──────────────────────┘  └──────────────────────────┘   │
└────────────┬────────────────────────┬────────────────────────┘
             │                        │
             │ REST API               │ REST API
             ▼                        ▼
┌────────────────────────────────────────────────────────────┐
│                   API Gateway (REST)                        │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             │ JWT Auth                      │ Guest JWT Auth
             ▼                               ▼
┌────────────────────────────┐  ┌──────────────────────────┐
│  Session Lambda Functions  │  │  Guest Lambda Functions  │
│  - POST /sessions/guest    │  │  - POST /guest/auth      │
│  - GET /sessions/{id}      │  │  - POST /guest/start     │
│  - GET /evaluations/{id}   │  │  - WS /guest/session     │
└────────────┬───────────────┘  └──────────┬───────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────────────────────────────────────────┐
│                    Aurora Serverless v2                     │
│  - GuestSession テーブル                                    │
│  - Evaluation テーブル                                      │
│  - Session, Recording, Transcript テーブル                  │
└────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│                     External Services                       │
│  - Azure STT (音声文字起こし)                                │
│  - AWS Rekognition (表情・感情分析)                         │
│  - AWS Bedrock Claude (AI評価コメント生成)                  │
└────────────────────────────────────────────────────────────┘
```

### データフロー

**1. ゲストセッション作成フロー:**

```
内部ユーザー (Frontend)
  ↓ POST /api/v1/sessions/guest
API Gateway → Lambda (createGuestSession)
  ↓
1. Session レコード作成 (status: PENDING)
2. GuestSession レコード作成
   - accessToken 生成 (32文字ランダム)
   - accessPassword 生成 (4-8桁PIN)
   - パスワードをハッシュ化して保存
3. レスポンス返却
   {
     guestUrl: "https://app.prance.com/g/{accessToken}",
     guestPassword: "4816"
   }
  ↓
内部ユーザーが候補者にURL + パスワードを送信（メール等）
```

**2. ゲストアクセスフロー:**

```
ゲストユーザー (Frontend)
  ↓ URL アクセス: /g/{accessToken}
Frontend が accessToken を取得
  ↓ パスワード入力画面表示
ゲストがパスワード入力 (例: "4816")
  ↓ POST /api/v1/guest/auth
API Gateway → Lambda (authenticateGuest)
  ↓
1. GuestSession を accessToken で検索
2. パスワード検証 (bcrypt.compare)
3. 有効期限チェック
4. Guest用 JWT 発行 (有効期限: 1-4時間)
   {
     type: "guest",
     sessionId: "...",
     guestSessionId: "...",
     exp: ...
   }
5. GuestSession.accessedAt 更新
  ↓
レスポンス返却
  {
    guestSessionToken: "eyJhbGc...",
    sessionId: "...",
    avatarInfo: {...},
    scenarioInfo: {...}
  }
  ↓
Frontend が JWT を保存、セッションプレイヤーに遷移
```

**3. セッション実行フロー:**

```
ゲストユーザー (Frontend)
  ↓ POST /api/v1/guest/sessions/{sessionId}/start
  Authorization: Bearer {guestSessionToken}
API Gateway → Lambda (startGuestSession)
  ↓
1. JWT 検証 (type: "guest")
2. GuestSession.status = IN_PROGRESS
3. WebSocket接続情報を返却
  ↓
ゲストがWebSocket経由で会話セッション開始
  ↓ (音声・映像データをリアルタイム送信)
Azure STT → 文字起こし
AWS Bedrock → AI応答生成
ElevenLabs → TTS音声生成
  ↓
セッション終了
  ↓ POST /api/v1/guest/sessions/{sessionId}/complete
Lambda (completeGuestSession)
  ↓
1. GuestSession.status = COMPLETED
2. GuestSession.completedAt = now()
3. Recording, Transcript 保存
4. 自動評価トリガー (Step Functions)
  ↓
Step Functions (evaluationWorkflow)
  ↓
1. AWS Rekognition → 表情・感情分析
2. 音声特徴解析 (Lambda)
3. 会話内容分析 (AWS Bedrock)
4. 総合スコア算出
5. Evaluation レコード作成
  ↓
内部ユーザーが Evaluation を閲覧
```

---

## データモデル

### GuestSession テーブル

**目的:** ゲストセッションのアクセス管理と状態管理

```prisma
model GuestSession {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // アクセス認証
  accessToken     String   @unique  // URL用トークン (32文字, 例: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6")
  accessPassword  String            // bcrypt ハッシュ化されたPIN (cost: 10)
  expiresAt       DateTime?         // URL有効期限 (デフォルト: 7日後, 最大: 30日後)

  // ゲスト情報
  guestName       String?           // 候補者名・受講者名
  guestEmail      String?           // 通知用メールアドレス
  guestPhone      String?           // 連絡先電話番号
  guestMetadata   Json?             // 追加情報 (学歴、職歴、所属等)
                                    // 例: { "university": "東京大学", "major": "情報工学" }

  // 状態管理
  accessedAt      DateTime?         // 初回アクセス日時
  completedAt     DateTime?         // セッション完了日時
  status          GuestSessionStatus @default(PENDING)

  // 評価基準
  evaluationCriteria Json?          // 評価基準定義
                                    // 例: {
                                    //   "skills": ["communication", "technical", "leadership"],
                                    //   "rubric": {
                                    //     "communication": { "weight": 0.3, "criteria": "..." },
                                    //     "technical": { "weight": 0.5, "criteria": "..." },
                                    //     "leadership": { "weight": 0.2, "criteria": "..." }
                                    //   }
                                    // }

  // 作成者情報
  createdBy       String
  creator         User     @relation(fields: [createdBy], references: [id])
  orgId           String
  organization    Organization @relation(fields: [orgId], references: [id])

  // タイムスタンプ
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // インデックス
  @@index([accessToken])
  @@index([sessionId])
  @@index([orgId])
  @@index([status])
  @@index([expiresAt])
  @@map("guest_sessions")
}

enum GuestSessionStatus {
  PENDING      // URL送信済み、未アクセス
  ACCESSED     // ゲストがアクセス済み（パスワード入力完了）
  IN_PROGRESS  // セッション実行中
  COMPLETED    // セッション完了、評価待ち
  EVALUATED    // 評価完了
  EXPIRED      // 有効期限切れ
  CANCELLED    // キャンセル済み（内部ユーザーによる）
}
```

### Evaluation テーブル

**目的:** AI自動評価結果の保存

```prisma
model Evaluation {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // 総合評価
  overallScore    Float             // 総合スコア (0-100)
  overallGrade    String?           // 総合評価グレード (A+, A, B+, B, C+, C, D, F)

  // カテゴリ別スコア
  categoryScores  Json              // カテゴリ別スコア
                                    // 例: {
                                    //   "communication": 85.5,
                                    //   "technical": 72.3,
                                    //   "leadership": 90.0,
                                    //   "problemSolving": 78.9
                                    // }

  // 詳細分析結果
  emotionAnalysis Json              // 表情・感情分析結果 (AWS Rekognition)
                                    // 例: {
                                    //   "emotions": [
                                    //     { "timestamp": 0, "HAPPY": 0.8, "CALM": 0.2 },
                                    //     { "timestamp": 10, "CONFUSED": 0.6, "CALM": 0.4 }
                                    //   ],
                                    //   "dominantEmotion": "HAPPY",
                                    //   "emotionStability": 0.75
                                    // }

  speechAnalysis  Json              // 音声特徴解析結果
                                    // 例: {
                                    //   "pace": 120,  // 単語/分
                                    //   "volume": 0.7,  // 0-1
                                    //   "clarity": 0.85,  // 発音明瞭度
                                    //   "fillerWords": 12,  // えー、あのー等
                                    //   "silenceDuration": 45.2  // 秒
                                    // }

  contentAnalysis Json              // 会話内容分析結果 (AWS Bedrock)
                                    // 例: {
                                    //   "keywords": ["経験", "プロジェクト", "チーム"],
                                    //   "sentiment": "POSITIVE",
                                    //   "coherence": 0.82,  // 論理的一貫性
                                    //   "relevance": 0.91,  // 質問への関連性
                                    //   "depth": 0.76  // 回答の深さ
                                    // }

  // AI評価コメント
  aiComments      String?           // AI生成の総合評価コメント（日本語・英語）
  strengths       Json              // 強み（配列形式）
                                    // 例: [
                                    //   "コミュニケーション能力が高く、明確に意見を述べている",
                                    //   "技術的な質問に対して具体例を交えて回答している"
                                    // ]
  improvements    Json              // 改善点（配列形式）
                                    // 例: [
                                    //   "回答が冗長になる傾向があるため、簡潔さを意識する",
                                    //   "フィラーワードの使用を減らすと、より専門的な印象を与えられる"
                                    // ]

  // メタデータ
  evaluatedAt     DateTime @default(now())
  evaluationModel String            // 使用したAIモデル (例: "claude-sonnet-4.6")
  evaluationVersion String @default("1.0")  // 評価ロジックのバージョン

  // インデックス
  @@index([sessionId])
  @@index([overallScore])
  @@index([evaluatedAt])
  @@map("evaluations")
}
```

### Session テーブル（既存テーブルへの追加）

```prisma
model Session {
  // ... 既存フィールド ...

  // ゲストセッション関連（1:1リレーション）
  guestSession   GuestSession?
  evaluation     Evaluation?

  // セッションタイプ（新規追加）
  sessionType    SessionType @default(INTERNAL)  // INTERNAL or GUEST
}

enum SessionType {
  INTERNAL  // 内部ユーザーのセッション
  GUEST     // ゲストユーザーのセッション
}
```

---

## API設計

### 1. ゲストセッション作成

**Endpoint:**
```
POST /api/v1/sessions/guest
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `CLIENT_ADMIN`, `CLIENT_USER` のみ

**リクエスト:**
```typescript
{
  scenarioId: string;           // 必須
  avatarId: string;             // 必須
  guestName?: string;           // 候補者名
  guestEmail?: string;          // 通知用メール
  guestPhone?: string;          // 連絡先
  guestMetadata?: {             // 追加情報
    [key: string]: any;
  };
  expiresAt?: string;           // ISO 8601, デフォルト: 7日後
  evaluationCriteria?: {        // 評価基準
    skills: string[];
    rubric: {
      [skill: string]: {
        weight: number;
        criteria: string;
      };
    };
  };
}
```

**レスポンス (201 Created):**
```typescript
{
  sessionId: string;
  guestSessionId: string;
  guestUrl: string;             // "https://app.prance.com/g/a1b2c3..."
  guestPassword: string;        // "4816" (プレーンテキスト、1回のみ表示)
  expiresAt: string;            // ISO 8601
  createdAt: string;            // ISO 8601
}
```

**エラーレスポンス:**
```typescript
// 400 Bad Request
{
  error: "VALIDATION_ERROR",
  message: "Invalid scenario or avatar ID",
  details: { ... }
}

// 403 Forbidden
{
  error: "FORBIDDEN",
  message: "Insufficient permissions"
}
```

**実装例:**
```typescript
// infrastructure/lambda/sessions/create-guest/index.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from '../shared/database/prisma';
import { verifyJWT } from '../shared/auth/jwt';
import { ValidationError, AuthorizationError } from '../shared/types';

const requestSchema = z.object({
  scenarioId: z.string().cuid(),
  avatarId: z.string().cuid(),
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  guestMetadata: z.record(z.any()).optional(),
  expiresAt: z.string().datetime().optional(),
  evaluationCriteria: z.object({
    skills: z.array(z.string()),
    rubric: z.record(z.object({
      weight: z.number().min(0).max(1),
      criteria: z.string(),
    })),
  }).optional(),
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // 認証
    const token = event.headers.Authorization?.replace('Bearer ', '');
    if (!token) {
      throw new AuthorizationError('Missing authentication token');
    }

    const payload = verifyJWT(token);
    if (!['CLIENT_ADMIN', 'CLIENT_USER'].includes(payload.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }

    // リクエスト検証
    const body = JSON.parse(event.body || '{}');
    const data = requestSchema.parse(body);

    // アクセストークン生成 (32文字)
    const accessToken = nanoid(32);

    // パスワード生成 (4-8桁のPIN)
    const password = Math.floor(1000 + Math.random() * 9000).toString();
    const passwordHash = await bcrypt.hash(password, 10);

    // 有効期限設定 (デフォルト: 7日後)
    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // トランザクション: Session + GuestSession 作成
    const result = await prisma.$transaction(async (tx) => {
      // Session作成
      const session = await tx.session.create({
        data: {
          scenarioId: data.scenarioId,
          avatarId: data.avatarId,
          userId: payload.userId,
          orgId: payload.orgId,
          sessionType: 'GUEST',
          status: 'PENDING',
        },
      });

      // GuestSession作成
      const guestSession = await tx.guestSession.create({
        data: {
          sessionId: session.id,
          accessToken,
          accessPassword: passwordHash,
          expiresAt,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          guestMetadata: data.guestMetadata,
          evaluationCriteria: data.evaluationCriteria,
          createdBy: payload.userId,
          orgId: payload.orgId,
          status: 'PENDING',
        },
      });

      return { session, guestSession };
    });

    // レスポンス
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: result.session.id,
        guestSessionId: result.guestSession.id,
        guestUrl: `https://app.prance.com/g/${accessToken}`,
        guestPassword: password,  // プレーンテキスト（1回のみ）
        expiresAt: expiresAt.toISOString(),
        createdAt: result.guestSession.createdAt.toISOString(),
      }),
    };
  } catch (error) {
    // エラーハンドリング
    // ...
  }
};
```

### 2. ゲスト認証

**Endpoint:**
```
POST /api/v1/guest/auth
```

**認証:** なし（公開エンドポイント）

**リクエスト:**
```typescript
{
  accessToken: string;  // URL から取得 (例: "a1b2c3...")
  password: string;     // ユーザー入力 (例: "4816")
}
```

**レスポンス (200 OK):**
```typescript
{
  guestSessionToken: string;  // JWT (有効期限: 1-4時間)
  sessionId: string;
  guestSessionId: string;
  avatarInfo: {
    id: string;
    name: string;
    imageUrl: string;
    type: 'TWO_D' | 'THREE_D';
  };
  scenarioInfo: {
    id: string;
    title: string;
    description: string;
    language: string;
    estimatedDuration: number;  // 分
  };
}
```

**エラーレスポンス:**
```typescript
// 401 Unauthorized
{
  error: "INVALID_CREDENTIALS",
  message: "Invalid access token or password"
}

// 410 Gone
{
  error: "SESSION_EXPIRED",
  message: "This session has expired",
  expiresAt: "2026-03-15T23:59:59Z"
}
```

**実装例:**
```typescript
// infrastructure/lambda/guest/auth/index.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../shared/database/prisma';
import { AuthenticationError } from '../shared/types';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { accessToken, password } = body;

    if (!accessToken || !password) {
      throw new AuthenticationError('Missing access token or password');
    }

    // GuestSession検索
    const guestSession = await prisma.guestSession.findUnique({
      where: { accessToken },
      include: {
        session: {
          include: {
            avatar: true,
            scenario: true,
          },
        },
      },
    });

    if (!guestSession) {
      throw new AuthenticationError('Invalid access token');
    }

    // 有効期限チェック
    if (guestSession.expiresAt && new Date() > guestSession.expiresAt) {
      await prisma.guestSession.update({
        where: { id: guestSession.id },
        data: { status: 'EXPIRED' },
      });
      return {
        statusCode: 410,
        body: JSON.stringify({
          error: 'SESSION_EXPIRED',
          message: 'This session has expired',
          expiresAt: guestSession.expiresAt.toISOString(),
        }),
      };
    }

    // パスワード検証
    const isValidPassword = await bcrypt.compare(password, guestSession.accessPassword);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid password');
    }

    // 初回アクセス時刻更新
    if (!guestSession.accessedAt) {
      await prisma.guestSession.update({
        where: { id: guestSession.id },
        data: {
          accessedAt: new Date(),
          status: 'ACCESSED',
        },
      });
    }

    // Guest用JWT発行 (有効期限: 2時間)
    const jwtSecret = process.env.JWT_SECRET!;
    const token = jwt.sign(
      {
        type: 'guest',
        sessionId: guestSession.sessionId,
        guestSessionId: guestSession.id,
        orgId: guestSession.orgId,
      },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // レスポンス
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestSessionToken: token,
        sessionId: guestSession.sessionId,
        guestSessionId: guestSession.id,
        avatarInfo: {
          id: guestSession.session.avatar.id,
          name: guestSession.session.avatar.name,
          imageUrl: guestSession.session.avatar.imageUrl,
          type: guestSession.session.avatar.type,
        },
        scenarioInfo: {
          id: guestSession.session.scenario.id,
          title: guestSession.session.scenario.title,
          description: guestSession.session.scenario.description,
          language: guestSession.session.scenario.language,
          estimatedDuration: guestSession.session.scenario.estimatedDuration,
        },
      }),
    };
  } catch (error) {
    // エラーハンドリング
    // ...
  }
};
```

### 3. ゲストセッション開始

**Endpoint:**
```
POST /api/v1/guest/sessions/{sessionId}/start
```

**認証:**
```
Authorization: Bearer <GuestSessionToken>
```

**リクエスト:** なし

**レスポンス (200 OK):**
```typescript
{
  websocketUrl: string;         // WebSocket接続URL
  sessionConfig: {
    sessionId: string;
    avatarId: string;
    scenarioId: string;
    language: string;
    maxDuration: number;        // 秒 (デフォルト: 7200 = 2時間)
  };
  connectionToken: string;      // WebSocket接続用トークン (短期間有効)
}
```

### 4. ゲストセッション完了

**Endpoint:**
```
POST /api/v1/guest/sessions/{sessionId}/complete
```

**認証:**
```
Authorization: Bearer <GuestSessionToken>
```

**リクエスト:** なし

**レスポンス (200 OK):**
```typescript
{
  sessionId: string;
  status: 'COMPLETED';
  completedAt: string;          // ISO 8601
  message: 'Thank you for your participation. The session has been recorded and will be evaluated.'
}
```

### 5. 評価結果取得（内部ユーザーのみ）

**Endpoint:**
```
GET /api/v1/evaluations/{sessionId}
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- セッション作成者
- 同じ組織の `CLIENT_ADMIN`
- `SUPER_ADMIN`

**レスポンス (200 OK):**
```typescript
{
  id: string;
  sessionId: string;
  overallScore: number;         // 0-100
  overallGrade: string;         // "A+", "A", "B+", ...
  categoryScores: {
    [category: string]: number;
  };
  emotionAnalysis: { ... };
  speechAnalysis: { ... };
  contentAnalysis: { ... };
  aiComments: string;
  strengths: string[];
  improvements: string[];
  evaluatedAt: string;          // ISO 8601
  evaluationModel: string;
}
```

---

## セキュリティ設計

### 1. 認証・認可

**アクセストークン:**
- **生成:** `nanoid(32)` - 32文字のランダム文字列
- **用途:** URL埋め込み (`/g/{accessToken}`)
- **保管:** `GuestSession.accessToken` (UNIQUE制約)
- **推測困難性:** 62^32 ≈ 2^190 通りの組み合わせ

**パスワード:**
- **生成:** 4-8桁のランダム数値PIN、または8-16文字のランダム文字列
- **ハッシュ化:** `bcrypt` (cost: 10)
- **保管:** `GuestSession.accessPassword` (ハッシュのみ保管)
- **プレーンテキスト表示:** セッション作成時の1回のみ

**JWT (Guest Session Token):**
- **発行:** ゲスト認証成功後
- **有効期限:** 1-4時間（セッション推定時間に応じて調整）
- **リフレッシュ:** 不可（セッション終了後は無効）
- **ペイロード:**
  ```json
  {
    "type": "guest",
    "sessionId": "...",
    "guestSessionId": "...",
    "orgId": "...",
    "exp": 1234567890
  }
  ```

### 2. データアクセス制限

**ゲストユーザーの制限:**
- ❌ 録画動画の閲覧不可
- ❌ 文字起こしの閲覧不可
- ❌ 評価結果の閲覧不可
- ❌ 他のゲストセッション情報の閲覧不可
- ❌ 内部ユーザー情報の閲覧不可
- ✅ 自分のセッションへの参加のみ可能

**内部ユーザーの権限:**
- ✅ 自分が作成したゲストセッションの録画・評価を閲覧可能
- ✅ `CLIENT_ADMIN` は組織内の全ゲストセッションを閲覧可能
- ✅ `SUPER_ADMIN` は全組織のゲストセッションを閲覧可能

**実装（Lambda Authorizer）:**
```typescript
// infrastructure/lambda/shared/auth/authorize.ts
export function authorizeGuestSession(
  jwtPayload: JWTPayload,
  sessionId: string,
  guestSession: GuestSession
): boolean {
  // ゲストユーザー: 自分のセッションのみ
  if (jwtPayload.type === 'guest') {
    return jwtPayload.sessionId === sessionId;
  }

  // 内部ユーザー: 組織スコープで認可
  if (jwtPayload.role === 'SUPER_ADMIN') {
    return true;
  }

  if (jwtPayload.role === 'CLIENT_ADMIN') {
    return jwtPayload.orgId === guestSession.orgId;
  }

  if (jwtPayload.role === 'CLIENT_USER') {
    return guestSession.createdBy === jwtPayload.userId;
  }

  return false;
}
```

### 3. レート制限

**ゲスト認証API (`POST /api/v1/guest/auth`):**
- **制限:** IP単位で 10回/分
- **理由:** ブルートフォース攻撃を防止
- **実装:** API Gateway + DynamoDB (TTL)

**ゲストセッション作成API:**
- **制限:** ユーザー単位で 100回/日
- **理由:** スパム防止、コスト管理
- **実装:** API Gateway + DynamoDB

### 4. データ保護

**録画データの暗号化:**
- **S3暗号化:** SSE-KMS (AWS KMS)
- **転送時:** TLS 1.3

**個人情報の最小化:**
- ゲストユーザーの氏名・メールアドレスは任意入力
- 個人を特定できない ID のみで管理可能

**自動削除（オプション）:**
- 設定期間（例: 90日）経過後、ゲストセッションデータを自動削除
- 削除対象: `GuestSession`, `Session`, `Recording`, `Transcript`, `Evaluation`
- 実装: EventBridge Scheduler + Lambda

### 5. セキュリティ監査

**ログ記録:**
- ゲスト認証の試行・成功・失敗
- ゲストセッションの作成・アクセス・完了
- 評価データへのアクセス

**異常検知:**
- 短時間での大量の認証失敗 → IP制限
- 同一アクセストークンでの複数IPからのアクセス → 警告通知

---

## フロントエンド実装

### 1. ゲストセッション作成UI（内部ユーザー）

**場所:** `apps/web/app/[locale]/dashboard/sessions/create-guest/page.tsx`

**機能:**
- シナリオ選択
- アバター選択
- 候補者情報入力（任意）
- 評価基準設定（任意）
- 有効期限設定
- URL + パスワード生成

**UI/UX:**
```tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGuestSession } from '@/lib/api/guest-sessions';

export default function CreateGuestSessionPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    scenarioId: '',
    avatarId: '',
    guestName: '',
    guestEmail: '',
    expiresAt: '', // デフォルト: 7日後
  });
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await createGuestSession(formData);
      setResult(response);
    } catch (error) {
      console.error('Failed to create guest session:', error);
    }
  };

  if (result) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Guest Session Created</h2>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-2">Share with Candidate:</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">URL:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={result.guestUrl}
                readOnly
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={() => navigator.clipboard.writeText(result.guestUrl)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Password:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={result.guestPassword}
                readOnly
                className="text-2xl font-mono font-bold p-2 border rounded bg-yellow-50"
              />
              <button
                onClick={() => navigator.clipboard.writeText(result.guestPassword)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Expires: {new Date(result.expiresAt).toLocaleString()}
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm">
            ⚠️ <strong>Important:</strong> This password will only be shown once.
            Please save it securely and share it with the candidate.
          </p>
        </div>

        <button
          onClick={() => router.push('/dashboard/sessions')}
          className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Create Guest Session</h2>

      {/* シナリオ選択 */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Scenario *</label>
        <select
          value={formData.scenarioId}
          onChange={(e) => setFormData({ ...formData, scenarioId: e.target.value })}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select a scenario</option>
          {/* シナリオ一覧 */}
        </select>
      </div>

      {/* アバター選択 */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Avatar *</label>
        <select
          value={formData.avatarId}
          onChange={(e) => setFormData({ ...formData, avatarId: e.target.value })}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select an avatar</option>
          {/* アバター一覧 */}
        </select>
      </div>

      {/* 候補者情報（任意） */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Candidate Name (Optional)</label>
        <input
          type="text"
          value={formData.guestName}
          onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
          className="w-full p-2 border rounded"
          placeholder="e.g., John Doe"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Email (Optional)</label>
        <input
          type="email"
          value={formData.guestEmail}
          onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
          className="w-full p-2 border rounded"
          placeholder="e.g., john@example.com"
        />
      </div>

      <button
        type="submit"
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Create Guest Session
      </button>
    </form>
  );
}
```

### 2. ゲストアクセスページ

**場所:** `apps/web/app/g/[token]/page.tsx`

**機能:**
- アクセストークンの検証
- パスワード入力画面
- 認証後、セッションプレイヤーに遷移

**UI/UX:**
```tsx
'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authenticateGuest } from '@/lib/api/guest-auth';

export default function GuestAccessPage() {
  const router = useRouter();
  const params = useParams();
  const accessToken = params.token as string;

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authenticateGuest(accessToken, password);

      // JWT をローカルストレージに保存
      localStorage.setItem('guestSessionToken', response.guestSessionToken);
      localStorage.setItem('sessionId', response.sessionId);

      // セッションプレイヤーに遷移
      router.push(`/guest/session/${response.sessionId}`);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid password. Please try again.');
      } else if (err.response?.status === 410) {
        setError('This session has expired.');
      } else {
        setError('An error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to Your Interview Session
          </h1>
          <p className="text-gray-600">
            Please enter the password provided to you.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="text"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-center text-2xl font-mono font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••"
              maxLength={8}
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Verifying...' : 'Start Session'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            This is a secure session provided by Prance Communication Platform.
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 3. ゲスト用セッションプレイヤー（簡易版）

**場所:** `apps/web/app/guest/session/[id]/page.tsx`

**機能:**
- アバター表示
- ユーザーカメラ表示
- 音声会話
- WebSocket通信
- セッション終了画面

**内部ユーザー版との違い:**
- ❌ 録画再生機能なし
- ❌ 文字起こし表示なし
- ❌ 評価結果表示なし
- ✅ シンプルなUI（アバターとの会話のみ）

---

## ユースケース

### 1. 採用面接の一次スクリーニング

**シナリオ:**
大手企業の採用担当者が、年間500人の候補者を効率的にスクリーニングしたい。

**ワークフロー:**
1. 採用担当者が「技術面接」シナリオでゲストセッション500件を一括作成
2. 候補者にURL + パスワードをメール送信
3. 候補者が各自の都合の良い時間にアクセス、30分の面接を実施
4. システムが自動評価レポートを生成
   - 技術力スコア (0-100)
   - コミュニケーション力スコア (0-100)
   - 総合評価グレード (A+, A, B+, B, C+, C, D, F)
   - 強み・改善点のAIコメント
5. 採用担当者が評価スコアでソート、上位100名を二次面接に招待
6. 必要に応じて録画を確認、最終判断

**効果:**
- **時間削減:** 500人 × 30分 = 250時間 → 評価レビュー: 50時間 (80%削減)
- **標準化:** 全候補者に同じ質問、同じ評価基準
- **定量化:** スコアによる客観的な比較

### 2. 企業研修の効果測定

**シナリオ:**
カスタマーサポート研修を受講した200名の従業員の効果を測定したい。

**ワークフロー:**
1. 研修担当者が「クレーム対応」シナリオでゲストセッション200件を作成
2. 受講者にURL + パスワードを配布
3. 受講者が研修終了後にアクセス、20分のロールプレイを実施
4. システムが自動評価
   - 対応品質スコア
   - 言葉遣いスコア
   - 問題解決力スコア
5. 研修担当者が受講者全員の評価を比較
   - 平均スコア: 75.3点
   - スコア分布: A (20%), B (50%), C (25%), D (5%)
   - 弱点分析: 「共感表現」が全体的に低い → 追加研修実施

**効果:**
- **効果測定:** 研修前後の比較、ROI算出
- **個別フィードバック:** 各受講者の強み・改善点を自動生成
- **研修改善:** データに基づく研修内容の最適化

### 3. 大学のキャリア支援

**シナリオ:**
大学のキャリアセンターが、1000名の学生に模擬面接を提供したい。

**ワークフロー:**
1. キャリアアドバイザーが「模擬面接（新卒採用）」シナリオでゲストセッション1000件を作成
2. 学生にURL + パスワードを学内ポータルで配布
3. 学生が24時間いつでもアクセス、15分の模擬面接を実施
4. システムが自動評価
   - 面接マナースコア
   - 自己PR明瞭度
   - 質問回答の適切性
5. キャリアアドバイザーが録画と評価を確認、個別面談で具体的なアドバイス
6. 学生は評価結果を元に自主練習、再度模擬面接を実施（回数制限なし）

**効果:**
- **スケーラビリティ:** アドバイザー5名で1000名をサポート
- **アクセシビリティ:** 24時間利用可能、地方学生も平等にアクセス
- **反復練習:** 何度でも練習可能、成長を定量的に確認

---

## 実装フェーズ

### Phase 2.5: ゲストユーザー基盤（推定2-3週間）

#### Week 1: バックエンド基盤

**Day 1-2: データベーススキーマ**
- [ ] Prisma スキーマに `GuestSession`, `Evaluation`, `GuestSessionStatus` 追加
- [ ] マイグレーション実行
- [ ] Prisma Client 再生成
- [ ] 型定義を shared パッケージに追加

**Day 3-4: API実装（ゲストセッション作成）**
- [ ] `POST /api/v1/sessions/guest` Lambda関数
- [ ] アクセストークン生成ロジック
- [ ] パスワード生成・ハッシュ化ロジック
- [ ] トランザクション実装（Session + GuestSession）
- [ ] 単体テスト

**Day 5: API実装（ゲスト認証）**
- [ ] `POST /api/v1/guest/auth` Lambda関数
- [ ] パスワード検証ロジック
- [ ] Guest用JWT発行
- [ ] 有効期限チェック
- [ ] レート制限実装（DynamoDB）
- [ ] 単体テスト

#### Week 2: フロントエンド実装

**Day 6-7: 内部ユーザーUI（ゲストセッション作成）**
- [ ] `/dashboard/sessions/create-guest` ページ
- [ ] シナリオ・アバター選択UI
- [ ] 候補者情報入力フォーム
- [ ] URL + パスワード表示画面
- [ ] クリップボードコピー機能

**Day 8-9: ゲストアクセスページ**
- [ ] `/g/[token]` ページ
- [ ] パスワード入力UI
- [ ] 認証エラーハンドリング
- [ ] 有効期限切れ表示
- [ ] ローディング状態

**Day 10-11: ゲスト用セッションプレイヤー**
- [ ] `/guest/session/[id]` ページ
- [ ] 既存セッションプレイヤーを簡易化
- [ ] WebSocket接続（Guest JWT使用）
- [ ] セッション終了画面
- [ ] "Thank you" メッセージ

#### Week 3: 評価システム統合・テスト

**Day 12-13: 自動評価エンジン**
- [ ] Step Functions ワークフロー設計
- [ ] 表情・感情分析Lambda（AWS Rekognition連携）
- [ ] 音声特徴解析Lambda
- [ ] 会話内容分析Lambda（AWS Bedrock連携）
- [ ] 総合スコア算出ロジック
- [ ] Evaluation レコード作成Lambda

**Day 14: 評価レポートUI（内部ユーザー）**
- [ ] `/dashboard/evaluations/[sessionId]` ページ
- [ ] スコア表示（総合・カテゴリ別）
- [ ] 詳細分析グラフ（表情推移、音声特徴）
- [ ] AIコメント表示
- [ ] 強み・改善点リスト

**Day 15: 統合テスト・E2Eテスト**
- [ ] ゲストセッション作成 → 認証 → セッション実行 → 評価生成のフルフロー
- [ ] セキュリティテスト（不正アクセス試行）
- [ ] レート制限テスト
- [ ] 有効期限テスト
- [ ] パフォーマンステスト（同時100セッション）

**Day 16: バグフィックス・ドキュメント更新**
- [ ] バグ修正
- [ ] API ドキュメント更新（OpenAPI）
- [ ] ユーザーガイド作成
- [ ] 運用マニュアル作成

---

## テスト戦略

### 1. 単体テスト（Unit Tests）

**Lambda関数:**
```typescript
// infrastructure/lambda/sessions/create-guest/__tests__/index.test.ts
import { handler } from '../index';
import { prisma } from '../../shared/database/prisma';
import bcrypt from 'bcryptjs';

jest.mock('../../shared/database/prisma');
jest.mock('bcryptjs');

describe('createGuestSession Lambda', () => {
  it('should create a guest session with valid input', async () => {
    // Arrange
    const event = {
      headers: { Authorization: 'Bearer valid-token' },
      body: JSON.stringify({
        scenarioId: 'scenario_123',
        avatarId: 'avatar_456',
        guestName: 'John Doe',
      }),
    };

    // Mock
    (prisma.$transaction as jest.Mock).mockResolvedValue({
      session: { id: 'session_789' },
      guestSession: { id: 'guest_123', accessToken: 'abc123xyz' },
    });
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    // Act
    const response = await handler(event as any, {} as any, {} as any);

    // Assert
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.sessionId).toBe('session_789');
    expect(body.guestUrl).toContain('/g/');
    expect(body.guestPassword).toMatch(/^\d{4}$/);
  });

  it('should return 400 for invalid input', async () => {
    const event = {
      headers: { Authorization: 'Bearer valid-token' },
      body: JSON.stringify({ scenarioId: 'invalid' }),
    };

    const response = await handler(event as any, {} as any, {} as any);

    expect(response.statusCode).toBe(400);
  });
});
```

### 2. 統合テスト（Integration Tests）

**API統合テスト:**
```typescript
// tests/integration/guest-session.test.ts
import axios from 'axios';

const API_URL = 'https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev';

describe('Guest Session Integration', () => {
  let guestUrl: string;
  let guestPassword: string;
  let sessionId: string;

  it('should create a guest session', async () => {
    const response = await axios.post(
      `${API_URL}/api/v1/sessions/guest`,
      {
        scenarioId: 'scenario_123',
        avatarId: 'avatar_456',
        guestName: 'Test User',
      },
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      }
    );

    expect(response.status).toBe(201);
    expect(response.data.guestUrl).toBeDefined();
    expect(response.data.guestPassword).toMatch(/^\d{4}$/);

    guestUrl = response.data.guestUrl;
    guestPassword = response.data.guestPassword;
    sessionId = response.data.sessionId;
  });

  it('should authenticate guest with valid password', async () => {
    const accessToken = guestUrl.split('/g/')[1];
    const response = await axios.post(`${API_URL}/api/v1/guest/auth`, {
      accessToken,
      password: guestPassword,
    });

    expect(response.status).toBe(200);
    expect(response.data.guestSessionToken).toBeDefined();
    expect(response.data.sessionId).toBe(sessionId);
  });

  it('should reject invalid password', async () => {
    const accessToken = guestUrl.split('/g/')[1];
    try {
      await axios.post(`${API_URL}/api/v1/guest/auth`, {
        accessToken,
        password: '0000',
      });
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.response.status).toBe(401);
    }
  });
});
```

### 3. E2Eテスト（End-to-End Tests）

**Playwright E2Eテスト:**
```typescript
// tests/e2e/guest-session.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Guest Session E2E', () => {
  let guestUrl: string;
  let guestPassword: string;

  test('Admin creates guest session', async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'admin@prance.com');
    await page.fill('input[name="password"]', 'Admin2026!Prance');
    await page.click('button[type="submit"]');

    // Navigate to create guest session
    await page.goto('http://localhost:3000/dashboard/sessions/create-guest');

    // Fill form
    await page.selectOption('select[name="scenarioId"]', 'scenario_123');
    await page.selectOption('select[name="avatarId"]', 'avatar_456');
    await page.fill('input[name="guestName"]', 'E2E Test User');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for result
    await page.waitForSelector('text=Guest Session Created');

    // Extract URL and password
    guestUrl = await page.inputValue('input[readonly][value*="/g/"]');
    guestPassword = await page.inputValue('input[readonly][class*="font-mono"]');

    expect(guestUrl).toContain('/g/');
    expect(guestPassword).toMatch(/^\d{4}$/);
  });

  test('Guest accesses session with password', async ({ page }) => {
    // Access guest URL
    await page.goto(guestUrl);

    // Enter password
    await page.fill('input[id="password"]', guestPassword);
    await page.click('button[type="submit"]');

    // Wait for session player
    await page.waitForSelector('text=Interview Session', { timeout: 10000 });

    // Verify avatar is displayed
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('Guest completes session and sees thank you page', async ({ page }) => {
    // ... (session interaction) ...

    // End session
    await page.click('button:has-text("End Session")');

    // Verify thank you message
    await page.waitForSelector('text=Thank you for your participation');
  });
});
```

### 4. セキュリティテスト

**ブルートフォース攻撃テスト:**
```typescript
// tests/security/brute-force.test.ts
import axios from 'axios';

describe('Brute Force Protection', () => {
  it('should rate limit authentication attempts', async () => {
    const accessToken = 'valid-token';
    const attempts = [];

    for (let i = 0; i < 15; i++) {
      attempts.push(
        axios.post(`${API_URL}/api/v1/guest/auth`, {
          accessToken,
          password: `000${i}`,
        }).catch(err => err.response)
      );
    }

    const results = await Promise.all(attempts);
    const rateLimited = results.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

### 5. パフォーマンステスト

**負荷テスト（Artillery）:**
```yaml
# tests/load/guest-session.yml
config:
  target: 'https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 requests/sec
      name: Warm up
    - duration: 120
      arrivalRate: 50  # 50 requests/sec
      name: Load test
  variables:
    adminToken: 'Bearer eyJhbGc...'
scenarios:
  - name: Create Guest Session
    flow:
      - post:
          url: '/api/v1/sessions/guest'
          headers:
            Authorization: '{{ adminToken }}'
          json:
            scenarioId: 'scenario_123'
            avatarId: 'avatar_456'
            guestName: 'Load Test User'
```

**実行:**
```bash
artillery run tests/load/guest-session.yml
```

---

## 付録

### A. エラーコード一覧

| コード                  | HTTPステータス | 説明                             |
| ----------------------- | -------------- | -------------------------------- |
| `VALIDATION_ERROR`      | 400            | リクエストデータが無効           |
| `INVALID_CREDENTIALS`   | 401            | アクセストークンまたはパスワード不正 |
| `FORBIDDEN`             | 403            | 権限不足                         |
| `NOT_FOUND`             | 404            | リソースが見つからない           |
| `SESSION_EXPIRED`       | 410            | セッションの有効期限切れ         |
| `RATE_LIMIT_EXCEEDED`   | 429            | レート制限超過                   |
| `INTERNAL_SERVER_ERROR` | 500            | サーバー内部エラー               |

### B. 環境変数

```bash
# .env.local
JWT_SECRET=<secret>
BCRYPT_COST=10
GUEST_SESSION_DEFAULT_EXPIRY_DAYS=7
GUEST_SESSION_MAX_EXPIRY_DAYS=30
GUEST_SESSION_MAX_DURATION_SECONDS=7200
```

### C. 参考リソース

**関連ドキュメント:**
- [MULTITENANCY.md](../architecture/MULTITENANCY.md) - マルチテナント設計
- [API_DESIGN.md](../development/API_DESIGN.md) - API設計原則
- [DATABASE_DESIGN.md](../development/DATABASE_DESIGN.md) - データベース設計
- [EVALUATION_SYSTEM.md](./EVALUATION_SYSTEM.md) - 自動評価システム（作成予定）

**外部リソース:**
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Bcrypt Security](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**最終更新:** 2026-03-09
**次回レビュー:** Phase 2.5 実装開始時
