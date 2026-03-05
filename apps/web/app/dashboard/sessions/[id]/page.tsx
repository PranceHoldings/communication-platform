'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { sessionsApi, Session } from '@/lib/api/sessions';
import Link from 'next/link';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { t } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
  }, [resolvedParams.id]);

  const loadSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await sessionsApi.get(resolvedParams.id);

      if (response.success && response.data) {
        setSession(response.data);
      } else {
        setError(response.error?.message || 'Failed to load session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeColor = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('sessions.detail.notStarted');
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    return t('sessions.detail.minutes', { count: minutes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
        <p className="text-red-700">{error || 'Session not found'}</p>
        <Link
          href="/dashboard/sessions"
          className="mt-4 inline-flex items-center text-red-900 hover:text-red-700"
        >
          ← Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/sessions"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← {t('sessions.list.title')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('sessions.detail.title')}</h1>
        </div>
        <span
          className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadgeColor(
            session.status
          )}`}
        >
          {t(`sessions.status.${session.status}`)}
        </span>
      </div>

      {/* Session Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('sessions.detail.information')}
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scenario */}
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('sessions.detail.scenario')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {session.scenario ? (
                <div>
                  <div className="font-medium">{session.scenario.title}</div>
                  <div className="text-gray-500">{session.scenario.description}</div>
                </div>
              ) : (
                'N/A'
              )}
            </dd>
          </div>

          {/* Avatar */}
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('sessions.detail.avatar')}</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {session.avatar ? (
                <div className="flex items-center">
                  {session.avatar.imageUrl ? (
                    <img
                      src={session.avatar.imageUrl}
                      alt={session.avatar.name}
                      className="h-10 w-10 rounded-full mr-3"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 mr-3"></div>
                  )}
                  <span className="font-medium">{session.avatar.name}</span>
                </div>
              ) : (
                'N/A'
              )}
            </dd>
          </div>

          {/* Start Time */}
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('sessions.detail.startTime')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(session.startTime)}</dd>
          </div>

          {/* End Time */}
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('sessions.detail.endTime')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(session.endTime)}</dd>
          </div>

          {/* Duration */}
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('sessions.detail.duration')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDuration(session.duration)}</dd>
          </div>

          {/* Created At */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(session.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Recording */}
      {session.recording && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('sessions.detail.recording')}
          </h2>
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Video player placeholder</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Duration:</span>{' '}
              <span className="text-gray-900">{formatDuration(session.recording.duration)}</span>
            </div>
            <div>
              <span className="text-gray-500">File Size:</span>{' '}
              <span className="text-gray-900">
                {(session.recording.fileSize / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          </div>
        </div>
      )}

      {!session.recording && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-500">{t('sessions.detail.noRecording')}</p>
        </div>
      )}

      {/* Transcript */}
      {session.transcript && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('sessions.detail.transcript')}
          </h2>
          {session.transcript.summary && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Summary</h3>
              <p className="text-sm text-blue-800">{session.transcript.summary}</p>
            </div>
          )}
          <div className="space-y-2">
            {session.transcript.segments && session.transcript.segments.length > 0 ? (
              <p className="text-sm text-gray-500">
                {session.transcript.segments.length} segments
              </p>
            ) : (
              <p className="text-sm text-gray-500">No transcript segments available</p>
            )}
          </div>
        </div>
      )}

      {!session.transcript && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-500">{t('sessions.detail.noTranscript')}</p>
        </div>
      )}
    </div>
  );
}
