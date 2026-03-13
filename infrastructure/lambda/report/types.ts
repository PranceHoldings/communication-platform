/**
 * Report Generation Types
 *
 * Type definitions for session report generation
 */

export interface ReportData {
  session: {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    duration: number; // seconds
    user: {
      name: string;
      email: string;
    };
    scenario: {
      id: string;
      title: string;
      description: string | null;
    };
    avatar: {
      name: string;
      type: string;
    } | null;
  };
  score: {
    overall: number; // 0-100
    emotion: number;
    audio: number;
    content: number;
    delivery: number;
    // Detailed scores
    emotionStability: number | null;
    emotionPositivity: number | null;
    confidence: number | null;
    engagement: number | null;
    clarity: number | null;
    fluency: number | null;
    pacing: number | null;
    volume: number | null;
    relevance: number | null;
    structure: number | null;
    completeness: number | null;
    // Insights
    strengths: string[];
    improvements: string[];
  };
  emotionAnalysis: {
    timestamp: number;
    dominantEmotion: string;
    confidence: number;
  }[];
  audioAnalysis: {
    timestamp: number;
    pitch: number | null;
    volume: number | null;
    speakingRate: number | null;
    fillerCount: number | null;
    clarity: number | null;
  }[];
  transcript: {
    timestamp: number;
    speaker: 'USER' | 'ASSISTANT';
    text: string;
  }[];
  aiSuggestions: string[];
  chartUrls: {
    radarChart: string;
    timelineChart: string;
  };
}

export interface Report {
  id: string;
  sessionId: string;
  pdfUrl: string;
  generatedAt: Date;
  version: string; // "1.0"
  data: ReportData;
}

export interface ReportGenerationOptions {
  includeTranscript?: boolean;
  includeDetailedAnalysis?: boolean;
  language?: 'ja' | 'en';
  template?: 'default' | 'minimal' | 'detailed';
}

export interface ChartGenerationOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  fontColor?: string;
}

export interface RadarChartData {
  emotion: number;
  audio: number;
  content: number;
  delivery: number;
}

export interface TimelineChartData {
  timestamps: number[];
  emotionScores: number[];
  audioScores: number[];
}
