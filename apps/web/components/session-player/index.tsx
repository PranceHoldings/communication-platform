'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Session } from '@/lib/api/sessions';
import { Avatar } from '@/lib/api/avatars';
import { Scenario } from '@/lib/api/scenarios';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';

type SessionPlayerStatus = 'IDLE' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

interface SessionPlayerProps {
  session: Session;
  avatar: Avatar;
  scenario: Scenario;
}

interface TranscriptItem {
  id: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestamp: number;
  partial?: boolean;
}

export function SessionPlayer({ session, avatar, scenario }: SessionPlayerProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<SessionPlayerStatus>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [token, setToken] = useState<string | null>(null);

  // トークン取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('accessToken');
      setToken(accessToken);
    }
  }, []);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleTranscript = useCallback((message) => {
    // リアルタイム文字起こし
    if (message.type === 'transcript_partial') {
      // 部分的なトランスクリプト（リアルタイム更新）
      setTranscript((prev) => {
        const lastItem = prev[prev.length - 1];
        if (lastItem && lastItem.partial && lastItem.speaker === message.speaker) {
          // 既存の部分トランスクリプトを更新
          return [
            ...prev.slice(0, -1),
            {
              ...lastItem,
              text: message.text,
              timestamp: message.timestamp || Date.now(),
            },
          ];
        } else {
          // 新しい部分トランスクリプトを追加
          return [
            ...prev,
            {
              id: `partial-${Date.now()}`,
              speaker: message.speaker,
              text: message.text,
              timestamp: message.timestamp || Date.now(),
              partial: true,
            },
          ];
        }
      });
    } else if (message.type === 'transcript_final') {
      // 確定トランスクリプト
      setTranscript((prev) => {
        const filtered = prev.filter((item) => !item.partial || item.speaker !== message.speaker);
        return [
          ...filtered,
          {
            id: `final-${Date.now()}`,
            speaker: message.speaker,
            text: message.text,
            timestamp: message.timestamp_start || Date.now(),
            partial: false,
          },
        ];
      });
    }
  }, []);

  const handleAvatarResponse = useCallback((message) => {
    // AIアバターの応答
    setTranscript((prev) => [
      ...prev,
      {
        id: `ai-${message.timestamp}`,
        speaker: 'AI',
        text: message.text,
        timestamp: message.timestamp,
      },
    ]);
  }, []);

  const handleProcessingUpdate = useCallback((message) => {
    // 処理状況の更新（オプション：UI表示用）
    console.log('Processing:', message.stage, message.progress);
  }, []);

  const handleSessionComplete = useCallback((message) => {
    // セッション完了
    setStatus('COMPLETED');
    toast.success('Session completed successfully!');
  }, []);

  const handleError = useCallback((message) => {
    // エラー処理
    console.error('WebSocket error:', message);
    toast.error(`Error: ${message.message}`);
  }, []);

  // WebSocket統合
  const {
    isConnected,
    isConnecting,
    error: wsError,
    connect,
    disconnect,
    sendUserSpeech,
    endSession,
  } = useWebSocket({
    sessionId: session.id,
    token: token || '',
    autoConnect: false,
    onTranscript: handleTranscript,
    onAvatarResponse: handleAvatarResponse,
    onProcessingUpdate: handleProcessingUpdate,
    onSessionComplete: handleSessionComplete,
    onError: handleError,
  });

  // セッションが既に完了している場合のみ特別処理
  useEffect(() => {
    console.log('[SessionPlayer] Session status effect', { sessionStatus: session.status, playerStatus: status, token: token ? 'exists' : 'missing' });

    if (session.status === 'COMPLETED') {
      setStatus('COMPLETED');
      // Load existing transcript if available
      if (session.transcripts) {
        const items: TranscriptItem[] = session.transcripts.map((t) => ({
          id: t.id,
          speaker: t.speaker,
          text: t.text,
          timestamp: t.timestampStart,
        }));
        setTranscript(items);
      }
    }
    // セッションがACTIVE状態でも、ユーザーが明示的に「Start」を押すまで自動接続しない
  }, [session, status]);

  // Auto-connect when status becomes READY and not yet connecting
  useEffect(() => {
    if (status === 'READY' && !isConnecting && !isConnected && token) {
      console.log('[SessionPlayer] Status is READY, initiating WebSocket connection...');
      connect();
    }
  }, [status, isConnecting, isConnected, token, connect]);

  // WebSocket接続完了時にACTIVE状態に自動遷移
  useEffect(() => {
    if (isConnected && status === 'READY') {
      setStatus('ACTIVE');
      toast.success(t('sessions.player.messages.sessionStarted'));
    }
  }, [isConnected, status, t]);

  // Connection timeout - 30秒以内に接続できない場合はタイムアウト
  useEffect(() => {
    if (status === 'READY' && !isConnected) {
      const timeoutId = setTimeout(() => {
        if (status === 'READY' && !isConnected) {
          console.error('[SessionPlayer] Connection timeout after 30 seconds');
          setStatus('IDLE');
          toast.error(t('sessions.player.messages.connectionTimeout'));
        }
      }, 30000); // 30 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [status, isConnected, t]);

  // タイマー（セッション実行中）
  useEffect(() => {
    if (status === 'ACTIVE') {
      const interval = setInterval(() => {
        setCurrentTime((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status]);

  const handleStart = () => {
    console.log('[SessionPlayer] handleStart called', { token: token ? 'exists' : 'missing', status });

    if (!token) {
      console.error('[SessionPlayer] No token found!');
      toast.error(t('sessions.player.messages.authRequired'));
      return;
    }

    if (status === 'IDLE') {
      console.log('[SessionPlayer] Starting WebSocket connection...');
      setStatus('READY');
      // WebSocket接続はuseEffectで自動的に開始される（重複呼び出しを防ぐため削除）
      toast.info(t('sessions.player.websocket.connecting'));
      // 接続完了後、useEffectで自動的にACTIVE状態に遷移
    } else if (status === 'PAUSED') {
      setStatus('ACTIVE');
      // セッション再開
      toast.success(t('sessions.player.messages.sessionResumed'));
      // TODO: 音声録音再開
    }
  };

  const handlePause = () => {
    if (status === 'ACTIVE') {
      setStatus('PAUSED');
      toast.info(t('sessions.player.status.paused'));
      // TODO: 音声録音一時停止
    }
  };

  const handleStop = () => {
    if (status === 'ACTIVE' || status === 'PAUSED' || status === 'READY') {
      setStatus('COMPLETED');
      // WebSocket経由でセッション終了通知（接続されている場合のみ）
      if (isConnected) {
        endSession();
      }
      // WebSocket切断
      disconnect();
      toast.success(t('sessions.player.messages.sessionEnded'));
      // TODO: 録画保存
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (s: SessionPlayerStatus): string => {
    switch (s) {
      case 'IDLE':
        return 'text-gray-600';
      case 'READY':
        return 'text-blue-600';
      case 'ACTIVE':
        return 'text-green-600';
      case 'PAUSED':
        return 'text-yellow-600';
      case 'COMPLETED':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = (s: SessionPlayerStatus): string => {
    switch (s) {
      case 'IDLE':
        return t('sessions.player.status.notStarted');
      case 'READY':
        return t('sessions.player.status.ready');
      case 'ACTIVE':
        return t('sessions.player.status.inProgress');
      case 'PAUSED':
        return t('sessions.player.status.paused');
      case 'COMPLETED':
        return t('sessions.player.status.completed');
      default:
        return t('sessions.player.status.unknown');
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{scenario.title}</h2>
            <p className="text-gray-600 mt-1">
              {t('sessions.player.info.avatar')}: <span className="font-medium">{avatar.name}</span> • {t('sessions.player.info.category')}:{' '}
              <span className="font-medium">{scenario.category}</span>
            </p>
          </div>
          <div className="text-right">
            <div className={`text-lg font-semibold ${getStatusColor(status)}`}>{getStatusText(status)}</div>
            <div className="text-2xl font-mono font-bold text-gray-900 mt-1">{formatTime(currentTime)}</div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: アバター表示エリア */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sessions.player.avatar.title')}</h3>
          <div className="aspect-video bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            {avatar.thumbnailUrl ? (
              <img
                src={avatar.thumbnailUrl}
                alt={avatar.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">👤</div>
                <p className="text-gray-500 font-medium">{avatar.name}</p>
                <p className="text-gray-400 text-sm mt-1">{t('sessions.player.avatar.placeholder')}</p>
              </div>
            )}
          </div>

          {/* マイク・カメラステータス（将来実装） */}
          <div className="mt-4 flex items-center justify-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
              {t('sessions.player.avatar.microphone')}: <span className="font-medium ml-1">{status === 'ACTIVE' ? t('sessions.player.avatar.active') : t('sessions.player.avatar.inactive')}</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
              {t('sessions.player.avatar.camera')}: <span className="font-medium ml-1">{t('sessions.player.avatar.off')}</span>
            </div>
          </div>
        </div>

        {/* 右側: トランスクリプト */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sessions.player.transcript.title')}</h3>
          <div className="h-[400px] overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
            {transcript.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p>{t('sessions.player.transcript.empty')}</p>
                <p className="text-sm mt-2">{t('sessions.player.transcript.emptyDescription')}</p>
              </div>
            ) : (
              transcript.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg ${
                    item.speaker === 'AI'
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'bg-green-50 border border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">
                      {item.speaker === 'AI' ? `🤖 ${avatar.name}` : `👤 ${t('sessions.player.transcript.you')}`}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(item.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-900">{item.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WebSocket接続状態表示 */}
      {(isConnecting || isConnected || wsError) && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isConnecting && (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span className="text-sm text-gray-600">{t('sessions.player.websocket.connectingWebSocket')}</span>
                </>
              )}
              {isConnected && !isConnecting && (
                <>
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600 font-medium">{t('sessions.player.websocket.connected')}</span>
                </>
              )}
              {wsError && (
                <>
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-red-600">{wsError}</span>
                </>
              )}
            </div>
            {status === 'ACTIVE' && isConnected && (
              <button
                onClick={() => {
                  // デモ用：テストメッセージ送信
                  sendUserSpeech('This is a test message from the UI', 0.95);
                  toast.success(t('sessions.player.messages.testMessageSent'));
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {t('sessions.player.actions.sendTestMessage')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* コントロールパネル */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center space-x-4">
          {status === 'IDLE' && (
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              {t('sessions.player.actions.start')}
            </button>
          )}

          {status === 'READY' && (
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              <span className="text-lg text-gray-600">{t('sessions.player.websocket.connecting')}</span>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center"
              >
                {t('sessions.player.actions.cancel')}
              </button>
            </div>
          )}

          {status === 'PAUSED' && (
            <>
              <button
                onClick={handleStart}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.resume')}
              </button>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.stop')}
              </button>
            </>
          )}

          {status === 'ACTIVE' && (
            <>
              <button
                onClick={handlePause}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.pause')}
              </button>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.stop')}
              </button>
            </>
          )}

          {status === 'COMPLETED' && (
            <div className="text-center py-2">
              <p className="text-lg font-semibold text-gray-700">{t('sessions.player.completed.title')}</p>
              <p className="text-sm text-gray-500 mt-1">
                {t('sessions.player.completed.duration')}: {formatTime(currentTime)} • {t('sessions.player.completed.messageCount', { count: transcript.length })}
              </p>
            </div>
          )}
        </div>

        {/* ヘルプテキスト */}
        {status === 'IDLE' && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>{t('sessions.player.help.startSession', { avatarName: avatar.name })}</p>
          </div>
        )}

        {status === 'ACTIVE' && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>{t('sessions.player.help.listening')}</p>
          </div>
        )}
      </div>

      {/* セッション情報 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Session Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Session ID</p>
            <p className="font-mono text-xs mt-1">{session.id}</p>
          </div>
          <div>
            <p className="text-gray-600">Scenario</p>
            <p className="font-medium mt-1">{scenario.title}</p>
          </div>
          <div>
            <p className="text-gray-600">Language</p>
            <p className="font-medium mt-1">{scenario.language.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-gray-600">Created</p>
            <p className="font-medium mt-1">{new Date(session.startedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
