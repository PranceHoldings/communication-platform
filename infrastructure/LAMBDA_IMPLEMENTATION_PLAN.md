# Lambda関数実装計画（Phase 1 MVP）

**作成日:** 2026-03-04
**対象:** アルファ版（Phase 1）
**ステータス:** 計画中

---

## 📋 目次

1. [実装優先順位](#実装優先順位)
2. [関数一覧](#関数一覧)
3. [実装詳細](#実装詳細)
4. [共通ライブラリ](#共通ライブラリ)
5. [テスト戦略](#テスト戦略)

---

## 実装優先順位

### 🔴 優先度：高（Week 1-2）

基本的な認証とセッション管理を実現するために必須の関数。

1. **認証API**（3関数）
   - `auth/register` - ユーザー登録
   - `auth/login` - ログイン
   - `auth/refresh` - トークンリフレッシュ

2. **アバター・シナリオAPI**（4関数）
   - `avatars/list` - アバター一覧取得
   - `avatars/get` - アバター詳細取得
   - `scenarios/list` - シナリオ一覧取得
   - `scenarios/get` - シナリオ詳細取得

### 🟡 優先度：中（Week 3-4）

セッション実行機能を実現するための関数。

3. **セッション管理API**（4関数）
   - `sessions/create` - セッション作成
   - `sessions/start` - セッション開始
   - `sessions/end` - セッション終了
   - `sessions/get` - セッション詳細取得

4. **WebSocket API**（4関数）
   - `websocket/connect` - WebSocket接続
   - `websocket/disconnect` - WebSocket切断
   - `websocket/message` - ユーザーメッセージ受信
   - `websocket/ai-response` - AI応答送信

### 🟢 優先度：低（Week 5-6）

録画・再生機能とその他の付加機能。

5. **録画管理API**（3関数）
   - `recordings/upload` - 録画アップロード
   - `recordings/list` - 録画一覧取得
   - `recordings/get` - 録画詳細取得

6. **ユーザー管理API**（2関数）
   - `users/profile` - プロフィール取得
   - `users/update` - プロフィール更新

---

## 関数一覧

### 実装済み

| 関数名         | パス      | メソッド | 用途           | ステータス |
| -------------- | --------- | -------- | -------------- | ---------- |
| `health-check` | `/health` | GET      | ヘルスチェック | ✅ 完了    |

### 未実装（計18関数）

| #   | 関数名                  | パス                   | メソッド | 優先度 | 所要時間 |
| --- | ----------------------- | ---------------------- | -------- | ------ | -------- |
| 1   | `auth/register`         | `/auth/register`       | POST     | 🔴 高  | 3h       |
| 2   | `auth/login`            | `/auth/login`          | POST     | 🔴 高  | 2h       |
| 3   | `auth/refresh`          | `/auth/refresh`        | POST     | 🔴 高  | 1h       |
| 4   | `avatars/list`          | `/avatars`             | GET      | 🔴 高  | 2h       |
| 5   | `avatars/get`           | `/avatars/{id}`        | GET      | 🔴 高  | 1h       |
| 6   | `scenarios/list`        | `/scenarios`           | GET      | 🔴 高  | 2h       |
| 7   | `scenarios/get`         | `/scenarios/{id}`      | GET      | 🔴 高  | 1h       |
| 8   | `sessions/create`       | `/sessions`            | POST     | 🟡 中  | 3h       |
| 9   | `sessions/start`        | `/sessions/{id}/start` | POST     | 🟡 中  | 2h       |
| 10  | `sessions/end`          | `/sessions/{id}/end`   | POST     | 🟡 中  | 2h       |
| 11  | `sessions/get`          | `/sessions/{id}`       | GET      | 🟡 中  | 2h       |
| 12  | `websocket/connect`     | WebSocket              | -        | 🟡 中  | 2h       |
| 13  | `websocket/disconnect`  | WebSocket              | -        | 🟡 中  | 1h       |
| 14  | `websocket/message`     | WebSocket              | -        | 🟡 中  | 4h       |
| 15  | `websocket/ai-response` | WebSocket              | -        | 🟡 中  | 4h       |
| 16  | `recordings/upload`     | `/recordings`          | POST     | 🟢 低  | 3h       |
| 17  | `recordings/list`       | `/recordings`          | GET      | 🟢 低  | 2h       |
| 18  | `recordings/get`        | `/recordings/{id}`     | GET      | 🟢 低  | 1h       |
| 19  | `users/profile`         | `/users/me`            | GET      | 🟢 低  | 2h       |
| 20  | `users/update`          | `/users/me`            | PUT      | 🟢 低  | 2h       |

**合計見積もり:** 44時間

---

## 実装詳細

### 1. 認証API

#### 1.1 `auth/register` - ユーザー登録

**入力:**

```typescript
{
  email: string;
  password: string;
  name: string;
  organizationId?: string; // オプション（招待時）
}
```

**処理:**

1. メールアドレス重複チェック
2. パスワードハッシュ化
3. Prismaで`users`テーブルに挿入
4. Cognitoユーザー作成
5. JWTトークン生成

**出力:**

```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
  }
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }
}
```

---

#### 1.2 `auth/login` - ログイン

**入力:**

```typescript
{
  email: string;
  password: string;
}
```

**処理:**

1. Cognitoでユーザー認証
2. Prismaでユーザー情報取得
3. JWTトークン生成

**出力:**

```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  }
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }
}
```

---

#### 1.3 `auth/refresh` - トークンリフレッシュ

**入力:**

```typescript
{
  refreshToken: string;
}
```

**処理:**

1. リフレッシュトークン検証
2. 新しいアクセストークン生成

**出力:**

```typescript
{
  accessToken: string;
  expiresIn: number;
}
```

---

### 2. アバター・シナリオAPI

#### 2.1 `avatars/list` - アバター一覧取得

**入力:**

```typescript
Query Parameters:
  - type?: '2d' | '3d'
  - limit?: number (default: 20)
  - offset?: number (default: 0)
```

**処理:**

1. JWT認証
2. Prismaで`avatars`テーブルをクエリ
3. フィルタリング・ページネーション

**出力:**

```typescript
{
  avatars: Array<{
    id: string;
    name: string;
    type: '2d' | '3d';
    thumbnailUrl: string;
    description: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

---

#### 2.2 `avatars/get` - アバター詳細取得

**入力:**

```typescript
Path Parameters:
  - id: string
```

**処理:**

1. JWT認証
2. Prismaで`avatars`テーブルから取得

**出力:**

```typescript
{
  id: string;
  name: string;
  type: '2d' | '3d';
  thumbnailUrl: string;
  modelUrl: string;
  voiceSettings: object;
  description: string;
  createdAt: string;
}
```

---

#### 2.3 `scenarios/list` - シナリオ一覧取得

**入力:**

```typescript
Query Parameters:
  - limit?: number (default: 20)
  - offset?: number (default: 0)
```

**処理:**

1. JWT認証
2. ユーザーの組織IDを取得
3. Prismaで`scenarios`テーブルをクエリ（組織フィルタ）

**出力:**

```typescript
{
  scenarios: Array<{
    id: string;
    name: string;
    description: string;
    difficulty: string;
    estimatedDuration: number;
  }>;
  total: number;
}
```

---

#### 2.4 `scenarios/get` - シナリオ詳細取得

**入力:**

```typescript
Path Parameters:
  - id: string
```

**処理:**

1. JWT認証
2. 組織アクセス権限チェック
3. Prismaで`scenarios`テーブルから取得

**出力:**

```typescript
{
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  topics: string[];
  evaluationCriteria: object;
  difficulty: string;
  estimatedDuration: number;
}
```

---

### 3. セッション管理API

#### 3.1 `sessions/create` - セッション作成

**入力:**

```typescript
{
  avatarId: string;
  scenarioId: string;
}
```

**処理:**

1. JWT認証
2. アバター・シナリオ存在確認
3. Prismaで`sessions`テーブルに挿入
4. DynamoDBにセッション状態を初期化

**出力:**

```typescript
{
  id: string;
  status: 'created';
  avatarId: string;
  scenarioId: string;
  createdAt: string;
}
```

---

#### 3.2 `sessions/start` - セッション開始

**入力:**

```typescript
Path Parameters:
  - id: string (session ID)
```

**処理:**

1. JWT認証
2. セッション存在確認
3. DynamoDBでステータスを`in_progress`に更新
4. WebSocket接続URL生成

**出力:**

```typescript
{
  id: string;
  status: 'in_progress';
  websocketUrl: string;
  startedAt: string;
}
```

---

#### 3.3 `sessions/end` - セッション終了

**入力:**

```typescript
Path Parameters:
  - id: string (session ID)
```

**処理:**

1. JWT認証
2. セッション存在確認
3. DynamoDBでステータスを`completed`に更新
4. Prismaで`sessions`テーブルを更新

**出力:**

```typescript
{
  id: string;
  status: 'completed';
  endedAt: string;
  duration: number;
}
```

---

#### 3.4 `sessions/get` - セッション詳細取得

**入力:**

```typescript
Path Parameters:
  - id: string (session ID)
```

**処理:**

1. JWT認証
2. Prismaで`sessions`テーブルから取得
3. 関連データ（アバター、シナリオ）を結合

**出力:**

```typescript
{
  id: string;
  status: string;
  avatar: {
    (id, name, thumbnailUrl);
  }
  scenario: {
    (id, name, description);
  }
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  recordingUrl: string | null;
}
```

---

### 4. WebSocket API

#### 4.1 `websocket/connect` - WebSocket接続

**処理:**

1. JWT認証（接続URL内のトークン）
2. DynamoDBに接続情報を保存
3. セッションIDと接続IDを紐付け

**出力:**

```typescript
{
  message: 'Connected',
  connectionId: string;
}
```

---

#### 4.2 `websocket/disconnect` - WebSocket切断

**処理:**

1. DynamoDBから接続情報を削除
2. セッションステータス確認（必要に応じて終了処理）

---

#### 4.3 `websocket/message` - ユーザーメッセージ受信

**入力:**

```typescript
{
  action: 'message';
  sessionId: string;
  content: {
    type: 'text' | 'audio';
    data: string; // テキストまたはBase64音声
  }
}
```

**処理:**

1. セッション状態取得（DynamoDB）
2. 音声の場合、Azure STTで文字起こし
3. Claude APIで応答生成
4. ElevenLabs TTSで音声合成
5. `websocket/ai-response`を呼び出して応答送信
6. トランスクリプト保存（Prisma）

---

#### 4.4 `websocket/ai-response` - AI応答送信

**入力:**

```typescript
{
  connectionId: string;
  response: {
    text: string;
    audioUrl: string; // S3 URL
    visemeData: object;
  }
}
```

**処理:**

1. WebSocketクライアントに応答送信
2. DynamoDBのセッション状態を更新

---

### 5. 録画管理API

#### 5.1 `recordings/upload` - 録画アップロード

**入力:**

```typescript
{
  sessionId: string;
  type: 'user' | 'avatar';
  file: File; // multipart/form-data
}
```

**処理:**

1. JWT認証
2. セッション存在確認
3. S3に録画アップロード
4. Prismaで`recordings`テーブルに挿入

**出力:**

```typescript
{
  id: string;
  sessionId: string;
  type: string;
  url: string;
  uploadedAt: string;
}
```

---

#### 5.2 `recordings/list` - 録画一覧取得

**入力:**

```typescript
Query Parameters:
  - sessionId?: string
  - limit?: number
  - offset?: number
```

**処理:**

1. JWT認証
2. Prismaで`recordings`テーブルをクエリ
3. S3署名付きURL生成

**出力:**

```typescript
{
  recordings: Array<{
    id: string;
    sessionId: string;
    type: string;
    url: string;
    duration: number;
  }>;
  total: number;
}
```

---

#### 5.3 `recordings/get` - 録画詳細取得

**入力:**

```typescript
Path Parameters:
  - id: string
```

**処理:**

1. JWT認証
2. Prismaで`recordings`テーブルから取得
3. S3署名付きURL生成

**出力:**

```typescript
{
  id: string;
  sessionId: string;
  type: string;
  url: string;
  duration: number;
  createdAt: string;
}
```

---

### 6. ユーザー管理API

#### 5.1 `users/profile` - プロフィール取得

**処理:**

1. JWT認証
2. Prismaでユーザー情報取得

**出力:**

```typescript
{
  id: string;
  email: string;
  name: string;
  role: string;
  organization: {
    id: string;
    name: string;
  }
}
```

---

#### 6.2 `users/update` - プロフィール更新

**入力:**

```typescript
{
  name?: string;
  // 将来的に他のフィールドも追加
}
```

**処理:**

1. JWT認証
2. Prismaでユーザー情報更新

**出力:**

```typescript
{
  id: string;
  name: string;
  updatedAt: string;
}
```

---

## 共通ライブラリ

すべてのLambda関数で共有するライブラリを作成。

### 構造

```
lambda/
├── shared/
│   ├── auth/
│   │   ├── jwt.ts           # JWT検証・生成
│   │   └── cognito.ts       # Cognito連携
│   ├── database/
│   │   └── prisma.ts        # Prismaクライアント
│   ├── storage/
│   │   └── s3.ts            # S3操作
│   ├── external/
│   │   ├── bedrock.ts       # Claude API
│   │   ├── elevenlabs.ts    # TTS API
│   │   └── azure-stt.ts     # STT API
│   ├── utils/
│   │   ├── response.ts      # APIレスポンス生成
│   │   ├── validation.ts    # バリデーション
│   │   └── errors.ts        # エラーハンドリング
│   └── types/
│       └── index.ts         # 共通型定義
```

### 実装例

#### `shared/auth/jwt.ts`

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};
```

#### `shared/utils/response.ts`

```typescript
export const successResponse = (data: any, statusCode = 200) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(data),
});

export const errorResponse = (message: string, statusCode = 400) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ error: message }),
});
```

---

## テスト戦略

### ユニットテスト

- **ツール:** Jest
- **カバレッジ目標:** 80%以上
- **対象:**
  - 各Lambda関数のビジネスロジック
  - 共通ライブラリの関数

### 統合テスト

- **ツール:** Jest + Supertest
- **対象:**
  - API Gateway + Lambda統合
  - DynamoDB操作
  - S3操作

### E2Eテスト（後回し可）

- **ツール:** Playwright
- **対象:**
  - フロントエンド + バックエンド統合

---

## 実装スケジュール

### Week 1（3/4 - 3/10）

- [ ] 共通ライブラリ実装（auth, database, utils）
- [ ] `auth/register`, `auth/login`, `auth/refresh`
- [ ] `avatars/list`, `avatars/get`

### Week 2（3/11 - 3/17）

- [ ] `scenarios/list`, `scenarios/get`
- [ ] `sessions/create`, `sessions/get`
- [ ] ユニットテスト（認証・リソース取得）

### Week 3（3/18 - 3/24）

- [ ] `sessions/start`, `sessions/end`
- [ ] `websocket/connect`, `websocket/disconnect`
- [ ] DynamoDB統合テスト

### Week 4（3/25 - 3/31）

- [ ] `websocket/message`, `websocket/ai-response`
- [ ] Claude API統合
- [ ] ElevenLabs TTS統合
- [ ] Azure STT統合

### Week 5（4/1 - 4/7）

- [ ] `recordings/upload`, `recordings/list`, `recordings/get`
- [ ] S3署名付きURL生成
- [ ] 統合テスト

### Week 6（4/8 - 4/14）

- [ ] `users/profile`, `users/update`
- [ ] バグ修正
- [ ] ドキュメント整備

---

## 次のステップ

1. **共通ライブラリの実装**
   - `lambda/shared/` ディレクトリを作成
   - JWT、Prisma、レスポンスユーティリティを実装

2. **認証APIの実装**
   - `auth/register` から開始
   - Cognitoとの統合を確認

3. **CDKスタックの更新**
   - Lambda関数を`lambda-stack.ts`に追加
   - API Gatewayルートを設定

---

**最終更新:** 2026-03-04
**次回レビュー:** Week 1完了時（3/10）
