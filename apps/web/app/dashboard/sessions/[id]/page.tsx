'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getSession, type Session } from '@/lib/api/sessions';
import type { Avatar } from '@prance/shared';
import { getAvatar } from '@/lib/api/avatars';
import { getScenario, type Scenario } from '@/lib/api/scenarios';
import { SessionPlayer } from '@/components/session-player';
import {
  RecordingPlayer,
  type Recording,
  type Transcript,
} from '@/components/session-player/recording-player';
import { getAnalysis, triggerAnalysis, type AnalysisResult } from '@/lib/api/analysis';
import { ScoreDashboard } from '@/components/analysis/score-dashboard';
import { PerformanceRadar } from '@/components/analysis/performance-radar';
import { DetailStats } from '@/components/analysis/detail-stats';
import { ReportGenerator } from '@/components/reports/report-generator';
import Link from 'next/link';

function CompletedSessionView({
  transcripts,
  durationSec,
}: {
  transcripts: Transcript[];
  durationSec: number | null;
}) {
  const { t } = useI18n();

  const formatDuration = (sec: number | null) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('sessions.detail.transcript', { defaultValue: 'Conversation Transcript' })}
        </h2>
        {durationSec != null && (
          <span className="text-sm text-gray-500">
            {t('sessions.detail.duration', { defaultValue: 'Duration' })}: {formatDuration(durationSec)}
          </span>
        )}
      </div>

      {/* No recording notice */}
      <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2 text-sm text-yellow-700">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {t('sessions.detail.noRecording', { defaultValue: 'Video recording not available for this session.' })}
      </div>

      {/* Transcript */}
      <div className="divide-y max-h-[600px] overflow-y-auto">
        {transcripts.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>{t('sessions.detail.noTranscript', { defaultValue: 'No transcript available.' })}</p>
          </div>
        ) : (
          transcripts.map((item) => (
            <div key={item.id} className={`px-6 py-4 flex gap-4 ${item.speaker === 'USER' ? 'bg-white' : 'bg-indigo-50'}`}>
              <div className="shrink-0 mt-1">
                {item.speaker === 'AI' ? (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">AI</span>
                ) : (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                    {t('sessions.transcript.you', { defaultValue: 'You' }).substring(0, 2)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500">
                    {item.speaker === 'AI'
                      ? t('sessions.transcript.ai', { defaultValue: 'AI' })
                      : t('sessions.transcript.you', { defaultValue: 'You' })}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(item.timestampStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="text-gray-800 text-sm whitespace-pre-wrap">{item.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const { t } = useI18n();

  const [session, setSession] = useState<Session | null>(null);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [triggeringAnalysis, setTriggeringAnalysis] = useState(false);

  const sessionId = params.id as string;

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // セッション情報取得 (avatar and scenario are included in response)
      const sessionData = await getSession(sessionId);
      console.log('[SessionDetail] Session data loaded:', {
        id: sessionData.id,
        status: sessionData.status,
        hasAvatar: !!sessionData.avatar,
        hasScenario: !!sessionData.scenario,
      });
      setSession(sessionData);

      // Use avatar and scenario from session response if available
      // Otherwise fetch them separately
      if (sessionData.avatar) {
        console.log('[SessionDetail] Using avatar from session response');
        setAvatar(sessionData.avatar as any); // Use any to avoid type mismatch
      } else if (sessionData.avatarId) {
        console.log('[SessionDetail] Fetching avatar separately');
        const avatarData = await getAvatar(sessionData.avatarId);
        setAvatar(avatarData);
      }

      if (sessionData.scenario) {
        console.log('[SessionDetail] Using scenario from session response');
        setScenario(sessionData.scenario as any); // Use any to avoid type mismatch
      } else if (sessionData.scenarioId) {
        console.log('[SessionDetail] Fetching scenario separately');
        const scenarioData = await getScenario(sessionData.scenarioId);
        setScenario(scenarioData);
      }

      console.log('[SessionDetail] Avatar and scenario setup complete');

      // 完了したセッションの場合、解析結果を取得
      if (sessionData.status === 'COMPLETED') {
        loadAnalysisData();
      }
    } catch (err) {
      console.error('[SessionDetail] Error loading session data:', err);
      setError(err instanceof Error ? err.message : t('sessions.detail.notFound'));
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisData = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const analysisData = await getAnalysis(sessionId);
      setAnalysis(analysisData);
    } catch (err) {
      // 解析がまだ完了していない場合はエラーを無視
      console.log('Analysis not yet available:', err);
      setAnalysisError(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    setTriggeringAnalysis(true);
    try {
      await triggerAnalysis(sessionId);
      // 解析開始後、少し待ってから結果を再取得
      setTimeout(() => {
        loadAnalysisData();
      }, 2000);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Failed to trigger analysis');
    } finally {
      setTriggeringAnalysis(false);
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
        <span className="text-gray-900 font-medium">
          {t('sessions.detail.session')} {sessionId.slice(0, 8)}...
        </span>
      </div>

      {/* セッションプレイヤー or 録画プレイヤー */}
      {session.status === 'COMPLETED' ? (
        session.recordings && session.recordings.length > 0 ? (
          <RecordingPlayer
            recording={session.recordings[0] as Recording}
            transcripts={(session.transcripts as Transcript[]) || []}
          />
        ) : (
          <CompletedSessionView
            transcripts={(session.transcripts as Transcript[]) || []}
            durationSec={session.durationSec}
          />
        )
      ) : (
        <SessionPlayer session={session} avatar={avatar} scenario={scenario} />
      )}

      {/* 解析結果セクション */}
      {session.status === 'COMPLETED' && (
        <div className="mt-8">
          {analysisLoading ? (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center justify-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                <p className="text-gray-500">{t('analysis.loading')}</p>
              </div>
            </div>
          ) : analysis && analysis.sessionScore ? (
            <div className="space-y-6">
              {/* Score Dashboard */}
              <ScoreDashboard score={analysis.sessionScore} />

              {/* Performance Radar Chart */}
              <PerformanceRadar score={analysis.sessionScore} />

              {/* Detail Statistics */}
              <DetailStats
                audioSummary={analysis.audioSummary}
                emotionSummary={analysis.emotionSummary}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('analysis.notAvailable.title')}
              </h3>
              <p className="text-gray-600 mb-6">{t('analysis.notAvailable.description')}</p>
              <button
                onClick={handleTriggerAnalysis}
                disabled={triggeringAnalysis}
                data-testid="analysis-trigger-button"
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {triggeringAnalysis ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t('analysis.triggering')}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {t('analysis.trigger')}
                  </>
                )}
              </button>
              {analysisError && <p className="mt-4 text-sm text-red-600">{analysisError}</p>}
            </div>
          )}
        </div>
      )}

      {/* レポート生成セクション */}
      {session.status === 'COMPLETED' && analysis && analysis.sessionScore && (
        <div className="mt-6">
          <ReportGenerator sessionId={sessionId} sessionStatus={session.status} />
        </div>
      )}
    </div>
  );
}
