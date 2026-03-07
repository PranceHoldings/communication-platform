/**
 * ElevenLabs - Text-to-Speech Integration
 * High-quality voice synthesis with emotion control
 */

import { Readable } from 'stream';

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
   */
  async generateSpeech(options: TTSOptions): Promise<TTSResult> {
    const {
      text,
      stability = 0.5,
      similarityBoost = 0.75,
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
        throw new Error(
          `ElevenLabs API error (${response.status}): ${errorText}`
        );
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
      throw error instanceof Error
        ? error
        : new Error('Failed to generate speech');
    }
  }

  /**
   * Generate speech with streaming (for real-time playback)
   * Returns a readable stream of audio chunks
   */
  async generateSpeechStream(options: TTSOptions): Promise<Readable> {
    const {
      text,
      stability = 0.5,
      similarityBoost = 0.75,
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
        throw new Error(
          `ElevenLabs API error (${response.status}): ${errorText}`
        );
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
      throw error instanceof Error
        ? error
        : new Error('Failed to stream speech');
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

      const data = await response.json();
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

      const data = await response.json();
      return {
        characterCount: data.subscription?.character_count || 0,
        characterLimit: data.subscription?.character_limit || 0,
        canExtendCharacterLimit:
          data.subscription?.can_extend_character_limit || false,
      };
    } catch (error) {
      console.error('[ElevenLabsTTS] Failed to get usage:', error);
      throw error;
    }
  }
}
