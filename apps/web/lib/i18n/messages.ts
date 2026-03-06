/**
 * Message File Aggregator
 *
 * IMPORTANT: When adding a new language:
 * 1. Create message files in apps/web/messages/[locale]/
 * 2. Import them here following the same structure
 * 3. Add to the messages object
 * 4. Update lib/i18n/config.ts locales array if needed
 *
 * This file acts as the central point for all translations.
 */

import { fallbackLocale } from '@/lib/i18n/config';

// Import English (fallback locale)
import commonEn from '@/messages/en/common.json';
import homeEn from '@/messages/en/home.json';
import authEn from '@/messages/en/auth.json';
import dashboardEn from '@/messages/en/dashboard.json';
import sessionsEn from '@/messages/en/sessions.json';
import scenariosEn from '@/messages/en/scenarios.json';
import avatarsEn from '@/messages/en/avatars.json';

// Import Japanese
import commonJa from '@/messages/ja/common.json';
import homeJa from '@/messages/ja/home.json';
import authJa from '@/messages/ja/auth.json';
import dashboardJa from '@/messages/ja/dashboard.json';
import sessionsJa from '@/messages/ja/sessions.json';
import scenariosJa from '@/messages/ja/scenarios.json';
import avatarsJa from '@/messages/ja/avatars.json';

// Add more languages here by importing and adding to messages object
// Example for Spanish:
// import commonEs from '@/messages/es/common.json';
// ...

const messages: Record<string, Record<string, any>> = {
  en: {
    ...commonEn,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
  },
  ja: {
    ...commonJa,
    ...homeJa,
    ...authJa,
    ...dashboardJa,
    sessions: sessionsJa,
    scenarios: scenariosJa,
    avatars: avatarsJa,
  },
  // Add more languages here:
  // es: { ...commonEs, ... },
};

/**
 * Get messages for a locale with automatic fallback to English
 *
 * @param locale - The requested locale code
 * @returns Messages object for the locale, or fallback locale if not found
 */
export function getMessages(locale: string): Record<string, any> {
  // Return requested locale if available
  if (messages[locale]) {
    return messages[locale];
  }

  // Fallback to English if locale not found
  console.warn(`[i18n] Locale '${locale}' not found, falling back to '${fallbackLocale}'`);
  return messages[fallbackLocale] || {};
}
