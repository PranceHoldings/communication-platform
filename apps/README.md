# Prance Platform - Frontend Application (Next.js 15)

**親ドキュメント:** [../CLAUDE.md](../CLAUDE.md)
**関連ドキュメント:** [../infrastructure/CLAUDE.md](../infrastructure/CLAUDE.md) | [CLAUDE.md](CLAUDE.md)

**最終更新:** 2026-03-20
**バージョン:** 1.0.0

---

## 📋 概要

このディレクトリには、Pranceプラットフォームのフロントエンドアプリケーション（Next.js 15）が含まれています。

```
apps/
└── web/                        # Next.js 15 App Router
    ├── app/                    # App Router (pages)
    │   ├── (auth)/            # 認証不要ページグループ
    │   ├── dashboard/         # 認証必要ページ（/dashboard/*）
    │   └── api/               # API Routes
    ├── components/            # Reactコンポーネント
    ├── hooks/                 # カスタムフック
    ├── lib/                   # ユーティリティ・設定
    ├── messages/              # 多言語対応リソース
    ├── public/                # 静的ファイル
    └── tests/                 # E2Eテスト
        └── e2e/               # Playwright E2Eテスト
```

---

## 🔴 フロントエンド開発の絶対厳守ルール

### Rule 1: Next.js App Router構造準拠

**🔴 重要: URLパスを推測せず、必ず実装を確認してからテスト・コード作成**

```bash
# 実装されているページを確認
find apps/web/app -name "page.tsx" | grep -v node_modules

# 期待される結果から実際のURLパスを把握
# 例: apps/web/app/dashboard/scenarios/page.tsx → /dashboard/scenarios
```

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
│   ├── avatars/page.tsx      # /dashboard/avatars
│   └── sessions/page.tsx     # /dashboard/sessions
└── api/                       # API Routes
```

**チェックリスト:**

- [ ] 認証必要なページは `/dashboard/` 配下に配置されているか？
- [ ] `/login`, `/register` は `(auth)/` グループ内か？
- [ ] 動的ルートは `[id]/page.tsx` 形式か？
- [ ] テストパスは実装から取得したか？（推測ではない）

> 詳細: [CLAUDE.md - Rule 1](CLAUDE.md)

### Rule 2: 多言語対応システム統一

**🔴 最重要: 独自I18nProviderのみ使用、next-intl は使用禁止**

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

**検証方法:**

```bash
# next-intl インポート検出（0件が正常）
grep -r "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules

# 期待結果: 何も表示されない（0件）
```

> 詳細: [../docs/07-development/I18N_SYSTEM_GUIDELINES.md](../docs/07-development/I18N_SYSTEM_GUIDELINES.md)

### Rule 3: UI文字列のハードコード禁止

**すべての表示文字列は多言語対応リソースから取得すること**

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

**検証方法:**

```bash
# ハードコード文字列検出
grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components

# placeholder/title属性チェック
grep -rn 'placeholder=["'"'"'][A-Z]' apps/web
grep -rn 'title=["'"'"'][A-Z]' apps/web
```

**期待結果:** すべて `{t('...')}` で囲まれている

> 詳細: [../CODING_RULES.md - UI文字列ハードコード](../CODING_RULES.md)

### Rule 4: Cookie処理の統一

**Cookie設定は統一ユーティリティ（`lib/cookies.ts`）を使用**

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

## 🏗️ プロジェクト構造

### App Router（pages）

```
app/
├── layout.tsx                 # ルートレイアウト
├── page.tsx                   # ホームページ（/）
├── (auth)/                    # 認証不要ページグループ
│   ├── layout.tsx            # 認証グループレイアウト
│   ├── login/page.tsx        # ログインページ
│   └── register/page.tsx     # ユーザー登録ページ
├── dashboard/                 # 認証必要ページ
│   ├── layout.tsx            # ダッシュボードレイアウト
│   ├── scenarios/            # シナリオ管理
│   ├── avatars/              # アバター管理
│   ├── sessions/             # セッション管理
│   └── settings/             # 設定
└── api/                       # API Routes（Next.js API）
```

### Components

```
components/
├── ui/                        # shadcn/ui コンポーネント
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── scenarios/                 # シナリオ関連コンポーネント
├── avatars/                   # アバター関連コンポーネント
├── sessions/                  # セッション関連コンポーネント
└── shared/                    # 共有コンポーネント
```

### Hooks

```
hooks/
├── useI18n.ts                 # 多言語対応フック
├── useAuth.ts                 # 認証フック
├── useWebSocket.ts            # WebSocket接続フック
└── useMediaRecorder.ts        # メディア録画フック
```

### Lib（ユーティリティ・設定）

```
lib/
├── i18n/                      # 多言語対応システム
│   ├── provider.tsx          # 独自I18nProvider
│   └── config.ts             # 言語設定
├── cookies.ts                 # Cookie統一ユーティリティ
├── api.ts                     # APIクライアント
└── utils.ts                   # 汎用ユーティリティ
```

### Messages（多言語対応リソース）

```
messages/
├── en/                        # 英語
│   ├── common.json
│   ├── auth.json
│   └── dashboard.json
├── ja/                        # 日本語
├── zh-CN/                     # 簡体字中国語
├── zh-TW/                     # 繁体字中国語
└── ... (全10言語)
```

---

## 🚀 開発ワークフロー

### セットアップ

```bash
# プロジェクトルートから
npm install

