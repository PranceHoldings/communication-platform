/**
 * Language Configuration
 *
 * Resource-file-based language management.
 * Adding a new language only requires adding an entry to the LANGUAGES array.
 *
 * Language Code Formats:
 * - languageCode: ISO 639-1 ('ja', 'en', 'zh-CN', 'zh-TW')
 * - sttCode: BCP-47 for Azure STT ('ja-JP', 'en-US', 'zh-CN', 'zh-TW')
 *
 * Chinese Language Handling:
 * - zh-CN (Simplified Chinese) and zh-TW (Traditional Chinese) are COMPLETELY DIFFERENT languages
 * - They must be treated separately, not as regional variants
 */

/**
 * Regional variant definition
 */
export interface RegionalVariant {
  /** BCP-47 code (e.g., 'en-US', 'en-GB') */
  code: string;
  /** Display name (e.g., 'English (United States)') */
  displayName: string;
  /** Priority for auto-detection (1 = highest) */
  priority: number;
}

/**
 * Language metadata
 */
export interface LanguageMetadata {
  /** ISO 639-1 language code (e.g., 'ja', 'en', 'zh-CN', 'zh-TW') */
  languageCode: string;
  /** BCP-47 code for STT (e.g., 'ja-JP', 'en-US') */
  sttCode: string;
  /** Display name (e.g., '日本語', 'English') */
  displayName: string;
  /** Regional variants for this language (empty for languages like Japanese, Chinese variants) */
  regionalVariants: RegionalVariant[];
}

/**
 * All supported languages
 *
 * To add a new language:
 * 1. Add an entry to this array
 * 2. Create apps/web/messages/{languageCode}.json for UI translations
 * 3. Deploy - no code changes required!
 */
