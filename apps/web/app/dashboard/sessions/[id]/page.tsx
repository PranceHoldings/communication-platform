'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getSession, type Session } from '@/lib/api/sessions';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('dashboard');

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = params.id as string;

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSession(sessionId);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Session not found'}
        </div>
        <button
          onClick={() => router.push('/dashboard/sessions')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Back to Sessions
        </button>
      </div>
    );
  }

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'ACTIVE':
        return 'bg-yellow-100 text-yellow-800';
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Session Details</h1>
          <p className="text-gray-600 mt-2">Session ID: {session.id}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/sessions')}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back to Sessions
        </button>
      </div>

      {/* Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Status</h2>
          <span className={\`px-3 py-1 rounded-full text-sm font-semibold \${getStatusColor(session.status)}\`}>
            {session.status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Started At:</span>
            <div className="font-medium">{new Date(session.startedAt).toLocaleString()}</div>
          </div>
          <div>
            <span className="text-gray-600">Ended At:</span>
            <div className="font-medium">{session.endedAt ? new Date(session.endedAt).toLocaleString() : 'In Progress'}</div>
          </div>
          {session.duration !== null && (
            <div>
              <span className="text-gray-600">Duration:</span>
              <div className="font-medium">{Math.floor(session.duration / 60)}m {session.duration % 60}s</div>
            </div>
          )}
        </div>
      </div>

      {/* Scenario Details */}
      {session.scenario && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Scenario</h2>
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">Title:</span>
              <div className="font-medium">{session.scenario.title}</div>
            </div>
            <div>
              <span className="text-gray-600">Category:</span>
              <div className="font-medium">{session.scenario.category}</div>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Details */}
      {session.avatar && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Avatar</h2>
          <div className="flex items-start gap-4">
            {session.avatar.thumbnailUrl && (
              <img
                src={session.avatar.thumbnailUrl}
                alt={session.avatar.name}
                className="w-24 h-24 object-cover rounded-lg"
              />
            )}
            <div className="space-y-2">
              <div>
                <span className="text-gray-600">Name:</span>
                <div className="font-medium">{session.avatar.name}</div>
              </div>
              <div>
                <span className="text-gray-600">Type:</span>
                <div className="font-medium">{session.avatar.type}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      {session.metadata && Object.keys(session.metadata).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Metadata</h2>
          <pre className="bg-gray-50 rounded p-4 text-sm overflow-auto">
            {JSON.stringify(session.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Actions */}
      {session.status === 'ACTIVE' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="flex gap-4">
            <button
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              onClick={() => {
                // TODO: Implement session player/viewer
                alert('Session player coming soon!');
              }}
            >
              Start Session
            </button>
            <button
              className="px-6 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50"
              onClick={() => {
                // TODO: Implement end session
                alert('End session functionality coming soon!');
              }}
            >
              End Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
