# Enum Consistency Audit Report

**Date:** 2026-03-18
**Audit Scope:** Enum定義の一元管理状況
**Status:** ⚠️ 重大な不整合を検出

---

## 📊 Enum定義一覧

### Prisma Schema (Single Source of Truth)

以下のEnumがPrismaスキーマで定義されています：

| Enum名 | 値 | 定義箇所 |
|--------|-----|---------|
| UserRole | SUPER_ADMIN, CLIENT_ADMIN, CLIENT_USER, GUEST | schema.prisma:57 |
| AvatarType | TWO_D, THREE_D | schema.prisma:95 |
| AvatarStyle | ANIME, REALISTIC | schema.prisma:100 |
| AvatarSource | PRESET, GENERATED, ORG_CUSTOM | schema.prisma:105 |
| Visibility | PRIVATE, ORGANIZATION, PUBLIC | schema.prisma:111 |
| SessionStatus | ACTIVE, PROCESSING, COMPLETED, ERROR | schema.prisma:191 |
| RecordingType | USER, AVATAR, COMBINED | schema.prisma:224 |
| ProcessingStatus | PENDING, PROCESSING, COMPLETED, ERROR | schema.prisma:230 |
| Speaker | AI, USER | schema.prisma:255 |
| Highlight | POSITIVE, NEGATIVE, IMPORTANT | schema.prisma:260 |

---

## 🔴 検出された不整合

### 1. UserRole - 'GUEST' 欠如

**問題:** Prismaスキーマには'GUEST'が定義されているが、packages/shared には欠けている

```typescript
// ❌ packages/shared/src/types/index.ts (Line 14)
export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';
// 'GUEST' が欠けている！

// ✅ Prisma Schema
enum UserRole {
  SUPER_ADMIN
  CLIENT_ADMIN
  CLIENT_USER
  GUEST  // ← これが欠けている
}
```

**影響範囲:**
- ゲストユーザー機能が共有型で表現できない
- 型推論が不完全
- Lambda関数とフロントエンドで型の不整合

**修正優先度:** 🔴 最優先（Critical）

---

### 2. 重複定義（Inline Type Definitions）

#### 2.1 UserRole のインライン定義

**検出箇所:**

1. **infrastructure/lambda/shared/types/index.ts:82**
   ```typescript
   role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';  // インライン定義
   ```
   **問題:** 共有型を使わず独自定義（'GUEST'は含む）

2. **infrastructure/lambda/auth/login/index.ts:115**
   ```typescript
   role: user.role as 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER',
   ```
   **問題:** 型キャストでインライン定義（'GUEST'なし）

3. **infrastructure/lambda/auth/register/index.ts:128**
   ```typescript
   role: user.role as 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER',
   ```
   **問題:** 型キャストでインライン定義（'GUEST'なし）

4. **infrastructure/lambda/shared/auth/jwt.ts:91**
   ```typescript
   role: auth.role as 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST',
   ```
   **問題:** 型キャストでインライン定義（'GUEST'あり）

**修正優先度:** 🟠 高（High）

---

#### 2.2 AvatarType のインライン定義

**検出箇所:**

1. **apps/web/app/dashboard/avatars/page.tsx:16**
   ```typescript
   const [typeFilter, setTypeFilter] = useState<'TWO_D' | 'THREE_D' | ''>('');
   ```

2. **apps/web/app/dashboard/avatars/new/page.tsx:16, 70**
   ```typescript
   type: '' as 'TWO_D' | 'THREE_D' | '',
   type: formData.type as 'TWO_D' | 'THREE_D',
   ```

3. **apps/web/app/dashboard/avatars/[id]/edit/page.tsx:23**
   ```typescript
   const [type, setType] = useState<'TWO_D' | 'THREE_D'>('THREE_D');
   ```

4. **apps/web/app/dashboard/sessions/new/page.tsx:38, 326**
   ```typescript
   const [avatarTypeFilter, setAvatarTypeFilter] = useState<'TWO_D' | 'THREE_D' | ''>('');
   onChange={e => setAvatarTypeFilter(e.target.value as 'TWO_D' | 'THREE_D' | '')}
   ```

5. **infrastructure/lambda/avatars/list/index.ts**
   （詳細未確認、インライン定義の可能性あり）

