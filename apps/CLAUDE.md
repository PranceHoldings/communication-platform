# Prance Communication Platform - Frontend Development Guide

**親ドキュメント:** [../CLAUDE.md](../CLAUDE.md)
**関連ドキュメント:** [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md) | [../docs/CLAUDE.md](../docs/CLAUDE.md)

**バージョン:** 1.0
**最終更新:** 2026-03-15

---

## 📋 このディレクトリについて

`apps/` ディレクトリはフロントエンドアプリケーションを含みます：

- **apps/web/** - Next.js 15 メインアプリケーション（App Router）
- **apps/workers/** - Web Workers（音声処理等）

---

## 🔴 フロントエンド開発の絶対厳守ルール

### Rule 1: Next.js App Router構造準拠

**❌ 禁止事項:**
- URLパスを推測でテスト/実装すること
- Pages Router（pages/）の使用
- 認証が必要なページを `/dashboard/` 外に配置

**✅ 必須パターン:**

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
│   ├── avatars/page.tsx      # /dashboard/avatars
│   └── sessions/page.tsx     # /dashboard/sessions
└── api/                       # API Routes
    └── auth/[...nextauth]/route.ts
```

**ルート確認方法:**
```bash
# 実装されているページを確認
find apps/web/app -name "page.tsx" | grep -v node_modules

# 動的ルート確認
find apps/web/app -name "\[*\]" -type d
```

### Rule 2: 多言語対応システム統一

**🔴 最重要: 独自I18nProviderのみ使用、next-intlは使用禁止**

**✅ 正しい実装:**

```typescript
// ✅ 正しい
import { useI18n } from '@/lib/i18n/provider';

export function MyComponent() {
  const { t, locale } = useI18n();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('dashboard.description')}</p>
    </div>
  );
}
```

**❌ 間違った実装:**

```typescript
// ❌ next-intl使用禁止
import { useTranslations } from 'next-intl';           // 禁止
import { getTranslations } from 'next-intl/server';    // 禁止

// ❌ ハードコード禁止
<h1>Welcome to Dashboard</h1>  // 英語固定
<p>ダッシュボードへようこそ</p>  // 日本語固定
```

**言語リソース管理:**

```
apps/web/messages/
├── en/
│   ├── common.json
│   ├── dashboard.json
│   └── scenarios.json
├── ja/
│   ├── common.json
│   ├── dashboard.json
│   └── scenarios.json
└── [10言語対応]
```

**コミット前検証:**

```bash
# next-intl残骸検出（0件が正常）
grep -r "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules

# ハードコード文字列検出
grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components
```

> 詳細: `docs/07-development/I18N_SYSTEM_GUIDELINES.md`

### Rule 3: Cookie処理の統一化

**🔴 重要: Cookie設定を複数箇所で重複管理しない**

**✅ 正しい方法:**

```typescript
// apps/web/lib/cookies.ts - 統一ユーティリティ
import { COOKIE_CONFIGS, setLocaleCookie } from '@/lib/cookies';

// クライアントサイド
setLocaleCookie('en');

// サーバーサイド (middleware)
response.cookies.set(
  LOCALE_COOKIE_NAME,
  locale,
  COOKIE_CONFIGS.locale.options
);
```

**❌ 禁止事項:**

```typescript
// ❌ 直接document.cookie操作
document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;

// ❌ ハードコードされたオプション
response.cookies.set('NEXT_LOCALE', locale, {
  path: '/',
  maxAge: 31536000,  // ハードコード
  sameSite: 'lax',   // ハードコード
});
```

### Rule 4: 共有型定義の使用

**🔴 重要: 型の重複定義禁止**

**✅ 正しい方法:**

```typescript
// packages/shared からimport
import type {
  User,
  Avatar,
  Scenario,
  Session,
  Visibility,
  PaginationMeta
} from '@prance/shared';

interface AvatarListResponse {
  avatars: Avatar[];           // 共有型使用
  pagination: PaginationMeta;  // 共有型使用
}
```

**❌ 禁止事項:**

```typescript
// ❌ 型の重複定義
interface Avatar {
  id: string;
  name: string;
  type: 'TWO_D' | 'THREE_D';  // 共有型があるのに再定義
}

// ❌ インライン型定義
type Visibility = 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';  // 再定義
```

**検証方法:**

```bash
# 型の重複定義検出
grep -rn "^export interface User\|Avatar\|Scenario" apps/web --include="*.ts" | grep -v node_modules

# インライン型定義検出
grep -rn "'PRIVATE'.*|.*'PUBLIC'" apps/web/lib --include="*.ts" | grep -v "from '@prance/shared'"
```

---

## 🏗️ Next.js 15 開発ガイドライン

### ディレクトリ構造

```
apps/web/
├── app/                       # App Router
│   ├── layout.tsx            # ルートレイアウト
│   ├── page.tsx              # ホームページ
│   ├── (auth)/               # 認証不要グループ
│   ├── dashboard/            # 認証必要
│   └── api/                  # API Routes
├── components/               # 再利用可能コンポーネント
│   ├── ui/                   # shadcn/ui コンポーネント
│   ├── avatar-selector/      # 機能別コンポーネント
│   ├── scenario-editor/
│   └── session-player/
├── lib/                      # ユーティリティ・設定
│   ├── api/                  # API クライアント
│   ├── i18n/                 # 多言語対応
│   ├── hooks/                # カスタムフック
│   └── utils/                # ヘルパー関数
├── messages/                 # 言語リソース（10言語）
├── public/                   # 静的アセット
└── styles/                   # グローバルスタイル
```

### コンポーネント設計原則

**1. Server Components優先**

```typescript
// ✅ デフォルトでServer Component
export default async function ScenarioListPage() {
  const scenarios = await getScenarios(); // サーバー側で取得

  return <ScenarioList scenarios={scenarios} />;
}
```

**2. Client Componentは明示的に**

```typescript
'use client';  // ✅ 明示的に指定

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**3. コンポーネント分割**

```typescript
// ✅ 小さく・再利用可能に
export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <Card>
      <ScenarioCardHeader scenario={scenario} />
      <ScenarioCardBody scenario={scenario} />
      <ScenarioCardActions scenario={scenario} />
    </Card>
  );
}
```

### API統合

**APIクライアント使用:**

```typescript
// apps/web/lib/api/scenarios.ts
import { apiClient } from './client';
import type { Scenario, PaginatedResponse } from '@prance/shared';

export async function getScenarios(params?: PaginationParams): Promise<PaginatedResponse<Scenario>> {
  return apiClient.get('/scenarios', { params });
}

export async function getScenario(id: string): Promise<Scenario> {
  return apiClient.get(`/scenarios/${id}`);
}

export async function updateScenario(id: string, data: Partial<Scenario>): Promise<Scenario> {
  return apiClient.put(`/scenarios/${id}`, data);
}
```

**コンポーネントでの使用:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getScenarios } from '@/lib/api/scenarios';
import type { Scenario } from '@prance/shared';

export function ScenarioList() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    getScenarios().then(res => setScenarios(res.data));
  }, []);

  return (
    <div>
      {scenarios.map(scenario => (
        <ScenarioCard key={scenario.id} scenario={scenario} />
      ))}
    </div>
  );
}
```

---

## 🎨 UI/UXガイドライン

### shadcn/ui使用

```typescript
// ✅ shadcn/uiコンポーネント使用
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function MyForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder={t('form.name')} />
        <Button>{t('form.submit')}</Button>
      </CardContent>
    </Card>
  );
}
```

### Tailwind CSS規則

```typescript
// ✅ Tailwindクラス使用
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
    {t('title')}
  </h2>
</div>

// ❌ インラインスタイル禁止（特別な理由がない限り）
<div style={{ display: 'flex', padding: '16px' }}>  // 避ける
```

---

## 💎 コード品質原則

### 1. 型安全性

**✅ TypeScript厳密モード使用**

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**✅ 型推論の活用**

```typescript
// ✅ 正しい - 型推論
const scenarios = await getScenarios();  // PaginatedResponse<Scenario>型が推論される

// ❌ 冗長 - 不要な型注釈
const scenarios: PaginatedResponse<Scenario> = await getScenarios();
```

### 2. テスト

**単体テスト (Jest):**

```typescript
// components/__tests__/ScenarioCard.test.tsx
import { render, screen } from '@testing-library/react';
import { ScenarioCard } from '../ScenarioCard';

describe('ScenarioCard', () => {
  it('renders scenario title', () => {
    const scenario = { id: '1', title: 'Test Scenario' };
    render(<ScenarioCard scenario={scenario} />);
    expect(screen.getByText('Test Scenario')).toBeInTheDocument();
  });
});
```

**E2Eテスト (Playwright):**

```typescript
// e2e/scenarios.spec.ts
import { test, expect } from '@playwright/test';

test('scenario list page', async ({ page }) => {
  await page.goto('/dashboard/scenarios');
  await expect(page.locator('h1')).toContainText('Scenarios');
  await expect(page.locator('[data-testid="scenario-card"]')).toHaveCount(3);
});
```

### 3. Linting & Formatting

**ESLint設定:**

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

**Prettier設定:**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 4. セキュリティ

**OWASP Top 10対策:**

```typescript
// ✅ XSS対策 - DOMPurifyでサニタイズ
import DOMPurify from 'dompurify';

export function SafeHTML({ html }: { html: string }) {
  const sanitizedHTML = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
}

// ✅ CSRF対策 - Next.js API Routesで自動的に保護
// ✅ SQL Injection対策 - Prisma ORMが自動的に保護
```

**入力バリデーション:**

```typescript
import { z } from 'zod';

const scenarioSchema = z.object({
  title: z.string().min(1).max(200),
  language: z.enum(['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it']),
  description: z.string().max(1000).optional(),
});

export function validateScenario(data: unknown) {
  return scenarioSchema.parse(data);
}
```

---

## 🧪 テスト

### E2Eテスト (Playwright)

**テストファイル:**

```typescript
// apps/web/e2e/scenarios.spec.ts
import { test, expect } from '@playwright/test';

test('scenario list page', async ({ page }) => {
  // ✅ 実装から取得した正しいパス
  await page.goto('/dashboard/scenarios');

  await expect(page.locator('h1')).toContainText('Scenarios');
  await expect(page.locator('[data-testid="scenario-card"]')).toHaveCount(3);
});
```

**実行:**

```bash
# E2Eテスト実行
npm run test:e2e

# 特定ファイルのみ
npm run test:e2e -- scenarios.spec.ts

# ヘッドレスモードで実行
npm run test:e2e:headless
```

---

## 📦 ビルド・デプロイ

### ローカル開発

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番モードで起動
npm run start
```

### 環境変数

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=https://api.prance.dev
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d3mx0sug5s3a6x.cloudfront.net
```

---

## 🔍 コミット前チェックリスト

### 必須検証コマンド

```bash
# 1. next-intl残骸検出
grep -r "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules

# 2. ハードコード文字列検出
grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components

# 3. placeholder属性チェック
grep -rn 'placeholder=["'"'"'][A-Z]' apps/web

# 4. title属性チェック
grep -rn 'title=["'"'"'][A-Z]' apps/web

# 5. 型の重複定義検出
grep -rn "^export interface User\|Avatar\|Scenario" apps/web --include="*.ts" | grep -v node_modules

# 6. Lint + Type Check
npm run lint
npm run type-check

# 7. E2Eテスト
npm run test:e2e
```

### 検証基準

- ✅ 全てのマッチが `{t('...')}` で囲まれている
- ✅ 新しい言語キーが `messages/en/` と `messages/ja/` 両方に追加されている
- ✅ `useI18n` フックがコンポーネントでインポート・使用されている
- ✅ 型定義は `@prance/shared` から import
- ✅ Lintエラーなし
- ✅ 型エラーなし
- ✅ E2Eテストが全て通過

---

## 📚 関連ドキュメント

- [多言語対応システム](../docs/07-development/I18N_SYSTEM_GUIDELINES.md)
- [UI設定項目同期ルール](../docs/07-development/UI_SETTINGS_DATABASE_SYNC_RULES.md)
- [コード整合性ガイドライン](../docs/04-design/CONSISTENCY_GUIDELINES.md)
- [技術スタック詳細](../docs/10-reference/TECH_STACK.md)

---

**最終更新:** 2026-03-15
**次回レビュー:** E2Eテスト完了時
