'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';

interface Session {
  id: string;
  scenario: string;
  avatar: string;
  duration: string;
  score?: number;
  date: string;
  status: 'completed' | 'processing' | 'failed';
}

interface RecentSessionsProps {
  sessions: Session[];
}

export default function RecentSessions({ sessions }: RecentSessionsProps) {
  const { t } = useI18n();

  const getStatusBadge = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {t('dashboard.recentSessions.status.completed')}
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {t('dashboard.recentSessions.status.processing')}
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {t('dashboard.recentSessions.status.failed')}
          </span>
        );
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">{t('dashboard.recentSessions.title')}</h3>
        </div>
        <div className="px-6 py-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">{t('dashboard.recentSessions.empty.title')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('dashboard.recentSessions.empty.description')}</p>
          <div className="mt-6">
            <Link
              href="/dashboard/sessions/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('dashboard.recentSessions.newSession')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">{t('dashboard.recentSessions.title')}</h3>
        <Link
          href="/dashboard/sessions"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          {t('dashboard.recentSessions.viewAll')}
        </Link>
      </div>
      <div className="divide-y divide-gray-200">
        {sessions.map((session) => (
          <div key={session.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3">
                  <h4 className="text-sm font-medium text-gray-900 truncate">{session.scenario}</h4>
                  {getStatusBadge(session.status)}
                </div>
                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    {session.avatar}
                  </span>
                  <span className="flex items-center">
                    <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {session.duration}
                  </span>
                  <span>{session.date}</span>
                </div>
              </div>
              <div className="ml-4 flex items-center space-x-4">
                {session.score && (
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{session.score}/100</div>
                    <div className="text-xs text-gray-500">{t('dashboard.recentSessions.score')}</div>
                  </div>
                )}
                <Link
                  href={`/dashboard/sessions/${session.id}`}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