export const LANGUAGES: LanguageMetadata[] = [
  {
    languageCode: 'ja',
    sttCode: 'ja-JP',
    displayName: '日本語',
    regionalVariants: [
      {
        code: 'ja-JP',
        displayName: '日本語（日本）',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'en',
    sttCode: 'en-US',
    displayName: 'English',
    regionalVariants: [
      {
        code: 'en-US',
        displayName: 'English (United States)',
        priority: 1,
      },
      {
        code: 'en-GB',
        displayName: 'English (United Kingdom)',
        priority: 2,
      },
      {
        code: 'en-AU',
        displayName: 'English (Australia)',
        priority: 3,
      },
      {
        code: 'en-CA',
        displayName: 'English (Canada)',
        priority: 4,
      },
    ],
  },
  {
    languageCode: 'zh-CN',
    sttCode: 'zh-CN',
    displayName: '中文（简体）',
    regionalVariants: [
      {
        code: 'zh-CN',
        displayName: '中文（简体，中国大陆）',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'zh-TW',
    sttCode: 'zh-TW',
    displayName: '中文（繁體）',
    regionalVariants: [
      {
        code: 'zh-TW',
        displayName: '中文（繁體，台灣）',
        priority: 1,
      },
      {
        code: 'zh-HK',
        displayName: '中文（繁體，香港）',
        priority: 2,
      },
    ],
  },
  {
    languageCode: 'ko',
    sttCode: 'ko-KR',
    displayName: '한국어',
    regionalVariants: [
      {
        code: 'ko-KR',
        displayName: '한국어（대한민국）',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'es',
    sttCode: 'es-ES',
    displayName: 'Español',
    regionalVariants: [
      {
        code: 'es-ES',
        displayName: 'Español (España)',
        priority: 1,
      },
      {
        code: 'es-MX',
        displayName: 'Español (México)',
        priority: 2,
      },
      {
        code: 'es-AR',
        displayName: 'Español (Argentina)',
        priority: 3,
      },
    ],
  },
  {
    languageCode: 'pt',
    sttCode: 'pt-BR',
    displayName: 'Português',
    regionalVariants: [
      {
        code: 'pt-BR',
        displayName: 'Português (Brasil)',
        priority: 1,
      },
      {
        code: 'pt-PT',
        displayName: 'Português (Portugal)',
        priority: 2,
      },
    ],
  },
  {
    languageCode: 'fr',
    sttCode: 'fr-FR',
    displayName: 'Français',
    regionalVariants: [
      {
        code: 'fr-FR',
        displayName: 'Français (France)',
        priority: 1,
      },
      {
        code: 'fr-CA',
        displayName: 'Français (Canada)',
        priority: 2,
      },
    ],
  },
  {
    languageCode: 'de',
    sttCode: 'de-DE',
    displayName: 'Deutsch',
    regionalVariants: [
      {
        code: 'de-DE',
        displayName: 'Deutsch (Deutschland)',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'it',
    sttCode: 'it-IT',
    displayName: 'Italiano',
    regionalVariants: [
      {
        code: 'it-IT',
        displayName: 'Italiano (Italia)',
        priority: 1,
      },
    ],
  },
];

/**
 * Default fallback languages for auto-detection
 */
export const DEFAULT_FALLBACK_LANGUAGES = ['ja-JP', 'en-US'];

/**
 * Maximum number of languages for Azure STT auto-detection
 */
export const MAX_AUTO_DETECT_LANGUAGES = 4;

/**
 * Get language metadata by language code
 *
 * @param languageCode ISO 639-1 code (e.g., 'ja', 'en', 'zh-CN')
 * @returns Language metadata or undefined if not found
 */
export function getLanguageMetadata(languageCode: string): LanguageMetadata | undefined {
  return LANGUAGES.find(lang => lang.languageCode === languageCode);
}

/**
 * Normalize language code to BCP-47 format for STT
 *
 * @param languageCode ISO 639-1 or BCP-47 language code
 * @returns BCP-47 language code (e.g., 'ja-JP', 'en-US')
 *
 * Examples:
 * - 'ja' → 'ja-JP'
 * - 'ja-JP' → 'ja-JP'
 * - 'en' → 'en-US'
 * - 'zh-CN' → 'zh-CN' (stays as-is, it's a complete language code)
 * - 'zh-TW' → 'zh-TW' (stays as-is, distinct from zh-CN)
 */
export function normalizeLanguageCode(languageCode: string): string {
  // First, try exact match (handles 'zh-CN', 'zh-TW', etc.)
  const exactMatch = LANGUAGES.find(lang => lang.languageCode === languageCode);
  if (exactMatch) {
    return exactMatch.sttCode;
  }

  // Try to find in regional variants (handles 'en-GB', 'zh-HK', etc.)
  for (const lang of LANGUAGES) {
    const variant = lang.regionalVariants.find(v => v.code === languageCode);
    if (variant) {
      return variant.code;
    }
  }

  // If it looks like BCP-47 format and we don't know it, return as-is
  if (languageCode.includes('-') && languageCode.length >= 5) {
    console.warn(`[normalizeLanguageCode] Unknown BCP-47 code: ${languageCode}, returning as-is`);
    return languageCode;
  }

  // Default fallback
  console.warn(
    `[normalizeLanguageCode] Unknown language code: ${languageCode}, using default 'ja-JP'`
  );
  return 'ja-JP';
}

/**
 * Get language priority list for auto-detection
 *
 * @param primaryLanguage Primary language code (ISO 639-1 or BCP-47)
 * @returns Array of BCP-47 language codes, ordered by priority (max 4)
 *
 * Examples:
 * - 'ja' → ['ja-JP', 'en-US']
 * - 'en' → ['en-US', 'en-GB', 'en-AU', 'en-CA']
 * - 'zh-TW' → ['zh-TW', 'zh-HK', 'en-US', 'ja-JP']
 * - 'zh-CN' → ['zh-CN', 'en-US', 'ja-JP'] (NOT including zh-TW - they're different!)
 *
 * Logic:
 * 1. Place primary language first
 * 2. Add its regional variants
 * 3. Add default fallback languages
 * 4. Remove duplicates
 * 5. Limit to MAX_AUTO_DETECT_LANGUAGES (4)
 */
export function getLanguagePriority(primaryLanguage: string): string[] {
  // Normalize the primary language
  const normalized = normalizeLanguageCode(primaryLanguage);

  // Find the language metadata
  const langMetadata = LANGUAGES.find(
    lang => lang.sttCode === normalized || lang.languageCode === primaryLanguage
  );

  if (!langMetadata) {
    // Unknown language, use normalized + fallbacks
    return [normalized, ...DEFAULT_FALLBACK_LANGUAGES]
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, MAX_AUTO_DETECT_LANGUAGES);
  }

  // Build priority list
  const priority: string[] = [
    normalized, // 1. Primary language (normalized BCP-47)
    ...langMetadata.regionalVariants
      .sort((a, b) => a.priority - b.priority)
      .map(v => v.code)
      .filter(code => code !== normalized), // 2. Regional variants (excluding primary)
    ...DEFAULT_FALLBACK_LANGUAGES.filter(
      code => code !== normalized && !langMetadata.regionalVariants.some(v => v.code === code)
    ), // 3. Fallbacks (excluding already added)
  ];

  // Remove duplicates and limit to max
  return Array.from(new Set(priority)).slice(0, MAX_AUTO_DETECT_LANGUAGES);
}

/**
 * Get base language code (ISO 639-1) from BCP-47
 *
 * @param languageCode BCP-47 language code
 * @returns ISO 639-1 base language code
 *
 * Examples:
 * - 'ja-JP' → 'ja'
 * - 'en-US' → 'en'
 * - 'zh-CN' → 'zh-CN' (IMPORTANT: Chinese variants must NOT be reduced to 'zh')
 * - 'zh-TW' → 'zh-TW' (IMPORTANT: Chinese variants must NOT be reduced to 'zh')
 */
export function getBaseLanguageCode(languageCode: string): string {
  // Chinese special handling: NEVER reduce to 'zh'
  if (languageCode.startsWith('zh-')) {
    return languageCode; // Keep 'zh-CN', 'zh-TW', 'zh-HK' as-is
  }

  // For other languages, return the base code
  return languageCode.split('-')[0] || languageCode;
}

/**
 * Get all supported language codes
 *
 * @returns Array of ISO 639-1 language codes
 */
export function getSupportedLanguages(): string[] {
  return LANGUAGES.map(lang => lang.languageCode);
}

/**
 * Get all supported STT codes
 *
 * @returns Array of BCP-47 language codes
 */
export function getSupportedSTTCodes(): string[] {
  const codes = new Set<string>();
  for (const lang of LANGUAGES) {
    codes.add(lang.sttCode);
    lang.regionalVariants.forEach(variant => codes.add(variant.code));
  }
  return Array.from(codes);
}
