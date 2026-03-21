/**
 * Scenario Error Handler
 * Phase 1.6.1 Day 35: エラーリカバリー実装
 *
 * シナリオ実行中のエラーハンドリングとリカバリー
 */

import { logError, logWarning } from '../utils/error-logger';

export interface ErrorRecoveryOptions {
  sessionId: string;
  errorType: 'ai_generation' | 'tts_generation' | 'stt_recognition' | 'validation' | 'timeout';
  errorMessage: string;
  attemptNumber: number;
  maxAttempts: number;
  language?: string;
}

export interface RecoveryResult {
  shouldRetry: boolean;
  shouldSkip: boolean;
  shouldTerminate: boolean;
  fallbackResponse?: string;
  fallbackAudioUrl?: string;
}

/**
 * Determine error recovery strategy
 */
export function determineRecoveryStrategy(options: ErrorRecoveryOptions): RecoveryResult {
  const { errorType, attemptNumber, maxAttempts, language } = options;

  console.log('[ErrorHandler] Determining recovery strategy:', {
    errorType,
    attemptNumber,
    maxAttempts,
    sessionId: options.sessionId,
  });

  // Exceeded max attempts - terminate
  if (attemptNumber >= maxAttempts) {
    logError(
      `Max retry attempts exceeded (${attemptNumber}/${maxAttempts})`,
      new Error(options.errorMessage),
      { sessionId: options.sessionId, errorType }
    );

    return {
      shouldRetry: false,
      shouldSkip: false,
      shouldTerminate: true,
      fallbackResponse: getFallbackTerminationMessage(errorType, language),
    };
  }

  // Error-specific recovery strategies
  switch (errorType) {
    case 'ai_generation':
      return handleAIGenerationError(options);

    case 'tts_generation':
      return handleTTSGenerationError(options);

    case 'stt_recognition':
      return handleSTTRecognitionError(options);

    case 'validation':
      return handleValidationError(options);

    case 'timeout':
      return handleTimeoutError(options);

    default:
      logWarning(`Unknown error type: ${errorType}`, { sessionId: options.sessionId });
      return {
        shouldRetry: true,
        shouldSkip: false,
        shouldTerminate: false,
      };
  }
}

/**
 * Handle AI generation errors
 */
function handleAIGenerationError(options: ErrorRecoveryOptions): RecoveryResult {
  const { attemptNumber, language } = options;

  // First attempt: retry immediately
  if (attemptNumber === 0) {
    return {
      shouldRetry: true,
      shouldSkip: false,
      shouldTerminate: false,
    };
  }

  // Second attempt: retry with fallback prompt
  if (attemptNumber === 1) {
    return {
      shouldRetry: true,
      shouldSkip: false,
      shouldTerminate: false,
      fallbackResponse: getFallbackPrompt(language),
    };
  }

  // Third attempt: skip and continue
  return {
    shouldRetry: false,
    shouldSkip: true,
    shouldTerminate: false,
    fallbackResponse: getFallbackErrorMessage('ai_generation', language),
  };
}

/**
 * Handle TTS generation errors
 */
function handleTTSGenerationError(options: ErrorRecoveryOptions): RecoveryResult {
  const { attemptNumber, language } = options;

  // TTS errors: skip audio, continue with text only
  if (attemptNumber === 0) {
    return {
      shouldRetry: true,
      shouldSkip: false,
      shouldTerminate: false,
    };
  }

  // After first retry: continue without audio
  logWarning('TTS generation failed, continuing with text only', {
    sessionId: options.sessionId,
  });

  return {
    shouldRetry: false,
    shouldSkip: true,
    shouldTerminate: false,
    fallbackResponse: getFallbackErrorMessage('tts_generation', language),
  };
}

/**
 * Handle STT recognition errors
 */
function handleSTTRecognitionError(options: ErrorRecoveryOptions): RecoveryResult {
  const { attemptNumber, language } = options;

  // First attempt: retry
  if (attemptNumber === 0) {
    return {
      shouldRetry: true,
      shouldSkip: false,
      shouldTerminate: false,
    };
  }

  // Second attempt: ask user to repeat
  return {
    shouldRetry: false,
    shouldSkip: true,
    shouldTerminate: false,
    fallbackResponse: getFallbackErrorMessage('stt_recognition', language),
  };
}

/**
 * Handle validation errors
 */
function handleValidationError(options: ErrorRecoveryOptions): RecoveryResult {
  const { language } = options;

  // Validation errors: terminate immediately (configuration issue)
  logError('Validation error - terminating session', new Error(options.errorMessage), {
    sessionId: options.sessionId,
  });

  return {
    shouldRetry: false,
    shouldSkip: false,
    shouldTerminate: true,
    fallbackResponse: getFallbackErrorMessage('validation', language),
  };
}

/**
 * Handle timeout errors
 */
function handleTimeoutError(options: ErrorRecoveryOptions): RecoveryResult {
  const { attemptNumber, language } = options;

  // First timeout: retry
  if (attemptNumber === 0) {
    return {
      shouldRetry: true,
      shouldSkip: false,
      shouldTerminate: false,
    };
  }

  // Second timeout: terminate
  return {
    shouldRetry: false,
    shouldSkip: false,
    shouldTerminate: true,
    fallbackResponse: getFallbackErrorMessage('timeout', language),
  };
}

/**
 * Get fallback error messages by language
 */
