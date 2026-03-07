# コーディングルール - クイックリファレンス

**最終更新:** 2026-03-07

このドキュメントはコード作成時に常に参照すべき重要ルールのクイックリファレンスです。
詳細は [CLAUDE.md](CLAUDE.md) を参照してください。

---

## 📋 コミット前チェックリスト

**新しいコードを書いた後、コミット前に必ず実行:**

### ✅ 1. i18n（UI文字列を追加・変更した場合）

```bash
# ハードコード文字列検出
grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components

# placeholder/title属性チェック
grep -rn 'placeholder=["'"'"'][A-Z]' apps/web
grep -rn 'title=["'"'"'][A-Z]' apps/web
```

**期待結果:** すべて `{t('...')}` で囲まれている

---

### ✅ 2. Prismaスキーマ準拠（データベース関連コードを書いた場合）

```bash
# よくある間違いを検出
grep -rn "organizationId\|organization_id" infrastructure/lambda apps/web/lib --include="*.ts" | grep -v node_modules | grep -v ".prisma"
```

**期待結果:** コメント行のみ、または結果なし

**必須確認:**
- `orgId` を使用（organizationIdではない）
- `userId`, `scenarioId`, `avatarId` などcamelCase
- Enum値が大文字で完全一致（`ACTIVE`, `TWO_D` 等）

---

### ✅ 3. 型定義の一元管理（新しい型・インターフェースを追加した場合）

```bash
# 重複定義検出
grep -rn "^export interface \(User\|Avatar\|Scenario\|Session\)" apps/web infrastructure/lambda --include="*.ts" | grep -v node_modules | grep -v "packages/shared"

# インライン型定義検出
grep -rn "'TWO_D'.*|.*'THREE_D'\|'PRIVATE'.*|.*'PUBLIC'" apps/web infrastructure/lambda --include="*.ts" | grep -v node_modules | grep -v "from '@prance/shared'"
```

**期待結果:** 結果なし（packages/shared 以外に定義がない）

**必須確認:**
- 共有型は `packages/shared/src/types/index.ts` からimport
- 重複定義していない
- インライン型定義（`'PRIVATE' | 'PUBLIC'`）を使っていない

---

## 🚫 絶対にやってはいけないこと

### 1. UI文字列のハードコード

```typescript
// ❌ 絶対NG
<h1>Settings</h1>
<button>Submit</button>
<input placeholder="Enter your name" />

// ✅ 必ずこうする
const { t } = useI18n();
<h1>{t('settings.title')}</h1>
<button>{t('common.submit')}</button>
<input placeholder={t('common.namePlaceholder')} />
```

### 2. Prismaフィールド名の間違い

```typescript
// ❌ 絶対NG
interface RegisterRequest {
  organizationId: string;  // Prismaでは orgId
  user_id: string;          // snake_caseは使わない
}

// ✅ 必ずこうする
interface RegisterRequest {
  orgId: string;   // Prismaスキーマと一致
  userId: string;  // camelCase
}
```

### 3. 型の重複定義

```typescript
// ❌ 絶対NG
export interface User {
  id: string;
  email: string;
  // ... packages/sharedに既に定義されている
}

export interface AvatarListResponse {
  avatars: Avatar[];
  pagination: {
    total: number;
    limit: number;
    // ... PaginationMetaが既に存在
  };
}

// ✅ 必ずこうする
import type { User, Avatar, PaginationMeta } from '@prance/shared';

export interface AvatarListResponse {
  avatars: Avatar[];
  pagination: PaginationMeta;
}
```

---

## 📖 共有型の使い方

### Frontend (Next.js)

```typescript
import type {
  User,
  Avatar,
  Scenario,
  Session,
  Visibility,
  SessionStatus,
  PaginationMeta,
} from '@prance/shared';
```

### Lambda

```typescript
// 共有型は自動的にre-exportされている
import {
  User,
  Avatar,
  ValidationError,
  NotFoundError,
} from '../shared/types';
```

---

## 🔍 よくある間違い一覧

| カテゴリ | ❌ 間違い | ✅ 正しい |
|---------|----------|----------|
| **Prisma** | `organizationId` | `orgId` |
| **Prisma** | `user_id` | `userId` |
| **Prisma** | `started_at` | `startedAt` |
| **i18n** | `<h1>Settings</h1>` | `<h1>{t('settings.title')}</h1>` |
| **i18n** | `placeholder="Name"` | `placeholder={t('common.name')}` |
| **型定義** | `export interface User { ... }` | `import { User } from '@prance/shared'` |
| **型定義** | `'PRIVATE' \| 'PUBLIC'` | `import { Visibility } from '@prance/shared'` |
| **型定義** | `pagination: { total, limit, ... }` | `pagination: PaginationMeta` |

---

## 📚 詳細ドキュメント

- **完全ガイド:** [CLAUDE.md](CLAUDE.md) - Section 4「開発ガイドライン」
- **メモリー:** `~/.claude/projects/-workspaces-prance-communication-platform/memory/MEMORY.md`
- **重複監査:** [CODE_DUPLICATION_AUDIT.md](CODE_DUPLICATION_AUDIT.md)
- **Phase 1完了記録:** [START_HERE.md](START_HERE.md)

---

## 💡 このドキュメントの使い方

1. **コード作成前:** このファイルを開いて関連ルールを確認
2. **コード作成中:** 迷ったらこのファイルを参照
3. **コミット前:** チェックリストを全て実行
4. **レビュー時:** このドキュメントを基準に確認

**覚えておくこと:**
- 「参照して」だけでは不十分 → 具体的なコマンドを実行
- 「たぶん大丈夫」では不十分 → 必ず検証
- 過去の失敗から学ぶ → 同じミスを繰り返さない

---

**このルールを守ることで:**
- ✅ バグの早期発見
- ✅ コードの一貫性向上
- ✅ チーム開発の効率化
- ✅ 技術的負債の削減
