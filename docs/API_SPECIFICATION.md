# API仕様書

Prance Communication Platform REST API v1.0

## 目次

- [概要](#概要)
- [認証・認可](#認証認可)
- [エンドポイント一覧](#エンドポイント一覧)
- [データモデル](#データモデル)
- [エラーハンドリング](#エラーハンドリング)
- [レート制限](#レート制限)
- [WebSocket API](#websocket-api)

---

## 概要

### ベースURL

```
Production:  https://api.prance-platform.com/v1
Staging:     https://api-staging.prance-platform.com/v1
```

### リクエスト形式

- **Content-Type:** `application/json`
- **文字エンコーディング:** UTF-8
- **HTTPメソッド:** GET, POST, PUT, PATCH, DELETE

### レスポンス形式

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-03-04T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

### エラーレスポンス

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Session not found",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-03-04T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

---

## 認証・認可

### 認証方式

#### 1. JWT Bearer Token（ユーザー認証）

```http
GET /api/v1/sessions HTTP/1.1
Host: api.prance-platform.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**トークン取得:**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {
      "id": "user_12345",
      "email": "user@example.com",
      "name": "田中太郎",
      "role": "client_user",
      "org_id": "org_67890"
    }
  }
}
```

#### 2. API Key認証（外部連携）

```http
GET /api/v1/sessions HTTP/1.1
Host: api.prance-platform.com
Authorization: Bearer sk_live_[YOUR_API_KEY]
X-Tenant-Id: org_67890
Content-Type: application/json
```

### 権限レベル

| ロール         | 説明               | アクセス範囲           |
| -------------- | ------------------ | ---------------------- |
| `super_admin`  | スーパー管理者     | 全テナント・全機能     |
| `client_admin` | クライアント管理者 | 自組織内・管理機能     |
| `client_user`  | 一般ユーザー       | 自分のデータ・基本機能 |
| `api_key`      | API認証            | スコープで制限         |

---

## エンドポイント一覧

### 認証

#### POST /auth/login

ユーザーログイン

**リクエスト:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 3600,
    "user": { ... }
  }
}
```

#### POST /auth/refresh

トークンリフレッシュ

**リクエスト:**

```json
{
  "refresh_token": "eyJ..."
}
```

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "expires_in": 3600
  }
}
```

#### POST /auth/logout

ログアウト

**レスポンス: 200 OK**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### アバター

#### GET /avatars

アバター一覧取得

**クエリパラメータ:**

| パラメータ   | 型      | 必須 | 説明                                 |
| ------------ | ------- | ---- | ------------------------------------ |
| `type`       | string  | No   | フィルタ: `2d`, `3d`                 |
| `style`      | string  | No   | フィルタ: `anime`, `real`            |
| `visibility` | string  | No   | フィルタ: `private`, `org`, `public` |
| `page`       | integer | No   | ページ番号（デフォルト: 1）          |
| `per_page`   | integer | No   | 1ページあたり件数（デフォルト: 20）  |

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "avatar_12345",
      "name": "Alex - Business Professional",
      "type": "3d",
      "style": "real",
      "source": "preset",
      "model_url": "https://cdn.prance.com/avatars/alex.glb",
      "thumbnail_url": "https://cdn.prance.com/avatars/alex_thumb.jpg",
      "tags": ["business", "professional", "male"],
      "visibility": "public",
      "created_at": "2026-02-01T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

#### GET /avatars/presets

プリセットアバター一覧

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "avatar_preset_001",
      "name": "Alex",
      "type": "3d",
      "style": "real",
      "category": "business",
      "thumbnail_url": "...",
      "preview_url": "..."
    }
  ]
}
```

#### POST /avatars

アバター作成

**リクエスト:**

```json
{
  "name": "My Custom Avatar",
  "type": "3d",
  "style": "real",
  "source": "generated",
  "source_image_url": "https://example.com/photo.jpg",
  "visibility": "private"
}
```

**レスポンス: 201 Created**

```json
{
  "success": true,
  "data": {
    "id": "avatar_67890",
    "name": "My Custom Avatar",
    "status": "processing",
    "estimated_completion": "2026-03-04T10:35:00Z"
  }
}
```

#### DELETE /avatars/:id

アバター削除

**レスポンス: 204 No Content**

---

### シナリオ

#### GET /scenarios

シナリオ一覧取得

**クエリパラメータ:**

| パラメータ   | 型     | 必須 | 説明             |
| ------------ | ------ | ---- | ---------------- |
| `category`   | string | No   | カテゴリフィルタ |
| `language`   | string | No   | 言語フィルタ     |
| `visibility` | string | No   | 公開範囲フィルタ |

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "scenario_12345",
      "title": "エンジニア採用面接 - 中級",
      "description": "IT企業の技術職採用を想定した面接練習",
      "category": "job_interview",
      "language": "ja",
      "visibility": "public",
      "config": {
        "max_duration_min": 30,
        "avatar_persona": { ... }
      },
      "usage_count": 1250,
      "avg_rating": 4.7,
      "created_at": "2026-02-01T10:00:00Z"
    }
  ]
}
```

#### POST /scenarios

シナリオ作成

**リクエスト:**

```json
{
  "title": "カスタマーサポート研修",
  "description": "クレーム対応のロールプレイ",
  "category": "customer_service",
  "language": "ja",
  "visibility": "org",
  "config": {
    "max_duration_min": 20,
    "avatar_persona": {
      "role": "クレーム顧客",
      "personality": "strict",
      "pressure_level": 4
    },
    "conversation_flow": {
      "opening": "先日購入した商品に不具合がありまして...",
      "required_topics": ["問題のヒアリング", "謝罪と共感", "解決策の提案", "今後の対応"]
    },
    "evaluation_criteria": [
      {
        "metric": "共感力",
        "weight": 0.3,
        "rubric": "顧客の気持ちに寄り添った対応ができているか"
      }
    ]
  }
}
```

**レスポンス: 201 Created**

```json
{
  "success": true,
  "data": {
    "id": "scenario_67890",
    "title": "カスタマーサポート研修",
    ...
  }
}
```

---

### セッション

#### POST /sessions

セッション開始

**リクエスト:**

```json
{
  "scenario_id": "scenario_12345",
  "avatar_id": "avatar_preset_001",
  "voice_id": "voice_ja_female_01"
}
```

**レスポンス: 201 Created**

```json
{
  "success": true,
  "data": {
    "session_id": "session_abc123",
    "status": "created",
    "websocket_url": "wss://iot.prance-platform.com",
    "connection_token": "conn_token_xyz789",
    "expires_at": "2026-03-04T12:00:00Z"
  }
}
```

#### GET /sessions

セッション一覧取得

**クエリパラメータ:**

| パラメータ  | 型     | 必須 | 説明                      |
| ----------- | ------ | ---- | ------------------------- |
| `status`    | string | No   | ステータスフィルタ        |
| `from_date` | string | No   | 開始日フィルタ (ISO 8601) |
| `to_date`   | string | No   | 終了日フィルタ (ISO 8601) |

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "session_abc123",
      "user_id": "user_12345",
      "scenario_id": "scenario_12345",
      "status": "completed",
      "started_at": "2026-03-04T10:00:00Z",
      "ended_at": "2026-03-04T10:28:15Z",
      "duration_sec": 1695
    }
  ]
}
```

#### GET /sessions/:id

セッション詳細取得

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "session_abc123",
    "user": {
      "id": "user_12345",
      "name": "田中太郎"
    },
    "scenario": {
      "id": "scenario_12345",
      "title": "エンジニア採用面接 - 中級"
    },
    "avatar": {
      "id": "avatar_preset_001",
      "name": "Alex"
    },
    "status": "completed",
    "started_at": "2026-03-04T10:00:00Z",
    "ended_at": "2026-03-04T10:28:15Z",
    "duration_sec": 1695,
    "turn_count": 24,
    "recordings": [
      {
        "type": "combined",
        "url": "https://cdn.prance.com/recordings/session_abc123_combined.mp4",
        "thumbnail_url": "https://cdn.prance.com/recordings/session_abc123_thumb.jpg"
      }
    ]
  }
}
```

