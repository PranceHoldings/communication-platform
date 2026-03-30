/**
 * Generate Silence Prompt
 *
 * Generates contextually appropriate prompts to encourage conversation continuation
 * when silence is detected.
 *
 * Features:
 * - Uses Bedrock Claude for context-aware prompt generation
 * - Fallback to cached presets on API failure
 * - Multi-language support (ja, en, zh-CN, zh-TW, ko, es, pt, fr, de, it)
 * - Style variations (formal, casual, neutral)
 *
 * Last updated: 2026-03-11
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getRequiredEnv, getAwsRegion } from './env-validator';

// Bedrock client (initialized once)
const bedrockClient = new BedrockRuntimeClient({
  region: getAwsRegion(),
});

const BEDROCK_MODEL_ID = getRequiredEnv('BEDROCK_MODEL_ID');

/**
 * Silence prompt cache - fallback when Bedrock API fails
 * Key format: "{language}-{style}"
 */
const SILENCE_PROMPT_CACHE: Record<string, string[]> = {
  // Japanese
  'ja-formal': [
    '他にご質問はございますか？',
    'もう少し詳しくお聞かせいただけますか？',
    'ご意見をお聞かせください。',
    '続けてお話しいただけますか？',
  ],
  'ja-casual': ['他に質問ある？', 'もっと聞かせて！', 'どう思う？', '続けて話して！'],
  'ja-neutral': [
    '他に質問はありますか？',
    'もう少し詳しく聞かせてください。',
    'ご意見をお聞かせください。',
    '続けてお話しください。',
  ],

  // English
  'en-formal': [
    'Do you have any other questions?',
    'Could you please elaborate on that?',
    'I would appreciate your thoughts on this.',
    'Please feel free to continue.',
  ],
  'en-casual': ['Got any other questions?', 'Tell me more!', 'What do you think?', 'Keep going!'],
  'en-neutral': [
    'Do you have any questions?',
    'Please tell me more.',
    'What are your thoughts?',
    'Please continue.',
  ],

  // Chinese Simplified
  'zh-CN-formal': [
    '您还有其他问题吗？',
    '能否请您详细说明一下？',
    '请问您有什么想法？',
    '请继续说。',
  ],
  'zh-CN-casual': ['还有问题吗？', '说说看！', '你觉得呢？', '继续说！'],
  'zh-CN-neutral': ['还有其他问题吗？', '请详细说明。', '您有什么想法？', '请继续。'],

  // Chinese Traditional
  'zh-TW-formal': [
    '您還有其他問題嗎？',
    '能否請您詳細說明一下？',
    '請問您有什麼想法？',
    '請繼續說。',
  ],
  'zh-TW-casual': ['還有問題嗎？', '說說看！', '你覺得呢？', '繼續說！'],
  'zh-TW-neutral': ['還有其他問題嗎？', '請詳細說明。', '您有什麼想法？', '請繼續。'],

  // Korean
  'ko-formal': [
    '다른 질문이 있으십니까？',
    '좀 더 자세히 말씀해 주시겠습니까？',
    '의견을 들려주시겠습니까？',
    '계속 말씀해 주십시오.',
  ],
  'ko-casual': ['다른 질문 있어?', '더 말해봐!', '어떻게 생각해?', '계속 말해!'],
  'ko-neutral': [
    '다른 질문이 있나요？',
    '좀 더 자세히 말씀해 주세요.',
    '의견을 들려주세요.',
    '계속 말씀해 주세요.',
  ],

  // Spanish
  'es-formal': [
    '¿Tiene alguna otra pregunta?',
    '¿Podría explicarlo con más detalle?',
    'Me gustaría escuchar su opinión.',
    'Por favor, continúe.',
  ],
  'es-casual': ['¿Tienes más preguntas?', '¡Cuéntame más!', '¿Qué piensas?', '¡Continúa!'],
  'es-neutral': [
    '¿Tiene alguna pregunta?',
    'Por favor, explique con más detalle.',
    '¿Cuál es su opinión?',
    'Por favor, continúe.',
  ],

  // Portuguese
  'pt-formal': [
    'Tem alguma outra pergunta?',
    'Poderia explicar com mais detalhes?',
    'Gostaria de ouvir sua opinião.',
    'Por favor, continue.',
  ],
  'pt-casual': ['Tem mais perguntas?', 'Me conta mais!', 'O que você acha?', 'Continua!'],
  'pt-neutral': [
    'Tem alguma pergunta?',
    'Por favor, explique com mais detalhes.',
    'Qual é sua opinião?',
    'Por favor, continue.',
  ],

  // French
  'fr-formal': [
    "Avez-vous d'autres questions?",
    'Pourriez-vous expliquer plus en détail?',
    "J'aimerais entendre votre avis.",
    "Veuillez continuer, s'il vous plaît.",
  ],
  'fr-casual': ["Tu as d'autres questions?", 'Raconte-moi plus!', "Qu'en penses-tu?", 'Continue!'],
  'fr-neutral': [
    'Avez-vous des questions?',
    'Veuillez expliquer plus en détail.',
    'Quel est votre avis?',
    'Veuillez continuer.',
  ],

  // German
  'de-formal': [
    'Haben Sie weitere Fragen?',
    'Könnten Sie das näher erläutern?',
    'Ich würde gerne Ihre Meinung hören.',
    'Bitte fahren Sie fort.',
  ],
  'de-casual': ['Hast du weitere Fragen?', 'Erzähl mir mehr!', 'Was denkst du?', 'Mach weiter!'],
  'de-neutral': [
    'Haben Sie Fragen?',
    'Bitte erläutern Sie das näher.',
    'Was ist Ihre Meinung?',
    'Bitte fahren Sie fort.',
  ],

  // Italian
  'it-formal': [
    'Ha altre domande?',
    'Potrebbe spiegare più in dettaglio?',
    'Mi piacerebbe sentire la sua opinione.',
    'Per favore, continui.',
  ],
  'it-casual': ['Hai altre domande?', 'Raccontami di più!', 'Cosa ne pensi?', 'Continua!'],
  'it-neutral': [
    'Ha delle domande?',
    'Per favore, spieghi più in dettaglio.',
    'Qual è la sua opinione?',
    'Per favore, continui.',
  ],
};

