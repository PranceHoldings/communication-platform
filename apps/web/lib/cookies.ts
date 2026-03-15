/**
 * Cookie Management Utilities
 *
 * Centralized cookie management to ensure consistency across the application.
 * All cookie operations should use these utilities.
 *
 * IMPORTANT: Cookie configuration is defined here as the single source of truth.
 */

import { LOCALE_COOKIE_NAME } from '@/lib/i18n/config';

/**
 * Cookie options type
 */
export interface CookieOptions {
  path?: string;
  maxAge?: number;
  expires?: Date;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
  domain?: string;
}

/**
 * Default cookie options
 * Used consistently across the application
 */
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  path: '/',
  maxAge: 31536000, // 1 year (365 days)
  sameSite: 'lax',
  httpOnly: false, // Allow JavaScript access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
};

/**
 * Cookie configuration type
 */
interface CookieConfig {
  name: string;
  options: CookieOptions;
}

/**
 * Cookie configurations for specific use cases
 */
export const COOKIE_CONFIGS: Record<string, CookieConfig> = {
  locale: {
    name: LOCALE_COOKIE_NAME,
    options: {
      ...DEFAULT_COOKIE_OPTIONS,
      httpOnly: false, // Must be accessible from JavaScript for language switcher
    },
  },
  session: {
    name: 'session',
    options: {
      ...DEFAULT_COOKIE_OPTIONS,
      httpOnly: true, // Security: prevent JavaScript access
      secure: true, // Always require HTTPS for session cookies
    },
  },
};

/**
 * Set a cookie (client-side)
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options (merged with defaults)
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') {
    console.warn('setCookie called in non-browser environment');
    return;
  }

  const opts = { ...DEFAULT_COOKIE_OPTIONS, ...options };

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (opts.path) {
    cookieString += `; path=${opts.path}`;
  }

  if (opts.maxAge !== undefined) {
    cookieString += `; max-age=${opts.maxAge}`;
  }

  if (opts.expires) {
    cookieString += `; expires=${opts.expires.toUTCString()}`;
  }

  if (opts.sameSite) {
    cookieString += `; SameSite=${opts.sameSite}`;
  }

  if (opts.secure) {
    cookieString += `; Secure`;
  }

  if (opts.httpOnly) {
    // Note: httpOnly cookies cannot be set via JavaScript
    // This is a server-side only option
    console.warn('httpOnly cookies can only be set server-side');
  }

  if (opts.domain) {
    cookieString += `; domain=${opts.domain}`;
  }

  document.cookie = cookieString;
}

/**
 * Get a cookie value (client-side)
 *
 * @param name - Cookie name
 * @returns Cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieString: string = document.cookie;
  const cookies: string[] = cookieString.split(';');

  for (const cookie of cookies) {
    const trimmedCookie: string = cookie.trim();
    const parts: string[] = trimmedCookie.split('=');
    const [cookieName, cookieValue] = parts;

    if (cookieName && decodeURIComponent(cookieName) === name) {
      return cookieValue ? decodeURIComponent(cookieValue) : '';
    }
  }

  return null;
}

/**
 * Delete a cookie (client-side)
 *
 * @param name - Cookie name
 * @param options - Cookie options (path and domain must match the original cookie)
 */
export function deleteCookie(
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {}
): void {
  setCookie(name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Check if a cookie exists (client-side)
 *
 * @param name - Cookie name
 * @returns true if cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}

/**
 * Set locale cookie using standardized configuration
 *
 * @param locale - Locale code (e.g., 'en', 'ja')
 */
export function setLocaleCookie(locale: string): void {
  setCookie(COOKIE_CONFIGS.locale.name, locale, COOKIE_CONFIGS.locale.options);
}

/**
 * Get locale cookie value
 *
 * @returns Locale code or null if not set
 */
export function getLocaleCookie(): string | null {
  return getCookie(COOKIE_CONFIGS.locale.name);
}
