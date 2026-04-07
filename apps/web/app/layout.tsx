import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
// Import pre-built Tailwind CSS (built on host Mac to avoid Docker filesystem issues)
// Run: bash scripts/build-tailwind-host.sh --watch (on Mac, outside Docker)
import '../styles/tailwind.output.css';
import { Providers } from '@/components/providers';
import { getMessages } from '@/lib/i18n/messages';
import { LOCALE_HEADER_NAME, getLocaleWithFallback } from '@/lib/i18n/config';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Prance Communication Platform',
  description: 'AI Avatar Communication Platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Get locale from middleware-set header with automatic fallback
  const headersList = await headers();
  const localeFromHeader = headersList.get(LOCALE_HEADER_NAME);
  const locale = getLocaleWithFallback(localeFromHeader);

  // Load messages for the current locale (with automatic fallback to English)
  const messages = getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers locale={locale} messages={messages}>
          <div className="relative flex min-h-screen flex-col">
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