#### GET /sessions/:id/transcript

トランスクリプト取得

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "transcript_001",
      "speaker": "AI",
      "text": "本日はよろしくお願いします。まず自己紹介をお願いできますか？",
      "timestamp_start": 3.2,
      "timestamp_end": 8.5,
      "confidence": 0.98,
      "highlight": null
    },
    {
      "id": "transcript_002",
      "speaker": "USER",
      "text": "よろしくお願いします。私は田中太郎と申します。5年間Webエンジニアとして...",
      "timestamp_start": 9.1,
      "timestamp_end": 25.7,
      "confidence": 0.95,
      "highlight": "positive"
    }
  ]
}
```

#### GET /sessions/:id/report

レポート取得

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "report_xyz789",
    "session_id": "session_abc123",
    "overall_score": 78,
    "section_scores": [
      {
        "name": "論理的説明力",
        "score": 82,
        "feedback": "技術的な説明が具体的で分かりやすかったです。"
      },
      {
        "name": "アイコンタクト",
        "score": 65,
        "feedback": "14分頃から視線が外れる傾向が見られました。"
      }
    ],
    "ai_feedback": "技術説明は具体的で論理的でした。一方、14分頃から...",
    "highlights": [
      {
        "timestamp": 503,
        "type": "positive",
        "description": "Reactのパフォーマンス最適化について具体的な事例を挙げて説明"
      }
    ],
    "recommendations": [
      {
        "priority": "high",
        "title": "話速の改善",
        "description": "現在平均 180 WPM → 目標 140-160 WPM"
      }
    ],
    "pdf_url": "https://cdn.prance.com/reports/session_abc123.pdf",
    "generated_at": "2026-03-04T10:35:00Z"
  }
}
```

