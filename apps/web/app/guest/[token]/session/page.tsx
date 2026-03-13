'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getGuestSessionData } from '@/lib/api/guest-sessions';
import { SessionPlayer } from '@/components/session-player';

export default function GuestSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const token = params.token as string;

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{
    session: any;
    scenario: any;
    avatar: any;
  } | null>(null);

  useEffect(() => {
    // Check for guest token
    const guestToken = localStorage.getItem('guestToken');
    if (!guestToken) {
      router.push(`/guest/${token}`);
      return;
    }

    // Initialize session
    initializeSession();
  }, [token]);

  const initializeSession = async () => {
    try {
      // Store guest token as accessToken for WebSocket authentication
      const guestToken = localStorage.getItem('guestToken');
      if (guestToken) {
        localStorage.setItem('accessToken', guestToken);
      }

      // Get session data from API using guest token
      const response = await getGuestSessionData();

      setSessionData({
        session: response.session,
        scenario: response.scenario,
        avatar: response.avatar,
      });

      setIsReady(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize session';
      setError(errorMsg);
    }
  };

  const handleComplete = () => {
    // Clear tokens and redirect to completed page
    localStorage.removeItem('guestToken');
    localStorage.removeItem('accessToken');
    router.push(`/guest/${token}/completed`);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Wait until ready and data is loaded
  if (!isReady || !sessionData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-white mb-4">
              {t('guestSessions.session.title')}
            </h1>
            <p className="text-gray-400 mb-6">{t('guestSessions.session.instructions')}</p>

            {/* SessionPlayer Component */}
            <SessionPlayer
              session={sessionData.session}
              avatar={sessionData.avatar}
              scenario={sessionData.scenario}
            />

            {/* Complete Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleComplete}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {t('guestSessions.session.completed')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
