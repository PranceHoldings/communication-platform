# コーディングルール - クイックリファレンス

**最終更新:** 2026-03-22
**ステータス:** 基本ルール確立完了・今後も拡充予定

このドキュメントはコード作成時に常に参照すべき重要ルールのクイックリファレンスです。

**詳細ドキュメント:**
- [CLAUDE.md](CLAUDE.md) - プロジェクト全体概要
- [apps/CLAUDE.md](apps/CLAUDE.md) - フロントエンド開発ガイド
- [infrastructure/CLAUDE.md](infrastructure/CLAUDE.md) - インフラ・Lambda開発ガイド
- [scripts/CLAUDE.md](scripts/CLAUDE.md) - スクリプト使用ガイド
- [docs/CLAUDE.md](docs/CLAUDE.md) - ドキュメント管理ガイド
- [docs/07-development/HARDCODE_PREVENTION_SYSTEM.md](docs/07-development/HARDCODE_PREVENTION_SYSTEM.md) - ハードコード防止システム 🆕

---

## 🔴 Rule 0: スキーマ・ファースト原則（CRITICAL - 2026-03-22追加）

**🎯 Three-Layer Architecture Rule**

```
Layer 1: Schema (Prismaスキーマ) → 唯一の真実の源
Layer 2: Interface (packages/shared) → 型定義の中央管理
Layer 3: Implementation (Lambda/Frontend) → 型定義に従う実装
```

**絶対厳守:** スキーマ・ファースト → インターフェース・セカンド → 実装・サード

### ❌ 絶対禁止: 手動フィールドマッピング

```typescript
// Lambda関数で勝手にフィールド名変更（絶対禁止）
avatar: {
  ...session.avatar,
  imageUrl: session.avatar.thumbnailUrl, // ❌ 手動マッピング禁止
}
```

**理由:**
1. Prismaスキーマと不一致（`thumbnailUrl` が正しい）
2. packages/shared 型定義と不一致
3. 型安全性が失われる
4. 保守性が低下（複数箇所で同じマッピング）

### ✅ 正しい方法

```typescript
// Lambda関数はPrismaの結果をそのまま返す
avatar: session.avatar, // ✅ スキーマ通り

// Frontend は packages/shared の型を使用
import type { Avatar } from '@prance/shared';
session.avatar?.thumbnailUrl // ✅ スキーマと一致
```

### 検証方法

```bash
# Schema-First validation実行（コミット前必須）
bash scripts/validate-schema-interface-implementation.sh

# 期待される結果:
# ✅ All validations passed
# ❌ Validation failed → 必ず修正してからコミット
```

**詳細:** この原則に従うことで、Prismaスキーマと実装の不一致を防ぎます。

---

## 🔴 Rule 0-B: データベースアクセスはLambda経由のみ（CRITICAL - 2026-03-22追加）

**最重要原則:** このプロジェクトでは、AWS RDS Aurora Serverless v2への直接接続は一切禁止されています。

### ❌ 絶対禁止: 直接接続

```bash
# ❌ ローカルPostgreSQLへの接続
DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"

# ❌ RDSへの直接接続（VPCでブロック済み）
psql postgresql://pranceadmin:xxx@xxx.rds.amazonaws.com:5432/prance

# ❌ Prisma Migrateの直接実行
cd packages/database && pnpm exec prisma migrate dev
```

**理由:**
1. **セキュリティ**: RDSはVPC内に配置、外部からの直接接続は不可
2. **監査**: すべてのクエリがLambda経由でログに記録される
3. **アクセス制御**: IAMロールによる細かい権限管理

### ✅ 正しい方法

```bash
# Lambda関数内でPrisma Client使用（推奨）
import { prisma } from '../../shared/database/prisma';
const scenarios = await prisma.scenario.findMany();

# db-query.sh スクリプト使用（開発・検証時）
bash scripts/db-query.sh "SELECT id, title FROM scenarios LIMIT 5"
bash scripts/db-query.sh --file scripts/queries/verification.sql
bash scripts/db-query.sh --write "UPDATE scenarios SET ..." # 確認プロンプト表示

# 統合デプロイスクリプト使用（マイグレーション）
cd infrastructure && pnpm run deploy:dev-migration
```

**セキュリティ機能:**
- デフォルトはread-onlyモード（SELECT, WITH句のみ許可）
- 書き込み操作は `--write` フラグが必須
- 危険な操作（DROP TABLE等）は自動ブロック
- すべてのクエリがCloudWatch Logsに記録

**詳細:** [docs/07-development/DATABASE_ACCESS_RULES.md](docs/07-development/DATABASE_ACCESS_RULES.md)

---

## 🔴 ハードコード完全防止（2026-03-20実装）

**重要:** コーディング中にリアルタイムで警告、コミット時に自動ブロック

### ESLint Custom Rules（7つのルール）

#### ❌ 禁止パターン

```typescript
// 1. AWS リージョンのハードコード
const region = 'us-east-1'; // ❌

// 2. 言語コードのハードコード
const language = 'en-US'; // ❌

// 3. メディアフォーマットのハードコード
const format = 'webm'; // ❌
const contentType = 'audio/webm'; // ❌

// 4. AWS ドメインのハードコード
const url = 'https://bucket.s3.amazonaws.com/key'; // ❌

// 5. フォールバックパターン
const maxResults = process.env.MAX_RESULTS || 1000; // ❌

// 6. 直接的な process.env アクセス
const apiKey = process.env.ELEVENLABS_API_KEY; // ❌

// 7. 数値定数のハードコード
const MAX_RESULTS = 1000; // ❌
```

#### ✅ 正しいパターン

