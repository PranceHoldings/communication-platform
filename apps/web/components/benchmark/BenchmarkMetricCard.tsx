'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/i18n/provider';
import type { BenchmarkMetric } from '@prance/shared';

interface Props {
  metric: BenchmarkMetric;
}

export function BenchmarkMetricCard({ metric }: Props) {
  const { t } = useI18n();

  const getPerformanceLevel = (percentile: number) => {
    if (percentile >= 90)
      return { label: t('benchmark.excellent'), color: 'text-green-600', bgColor: 'bg-green-50' };
    if (percentile >= 75)
      return { label: t('benchmark.good'), color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (percentile >= 50)
      return {
        label: t('benchmark.average_level'),
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
      };
    if (percentile >= 25)
      return {
        label: t('benchmark.belowAverage'),
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
      };
    return {
      label: t('benchmark.needsImprovement'),
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    };
  };

  const performance = getPerformanceLevel(metric.percentileRank);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t(`benchmark.metrics.${metric.metric}`)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Your Score */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t('benchmark.yourScore')}</span>
            <span className="font-bold text-lg">{metric.value.toFixed(1)}</span>
          </div>
          <Progress value={metric.value} max={100} className="h-2" />
        </div>

        {/* Statistics */}
        <div className="space-y-1 text-sm border-t pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('benchmark.average')}</span>
            <span className="font-medium">{metric.mean.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('benchmark.median')}</span>
            <span className="font-medium">{metric.median.toFixed(1)}</span>
          </div>
        </div>

        {/* Performance Level */}
        <div className={`rounded-lg p-3 ${performance.bgColor}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{t('benchmark.percentile')}</span>
            <span className={`text-lg font-bold ${performance.color}`}>
              {metric.percentileRank.toFixed(0)}%
            </span>
          </div>
          <div className={`text-xs mt-1 ${performance.color}`}>{performance.label}</div>
        </div>

        {/* Additional Stats (Collapsible) */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            {t('benchmark.statistics.stdDev')}: {metric.stdDev.toFixed(2)}
          </summary>
          <div className="mt-2 space-y-1 pl-2">
            <div className="flex justify-between">
              <span>{t('benchmark.statistics.min')}</span>
              <span>{metric.min.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('benchmark.statistics.max')}</span>
              <span>{metric.max.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('benchmark.statistics.quartile25')}</span>
              <span>{metric.p25.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('benchmark.statistics.quartile75')}</span>
              <span>{metric.p75.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('benchmark.zScore')}</span>
              <span>{metric.zScore.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('benchmark.deviationValue')}</span>
              <span>{metric.deviationValue.toFixed(1)}</span>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
