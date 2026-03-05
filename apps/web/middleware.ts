/**
 * Prance Platform - Language Detection Middleware
 *
 * Cookie-based language detection without locale prefixes in URLs.
 *
 * Language detection priority:
 * 1. URL parameter (lang=en, lang=ja, etc.) - Sets cookie and redirects
 * 2. Cookie (NEXT_LOCALE)
 * 3. Accept-Language header (browser settings)
 * 4. Default language (en)
 */

import { NextRequest, NextResponse } from 'next/server';

const supportedLocales = ['en', 'ja', 'zh-CN', 'ko', 'es', 'fr', 'de'];
const defaultLocale = 'en';

/**
 * Detect language from Accept-Language header
 */
function detectLanguageFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage.split(',').map((lang) => {
    const [code, qValue] = lang.trim().split(';q=');
    const baseCode = code.split('-')[0].toLowerCase();
    return { code: baseCode, q: qValue ? parseFloat(qValue) : 1.0 };
  });

  // Sort by quality value (descending)
  languages.sort((a, b) => b.q - a.q);

  // Find first supported language
  for (const lang of languages) {
    if (supportedLocales.includes(lang.code)) {
      return lang.code;
    }
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);
  const langParam = searchParams.get('lang');

  // 1. Check URL parameter 'lang' (highest priority)
  if (langParam && supportedLocales.includes(langParam)) {
    // Remove 'lang' parameter from URL
    searchParams.delete('lang');
    const cleanUrl = new URL(pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ''), request.url);

    // Redirect to clean URL with language cookie set
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set('NEXT_LOCALE', langParam, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  }

  // 2. Get language from Cookie
  let locale = request.cookies.get('NEXT_LOCALE')?.value;

  // 3. If no Cookie or unsupported locale, detect from Accept-Language header
  if (!locale || !supportedLocales.includes(locale)) {
    const acceptLanguage = request.headers.get('accept-language');
    locale = detectLanguageFromHeader(acceptLanguage);
  }

  // 3. Add language to request headers (for use in components)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Save language to Cookie (for first-time visitors)
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale, {
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
