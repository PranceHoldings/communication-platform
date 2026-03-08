# コード重複監査レポート

**作成日:** 2026-03-07
**ステータス:** 調査完了 → 対応中

---

## 📋 発見した重複パターン

### 1. 型定義の重複（最重要）

#### 現状
3箇所で同じ型を定義している：

| 型名 | packages/shared | infrastructure/lambda | apps/web/lib/api |
|------|------------------|----------------------|------------------|
| **User** | ✅ 定義済み | ✅ 重複定義 | ✅ 重複定義 |
| **Avatar** | ✅ 定義済み | ✅ 重複定義 | ✅ 重複定義 |
| **Scenario** | ✅ 定義済み | ✅ 重複定義 | ✅ 重複定義 |
| **Session** | ✅ 定義済み | ✅ 重複定義 | ✅ 重複定義 |
| **Organization** | ✅ 定義済み | ✅ 重複定義 | ❌ 未使用 |
| **Recording** | ✅ 定義済み | ✅ 重複定義 | ❌ 未使用 |
| **Transcript** | ✅ 定義済み | ✅ 重複定義 | ❌ 未使用 |

#### Enum型の重複

| Enum | packages/shared | infrastructure/lambda | apps/web/lib/api |
|------|------------------|----------------------|------------------|
| **UserRole** | ✅ | ✅ | ✅ |
| **AvatarType** | ✅ | ✅ | ✅ |
| **AvatarStyle** | ✅ | ✅ | ✅ |
| **AvatarSource** | ✅ | ✅ | ✅ |
| **Visibility** | ✅ | ✅ | ✅（インライン） |
| **SessionStatus** | ✅ | ✅ | ✅ |
| **RecordingType** | ✅ | ✅ | ❌ |
| **Speaker** | ✅ | ✅ | ❌ |
| **Highlight** | ✅ | ✅ | ❌ |

#### エラー型の重複

| エラークラス | packages/shared | infrastructure/lambda |
|--------------|------------------|----------------------|
| **AppError** | ✅ | ✅ |
| **AuthenticationError** | ✅ | ✅ |
| **AuthorizationError** | ✅ | ✅ |
| **NotFoundError** | ✅ | ✅ |
| **ValidationError** | ✅ | ✅ |
| **ConflictError** | ✅ | ✅ |

---

### 2. Pagination インターフェースの重複

#### Lambda側
```typescript
// infrastructure/lambda/shared/utils/validation.ts
export interface PaginationParams {
  limit: number;
  offset: number;
}

// infrastructure/lambda/shared/utils/response.ts
export const paginatedResponse = <T>(
  items: T[],
  total: number,
  limit: number,
  offset: number
): APIResponse => {
  return successResponse({
    items,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  });
};
```

#### Frontend側
```typescript
// apps/web/lib/api/avatars.ts
export interface AvatarListResponse {
  avatars: Avatar[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// apps/web/lib/api/scenarios.ts (同じ構造)
// apps/web/lib/api/sessions.ts (同じ構造)
```

**問題:** 同じpagination構造を4箇所で定義

---

### 3. API Response/Error パターンの重複

#### Lambda側
```typescript
// infrastructure/lambda/shared/types/index.ts
export interface APIResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

#### Frontend側
```typescript
// apps/web/lib/api/client.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
```

**問題:** 構造が似ているが微妙に異なる（Lambda は HTTP レスポンス、Frontend は JSON データ）

---

## 🎯 対応方針

### Phase 1: 共有型パッケージの活用（優先度: 高）

**現状:** `packages/shared/src/types/index.ts` に全ての基本型が定義済みだが、誰も使っていない

**対応:**
1. Lambda関数を共有パッケージに移行
   - `infrastructure/lambda/shared/types/index.ts` を削除
   - 全Lambda関数で `import { User, Avatar, ... } from '@prance/shared'` に変更
   - Lambda固有型（APIResponse, SuccessResponse, ErrorResponse）は残す

2. Frontend を共有パッケージに移行
   - `apps/web/lib/api/*.ts` の重複型定義を削除
   - `import { User, Avatar, Scenario, Session, ... } from '@prance/shared'` に変更
   - Frontend固有型（CreateScenarioRequest, UpdateAvatarRequest など）は残す

### Phase 2: Pagination の共有化（優先度: 中）

**対応:**
1. `packages/shared/src/types/index.ts` に追加:
```typescript
export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}
```

2. Lambda と Frontend で使用

### Phase 3: ユーティリティ関数の整理（優先度: 低）

**Lambda専用（移行不要）:**
- `infrastructure/lambda/shared/utils/validation.ts` - バリデーション関数
- `infrastructure/lambda/shared/utils/response.ts` - HTTP レスポンス生成

**Frontend専用（移行不要）:**
- `apps/web/lib/api/client.ts` - API クライアント
- `apps/web/lib/utils.ts` - UI ユーティリティ

---

## 📊 影響範囲

### Lambda関数（18ファイル）
```
infrastructure/lambda/auth/register/index.ts
infrastructure/lambda/auth/login/index.ts
infrastructure/lambda/users/me/index.ts
infrastructure/lambda/avatars/create/index.ts
infrastructure/lambda/avatars/get/index.ts
infrastructure/lambda/avatars/list/index.ts
infrastructure/lambda/avatars/update/index.ts
infrastructure/lambda/avatars/delete/index.ts
infrastructure/lambda/avatars/clone/index.ts
infrastructure/lambda/scenarios/create/index.ts
infrastructure/lambda/scenarios/get/index.ts
infrastructure/lambda/scenarios/list/index.ts
infrastructure/lambda/scenarios/update/index.ts
infrastructure/lambda/scenarios/delete/index.ts
infrastructure/lambda/sessions/create/index.ts
infrastructure/lambda/sessions/get/index.ts
infrastructure/lambda/sessions/list/index.ts
infrastructure/lambda/shared/utils/response.ts
```

### Frontend API ファイル（4ファイル）
```
apps/web/lib/api/auth.ts
apps/web/lib/api/avatars.ts
apps/web/lib/api/scenarios.ts
apps/web/lib/api/sessions.ts
```

---

## ✅ 期待される効果

1. **保守性向上**
   - 型変更時に1箇所を修正するだけで済む
   - 不整合のリスク軽減

2. **開発効率向上**
   - 新機能追加時に型を再定義する必要なし
   - TypeScript の型推論が正確になる

3. **バグ削減**
   - 型定義の不一致によるバグを防止
   - Prisma スキーマとの乖離を防止

---

## 🚀 実装ステップ

### Step 1: packages/shared の準備
- [x] 既存の型定義を確認（完了）
- [ ] Pagination 型を追加
- [ ] package.json の exports を確認

### Step 2: Lambda の移行
- [ ] infrastructure/lambda/shared/types/index.ts の Lambda固有型を特定
- [ ] 全Lambda関数のimport文を変更
- [ ] infrastructure/lambda/shared/types/index.ts を削除（Lambda固有型のみ残す）

### Step 3: Frontend の移行
- [ ] apps/web/lib/api/*.ts の import文を変更
- [ ] 重複型定義を削除
- [ ] Frontend固有型のみ残す

### Step 4: テスト
- [ ] TypeScript コンパイルエラーがないか確認
- [ ] Lambda ビルド成功確認
- [ ] Frontend ビルド成功確認
- [ ] 既存機能が動作するか確認

---

**次のアクション:** Step 1 - Pagination 型の追加から開始
