# ステアリングドキュメント: 多言語対応実装

**日付:** 2026-03-05
**作業者:** Claude Sonnet 4.5
**ステータス:** 完了
**タグ:** Phase 1, Multilingual, Next.js, Middleware

---

## 📋 作業概要

Phase 1の一環として、Pranceプラットフォームの多言語対応システムの基盤を実装しました。Cookie-based言語管理、URLパラメータによる言語切り替え、Accept-Languageヘッダーからの自動検出機能を実装しました。

## 🎯 作業目標

1. ✅ Next.js Middlewareで言語検出システムを実装
2. ✅ Cookie-based言語管理（ロケールプレフィックスなしURL設計）
3. ✅ URLパラメータ `?lang=` による言語切り替え
4. ✅ Accept-Languageヘッダーからの自動検出
5. ✅ RootLayoutでHTMLのlang属性を動的に設定
6. ✅ ドキュメント更新

## 📝 実装内容

### 1. Next.js Middleware実装

**ファイル:** `apps/web/middleware.ts`

**機能:**
- Cookie `NEXT_LOCALE` による言語管理
- URLパラメータ `?lang=` による言語切り替え
- Accept-Languageヘッダーからの自動検出
- デフォルト言語へのフォールバック

**言語検出の優先順位:**
```
1. URL parameter (?lang=en, ?lang=ja, etc.)
   → Cookieに保存 + パラメータ削除してリダイレクト
2. Cookie (NEXT_LOCALE)
3. Accept-Language ヘッダー
4. デフォルト言語 (en)
```

**主要実装コード:**
```typescript
/**
 * Prance Platform - Language Detection Middleware
 *
 * Cookie-based language detection without locale prefixes in URLs.
 *
 * Language detection priority:
 * 1. URL parameter (lang=en, lang=ja, etc.) - Sets cookie and redirects
 * 2. Cookie (NEXT_LOCALE)
 * 3. Accept-Language header (browser settings)
 * 4. Default language (en)
 */

import { NextRequest, NextResponse } from 'next/server';

const supportedLocales = ['en', 'ja', 'zh-CN', 'ko', 'es', 'fr', 'de'];
const defaultLocale = 'en';

function detectLanguageFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage.split(',').map((lang) => {
    const [code, qValue] = lang.trim().split(';q=');
    const baseCode = code.split('-')[0].toLowerCase();
    return { code: baseCode, q: qValue ? parseFloat(qValue) : 1.0 };
  });

  languages.sort((a, b) => b.q - a.q);

  for (const lang of languages) {
    if (supportedLocales.includes(lang.code)) {
      return lang.code;
    }
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);
  const langParam = searchParams.get('lang');

  // 1. Check URL parameter 'lang' (highest priority)
  if (langParam && supportedLocales.includes(langParam)) {
    searchParams.delete('lang');
    const cleanUrl = new URL(pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ''), request.url);

    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set('NEXT_LOCALE', langParam, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  }

  // 2. Get language from Cookie
  let locale = request.cookies.get('NEXT_LOCALE')?.value;

  // 3. If no Cookie or unsupported locale, detect from Accept-Language header
  if (!locale || !supportedLocales.includes(locale)) {
    const acceptLanguage = request.headers.get('accept-language');
    locale = detectLanguageFromHeader(acceptLanguage);
  }

  // 4. Add language to request headers (for use in components)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 5. Save language to Cookie (for first-time visitors)
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

**設計判断:**

1. **ロケールプレフィックスなし**
   - 理由: URLの共有が容易、SEO最適化、シンプルなルーティング
   - 採用: `/dashboard` (全言語共通)
   - 不採用: `/en/dashboard`, `/ja/dashboard`

2. **Cookie-based言語管理**
   - 理由: ユーザーの言語選択を永続化、サーバーサイドで言語判定可能
   - Cookie名: `NEXT_LOCALE`
   - 有効期限: 1年

3. **URLパラメータによる明示的切り替え**
   - 理由: 外部リンクからの言語指定、マーケティングキャンペーン対応
   - 実装: `/?lang=en` でアクセス → Cookie設定 + パラメータ削除してリダイレクト
   - メリット: URLがクリーンになる、SEO最適化

4. **Accept-Languageヘッダー検出**
   - 理由: 初回アクセス時にユーザーのブラウザ設定を尊重
   - 実装: 品質値（q値）で優先順位をソート、サポート言語の中から選択

### 2. RootLayout動的lang属性

**ファイル:** `apps/web/app/layout.tsx`

**変更内容:**
```typescript
// Before (ハードコード)
<html lang="ja" suppressHydrationWarning>

