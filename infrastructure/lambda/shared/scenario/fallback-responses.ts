/**
 * Fallback Response System
 * Phase 1.6.1 Day 36: AI応答エラー時のフォールバック応答
 *
 * AI応答生成に失敗した場合の代替応答を提供
 * 3パターンをローテーションで使用
 */

/**
 * Get fallback response based on attempt number (rotation pattern)
 */
export function getFallbackResponse(attemptNumber: number, language: string = 'en'): string {
  // Use modulo 3 for rotation (0, 1, 2, 0, 1, 2, ...)
  const patternIndex = attemptNumber % 3;

  const patterns: Record<string, string[]> = {
    ja: [
      // Pattern 0: 謝罪 + 再試行依頼
      '申し訳ございません。ただいま回答の準備に時間がかかっております。もう一度お願いできますでしょうか？',
      // Pattern 1: 確認 + 言い換え依頼
      'すみません、もう一度確認させてください。別の言い方で教えていただけますか？',
      // Pattern 2: 簡潔な謝罪 + 継続
      '申し訳ありません。もう一度お聞かせください。',
    ],
    en: [
      // Pattern 0: Apology + retry request
      'I apologize. I need a moment to prepare my response. Could you please repeat that?',
      // Pattern 1: Confirmation + rephrase request
      "I'm sorry, let me confirm. Could you rephrase that in a different way?",
      // Pattern 2: Brief apology + continue
      'My apologies. Please go ahead and continue.',
    ],
    'zh-CN': [
      '抱歉，我需要一点时间准备回复。您能再说一遍吗？',
      '对不起，让我确认一下。您能换个说法吗？',
      '抱歉。请继续说。',
    ],
    'zh-TW': [
      '抱歉，我需要一點時間準備回覆。您能再說一遍嗎？',
      '對不起，讓我確認一下。您能換個說法嗎？',
      '抱歉。請繼續說。',
    ],
    ko: [
      '죄송합니다. 답변을 준비하는 데 시간이 좀 걸리고 있습니다. 다시 한 번 말씀해 주시겠어요?',
      '죄송합니다. 다시 확인하겠습니다. 다른 방식으로 말씀해 주시겠어요?',
      '죄송합니다. 계속 말씀해 주세요.',
    ],
    es: [
      'Disculpe. Necesito un momento para preparar mi respuesta. ¿Podría repetir eso?',
      'Lo siento, déjame confirmar. ¿Podrías reformularlo de otra manera?',
      'Mis disculpas. Por favor, continúe.',
    ],
    pt: [
      'Peço desculpas. Preciso de um momento para preparar minha resposta. Poderia repetir isso?',
      'Desculpe, deixe-me confirmar. Poderia reformular de outra maneira?',
      'Minhas desculpas. Por favor, continue.',
    ],
    fr: [
      "Je m'excuse. J'ai besoin d'un moment pour préparer ma réponse. Pourriez-vous répéter cela ?",
      'Désolé, laissez-moi confirmer. Pourriez-vous le reformuler différemment ?',
      'Mes excuses. Veuillez continuer.',
    ],
    de: [
      'Entschuldigung. Ich brauche einen Moment, um meine Antwort vorzubereiten. Könnten Sie das wiederholen?',
      'Entschuldigung, lassen Sie mich bestätigen. Könnten Sie das anders formulieren?',
      'Meine Entschuldigung. Bitte fahren Sie fort.',
    ],
    it: [
      'Mi scuso. Ho bisogno di un momento per preparare la mia risposta. Potresti ripetere?',
      'Scusa, lasciami confermare. Potresti riformulare in un modo diverso?',
      'Le mie scuse. Per favore, continua.',
    ],
  };

  const languagePatterns = patterns[language] || patterns['en'];
  return languagePatterns[patternIndex];
}

/**
 * Get termination message when max conversation turns reached
 */
export function getMaxTurnsReachedMessage(
  turnCount: number,
  maxTurns: number,
  language: string = 'en'
): string {
  const messages: Record<string, string> = {
    ja: `会話のターン数が上限（${maxTurns}回）に達しました。本日のセッションはこれで終了となります。お疲れ様でした。`,
    en: `The conversation has reached the maximum number of turns (${maxTurns}). This session will now end. Thank you for your participation.`,
    'zh-CN': `对话已达到最大轮次（${maxTurns}次）。本次会话现在将结束。感谢您的参与。`,
    'zh-TW': `對話已達到最大輪次（${maxTurns}次）。本次會話現在將結束。感謝您的參與。`,
    ko: `대화가 최대 턴 수(${maxTurns}회)에 도달했습니다. 이 세션이 이제 종료됩니다. 참여해 주셔서 감사합니다.`,
    es: `La conversación ha alcanzado el número máximo de turnos (${maxTurns}). Esta sesión finalizará ahora. Gracias por su participación.`,
    pt: `A conversa atingiu o número máximo de turnos (${maxTurns}). Esta sessão será encerrada agora. Obrigado pela sua participação.`,
    fr: `La conversation a atteint le nombre maximum de tours (${maxTurns}). Cette session va maintenant se terminer. Merci de votre participation.`,
    de: `Das Gespräch hat die maximale Anzahl von Runden (${maxTurns}) erreicht. Diese Sitzung wird jetzt beendet. Vielen Dank für Ihre Teilnahme.`,
    it: `La conversazione ha raggiunto il numero massimo di turni (${maxTurns}). Questa sessione terminerà ora. Grazie per la tua partecipazione.`,
  };

  return messages[language] || messages['en'];
}
