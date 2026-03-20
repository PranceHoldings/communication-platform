'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getSessionHistory } from '@/lib/api/benchmark';
import { useI18n } from '@/lib/i18n/provider';
import type { SessionHistoryItem } from '@prance/shared';

interface Props {
  userId: string;
  scenarioId: string;
}

export function GrowthChart({ userId, scenarioId }: Props) {
  const { t } = useI18n();
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await getSessionHistory(userId, scenarioId);
        if (response.success) {
          // Sort by completedAt descending (newest first)
          const sorted = response.data.sort(
            (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
          );
          setHistory(sorted);
        }
      } catch (error) {
        console.error('Failed to load session history:', error);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [userId, scenarioId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">{t('benchmark.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('benchmark.growth.title')}</CardTitle>
          <CardDescription>{t('benchmark.growth.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-center">{t('benchmark.growth.noHistory')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate trend
  const getTrend = () => {
    if (history.length < 2) return 'stable';

    const recent = history.slice(0, 3);
    const older = history.slice(-3);

    const recentAvg = recent.reduce((sum, s) => sum + s.overallScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.overallScore, 0) / older.length;

    const diff = recentAvg - olderAvg;

    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  };

  const trend = getTrend();
  const latestScore = history[0]?.overallScore || 0;
  const previousScore = history[1]?.overallScore || latestScore;
  const change = latestScore - previousScore;

  const getTrendIcon = () => {
    if (trend === 'improving')
      return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (trend === 'declining')
      return <TrendingDown className="h-5 w-5 text-red-600" />;
    return <Minus className="h-5 w-5 text-yellow-600" />;
  };

  const getTrendColor = () => {
    if (trend === 'improving') return 'text-green-600';
    if (trend === 'declining') return 'text-red-600';
    return 'text-yellow-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('benchmark.growth.title')}</CardTitle>
        <CardDescription>{t('benchmark.growth.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trend Summary */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-3">
            {getTrendIcon()}
            <div>
              <div className="text-sm font-medium">{t('benchmark.growth.trend')}</div>
              <div className={`text-lg font-bold ${getTrendColor()}`}>
                {t(`benchmark.growth.${trend}`)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t('benchmark.growth.change')}</div>
            <div
              className={`text-lg font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {change >= 0
                ? t('benchmark.growth.increase', { value: change.toFixed(1) })
                : t('benchmark.growth.decrease', { value: change.toFixed(1) })}
            </div>
          </div>
        </div>

        {/* Session History List */}
        <div className="space-y-2">
          {history.slice(0, 10).map((session, index) => (
            <div
              key={session.sessionId}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                  {history.length - index}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {new Date(session.completedAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.floor(session.duration / 60)}m {session.duration % 60}s
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{session.overallScore.toFixed(1)}</div>
                {index < history.length - 1 && (
                  <div
                    className={`text-xs ${
                      session.overallScore - history[index + 1]!.overallScore >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {session.overallScore - history[index + 1]!.overallScore >= 0 ? '+' : ''}
                    {(session.overallScore - history[index + 1]!.overallScore).toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {history.length > 10 && (
          <div className="text-center text-xs text-muted-foreground">
            {t('benchmark.growth.showing', { shown: 10, total: history.length })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
