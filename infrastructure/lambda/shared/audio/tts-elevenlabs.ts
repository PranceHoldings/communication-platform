/**
 * ElevenLabs - Text-to-Speech Integration
 * High-quality voice synthesis with emotion control
 */

import { Readable } from 'stream';
import WebSocket from 'ws';
import { retryWithBackoff } from '../utils/retry';
import { getTtsStability, getTtsSimilarityBoost } from '../utils/runtime-config-loader';

export interface ElevenLabsTTSConfig {
  apiKey: string;
  voiceId: string;
  modelId?: string;
}

export interface TTSOptions {
  text: string;
  stability?: number; // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number; // 0-1, default 0
  useSpeakerBoost?: boolean; // default true
}

export interface TTSResult {
  audio: Buffer;
  contentType: string;
  sizeBytes: number;
}

export class ElevenLabsTextToSpeech {
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private apiKey: string;
  private voiceId: string;
  private modelId: string;

  constructor(private options: ElevenLabsTTSConfig) {
    this.apiKey = options.apiKey;
    this.voiceId = options.voiceId;
    // デフォルト値は shared/config/defaults.ts (ELEVENLABS_DEFAULTS.MODEL_ID) で管理
    this.modelId = options.modelId || 'eleven_flash_v2_5';
  }

  /**
   * Generate speech from text
   * Returns audio buffer in MP3 format
   * Includes automatic retry with exponential backoff for transient errors
   */
  async generateSpeech(options: TTSOptions): Promise<TTSResult> {
    // Wrap in retry logic
    const result = await retryWithBackoff(() => this._generateSpeechInternal(options), {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
      retryableErrors: ['timeout', 'connection', 'quota', 'rate limit', '429', '503'],
      onRetry: (error, attempt, delay) => {
        console.warn('[ElevenLabsTTS] Retrying TTS request:', {
          error: error.message,
          attempt,
          nextRetryIn: delay,
        });
      },
    });

    console.log('[ElevenLabsTTS] Speech generation completed:', {
      attempts: result.attempts,
      totalDelay: result.totalDelay,
      audioSize: result.result.sizeBytes,
    });

    return result.result;
  }

