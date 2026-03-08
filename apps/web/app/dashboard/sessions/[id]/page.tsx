'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getSession, type Session } from '@/lib/api/sessions';
import type { Avatar } from '@prance/shared';
import { getAvatar } from '@/lib/api/avatars';
import { getScenario, type Scenario } from '@/lib/api/scenarios';
import { SessionPlayer } from '@/components/session-player';
import { RecordingPlayer, type Recording, type Transcript } from '@/components/session-player/recording-player';
import Link from 'next/link';

export default function SessionDetailPage() {
  const params = useParams();
  const { t } = useI18n();

  const [session, setSession] = useState<Session | null>(null);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = params.id as string;

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // セッション情報取得
      const sessionData = await getSession(sessionId);
      setSession(sessionData);

      // アバター情報取得
      const avatarData = await getAvatar(sessionData.avatarId);
      setAvatar(avatarData);

      // シナリオ情報取得
      const scenarioData = await getScenario(sessionData.scenarioId);
      setScenario(scenarioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sessions.detail.notFound'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500">{t('sessions.detail.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !session || !avatar || !scenario) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || t('sessions.detail.notFound')}
        </div>
        <Link
          href="/dashboard/sessions"
          className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          {t('sessions.detail.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* パンくずリスト */}
      <div className="flex items-center text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-indigo-600">
          {t('sessions.detail.dashboard')}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <Link href="/dashboard/sessions" className="hover:text-indigo-600">
          {t('sessions.list.title')}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-gray-900 font-medium">{t('sessions.detail.session')} {sessionId.slice(0, 8)}...</span>
      </div>

      {/* セッションプレイヤー or 録画プレイヤー */}
      {session.status === 'COMPLETED' && session.recordings && session.recordings.length > 0 ? (
        <RecordingPlayer
          recording={session.recordings[0] as Recording}
          transcripts={(session.transcripts as Transcript[]) || []}
        />
      ) : (
        <SessionPlayer session={session} avatar={avatar} scenario={scenario} />
      )}
    </div>
  );
}
