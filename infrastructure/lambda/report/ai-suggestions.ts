/**
 * AI Improvement Suggestions Generator
 *
 * Uses AWS Bedrock Claude to generate personalized improvement suggestions
 * based on session data, scores, and transcript analysis.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { ReportData } from './types';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
});

const BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0';

/**
 * Generate AI-powered improvement suggestions
 */
export async function generateAISuggestions(
  data: ReportData
): Promise<string[]> {
  console.log('[AIsuggestions] Generating AI improvement suggestions...');

  try {
    // Build context from session data
    const context = buildContextForAI(data);

    // Generate prompt
    const prompt = buildPrompt(context);

    // Call AWS Bedrock Claude
    const response = await invokeClaude(prompt);

    // Parse suggestions from response
    const suggestions = parseSuggestions(response);

    console.log('[AISuggestions] Generated', suggestions.length, 'suggestions');
    return suggestions;
  } catch (error) {
    console.error('[AISuggestions] Error generating suggestions:', error);

    // Fallback to score-based suggestions
    console.log('[AISuggestions] Using fallback suggestions from scores');
    return data.score.improvements;
  }
}

/**
 * Build context summary for AI analysis
 */
function buildContextForAI(data: ReportData): string {
  const { session, score, transcript, emotionAnalysis, audioAnalysis } = data;

  // Session info
  const sessionInfo = `
セッション情報:
- シナリオ: ${session.scenario.title}
- 所要時間: ${Math.round(session.duration / 60)}分
- 日時: ${session.startedAt.toISOString()}
`;

  // Score summary
  const scoreSummary = `
スコアサマリー:
- 総合スコア: ${score.overall}/100
- 感情スコア: ${score.emotion}/100 (安定性: ${score.emotionStability}, ポジティブ性: ${score.emotionPositivity})
- 音声スコア: ${score.audio}/100 (明瞭性: ${score.clarity}, 流暢性: ${score.fluency}, ペース: ${score.pacing}, 音量: ${score.volume})
- 内容スコア: ${score.content}/100 (関連性: ${score.relevance}, 構成: ${score.structure}, 完全性: ${score.completeness})
- デリバリースコア: ${score.delivery}/100 (自信: ${score.confidence}, エンゲージメント: ${score.engagement})
`;

  // Strengths
  const strengths = `
強み:
${score.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`;

  // Emotion analysis summary
  const emotions = emotionAnalysis
    .map((e) => e.dominantEmotion)
    .filter((e, i, arr) => arr.indexOf(e) === i);
  const emotionSummary = `
感情分析:
- 検出された感情: ${emotions.join(', ')}
- 平均信頼度: ${(
    emotionAnalysis.reduce((sum, e) => sum + e.confidence, 0) /
    emotionAnalysis.length
  ).toFixed(2)}
`;

  // Audio analysis summary
  const avgFillerCount =
    audioAnalysis.reduce((sum, a) => sum + a.fillerCount, 0) /
    audioAnalysis.length;
  const audioSummary = `
音声分析:
- 平均フィラー語数: ${avgFillerCount.toFixed(1)}/分
- 平均明瞭性: ${(
    audioAnalysis.reduce((sum, a) => sum + a.clarity, 0) / audioAnalysis.length
  ).toFixed(2)}
- 平均話速: ${(
    audioAnalysis.reduce((sum, a) => sum + a.speakingRate, 0) /
    audioAnalysis.length
  ).toFixed(0)} WPM
`;

  // Transcript sample (first 3 exchanges)
  const transcriptSample = `
会話サンプル（冒頭）:
${transcript
  .slice(0, 6)
  .map(
    (t) =>
      `[${t.speaker === 'USER' ? 'ユーザー' : 'AI'}] ${t.text.substring(0, 100)}${t.text.length > 100 ? '...' : ''}`
  )
  .join('\n')}
`;

  return `${sessionInfo}\n${scoreSummary}\n${strengths}\n${emotionSummary}\n${audioSummary}\n${transcriptSample}`;
}

/**
 * Build prompt for Claude
 */
function buildPrompt(context: string): string {
  return `あなたはコミュニケーションスキル向上のための専門コーチです。
以下のセッションデータを分析し、具体的で実践的な改善提案を5つ生成してください。

## セッションデータ

${context}

## 改善提案の要件

1. **具体的**: 抽象的な助言ではなく、明日から実践できる具体的な行動を提案
2. **測定可能**: 可能な限り数値目標を含める（例：「フィラー語を50%削減」）
3. **優先順位**: 最も効果的な改善から順に提案
4. **ポジティブ**: 批判的ではなく、建設的で励ます表現を使用
5. **短く明確**: 各提案は1-2文で簡潔に

## 出力形式

以下の形式で、改善提案を5つ出力してください（他の説明文は不要）:

1. [改善提案1]
2. [改善提案2]
3. [改善提案3]
4. [改善提案4]
5. [改善提案5]

改善提案:`;
}

/**
 * Invoke Claude via Bedrock
 */
async function invokeClaude(prompt: string): Promise<string> {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);

  if (!response.body) {
    throw new Error('No response body from Bedrock');
  }

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (!responseBody.content || !responseBody.content[0] || !responseBody.content[0].text) {
    throw new Error('Invalid response format from Bedrock');
  }

  return responseBody.content[0].text;
}

/**
 * Parse suggestions from Claude response
 */
function parseSuggestions(response: string): string[] {
  console.log('[AISuggestions] Raw response:', response);

  // Extract numbered list items
  const lines = response
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const suggestions: string[] = [];

  for (const line of lines) {
    // Match numbered list items (1. 2. 3. etc.)
    const match = line.match(/^(\d+)\.\s*(.+)$/);
    if (match) {
      suggestions.push(match[2].trim());
    }
  }

  // If parsing failed, try to extract by splitting
  if (suggestions.length === 0) {
    const parts = response.split(/\d+\.\s+/).filter((s) => s.trim().length > 0);
    suggestions.push(...parts.map((s) => s.trim()));
  }

  // Validate: should have 5 suggestions
  if (suggestions.length < 5) {
    console.warn(
      '[AISuggestions] Expected 5 suggestions, got',
      suggestions.length
    );
  }

  return suggestions.slice(0, 5); // Return max 5 suggestions
}
