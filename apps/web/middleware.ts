/**
 * Prance Platform - Language Detection Middleware
 *
 * Cookie-based language detection without locale prefixes in URLs.
 *
 * Language detection priority:
 * 1. URL parameter (?lang=en) - Sets cookie and redirects
 * 2. Cookie (NEXT_LOCALE)
 * 3. Accept-Language header (browser settings)
 * 4. Default locale (auto-detected from available message files)
 *
 * IMPORTANT: All language configuration is centralized in lib/i18n/config.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  defaultLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_HEADER_NAME,
  LOCALE_URL_PARAM,
  isValidLocale,
} from '@/lib/i18n/config';

/**
 * Detect locale from Accept-Language header (browser settings)
 *
 * This function respects the user's browser language preferences
 * and returns the first supported locale from their preference list.
 *
 * @param acceptLanguage - The Accept-Language header value
 * @returns The best matching supported locale, or default locale if none match
 */
function detectLocaleFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage.split(',').map(lang => {
    const [code, qValue] = lang.trim().split(';q=');
    const parts = code ? code.split('-') : [];
    const baseCode = parts[0] ? parts[0].toLowerCase() : '';
    return { code: baseCode, q: qValue ? parseFloat(qValue) : 1.0 };
  });

  // Sort by quality value (descending)
  languages.sort((a, b) => b.q - a.q);

  // Find first supported locale
  for (const lang of languages) {
    if (lang.code && isValidLocale(lang.code)) {
      return lang.code;
    }
  }

  // No match found, return default
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);
  const langParam = searchParams.get(LOCALE_URL_PARAM);

  // 1. Check URL parameter (highest priority)
  // Example: ?lang=ja
  if (langParam && isValidLocale(langParam)) {
    // Remove locale parameter from URL for clean URLs
    searchParams.delete(LOCALE_URL_PARAM);
    const cleanUrl = new URL(
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ''),
      request.url
    );

    // Redirect to clean URL with locale cookie set
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set(LOCALE_COOKIE_NAME, langParam, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
      httpOnly: false, // Allow JavaScript access for language switcher
    });

    return response;
  }

  // 2. Get locale from Cookie (returning visitors)
  let locale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;

  // 3. If no Cookie or unsupported locale, detect from browser settings
  if (!locale || !isValidLocale(locale)) {
    const acceptLanguage = request.headers.get('accept-language');
    locale = detectLocaleFromHeader(acceptLanguage);
  }

  // Add locale to request headers for custom I18nProvider
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER_NAME, locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Save locale to Cookie (for first-time visitors or cookie expired)
  if (!request.cookies.get(LOCALE_COOKIE_NAME)) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
      httpOnly: false, // Allow JavaScript access for language switcher
    });
  }

  return response;
}

export const config = {
  // Exclude API routes, static files, and images
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
