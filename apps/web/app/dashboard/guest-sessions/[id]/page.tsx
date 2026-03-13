'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import {
  getGuestSession,
  getGuestSessionLogs,
  deleteGuestSession,
  completeGuestSession,
  type GuestSession,
  type GuestSessionLog,
} from '@/lib/api/guest-sessions';

export default function GuestSessionDetailPage() {
  const params = useParams();
  const { t } = useI18n();
  const sessionId = params.id as string;

  const [session, setSession] = useState<GuestSession | null>(null);
  const [logs, setLogs] = useState<GuestSessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getGuestSession(sessionId);
      setSession(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('guestSessions.errors.loadFailed');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    setIsLoadingLogs(true);

    try {
      const response = await getGuestSessionLogs(sessionId, { limit: 50 });
      setLogs(response.logs);
      setShowLogs(true);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRevoke = async () => {
    if (!confirm(t('guestSessions.detail.confirmRevoke'))) {
      return;
    }

    try {
      await deleteGuestSession(sessionId);
      await loadSession();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('guestSessions.errors.revokeFailed');
      setError(errorMsg);
    }
  };

  const handleComplete = async () => {
    try {
      await completeGuestSession(sessionId);
      await loadSession();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('guestSessions.errors.completeFailed');
      setError(errorMsg);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      case 'REVOKED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">{error || t('guestSessions.errors.loadFailed')}</p>
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/guest/${session.token}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('guestSessions.detail.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {session.guestName || t('guestSessions.detail.fields.id')}: {session.id}
          </p>
        </div>
        <div className="flex space-x-3">
          {session.status === 'PENDING' && (
            <button
              onClick={handleRevoke}
              className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
            >
              {t('guestSessions.detail.actions.revoke')}
            </button>
          )}
          {(session.status === 'ACTIVE' || session.status === 'PENDING') && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {t('guestSessions.detail.actions.complete')}
            </button>
          )}
        </div>
      </div>

      {/* Invitation Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          {t('guestSessions.detail.inviteInfo')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('guestSessions.detail.inviteUrl')}
            </label>
            <div className="flex">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-sm"
              />
              <button
                onClick={() => handleCopy(inviteUrl, 'url')}
                className="px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-white hover:bg-gray-50 text-sm"
              >
                {copySuccess === 'url' ? t('guestSessions.detail.copied') : t('guestSessions.detail.copyUrl')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.detail.token')}
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={session.token}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={() => handleCopy(session.token, 'token')}
                  className="px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-white hover:bg-gray-50 text-sm"
                >
                  {copySuccess === 'token' ? '✓' : t('guestSessions.detail.copyToken')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          {t('guestSessions.detail.info')}
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('guestSessions.detail.fields.status')}
            </dt>
            <dd className="mt-1">
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                  session.status
                )}`}
              >
                {t(`guestSessions.status.${session.status}`)}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('guestSessions.detail.fields.scenario')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{session.scenario?.title || '-'}</dd>
          </div>

          {session.guestName && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.guestName')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{session.guestName}</dd>
            </div>
          )}

          {session.guestEmail && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.guestEmail')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{session.guestEmail}</dd>
            </div>
          )}

          {session.avatar && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.avatar')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{session.avatar.name}</dd>
            </div>
          )}

          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('guestSessions.detail.fields.validFrom')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(session.validFrom)}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('guestSessions.detail.fields.validUntil')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(session.validUntil)}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('guestSessions.detail.fields.accessCount')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{session.accessCount}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('guestSessions.detail.fields.failedAttempts')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{session.failedAttempts}</dd>
          </div>

          {session.firstAccessedAt && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.firstAccessed')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(session.firstAccessedAt)}</dd>
            </div>
          )}

          {session.completedAt && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.completed')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(session.completedAt)}</dd>
            </div>
          )}

          {session.creator && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.creator')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{session.creator.name}</dd>
            </div>
          )}

          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('guestSessions.detail.fields.createdAt')}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(session.createdAt)}</dd>
          </div>

          {session.dataRetentionDays && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.dataRetention')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{session.dataRetentionDays} days</dd>
            </div>
          )}

          {session.autoDeleteAt && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                {t('guestSessions.detail.fields.autoDelete')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(session.autoDeleteAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Access Logs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">{t('guestSessions.detail.logs')}</h2>
          <button
            onClick={loadLogs}
            disabled={isLoadingLogs}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoadingLogs ? t('common.loading') : t('guestSessions.detail.actions.viewLogs')}
          </button>
        </div>

        {showLogs && logs.length > 0 && (
          <div className="mt-4 space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="border border-gray-200 rounded-md p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{log.eventType}</span>
                  <span className="text-gray-500">{formatDate(log.createdAt)}</span>
                </div>
                {log.ipAddress && (
                  <div className="mt-1 text-gray-600">IP: {log.ipAddress}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {showLogs && logs.length === 0 && (
          <div className="text-center py-6 text-gray-500">No logs found</div>
        )}
      </div>
    </div>
  );
}
