'use client';

import { createContext, useContext, ReactNode } from 'react';

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
        console.warn(`Translation missing: ${key} (locale: ${locale})`);
        return key; // Return key as fallback
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
    // Set cookie
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Reload page to apply new language
    window.location.reload();
  };

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