# 開発サーバー起動
npm run dev

# ブラウザでアクセス
# http://localhost:3000
```

### ビルド・テスト

```bash
# TypeScriptビルド
npm run build

# Linting
npm run lint

# 型チェック
npm run typecheck

# E2Eテスト
npm run test:e2e
```

---

## 🧪 E2Eテスト（Playwright）

### テスト構造

```
tests/e2e/
├── README.md                  # テストガイド
├── fixtures/                  # テストフィクスチャ
├── page-objects/              # Page Object Model
├── stage0-1/                  # UI Component Tests
├── stage2/                    # Integration Tests (Mock)
└── stage3-5/                  # System E2E Tests（全スタック）
```

### テスト実行

```bash
# 全テスト実行
npm run test:e2e

# 特定Stage実行
npm run test:e2e:stage0
npm run test:e2e:stage1
npm run test:e2e:stage2

# ヘッドレスモード
npm run test:e2e:headless

# UIモード（デバッグ用）
npm run test:e2e:ui
```

**テスト結果（2026-03-20）:**
- Stage 0-5: 100% (35/35) 成功 ✅

> 詳細: [tests/e2e/README.md](web/tests/e2e/README.md)

---

## 🌍 多言語対応システム

### 対応言語（10言語）

- 🇬🇧 English (en)
- 🇯🇵 日本語 (ja)
- 🇨🇳 简体中文 (zh-CN)
- 🇹🇼 繁體中文 (zh-TW)
- 🇰🇷 한국어 (ko)
- 🇪🇸 Español (es)
- 🇵🇹 Português (pt)
- 🇫🇷 Français (fr)
- 🇩🇪 Deutsch (de)
- 🇮🇹 Italiano (it)

### 翻訳リソース管理

```bash
# 言語リスト同期検証
npm run validate:languages

# 期待結果: "All language lists are synchronized"
```

**同期必須の3箇所:**

1. `apps/web/lib/i18n/config.ts` - `locales` 配列
2. `infrastructure/lambda/shared/config/language-config.ts` - `LANGUAGES` 配列
3. `apps/web/messages/{languageCode}/` ディレクトリ

> 詳細: [../docs/05-modules/MULTILINGUAL_SYSTEM.md](../docs/05-modules/MULTILINGUAL_SYSTEM.md)

---

## 🎨 UIコンポーネント（shadcn/ui）

### 使用方法

```bash
# 新しいコンポーネント追加
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
```

### カスタマイズ

```
components/ui/
├── button.tsx                 # Buttonコンポーネント
├── card.tsx                   # Cardコンポーネント
└── ...

# Tailwind CSSでカスタマイズ可能
```

---

## 📚 関連ドキュメント

- **[../CLAUDE.md](../CLAUDE.md)** - プロジェクト全体概要
- **[CLAUDE.md](CLAUDE.md)** - フロントエンド開発ガイド（詳細版）
- **[../CODING_RULES.md](../CODING_RULES.md)** - コーディング規約
- **[../docs/05-modules/MULTILINGUAL_SYSTEM.md](../docs/05-modules/MULTILINGUAL_SYSTEM.md)** - 多言語対応システム詳細
- **[tests/e2e/README.md](web/tests/e2e/README.md)** - E2Eテストガイド

---

**最終更新**: 2026-03-20
**バージョン**: 1.0.0
**ステータス**: Production稼働中
