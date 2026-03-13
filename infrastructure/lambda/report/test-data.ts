/**
 * Test Data for Report Generation
 *
 * Sample data for testing PDF generation
 */

import { ReportData } from './types';

export const sampleReportData: ReportData = {
  session: {
    id: 'test-session-123',
    startedAt: new Date('2026-03-13T10:00:00Z'),
    endedAt: new Date('2026-03-13T10:15:00Z'),
    duration: 900, // 15 minutes
    user: {
      name: '山田太郎',
      email: 'yamada@example.com',
    },
    scenario: {
      id: 'scenario-456',
      title: '面接練習 - 自己紹介と志望動機',
      description: '基本的な面接スキルを練習するシナリオです',
    },
    avatar: {
      name: '面接官AI',
      type: 'TWO_D',
    },
  },
  score: {
    overall: 75,
    emotion: 80,
    audio: 72,
    content: 78,
    delivery: 70,
    // Detailed scores
    emotionStability: 85,
    emotionPositivity: 75,
    confidence: 70,
    engagement: 80,
    clarity: 75,
    fluency: 68,
    pacing: 72,
    volume: 78,
    relevance: 80,
    structure: 75,
    completeness: 78,
    // Insights
    strengths: [
      '感情表現が豊かで、面接官に好印象を与えています',
      '話の構成がしっかりしており、論理的に説明できています',
      '自信を持って話すことができており、説得力があります',
    ],
    improvements: [
      'フィラー語（「えー」「あのー」）の使用を減らすと、より流暢な印象になります',
      '話すスピードが少し早いので、重要なポイントはゆっくり話すと良いでしょう',
    ],
  },
  emotionAnalysis: [
    { timestamp: 30, dominantEmotion: 'HAPPY', confidence: 0.85 },
    { timestamp: 60, dominantEmotion: 'HAPPY', confidence: 0.78 },
    { timestamp: 90, dominantEmotion: 'CALM', confidence: 0.72 },
    { timestamp: 120, dominantEmotion: 'HAPPY', confidence: 0.80 },
    { timestamp: 150, dominantEmotion: 'HAPPY', confidence: 0.83 },
  ],
  audioAnalysis: [
    { timestamp: 30, pitch: 180, volume: 65, speakingRate: 140, fillerCount: 2, clarity: 0.75 },
    { timestamp: 60, pitch: 185, volume: 68, speakingRate: 145, fillerCount: 1, clarity: 0.78 },
    { timestamp: 90, pitch: 175, volume: 70, speakingRate: 135, fillerCount: 3, clarity: 0.70 },
    { timestamp: 120, pitch: 180, volume: 72, speakingRate: 140, fillerCount: 1, clarity: 0.76 },
    { timestamp: 150, pitch: 188, volume: 68, speakingRate: 142, fillerCount: 0, clarity: 0.80 },
  ],
  transcript: [
    {
      timestamp: 5,
      speaker: 'ASSISTANT',
      text: 'こんにちは。本日はお時間いただきありがとうございます。まず、簡単に自己紹介をお願いできますか？',
    },
    {
      timestamp: 15,
      speaker: 'USER',
      text: 'はい、山田太郎と申します。○○大学の経済学部を卒業し、現在はIT企業でWebエンジニアとして3年間勤務しております。',
    },
    {
      timestamp: 30,
      speaker: 'ASSISTANT',
      text: 'ありがとうございます。では、当社を志望された理由を教えていただけますか？',
    },
    {
      timestamp: 40,
      speaker: 'USER',
      text: 'はい。貴社のビジョンである「テクノロジーで社会課題を解決する」という点に強く共感いたしました。特に、AIを活用した教育支援プロジェクトに携わりたいと考えています。',
    },
    {
      timestamp: 60,
      speaker: 'ASSISTANT',
      text: 'なるほど。これまでのご経験で、最も困難だったプロジェクトについて教えてください。',
    },
    {
      timestamp: 70,
      speaker: 'USER',
      text: '大規模なシステムリニューアルプロジェクトです。レガシーコードからの移行が難航しましたが、チームと協力して段階的な移行計画を立て、成功させることができました。',
    },
  ],
  aiSuggestions: [
    '具体的な数字や事例を交えると、より説得力が増します。例：「3年間で○○件のプロジェクトを担当」など',
    '質問に対する回答の構成を「結論→理由→具体例」の順にすると、より分かりやすくなります',
    'フィラー語を減らすために、少し間を取ってから話し始めると良いでしょう',
    '重要なポイントを強調する際は、声のトーンやスピードを変えると効果的です',
  ],
  chartUrls: {
    radarChart: '', // Will be generated
    timelineChart: '', // Will be generated
  },
};
