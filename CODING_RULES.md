# コーディングルール - クイックリファレンス

**最終更新:** 2026-03-08

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

### ✅ 4. WebSocketメッセージ型の整合性（WebSocket関連コードを書いた場合）

```bash
# フィールド名の不一致検出（session_id vs sessionId）
grep -rn "session_id.*:" apps/web/hooks/useWebSocket.ts infrastructure/lambda/websocket --include="*.ts"

# WebSocketメッセージ型の重複定義検出
grep -rn "^export interface.*Message.*extends WebSocketMessageBase\|^export interface.*Message.*{" apps/web/hooks --include="*.ts" | grep -v "from '@prance/shared'"
```

**期待結果:** 結果なし

**必須確認:**
- WebSocketメッセージ型は `@prance/shared` からimport
- フィールド名はキャメルケース（`sessionId`, `chunkId`等）
- スネークケース（`session_id`, `chunk_id`）は使わない
- フロントエンドとバックエンドで同じ型を使用

**共有型の場所:**
- `packages/shared/src/types/index.ts` の WebSocket Messages セクション
- `AuthenticateMessage`, `VideoChunkPartMessage` 等

---

### ✅ 5. コードの重複（DRY原則）（新しいロジックを実装した場合）

```bash
# 類似コードの検出（30行以上のロジック）
# 手動確認: 同じようなロジックが他の場所にないか？

# ソート処理の重複例
grep -rn "\.sort((a, b) =>" infrastructure/lambda --include="*.ts" -A 5

# ループ処理の重複例
grep -rn "for (let i = 0; i <" infrastructure/lambda apps/web --include="*.ts" -A 10 | grep -B 2 -A 10 "similar pattern"

# 正規表現パターンの重複例
grep -rn "\.match(/.*\\\d\+.*/);" infrastructure/lambda apps/web --include="*.ts"
```

**期待結果:** 同じロジックは1箇所のみ

**必須確認:**
- 同じロジックが2箇所以上にないか？
- 類似したコードを見つけた場合、共通関数化できないか？
- ファイル名に `utils.ts` または `helpers.ts` を付けた共通モジュールを作成したか？

**共通化の基準:**
- 10行以上の類似ロジック → 共通関数化を検討
- 30行以上の重複ロジック → **必ず**共通関数化
- 3箇所以上で同じパターン → **必ず**共通関数化

**実例（今回の改善）:**
- Before: 音声チャンクソート（30行）+ ビデオチャンクソート（30行）= 60行の重複
- After: `chunk-utils.ts` の共通関数 → 呼び出し3-4行のみ
- **削減率:** 88%

---

## ✅ 6. PRレビュー観点（プルリクエスト作成時）

```bash
# レビュー前の自己チェック
git diff main...HEAD
git log main..HEAD --oneline
```

**必須チェック項目:**

- [ ] **共通化可能なコードがないか**
  - 同じロジックが他にないか？
  - 10行以上の類似コード → 共通関数化を検討

- [ ] **既存の共通パッケージを利用しているか**
  - `packages/shared/src/types/` の型を使用？
  - `infrastructure/lambda/shared/config/defaults.ts` の設定値を使用？

- [ ] **エラーハンドリングが適切か**
  - try-catchで適切に例外処理？
  - エラーログが出力されている？

- [ ] **ログが適切に出力されているか**
  - `console.log()` の代わりに構造化ログ？
  - デバッグ用console.logを削除済み？

- [ ] **テストが追加されているか**
  - 新機能にユニットテスト追加？
  - バグ修正に回帰テスト追加？

- [ ] **ドキュメントが更新されているか**
  - API変更時に該当ドキュメント更新？
  - 重要な変更をClaude Memoryに記録？

**レビュアーへの依頼事項（PR説明に記載）:**
```markdown
## レビュー観点
- [ ] 共通化の妥当性
- [ ] エラーハンドリング
- [ ] テストカバレッジ
- [ ] パフォーマンス影響
```

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

### 4. コードの重複（DRY原則違反）

