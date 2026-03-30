# API Contract Enforcement System

**作成日:** 2026-03-20
**ステータス:** 🟢 Active
**目的:** 呼び出し側（Frontend）と呼ばれる側（Lambda）の型不整合を防止する

---

## 問題の背景

### 発生した問題

**2026-03-20:**
- `guest-sessions/list` Lambda関数が独自のレスポンス形式を実装
- Frontend API Client は標準形式 `{ success: true, data: {...} }` を期待
- 結果: レスポンスを正しくパースできず、UI上で "Request failed" エラー

### 根本原因

1. **インターフェース定義の不在**
   - 呼び出し側と呼ばれる側が独立して実装されていた
   - 共通の型定義を参照していなかった

2. **レスポンスユーティリティの未使用**
   - 一部のLambda関数が `successResponse()` を使用せず、独自にレスポンスを構築

3. **テストカバレッジの不足**
   - E2Eテストが一部のAPIエンドポイントのみをカバー
   - レスポンス構造の検証がなかった

---

## 解決策: 5層防御システム

### Layer 1: 型システムによる強制（コンパイル時）

**単一の真実の源: `packages/shared/src/types/`**

```typescript
// packages/shared/src/types/api.ts
export interface StandardSuccessResponse<T = any> {
  success: true;
  data: T;
}

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type StandardAPIResponse<T = any> =
  | StandardSuccessResponse<T>
  | StandardErrorResponse;
```

**全APIエンドポイントの型定義:**

```typescript
// packages/shared/src/types/api-endpoints.ts
export interface GuestSessionListResponse {
  guestSessions: GuestSessionListItem[];
  pagination: PaginationMeta;
}

export const API_ENDPOINTS = {
  LIST_GUEST_SESSIONS: {
    method: 'GET' as const,
    path: '/guest-sessions',
    responseType: {} as GuestSessionListResponse,
  },
  // ... 全エンドポイント定義
} as const;
```

### Layer 2: Lambda関数の実装（呼ばれる側）

```typescript
// infrastructure/lambda/guest-sessions/list/index.ts
import { StandardLambdaResponse } from '../../shared/types/api-response';
import { successResponse } from '../../shared/utils/response';
import type { GuestSessionListResponse } from '@prance/shared';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<StandardLambdaResponse<GuestSessionListResponse>> => {
  // ...
  return successResponse({ guestSessions, pagination });
};
```

**型システムによる強制:**
- `StandardLambdaResponse<GuestSessionListResponse>` を返す必要がある
- `successResponse()` の引数は `GuestSessionListResponse` と互換性が必要
- 型が一致しない場合はコンパイルエラー

### Layer 3: Frontend API Client（呼び出し側）

```typescript
// apps/web/lib/api/guest-sessions.ts
import type {
  StandardAPIResponse,
  GuestSessionListResponse
} from '@prance/shared';

export async function listGuestSessions(): Promise<GuestSessionListResponse> {
  const response = await apiClient.get<GuestSessionListResponse>('/guest-sessions');
  return apiClient.unwrapResponse(response);
}
```

**型システムによる強制:**
- `apiClient.get<T>()` は `StandardAPIResponse<T>` を返す
- `unwrapResponse()` は `success: true` の場合のみ `data` を返す
- 型が一致しない場合はコンパイルエラー

### Layer 4: ESLint による静的解析

```javascript
// infrastructure/lambda/.eslintrc.js
'no-restricted-syntax': [
  'error',
  {
    selector: 'ReturnStatement > ObjectExpression:has(Property[key.name="statusCode"]):has(Property[key.name="body"])',
    message: '❌ FORBIDDEN: Direct response construction. Use successResponse() or errorResponse()',
  },
],
```

**コード例:**

```typescript
// ❌ エラー: ESLint違反
return {
  statusCode: 200,
  body: JSON.stringify({ guestSessions, pagination })
};

// ✅ 正しい: ESLint通過
return successResponse({ guestSessions, pagination });
```

### Layer 5: Runtime検証（開発モード）

```typescript
// infrastructure/lambda/shared/types/api-response.ts
export function validateResponseStructure<T>(response: any): StandardAPIResponse<T> {
  if (!isStandardAPIResponse<T>(response)) {
    throw new Error(
      `INVALID API RESPONSE STRUCTURE:\n` +
      `Expected: { success: boolean, data?: any, error?: { code, message } }\n` +
      `Received: ${JSON.stringify(response, null, 2)}`
    );
  }
  return response;
}
```

**効果:**
- 開発モード（`ENVIRONMENT=dev`）では、レスポンス構造を実行時にチェック
- 不正な構造の場合は即座にエラーをスロー
- 本番環境ではログのみ出力（クラッシュを防ぐ）

---

## 検証スクリプト

### 個別検証

