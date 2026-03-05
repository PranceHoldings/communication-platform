import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

// サポートされるロケール
export const locales = ['ja', 'en'] as const;
export type Locale = (typeof locales)[number];

// デフォルトロケール
export const defaultLocale: Locale = 'ja';

export default getRequestConfig(async ({ locale }) => {
  // ロケールの検証
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
