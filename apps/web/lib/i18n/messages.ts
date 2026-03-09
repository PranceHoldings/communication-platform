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
import settingsEn from '@/messages/en/settings.json';
import reportsEn from '@/messages/en/reports.json';

// Import Japanese
import commonJa from '@/messages/ja/common.json';
import homeJa from '@/messages/ja/home.json';
import authJa from '@/messages/ja/auth.json';
import dashboardJa from '@/messages/ja/dashboard.json';
import sessionsJa from '@/messages/ja/sessions.json';
import scenariosJa from '@/messages/ja/scenarios.json';
import avatarsJa from '@/messages/ja/avatars.json';
import settingsJa from '@/messages/ja/settings.json';
import reportsJa from '@/messages/ja/reports.json';

// Import Chinese Simplified
import commonZhCN from '@/messages/zh-CN/common.json';

// Import Chinese Traditional
import commonZhTW from '@/messages/zh-TW/common.json';

// Import Korean
import commonKo from '@/messages/ko/common.json';

// Import Spanish
import commonEs from '@/messages/es/common.json';

// Import Portuguese
import commonPt from '@/messages/pt/common.json';

// Import French
import commonFr from '@/messages/fr/common.json';

// Import German
import commonDe from '@/messages/de/common.json';

// Import Italian
import commonIt from '@/messages/it/common.json';

const messages: Record<string, Record<string, any>> = {
  en: {
    ...commonEn,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  ja: {
    ...commonJa,
    ...homeJa,
    ...authJa,
    ...dashboardJa,
    sessions: sessionsJa,
    scenarios: scenariosJa,
    avatars: avatarsJa,
    settings: settingsJa,
    reports: reportsJa,
  },
  'zh-CN': {
    ...commonZhCN,
    // Other sections fallback to English
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  'zh-TW': {
    ...commonZhTW,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  ko: {
    ...commonKo,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  es: {
    ...commonEs,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  pt: {
    ...commonPt,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  fr: {
    ...commonFr,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  de: {
    ...commonDe,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
  it: {
    ...commonIt,
    ...homeEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
    settings: settingsEn,
    reports: reportsEn,
  },
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
