/**
 * Azure Speech Services - Speech-to-Text Integration
 * Real-time audio transcription using Azure Cognitive Services
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureSTTConfig {
  subscriptionKey: string;
  region: string;
  language?: string;
}

export interface TranscriptResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  offset: number;
  duration: number;
}

export class AzureSpeechToText {
  private config: sdk.SpeechConfig;
  private recognizer?: sdk.SpeechRecognizer;

  constructor(private options: AzureSTTConfig) {
    this.config = sdk.SpeechConfig.fromSubscription(
      options.subscriptionKey,
      options.region
    );

    // Set language (default: en-US)
    this.config.speechRecognitionLanguage = options.language || 'en-US';

    // Enable detailed results
    this.config.outputFormat = sdk.OutputFormat.Detailed;

    // Enable profanity filtering
    this.config.setProfanity(sdk.ProfanityOption.Masked);

    console.log('[AzureSTT] Configured for language:', this.config.speechRecognitionLanguage);
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
      this.recognizer.recognized = (_sender, event) => {
        if (event.result.reason === sdk.ResultReason.RecognizedSpeech) {
          // Extract confidence from detailed results
          const details = event.result.properties.getProperty(
            sdk.PropertyId.SpeechServiceResponse_JsonResult
          );

          let confidence = 0.95; // Default

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
          onError(
            new Error(
              `Azure STT Error: ${event.errorDetails} (Code: ${event.errorCode})`
            )
          );
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
        (error) => {
          onError(new Error(`Failed to start recognition: ${error}`));
        }
      );

      return pushStream;
    } catch (error) {
      onError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize Azure STT')
      );
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
        (error) => {
          console.error('[AzureSTT] Failed to stop recognition:', error);
          reject(new Error(`Failed to stop recognition: ${error}`));
        }
      );
    });
  }

  /**
   * Process single audio file (for non-streaming scenarios)
   */
  async recognizeFromFile(audioFilePath: string): Promise<TranscriptResult> {
    return new Promise((resolve, reject) => {
      try {
        const audioConfig = sdk.AudioConfig.fromWavFileInput(
          require('fs').readFileSync(audioFilePath)
        );

        const recognizer = new sdk.SpeechRecognizer(this.config, audioConfig);

        recognizer.recognizeOnceAsync(
          (result) => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              resolve({
                text: result.text,
                confidence: 0.95,
                isFinal: true,
                offset: result.offset,
                duration: result.duration,
              });
            } else {
              reject(new Error(`Recognition failed: ${result.reason}`));
            }
            recognizer.close();
          },
          (error) => {
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
    return [
      'en-US', // English (United States)
      'ja-JP', // Japanese
      'zh-CN', // Chinese (Simplified)
      'es-ES', // Spanish
      'fr-FR', // French
      'de-DE', // German
      'it-IT', // Italian
      'ko-KR', // Korean
      'pt-BR', // Portuguese (Brazil)
    ];
  }
}