export interface GenerateSilencePromptOptions {
  conversationHistory: Array<{ speaker: 'AI' | 'USER'; text: string }>;
  scenarioPrompt?: string;
  scenarioLanguage: string;
  style?: 'formal' | 'casual' | 'neutral';
  lastUserMessage?: string;
}

/**
 * Generate a contextually appropriate silence prompt using Bedrock Claude
 */
export async function generateSilencePrompt(
  options: GenerateSilencePromptOptions
): Promise<string> {
  const {
    conversationHistory,
    scenarioPrompt,
    scenarioLanguage,
    style = 'neutral',
    lastUserMessage,
  } = options;

  // Build conversation context
  const recentHistory = conversationHistory.slice(-6); // Last 6 messages
  const conversationContext = recentHistory.map(msg => `${msg.speaker}: ${msg.text}`).join('\n');

  // Build prompt for Bedrock
  const systemPrompt = `You are an AI assistant helping to continue a conversation. Generate a short, natural prompt (1-2 sentences maximum) to encourage the user to continue speaking.

Language: ${scenarioLanguage}
Style: ${style}
Scenario context: ${scenarioPrompt || 'General conversation'}

Recent conversation:
${conversationContext || 'No conversation yet'}

Generate ONLY the prompt text in ${scenarioLanguage}, nothing else. Keep it natural and conversational.`;

  const userMessage = lastUserMessage
    ? `The user last said: "${lastUserMessage}". Generate a follow-up prompt.`
    : 'The conversation has paused. Generate an encouraging prompt to continue.';

  try {
    // Call Bedrock Claude
    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 100,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\n${userMessage}`,
          },
        ],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract generated text
    const generatedText = responseBody.content?.[0]?.text?.trim();

    if (generatedText && generatedText.length > 0) {
      console.log('[generateSilencePrompt] Generated prompt:', generatedText);
      return generatedText;
    }

    throw new Error('Empty response from Bedrock');
  } catch (error) {
    console.error('[generateSilencePrompt] Bedrock API error, falling back to cache:', error);

    // Fallback to cached prompts
    return getCachedPrompt(scenarioLanguage, style);
  }
}

/**
 * Get a cached prompt as fallback
 */
function getCachedPrompt(language: string, style: string): string {
  const cacheKey = `${language}-${style}`;
  const prompts = SILENCE_PROMPT_CACHE[cacheKey];

  if (prompts && prompts.length > 0) {
    const randomIndex = Math.floor(Math.random() * prompts.length);
    console.log('[generateSilencePrompt] Using cached prompt:', prompts[randomIndex]);
    return prompts[randomIndex]!;
  }

  // Final fallback - use English neutral
  const englishPrompts = SILENCE_PROMPT_CACHE['en-neutral'];
  if (englishPrompts && englishPrompts.length > 0) {
    console.warn('[generateSilencePrompt] No cache for', cacheKey, '- using English fallback');
    return englishPrompts[0]!;
  }

  // Ultimate fallback
  console.error('[generateSilencePrompt] No cache available - using hardcoded fallback');
  return 'Do you have any questions?';
}
