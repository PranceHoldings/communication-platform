'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';
import type { BenchmarkData } from '@prance/shared';

interface Props {
  benchmark: BenchmarkData;
}

interface Insight {
  category: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  percentile: number;
}

export function AIInsights({ benchmark }: Props) {
  const { t } = useI18n();
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    if (!benchmark.sufficientData) {
      setInsights([]);
      return;
    }

    // Generate AI-powered insights based on benchmark data
    const generated: Insight[] = [];

    benchmark.metrics.forEach((metric) => {
      if (metric.percentileRank < 25) {
        // High priority: Below 25th percentile
        generated.push({
          category: metric.metric,
          priority: 'high',
          message: t('benchmark.insights.lowPerformance', {
            metric: t(`benchmark.metrics.${metric.metric}`),
          }),
          suggestion: t(`benchmark.insights.suggestions.${metric.metric}`),
          percentile: metric.percentileRank,
        });
      } else if (metric.percentileRank < 50) {
        // Medium priority: Below median
        generated.push({
          category: metric.metric,
          priority: 'medium',
          message: t('benchmark.insights.belowAverage', {
            metric: t(`benchmark.metrics.${metric.metric}`),
          }),
          suggestion: t(`benchmark.insights.suggestions.${metric.metric}`),
          percentile: metric.percentileRank,
        });
      }
    });

    // Sort by priority (high > medium > low) then by percentile (ascending)
    generated.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.percentile - b.percentile;
    });

    setInsights(generated);
  }, [benchmark, t]);

  if (!benchmark.sufficientData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('benchmark.insights.title')}</CardTitle>
          <CardDescription>{t('benchmark.insights.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">{t('benchmark.insufficientData')}</div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('benchmark.insights.title')}</CardTitle>
          <CardDescription>{t('benchmark.insights.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-900">{t('benchmark.insights.noIssues')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return <AlertTriangle className="h-5 w-5 text-red-600" />;
    if (priority === 'medium') return <Lightbulb className="h-5 w-5 text-yellow-600" />;
    return <Lightbulb className="h-5 w-5 text-blue-600" />;
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return 'border-red-200 bg-red-50';
    if (priority === 'medium') return 'border-yellow-200 bg-yellow-50';
    return 'border-blue-200 bg-blue-50';
  };

  const getPriorityBadgeVariant = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return 'destructive';
    if (priority === 'medium') return 'default';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('benchmark.insights.title')}</CardTitle>
        <CardDescription>{t('benchmark.insights.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight, index) => (
          <div
            key={`${insight.category}-${index}`}
            className={`p-4 border rounded-lg ${getPriorityColor(insight.priority)}`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">{getPriorityIcon(insight.priority)}</div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getPriorityBadgeVariant(insight.priority)} className="text-xs">
                    {t(`benchmark.insights.priority.${insight.priority}`)}
                  </Badge>
                  <span className="text-sm font-semibold">{insight.message}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {insight.suggestion}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {t('benchmark.percentile')}: {insight.percentile.toFixed(0)}%
                  </span>
                  <span>•</span>
                  <span>{t(`benchmark.metrics.${insight.category}`)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