```bash
# Lambda レスポンス構造検証
npm run validate:api-responses

# Frontend 型使用検証
npm run validate:api-types

# 統合検証（全て）
npm run validate:api-contracts
```

### コミット前自動検証

```bash
# Pre-commit hook（自動実行）
git commit -m "..."

# → scripts/pre-commit-api-validation.sh が自動実行
# → 検証失敗時はコミットがブロックされる
```

---

## 使用方法

### 新しいAPIエンドポイントを追加する手順

#### Step 1: 型定義を追加（`packages/shared`）

```typescript
// packages/shared/src/types/api-endpoints.ts
export interface MyNewResponse {
  items: MyItem[];
  total: number;
}

export const API_ENDPOINTS = {
  // ...
  GET_MY_NEW_ENDPOINT: {
    method: 'GET' as const,
    path: '/my-endpoint',
    responseType: {} as MyNewResponse,
  },
} as const;
```

#### Step 2: Lambda関数を実装

```typescript
// infrastructure/lambda/my-endpoint/get/index.ts
import { StandardLambdaResponse } from '../../shared/types/api-response';
import { successResponse } from '../../shared/utils/response';
import type { MyNewResponse } from '@prance/shared';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<StandardLambdaResponse<MyNewResponse>> => {
  const items = await fetchItems();
  return successResponse({ items, total: items.length });
};
```

#### Step 3: Frontend API関数を実装

```typescript
// apps/web/lib/api/my-endpoint.ts
import type { MyNewResponse } from '@prance/shared';

export async function getMyEndpoint(): Promise<MyNewResponse> {
  const response = await apiClient.get<MyNewResponse>('/my-endpoint');
  return apiClient.unwrapResponse(response);
}
```

#### Step 4: 検証

```bash
# 型チェック
npm run validate:api-contracts

# E2Eテスト自動生成
bash scripts/generate-api-e2e-tests.sh

# E2Eテスト実行
npm run test:e2e -- api-validation/
```

---

## 効果

### Before（問題発生前）

```
Lambda (呼ばれる側)              Frontend (呼び出し側)
     │                                   │
     │  { guestSessions, pagination }   │  期待: { success, data }
     │  ──────────────────────────────> │
     │                                   │  ❌ パース失敗
     │                                   │  "Request failed"
```

### After（5層防御導入後）

```
packages/shared (単一の真実の源)
     │
     ├─> Lambda: StandardLambdaResponse<GuestSessionListResponse>
     │            ✓ 型チェック（コンパイル時）
     │            ✓ ESLint（静的解析）
     │            ✓ Runtime検証（開発モード）
     │
     └─> Frontend: apiClient.get<GuestSessionListResponse>()
                  ✓ 型チェック（コンパイル時）
                  ✓ 同じ型定義を参照

結果: 型不整合はコンパイル時に検出 → 本番エラー 0%
```

---

## トラブルシューティング

### Q1: コンパイルエラー「Type 'X' is not assignable to type 'StandardAPIResponse<T>'」

**原因:** Lambda関数が不正な構造を返している

**解決:**
```typescript
// ❌ 間違い
return {
  statusCode: 200,
  body: JSON.stringify({ items })
};

// ✅ 正しい
return successResponse({ items });
```

### Q2: ESLintエラー「Direct response construction」

**原因:** `successResponse()` / `errorResponse()` を使用していない

**解決:**
```bash
# インポート追加
import { successResponse } from '../../shared/utils/response';

# 使用
return successResponse(data);
```

### Q3: Runtime検証エラー「INVALID API RESPONSE STRUCTURE」

**原因:** 開発モードでレスポンス構造が不正

**解決:** エラーメッセージを確認し、構造を修正

---

## 関連ドキュメント

- [packages/shared/src/types/api.ts](../../packages/shared/src/types/api.ts) - 標準レスポンス型
- [packages/shared/src/types/api-endpoints.ts](../../packages/shared/src/types/api-endpoints.ts) - 全エンドポイント定義
- [infrastructure/lambda/shared/types/api-response.ts](../../infrastructure/lambda/shared/types/api-response.ts) - Lambda型定義
- [infrastructure/lambda/shared/utils/response.ts](../../infrastructure/lambda/shared/utils/response.ts) - レスポンスユーティリティ

---

## まとめ

**このシステムの目標:**
- **100% 型安全** - コンパイル時に不整合を検出
- **ゼロ本番エラー** - 型不整合による実行時エラーを防止
- **開発体験向上** - IDEの補完、早期エラー検出

**キーポイント:**
1. `packages/shared` が単一の真実の源
2. Lambda と Frontend は同じ型定義を参照
3. 5層の防御で多重チェック
4. Pre-commit hook で自動検証

---

**最終更新:** 2026-03-20
**次回レビュー:** 新規APIエンドポイント追加時
