# ゲストユーザー機能 - Prismaスキーマドラフト

**作成日:** 2026-03-11
**ステータス:** ドラフト（実装前）

---

## 📋 新規テーブル設計

### GuestSession テーブル

**目的:** ゲストセッションの招待・認証・ライフサイクル管理

```prisma
model GuestSession {
  id              String    @id @default(uuid())

  // 組織・作成者
  orgId           String    @map("org_id")
  creatorUserId   String    @map("creator_user_id")

  // セッション関連
  sessionId       String?   @unique @map("session_id")
  scenarioId      String    @map("scenario_id")
  avatarId        String?   @map("avatar_id")

  // 認証情報
  token           String    @unique  // UUID v4（32文字、ハイフンなし）
  pinHash         String    @map("pin_hash")  // bcrypt hash

  // ゲスト情報（オプション）
  guestName       String?   @map("guest_name")
  guestEmail      String?   @map("guest_email")
  guestMetadata   Json?     @default("{}") @map("guest_metadata")

  // ステータス管理
  status          GuestSessionStatus @default(PENDING)

  // 有効期限
  validFrom       DateTime  @default(now()) @map("valid_from")
  validUntil      DateTime  @map("valid_until")

  // アクセス管理
  accessCount     Int       @default(0) @map("access_count")
  failedAttempts  Int       @default(0) @map("failed_attempts")
  lockedUntil     DateTime? @map("locked_until")
  firstAccessedAt DateTime? @map("first_accessed_at")
  completedAt     DateTime? @map("completed_at")

  // データ保持
  dataRetentionDays Int?    @map("data_retention_days")
  autoDeleteAt    DateTime? @map("auto_delete_at")

  // タイムスタンプ
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // リレーション
  organization    Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  creator         User         @relation(fields: [creatorUserId], references: [id], onDelete: Cascade)
  session         Session?     @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  scenario        Scenario     @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  avatar          Avatar?      @relation(fields: [avatarId], references: [id], onDelete: SetNull)
  logs            GuestSessionLog[]

  // インデックス
  @@index([token])
  @@index([orgId])
  @@index([creatorUserId])
  @@index([status])
  @@index([validUntil])
  @@index([autoDeleteAt])

  @@map("guest_sessions")
}
```

### GuestSessionStatus Enum

```prisma
enum GuestSessionStatus {
  PENDING   // 未開始（作成直後）
  ACTIVE    // 進行中（ゲストがアクセス中）
  COMPLETED // 完了（セッション終了）
  EXPIRED   // 期限切れ（validUntil超過）
  REVOKED   // 無効化（管理者が手動無効化）
}
```

### GuestSessionLog テーブル

**目的:** ゲストセッションのアクセスログ・監査記録

```prisma
model GuestSessionLog {
  id             String    @id @default(uuid())
  guestSessionId String    @map("guest_session_id")

  // ログ種別
  eventType      String    @map("event_type")  // access, auth_success, auth_failure, session_start, session_end, revoked

  // アクセス情報
  ipAddress      String?   @map("ip_address")
  userAgent      String?   @map("user_agent")

  // 詳細情報
  details        Json?     @default("{}")

  // タイムスタンプ
  createdAt      DateTime  @default(now()) @map("created_at")

  // リレーション
  guestSession   GuestSession @relation(fields: [guestSessionId], references: [id], onDelete: Cascade)

  // インデックス
  @@index([guestSessionId])
  @@index([eventType])
  @@index([createdAt])

  @@map("guest_session_logs")
}
```

---

## 📊 既存テーブル拡張

### Session テーブル拡張

**追加フィールド:**

```prisma
model Session {
  // ... 既存フィールド（変更なし）

  // ✅ ゲストセッション対応フィールド（追加）
  isGuestSession Boolean @default(false) @map("is_guest_session")
  guestSessionId String? @map("guest_session_id")

  // ✅ ゲストセッションリレーション（追加）
  guestSession   GuestSession? @relation(fields: [guestSessionId], references: [id], onDelete: SetNull)

  // ✅ インデックス（追加）
  @@index([isGuestSession])
  @@index([guestSessionId])

  // @@map("sessions")  // 既存
}
```

### User テーブル拡張

**追加リレーション:**

```prisma
model User {
  // ... 既存フィールド（変更なし）

  // ✅ ゲストセッション作成者リレーション（追加）
  createdGuestSessions GuestSession[] @relation("GuestSessionCreator")

  // @@map("users")  // 既存
}
```

