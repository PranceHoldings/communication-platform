import { getDefaultSttConfidence } from '../utils/runtime-config-loader';
import { getSupportedSTTCodes } from '../config/language-config';
import { retryWithBackoff } from '../utils/retry';
/**
 * Azure Speech Services - Speech-to-Text Integration
 * Real-time audio transcription using Azure Cognitive Services
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureSTTConfig {
  subscriptionKey: string;
  region: string;
  language?: string; // Deprecated: 固定言語設定（後方互換性のため残す）
  autoDetectLanguages?: string[]; // 自動言語検出候補（推奨: ['ja-JP', 'en-US']）
  /**
   * @deprecated 非推奨 - ffmpeg silenceremove で無音トリミング対応済み
   * フォールバック用に小さい値（3秒）を設定（後方互換性のため残す）
   */
  initialSilenceTimeout?: number;
}

export interface TranscriptResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  offset: number;
  duration: number;
  language?: string; // 検出された言語（自動言語検出使用時のみ）
}

export class AzureSpeechToText {
  private config: sdk.SpeechConfig;
  private autoDetectConfig?: sdk.AutoDetectSourceLanguageConfig;
  private recognizer?: sdk.SpeechRecognizer;

  constructor(private options: AzureSTTConfig) {
    this.config = sdk.SpeechConfig.fromSubscription(options.subscriptionKey, options.region);

    // 自動言語検出設定（推奨）
    if (options.autoDetectLanguages && options.autoDetectLanguages.length > 0) {
      this.autoDetectConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(
        options.autoDetectLanguages
      );
      console.log('[AzureSTT] Auto-detect enabled for languages:', options.autoDetectLanguages);
    } else {
      // フォールバック: 固定言語設定（非推奨）
      this.config.speechRecognitionLanguage = options.language || LANGUAGE_DEFAULTS.STT_LANGUAGE;
      console.log('[AzureSTT] Fixed language mode:', this.config.speechRecognitionLanguage);
    }

    // Enable detailed results
    this.config.outputFormat = sdk.OutputFormat.Detailed;

    // Enable profanity filtering
    this.config.setProfanity(sdk.ProfanityOption.Masked);

    // 🔧 初期サイレンスタイムアウト設定（フォールバック用、デフォルト: 1000ms）
    // 注: 音声の無音部分は ffmpeg silenceremove でトリミング済みなので短い値で十分
    const initialSilenceTimeout = options.initialSilenceTimeout || 1000;
    this.config.setProperty(
      sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
      String(initialSilenceTimeout)
    );
    console.log(
      '[AzureSTT] InitialSilenceTimeout (fallback) set to ' + initialSilenceTimeout + 'ms'
    );

    // 🔧 エンドサイレンスタイムアウト（ファイルベース認識用に短縮: 1秒）
    // 理由: speech_end 受信後にファイル全体を処理するため、Azure が最後の単語後に
    // 待機する時間を短くして応答速度を向上させる（旧値: 2000ms → 1000ms, -1秒）
    this.config.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, '1000');
  }

  /**
   * Start continuous recognition from push stream
   * Use this for real-time audio chunk processing
   */
  startContinuousRecognition(
    onPartialResult: (result: TranscriptResult) => void,
    onFinalResult: (result: TranscriptResult) => void,
    onError: (error: Error) => void
  ): sdk.PushAudioInputStream {
    try {
      // Create push audio input stream
      const pushStream = sdk.AudioInputStream.createPushStream();

      // Create audio config from stream
      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

      // Create recognizer
      this.recognizer = new sdk.SpeechRecognizer(this.config, audioConfig);

      // Handle recognizing (partial results)
      this.recognizer.recognizing = (_sender, event) => {
        if (event.result.reason === sdk.ResultReason.RecognizingSpeech) {
          onPartialResult({
            text: event.result.text,
            confidence: 0,
            isFinal: false,
            offset: event.result.offset,
            duration: event.result.duration,
          });
        }
      };

      // Handle recognized (final results)
      this.recognizer.recognized = async (_sender, event) => {
        if (event.result.reason === sdk.ResultReason.RecognizedSpeech) {
          // Extract confidence from detailed results
          const details = event.result.properties.getProperty(
            sdk.PropertyId.SpeechServiceResponse_JsonResult
          );

          let confidence = await getDefaultSttConfidence();

          if (details) {
            try {
              const json = JSON.parse(details);
              confidence = json.NBest?.[0]?.Confidence || 0.95;
            } catch {
              // Use default
            }
          }

          onFinalResult({
            text: event.result.text,
            confidence,
            isFinal: true,
            offset: event.result.offset,
            duration: event.result.duration,
          });
        } else if (event.result.reason === sdk.ResultReason.NoMatch) {
          console.log('[AzureSTT] No speech could be recognized');
        }
      };

      // Handle errors
      this.recognizer.canceled = (_sender, event) => {
        if (event.reason === sdk.CancellationReason.Error) {
          onError(new Error(`Azure STT Error: ${event.errorDetails} (Code: ${event.errorCode})`));
        }
      };

      // Handle session stopped
      this.recognizer.sessionStopped = () => {
        console.log('[AzureSTT] Session stopped');
      };

      // Start continuous recognition
      this.recognizer.startContinuousRecognitionAsync(
        () => {
          console.log('[AzureSTT] Continuous recognition started');
        },
        error => {
          onError(new Error(`Failed to start recognition: ${error}`));
        }
      );

      return pushStream;
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Failed to initialize Azure STT'));
      throw error;
    }
  }

  /**
   * Stop continuous recognition
   */
  async stopRecognition(): Promise<void> {
    if (!this.recognizer) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.recognizer!.stopContinuousRecognitionAsync(
        () => {
          console.log('[AzureSTT] Recognition stopped');
          this.recognizer?.close();
          this.recognizer = undefined;
          resolve();
        },
        error => {
          console.error('[AzureSTT] Failed to stop recognition:', error);
          reject(new Error(`Failed to stop recognition: ${error}`));
        }
      );
    });
  }

  /**
   * Process single audio file (for non-streaming scenarios)
   * Includes automatic retry with exponential backoff for transient errors
   */
  async recognizeFromFile(audioFilePath: string): Promise<TranscriptResult> {
    // Wrap in retry logic
    const result = await retryWithBackoff(() => this._recognizeFromFileInternal(audioFilePath), {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      retryableErrors: ['timeout', 'connection', 'throttl', 'rate limit', 'service unavailable'],
      onRetry: (error, attempt, delay) => {
        console.warn('[AzureSTT] Retrying STT request:', {
          error: error.message,
          attempt,
          nextRetryIn: delay,
        });
      },
    });

    console.log('[AzureSTT] Recognition completed:', {
      attempts: result.attempts,
      totalDelay: result.totalDelay,
      textLength: result.result.text.length,
    });

    return result.result;
  }

  /**
   * Internal recognition method (without retry logic)
   */
  private async _recognizeFromFileInternal(audioFilePath: string): Promise<TranscriptResult> {
    return new Promise((resolve, reject) => {
      try {
        const fs = require('fs');
        const audioBuffer = fs.readFileSync(audioFilePath);

        // Log audio file details for debugging
        console.log('[AzureSTT] Audio file details:', {
          path: audioFilePath,
          size: audioBuffer.length,
          header: audioBuffer.slice(0, 12).toString('hex'),
        });

        const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);

        let recognizer: sdk.SpeechRecognizer;

        // 自動言語検出が有効な場合
        if (this.autoDetectConfig) {
          recognizer = sdk.SpeechRecognizer.FromConfig(
            this.config,
            this.autoDetectConfig,
            audioConfig
          );
        } else {
          // 固定言語の場合
          recognizer = new sdk.SpeechRecognizer(this.config, audioConfig);
        }

        recognizer.recognizeOnceAsync(
          result => {
            // 検出された言語を取得（自動言語検出使用時のみ）
            // 注意: Azure Speech SDK v1.41では、結果から検出された言語を取得するための
            // 公式PropertyIdが存在しないため、ログ出力のみに使用
            // result.properties には内部的に言語情報が含まれる可能性があるが、
            // 標準APIでは公開されていない（Phase 2で調査予定）
            const detectedLanguage = this.autoDetectConfig
              ? 'auto-detected' // PropertyIdが存在しないため、プレースホルダー
              : undefined;

            console.log('[AzureSTT] Recognition result:', {
              reason: result.reason,
              reasonText: sdk.ResultReason[result.reason],
              text: result.text,
              duration: result.duration,
              offset: result.offset,
              detectedLanguage: detectedLanguage || 'N/A',
            });

            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              resolve({
                text: result.text,
                confidence: 0.95,
                isFinal: true,
                offset: result.offset,
                duration: result.duration,
                language: detectedLanguage, // 検出された言語
              });
            } else if (result.reason === sdk.ResultReason.NoMatch) {
              const noMatchDetails = sdk.NoMatchDetails.fromResult(result);
              reject(
                new Error(
                  `No speech recognized. Reason: ${sdk.NoMatchReason[noMatchDetails.reason]}. ` +
                    `This typically means the audio contains no detectable speech, ` +
                    `the speech is too quiet, or the audio format is incompatible.`
                )
              );
            } else if (result.reason === sdk.ResultReason.Canceled) {
              const cancellation = sdk.CancellationDetails.fromResult(result);
              reject(
                new Error(
                  `Recognition canceled. Reason: ${sdk.CancellationReason[cancellation.reason]}. ` +
                    `Error: ${cancellation.errorDetails}`
                )
              );
            } else {
              reject(
                new Error(
                  `Recognition failed with reason: ${sdk.ResultReason[result.reason]} (${result.reason})`
                )
              );
            }
            recognizer.close();
          },
          error => {
            recognizer.close();
            reject(new Error(`Recognition error: ${error}`));
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return getSupportedSTTCodes();
  }
}
