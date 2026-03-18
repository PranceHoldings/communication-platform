'use client';

import { AudioAnalysisSummary, EmotionAnalysisSummary } from '@/lib/api/analysis';
import { useI18n } from '@/lib/i18n/provider';

interface DetailStatsProps {
  audioSummary: AudioAnalysisSummary;
  emotionSummary: EmotionAnalysisSummary;
}

export function DetailStats({ audioSummary, emotionSummary }: DetailStatsProps) {
  const { t } = useI18n();

  const audioStats = [
    {
      label: t('analysis.stats.speakingRate'),
      value: `${Math.round(audioSummary.averageSpeakingRate)} WPM`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      label: t('analysis.stats.volume'),
      value: `${Math.round(audioSummary.averageVolume)} dB`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      ),
    },
    {
      label: t('analysis.stats.fillerWords'),
      value: audioSummary.totalFillerWords,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      label: t('analysis.stats.pauses'),
      value: audioSummary.totalPauses,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="detail-stats">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('analysis.stats.title')}</h2>

      {/* Audio Statistics */}
      <div className="mb-8" data-testid="audio-stats-section">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('analysis.stats.audioAnalysis')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {audioStats.map((stat, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg"
              data-testid={`audio-stat-${index}`}
            >
              <div className="text-indigo-600 mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-600 text-center mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Emotion Statistics */}
      <div data-testid="emotion-stats-section">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('analysis.stats.emotionAnalysis')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dominant Emotion */}
          <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg" data-testid="dominant-emotion">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-gray-600">{t('analysis.stats.dominantEmotion')}</span>
            </div>
            <div className="text-2xl font-bold text-purple-700 capitalize">
              {emotionSummary.dominantEmotion}
            </div>
          </div>

          {/* Average Confidence */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-lg" data-testid="average-confidence">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-gray-600">{t('analysis.stats.avgConfidence')}</span>
            </div>
            <div className="text-2xl font-bold text-green-700">
              {Math.round(emotionSummary.averageConfidence)}%
            </div>
          </div>
        </div>

        {/* Emotion Distribution */}
        {Object.keys(emotionSummary.emotionDistribution).length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg" data-testid="emotion-distribution">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {t('analysis.stats.emotionDistribution')}
            </h4>
            <div className="space-y-2">
              {Object.entries(emotionSummary.emotionDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([emotion, percentage]) => (
                  <div key={emotion} className="flex items-center" data-testid={`emotion-bar-${emotion}`}>
                    <div className="w-24 text-sm text-gray-600 capitalize">{emotion}</div>
                    <div className="flex-1 mx-3">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-sm font-semibold text-gray-700 text-right">
                      {Math.round(percentage)}%
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