```typescript
// env-validator.ts を使用（唯一の方法）
import { getRequiredEnv, getAwsRegion, getAwsEndpointSuffix } from '../../shared/utils/env-validator';

const region = getAwsRegion();
const language = getRequiredEnv('STT_LANGUAGE');
const format = getRequiredEnv('VIDEO_FORMAT');
const url = `https://bucket.s3.${getAwsRegion()}.${getAwsEndpointSuffix()}/key`;
const maxResults = getMaxResults(); // defaults.ts から
```

### VSCode Snippets

**使い方:** コード内で prefix をタイプ → Tab

| Prefix           | 展開内容                   |
| ---------------- | -------------------------- |
| `import-env`     | getRequiredEnv インポート  |
| `env-get`        | 環境変数取得               |
| `env-region`     | AWS リージョン取得         |
| `lambda-full`    | Lambda関数テンプレート     |
| `s3-client`      | S3 Client初期化            |
| `dynamodb-client`| DynamoDB Client初期化      |

**例:**
```typescript
// タイプ: lambda-full → Tab
// → 完全なLambda関数テンプレートが展開される（env-validator統合済み）
```

### Pre-commit Hook

**自動実行:** `git commit` 時に自動検証

```bash
git commit -m "feat: add feature"
# → 自動実行:
#   [1/3] Checking for hardcoded values...
#   [2/3] Validating environment variables...
#   [3/3] Running ESLint on staged files...
#
# エラーがあればコミット拒否
```

**詳細:** [docs/07-development/HARDCODE_PREVENTION_SYSTEM.md](docs/07-development/HARDCODE_PREVENTION_SYSTEM.md)

---

## 🔴 環境変数 - Single Source of Truth（2026-03-20実装）🆕

**最重要原則:** `.env.local`のみが環境変数を定義、`infrastructure/.env`は自動生成

### ❌ 禁止事項

```bash
# 1. infrastructure/.env を直接編集
# ❌ 絶対にやってはいけない
vim infrastructure/.env  # 手動編集禁止

# 2. 環境変数の重複定義
# ❌ .env.local に同じ変数を2回定義
MAX_RESULTS=1000
MAX_RESULTS=2000  # 重複

# 3. 機密情報を infrastructure/.env に含める
# ❌ Secrets は Secrets Manager で管理
ELEVENLABS_API_KEY=***  # infrastructure/.env に含めない
```

### ✅ 正しい手順

```bash
# 1. 環境変数を追加
echo "MY_NEW_VAR=value" >> .env.local

# 2. 自動同期
bash scripts/sync-env-vars.sh

# 3. 検証
bash scripts/validate-env-single-source.sh

# 4. コミット（自動でSSOT検証）
git add .
git commit -m "feat: add MY_NEW_VAR"
```

### 自動同期システム

**同期:** `.env.local` → `infrastructure/.env`（非機密情報のみ）

```bash
# 同期実行
bash scripts/sync-env-vars.sh

# 同期状態確認
bash scripts/sync-env-vars.sh --check-only

# SSOT検証（Pre-commit hookで自動実行）
bash scripts/validate-env-single-source.sh
```

### Pre-commit Hook（4段階検証）

```bash
git commit -m "feat: add feature"
# → 自動実行:
#   [1/4] Checking for hardcoded values...
#   [2/4] Validating environment variables consistency...
#   [3/4] Validating Single Source of Truth (.env.local)...  🆕
#   [4/4] Running ESLint on staged files...
```

### 機密情報の管理

| 情報タイプ       | 開発環境                | 本番環境                |
| ---------------- | ----------------------- | ----------------------- |
| 非機密情報       | `.env.local`            | `.env.local` または環境変数 |
| 機密情報         | `.env.local`（ダミー値） | AWS Secrets Manager     |

**機密情報の命名規則（自動除外）:**
- `*_SECRET`
- `*_KEY`
- `*_PASSWORD`
- `*_TOKEN`
- `*_CREDENTIALS`

**詳細:** [docs/07-development/ENV_VAR_SINGLE_SOURCE_OF_TRUTH.md](docs/07-development/ENV_VAR_SINGLE_SOURCE_OF_TRUTH.md)

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

### ✅ 6. 言語コードのハードコード（言語・設定値を追加・変更した場合）

```bash
# 言語コードのハードコード検出
grep -rn "'ja-JP'\|'en-US'\|'zh-CN'\|'zh-TW'" infrastructure/lambda --include="*.ts" --exclude="language-config.ts" --exclude="defaults.ts"

# 言語配列リテラルの検出
grep -rn "\['ja', 'en'\]\|\['ja-JP', 'en-US'\]" infrastructure/lambda --include="*.ts" --exclude="language-config.ts" --exclude="defaults.ts"

# リージョン・メディアフォーマットのハードコード検出
grep -rn "'us-east-1'\|'eastus'\|'webm'\|'1280x720'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts"
```

**期待結果:** defaults.ts と language-config.ts 以外には結果なし

**必須確認:**

- 言語コード（'ja', 'en', 'ja-JP', 'en-US'等）をハードコードしていないか？
- リージョン（'us-east-1', 'eastus'等）をハードコードしていないか？
- メディアフォーマット（'webm', '1280x720'等）をハードコードしていないか？
- `LANGUAGE_DEFAULTS` または `language-config.ts` の関数を使用しているか？

**正しい使用例:**

```typescript
// ❌ 禁止
const language = 'ja-JP';
const languages = ['ja', 'en'];
const region = 'us-east-1';
const format = 'webm';

// ✅ 正しい
import { LANGUAGE_DEFAULTS, MEDIA_DEFAULTS } from '../../shared/config/defaults';
import { getLanguagePriority } from '../../shared/config/language-config';