**修正優先度:** 🟠 高（High）

---

#### 2.3 AvatarStyle のインライン定義

**検出箇所:**

1. **apps/web/app/dashboard/avatars/page.tsx:17**
   ```typescript
   const [styleFilter, setStyleFilter] = useState<'ANIME' | 'REALISTIC' | ''>('');
   ```

2. **apps/web/app/dashboard/avatars/new/page.tsx:17, 71**
   ```typescript
   style: '' as 'ANIME' | 'REALISTIC' | '',
   style: formData.style as 'ANIME' | 'REALISTIC',
   ```

3. **apps/web/app/dashboard/avatars/[id]/edit/page.tsx:24**
   ```typescript
   const [style, setStyle] = useState<'ANIME' | 'REALISTIC'>('REALISTIC');
   ```

4. **apps/web/app/dashboard/sessions/new/page.tsx:39**
   ```typescript
   const [avatarStyleFilter, setAvatarStyleFilter] = useState<'ANIME' | 'REALISTIC' | ''>('');
   ```

**修正優先度:** 🟠 高（High）

---

#### 2.4 AvatarSource のインライン定義

**検出箇所:**

1. **apps/web/app/dashboard/avatars/page.tsx:18**
   ```typescript
   const [sourceFilter, setSourceFilter] = useState<'PRESET' | 'GENERATED' | 'ORG_CUSTOM' | ''>('');
   ```

2. **apps/web/app/dashboard/avatars/new/page.tsx:18, 72**
   ```typescript
   source: '' as 'PRESET' | 'GENERATED' | 'ORG_CUSTOM' | '',
   source: formData.source as 'PRESET' | 'GENERATED' | 'ORG_CUSTOM',
   ```

3. **apps/web/app/dashboard/avatars/[id]/edit/page.tsx:25**
   ```typescript
   const [source, setSource] = useState<'GENERATED' | 'ORG_CUSTOM'>('ORG_CUSTOM');
   ```

**修正優先度:** 🟠 高（High）

---

#### 2.5 SessionStatus のインライン定義

**検出箇所:**

1. **apps/web/app/dashboard/sessions/page.tsx:13**
   ```typescript
   const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR'>('all');
   ```

2. **infrastructure/lambda/sessions/list/index.ts:14**（コメント）
   ```typescript
   * - status: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR'
   ```
   **注:** コメントでの説明は許容範囲（ドキュメント目的）

**修正優先度:** 🟡 中（Medium）

---

### 3. 良好な状態のEnum（インライン定義なし）

以下のEnumは共有型定義のみで使用されており、インライン定義は検出されませんでした：

- ✅ **Visibility** - PRIVATE, ORGANIZATION, PUBLIC
- ✅ **RecordingType** - USER, AVATAR, COMBINED
- ✅ **ProcessingStatus** - PENDING, PROCESSING, COMPLETED, ERROR
- ✅ **Speaker** - AI, USER
- ✅ **Highlight** - POSITIVE, NEGATIVE, IMPORTANT

---

## 📋 修正計画

### Phase 1: 共有型定義の修正（最優先）

#### 1.1 UserRole に 'GUEST' を追加

```typescript
// packages/shared/src/types/index.ts
export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';
```

**影響範囲:**
- packages/shared のビルド: `npm run build`
- 全Lambda関数の再デプロイ（共有型更新のため）
- フロントエンドの再ビルド

**推定時間:** 5分

---

### Phase 2: Lambda関数のインライン定義を削除

#### 2.1 infrastructure/lambda/shared/types/index.ts

```typescript
// ❌ 削除
role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';

// ✅ 修正後
import type { UserRole } from '@prance/shared';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;  // 共有型を使用
  orgId: string;
  // ...
}
```

#### 2.2 infrastructure/lambda/auth/login/index.ts

```typescript
// ❌ 削除
role: user.role as 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER',

// ✅ 修正後
import type { UserRole } from '../shared/types';

const payload: JWTPayload = {
  userId: user.id,
  email: user.email,
  role: user.role as UserRole,  // 共有型を使用
  orgId: user.orgId,
};
```

#### 2.3 infrastructure/lambda/auth/register/index.ts

同様の修正を適用

#### 2.4 infrastructure/lambda/shared/auth/jwt.ts

同様の修正を適用

**推定時間:** 15分

