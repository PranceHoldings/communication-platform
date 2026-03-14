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
 *
 * Display Names:
 * - Display names are managed in Frontend language resources (apps/web/messages/{locale}/common.json)
 * - Use t('languages.{code}') or t('languagesNative.{code}') in UI components
 */

/**
 * Regional variant definition
 */
export interface RegionalVariant {
  /** BCP-47 code (e.g., 'en-US', 'en-GB') */
  code: string;
  /** Priority for auto-detection (1 = highest) */
  priority: number;
}

/**
 * Language metadata (Backend - technical identifiers only)
 */
export interface LanguageMetadata {
  /** ISO 639-1 language code (e.g., 'ja', 'en', 'zh-CN', 'zh-TW') */
  languageCode: string;
  /** BCP-47 code for STT (e.g., 'ja-JP', 'en-US') */
  sttCode: string;
  /** Regional variants for this language (empty for languages like Japanese, Chinese variants) */
  regionalVariants: RegionalVariant[];
}

/**
 * All supported languages
 *
 * SYNCHRONIZATION REQUIRED:
 * When adding/removing a language, update these locations:
 * 1. This array (Backend language metadata)
 * 2. apps/web/lib/i18n/config.ts locales array (Frontend)
 * 3. apps/web/messages/{languageCode}/ directory structure
 * 4. apps/web/lib/i18n/messages.ts import statements
 *
 * Language Order Convention:
 * The order here does NOT need to match Frontend.
 * Frontend uses English first for fallback, Backend uses any order.
 */
export const LANGUAGES: LanguageMetadata[] = [
  {
    languageCode: 'ja',
    sttCode: 'ja-JP',
    regionalVariants: [
      {
        code: 'ja-JP',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'en',
    sttCode: 'en-US',
    regionalVariants: [
      {
        code: 'en-US',
        priority: 1,
      },
      {
        code: 'en-GB',
        priority: 2,
      },
      {
        code: 'en-AU',
        priority: 3,
      },
      {
        code: 'en-CA',
        priority: 4,
      },
    ],
  },
  {
    languageCode: 'zh-CN',
    sttCode: 'zh-CN',
    regionalVariants: [
      {
        code: 'zh-CN',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'zh-TW',
    sttCode: 'zh-TW',
    regionalVariants: [
      {
        code: 'zh-TW',
        priority: 1,
      },
      {
        code: 'zh-HK',
        priority: 2,
      },
    ],
  },
  {
    languageCode: 'ko',
    sttCode: 'ko-KR',
    regionalVariants: [
      {
        code: 'ko-KR',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'es',
    sttCode: 'es-ES',
    regionalVariants: [
      {
        code: 'es-ES',
        priority: 1,
      },
      {
        code: 'es-MX',
        priority: 2,
      },
      {
        code: 'es-AR',
        priority: 3,
      },
    ],
  },
  {
    languageCode: 'pt',
    sttCode: 'pt-BR',
    regionalVariants: [
      {
        code: 'pt-BR',
        priority: 1,
      },
      {
        code: 'pt-PT',
        priority: 2,
      },
    ],
  },
  {
    languageCode: 'fr',
    sttCode: 'fr-FR',
    regionalVariants: [
      {
        code: 'fr-FR',
        priority: 1,
      },
      {
        code: 'fr-CA',
        priority: 2,
      },
    ],
  },
  {
    languageCode: 'de',
    sttCode: 'de-DE',
    regionalVariants: [
      {
        code: 'de-DE',
        priority: 1,
      },
    ],
  },
  {
    languageCode: 'it',
    sttCode: 'it-IT',
    regionalVariants: [
      {
        code: 'it-IT',
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
  console.warn(`[normalizeLanguageCode] Unknown language code: ${languageCode}, using default 'ja-JP'`);
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
  return languageCode.split('-')[0];
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
