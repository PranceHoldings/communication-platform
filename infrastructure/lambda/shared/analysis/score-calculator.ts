/**
 * Score Calculator
 * Calculates comprehensive session scores based on emotion and audio analysis
 */

import type {
  EmotionAnalysis,
  AudioAnalysis,
  ScoringWeights,
  ScoringCriteria,
  ScoringPreset,
  EmotionScoreDetails,
  AudioScoreDetails,
  ContentScoreDetails,
  ScoreCalculationResult,
  ScoreLevel,
  ScoreAssessment,
  EmotionScore,
} from '@prance/shared';

// ============================================================
// Scoring Presets
// ============================================================

export const SCORING_PRESETS: Record<ScoringPreset, ScoringWeights> = {
  default: {
    emotion: 0.35,
    audio: 0.35,
    content: 0.20,
    delivery: 0.10,
  },
  interview_practice: {
    emotion: 0.40,
    audio: 0.30,
    content: 0.20,
    delivery: 0.10,
  },
  language_learning: {
    emotion: 0.15,
    audio: 0.50,
    content: 0.25,
    delivery: 0.10,
  },
  presentation: {
    emotion: 0.30,
    audio: 0.30,
    content: 0.30,
    delivery: 0.10,
  },
  custom: {
    emotion: 0.35,
    audio: 0.35,
    content: 0.20,
    delivery: 0.10,
  },
};

// ============================================================
// Score Calculator
// ============================================================

export class ScoreCalculator {
  /**
   * Calculate comprehensive session score
   */
  calculateScore(
    emotionAnalyses: EmotionAnalysis[],
    audioAnalyses: AudioAnalysis[],
    criteria: ScoringCriteria = { preset: 'default' }
  ): ScoreCalculationResult {
    console.log('[ScoreCalculator] Calculating score', {
      emotionAnalysesCount: emotionAnalyses.length,
      audioAnalysesCount: audioAnalyses.length,
      criteria,
    });

    // Get weights
    const weights = this.getWeights(criteria);

    // Calculate category scores
    const emotionResult = this.calculateEmotionScore(emotionAnalyses);
    const audioResult = this.calculateAudioScore(audioAnalyses);
    const contentResult = this.calculateContentScore(emotionAnalyses, audioAnalyses);
    const deliveryScore = this.calculateDeliveryScore(emotionAnalyses, audioAnalyses);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      emotionResult.score,
      audioResult.score,
      contentResult.score,
      deliveryScore,
      weights
    );

    // Generate strengths and improvements
    const strengths = this.generateStrengths(emotionResult, audioResult, contentResult);
    const improvements = this.generateImprovements(emotionResult, audioResult, contentResult);

    const result: ScoreCalculationResult = {
      overallScore,
      emotionScore: emotionResult.score,
      audioScore: audioResult.score,
      contentScore: contentResult.score,
      deliveryScore,
      emotionDetails: emotionResult.details,
      audioDetails: audioResult.details,
      contentDetails: contentResult.details,
      strengths,
      improvements,
    };

    console.log('[ScoreCalculator] Score calculated', {
      overallScore,
      emotionScore: emotionResult.score,
      audioScore: audioResult.score,
    });