### Organization テーブル拡張

**追加リレーション:**

```prisma
model Organization {
  // ... 既存フィールド（変更なし）

  // ✅ ゲストセッションリレーション（追加）
  guestSessions GuestSession[]

  // @@map("organizations")  // 既存
}
```

### Scenario テーブル拡張

**追加リレーション:**

```prisma
model Scenario {
  // ... 既存フィールド（変更なし）

  // ✅ ゲストセッションリレーション（追加）
  guestSessions GuestSession[]

  // @@map("scenarios")  // 既存
}
```

### Avatar テーブル拡張

**追加リレーション:**

```prisma
model Avatar {
  // ... 既存フィールド（変更なし）

  // ✅ ゲストセッションリレーション（追加）
  guestSessions GuestSession[]

  // @@map("avatars")  // 既存
}
```

---

## 🔍 フィールド詳細説明

### GuestSession フィールド

| フィールド名 | 型 | NULL | デフォルト | 説明 |
|-------------|-----|------|-----------|------|
| **id** | String | ❌ | uuid() | プライマリキー |
| **orgId** | String | ❌ | - | 組織ID（外部キー） |
| **creatorUserId** | String | ❌ | - | 作成者のユーザーID（外部キー） |
| **sessionId** | String | ✅ | null | 紐づくセッションID（セッション開始後に設定） |
| **scenarioId** | String | ❌ | - | シナリオID（外部キー） |
| **avatarId** | String | ✅ | null | アバターID（外部キー、オプション） |
| **token** | String | ❌ | - | 招待URLトークン（UUID v4、32文字） |
| **pinHash** | String | ❌ | - | PINコードのbcryptハッシュ |
| **guestName** | String | ✅ | null | ゲストの名前（候補者名等） |
| **guestEmail** | String | ✅ | null | ゲストのメールアドレス |
| **guestMetadata** | Json | ✅ | {} | 追加情報（部署、ポジション等） |
| **status** | Enum | ❌ | PENDING | セッションステータス |
| **validFrom** | DateTime | ❌ | now() | 有効期限開始日時 |
| **validUntil** | DateTime | ❌ | - | 有効期限終了日時 |
| **accessCount** | Int | ❌ | 0 | アクセス回数 |
| **failedAttempts** | Int | ❌ | 0 | 認証失敗回数 |
| **lockedUntil** | DateTime | ✅ | null | ロックアウト解除日時 |
| **firstAccessedAt** | DateTime | ✅ | null | 初回アクセス日時 |
| **completedAt** | DateTime | ✅ | null | セッション完了日時 |
| **dataRetentionDays** | Int | ✅ | null | データ保持日数（NULLなら無期限） |
| **autoDeleteAt** | DateTime | ✅ | null | 自動削除日時 |
| **createdAt** | DateTime | ❌ | now() | 作成日時 |
| **updatedAt** | DateTime | ❌ | now() | 更新日時 |

### GuestSessionLog フィールド

| フィールド名 | 型 | NULL | デフォルト | 説明 |
|-------------|-----|------|-----------|------|
| **id** | String | ❌ | uuid() | プライマリキー |
| **guestSessionId** | String | ❌ | - | ゲストセッションID（外部キー） |
| **eventType** | String | ❌ | - | イベント種別 |
| **ipAddress** | String | ✅ | null | IPアドレス |
| **userAgent** | String | ✅ | null | ユーザーエージェント |
| **details** | Json | ✅ | {} | 詳細情報 |
| **createdAt** | DateTime | ❌ | now() | 作成日時 |

### イベント種別（eventType）

| 値 | 説明 |
|----|------|
| **access** | ランディングページアクセス |
| **auth_success** | PIN認証成功 |
| **auth_failure** | PIN認証失敗 |
| **session_start** | セッション開始 |
| **session_end** | セッション終了 |
| **revoked** | 無効化 |

---

## 🔗 リレーション図