const language = process.env.STT_LANGUAGE || LANGUAGE_DEFAULTS.STT_LANGUAGE;
const languages = getLanguagePriority(scenarioLanguage);
const region = process.env.AWS_REGION || AWS_DEFAULTS.REGION;
const format = process.env.VIDEO_FORMAT || MEDIA_DEFAULTS.VIDEO_FORMAT;
```

**なぜハードコードが問題か:**

1. **変更時の修正漏れ** - 複数箇所に散らばった設定値を見落とす
2. **新言語追加の困難** - コード全体を修正する必要がある
3. **環境ごとの設定変更が困難** - 本番と開発で異なる値を使いにくい
4. **スーパー管理者UIでの動的変更不可** - Phase 2以降の拡張性が失われる

**実際に起きた問題（2026-03-08）:**

- 言語コードが infrastructure/lambda 内の複数ファイルにハードコード
- 新言語追加時にすべてのファイルを修正する必要があった
- → language-config.ts による一元管理で根本解決

---

## ✅ 7. Cookie処理の統一（Cookie設定を追加・変更した場合） 🆕

```bash
# Cookie設定の重複検出
grep -rn "document\.cookie\s*=\|cookies\.set.*{" apps/web --include="*.ts" --include="*.tsx" | grep -v "from '@/lib/cookies'" | grep -v node_modules

# Cookie options のハードコード検出
grep -rn "maxAge:\s*31536000\|sameSite:\s*'lax'" apps/web --include="*.ts" --include="*.tsx" | grep -v "lib/cookies.ts" | grep -v node_modules
```

**期待結果:** lib/cookies.ts 以外に重複なし

**必須確認:**

- Cookie設定を直接 `document.cookie` で操作していないか？
- Cookie optionsをハードコードしていないか？
- `lib/cookies.ts` の統一ユーティリティを使用しているか？

**正しい使用例:**

```typescript
// ❌ 禁止
document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000`;
response.cookies.set(name, value, {
  path: '/',
  maxAge: 31536000,
  sameSite: 'lax',
});

// ✅ 正しい
import { setLocaleCookie, COOKIE_CONFIGS } from '@/lib/cookies';

// クライアントサイド
setLocaleCookie(locale);

// サーバーサイド
response.cookies.set(name, value, COOKIE_CONFIGS.locale.options);
```

**効果:**
- Cookie設定の一元管理（DRY原則）
- セキュリティ設定の統一
- 変更時の一貫性保証

---

## ✅ 8. 言語リスト同期検証（言語追加・削除した場合） 🆕

```bash
# 言語リスト同期検証
pnpm run validate:languages

# 期待結果: "All language lists are synchronized"
```

**同期必須の3箇所:**

1. `apps/web/lib/i18n/config.ts` - `locales` 配列
2. `infrastructure/lambda/shared/config/language-config.ts` - `LANGUAGES` 配列
3. `apps/web/messages/{languageCode}/` ディレクトリ

**新言語追加フロー:**

1. Frontend config の `locales` 配列に追加
2. Lambda config の `LANGUAGES` 配列に追加
3. Message directory 作成 (`apps/web/messages/{languageCode}/`)
4. `pnpm run validate:languages` で検証

**効果:**
- 言語追加時の同期漏れ防止
- Frontend/Lambda の言語不整合エラー予防

---

## ✅ 9. PRレビュー観点（プルリクエスト作成時）

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

## ✅ 10. Next.js App Router構造準拠（フロントエンドページ追加時） 🆕

**🔴 重要: URLパスを推測せず、必ず実装を確認してからテスト・コード作成**

```bash
# 実装されているページを確認
find apps/web/app -name "page.tsx" | grep -v node_modules

# APIエンドポイント確認
grep -r "router\.get\|router\.post" infrastructure/lambda --include="*.ts"
```

**期待結果:** 実装済みのルート構造を把握

**必須確認:**

- [ ] 認証必要なページは `/dashboard/` 配下に配置されているか？
- [ ] `/login`, `/register` は `(auth)/` グループ内か？
- [ ] 動的ルートは `[id]/page.tsx` 形式か？
- [ ] テストパスは実装から取得したか？（推測ではない）

**正しい構造:**

```
apps/web/app/
├── (auth)/                    # 認証不要ページグループ
│   ├── login/page.tsx        # /login
│   └── register/page.tsx     # /register
├── dashboard/                 # 認証必要ページ（/dashboard/*）
│   ├── scenarios/
│   │   ├── page.tsx          # /dashboard/scenarios
│   │   ├── [id]/page.tsx     # /dashboard/scenarios/:id
│   │   └── new/page.tsx      # /dashboard/scenarios/new
│   └── sessions/page.tsx     # /dashboard/sessions
└── api/                       # API Routes
```

**過去の失敗例（2026-03-11）:**
- E2Eテストで `/scenarios`, `/avatars` に404エラー
- 正解は `/dashboard/scenarios`, `/dashboard/avatars`
- 推測ではなく実装確認が必須

> 詳細: [apps/CLAUDE.md](apps/CLAUDE.md) - Rule 1

---

## ✅ 11. next-intl使用禁止（多言語対応システム統一） 🆕

**🔴 最重要: 独自I18nProviderのみ使用、next-intlは使用禁止**

```bash
# next-intl インポート検出（0件が正常）
grep -r "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules

# 期待結果: 何も表示されない（0件）
```

**必須確認:**

- [ ] `useI18n()` from '@/lib/i18n/provider' を使用しているか？
- [ ] `useTranslations()` from 'next-intl' を使用していないか？
- [ ] `getTranslations()` from 'next-intl/server' を使用していないか？