// After (動的)
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const locale = headersList.get('x-locale') || 'en';

  return (
    <html lang={locale} suppressHydrationWarning>
      ...
    </html>
  );
}
```

**効果:**
- HTMLのlang属性がユーザーの選択した言語に動的に変わる
- SEO最適化（検索エンジンがページの言語を正しく認識）
- アクセシビリティ向上（スクリーンリーダーが正しい言語で読み上げ）

### 3. サポート言語

現在サポートされている言語（`supportedLocales`配列で定義）:
- 🇺🇸 英語（en）- デフォルト
- 🇯🇵 日本語（ja）
- 🇨🇳 中国語簡体字（zh-CN）
- 🇰🇷 韓国語（ko）
- 🇪🇸 スペイン語（es）
- 🇫🇷 フランス語（fr）
- 🇩🇪 ドイツ語（de）

**拡張方法:**
新しい言語を追加する場合、`supportedLocales`配列に言語コードを追加するだけ。
```typescript
const supportedLocales = ['en', 'ja', 'zh-CN', 'ko', 'es', 'fr', 'de', 'pt', 'it'];
```

## ✅ テスト結果

### 1. URLパラメータによる言語切り替え

```bash
# 英語に切り替え
$ curl -I 'http://localhost:3001/?lang=en'
HTTP/1.1 307 Temporary Redirect
Location: /
Set-Cookie: NEXT_LOCALE=en; Max-Age=31536000; Path=/; SameSite=Lax

# 日本語に切り替え
$ curl -I 'http://localhost:3001/?lang=ja'
HTTP/1.1 307 Temporary Redirect
Location: /
Set-Cookie: NEXT_LOCALE=ja; Max-Age=31536000; Path=/; SameSite=Lax

# 中国語に切り替え
$ curl -I 'http://localhost:3001/?lang=zh-CN'
HTTP/1.1 307 Temporary Redirect
Location: /
Set-Cookie: NEXT_LOCALE=zh-CN; Max-Age=31536000; Path=/; SameSite=Lax
```

✅ **結果:** URLパラメータを検出し、Cookieに保存してリダイレクト成功

### 2. Cookie保持による自動切り替え

```bash
# 1回目: /?lang=en でアクセス → Cookie設定
$ curl 'http://localhost:3001/?lang=en' -c /tmp/cookies.txt -L | grep '<html'
<html lang="en">

# 2回目: Cookie保持したままアクセス → 自動的に英語で表示
$ curl 'http://localhost:3001/' -b /tmp/cookies.txt | grep '<html'
<html lang="en">
```

✅ **結果:** Cookieが正しく保存され、次回アクセス時に自動的に適用される

### 3. Accept-Languageヘッダー検出

```bash
# 日本語ブラウザ
$ curl -H 'Accept-Language: ja,en;q=0.9' 'http://localhost:3001/' | grep '<html'
<html lang="ja">

# フランス語ブラウザ
$ curl -H 'Accept-Language: fr,en;q=0.9' 'http://localhost:3001/' | grep '<html'
<html lang="fr">