---

### Phase 3: フロントエンドのインライン定義を削除

#### 3.1 avatars/page.tsx

```typescript
// ❌ 削除
const [typeFilter, setTypeFilter] = useState<'TWO_D' | 'THREE_D' | ''>('');
const [styleFilter, setStyleFilter] = useState<'ANIME' | 'REALISTIC' | ''>('');
const [sourceFilter, setSourceFilter] = useState<'PRESET' | 'GENERATED' | 'ORG_CUSTOM' | ''>('');

// ✅ 修正後
import type { AvatarType, AvatarStyle, AvatarSource } from '@prance/shared';

const [typeFilter, setTypeFilter] = useState<AvatarType | ''>('');
const [styleFilter, setStyleFilter] = useState<AvatarStyle | ''>('');
const [sourceFilter, setSourceFilter] = useState<AvatarSource | ''>('');
```

#### 3.2 avatars/new/page.tsx

```typescript
// ❌ 削除
type: '' as 'TWO_D' | 'THREE_D' | '',
style: '' as 'ANIME' | 'REALISTIC' | '',
source: '' as 'PRESET' | 'GENERATED' | 'ORG_CUSTOM' | '',

// ✅ 修正後
import type { AvatarType, AvatarStyle, AvatarSource } from '@prance/shared';

const [formData, setFormData] = useState({
  name: '',
  type: '' as AvatarType | '',
  style: '' as AvatarStyle | '',
  source: '' as AvatarSource | '',
  // ...
});
```

#### 3.3 avatars/[id]/edit/page.tsx

同様の修正を適用

#### 3.4 sessions/new/page.tsx

同様の修正を適用

#### 3.5 sessions/page.tsx

```typescript
// ❌ 削除
const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR'>('all');

// ✅ 修正後
import type { SessionStatus } from '@prance/shared';

const [filter, setFilter] = useState<'all' | SessionStatus>('all');
```

**推定時間:** 30分

---

### Phase 4: 検証

#### 4.1 型チェック

```bash
# 共有パッケージ
cd packages/shared && npm run build

# フロントエンド
cd apps/web && npm run type-check

# Lambda関数（インフラ）
cd infrastructure && npx tsc --noEmit
```

#### 4.2 インライン定義検出

```bash
# UserRole
grep -rn "'SUPER_ADMIN'\s*|\s*'CLIENT_ADMIN'" --include="*.ts" --include="*.tsx" | grep -v "packages/shared"

# AvatarType
grep -rn "'TWO_D'\s*|\s*'THREE_D'" --include="*.ts" --include="*.tsx" | grep -v "packages/shared"

# SessionStatus
grep -rn "'ACTIVE'\s*|\s*'PROCESSING'" --include="*.ts" --include="*.tsx" | grep -v "packages/shared"

# 期待: 全て0件（コメント除く）
```

#### 4.3 E2Eテスト

```bash
npm run test:e2e
```

**推定時間:** 15分

---

## 📈 修正による効果

### メリット

1. **型安全性の向上**
   - Enum値の変更時に全箇所で型エラーが検出される
   - タイポ・誤入力の防止

2. **保守性の向上**
   - Enum定義の変更が1箇所（packages/shared）で完結
   - 変更の影響範囲が明確

3. **一貫性の確保**
   - 全レイヤー（Prisma → Shared → Lambda → Frontend）で同じ定義を使用
   - 'GUEST'のような新しい値の追加が漏れなく反映される

4. **DRY原則の遵守**
   - Don't Repeat Yourself - 重複定義の排除
   - コード量の削減

### デメリット（なし）

- 共有型を使用することによるデメリットは特になし
- パフォーマンス影響もなし（コンパイル時の型チェックのみ）

---

## 🔍 自動検証スクリプト（推奨）

### scripts/validate-enum-consistency.sh