**正しい使用例:**

```typescript
// ✅ 正しい
import { useI18n } from '@/lib/i18n/provider';

export function MyComponent() {
  const { t, locale } = useI18n();
  return <div>{t('common.welcome')}</div>;
}

// ❌ 間違い
import { useTranslations } from 'next-intl';           // 使用禁止
import { getTranslations } from 'next-intl/server';    // 使用禁止
```

**過去の失敗例（2026-03-11）:**
- `useErrorMessage` フックで next-intl 使用 → Runtime Error
- 不完全な移行で2つのi18nシステムが混在
- 根本解決: next-intl完全削除、全ファイルを useI18n に統一

> 詳細: [apps/CLAUDE.md](apps/CLAUDE.md) - Rule 2

---

## ✅ 12. Lambda依存関係検証（Lambda関数デプロイ前） 🆕

**🔴 最重要: デプロイ前に必須SDK検証、欠如=本番500エラー=サービス停止**

```bash
# Lambda依存関係検証（デプロイ前必須）
cd infrastructure
pnpm run lambda:predeploy

# または個別検証
bash scripts/validate-lambda-dependencies.sh prance-websocket-default-dev
```

**期待結果:** 全SDKが正しくインストール済み

**検証対象SDK:**

- `@aws-sdk/client-s3`
- `@aws-sdk/client-bedrock-runtime`
- `@prisma/client`
- `microsoft-cognitiveservices-speech-sdk`
- 共有モジュール (`shared/config`, `shared/utils`)

**依存関係破損時の修復:**

```bash
pnpm run lambda:fix
```

**過去の失敗例（2026-03-11）:**
- Azure Speech SDK欠如 → node_modules破損（65535階層ネスト）
- 検証プロセスなしでデプロイ → 本番500エラー
- 根本解決: 検証スクリプト統合、修復スクリプト作成

> 詳細: [infrastructure/CLAUDE.md](infrastructure/CLAUDE.md) - Rule 4

---

## ✅ 13. Lambda関数デプロイメント原則（Lambda関数デプロイ時） 🆕

**🔴 最重要: Lambda関数デプロイはCDK経由のみ。手動zipアップロード絶対禁止**

```bash
# ✅ 正しいデプロイ方法（唯一の方法）
cd infrastructure
pnpm run deploy:websocket

# または個別デプロイ
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

**❌ 絶対禁止:**

```bash
# 手動zipアップロード（絶対に実行してはいけない）
cd infrastructure/lambda/websocket/default
zip -r lambda-deployment.zip .
aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb://lambda-deployment.zip
```

**理由:**
- TypeScriptファイル（.ts）がそのままzipされる
- esbuildによるトランスパイル（TypeScript → JavaScript）がスキップされる
- Lambda Runtimeは`.js`ファイルを期待するが、`.ts`ファイルしかない
- 結果: `Runtime.ImportModuleError: Cannot find module 'index'`

**過去の失敗例（複数回）:**
- 手動zipで緊急対応 → 一時的に動作
- CDKデプロイで古いコードに戻る → 機能が消失
- 根本解決: CDK経由デプロイのみを徹底

> 詳細: [infrastructure/CLAUDE.md](infrastructure/CLAUDE.md) - Rule 1

---

## ✅ 14. データベースアクセス原則（データベース操作時） 🆕

**🔴 最重要: Aurora RDSへのアクセスは必ずLambda経由**

```bash
# ✅ 正しい方法
bash scripts/db-query.sh "SELECT * FROM scenarios LIMIT 5"

# ファイル経由（大きなクエリ）
bash scripts/db-query.sh --file scripts/queries/verification.sql

# 書き込み操作（明示的フラグ必須）
bash scripts/db-query.sh --write "UPDATE scenarios SET title='New' WHERE id='xxx'"
```

**❌ 絶対禁止:**

```bash
# ローカルPostgreSQLへの直接接続（禁止）
psql postgresql://localhost:5432/prance

# RDSへの直接接続（VPCでブロック済み）
psql postgresql://xxx.rds.amazonaws.com:5432/prance
```

**理由:**
- このプロジェクトはAWS RDS Aurora Serverless v2専用
- ローカルPostgreSQLは一切使用しない
- VPC内でアクセス制御されている
- Lambda経由でセキュアにアクセス

**環境変数検証:**

```bash
# DATABASE_URLが正しく設定されているか検証
./scripts/validate-env.sh

# 期待: AWS RDS Aurora Serverless v2のURL
```

> 詳細: [scripts/CLAUDE.md](scripts/CLAUDE.md) - Rule 2, [CLAUDE.md](CLAUDE.md) - Section 4「環境変数管理」

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
  organizationId: string; // Prismaでは orgId
  user_id: string; // snake_caseは使わない
}

// ✅ 必ずこうする
interface RegisterRequest {
  orgId: string; // Prismaスキーマと一致
  userId: string; // camelCase
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

### 5. URLパスの推測（Next.js App Router） 🆕

```typescript
// ❌ 絶対NG - 推測でテストパスを決定
test('should navigate to scenarios page', () => {
  cy.visit('/scenarios');  // 推測: RESTful APIの慣習から
  cy.visit('/avatars');    // 推測: リソース名の複数形
});

// ✅ 必ずこうする - 実装を確認してから決定
// Step 1: 実装確認
// $ find apps/web/app -name "page.tsx" | grep scenarios
// apps/web/app/dashboard/scenarios/page.tsx

