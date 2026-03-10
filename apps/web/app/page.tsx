'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';

export default function HomePage() {
  const { t } = useI18n();

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t('home.title')}</h1>
          <p className="text-lg text-muted-foreground">{t('home.subtitle')}</p>
          <p className="text-sm text-muted-foreground">{t('home.version')}</p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h2 className="text-xl font-semibold mb-2">{t('home.getStarted.title')}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('home.getStarted.description')}
            </p>
            <div className="flex gap-3">
              <Link
                href="/login"
                className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t('home.getStarted.signIn')}
              </Link>
              <Link
                href="/register"
                className="flex-1 inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                {t('home.getStarted.signUp')}
              </Link>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="font-semibold mb-2">{t('home.features.title')}</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{t('home.features.avatarConversations')}</li>
              <li>{t('home.features.sessionManagement')}</li>
              <li>{t('home.features.multiLanguage')}</li>
              <li>{t('home.features.customization')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