  /**
   * Internal speech generation method (without retry logic)
   */
  private async _generateSpeechInternal(options: TTSOptions): Promise<TTSResult> {
    // Load runtime configs for TTS settings
    const defaultStability = await getTtsStability();
    const defaultSimilarityBoost = await getTtsSimilarityBoost();

    const {
      text,
      stability = defaultStability,
      similarityBoost = defaultSimilarityBoost,
      style = 0,
      useSpeakerBoost = true,
    } = options;

    try {
      const url = `${this.baseUrl}/text-to-speech/${this.voiceId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: this.modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'audio/mpeg';

      console.log('[ElevenLabsTTS] Generated speech:', {
        textLength: text.length,
        audioSize: audioBuffer.length,
        voiceId: this.voiceId,
      });

      return {
        audio: audioBuffer,
        contentType,
        sizeBytes: audioBuffer.length,
      };
    } catch (error) {
      console.error('[ElevenLabsTTS] Failed to generate speech:', error);
      throw error instanceof Error ? error : new Error('Failed to generate speech');
    }
  }

  /**
   * Generate speech with streaming (for real-time playback)
   * Returns a readable stream of audio chunks
   */
  async generateSpeechStream(options: TTSOptions): Promise<Readable> {
    // Load runtime configs for TTS settings
    const defaultStability = await getTtsStability();
    const defaultSimilarityBoost = await getTtsSimilarityBoost();

    const {
      text,
      stability = defaultStability,
      similarityBoost = defaultSimilarityBoost,
      style = 0,
      useSpeakerBoost = true,
    } = options;

    try {
      const url = `${this.baseUrl}/text-to-speech/${this.voiceId}/stream`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: this.modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      console.log('[ElevenLabsTTS] Streaming speech started');

      // Convert Web ReadableStream to Node.js Readable stream
      const readable = Readable.from(response.body as any);
      return readable;
    } catch (error) {
      console.error('[ElevenLabsTTS] Failed to stream speech:', error);
      throw error instanceof Error ? error : new Error('Failed to stream speech');
    }
  }

  /**
   * Get available voices for the account
   */
  async getVoices(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/voices`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }

      const data = (await response.json()) as { voices?: any[] };
      return data.voices || [];
    } catch (error) {
      console.error('[ElevenLabsTTS] Failed to get voices:', error);
      throw error;
    }
  }

  /**
   * Get voice settings for a specific voice
   */
  async getVoiceSettings(voiceId?: string): Promise<any> {
    const targetVoiceId = voiceId || this.voiceId;

    try {
      const url = `${this.baseUrl}/voices/${targetVoiceId}/settings`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get voice settings: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ElevenLabsTTS] Failed to get voice settings:', error);
      throw error;
    }
  }

  /**
   * Check API quota/usage
   */
  async getUsage(): Promise<any> {
    try {
      const url = `${this.baseUrl}/user`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get usage: ${response.status}`);
      }

      const data = (await response.json()) as {
        subscription?: {
          character_count?: number;
          character_limit?: number;
          can_extend_character_limit?: boolean;
        };
      };
      return {
        characterCount: data.subscription?.character_count || 0,
        characterLimit: data.subscription?.character_limit || 0,
        canExtendCharacterLimit: data.subscription?.can_extend_character_limit || false,
      };
    } catch (error) {
      console.error('[ElevenLabsTTS] Failed to get usage:', error);
      throw error;
    }
  }

  /**
   * Generate speech with WebSocket streaming (for real-time playback with minimal latency)
   * Yields audio chunks as they are generated
   *
   * @param options - TTS options
   * @returns AsyncGenerator yielding base64-encoded audio chunks (MP3)
   */
  async generateSpeechWebSocketStream(
    options: TTSOptions
  ): Promise<AsyncGenerator<{ audio: string; isFinal: boolean }>> {
    // Load runtime configs for TTS settings
    const defaultStability = await getTtsStability();
    const defaultSimilarityBoost = await getTtsSimilarityBoost();

    const {
      text,
      stability = defaultStability,
      similarityBoost = defaultSimilarityBoost,
      style = 0,
      useSpeakerBoost = true,
    } = options;

    // WebSocket streaming endpoint
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=${this.modelId}&optimize_streaming_latency=3`;

    console.log('[ElevenLabsTTS] Opening WebSocket connection:', {
      voiceId: this.voiceId,
      modelId: this.modelId,
      textLength: text.length,
    });

    const ws = new WebSocket(wsUrl);

    // Use a queue + resolve/reject pattern to bridge event-based WebSocket
    // into an async generator that yields chunks as they arrive (true streaming).
    type QueueEntry =
      | { type: 'chunk'; value: { audio: string; isFinal: boolean } }
      | { type: 'done' }
      | { type: 'error'; error: Error };

    const queue: QueueEntry[] = [];
    let waitResolve: (() => void) | null = null;

    const enqueue = (entry: QueueEntry) => {
      queue.push(entry);
      if (waitResolve) {
        const r = waitResolve;
        waitResolve = null;
        r();
      }
    };

    ws.on('open', () => {
      console.log('[ElevenLabsTTS] WebSocket connected');

      // Send initial configuration
      ws.send(JSON.stringify({
        text: ' ',
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
        },
        xi_api_key: this.apiKey,
      }));

      // Send text content
      ws.send(JSON.stringify({
        text,
        try_trigger_generation: true,
      }));

      // Send EOS (End of Stream) signal
      ws.send(JSON.stringify({ text: '' }));
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());

        console.log('[ElevenLabsTTS] Received message:', {
          hasAudio: 'audio' in message,
          audioLength: message.audio ? message.audio.length : 0,
          isFinal: message.isFinal,
        });

        if ('audio' in message && message.audio !== null && message.audio !== undefined) {
          enqueue({ type: 'chunk', value: { audio: message.audio, isFinal: message.isFinal || false } });
        }

        if (message.isFinal) {
          console.log('[ElevenLabsTTS] WebSocket streaming complete');
          ws.close();
        }
      } catch (error) {
        console.error('[ElevenLabsTTS] Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[ElevenLabsTTS] WebSocket closed');
      enqueue({ type: 'done' });
    });

    ws.on('error', error => {
      console.error('[ElevenLabsTTS] WebSocket error:', error);
      enqueue({ type: 'error', error });
    });

    // Return async generator that yields chunks as they arrive from the WebSocket
    return (async function* () {
      while (true) {
        if (queue.length === 0) {
          // Wait for next entry
          await new Promise<void>(resolve => { waitResolve = resolve; });
        }
        const entry = queue.shift()!;
        if (entry.type === 'done') break;
        if (entry.type === 'error') throw entry.error;
        yield entry.value;
      }
    })();
  }
}
