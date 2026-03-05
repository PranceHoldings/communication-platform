'use client';

import { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n/provider';
import { AuthProvider } from '@/contexts/auth-context';

interface ProvidersProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, any>;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </I18nProvider>
  );
}
