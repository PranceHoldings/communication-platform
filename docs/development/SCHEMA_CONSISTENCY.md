# Prismaスキーマとコードの整合性管理

**最終更新:** 2026-03-05
**ステータス:** ✅ 修正完了

---

## 概要

このドキュメントでは、Prismaスキーマとアプリケーションコード（型定義、Lambda関数、フロントエンド）の整合性を保つためのガイドラインと、整合性チェックリストを提供します。

---

## Prismaスキーマの構造

### 主要モデル

```
packages/database/prisma/schema.prisma
├── Organization - 組織
├── User - ユーザー
├── Avatar - アバター
├── Scenario - シナリオ
├── Session - セッション
├── Recording - 録画
└── Transcript - トランスクリプト
```

### 重要な命名規則

#### 1. **Enumは全て大文字**
```prisma
enum UserRole {
  SUPER_ADMIN
  CLIENT_ADMIN
  CLIENT_USER
}

enum SessionStatus {
  ACTIVE
  PROCESSING
  COMPLETED
  ERROR
}

enum AvatarType {
  TWO_D
  THREE_D
}

enum AvatarStyle {
  ANIME
  REALISTIC
}
```

#### 2. **フィールド名はcamelCase**
```prisma
model Session {
  durationSec      Int?          @map("duration_sec")
  metadataJson     Json?         @map("metadata_json")
  startedAt        DateTime      @default(now()) @map("started_at")
  endedAt          DateTime?     @map("ended_at")
}
```

#### 3. **データベースカラム名はsnake_case（@mapで指定）**
- Prismaクライアント: `session.durationSec`
- データベースカラム: `duration_sec`

---

## 型定義の整合性

### packages/shared/src/types/index.ts

**原則**: Prismaスキーマと完全に一致させる

```typescript
// ✅ 正しい（Prismaスキーマと一致）
export type SessionStatus = 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
export type AvatarType = 'TWO_D' | 'THREE_D';

export interface Session {
  id: string;
  userId: string;
  orgId: string;
  scenarioId: string;
  avatarId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt?: Date;
  durationSec?: number;        // Prismaスキーマと同じ名前
  metadataJson?: Record<string, unknown>; // Prismaスキーマと同じ名前
}

// ❌ 間違い（Prismaスキーマと不一致）
export type SessionStatus = 'active' | 'processing' | 'completed' | 'error'; // 小文字NG
export type AvatarType = '2d' | '3d'; // Prismaでは TWO_D, THREE_D

export interface Session {
  duration?: number; // Prismaでは durationSec
  metadata?: Record<string, unknown>; // Prismaでは metadataJson
  createdAt: Date; // Prismaでは startedAt（createdAtは存在しない）
}
```

---

## Lambda関数のマッピング

### APIレスポンスの互換性

Lambda関数では、フロントエンドとの互換性のために一部のフィールドをマッピングしています。

```typescript
// infrastructure/lambda/sessions/list/index.ts

return successResponse({
  sessions: sessions.map((session: any) => ({
    id: session.id,
    scenarioId: session.scenarioId,
    avatarId: session.avatarId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,

    // マッピング: Prismaフィールド → APIレスポンスフィールド
    duration: session.durationSec,        // durationSec → duration
    metadata: session.metadataJson,       // metadataJson → metadata
    createdAt: session.startedAt,         // startedAt → createdAt (互換性)

    avatar: {
      ...session.avatar,
      imageUrl: session.avatar.thumbnailUrl, // thumbnailUrl → imageUrl
    },
  })),
});
```

### マッピング一覧

| Prismaスキーマ | APIレスポンス | 理由 |
|---------------|-------------|------|
| `durationSec` | `duration` | フロントエンドで短い名前を使用 |
| `metadataJson` | `metadata` | JSONサフィックス不要 |
| `startedAt` | `createdAt` (エイリアス) | 互換性のため（両方含む） |
| `thumbnailUrl` | `imageUrl` | Avatar用のエイリアス |

---

## フロントエンド型定義

### apps/web/lib/api/sessions.ts

**原則**: APIレスポンスの形式に基づく（Lambda関数のマッピング後）

```typescript
/**
 * 注意: このファイルの型定義はAPIレスポンスの形式に基づいています。
 * Lambda関数が以下のマッピングを行っています:
 * - durationSec → duration
 * - metadataJson → metadata
 * - startedAt → createdAt (互換性のため)
 */

export interface Session {
  id: string;
  scenarioId: string;
  avatarId: string;
  status: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  startedAt: string;           // セッション開始日時
  endedAt: string | null;      // セッション終了日時
  duration: number | null;     // 所要時間（秒）- DBでは durationSec
  metadata: Record<string, unknown>; // メタデータ - DBでは metadataJson
  createdAt: string;           // startedAtのエイリアス（互換性）
  // ...
}
```