test('should navigate to scenarios page', () => {
  cy.visit('/dashboard/scenarios');  // 実装から確認した正しいパス
  cy.visit('/dashboard/avatars');    // 実装から確認した正しいパス
});
```

**なぜ推測が問題か:**

1. **Next.js App Router** - 認証必要ページは `/dashboard/` 配下にグループ化される
2. **フレームワーク構造** - 「一般的な慣習」ではなく、実装が真実
3. **404エラー** - 推測したパスが存在しない → テスト失敗

**実際に起きた問題（2026-03-11）:**
- E2Eテストで `/scenarios`, `/avatars`, `/sessions` に404エラー
- RESTful APIの慣習から推測してテストパスを決定
- 正解: `/dashboard/scenarios`, `/dashboard/avatars`, `/dashboard/sessions`

### 6. next-intl の使用（多言語対応システム） 🆕

```typescript
// ❌ 絶対NG - next-intl を使用
import { useTranslations } from 'next-intl';           // 使用禁止
import { getTranslations } from 'next-intl/server';    // 使用禁止

export function MyComponent() {
  const t = useTranslations('common');
  return <div>{t('welcome')}</div>;
}

// ✅ 必ずこうする - 独自I18nProvider使用
import { useI18n } from '@/lib/i18n/provider';

export function MyComponent() {
  const { t } = useI18n();
  return <div>{t('common.welcome')}</div>;
}
```

**なぜnext-intlが問題か:**

1. **2つのi18nシステム混在** - next-intl と独自システムが衝突
2. **Runtime Error** - `NextIntlClientProvider context not found`
3. **不完全な移行** - 古いシステムの残骸が残る

**実際に起きた問題（2026-03-11）:**
- `useErrorMessage` フックで next-intl の `useTranslations` を使用
- Runtime Error発生、アプリケーションクラッシュ
- 根本解決: next-intl完全削除、全ファイルを useI18n に統一

### 7. 手動Lambda zipアップロード（Lambda関数デプロイ） 🆕

```bash
# ❌ 絶対NG - 手動zipアップロード
cd infrastructure/lambda/websocket/default
zip -r lambda-deployment.zip .
aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb://lambda-deployment.zip

# ✅ 必ずこうする - CDK経由デプロイ
cd infrastructure
pnpm run deploy:websocket
```

**なぜ手動zipが問題か:**

1. **TypeScript未トランスパイル** - `.ts` ファイルがそのままデプロイされる
2. **Runtime Error** - `Runtime.ImportModuleError: Cannot find module 'index'`
3. **一時的な動作** - 手動zipで動いても、CDKデプロイで古いコードに戻る

**実際に起きた問題（複数回）:**
- 緊急対応で手動zip → 一時的に動作
- 次のCDKデプロイで古いコードに戻る → 機能消失
- 根本解決: CDK経由デプロイのみを徹底

### 8. 直接データベース接続（データベースアクセス） 🆕

```bash
# ❌ 絶対NG - 直接PostgreSQL接続
psql postgresql://localhost:5432/prance         # ローカル
psql postgresql://xxx.rds.amazonaws.com/prance  # RDS直接

# ✅ 必ずこうする - Lambda経由
bash scripts/db-query.sh "SELECT * FROM scenarios LIMIT 5"
bash scripts/db-query.sh --file scripts/queries/verification.sql
```

**なぜ直接接続が問題か:**

1. **ローカルPostgreSQL不使用** - このプロジェクトはRDS専用
2. **VPCアクセス制御** - RDS直接接続はブロックされている
3. **セキュリティ** - Lambda経由でセキュアにアクセス

**実際に起きた問題（複数回）:**
- `.env.local` にローカルPostgreSQL URLを設定 → 接続エラー
- RDS直接接続を試行 → VPCでブロック
- 根本解決: `scripts/db-query.sh` による統一アクセス

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
import { User, Avatar, ValidationError, NotFoundError } from '../shared/types';
```

---

## 🔍 よくある間違い一覧

| カテゴリ         | ❌ 間違い                              | ✅ 正しい                                     |
| ---------------- | -------------------------------------- | --------------------------------------------- |
| **Prisma**       | `organizationId`                       | `orgId`                                       |
| **Prisma**       | `user_id`                              | `userId`                                      |
| **Prisma**       | `started_at`                           | `startedAt`                                   |
| **i18n**         | `<h1>Settings</h1>`                    | `<h1>{t('settings.title')}</h1>`              |
| **i18n**         | `placeholder="Name"`                   | `placeholder={t('common.name')}`              |
| **i18n**         | `useTranslations()` from 'next-intl'   | `useI18n()` from '@/lib/i18n/provider'        |
| **型定義**       | `export interface User { ... }`        | `import { User } from '@prance/shared'`       |
| **型定義**       | `'PRIVATE' \| 'PUBLIC'`                | `import { Visibility } from '@prance/shared'` |
| **型定義**       | `pagination: { total, limit, ... }`    | `pagination: PaginationMeta`                  |
| **DRY原則**      | 同じロジックを2箇所にコピペ            | 共通関数を作成して両方で使用                  |
| **DRY原則**      | 30行のソートロジックを重複             | `utils.ts` に共通関数化                       |
| **Next.js**      | URLパス推測（`/scenarios`）            | 実装確認（`/dashboard/scenarios`）            |
| **Lambda**       | 手動zipアップロード                    | `pnpm run deploy:websocket`（CDK経由）         |
| **Lambda**       | デプロイ前に依存関係検証なし           | `pnpm run lambda:predeploy`（必須）            |
| **Database**     | `psql postgresql://localhost:5432`     | `bash scripts/db-query.sh "SELECT ..."`       |
| **Database**     | RDS直接接続                            | Lambda経由アクセス                            |

---

## 📚 詳細ドキュメント

