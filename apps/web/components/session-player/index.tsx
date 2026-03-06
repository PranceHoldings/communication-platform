'use client';

import { useState, useEffect } from 'react';
import { Session } from '@/lib/api/sessions';
import { Avatar } from '@/lib/api/avatars';
import { Scenario } from '@/lib/api/scenarios';

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
}

export function SessionPlayer({ session, avatar, scenario }: SessionPlayerProps) {
  const [status, setStatus] = useState<SessionPlayerStatus>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  // セッションが既に完了している場合
  useEffect(() => {
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
    } else if (session.status === 'ACTIVE') {
      setStatus('READY');
    }
  }, [session]);

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
    if (status === 'IDLE') {
      setStatus('READY');
    } else if (status === 'READY' || status === 'PAUSED') {
      setStatus('ACTIVE');
      // TODO: WebSocket接続、音声録音開始
    }
  };

  const handlePause = () => {
    if (status === 'ACTIVE') {
      setStatus('PAUSED');
      // TODO: 音声録音一時停止
    }
  };

  const handleStop = () => {
    if (status === 'ACTIVE' || status === 'PAUSED') {
      setStatus('COMPLETED');
      // TODO: セッション終了処理、録画保存
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
        return 'Not Started';
      case 'READY':
        return 'Ready';
      case 'ACTIVE':
        return 'In Progress';
      case 'PAUSED':
        return 'Paused';
      case 'COMPLETED':
        return 'Completed';
      default:
        return 'Unknown';
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
              Avatar: <span className="font-medium">{avatar.name}</span> • Category:{' '}
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
          <h3 className="text-lg font-semibold mb-4">Avatar View</h3>
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
                <p className="text-gray-400 text-sm mt-1">Avatar will appear here</p>
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
              Microphone: <span className="font-medium ml-1">{status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
              Camera: <span className="font-medium ml-1">Off</span>
            </div>
          </div>
        </div>

        {/* 右側: トランスクリプト */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Conversation Transcript</h3>
          <div className="h-[400px] overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
            {transcript.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p>No conversation yet</p>
                <p className="text-sm mt-2">Start the session to begin</p>
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
                      {item.speaker === 'AI' ? `🤖 ${avatar.name}` : '👤 You'}
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
              Start Session
            </button>
          )}

          {(status === 'READY' || status === 'PAUSED') && (
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
                {status === 'PAUSED' ? 'Resume' : 'Start'}
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
                Stop
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
                Pause
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
                Stop
              </button>
            </>
          )}

          {status === 'COMPLETED' && (
            <div className="text-center py-2">
              <p className="text-lg font-semibold text-gray-700">Session Completed</p>
              <p className="text-sm text-gray-500 mt-1">
                Duration: {formatTime(currentTime)} • {transcript.length} messages
              </p>
            </div>
          )}
        </div>

        {/* ヘルプテキスト */}
        {status === 'IDLE' && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>Click "Start Session" to begin the conversation with {avatar.name}</p>
          </div>
        )}

        {status === 'ACTIVE' && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>🎤 Listening... Speak clearly into your microphone</p>
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