---

### プロファイル・ベンチマーク

#### GET /users/:id/profile

ユーザープロファイル取得

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": {
    "user_id": "user_12345",
    "overall_score": 78,
    "overall_percentile": 77,
    "metrics": {
      "logical_explanation": 82,
      "eye_contact": 90,
      "speaking_pace": 58,
      "vocabulary": 72,
      "confidence": 70,
      "emotional_stability": 82
    },
    "profile_type": "自信と安定感のあるコミュニケーター",
    "profile_description": "非言語コミュニケーションが強く、安定したトーンで話す傾向。",
    "similar_users_percentage": 12,
    "growth_trend": "improving",
    "monthly_change": 5,
    "six_month_change": 28,
    "last_calculated_at": "2026-03-04T02:00:00Z"
  }
}
```

#### GET /users/:id/profile/benchmark

ベンチマーク詳細取得

**クエリパラメータ:**

| パラメータ  | 型     | 必須 | 説明                                               |
| ----------- | ------ | ---- | -------------------------------------------------- |
| `timeframe` | string | No   | `month`, `quarter`, `year` (デフォルト: `quarter`) |

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": {
    "user": {
      "overall_score": 78,
      "percentile": 77
    },
    "org_avg": {
      "overall_score": 65,
      "percentile": 50
    },
    "top_10_percent": {
      "overall_score": 85
    },
    "metrics_comparison": [
      {
        "name": "論理的説明力",
        "user_score": 82,
        "org_avg": 65,
        "top_10_percent": 85
      }
    ],
    "recommendations": [
      {
        "priority": "high",
        "category": "話速の改善",
        "current_value": 180,
        "target_value": 150,
        "description": "現在平均 180 WPM → 目標 140-160 WPM",
        "suggested_scenarios": ["scenario_slow_speaking"]
      }
    ]
  }
}
```

#### GET /users/:id/achievements

達成バッジ一覧取得

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "achievement_001",
      "achievement_type": "streak",
      "achievement_name": "連続10セッション達成",
      "description": "10回連続でセッションを完了しました",
      "icon_url": "https://cdn.prance.com/badges/streak_10.svg",
      "earned_at": "2026-03-01T15:30:00Z"
    }
  ]
}
```

---

### 管理者API

#### GET /admin/users

ユーザー一覧取得（管理者）

**権限: `client_admin`, `super_admin`**

**クエリパラメータ:**

| パラメータ | 型     | 必須 | 説明             |
| ---------- | ------ | ---- | ---------------- |
| `role`     | string | No   | ロールフィルタ   |
| `search`   | string | No   | 名前・メール検索 |

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "user_12345",
      "name": "田中太郎",
      "email": "tanaka@example.com",
      "role": "client_user",
      "created_at": "2026-01-15T10:00:00Z",
      "last_login_at": "2026-03-04T09:30:00Z"
    }
  ]
}
```