```typescript
// ❌ 絶対NG - 同じロジックを2箇所に書く
// File: audio-handler.ts
const sortedChunks = chunks.sort((a, b) => {
  const aMatch = a.Key?.match(/(\d+)-(\d+)\.\w+$/);
  const bMatch = b.Key?.match(/(\d+)-(\d+)\.\w+$/);
  if (!aMatch || !bMatch) return 0;
  const aTimestamp = parseInt(aMatch[1], 10);
  const bTimestamp = parseInt(bMatch[1], 10);
  if (aTimestamp !== bTimestamp) return aTimestamp - bTimestamp;
  return parseInt(aMatch[2], 10) - parseInt(bMatch[2], 10);
});

// File: video-handler.ts
const sortedChunks = chunks.sort((a, b) => {
  const aMatch = a.Key?.match(/(\d+)-(\d+)\.\w+$/);
  const bMatch = b.Key?.match(/(\d+)-(\d+)\.\w+$/);
  // ... 同じ30行のコードが再び出現
});

// ✅ 必ずこうする - 共通関数化
// File: chunk-utils.ts
export function sortChunksByTimestampAndIndex(chunks: S3Object[]): S3Object[] {
  return chunks.sort((a, b) => {
    const aMatch = a.Key?.match(/(\d+)-(\d+)\.\w+$/);
    const bMatch = b.Key?.match(/(\d+)-(\d+)\.\w+$/);
    if (!aMatch || !bMatch) return 0;
    const aTimestamp = parseInt(aMatch[1], 10);
    const bTimestamp = parseInt(bMatch[1], 10);
    if (aTimestamp !== bTimestamp) return aTimestamp - bTimestamp;
    return parseInt(aMatch[2], 10) - parseInt(bMatch[2], 10);
  });
}

// File: audio-handler.ts
import { sortChunksByTimestampAndIndex } from './chunk-utils';
const sortedChunks = sortChunksByTimestampAndIndex(chunks);

// File: video-handler.ts
import { sortChunksByTimestampAndIndex } from './chunk-utils';
const sortedChunks = sortChunksByTimestampAndIndex(chunks);
```

**なぜ重複が問題か:**
1. **修正漏れ** - 片方だけ修正して、もう片方を忘れる
2. **不整合** - 微妙に異なる実装で、動作が一貫しない
3. **メンテナンス負荷** - 変更時に複数箇所を修正する必要
4. **テストコスト** - 同じロジックを複数回テストする必要

**実際に起きた問題（2026-03-08）:**
- 音声チャンクソートを修正したが、ビデオチャンクソートの修正を忘れた
- ビデオでも同じバグが残っていることをユーザーが指摘
- → 共通関数化により根本解決

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
| **DRY原則** | 同じロジックを2箇所にコピペ | 共通関数を作成して両方で使用 |
| **DRY原則** | 30行のソートロジックを重複 | `utils.ts` に共通関数化 |

---

## 📚 詳細ドキュメント

- **完全ガイド:** [CLAUDE.md](CLAUDE.md) - Section 4「開発ガイドライン」
- **メモリー:** `~/.claude/projects/-workspaces-prance-communication-platform/memory/MEMORY.md`
- **重複監査:** [CODE_DUPLICATION_AUDIT.md](CODE_DUPLICATION_AUDIT.md)
- **Phase 1完了記録:** [START_HERE.md](START_HERE.md)
- **DRY原則実例:** [docs/development/CHUNK_SORTING_REFACTORING.md](docs/development/CHUNK_SORTING_REFACTORING.md)

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
- ✅ 修正漏れの防止（DRY原則）
- ✅ メンテナンス性の向上

---

## 🎯 DRY原則（Don't Repeat Yourself）の重要性

**原則:**
> 同じ知識を複数の場所で表現しない

**実践方法:**

1. **コードレビュー時に重複を検出**
   - 「これと似たコードを前に見た」と思ったら要注意
   - 10行以上の類似コード → 共通化を検討
   - 30行以上の重複 → **必ず**共通化

2. **共通関数の作成場所**
   - Lambda関数内: `infrastructure/lambda/websocket/default/utils.ts`
   - フロントエンド: `apps/web/lib/utils.ts` または `apps/web/hooks/`
   - 両方で使用: `packages/shared/src/utils/`

3. **命名規則**
   - `utils.ts` - 汎用ユーティリティ
   - `{feature}-utils.ts` - 特定機能用（例: `chunk-utils.ts`）
   - `helpers.ts` - ヘルパー関数

4. **テストの追加**
   - 共通関数には必ず単体テストを追加
   - `{module}.test.ts` または `{module}.spec.ts`

**実例から学ぶ（2026-03-08の改善）:**

| Before（重複あり） | After（共通化） | 効果 |
|------------------|----------------|------|
| 音声ソート30行 + ビデオソート30行 | `chunk-utils.ts` 1箇所 | 修正漏れゼロ |
| 変更時に2箇所修正 | 変更時に1箇所のみ | メンテナンス50%削減 |
| テスト2セット必要 | テスト1セットのみ | テストコスト50%削減 |

**参考資料:**
- [CHUNK_SORTING_REFACTORING.md](docs/development/CHUNK_SORTING_REFACTORING.md) - 実際のリファクタリング事例
