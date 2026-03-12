/**
 * Session Analysis API
 * Phase 2.2.5: Frontend UI Integration
 */

import { apiClient } from './client';

export interface EmotionScore {
  type: string;
  confidence: number;
}

export interface AudioAnalysisSummary {
  averageVolume: number;
  averageSpeakingRate: number;
  totalFillerWords: number;
  totalPauses: number;
}

export interface EmotionAnalysisSummary {
  dominantEmotion: string;
  averageConfidence: number;
  emotionDistribution: Record<string, number>;
}

export interface SessionScore {
  id: string;
  sessionId: string;
  overallScore: number;
  emotionScore: number;
  audioScore: number;
  contentScore: number;
  deliveryScore: number;
  emotionStability: number;
  emotionPositivity: number;
  confidence: number;
  engagement: number;
  clarity: number;
  fluency: number;
  pacing: number;
  volume: number;
  relevance: number;
  structure: number;
  completeness: number;
  strengths: string[];
  improvements: string[];
  createdAt: string;
}

export interface AnalysisResult {
  sessionId: string;
  emotionAnalyses: any[];
  audioAnalyses: any[];
  sessionScore: SessionScore;
  emotionSummary: EmotionAnalysisSummary;
  audioSummary: AudioAnalysisSummary;
  isProcessing: boolean;
  processingStatus?: string;
}

export interface ScoreLevel {
  level: 'excellent' | 'very_good' | 'good' | 'fair' | 'needs_improvement' | 'poor';
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Get session analysis results
 */
export async function getAnalysis(sessionId: string): Promise<AnalysisResult> {
  const response = await apiClient.get<AnalysisResult>(`/sessions/${sessionId}/analysis`);
  return apiClient.unwrapResponse(response);
}

/**
 * Trigger session analysis manually
 */
export async function triggerAnalysis(sessionId: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(`/sessions/${sessionId}/analyze`);
  return apiClient.unwrapResponse(response);
}

/**
 * Get session score only (lightweight)
 */
export async function getScore(sessionId: string): Promise<SessionScore & { scoreLevel: ScoreLevel }> {
  const response = await apiClient.get<SessionScore & { scoreLevel: ScoreLevel }>(
    `/sessions/${sessionId}/score`
  );
  return apiClient.unwrapResponse(response);
}

/**
 * Get score level configuration
 */
export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 90) {
    return {
      level: 'excellent',
      label: 'Excellent',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
    };
  } else if (score >= 80) {
    return {
      level: 'very_good',
      label: 'Very Good',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    };
  } else if (score >= 70) {
    return {
      level: 'good',
      label: 'Good',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    };
  } else if (score >= 60) {
    return {
      level: 'fair',
      label: 'Fair',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    };
  } else if (score >= 50) {
    return {
      level: 'needs_improvement',
      label: 'Needs Improvement',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    };
  } else {
    return {
      level: 'poor',
      label: 'Poor',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    };
  }
}
