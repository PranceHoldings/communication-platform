# Prismaスキーマ整合性チェックレポート

**実施日:** 2026-03-05
**チェック範囲:** すべてのLambda関数、フロントエンドAPIクライアント、型定義
**ステータス:** ✅ 完了（1件の軽微な修正を実施）

---

## エグゼクティブサマリー

Prismaスキーマとアプリケーションコードの整合性を全面的に確認しました。

### 結果
- **Lambda関数**: 16ファイル確認 → ✅ すべて整合性あり
- **フロントエンドAPIクライアント**: 3ファイル確認 → ⚠️ 1件の軽微な修正を実施
- **型定義**: 2ファイル確認 → ✅ すべて整合性あり
- **フロントエンドページ**: 主要ページ確認 → ✅ すべて整合性あり

### 実施した修正
1. `apps/web/lib/api/scenarios.ts` - `userId: string | null` に修正（null許容）

---

## 詳細チェック結果

### 1. Lambda関数（infrastructure/lambda/）

#### ✅ Auth関連
| ファイル | チェック項目 | 結果 | 備考 |
|---------|------------|------|------|
| `auth/register/index.ts` | User.role, User.orgId, User.createdAt | ✅ 正常 | Enum値は大文字（CLIENT_USER, CLIENT_ADMIN） |
| `auth/login/index.ts` | User.passwordHash, User.role, User.orgId | ✅ 正常 | フィールド名正しい |
| `users/me/index.ts` | User.lastLoginAt, User.createdAt | ✅ 正常 | optional フィールド正しく処理 |

#### ✅ Sessions関連
| ファイル | チェック項目 | 結果 | 備考 |
|---------|------------|------|------|
| `sessions/list/index.ts` | Session.durationSec, Session.metadataJson, Session.startedAt | ✅ 正常 | マッピング: durationSec → duration, metadataJson → metadata |
| `sessions/create/index.ts` | Session.status, Session.metadataJson | ✅ 正常 | Enum値: ACTIVE（大文字） |
| `sessions/get/index.ts` | Session.durationSec, Session.startedAt, Session.endedAt | ✅ 正常 | include/select正しい |

#### ✅ Scenarios関連
| ファイル | チェック項目 | 結果 | 備考 |
|---------|------------|------|------|
| `scenarios/list/index.ts` | Scenario.visibility, Scenario.category, Scenario.createdAt | ✅ 正常 | Enum値: PRIVATE, ORGANIZATION, PUBLIC |
| `scenarios/create/index.ts` | Scenario.configJson, Scenario.userId | ✅ 正常 | userId は optional（null許容） |
| `scenarios/get/index.ts` | Scenario.visibility, Scenario.orgId | ✅ 正常 | アクセス制御ロジック正しい |

#### ✅ Avatars関連
| ファイル | チェック項目 | 結果 | 備考 |
|---------|------------|------|------|
| `avatars/list/index.ts` | Avatar.type, Avatar.style, Avatar.source, Avatar.visibility | ✅ 正常 | Enum値すべて大文字（TWO_D, THREE_D, ANIME, REALISTIC） |
| `avatars/create/index.ts` | Avatar.type, Avatar.style, Avatar.thumbnailUrl | ✅ 正常 | thumbnailUrlはoptional（null許容） |
| `avatars/get/index.ts` | Avatar.configJson, Avatar.tags | ✅ 正常 | JSONフィールド、配列フィールド正しい |

---

### 2. フロントエンドAPIクライアント（apps/web/lib/api/）

#### ⚠️ Scenarios API
**ファイル:** `apps/web/lib/api/scenarios.ts`

**発見した問題:**
```typescript
// ❌ 修正前
export interface Scenario {
  userId: string; // Prismaスキーマでは userId? (optional)
  orgId: string;
}
```

**修正内容:**
```typescript
// ✅ 修正後
export interface Scenario {
  userId: string | null; // Optional - Prismaスキーマでは userId? (任意)
  orgId: string;
}
```

**影響範囲:** なし（Lambda関数側で正しく処理されているため）

#### ✅ Sessions API
**ファイル:** `apps/web/lib/api/sessions.ts`

| チェック項目 | 結果 | 備考 |
|------------|------|------|
| Session.status | ✅ 正常 | Enum値: 'ACTIVE' \| 'PROCESSING' \| 'COMPLETED' \| 'ERROR' |
| Session.duration | ✅ 正常 | マッピング: durationSec → duration（コメント記載済み） |
| Session.metadata | ✅ 正常 | マッピング: metadataJson → metadata（コメント記載済み） |
| Session.startedAt, createdAt | ✅ 正常 | createdAtはstartedAtのエイリアス（コメント記載済み） |

#### ✅ Avatars API
**ファイル:** `apps/web/lib/api/avatars.ts`