#### POST /admin/users/invite

ユーザー招待

**権限: `client_admin`, `super_admin`**

**リクエスト:**

```json
{
  "email": "newuser@example.com",
  "name": "新規ユーザー",
  "role": "client_user"
}
```

**レスポンス: 201 Created**

```json
{
  "success": true,
  "data": {
    "user_id": "user_99999",
    "email": "newuser@example.com",
    "invitation_sent": true,
    "invitation_expires_at": "2026-03-11T10:00:00Z"
  }
}
```

#### GET /admin/api-keys

APIキー一覧取得

**権限: `client_admin`, `super_admin`**

**レスポンス: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "key_12345",
      "key_name": "Production API Key",
      "key_prefix": "sk_live_xxxx",
      "environment": "live",
      "is_active": true,
      "scopes": ["sessions.read", "sessions.write", "reports.read"],
      "rate_limit_monthly": 50000,
      "rate_limit_daily": 5000,
      "rate_limit_hourly": 500,
      "created_at": "2026-01-15T10:00:00Z",
      "last_used_at": "2026-03-04T09:00:00Z"
    }
  ]
}
```

#### POST /admin/api-keys

APIキー作成

**権限: `client_admin`, `super_admin`**

**リクエスト:**

```json
{
  "key_name": "Development API Key",
  "description": "開発環境用APIキー",
  "environment": "test",
  "scopes": ["sessions.read", "reports.read"],
  "rate_limit_monthly": 10000,
  "rate_limit_daily": 1000,
  "rate_limit_hourly": 100,
  "expires_at": "2026-12-31T23:59:59Z"
}
```

**レスポンス: 201 Created**

```json
{
  "success": true,
  "data": {
    "id": "key_67890",
    "key": "sk_test_abcdefghijklmnopqrstuvwxyz1234567890",
    "key_name": "Development API Key",
    "environment": "test",
    "created_at": "2026-03-04T10:00:00Z",
    "warning": "このキーは一度しか表示されません。安全に保管してください。"
  }
}
```

---

## データモデル

### Avatar

```typescript
interface Avatar {
  id: string;
  user_id?: string;
  org_id?: string;
  name: string;
  description?: string;
  type: '2d' | '3d';
  style: 'anime' | 'real' | 'custom';
  source: 'preset' | 'generated' | 'org_custom' | 'user_custom';
  model_url: string;
  thumbnail_url?: string;
  config: {
    blendshapes_mapping?: object;
    default_expression?: string;
    scale?: number;
  };
  tags?: string[];
  visibility: 'private' | 'org' | 'public';
  usage_count: number;
  created_at: string; // ISO 8601
  updated_at: string;
}
```

### Scenario

```typescript
interface Scenario {
  id: string;
  user_id: string;
  org_id?: string;
  title: string;
  description?: string;
  category: 'job_interview' | 'language' | 'customer_service' | 'survey' | string;
  language: string; // ISO 639-1
  visibility: 'private' | 'org' | 'public';
  config: {
    max_duration_min: number;
    avatar_persona: {
      role: string;
      personality: 'friendly' | 'professional' | 'strict' | 'casual';
      pressure_level: number; // 1-5
      background?: string;
    };
    conversation_flow: {
      opening: string;
      required_topics: string[];
      follow_up_questions?: boolean;
      transition_style?: 'natural' | 'structured';
    };
    interaction_params?: {
      style: 'structured' | 'free' | 'mixed';
      response_wait_sec?: number;
      interruption?: boolean;
    };
    evaluation_criteria?: Array<{
      metric: string;
      weight: number;
      rubric: string;
    }>;
  };
  report_template_id?: string;
  prompt_template_id?: string;
  usage_count: number;
  avg_rating?: number;
  created_at: string;
  updated_at: string;
}
```

### Session

```typescript
interface Session {
  id: string;
  user_id: string;
  org_id: string;
  scenario_id: string;
  avatar_id: string;
  voice_id: string;
  prompt_template_id?: string;
  provider_snapshot?: object;
  status: 'active' | 'processing' | 'completed' | 'error' | 'canceled';
  error_message?: string;
  started_at: string;
  ended_at?: string;
  duration_sec?: number;
  turn_count: number;
  created_at: string;
  updated_at: string;
}
```

### Report

```typescript
interface Report {
  id: string;
  session_id: string;
  template_id?: string;
  overall_score: number; // 0-100
  section_scores: Array<{
    name: string;
    score: number;
    feedback?: string;
  }>;
  ai_feedback?: string;
  highlights: Array<{
    timestamp: number;
    type: 'positive' | 'negative' | 'important';
    description: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
  }>;
  pdf_url?: string;
  generated_at: string;
}
```

---

## エラーハンドリング

### HTTPステータスコード

| コード | 意味                  | 使用例                           |
| ------ | --------------------- | -------------------------------- |
| 200    | OK                    | 成功                             |
| 201    | Created               | リソース作成成功                 |
| 204    | No Content            | 削除成功（レスポンスボディなし） |
| 400    | Bad Request           | リクエストパラメータエラー       |
| 401    | Unauthorized          | 認証エラー                       |
| 403    | Forbidden             | 権限不足                         |
| 404    | Not Found             | リソースが見つからない           |
| 409    | Conflict              | リソース競合                     |
| 422    | Unprocessable Entity  | バリデーションエラー             |
| 429    | Too Many Requests     | レート制限超過                   |
| 500    | Internal Server Error | サーバーエラー                   |
| 503    | Service Unavailable   | サービス停止中                   |

### エラーコード

```typescript
enum ErrorCode {
  // 認証・認可
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // リソース
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

