'use client';

import { SessionScore } from '@/lib/api/analysis';
import { useI18n } from '@/lib/i18n/provider';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface PerformanceRadarProps {
  score: SessionScore;
}

export function PerformanceRadar({ score }: PerformanceRadarProps) {
  const { t } = useI18n();

  const radarData = [
    {
      subject: t('analysis.radar.stability'),
      value: score.emotionStability,
      fullMark: 100,
    },
    {
      subject: t('analysis.radar.positivity'),
      value: score.emotionPositivity,
      fullMark: 100,
    },
    {
      subject: t('analysis.radar.confidence'),
      value: score.confidence,
      fullMark: 100,
    },
    {
      subject: t('analysis.radar.clarity'),
      value: score.clarity,
      fullMark: 100,
    },
    {
      subject: t('analysis.radar.fluency'),
      value: score.fluency,
      fullMark: 100,
    },
    {
      subject: t('analysis.radar.pacing'),
      value: score.pacing,
      fullMark: 100,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {t('analysis.radar.title')}
      </h2>

      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Radar
            name={t('analysis.radar.score')}
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.6}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '0.5rem',
            }}
            formatter={(value) => [`${Math.round(Number(value) || 0)}`, t('analysis.radar.score')]}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        {radarData.map((item) => (
          <div key={item.subject} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-700">{item.subject}</span>
            <span className="font-semibold text-indigo-600">{Math.round(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
