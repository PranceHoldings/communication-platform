'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { locales } from '@/lib/i18n/config';

/**
 * Language metadata for UI display
 *
 * IMPORTANT: This list should match the locales in lib/i18n/config.ts
 * Only languages with complete message files should be included here.
 *
 * To add a new language:
 * 1. Add message files in apps/web/messages/[locale]/
 * 2. Import in lib/i18n/messages.ts
 * 3. Update lib/i18n/config.ts locales array
 * 4. Add metadata entry here
 */
const languageMetadata: Record<string, { name: string; nativeName: string; flag: string }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
};

// Build available languages from config locales
const languages = locales.map((code) => ({
  code,
  ...(languageMetadata[code] || {
    name: code.toUpperCase(),
    nativeName: code.toUpperCase(),
    flag: '🌐',
  }),
}));

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [isChanging, setIsChanging] = useState(false);

  const handleLanguageChange = (newLocale: string) => {
    if (newLocale === locale) return;

    setIsChanging(true);
    setLocale(newLocale);
    // setLocale will reload the page, so no need to set isChanging back to false
  };

  return (
    <div className="relative inline-block">
      <select
        value={locale}
        onChange={(e) => handleLanguageChange(e.target.value)}
        disabled={isChanging}
        className="block w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        aria-label={t('common.selectLanguage')}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag} {language.nativeName}
          </option>
        ))}
      </select>

      {isChanging && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md dark:bg-gray-800 dark:bg-opacity-75">
          <svg
            className="animate-spin h-5 w-5 text-indigo-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}
    </div>
  );
}
