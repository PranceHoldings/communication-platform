'use client';

import { useRef, useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/provider';

export interface Recording {
  id: string;
  type: 'USER' | 'AVATAR' | 'COMBINED';
  s3Key: string;
  s3Url: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  fileSizeBytes: number;
  durationSec?: number;
  format?: string;
  resolution?: string;
  videoChunksCount?: number;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  processedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface Transcript {
  id: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestampStart: number;
  timestampEnd: number;
  confidence?: number;
  highlight?: 'POSITIVE' | 'NEGATIVE' | 'IMPORTANT';
}

interface RecordingPlayerProps {
  recording: Recording;
  transcripts: Transcript[];
}

export function RecordingPlayer({ recording, transcripts }: RecordingPlayerProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);

  // 録画処理ステータスチェック
  if (recording.processingStatus === 'PENDING' || recording.processingStatus === 'PROCESSING') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mb-4"></div>
        <p className="text-yellow-800 font-medium">
          {t('sessions.player.recording.messages.processing')}
        </p>
        <p className="text-yellow-600 text-sm mt-2">
          {t('sessions.player.recording.messages.processingDescription')}
        </p>
      </div>
    );
  }

  if (recording.processingStatus === 'ERROR') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium mb-2">
          {t('sessions.player.recording.messages.error')}
        </h3>
        <p className="text-red-600 text-sm">
          {recording.errorMessage || t('sessions.player.recording.messages.errorUnknown')}
        </p>
      </div>
    );
  }

  const videoUrl = recording.cdnUrl || recording.s3Url;

  // 動画の時間更新
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // アクティブなトランスクリプトを特定
      const active = transcripts.find(
        (t) => time >= t.timestampStart && time <= t.timestampEnd
      );
      setActiveTranscriptId(active?.id || null);
    }
  };

  // 動画メタデータ読み込み
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // 再生/一時停止トグル
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // シークバー操作
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 再生速度変更
  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  // 音量変更
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setVolume(vol);
    }
  };

  // トランスクリプトクリックでシーク
  const handleTranscriptClick = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // 時間フォーマット (秒 → MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* ビデオプレイヤー */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* コントロールバー */}
        <div className="bg-gray-800 p-4 space-y-3">
          {/* シークバー */}
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-mono w-12">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-white text-sm font-mono w-12">{formatTime(duration)}</span>
          </div>

          {/* コントロールボタン */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 再生/一時停止 */}
              <button
                onClick={togglePlay}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* 再生速度 */}
              <div className="flex items-center gap-2">
                <span className="text-white text-sm">{t('sessions.player.recording.speed')}:</span>
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handlePlaybackRateChange(rate)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      playbackRate === rate
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* 音量 */}
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* トランスクリプト */}
      {transcripts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sessions.player.transcript.title')}</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transcripts.map((transcript) => (
              <button
                key={transcript.id}
                onClick={() => handleTranscriptClick(transcript.timestampStart)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  activeTranscriptId === transcript.id
                    ? 'bg-indigo-50 border-2 border-indigo-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 font-mono mt-1 w-16">
                    {formatTime(transcript.timestampStart)}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium ${
                          transcript.speaker === 'USER' ? 'text-blue-600' : 'text-purple-600'
                        }`}
                      >
                        {transcript.speaker === 'USER' ? t('sessions.player.transcript.you') : 'AI'}
                      </span>
                      {transcript.confidence && (
                        <span className="text-xs text-gray-400">
                          {Math.round(transcript.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800">{transcript.text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 録画情報 */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="font-medium">{t('sessions.player.recording.format')}:</span>{' '}
            {recording.format || 'webm'}
          </div>
          <div>
            <span className="font-medium">{t('sessions.player.recording.resolution')}:</span>{' '}
            {recording.resolution || '1280x720'}
          </div>
          <div>
            <span className="font-medium">{t('sessions.player.recording.size')}:</span>{' '}
            {(recording.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
          </div>
          {recording.durationSec && (
            <div>
              <span className="font-medium">{t('sessions.player.recording.duration')}:</span>{' '}
              {formatTime(recording.durationSec)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
