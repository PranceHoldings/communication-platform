'use client';

import { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n/provider';
import { AuthProvider } from '@/contexts/auth-context';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, any>;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <QueryProvider>
      <I18nProvider locale={locale} messages={messages}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </I18nProvider>
    </QueryProvider>
  );
}
