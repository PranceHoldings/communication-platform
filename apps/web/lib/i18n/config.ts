/**
 * Internationalization Configuration - Single Source of Truth
 *
 * IMPORTANT: This is the ONLY place to manage language settings.
 * All other files MUST import from this file.
 *
 * To add a new language:
 * 1. Create directory: apps/web/messages/[locale-code]/
 * 2. Add translation files: common.json, auth.json, etc.
 * 3. Import and register in lib/i18n/messages.ts
 * 4. The locale will be automatically available
 *
 * Language detection priority:
 * 1. URL parameter (?lang=en)
 * 2. Cookie (NEXT_LOCALE)
 * 3. Browser Accept-Language header
 * 4. Default locale (first in list, 'en' by convention)
 *
 * Fallback strategy:
 * - If translation key is missing → fallback to English
 * - If locale is not supported → fallback to default locale
 */

/**
 * Available locales
 *
 * This list is derived from message file imports in lib/i18n/messages.ts
 * To add a new language, add message files and import them in messages.ts
 *
 * Convention: English ('en') should always be first as the fallback locale
 */
export const locales = ['en', 'ja'] as const;

/**
 * Default locale - First available locale
 * Convention: English is the default for international accessibility
 */
export const defaultLocale = locales[0];

/**
 * Fallback locale for missing translations
 * Always English by convention
 */
export const fallbackLocale = 'en';

/**
 * Cookie name for storing user's language preference
 * This is a constant and should not be changed without migration
 */
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * HTTP header name for locale (used by next-intl)
 */
export const LOCALE_HEADER_NAME = 'X-NEXT-INTL-LOCALE';

/**
 * URL parameter name for language switching
 */
export const LOCALE_URL_PARAM = 'lang';

/**
 * Validate if a locale is supported
 */
export function isValidLocale(locale: string | null | undefined): boolean {
  if (!locale) return false;
  return locales.includes(locale as typeof locales[number]);
}

/**
 * Get locale with fallback
 * If the provided locale is not supported, return default locale
 */
export function getLocaleWithFallback(locale: string | null | undefined): string {
  if (locale && isValidLocale(locale)) {
    return locale;
  }
  return defaultLocale;
}

// Type for TypeScript
export type Locale = (typeof locales)[number];

// Log configuration on startup (development only)
if (process.env.NODE_ENV === 'development') {
  console.log('[i18n] Available locales:', locales);
  console.log('[i18n] Default locale:', defaultLocale);
  console.log('[i18n] Fallback locale:', fallbackLocale);
}
