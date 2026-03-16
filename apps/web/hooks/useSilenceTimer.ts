/**
 * useSilenceTimer Hook
 *
 * 無音時間を管理し、指定時間経過後にコールバックを実行するカスタムフック
 *
 * 主な機能:
 * - AI再生中は無音タイマーを停止
 * - ユーザー発話中は無音タイマーを停止
 * - speech_end処理中は無音タイマーを停止
 * - 1秒の猶予期間を設けて即座のタイムアウトを防止
 *
 * @example
 * const { elapsedTime, resetTimer } = useSilenceTimer({
 *   enabled: true,
 *   timeoutSeconds: 10,
 *   isAIPlaying: false,
 *   isUserSpeaking: false,
 *   isProcessing: false,
 *   onTimeout: () => console.log('Silence timeout!'),
 * });
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSilenceTimerOptions {
  enabled: boolean; // 無音タイマー有効/無効
  timeoutSeconds: number; // タイムアウト時間（秒）
  isAIPlaying: boolean; // AI音声再生中フラグ
  isUserSpeaking: boolean; // ユーザー発話中フラグ
  isProcessing: boolean; // speech_end処理中フラグ
  onTimeout: () => void; // タイムアウト時のコールバック
}

export interface UseSilenceTimerReturn {
  elapsedTime: number; // 経過時間（秒）
  resetTimer: () => void; // タイマーリセット関数
}

const GRACE_PERIOD_MS = 1000; // 1秒の猶予期間

export function useSilenceTimer(options: UseSilenceTimerOptions): UseSilenceTimerReturn {
  const { enabled, timeoutSeconds, isAIPlaying, isUserSpeaking, isProcessing, onTimeout } = options;

  const [elapsedTime, setElapsedTime] = useState(0);
  const [graceCompleted, setGraceCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  /**
   * タイマーをリセット
   * - インターバルタイマーをクリア
   * - 猶予期間タイマーをクリア
   * - 経過時間をリセット
   * - 猶予期間完了フラグをリセット
   */
  const resetTimer = useCallback(() => {
    // インターバルタイマーをクリア
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 猶予期間タイマーをクリア
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }

    startTimeRef.current = null;
    setElapsedTime(0);
    setGraceCompleted(false);
  }, []);

  /**
   * タイマーを開始
   * - 猶予期間（1秒）を経てからカウント開始
   * - 停止条件（AI再生中/ユーザー発話中/処理中）の場合は開始しない
   */
  const startTimer = useCallback(() => {
    console.log('[useSilenceTimer] startTimer() called:', {
      enabled,
      isAIPlaying,
      isUserSpeaking,
      isProcessing,
      graceCompleted,
      hasTimerRef: !!timerRef.current,
    });

    // 停止条件をチェック
    if (!enabled || isAIPlaying || isUserSpeaking || isProcessing) {
      console.log('[useSilenceTimer] ❌ Cannot start: blocking conditions present');
      return;
    }

    // 既にタイマーが動作中の場合は何もしない
    if (timerRef.current) {
      console.log('[useSilenceTimer] ⚠️ Timer already running');
      return;
    }

    // 猶予期間が完了していない場合は猶予期間を開始
    if (!graceCompleted) {
      console.log('[useSilenceTimer] ⏳ Starting grace period (1 second)');
      graceTimerRef.current = setTimeout(() => {
        console.log('[useSilenceTimer] ✅ Grace period completed');
        setGraceCompleted(true);
      }, GRACE_PERIOD_MS);
      return;
    }

    // 猶予期間完了後、タイマーを開始
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - (startTimeRef.current || now)) / 1000);
      setElapsedTime(elapsed);

      // タイムアウト到達
      if (elapsed >= timeoutSeconds) {
        console.log('[useSilenceTimer] ⏰ Timeout reached:', elapsed, 'seconds');
        onTimeout();
        resetTimer();
      }
    }, 1000);

    console.log('[useSilenceTimer] ✅ Timer started successfully');
  }, [
    enabled,
    isAIPlaying,
    isUserSpeaking,
    isProcessing,
    graceCompleted,
    timeoutSeconds,
    onTimeout,
    resetTimer,
  ]);

  /**
   * タイマー停止条件の監視
   * - AI再生中 → タイマーリセット
   * - ユーザー発話中 → タイマーリセット
   * - 処理中 → タイマーリセット
   * - 有効化されていない → タイマーリセット
   * - 上記以外でタイマー未開始 → タイマー開始
   */
  useEffect(() => {
    // 停止条件に該当する場合はリセット
    if (!enabled || isAIPlaying || isUserSpeaking || isProcessing) {
      if (timerRef.current || graceTimerRef.current) {
        console.log('[useSilenceTimer] 🛑 Stopping timer:', {
          enabled,
          isAIPlaying,
          isUserSpeaking,
          isProcessing,
        });
        resetTimer();
      }
      return;
    }

    // 停止条件に該当せず、タイマー未開始の場合は開始
    if (!timerRef.current && !graceTimerRef.current) {
      console.log('[useSilenceTimer] ▶️ Attempting to start timer (checking grace period):', {
        graceCompleted,
        enabled,
        isAIPlaying,
        isUserSpeaking,
        isProcessing,
      });
      startTimer();
    }
  }, [enabled, isAIPlaying, isUserSpeaking, isProcessing, startTimer, resetTimer]);

  /**
   * 猶予期間完了後、タイマーを開始
   */
  useEffect(() => {
    if (
      graceCompleted &&
      !timerRef.current &&
      enabled &&
      !isAIPlaying &&
      !isUserSpeaking &&
      !isProcessing
    ) {
      console.log('[useSilenceTimer] Grace period completed, starting main timer');
      startTimer();
    }
  }, [graceCompleted, enabled, isAIPlaying, isUserSpeaking, isProcessing, startTimer]);

  /**
   * タイムアウト秒数が変更された場合、タイマーをリセット
   */
  useEffect(() => {
    if (timerRef.current) {
      console.log('[useSilenceTimer] Timeout seconds changed, resetting timer');
      resetTimer();
    }
  }, [timeoutSeconds, resetTimer]);

  /**
   * クリーンアップ
   * - コンポーネントアンマウント時にタイマーをクリア
   */
  useEffect(() => {
    return () => {
      console.log('[useSilenceTimer] Cleanup: clearing all timers');
      resetTimer();
    };
  }, [resetTimer]);

  return {
    elapsedTime,
    resetTimer,
  };
}