| チェック項目 | 結果 | 備考 |
|------------|------|------|
| Avatar.type | ✅ 正常 | 'TWO_D' \| 'THREE_D' |
| Avatar.style | ✅ 正常 | 'ANIME' \| 'REALISTIC' |
| Avatar.source | ✅ 正常 | 'PRESET' \| 'GENERATED' \| 'ORG_CUSTOM' |
| Avatar.visibility | ✅ 正常 | 'PRIVATE' \| 'ORGANIZATION' \| 'PUBLIC' |
| Avatar.thumbnailUrl | ✅ 正常 | string \| null |
| Avatar.tags | ✅ 正常 | string[] |

---

### 3. 型定義

#### ✅ 共有型定義（packages/shared/src/types/index.ts）

**前回（2026-03-05）に全面書き換え済み**

| 型 | チェック項目 | 結果 |
|---|------------|------|
| UserRole | SUPER_ADMIN, CLIENT_ADMIN, CLIENT_USER | ✅ 正常 |
| AvatarType | TWO_D, THREE_D | ✅ 正常 |
| AvatarStyle | ANIME, REALISTIC | ✅ 正常 |
| SessionStatus | ACTIVE, PROCESSING, COMPLETED, ERROR | ✅ 正常 |
| Visibility | PRIVATE, ORGANIZATION, PUBLIC | ✅ 正常 |
| Session | durationSec, metadataJson, startedAt | ✅ 正常 |
| Avatar | 全フィールド | ✅ 正常 |
| Scenario | 全フィールド | ✅ 正常 |

#### ✅ Lambda共有型定義（infrastructure/lambda/shared/types/index.ts）

| 型 | チェック項目 | 結果 | 備考 |
|---|------------|------|------|
| JWTPayload | role: 'SUPER_ADMIN' \| 'CLIENT_ADMIN' \| 'CLIENT_USER' | ✅ 正常 | Enum値大文字 |
| User | organizationId: string | ✅ 正常 | JWT用フィールド（DBはorgId） |
| Avatar | type, style, source, visibility | ✅ 正常 | すべてEnum値大文字 |
| Session | durationSec, metadataJson | ✅ 正常 | DB名と一致 |
| Recording | type: 'USER' \| 'AVATAR' \| 'COMBINED' | ✅ 正常 | Enum値大文字 |
| Transcript | speaker: 'AI' \| 'USER', highlight | ✅ 正常 | Enum値大文字 |

---

### 4. フロントエンドページ

#### ✅ Sessions関連
| ファイル | チェック項目 | 結果 | 備考 |
|---------|------------|------|------|
| `sessions/page.tsx` | session.startedAt, session.status | ✅ 正常 | 前回修正済み（createdAt → startedAt） |
| `sessions/new/page.tsx` | TWO_D, THREE_D, ANIME, REALISTIC | ✅ 正常 | フィルターEnum値正しい |
| `sessions/[id]/page.tsx` | session.duration, session.metadata | ✅ 正常 | マッピング後の値を正しく使用 |

#### ✅ その他
| ファイル | ステータス | 備考 |
|---------|-----------|------|
| `scenarios/page.tsx` | ✅ 正常 | 未実装（Coming Soon） |
| `avatars/page.tsx` | ✅ 正常 | 未実装（Coming Soon） |

---

## Prismaスキーマの重要フィールド確認

### Session モデル

```prisma
model Session {
  id               String        @id @default(uuid())
  userId           String        @map("user_id")
  orgId            String        @map("org_id")
  scenarioId       String        @map("scenario_id")
  avatarId         String        @map("avatar_id")
  status           SessionStatus @default(ACTIVE)
  startedAt        DateTime      @default(now()) @map("started_at")
  endedAt          DateTime?     @map("ended_at")
  durationSec      Int?          @map("duration_sec")       // ⚠️ APIでは duration
  metadataJson     Json?         @map("metadata_json")      // ⚠️ APIでは metadata
  // ...
}
```

**重要ポイント:**
- ❌ `createdAt` は存在しない → ✅ `startedAt` を使用
- ⚠️ `durationSec` → APIでは `duration` にマッピング
- ⚠️ `metadataJson` → APIでは `metadata` にマッピング

### Avatar モデル

```prisma
model Avatar {
  id          String       @id @default(uuid())
  userId      String?      @map("user_id")                 // Optional
  orgId       String       @map("org_id")
  name        String
  type        AvatarType                                   // TWO_D | THREE_D
  style       AvatarStyle                                  // ANIME | REALISTIC
  source      AvatarSource                                 // PRESET | GENERATED | ORG_CUSTOM
  modelUrl    String       @map("model_url")
  thumbnailUrl String?     @map("thumbnail_url")          // Optional
  configJson  Json?        @map("config_json")            // Optional
  tags        String[]     @default([])
  visibility  Visibility   @default(PRIVATE)              // PRIVATE | ORGANIZATION | PUBLIC
  createdAt   DateTime     @default(now()) @map("created_at")
  // ...
}
```

