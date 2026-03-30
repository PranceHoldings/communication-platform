'use client';

import { SessionScore, getScoreLevel } from '@/lib/api/analysis';
import { useI18n } from '@/lib/i18n/provider';

interface ScoreDashboardProps {
  score: SessionScore;
}

export function ScoreDashboard({ score }: ScoreDashboardProps) {
  const { t } = useI18n();
  const scoreLevel = getScoreLevel(score.overallScore);

  const categoryScores = [
    { label: t('analysis.scores.emotion'), value: score.emotionScore, key: 'emotion' },
    { label: t('analysis.scores.audio'), value: score.audioScore, key: 'audio' },
    { label: t('analysis.scores.content'), value: score.contentScore, key: 'content' },
    { label: t('analysis.scores.delivery'), value: score.deliveryScore, key: 'delivery' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="score-dashboard">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('analysis.dashboard.title')}</h2>

      {/* Overall Score */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative">
          <svg className="w-48 h-48 transform -rotate-90">
            <circle cx="96" cy="96" r="88" stroke="#e5e7eb" strokeWidth="12" fill="none" />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke={
                score.overallScore >= 80
                  ? '#10b981'
                  : score.overallScore >= 60
                    ? '#3b82f6'
                    : score.overallScore >= 40
                      ? '#f59e0b'
                      : '#ef4444'
              }
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${(score.overallScore / 100) * 552.64} 552.64`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-gray-900" data-testid="overall-score">
              {Math.round(score.overallScore)}
            </div>
            <div className="text-sm text-gray-500">{t('analysis.dashboard.outOf100')}</div>
            <div
              className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${scoreLevel.bgColor} ${scoreLevel.color}`}
              data-testid="score-level"
            >
              {scoreLevel.label}
            </div>
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="category-scores">
        {categoryScores.map(category => (
          <div
            key={category.key}
            className="text-center p-4 bg-gray-50 rounded-lg"
            data-testid={`category-score-${category.key}`}
          >
            <div className="text-2xl font-bold text-gray-900">{Math.round(category.value)}</div>
            <div className="text-sm text-gray-600 mt-1">{category.label}</div>
          </div>
        ))}
      </div>

      {/* Strengths and Improvements */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div data-testid="strengths-section">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {t('analysis.dashboard.strengths')}
          </h3>
          <ul className="space-y-2">
            {score.strengths.map((strength, index) => (
              <li
                key={index}
                className="text-sm text-gray-700 flex items-start"
                data-testid={`strength-${index}`}
              >
                <span className="text-green-500 mr-2">•</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div data-testid="improvements-section">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {t('analysis.dashboard.improvements')}
          </h3>
          <ul className="space-y-2">
            {score.improvements.map((improvement, index) => (
              <li
                key={index}
                className="text-sm text-gray-700 flex items-start"
                data-testid={`improvement-${index}`}
              >
                <span className="text-orange-500 mr-2">•</span>
                {improvement}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