# サポートされていない言語（ヒンディー語）→ デフォルト（英語）
$ curl -H 'Accept-Language: hi,en;q=0.9' 'http://localhost:3001/' | grep '<html'
<html lang="en">
```

✅ **結果:** ブラウザ設定から言語を正しく検出し、サポート外言語はデフォルトにフォールバック

### 4. 無効な言語パラメータの処理

```bash
$ curl -I 'http://localhost:3001/?lang=invalid'
HTTP/1.1 200 OK
(パラメータ無視、デフォルトまたはCookieの言語を使用)
```

✅ **結果:** 無効な言語コードは無視され、正常にフォールバック

## 📚 更新されたドキュメント

### 1. CLAUDE.md

**セクション:** 「4. 開発ガイドライン - 多言語対応」

**追加内容:**
- URL設計の明確化（ロケールプレフィックスなし）
- 言語検出の優先順位
- 言語切り替えフロー
- リソース管理方針（ホットデプロイ、集中管理）
- Cookie仕様

### 2. docs/modules/MULTILINGUAL_SYSTEM.md

**バージョン:** 2.0 → 2.1

**追加セクション:** 「実装状況（Phase 1）」

**内容:**
- middleware.tsの実装詳細
- layout.tsxの動的lang属性
- テスト結果
- 未実装機能のリスト（Phase 2予定）

### 3. SESSION_PROGRESS.md

**追加セクション:** 「Phase 1開始: 多言語対応実装（2026-03-05）」

**内容:**
- 実装完了した機能の詳細
- 更新されたドキュメントのリスト
- 次のステップ（未実装機能）
- 技術的メモ

## 🚧 未実装機能（Phase 2）

現在、言語検出とCookie管理は完了していますが、実際のテキスト翻訳はまだ実装されていません。

### 必要な実装:

1. **I18nプロバイダー実装**
   - `lib/i18n/provider.tsx` - I18nContext、useI18n() フック
   - `lib/i18n/fallback.ts` - フォールバック機構、未翻訳キーのログ記録
   - `lib/i18n/loader.ts` - 言語リソースファイルの読み込み

2. **言語リソースファイル作成**
   - `messages/en/common.json` - 共通UI要素（ボタン、ラベル）
   - `messages/en/auth.json` - 認証関連（ログイン、登録）
   - `messages/en/dashboard.json` - ダッシュボード
   - `messages/ja/` - 日本語リソース
   - その他の言語も同様

3. **LanguageSwitcherコンポーネント**
   - `components/LanguageSwitcher.tsx`
   - ヘッダーに配置するドロップダウンUI
   - フラグアイコン表示
   - 選択時にCookie更新 + ページリロード

4. **既存ページの多言語化**
   - `/login` - ハードコードされたテキストをI18nキーに置き換え
   - `/register` - 同上
   - `/dashboard` - 同上
   - すべてのUIテキストを翻訳可能にする

5. **ホットデプロイシステム（Phase 2以降）**
   - Lambda: Language Resource Manager
   - S3バケット: `prance-language-resources`
   - CloudFront CDN設定
   - スーパー管理者UI: `/admin/languages`

## 💡 技術的な学び

### 1. Next.js 15 Middleware

**Server Componentsとの連携:**
- Middlewareで設定したHTTPヘッダー `x-locale` を `headers()` 関数で取得
- Server Componentで `await headers()` を使用してヘッダーを読み取り
- RootLayoutが`async`関数になることで、動的にlang属性を設定可能

**Cookieの設定:**
- `response.cookies.set()` でCookieを設定
- `request.cookies.get()` でCookieを取得
- `httpOnly: false` でJavaScriptからのアクセスを許可（言語切り替えUI用）

**Redirectの処理:**
- `NextResponse.redirect()` でリダイレクト
- 307 Temporary Redirect（元のHTTPメソッドを保持）
- Cookieを設定してからリダイレクトすることで、リダイレクト先で即座にCookieが利用可能

### 2. Accept-Language解析

**品質値（q値）の処理:**
```
Accept-Language: ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7
```
- デフォルトq値は1.0
- q値で降順ソート
- サポート言語の中から最優先を選択
- 言語コードの正規化（`ja-JP` → `ja`）

### 3. Matcher設定の重要性

```typescript
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- APIルートを除外しないと、Lambda関数への通信も言語検出対象になる
- `_next`（Next.js内部ファイル）を除外してパフォーマンス最適化
- 静的ファイル（画像、CSS等）を除外