---

## 整合性チェックリスト

### 新しいフィールドを追加する場合

- [ ] 1. **Prismaスキーマを更新**
  - [ ] フィールド名はcamelCase
  - [ ] データベースカラム名は`@map("snake_case")`
  - [ ] Enum値は全て大文字

- [ ] 2. **マイグレーションを作成・実行**
  ```bash
  cd packages/database
  npx prisma migrate dev --name add_new_field
  npx prisma generate
  ```

- [ ] 3. **共有型定義を更新**
  - [ ] `packages/shared/src/types/index.ts`をPrismaスキーマと一致させる
  - [ ] Enum値は全て大文字
  - [ ] フィールド名はPrismaと同じ（`durationSec`, `metadataJson`等）

- [ ] 4. **Lambda関数を更新**
  - [ ] 必要に応じてマッピング追加（`durationSec` → `duration`）
  - [ ] `include`/`select`句に新しいフィールドを追加
  - [ ] レスポンスに新しいフィールドを含める

- [ ] 5. **フロントエンド型定義を更新**
  - [ ] `apps/web/lib/api/*.ts`にAPIレスポンス形式の型を追加
  - [ ] マッピングされたフィールド名を使用（`duration`, `metadata`）
  - [ ] コメントでDBフィールド名を明記

- [ ] 6. **テスト**
  - [ ] Lambda関数のテスト
  - [ ] フロントエンドでのデータ表示確認
  - [ ] 翻訳リソースの追加（必要に応じて）

---

## 過去の不整合事例と修正履歴

### 2026-03-05: 型定義の全面修正

**問題点:**
1. `packages/shared/src/types/index.ts`のEnum値が小文字（Prismaは大文字）
2. `Session.createdAt`が存在しない（Prismaでは`startedAt`のみ）
3. フィールド名が不一致（`duration` vs `durationSec`）
4. Avatar型に多くのフィールドが欠けている

**修正内容:**
- ✅ 全てのEnum値を大文字に統一
- ✅ フィールド名をPrismaスキーマと完全一致
- ✅ コメントでAPIマッピングを明記
- ✅ エラー型クラスを追加

**影響範囲:**
- `packages/shared/src/types/index.ts` - 全面書き換え
- `apps/web/lib/api/sessions.ts` - コメント追加
- Lambda関数 - 影響なし（既に正しくマッピングされていた）

### 2026-03-05: セッション一覧ページの翻訳キー不足

**問題点:**
- `sessions.table.duration`, `sessions.table.actions`, `sessions.status.ACTIVE`等が欠けていた
- `session.createdAt`を使用していたが、Prismaでは`startedAt`

**修正内容:**
- ✅ 英語・日本語リソースに不足キーを追加
- ✅ `session.createdAt` → `session.startedAt`に修正

---

## ベストプラクティス

### 1. データベース操作前にスキーマを確認

```bash
# Prismaスキーマを確認
cat packages/database/prisma/schema.prisma | grep -A 20 "model Session"
```

### 2. 型定義はPrismaスキーマと同期

- ❌ 推測で型を書かない
- ✅ Prismaスキーマを見て正確に書く

### 3. フィールド名の命名規則

| 層 | 命名規則 | 例 |
|----|---------|-----|
| **Prisma（TypeScript）** | camelCase | `durationSec`, `metadataJson` |
| **DB（PostgreSQL）** | snake_case | `duration_sec`, `metadata_json` |
| **API（レスポンス）** | camelCase（短縮） | `duration`, `metadata` |
| **Enum** | UPPER_CASE | `ACTIVE`, `TWO_D` |

### 4. マッピング層の責務

- **Lambda関数**: Prismaスキーマ → APIレスポンス形式にマッピング
- **フロントエンド**: APIレスポンス形式をそのまま使用
- **共有型定義**: Prismaスキーマと完全一致

---

## 関連ドキュメント

- [データベース設計](./DATABASE_DESIGN.md)
- [API設計](./API_DESIGN.md)
- [多言語対応](./I18N.md)
- [Prismaスキーマ](../../packages/database/prisma/schema.prisma)

---

**最終更新:** 2026-03-05
**次回レビュー:** フィールド追加時
