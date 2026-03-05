import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers';
import { getMessages } from '@/lib/i18n/messages';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Prance Communication Platform',
  description: 'AI アバターコミュニケーションプラットフォーム',
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
  // Get language from middleware-set header
  const headersList = await headers();
  const locale = headersList.get('x-locale') || 'en';

  // Load messages for the current locale
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
