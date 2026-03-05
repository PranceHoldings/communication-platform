import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/request';

export default createMiddleware({
  // サポートされるロケールのリスト
  locales,

  // デフォルトロケール
  defaultLocale,

  // ロケールプレフィックスの動作
  // 'always': 常にロケールプレフィックスを表示 (/ja/dashboard, /en/dashboard)
  // 'as-needed': デフォルトロケールはプレフィックスなし (/dashboard -> ja)
  localePrefix: 'always',
});

export const config = {
  // APIルート、静的ファイル、画像を除外
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
