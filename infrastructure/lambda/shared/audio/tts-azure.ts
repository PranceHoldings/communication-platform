/**
 * Azure Cognitive Services - Text-to-Speech Integration
 * Uses the same SDK as Azure STT (microsoft-cognitiveservices-speech-sdk)
 * Provides drop-in replacement for ElevenLabs TTS
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { retryWithBackoff } from '../utils/retry';

export interface AzureTTSConfig {
  subscriptionKey: string;
  region: string;
  voiceName: string; // e.g., 'ja-JP-NanamiNeural', 'en-US-JennyNeural'
}

// Compatible with ElevenLabs TTSOptions interface
export interface TTSOptions {
  text: string;
  stability?: number;        // Not used by Azure (ElevenLabs compat shim)
  similarityBoost?: number;  // Not used by Azure (ElevenLabs compat shim)
  style?: number;            // Not used by Azure (ElevenLabs compat shim)
  useSpeakerBoost?: boolean; // Not used by Azure (ElevenLabs compat shim)
}

export interface TTSResult {
  audio: Buffer;
  contentType: string;
  sizeBytes: number;
}

export class AzureTextToSpeech {
  constructor(private config: AzureTTSConfig) {}

  private createSpeechConfig(): sdk.SpeechConfig {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      this.config.subscriptionKey,
      this.config.region
    );
    speechConfig.speechSynthesisVoiceName = this.config.voiceName;
    // MP3 16kHz 32kbps — compatible with existing audio pipeline (same as ElevenLabs output)
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    return speechConfig;
  }

  /**
   * Generate speech from text.
   * Returns full MP3 audio buffer.
   * Includes automatic retry with exponential backoff for transient errors.
   */
  async generateSpeech(options: TTSOptions): Promise<TTSResult> {
    const result = await retryWithBackoff(() => this._generateSpeechInternal(options), {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      retryableErrors: ['timeout', 'connection', 'throttle', 'rate limit', '503', 'ServiceUnavailable'],
      onRetry: (error, attempt, delay) => {
        console.warn('[AzureTTS] Retrying TTS request:', {
          error: error.message,
          attempt,
          nextRetryIn: delay,
        });
      },
    });

    console.log('[AzureTTS] Speech generation completed:', {
      attempts: result.attempts,
      totalDelay: result.totalDelay,
      audioSize: result.result.sizeBytes,
    });

    return result.result;
  }

  private async _generateSpeechInternal(options: TTSOptions): Promise<TTSResult> {
    const speechConfig = this.createSpeechConfig();
    // Pass null as AudioConfig → audio data is returned in result.audioData (headless/Lambda mode)
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined as unknown as sdk.AudioConfig);

    return new Promise<TTSResult>((resolve, reject) => {
      synthesizer.speakTextAsync(
        options.text,
        (result: sdk.SpeechSynthesisResult) => {
          synthesizer.close();
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            const audio = Buffer.from(result.audioData);
            console.log('[AzureTTS] Generated speech:', {
              textLength: options.text.length,
              audioSize: audio.length,
              voiceName: this.config.voiceName,
            });
            resolve({
              audio,
              contentType: 'audio/mpeg',
              sizeBytes: audio.length,
            });
          } else {
            reject(new Error(`Azure TTS synthesis failed: ${result.errorDetails}`));
          }
        },
        (errorMsg: string) => {
          synthesizer.close();
          reject(new Error(errorMsg));
        }
      );
    });
  }

  /**
   * Generate speech with streaming (drop-in replacement for ElevenLabs generateSpeechWebSocketStream).
   *
   * Strategy: synthesize full audio first, then yield in chunks so the WebSocket
   * client receives incremental data and can start playback before all data is sent.
   * Chunk size: 8KB — balances WebSocket message count vs. playback start latency.
   */
  async generateSpeechWebSocketStream(
    options: TTSOptions
  ): Promise<AsyncGenerator<{ audio: string; isFinal: boolean }>> {
    const result = await this.generateSpeech(options);
    const audio = result.audio;
    const CHUNK_SIZE = 8192; // 8KB per chunk

    console.log('[AzureTTS] Starting WebSocket stream:', {
      totalBytes: audio.length,
      expectedChunks: Math.ceil(audio.length / CHUNK_SIZE),
    });

    async function* generator(): AsyncGenerator<{ audio: string; isFinal: boolean }> {
      let offset = 0;
      while (offset < audio.length) {
        const chunk = audio.slice(offset, offset + CHUNK_SIZE);
        offset += CHUNK_SIZE;
        yield { audio: chunk.toString('base64'), isFinal: false };
      }
      // Final sentinel — matches ElevenLabs isFinal:true behavior
      yield { audio: '', isFinal: true };
    }

    return generator();
  }
}
