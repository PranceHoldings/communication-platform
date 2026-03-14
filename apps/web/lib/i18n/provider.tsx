'use client';

import { createContext, useContext, ReactNode } from 'react';
import { fallbackLocale } from '@/lib/i18n/config';
import { setLocaleCookie } from '@/lib/cookies';

interface I18nContextType {
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: string) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, any>;
}

export function I18nProvider({ children, locale, messages }: I18nProviderProps) {
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = messages;

    // Navigate through nested object
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // Translation key not found - this is expected for incomplete translations
        if (locale !== fallbackLocale) {
          console.warn(
            `[i18n] Translation missing: ${key} (locale: ${locale}), will use ${fallbackLocale} fallback`
          );
        } else {
          console.warn(`[i18n] Translation missing: ${key} (fallback locale: ${fallbackLocale})`);
        }
        return key; // Return key as final fallback
      }
    }

    // Handle parameter interpolation
    if (params && typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (_, param) => {
        const replacement = params[param];
        return replacement !== undefined ? String(replacement) : `{${param}}`;
      });
    }

    return typeof value === 'string' ? value : key;
  };

  const setLocale = (newLocale: string) => {
    // Set cookie using centralized cookie utility
    setLocaleCookie(newLocale);

    // Reload page to apply new locale
    window.location.reload();
  };

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