function getFallbackErrorMessage(
  errorType: string,
  language: string = 'en'
): string {
  const messages: Record<string, Record<string, string>> = {
    ai_generation: {
      ja: '申し訳ございません。応答の生成に失敗しました。もう一度お試しください。',
      en: 'I apologize. Failed to generate a response. Please try again.',
      'zh-CN': '抱歉，生成回复失败。请重试。',
      'zh-TW': '抱歉，生成回覆失敗。請重試。',
      ko: '죄송합니다. 응답 생성에 실패했습니다. 다시 시도해 주세요.',
      es: 'Lo siento. Error al generar respuesta. Por favor, inténtalo de nuevo.',
      pt: 'Desculpe. Falha ao gerar resposta. Por favor, tente novamente.',
      fr: 'Désolé. Échec de la génération de réponse. Veuillez réessayer.',
      de: 'Entschuldigung. Antwort konnte nicht generiert werden. Bitte versuchen Sie es erneut.',
      it: 'Mi dispiace. Impossibile generare una risposta. Riprova.',
    },
    tts_generation: {
      ja: '音声の生成に失敗しました。テキストのみで続行します。',
      en: 'Audio generation failed. Continuing with text only.',
      'zh-CN': '音频生成失败。仅以文本形式继续。',
      'zh-TW': '音訊生成失敗。僅以文字形式繼續。',
      ko: '오디오 생성 실패. 텍스트로만 계속합니다.',
      es: 'Error en generación de audio. Continuando solo con texto.',
      pt: 'Falha na geração de áudio. Continuando apenas com texto.',
      fr: 'Échec de la génération audio. Poursuite en texte uniquement.',
      de: 'Audiogenerierung fehlgeschlagen. Nur mit Text fortfahren.',
      it: 'Generazione audio fallita. Continuando solo con testo.',
    },
    stt_recognition: {
      ja: '音声が聞き取れませんでした。もう一度はっきりとお話しください。',
      en: 'Could not recognize your speech. Please speak clearly again.',
      'zh-CN': '无法识别您的语音。请清晰地再说一次。',
      'zh-TW': '無法識別您的語音。請清楚地再說一次。',
      ko: '음성을 인식할 수 없습니다. 다시 명확하게 말씀해 주세요.',
      es: 'No se pudo reconocer tu voz. Por favor, habla claramente de nuevo.',
      pt: 'Não foi possível reconhecer sua fala. Por favor, fale claramente novamente.',
      fr: 'Impossible de reconnaître votre parole. Veuillez parler clairement à nouveau.',
      de: 'Sprache konnte nicht erkannt werden. Bitte sprechen Sie erneut deutlich.',
      it: 'Impossibile riconoscere il tuo parlato. Per favore, parla chiaramente di nuovo.',
    },
    validation: {
      ja: 'シナリオの設定に問題があります。管理者にお問い合わせください。',
      en: 'There is an issue with the scenario configuration. Please contact the administrator.',
      'zh-CN': '场景配置存在问题。请联系管理员。',
      'zh-TW': '場景配置存在問題。請聯繫管理員。',
      ko: '시나리오 구성에 문제가 있습니다. 관리자에게 문의하세요.',
      es: 'Hay un problema con la configuración del escenario. Contacta al administrador.',
      pt: 'Há um problema com a configuração do cenário. Entre em contato com o administrador.',
      fr: "Un problème existe avec la configuration du scénario. Contactez l'administrateur.",
      de: 'Es gibt ein Problem mit der Szenariokonfiguration. Bitte kontaktieren Sie den Administrator.',
      it: "C'è un problema con la configurazione dello scenario. Contatta l'amministratore.",
    },
    timeout: {
      ja: 'タイムアウトしました。セッションを終了します。',
      en: 'Timeout occurred. Ending session.',
      'zh-CN': '超时。结束会话。',
      'zh-TW': '逾時。結束會話。',
      ko: '시간 초과. 세션을 종료합니다.',
      es: 'Tiempo agotado. Finalizando sesión.',
      pt: 'Tempo esgotado. Encerrando sessão.',
      fr: 'Délai dépassé. Fin de la session.',
      de: 'Zeitüberschreitung. Sitzung wird beendet.',
      it: 'Timeout. Terminazione sessione.',
    },
  };

  return messages[errorType]?.[language] || messages[errorType]?.['en'] || 'An error occurred.';
}

/**
 * Get fallback termination message
 */
function getFallbackTerminationMessage(errorType: string, language: string = 'en'): string {
  const messages: Record<string, string> = {
    ja: 'エラーが発生したため、セッションを終了します。',
    en: 'Session terminated due to errors.',
    'zh-CN': '由于错误，会话已终止。',
    'zh-TW': '由於錯誤，會話已終止。',
    ko: '오류로 인해 세션이 종료되었습니다.',
    es: 'Sesión terminada debido a errores.',
    pt: 'Sessão encerrada devido a erros.',
    fr: 'Session terminée en raison d'erreurs.',
    de: 'Sitzung aufgrund von Fehlern beendet.',
    it: 'Sessione terminata a causa di errori.',
  };

  return messages[language] || messages['en'];
}

/**
 * Get fallback prompt for AI retry
 */
function getFallbackPrompt(language: string = 'en'): string {
  const prompts: Record<string, string> = {
    ja: 'もう一度、別の言い方で応答してください。',
    en: 'Please respond again in a different way.',
    'zh-CN': '请用不同的方式再次回应。',
    'zh-TW': '請用不同的方式再次回應。',
    ko: '다른 방식으로 다시 응답해 주세요.',
    es: 'Por favor, responde de nuevo de una manera diferente.',
    pt: 'Por favor, responda novamente de uma maneira diferente.',
    fr: 'Veuillez répondre à nouveau d'une manière différente.',
    de: 'Bitte antworten Sie erneut auf eine andere Weise.',
    it: 'Per favore, rispondi di nuovo in un modo diverso.',
  };

  return prompts[language] || prompts['en'];
}
