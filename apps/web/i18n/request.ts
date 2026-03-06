/**
 * next-intl Request Configuration
 *
 * This configures next-intl to use our centralized i18n system.
 * All locale detection is handled by middleware.ts
 *
 * IMPORTANT: Do not hardcode locale values here.
 * Import from lib/i18n/config.ts instead.
 */

import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getMessages } from '@/lib/i18n/messages';
import {
  locales,
  defaultLocale,
  LOCALE_HEADER_NAME,
  isValidLocale,
  getLocaleWithFallback,
} from '@/lib/i18n/config';

// Re-export for backward compatibility
export { locales, defaultLocale };
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  // Get locale from requestLocale (new pattern in next-intl 3.22+)
  let locale = await requestLocale;

  // Fallback to header if requestLocale is not available
  if (!locale) {
    const headersList = await headers();
    locale = headersList.get(LOCALE_HEADER_NAME) || undefined;
  }

  // Get valid locale with fallback
  locale = getLocaleWithFallback(locale);

  // Validate locale (should always be valid after getLocaleWithFallback)
  if (!isValidLocale(locale)) {
    console.error(`[i18n] Invalid locale after fallback: ${locale}`);
    notFound();
  }

  return {
    locale,
    messages: getMessages(locale),
  };
});
