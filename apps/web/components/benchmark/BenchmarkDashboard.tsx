'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { getBenchmark } from '@/lib/api/benchmark';
import { useI18n } from '@/lib/i18n/provider';
import type { BenchmarkData } from '@prance/shared';
import { BenchmarkMetricCard } from './BenchmarkMetricCard';

interface Props {
  sessionId: string;
  scenarioId: string;
  scores: {
    overallScore: number;
    emotionScore: number;
    audioScore: number;
    contentScore: number;
    deliveryScore: number;
  };
  userAttributes?: {
    age?: number;
    gender?: string;
    experience?: string;
    industry?: string;
    role?: string;
  };
}

export function BenchmarkDashboard({ sessionId, scenarioId, scores, userAttributes }: Props) {
  const { t } = useI18n();
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBenchmark = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getBenchmark({
        scenarioId,
        userScore: scores,
        userAttributes,
      });

      if (response.success) {
        setBenchmark(response.data);
      } else {
        setError(response.error.message);
      }
    } catch (err) {
      console.error('Failed to load benchmark:', err);
      setError(err instanceof Error ? err.message : 'Failed to load benchmark data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenchmark();
  }, [sessionId, scenarioId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">{t('benchmark.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!benchmark || !benchmark.sufficientData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('benchmark.title')}</CardTitle>
          <CardDescription>{t('benchmark.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">{t('benchmark.insufficientData')}</p>
              {benchmark && (
                <p className="text-xs text-muted-foreground">
                  {t('benchmark.sampleSize', { count: benchmark.sampleSize })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('benchmark.title')}</CardTitle>
              <CardDescription>{t('benchmark.description')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadBenchmark}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('benchmark.actions.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>{t('benchmark.sampleSize', { count: benchmark.sampleSize })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {benchmark.metrics.map((metric) => (
          <BenchmarkMetricCard key={metric.metric} metric={metric} />
        ))}
      </div>

      {/* Comparison Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('benchmark.comparison.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {benchmark.metrics.map((metric) => {
              const diff = metric.value - metric.mean;
              const diffPercent = ((diff / metric.mean) * 100).toFixed(1);
              const isAbove = diff > 0;
              const isSignificant = Math.abs(diff) > metric.stdDev * 0.5;

              if (!isSignificant) return null;

              return (
                <div key={metric.metric} className="flex items-center justify-between py-2 border-b">
                  <span className="font-medium">{t(`benchmark.metrics.${metric.metric}`)}</span>
                  <span className={isAbove ? 'text-green-600' : 'text-orange-600'}>
                    {isAbove ? '+' : ''}
                    {diffPercent}% {isAbove ? '↑' : '↓'}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