```
Organization
├── users (1:N)
├── scenarios (1:N)
├── avatars (1:N)
├── sessions (1:N)
└── guestSessions (1:N)  ✅ 新規

User
├── sessions (1:N)
└── createdGuestSessions (1:N)  ✅ 新規

Scenario
├── sessions (1:N)
└── guestSessions (1:N)  ✅ 新規

Avatar
├── sessions (1:N)
└── guestSessions (1:N)  ✅ 新規

GuestSession  ✅ 新規
├── session (1:1, optional)
├── logs (1:N)
├── organization (N:1)
├── creator (N:1)
├── scenario (N:1)
└── avatar (N:1, optional)

Session
└── guestSession (1:1, optional)  ✅ 新規リレーション
```

---

## 📝 マイグレーションSQL（生成予定）

### マイグレーション1: guest_sessions テーブル作成

```bash
pnpm exec prisma migrate dev --name add_guest_sessions
```

**生成されるSQL（予想）:**

```sql
-- CreateEnum
CREATE TYPE "GuestSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "scenario_id" TEXT NOT NULL,
    "avatar_id" TEXT,
    "token" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "guest_name" TEXT,
    "guest_email" TEXT,
    "guest_metadata" JSONB DEFAULT '{}',
    "status" "GuestSessionStatus" NOT NULL DEFAULT 'PENDING',
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "first_accessed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "data_retention_days" INTEGER,
    "auto_delete_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_session_logs" (
    "id" TEXT NOT NULL,
    "guest_session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_session_id_key" ON "guest_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_token_key" ON "guest_sessions"("token");

-- CreateIndex
CREATE INDEX "guest_sessions_token_idx" ON "guest_sessions"("token");

-- CreateIndex
CREATE INDEX "guest_sessions_org_id_idx" ON "guest_sessions"("org_id");

-- CreateIndex
CREATE INDEX "guest_sessions_creator_user_id_idx" ON "guest_sessions"("creator_user_id");

-- CreateIndex
CREATE INDEX "guest_sessions_status_idx" ON "guest_sessions"("status");

-- CreateIndex
CREATE INDEX "guest_sessions_valid_until_idx" ON "guest_sessions"("valid_until");

-- CreateIndex
CREATE INDEX "guest_sessions_auto_delete_at_idx" ON "guest_sessions"("auto_delete_at");

-- CreateIndex
CREATE INDEX "guest_session_logs_guest_session_id_idx" ON "guest_session_logs"("guest_session_id");

-- CreateIndex
CREATE INDEX "guest_session_logs_event_type_idx" ON "guest_session_logs"("event_type");

-- CreateIndex
CREATE INDEX "guest_session_logs_created_at_idx" ON "guest_session_logs"("created_at");

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_session_logs" ADD CONSTRAINT "guest_session_logs_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### マイグレーション2: sessions テーブル拡張

```sql
-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "is_guest_session" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "guest_session_id" TEXT;

-- CreateIndex
CREATE INDEX "sessions_is_guest_session_idx" ON "sessions"("is_guest_session");

-- CreateIndex
CREATE INDEX "sessions_guest_session_id_idx" ON "sessions"("guest_session_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "guest_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## ✅ 検証項目

### データ整合性チェック

- [ ] **外部キー制約:** 全てのリレーションが正しく設定されている
- [ ] **ON DELETE動作:** Cascade/SetNullが適切に設定されている
- [ ] **UNIQUE制約:** token, sessionIdがユニーク
- [ ] **NOT NULL制約:** 必須フィールドがNOT NULL

### パフォーマンスチェック

- [ ] **インデックス:** 検索頻度の高いフィールドにインデックス設定
  - token（UNIQUE + INDEX）
  - orgId, creatorUserId, status, validUntil, autoDeleteAt
- [ ] **クエリ最適化:** N+1問題が発生しないか確認

### セキュリティチェック

- [ ] **pinHash:** プレーンテキストPINは保存しない
- [ ] **token:** UUID v4でランダム生成、推測不可能
- [ ] **データ隔離:** ゲストは他のゲスト/内部データにアクセス不可

---

## 🚀 次のステップ

1. ✅ **Prismaスキーマドラフト作成** - このドキュメント
2. ⏳ **レビュー・承認** - チームレビュー
3. ⏳ **マイグレーション生成** - `pnpm exec prisma migrate dev`
4. ⏳ **マイグレーション実行** - dev環境で検証
5. ⏳ **Prisma Client再生成** - `pnpm exec prisma generate`
6. ⏳ **Lambda関数実装開始** - Phase 2 Week 2

---

**最終更新:** 2026-03-11 17:00 JST
**承認待ち:** テクニカルリード承認後、実装開始