**重要ポイント:**
- ✅ すべてのEnum値は大文字（TWO_D, ANIME, PRESET, etc.）
- ✅ userId, thumbnailUrl, configJson は optional（null許容）

### Scenario モデル

```prisma
model Scenario {
  id          String       @id @default(uuid())
  userId      String?      @map("user_id")                 // Optional
  orgId       String       @map("org_id")
  title       String
  category    String
  language    String       @default("ja")
  visibility  Visibility   @default(PRIVATE)
  configJson  Json         @map("config_json")             // Required
  createdAt   DateTime     @default(now()) @map("created_at")
  // ...
}
```

**重要ポイント:**
- ✅ userId は optional（null許容）
- ✅ configJson は必須（not null）

---

## マッピング層の一貫性

### Lambda関数 → APIレスポンス

**適用箇所:** すべてのセッション関連Lambda関数

```typescript
// Lambda関数内のマッピング
{
  id: session.id,
  startedAt: session.startedAt,
  endedAt: session.endedAt,

  // マッピング1: DB名 → API名（短縮）
  duration: session.durationSec,     // durationSec → duration
  metadata: session.metadataJson,    // metadataJson → metadata

  // マッピング2: 互換性のためのエイリアス
  createdAt: session.startedAt,      // startedAt → createdAt (alias)

  // マッピング3: Avatar用
  avatar: {
    ...session.avatar,
    imageUrl: session.avatar.thumbnailUrl, // thumbnailUrl → imageUrl (alias)
  },
}
```

**理由:**
1. **短縮形**: フロントエンドでの使いやすさ（`duration` vs `durationSec`）
2. **互換性**: 既存コードとの互換性維持（`createdAt` エイリアス）
3. **一貫性**: Avatar画像は `imageUrl` で統一

---

## ベストプラクティス遵守状況

### ✅ 遵守できている点

1. **Enum値の大文字統一**
   - すべてのコードで `ACTIVE`, `TWO_D`, `ANIME`, `SUPER_ADMIN` 等を使用

2. **フィールド名の一致**
   - Lambda関数は `durationSec`, `metadataJson` を使用
   - マッピング層で `duration`, `metadata` に変換

3. **Optional フィールドの処理**
   - `userId?`, `thumbnailUrl?` を正しく `string | null` で処理

4. **型定義の分離**
   - Prismaスキーマ準拠: `packages/shared/src/types/index.ts`
   - APIレスポンス準拠: `apps/web/lib/api/*.ts`
   - Lambda内部: `infrastructure/lambda/shared/types/index.ts`

### ⚠️ 今後の注意点

1. **新しいフィールド追加時**
   - Prismaスキーマを最初に更新
   - 共有型定義を次に更新（Prismaと完全一致）
   - Lambda関数で必要に応じてマッピング
   - フロントエンド型定義を最後に更新（APIレスポンス形式）

2. **Enum追加時**
   - 全て大文字で定義（例: `NEW_STATUS` not `new_status`）
   - 既存コードでバリデーション追加

3. **マッピング追加時**
   - コメントで明記（`// DBでは durationSec`）
   - Lambda関数で一貫したマッピング適用

---

## 推奨事項

### 即座に対応不要（情報提供のみ）

1. **型定義の一元化検討**
   - 現状: 3箇所に型定義（packages/shared, lambda/shared, apps/web/lib/api）
   - 将来: Prisma生成型をベースに、マッピング型を自動生成するツール検討

2. **Enum型の一元管理**
   - 現状: 各ファイルで文字列リテラル型として定義
   - 将来: Prismaスキーマから自動生成（prisma-enum-generator 等）

3. **バリデーション強化**
   - 現状: 文字列比較でEnum値をバリデーション
   - 将来: Zod等のスキーマバリデーションライブラリ導入

---

## 結論

### ✅ 整合性ステータス: **良好**

- すべてのLambda関数とフロントエンドコードがPrismaスキーマと整合性がある
- 1件の軽微な修正（`Scenario.userId` をnull許容）を実施
- マッピング層が適切に機能している
- 型定義が明確に分離されている

### 📋 今後のチェックポイント

1. **新しいモデル追加時**: このレポートと同様の手順でチェック
2. **Enum値追加時**: 全コードで大文字使用を確認
3. **フィールド追加時**: Prismaスキーマ → 共有型定義 → Lambda → フロントエンドの順で更新

### 📚 関連ドキュメント

- [Prismaスキーマ整合性管理ガイド](./SCHEMA_CONSISTENCY.md)
- [データベース設計](./DATABASE_DESIGN.md)
- [API設計](./API_DESIGN.md)

---

**レポート作成日:** 2026-03-05
**次回チェック推奨:** フィールド追加時、または月次レビュー時