```bash
#!/bin/bash

echo "🔍 Enum Consistency Validation"
echo "=============================="
echo ""

ERRORS=0

# 1. UserRole inline definitions (excluding packages/shared)
echo "1️⃣  Checking UserRole inline definitions..."
MATCHES=$(grep -rn "'SUPER_ADMIN'\s*|\s*'CLIENT_ADMIN'" apps/web infrastructure/lambda --include="*.ts" --include="*.tsx" | grep -v "packages/shared" | grep -v "node_modules" | grep -v "//.*status:" | wc -l)
if [ "$MATCHES" -gt 0 ]; then
  echo "   ❌ Found $MATCHES UserRole inline definitions"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ No UserRole inline definitions"
fi

# 2. AvatarType inline definitions
echo "2️⃣  Checking AvatarType inline definitions..."
MATCHES=$(grep -rn "'TWO_D'\s*|\s*'THREE_D'" apps/web infrastructure/lambda --include="*.ts" --include="*.tsx" | grep -v "packages/shared" | grep -v "node_modules" | wc -l)
if [ "$MATCHES" -gt 0 ]; then
  echo "   ❌ Found $MATCHES AvatarType inline definitions"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ No AvatarType inline definitions"
fi

# 3. SessionStatus inline definitions
echo "3️⃣  Checking SessionStatus inline definitions..."
MATCHES=$(grep -rn "'ACTIVE'\s*|\s*'PROCESSING'" apps/web infrastructure/lambda --include="*.ts" --include="*.tsx" | grep -v "packages/shared" | grep -v "node_modules" | grep -v "//.*status:" | wc -l)
if [ "$MATCHES" -gt 0 ]; then
  echo "   ❌ Found $MATCHES SessionStatus inline definitions"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ No SessionStatus inline definitions"
fi

# 4. UserRole 'GUEST' presence in shared types
echo "4️⃣  Checking UserRole 'GUEST' in shared types..."
if grep -q "'GUEST'" packages/shared/src/types/index.ts; then
  echo "   ✅ UserRole includes 'GUEST'"
else
  echo "   ❌ UserRole missing 'GUEST'"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=============================="
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ All enum consistency checks passed!"
  exit 0
else
  echo "❌ Found $ERRORS enum consistency issues"
  exit 1
fi
```

**使用方法:**

```bash
# 実行権限付与
chmod +x scripts/validate-enum-consistency.sh

# 実行
bash scripts/validate-enum-consistency.sh

# CI/CDパイプライン統合
npm run validate:enums
```

**package.json に追加:**

```json
{
  "scripts": {
    "validate:enums": "bash scripts/validate-enum-consistency.sh"
  }
}
```

---

## 📝 チェックリスト

### Phase 1: 共有型修正

- [ ] packages/shared/src/types/index.ts に 'GUEST' 追加
- [ ] `npm run build` 実行（packages/shared）
- [ ] TypeScript型チェック成功

### Phase 2: Lambda修正

- [ ] infrastructure/lambda/shared/types/index.ts 修正
- [ ] infrastructure/lambda/auth/login/index.ts 修正
- [ ] infrastructure/lambda/auth/register/index.ts 修正
- [ ] infrastructure/lambda/shared/auth/jwt.ts 修正
- [ ] `npx tsc --noEmit` 成功（infrastructure）

### Phase 3: Frontend修正

- [ ] apps/web/app/dashboard/avatars/page.tsx 修正
- [ ] apps/web/app/dashboard/avatars/new/page.tsx 修正
- [ ] apps/web/app/dashboard/avatars/[id]/edit/page.tsx 修正
- [ ] apps/web/app/dashboard/sessions/new/page.tsx 修正
- [ ] apps/web/app/dashboard/sessions/page.tsx 修正
- [ ] `npm run type-check` 成功（apps/web）

### Phase 4: 検証

- [ ] `bash scripts/validate-enum-consistency.sh` 全合格
- [ ] E2Eテスト成功
- [ ] 手動動作確認（アバター作成・セッション作成）

---

## 🎯 推奨アクション

1. **即座に実施（Phase 1）:**
   - UserRole に 'GUEST' を追加
   - 共有パッケージをビルド

2. **次回セッションで実施（Phase 2-3）:**
   - 全インライン定義を共有型に置き換え
   - 検証スクリプト作成・統合

3. **継続的改善:**
   - コミット前に `npm run validate:enums` 実行
   - CI/CDパイプラインに統合
   - コードレビューでインライン定義をチェック

---

**作成日:** 2026-03-18
**次回レビュー:** Phase 2-3完了時
**関連ドキュメント:**
- CLAUDE.md「Rule 4: 共有型定義の一元管理」
- docs/04-design/CONSISTENCY_GUIDELINES.md