  // バリデーション
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // レート制限
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // クォータ
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',

  // サーバーエラー
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}
```

### エラーレスポンス例

**400 Bad Request:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "password": ["Password must be at least 8 characters"]
      }
    }
  },
  "meta": {
    "timestamp": "2026-03-04T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

**401 Unauthorized:**

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired",
    "details": {
      "expired_at": "2026-03-04T10:00:00Z"
    }
  }
}
```

**429 Too Many Requests:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 1000,
      "window": "hourly",
      "retry_after": 3600
    }
  },
  "meta": {
    "timestamp": "2026-03-04T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

---

## レート制限

### 制限タイプ

| プラン     | 時間あたり | 日次   | 月次     |
| ---------- | ---------- | ------ | -------- |
| Free       | 10         | 100    | 1,000    |
| Pro        | 100        | 1,000  | 10,000   |
| Enterprise | 1,000      | 10,000 | カスタム |

### レスポンスヘッダー

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1709553600
```

### 制限超過時

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709553600

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "retry_after": 3600
    }
  }
}
```

---

## WebSocket API

### 接続

```javascript
const ws = new WebSocket('wss://iot.prance-platform.com');

// 接続時
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: 'authenticate',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      session_id: 'session_abc123',
    })
  );
};
```

### メッセージタイプ

#### クライアント → サーバー

**音声ストリーム送信:**

```javascript
{
  type: 'audio_chunk',
  data: ArrayBuffer, // 音声データ
  timestamp: 1234567890
}
```

**発話終了通知:**

```javascript
{
  type: 'speech_end',
  timestamp: 1234567890
}
```

**ユーザー発話テキスト送信（STT確定後）:**

```javascript
{
  type: 'user_speech',
  text: 'よろしくお願いします。私は5年間Webエンジニアをしています。',
  timestamp: 1234567890,
  confidence: 0.95
}
```

**セッション終了:**

```javascript
{
  type: 'session_end';
}
```

#### サーバー → クライアント

**リアルタイム字幕（部分）- ユーザー発話認識中:**

```javascript
{
  type: 'transcript_partial',
  speaker: 'USER',
  text: 'よろしくお願い...',
  confidence: 0.85,
  timestamp: 1234567890
}
```

**リアルタイム字幕（確定）- ユーザー発話確定:**

```javascript
{
  type: 'transcript_final',
  speaker: 'USER',
  text: 'よろしくお願いします。',
  timestamp_start: 9.1,
  timestamp_end: 11.3,
  confidence: 0.95
}
```

**AI応答テキスト（アバター発話）:**

```javascript
{
  type: 'avatar_response',
  speaker: 'AI',
  text: 'ありがとうございます。それでは、まず自己紹介をお願いできますか？',
  timestamp: 1234567890
}
```

**TTS音声データ:**

```javascript
{
  type: 'tts_audio',
  data: ArrayBuffer, // 音声データ
  visemes: [
    { timestamp: 0.0, shape: 'A' },
    { timestamp: 0.1, shape: 'E' },
    // ...
  ]
}
```

**アバター感情変化:**

```javascript
{
  type: 'avatar_emotion',
  emotion: 'happy',
  intensity: 0.7
}
```

**処理進捗:**

```javascript
{
  type: 'processing_update',
  stage: 'transcribing',
  progress: 0.45
}
```

**セッション完了:**

```javascript
{
  type: 'session_complete',
  session_id: 'session_abc123',
  report_id: 'report_xyz789'
}
```

**エラー:**

```javascript
{
  type: 'error',
  code: 'AUDIO_PROCESSING_ERROR',
  message: 'Failed to process audio chunk',
  details: { ... }
}
```

---

## ページネーション

### クエリパラメータ

```
GET /api/v1/sessions?page=2&per_page=20
```

### レスポンス

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 2,
    "per_page": 20,
    "total": 145,
    "total_pages": 8,
    "has_next": true,
    "has_prev": true
  },
  "links": {
    "first": "/api/v1/sessions?page=1&per_page=20",
    "prev": "/api/v1/sessions?page=1&per_page=20",
    "next": "/api/v1/sessions?page=3&per_page=20",
    "last": "/api/v1/sessions?page=8&per_page=20"
  }
}
```

---

## Webhook

### Webhook設定

APIキー作成時にWebhook URLを設定可能。

### イベントタイプ

| イベント            | 説明             |
| ------------------- | ---------------- |
| `session.created`   | セッション作成   |
| `session.completed` | セッション完了   |
| `report.generated`  | レポート生成完了 |
| `user.created`      | ユーザー作成     |

### ペイロード例

```http
POST https://your-server.com/webhook
Content-Type: application/json
X-Prance-Signature: sha256=abcdef1234567890...
X-Prance-Event: session.completed