## ⚠️ 注意事項

### 1. セキュリティ

**httpOnly: false の理由:**
- LanguageSwitcherコンポーネントからCookieを読み書きするため
- 言語設定はセンシティブ情報ではないため、XSSリスクは低い
- 認証トークンなどの重要情報は別のhttpOnly=trueのCookieで管理

**SameSite: Lax の理由:**
- CSRF攻撃対策
- 外部サイトからのGETリクエストでもCookieが送信される（言語設定の共有に有用）

### 2. パフォーマンス

**Middlewareの実行頻度:**
- すべてのページリクエストで実行される
- 処理は軽量（Cookie読み取り、ヘッダー解析のみ）
- Edge Runtimeで高速実行

**Cookieのキャッシュ:**
- 1年間有効（`maxAge: 31536000`）
- ブラウザ側でキャッシュされるため、サーバーへの負荷は最小限

### 3. SEO

**HTMLのlang属性:**
- 検索エンジンがページの言語を正しく認識
- 多言語サイトでのランキング向上
- Google Search Consoleでの言語別分析が可能

**canonical URL:**
- 全言語で同一URL → canonical URLが自然に設定される
- 重複コンテンツとして扱われない

## 📊 開発統計

**実装時間:** 約2時間

**変更されたファイル:**
- `apps/web/middleware.ts` (新規作成, 101行)
- `apps/web/app/layout.tsx` (更新, +3行)
- `docs/modules/MULTILINGUAL_SYSTEM.md` (更新, +170行)
- `CLAUDE.md` (更新, +60行)
- `SESSION_PROGRESS.md` (更新, +200行)

**テストケース:** 4種類
- URLパラメータ切り替え
- Cookie保持
- Accept-Language検出
- 無効なパラメータ処理

**サポート言語:** 7言語

## 🎯 次回セッションの推奨タスク

### Priority 1: I18nプロバイダー実装

**目標:** 実際にテキストを翻訳表示できるようにする

**タスク:**
1. `lib/i18n/provider.tsx` 作成
2. `messages/en/common.json` 作成（共通UI要素）
3. `messages/ja/common.json` 作成（日本語翻訳）
4. `app/layout.tsx` でI18nProviderを追加
5. `/login` ページを多言語化

**期待成果:**
- ログインページが英語/日本語で表示される
- 言語切り替えが実際に動作する

### Priority 2: LanguageSwitcher実装

**目標:** ユーザーがヘッダーから言語を切り替えられるようにする

**タスク:**
1. `components/LanguageSwitcher.tsx` 作成
2. ヘッダーコンポーネントに統合
3. スタイリング（shadcn/ui使用）
4. 言語変更時のUX改善（ローディング表示）

**期待成果:**
- ヘッダーに言語選択ドロップダウンが表示される
- 選択した言語で即座にページが再読み込みされる

## ✨ まとめ

Phase 1の多言語対応実装の基盤が完成しました。Cookie-based言語管理、URLパラメータによる明示的な言語切り替え、Accept-Languageヘッダーからの自動検出が正しく動作しています。

**達成したこと:**
- ✅ 言語検出システムの実装（4段階の優先順位）
- ✅ Cookie-based言語管理（1年間保持）
- ✅ URLパラメータによる言語切り替え（クリーンURL）
- ✅ Accept-Languageヘッダーからの自動検出
- ✅ HTMLのlang属性を動的に設定（SEO・アクセシビリティ）
- ✅ 包括的なドキュメント化

**次のステップ:**
- I18nプロバイダー実装
- 言語リソースファイル作成
- LanguageSwitcherコンポーネント実装
- 既存ページの多言語化

この実装により、Pranceプラットフォームは世界中のユーザーに対応できる基盤が整いました。

---

**最終更新:** 2026-03-05
**レビュー:** 完了
**次回アクション:** I18nプロバイダー実装