    return result;
  }

  /**
   * Get scoring weights
   */
  private getWeights(criteria: ScoringCriteria): ScoringWeights {
    if (criteria.preset === 'custom' && criteria.customWeights) {
      return criteria.customWeights;
    }
    return SCORING_PRESETS[criteria.preset] || SCORING_PRESETS.default;
  }

  /**
   * Calculate emotion score
   */
  private calculateEmotionScore(emotionAnalyses: EmotionAnalysis[]): {
    score: number;
    details: EmotionScoreDetails;
  } {
    if (emotionAnalyses.length === 0) {
      return {
        score: 50,
        details: {
          stability: 50,
          positivity: 50,
          confidence: 50,
          engagement: 50,
        },
      };
    }

    // 1. Stability (感情の安定性)
    const positiveEmotions = ['HAPPY', 'CALM', 'SURPRISED'];
    const negativeEmotions = ['FEAR', 'ANGRY', 'DISGUSTED', 'SAD'];

    let positiveCount = 0;
    let negativeCount = 0;

    emotionAnalyses.forEach((analysis) => {
      const emotions = analysis.emotions as EmotionScore[];
      if (emotions && Array.isArray(emotions)) {
        emotions.forEach((emotion) => {
          if (positiveEmotions.includes(emotion.type)) {
            positiveCount += emotion.confidence / 100;
          } else if (negativeEmotions.includes(emotion.type)) {
            negativeCount += emotion.confidence / 100;
          }
        });
      }
    });

    const totalFrames = emotionAnalyses.length;
    const positiveRatio = positiveCount / totalFrames;
    const negativeRatio = negativeCount / totalFrames;

    const stability = Math.max(
      0,
      Math.min(100, positiveRatio * 100 - negativeRatio * 50)
    );

    // 2. Positivity
    let happyCount = 0;
    let calmCount = 0;

    emotionAnalyses.forEach((analysis) => {
      const dominantEmotion = analysis.dominantEmotion;
      if (dominantEmotion === 'HAPPY') happyCount++;
      if (dominantEmotion === 'CALM') calmCount++;
    });

    const positivity = ((happyCount + calmCount) / totalFrames) * 100;

    // 3. Confidence
    const avgConfidence = this.average(
      emotionAnalyses.map((a) => a.confidence)
    );

    const eyesOpenCount = emotionAnalyses.filter((a) => a.eyesOpen === true).length;
    const eyesOpenRatio = eyesOpenCount / totalFrames;

    const confidence = avgConfidence * 0.7 + eyesOpenRatio * 100 * 0.3;

    // 4. Engagement (感情の変化)
    const emotionVariance = this.calculateEmotionVariance(emotionAnalyses);
    const engagement = Math.min(100, emotionVariance * 50);

    // Calculate overall emotion score
    const emotionScore =
      stability * 0.3 +
      positivity * 0.25 +
      confidence * 0.25 +
      engagement * 0.2;

    return {
      score: Math.round(emotionScore * 10) / 10,
      details: {
        stability: Math.round(stability * 10) / 10,
        positivity: Math.round(positivity * 10) / 10,
        confidence: Math.round(confidence * 10) / 10,
        engagement: Math.round(engagement * 10) / 10,
      },
    };
  }

  /**
   * Calculate audio score
   */
  private calculateAudioScore(audioAnalyses: AudioAnalysis[]): {
    score: number;
    details: AudioScoreDetails;
  } {
    if (audioAnalyses.length === 0) {
      return {
        score: 50,
        details: {
          clarity: 50,
          fluency: 50,
          pacing: 50,
          volume: 50,
        },
      };
    }

    const totalDuration = this.sum(audioAnalyses.map((a) => a.duration || 0));

    // 1. Clarity (明瞭さ)
    const totalFillerWords = this.sum(audioAnalyses.map((a) => a.fillerCount || 0));
    const fillerWordsPerMinute = totalFillerWords / (totalDuration / 60);
    const clarityFromFillers = Math.max(0, 100 - fillerWordsPerMinute * 5);

    const avgSTTConfidence = this.average(
      audioAnalyses.map((a) => a.confidence || 80)
    );
    const clarityFromSTT = avgSTTConfidence;

    const clarity = clarityFromFillers * 0.6 + clarityFromSTT * 0.4;

    // 2. Fluency (流暢さ)
    const avgPauseDuration = this.average(
      audioAnalyses.map((a) => a.pauseDuration || 0)
    );
    const optimalPause = 0.8; // 理想的なポーズ時間（秒）

    const fluency = Math.max(
      0,
      100 - Math.abs(avgPauseDuration - optimalPause) * 50
    );

    // 3. Pacing (ペース配分)
    const avgSpeakingRate = this.average(
      audioAnalyses.map((a) => a.speakingRate || 0).filter((r) => r > 0)
    );
    const optimalRate = 130; // WPM

    const pacing = Math.max(
      0,
      100 - Math.abs(avgSpeakingRate - optimalRate) * 0.5
    );

    // 4. Volume (音量適正)
    const avgVolume = this.average(
      audioAnalyses.map((a) => a.volume || -30)
    );
    const optimalVolume = -25; // dB

    const volume = Math.max(0, 100 - Math.abs(avgVolume - optimalVolume) * 2);

    // Calculate overall audio score
    const audioScore = clarity * 0.35 + fluency * 0.3 + pacing * 0.2 + volume * 0.15;

    return {
      score: Math.round(audioScore * 10) / 10,
      details: {
        clarity: Math.round(clarity * 10) / 10,
        fluency: Math.round(fluency * 10) / 10,
        pacing: Math.round(pacing * 10) / 10,
        volume: Math.round(volume * 10) / 10,
      },
    };
  }

  /**
   * Calculate content score (simplified version)
   */
  private calculateContentScore(
    emotionAnalyses: EmotionAnalysis[],
    audioAnalyses: AudioAnalysis[]
  ): {
    score: number;
    details: ContentScoreDetails;
  } {
    // Simplified content scoring
    // In production, this would analyze transcript against scenario keywords

    // 1. Relevance (関連性) - Based on engagement and clarity
    const relevance = 75; // Placeholder

    // 2. Structure (構造) - Based on pause patterns and speaking rate consistency
    const pauseVariance = this.variance(
      audioAnalyses.map((a) => a.pauseDuration || 0)
    );
    const structure = Math.max(0, 100 - pauseVariance * 10);

    // 3. Completeness (完全性) - Based on total duration and speaking rate
    const totalDuration = this.sum(audioAnalyses.map((a) => a.duration || 0));
    const completeness = Math.min(100, (totalDuration / 60) * 40); // Assume 2.5 min optimal

    const contentScore = relevance * 0.4 + structure * 0.3 + completeness * 0.3;

    return {
      score: Math.round(contentScore * 10) / 10,
      details: {
        relevance: Math.round(relevance * 10) / 10,
        structure: Math.round(structure * 10) / 10,
        completeness: Math.round(completeness * 10) / 10,
      },
    };
  }

  /**
   * Calculate delivery score
   */
  private calculateDeliveryScore(
    emotionAnalyses: EmotionAnalysis[],
    audioAnalyses: AudioAnalysis[]
  ): number {
    // Simplified delivery score based on overall quality
    const avgEmotionConfidence = this.average(
      emotionAnalyses.map((a) => a.confidence)
    );
    const avgAudioQuality = this.average(
      audioAnalyses.map((a) => (a.volume || -30) + 40) // Normalize volume to 0-100
    );

    const deliveryScore = avgEmotionConfidence * 0.5 + avgAudioQuality * 0.5;

    return Math.round(deliveryScore * 10) / 10;
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(
    emotionScore: number,
    audioScore: number,
    contentScore: number,
    deliveryScore: number,
    weights: ScoringWeights
  ): number {
    const overallScore =
      emotionScore * weights.emotion +
      audioScore * weights.audio +
      contentScore * weights.content +
      deliveryScore * weights.delivery;

    return Math.round(overallScore * 10) / 10;
  }

  /**
   * Generate strengths
   */
  private generateStrengths(
    emotionResult: { score: number; details: EmotionScoreDetails },
    audioResult: { score: number; details: AudioScoreDetails },
    contentResult: { score: number; details: ContentScoreDetails }
  ): string[] {
    const strengths: string[] = [];

    // Emotion strengths
    if (emotionResult.details.stability >= 80) {
      strengths.push('良好な感情コントロール');
    }
    if (emotionResult.details.positivity >= 80) {
      strengths.push('ポジティブな表情');
    }
    if (emotionResult.details.confidence >= 80) {
      strengths.push('高い自信');
    }

    // Audio strengths
    if (audioResult.details.clarity >= 80) {
      strengths.push('明瞭な発音');
    }
    if (audioResult.details.pacing >= 80) {
      strengths.push('適切な話速');
    }
    if (audioResult.details.fluency >= 80) {
      strengths.push('流暢な話し方');
    }

    // Content strengths
    if (contentResult.details.relevance >= 80) {
      strengths.push('内容の関連性が高い');
    }

    return strengths;
  }

  /**
   * Generate improvements
   */
  private generateImprovements(
    emotionResult: { score: number; details: EmotionScoreDetails },
    audioResult: { score: number; details: AudioScoreDetails },
    contentResult: { score: number; details: ContentScoreDetails }
  ): string[] {
    const improvements: string[] = [];

    // Emotion improvements
    if (emotionResult.details.stability < 70) {
      improvements.push('感情の安定性を向上させましょう');
    }
    if (emotionResult.details.confidence < 70) {
      improvements.push('より自信を持って話しましょう');
    }
    if (emotionResult.details.engagement < 70) {
      improvements.push('表情に変化をつけましょう');
    }

    // Audio improvements
    if (audioResult.details.clarity < 70) {
      improvements.push('フィラー語を減らしましょう');
    }
    if (audioResult.details.pacing < 70) {
      improvements.push('話速を調整しましょう');
    }
    if (audioResult.details.fluency < 70) {
      improvements.push('ポーズの長さを調整しましょう');
    }
    if (audioResult.details.volume < 70) {
      improvements.push('音量を調整しましょう');
    }

    // Content improvements
    if (contentResult.details.structure < 70) {
      improvements.push('より構造的に話しましょう');
    }
    if (contentResult.details.completeness < 70) {
      improvements.push('より完全な回答を心がけましょう');
    }

    return improvements;
  }

  /**
   * Get score assessment
   */
  getScoreAssessment(score: number): ScoreAssessment {
    if (score >= 90) {
      return {
        level: 'excellent',
        label: 'Excellent',
        description: '優秀 - 高い熟練度',
        color: '#10b981', // green-500
      };
    } else if (score >= 80) {
      return {
        level: 'very_good',
        label: 'Very Good',
        description: '非常に良好 - 改善点わずか',
        color: '#3b82f6', // blue-500
      };
    } else if (score >= 70) {
      return {
        level: 'good',
        label: 'Good',
        description: '良好 - いくつかの改善点あり',
        color: '#8b5cf6', // violet-500
      };
    } else if (score >= 60) {
      return {
        level: 'fair',
        label: 'Fair',
        description: '普通 - 改善が必要',
        color: '#f59e0b', // amber-500
      };
    } else if (score >= 50) {
      return {
        level: 'needs_improvement',
        label: 'Needs Improvement',
        description: '要改善',
        color: '#ef4444', // red-500
      };
    } else {
      return {
        level: 'poor',
        label: 'Poor',
        description: '不良 - 大幅な改善が必要',
        color: '#dc2626', // red-600
      };
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return this.sum(values) / values.length;
  }

  private sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  private variance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.average(values);
    const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
    return this.average(squaredDiffs);
  }

  private calculateEmotionVariance(emotionAnalyses: EmotionAnalysis[]): number {
    if (emotionAnalyses.length < 2) return 0;

    const emotionChanges = [];
    for (let i = 1; i < emotionAnalyses.length; i++) {
      const prevEmotion = emotionAnalyses[i - 1].dominantEmotion;
      const currEmotion = emotionAnalyses[i].dominantEmotion;
      if (prevEmotion !== currEmotion) {
        emotionChanges.push(1);
      } else {
        emotionChanges.push(0);
      }
    }

    return this.average(emotionChanges);
  }
}