{
  "event": "session.completed",
  "timestamp": "2026-03-04T10:30:00Z",
  "data": {
    "session_id": "session_abc123",
    "user_id": "user_12345",
    "overall_score": 78,
    "duration_sec": 1695,
    "report_url": "https://api.prance-platform.com/v1/sessions/session_abc123/report"
  }
}
```

### 署名検証

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
```

---

## SDK・サンプルコード

### JavaScript/TypeScript

```bash
npm install @prance/sdk
```

```typescript
import { PranceClient } from '@prance/sdk';

const client = new PranceClient({
  apiKey: 'sk_live_[YOUR_API_KEY]',
  environment: 'production',
});

// セッション作成
const session = await client.sessions.create({
  scenario_id: 'scenario_12345',
  avatar_id: 'avatar_preset_001',
  voice_id: 'voice_ja_female_01',
});

console.log('Session ID:', session.session_id);

// レポート取得
const report = await client.sessions.getReport(session.session_id);
console.log('Overall Score:', report.overall_score);
```

### Python

```bash
pip install prance-sdk
```

```python
from prance import PranceClient

client = PranceClient(
    api_key='sk_live_[YOUR_API_KEY]',
    environment='production'
)

# セッション作成
session = client.sessions.create(
    scenario_id='scenario_12345',
    avatar_id='avatar_preset_001',
    voice_id='voice_ja_female_01'
)

print(f'Session ID: {session.session_id}')

# レポート取得
report = client.sessions.get_report(session.session_id)
print(f'Overall Score: {report.overall_score}')
```

---

## バージョニング

### APIバージョン

現在のバージョン: `v1`

- **メジャーバージョン:** 破壊的変更時にインクリメント
- **マイナーバージョン:** 後方互換性のある機能追加
- **パッチバージョン:** バグ修正

### 非推奨化プロセス

1. 新バージョンリリース（例: v2）
2. 旧バージョン非推奨通知（6ヶ月前）
3. 並行運用期間（最低6ヶ月）
4. 旧バージョン停止

---

次のステップ: [ビジネス概要](BUSINESS_OVERVIEW.md) → [運用ガイド](OPERATIONS_GUIDE.md)