### マスターガイド

- **[CLAUDE.md](CLAUDE.md)** - プロジェクト全体概要・重要方針
- **[START_HERE.md](START_HERE.md)** - 次回セッション開始（エントリーポイント）

### 階層化されたCLAUDE.md 🆕

- **[apps/CLAUDE.md](apps/CLAUDE.md)** - フロントエンド開発ガイド（Next.js 15、多言語対応、UI開発）
- **[infrastructure/CLAUDE.md](infrastructure/CLAUDE.md)** - インフラ・Lambda開発ガイド（AWS CDK、サーバーレス、セキュリティ）
- **[scripts/CLAUDE.md](scripts/CLAUDE.md)** - スクリプト使用ガイド（検証、デプロイ、データベースクエリ）
- **[docs/CLAUDE.md](docs/CLAUDE.md)** - ドキュメント管理ガイド（更新ルール、コード整合性管理）

### その他

- **メモリー:** `~/.claude/projects/-workspaces-prance-communication-platform/memory/MEMORY.md`
- **重複監査:** [CODE_DUPLICATION_AUDIT.md](docs/development/CODE_DUPLICATION_AUDIT.md)
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

| Before（重複あり）                | After（共通化）        | 効果                |
| --------------------------------- | ---------------------- | ------------------- |
| 音声ソート30行 + ビデオソート30行 | `chunk-utils.ts` 1箇所 | 修正漏れゼロ        |
| 変更時に2箇所修正                 | 変更時に1箇所のみ      | メンテナンス50%削減 |
| テスト2セット必要                 | テスト1セットのみ      | テストコスト50%削減 |

**参考資料:**

- [CHUNK_SORTING_REFACTORING.md](docs/development/CHUNK_SORTING_REFACTORING.md) - 実際のリファクタリング事例

---

## 🔴 Rule 10: 重複管理原則（CRITICAL - 2026-03-22追加）

**🎯 基本原則: 設定・型・処理の重複を許さない**

AIコード生成では、同じ設定・型・処理が複数ファイルに重複しやすい。重複は保守性を著しく低下させるため、厳格に管理する。

### 自動検証（8段階チェック）

**検証スクリプト:**

```bash
# 手動実行
bash scripts/validate-duplication.sh

# 自動実行（pre-commit hook）
git commit -m "..."  # 自動的に検証

# 自動実行（デプロイ前）
pnpm run deploy:lambda  # 自動的に検証
```

**検証項目:**

| Step | 検証内容                           | 検出対象                                   |
| ---- | ---------------------------------- | ------------------------------------------ |
| 1/8  | 環境変数の重複                     | 直接 `process.env` アクセス（9箇所検出）   |
| 2/8  | 型定義の重複                       | EmotionScore, AgeRange, Pose等（4箇所検出） |
| 3/8  | Enum同期                           | packages/shared ↔ Lambda の不一致検出      |
| 4/8  | 定数・設定の重複                   | ハードコード定数（defaults.tsに集約）      |
| 5/8  | ユーティリティ関数の重複           | shared/utils外の重複検出                   |
| 6/8  | バリデーションロジックの重複       | 分散したバリデーション検出                 |
| 7/8  | Frontend API呼び出しの重複         | 直接fetch()呼び出し検出（0件が正常）       |
| 8/8  | Lambda関数の重複実装               | 共通処理の抽出漏れ検出                     |

### 必須パターン

#### ✅ 環境変数アクセス

```typescript
// ❌ 禁止（直接アクセス）
const region = process.env.AWS_REGION || 'us-east-1';
const table = process.env.CONNECTIONS_TABLE_NAME!;

// ✅ 正しい（centralized config経由）
import { getAwsRegion, getConnectionsTableName } from '../../shared/config';
const region = getAwsRegion();
const table = getConnectionsTableName();
```

#### ✅ 型定義

```typescript
// ❌ 禁止（Lambda側で再定義）
export interface EmotionScore {
  type: string;
  confidence: number;
}

// ✅ 正しい（共有型からimport）
import type { EmotionScore } from '../types';
```

#### ✅ Enum定義

```typescript
// ⚠️ 注意: Lambda bundling制約によりpackages/sharedから直接importできない
// packages/shared と infrastructure/lambda/shared/types を完全一致させる

// packages/shared/src/types/index.ts
export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';

// infrastructure/lambda/shared/types/index.ts
export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';
// ↑ 完全一致が必須（自動検証で確認）
```

#### ✅ 定数・設定

```typescript
// ❌ 禁止（ハードコード）
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

// ✅ 正しい（defaults.tsに集約）
import { RETRY_DEFAULTS, TIMEOUT_DEFAULTS } from '../../shared/config/defaults';
const maxRetries = RETRY_DEFAULTS.MAX_RETRIES;
const timeoutMs = TIMEOUT_DEFAULTS.DEFAULT_TIMEOUT;
```

#### ✅ ユーティリティ関数

```typescript
// ❌ 禁止（Lambda関数内で定義）
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ✅ 正しい（shared/utilsに集約）
import { formatDate } from '../../shared/utils/date-formatter';
```

#### ✅ Frontend API呼び出し

```typescript
// ❌ 禁止（直接fetch）
const response = await fetch('/api/v1/sessions');
const data = await response.json();

// ✅ 正しい（API client経由）
import { listSessions } from '@/lib/api/sessions';
const response = await listSessions();
```

### エラー時の対処

**Error: Environment variable duplication**

```
❌ Found 9 direct process.env accesses (should use centralized config)
```

**対処:**

1. `infrastructure/lambda/shared/config/index.ts` に getter 追加
2. Lambda関数で `import { getXxx }` して使用

