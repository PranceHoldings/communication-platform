'use client';

import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/lib/i18n/provider';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('dashboard.welcome', { name: user?.name || 'User' })}
        </h1>
        <p className="mt-2 text-gray-600">{t('dashboard.overview')}</p>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('dashboard.quickActions.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/dashboard/sessions/new"
            className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mb-4">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">
              {t('dashboard.quickActions.startSession')}
            </h3>
          </Link>

          <Link
            href="/dashboard/scenarios"
            className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">
              {t('dashboard.quickActions.createScenario')}
            </h3>
          </Link>

          <Link
            href="/dashboard/reports"
            className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mb-4">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">
              {t('dashboard.quickActions.viewReports')}
            </h3>
          </Link>

          <Link
            href="/dashboard/avatars"
            className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">
              {t('dashboard.quickActions.manageAvatars')}
            </h3>
          </Link>
        </div>
      </div>

      {/* Recent Sessions Placeholder */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('dashboard.recentSessions.title')}
          </h2>
          <Link
            href="/dashboard/sessions"
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            {t('dashboard.recentSessions.viewAll')} →
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">{t('dashboard.recentSessions.noSessions')}</p>
        </div>
      </div>
    </div>
  );
}