**Error: Type definition duplication**

```
❌ EmotionScore defined in rekognition.ts (should import from types/index.ts)
```

**対処:**

1. Lambda側の定義を削除
2. `import type { EmotionScore } from '../types'` 追加

**Error: Enum mismatch**

```
❌ UserRole enum mismatch between packages/shared and infrastructure/lambda/shared
```

**対処:**

1. packages/shared の定義を確認
2. Lambda側を完全一致させる

### コミット前チェックリスト

```bash
# 必須検証（自動実行）
git commit -m "..."

# エラー時の手動確認
bash scripts/validate-duplication.sh
```

**検証結果:**

```
✅ All checks passed (0 errors, 0 warnings)
```

### 詳細ドキュメント

- **[docs/07-development/DUPLICATION_MANAGEMENT.md](docs/07-development/DUPLICATION_MANAGEMENT.md)** - 重複管理詳細ガイド
- **[memory/duplication-management.md](memory/duplication-management.md)** - AI用メモリ（検証方法、エラー対処）

### 重複検出時の判断フロー

```
重複検出
  ↓
本当に重複か？
  ↓ Yes
機能特化の実装か？（例: WebSocket専用chunk-utils.ts）
  ↓ No
共通化可能か？
  ↓ Yes
共通化実施
  ├─ 環境変数 → config/index.ts
  ├─ 型定義 → shared/types/
  ├─ 定数 → config/defaults.ts
  ├─ 関数 → shared/utils/
  └─ バリデーション → shared/utils/validation.ts
```

**原則:**

- **疑わしきは共通化** - 2箇所で使われたら即共通化
- **10行以上の類似コード** - 必ず共通関数化を検討
- **30行以上の重複** - **絶対に**共通化（例外なし）

---

## 🔴 Rule 10: 依存関係追加時の必須チェック（CRITICAL - 2026-04-02追加）

**条件:** `package.json` に新しい依存関係を追加する場合

**最重要原則:** 依存関係は「資産」ではなく「負債」である

### ❌ 禁止事項

```bash
# 1. 調査せずにインストール
pnpm install <package>  # ❌ 依存関係ツリーを確認していない

# 2. 大きなライブラリを全体インストール
pnpm install lodash  # ❌ 必要な関数だけコピーすべき

# 3. 古いライブラリ
pnpm install moment  # ❌ 非推奨、date-fnsまたは native Intl を使用
```

### ✅ 正しい手順

```bash
# Step 1: 依存関係ツリーを確認
pnpm info <package> dependencies
pnpm info <package> peerDependencies

# Step 2: サイズを確認
pnpm info <package> dist.unpackedSize

# Step 3: 自己実装を検討（100行以内なら自己実装）
cat > packages/shared/src/utils/array.ts <<EOF
export function chunk<T>(array: T[], size: number): T[][] {
  // ... 実装 ...
}
EOF

# Step 4: 必要なら軽量な代替を探す
# lodash → lodash-es（tree-shakeable）
# moment → date-fns（0 dependencies）
# axios → native fetch（0 dependencies）

# Step 5: 検証スクリプト実行
pnpm run validate:deps-size
```

### 判断基準

| 直接依存数 | 判断                                   |
| ---------- | -------------------------------------- |
| 0-10個     | ✅ OK（軽量）                          |
| 11-20個    | ⚠️ 本当に必要か再検討、代替を調査     |
| 21個以上   | ❌ 重すぎる、別の軽量な代替を探す      |

| 実装時間   | 推奨アクション                         |
| ---------- | -------------------------------------- |
| < 1時間    | ✅ 自己実装を推奨                      |
| 1-4時間    | ✅ 自己実装を検討（メンテコスト考慮）  |
| 4-8時間    | ⚠️ 軽量ライブラリを検討               |
| > 8時間    | ✅ ライブラリ使用（慎重に選定）        |

### 検証方法

```bash
# 依存関係サイズ検証（コミット前必須）
pnpm run validate:deps-size

# 期待される結果:
# ✅ All dependencies are within acceptable limits
# ❌ Heavy dependency detected → 代替を検討
```

**詳細:** [memory/feedback_dependency_management.md](memory/feedback_dependency_management.md)

---

## 🔴 Rule 11: Monorepo境界の厳守（CRITICAL - 2026-04-02追加）

**最重要原則:** ワークスペース間の境界は明確に、違反は設計上の失敗

### ❌ 絶対禁止

```typescript
// 1. Frontend が Backend をimport
// apps/web/lib/utils.ts
import { formatDate } from '../../../infrastructure/lambda/shared/utils';
// ❌ フロントエンドがバックエンドをimport

// 2. Backend が Frontend をimport
// infrastructure/lambda/auth/login/index.ts
import { LoginForm } from '../../../../../apps/web/components/LoginForm';
// ❌ バックエンドがフロントエンドをimport

// 3. Shared package に runtime logic
// packages/shared/src/database.ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
// ❌ 共有パッケージにランタイムロジック

// 4. Frontend に AWS SDK
// apps/web/lib/api.ts
import { S3Client } from '@aws-sdk/client-s3';
// ❌ フロントエンドにバックエンドライブラリ
```

### ✅ 正しい方法

```typescript
// 1. 共有型定義（packages/shared）
// packages/shared/src/types/user.ts
export interface User {
  id: string;
  email: string;
}

// 2. Frontend で使用
// apps/web/app/dashboard/page.tsx
import type { User } from '@prance/shared';
// ✅ 共有型をimport

// 3. Backend で使用
// infrastructure/lambda/auth/me/index.ts
import type { User } from '@prance/shared';
// ✅ 共有型をimport

// 4. Runtime logic は各ワークスペースで独立
// infrastructure/lambda/shared/database.ts
export const prisma = new PrismaClient();
// ✅ バックエンドのみ
```

### ワークスペース依存関係ルール

```
apps/web           → CAN import → packages/shared (types only)
                   → CANNOT import → infrastructure

infrastructure     → CAN import → packages/shared (types only)
                   → CANNOT import → apps/web

packages/shared    → CANNOT import → apps/web OR infrastructure
                   → Only type definitions, no runtime logic

packages/database  → CANNOT import → anything except Prisma
```

### 検証方法

```bash
# Monorepo境界検証（コミット前必須）
pnpm run validate:monorepo

# 期待される結果:
# ✅ All monorepo boundary validations passed
# ❌ Boundary violation detected → 必ず修正
```

**詳細:** [memory/feedback_monorepo_rules.md](memory/feedback_monorepo_rules.md)

---

## 🔴 Rule 12: テスト実装前の確認（CRITICAL - 2026-04-02追加）

**最重要原則:** 推測でテストを書かず、必ず実装を確認してから作成すること

### ❌ 絶対禁止

```typescript
// 1. URLパスを推測
test('dashboard loads', async () => {
  await page.goto('/dashboard/sessions');
  // ❌ 実際のルートを確認していない
  // 実際: /sessions（route group使用）
});

// 2. APIレスポンスを推測
const response = await fetch('/api/v1/users/profile');
expect(response.data.user.name).toBe('Test User');
// ❌ 実際のエンドポイント・レスポンス構造を確認していない
// 実際: /api/v1/auth/me, response.data.profile.fullName

// 3. データベーススキーマを推測
await prisma.user.create({
  data: { username: 'test' }  // ❌ username フィールドは存在しない
});
// 実際: fullName フィールド
```

### ✅ 正しい手順

```bash
# テスト作成前の必須手順（5 Steps）

# Step 1: 実装ファイルを見つける
find apps/web/app -name "page.tsx" | grep sessions
# 結果: apps/web/app/(dashboard)/sessions/page.tsx

# Step 2: ルート構造を理解
ls -la apps/web/app/
# (dashboard) = route group → URLに含まれない

# Step 3: 実装を読む
cat apps/web/app/(dashboard)/sessions/page.tsx

# Step 4: Lambdaレスポンスを確認（API テストの場合）
cat infrastructure/lambda/sessions/list/index.ts | grep -A 20 "statusCode: 200"

# Step 5: Prismaスキーマを確認（DB テストの場合）
cat packages/database/prisma/schema.prisma | grep -A 20 "model User"
```

### テスト作成前チェックリスト

**すべてに✅を付けてからテストを書く:**

- [ ] 実装ファイルを見つけた（find/ls コマンド実行済み）
- [ ] 実装コードを読んだ（推測していない）
- [ ] URL/エンドポイントパスを確認した
- [ ] リクエスト/レスポンス構造を確認した
- [ ] Route groups や dynamic segments を理解した
- [ ] データベーススキーマを確認した（該当する場合）
- [ ] 実際のフィールド名を使用している

**1つでもNOがあれば、テストを書かずに実装を確認する**

### 検証方法

```bash
# テスト実装検証（コミット前推奨）
pnpm run validate:tests

# 期待される結果:
# ✅ All test assumptions verified
# ⚠️  Test references non-existent route → 実装確認
```

**詳細:** [memory/feedback_test_implementation.md](memory/feedback_test_implementation.md)

---

## 🎯 Design Principles（設計原則 - 2026-04-02追加）

### 原則1: 依存関係の最小化（Minimize Dependencies）

**Why:** 依存関係は「負債」である
- セキュリティリスク（脆弱性）
- 保守コスト（バージョン更新）
- ビルド時間の増加
- バンドルサイズの増加

**How:**
- 新規依存追加前に「自前実装できないか」検討
- 大きなライブラリ（20+ 依存）は避ける
- ユーティリティライブラリは必要な関数のみコピー

**Automation:** `pnpm run validate:deps-size`

### 原則2: ワークスペース境界の明確化（Clear Workspace Boundaries）

**Why:** Monorepoでは境界が曖昧になりやすい

**How:**
- apps/web: フロントエンド専用
- infrastructure: バックエンド専用
- packages/shared: 型定義のみ（ロジックなし）

**Automation:** `pnpm run validate:monorepo`

### 原則3: 実装を見てからテスト（Implementation First, Then Test）

**Why:** 推測は必ず失敗する。コードが唯一の真実の源。

**How:**
1. find/grep でルート・エンドポイントを確認
2. 実装を読む
3. テストを書く

**Automation:** `pnpm run validate:tests`

### 原則4: 自動化への投資（Invest in Automation）

**Why:**
- 1時間の自動化スクリプトが100時間のデバッグを防ぐ
- 人間は繰り返し作業でミスをする
- 自動化は「再利用可能な知識」

**How:**
- 同じエラーが2回起きたら自動化を検討
- 検証スクリプトは200-300行が目安
- Pre-commit hookに統合

**Examples:**
- validate-workspace-dependencies.sh (236行) → 依存関係エラー防止
- validate-i18n-keys.js → 翻訳キー同期

**詳細:**
- [memory/feedback_dependency_management.md](memory/feedback_dependency_management.md)
- [memory/feedback_monorepo_rules.md](memory/feedback_monorepo_rules.md)
- [memory/feedback_test_implementation.md](memory/feedback_test_implementation.md)
- [memory/feedback_automation_investment.md](memory/feedback_automation_investment.md)

---

**最終更新:** 2026-04-02
**次回レビュー:** 2026-05-01
