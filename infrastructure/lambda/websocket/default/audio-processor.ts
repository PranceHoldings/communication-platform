/**
 * Audio Processing Pipeline
 * Handles STT -> AI -> TTS flow
 */

import { AzureSpeechToText } from '../../shared/audio/stt-azure';
import { ElevenLabsTextToSpeech } from '../../shared/audio/tts-elevenlabs';
import { BedrockAI } from '../../shared/ai/bedrock';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

export interface AudioProcessorConfig {
  azureSpeechKey: string;
  azureSpeechRegion: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId?: string;
  bedrockRegion: string;
  bedrockModelId: string;
  s3Bucket: string;
  language?: string;
}

export interface ProcessAudioOptions {
  audioData: Buffer;
  sessionId: string;
  scenarioPrompt?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ProcessAudioResult {
  transcript: string;
  aiResponse: string;
  audioResponse: Buffer;
  audioContentType: string;
}

export class AudioProcessor {
  private stt: AzureSpeechToText;
  private tts: ElevenLabsTextToSpeech;
  private ai: BedrockAI;
  private s3: S3Client;
  private s3Bucket: string;

  constructor(private config: AudioProcessorConfig) {
    // Initialize STT
    this.stt = new AzureSpeechToText({
      subscriptionKey: config.azureSpeechKey,
      region: config.azureSpeechRegion,
      language: config.language || 'en-US',
    });

    // Initialize TTS
    this.tts = new ElevenLabsTextToSpeech({
      apiKey: config.elevenLabsApiKey,
      voiceId: config.elevenLabsVoiceId,
      modelId: config.elevenLabsModelId,
    });

    // Initialize AI
    this.ai = new BedrockAI({
      region: config.bedrockRegion,
      modelId: config.bedrockModelId,
    });

    // Initialize S3 for temporary audio storage
    this.s3 = new S3Client({ region: config.bedrockRegion });
    this.s3Bucket = config.s3Bucket;
  }

  /**
   * Process audio through complete STT -> AI -> TTS pipeline
   */
  async processAudio(
    options: ProcessAudioOptions
  ): Promise<ProcessAudioResult> {
    const { audioData, sessionId, scenarioPrompt, conversationHistory = [] } =
      options;

    console.log('[AudioProcessor] Starting pipeline:', {
      sessionId,
      audioSize: audioData.length,
      hasScenarioPrompt: !!scenarioPrompt,
      historyLength: conversationHistory.length,
    });

    try {
      // Step 1: Save audio to S3 temporarily (for debugging/audit)
      const audioKey = await this.saveAudioToS3(audioData, sessionId, 'input');

      // Step 2: Transcribe audio using Azure STT
      const transcript = await this.transcribeAudio(audioData);

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('No speech detected in audio');
      }

      console.log('[AudioProcessor] Transcription:', transcript);

      // Step 3: Generate AI response using Bedrock
      const aiResponse = await this.generateAIResponse(
        transcript,
        scenarioPrompt,
        conversationHistory
      );

      console.log('[AudioProcessor] AI Response:', aiResponse.substring(0, 100));

      // Step 4: Synthesize AI response to speech using ElevenLabs
      const ttsResult = await this.tts.generateSpeech({
        text: aiResponse,
        stability: 0.5,
        similarityBoost: 0.75,
      });

      // Step 5: Save response audio to S3 (for debugging/audit)
      await this.saveAudioToS3(ttsResult.audio, sessionId, 'output');

      console.log('[AudioProcessor] Pipeline complete:', {
        transcriptLength: transcript.length,
        responseLength: aiResponse.length,
        audioOutputSize: ttsResult.sizeBytes,
      });

      return {
        transcript,
        aiResponse,
        audioResponse: ttsResult.audio,
        audioContentType: ttsResult.contentType,
      };
    } catch (error) {
      console.error('[AudioProcessor] Pipeline failed:', error);
      throw error instanceof Error
        ? error
        : new Error('Audio processing failed');
    }
  }

  /**
   * Convert audio to WAV format using ffmpeg
   */
  private async convertToWav(inputBuffer: Buffer, inputFormat: string): Promise<Buffer> {
    const fs = await import('fs');
    const { promisify } = await import('util');
    const { exec } = await import('child_process');
    const execAsync = promisify(exec);

    const inputFile = `/tmp/input-${crypto.randomUUID()}.${inputFormat}`;
    const outputFile = `/tmp/output-${crypto.randomUUID()}.wav`;

    try {
      // Write input buffer to file
      fs.writeFileSync(inputFile, inputBuffer);

      // Get ffmpeg path from environment variable or fallback to installed version
      const ffmpegPath = process.env.FFMPEG_PATH || require('@ffmpeg-installer/ffmpeg').path;

      // Convert to WAV (16kHz, mono, 16-bit PCM)
      const command = `${ffmpegPath} -i ${inputFile} -acodec pcm_s16le -ar 16000 -ac 1 ${outputFile}`;

      console.log('[AudioProcessor] Converting audio with ffmpeg:', command);
      await execAsync(command);

      // Read output file
      const wavBuffer = fs.readFileSync(outputFile);

      console.log('[AudioProcessor] Conversion complete:', {
        inputSize: inputBuffer.length,
        outputSize: wavBuffer.length,
      });

      return wavBuffer;
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch (error) {
        console.error('[AudioProcessor] Failed to clean up temp files:', error);
      }
    }
  }

  /**
   * Transcribe audio using Azure Speech Services
   */
  private async transcribeAudio(audioData: Buffer): Promise<string> {
    const fs = await import('fs');

    // Detect audio format from buffer header
    let audioFormat = 'unknown';
    let wavBuffer = audioData;

    // Check if already WAV format (RIFF header)
    if (audioData.slice(0, 4).toString() === 'RIFF') {
      console.log('[AudioProcessor] Audio is already in WAV format');
      audioFormat = 'wav';
    }
    // Check if WebM format
    else if (audioData.slice(0, 4).toString('hex').startsWith('1a45dfa3')) {
      console.log('[AudioProcessor] Detected WebM format, converting to WAV');
      audioFormat = 'webm';
      wavBuffer = await this.convertToWav(audioData, 'webm');
    }
    // Check if OGG format
    else if (audioData.slice(0, 4).toString() === 'OggS') {
      console.log('[AudioProcessor] Detected OGG format, converting to WAV');
      audioFormat = 'ogg';
      wavBuffer = await this.convertToWav(audioData, 'ogg');
    }
    else {
      console.log('[AudioProcessor] Unknown audio format, assuming WebM');
      audioFormat = 'webm';
      wavBuffer = await this.convertToWav(audioData, 'webm');
    }

    // Save audio as temporary WAV file
    const tempFile = `/tmp/audio-${crypto.randomUUID()}.wav`;
    fs.writeFileSync(tempFile, wavBuffer);

    try {
      const result = await this.stt.recognizeFromFile(tempFile);
      return result.text;
    } finally {
      // Clean up temp file
      fs.unlinkSync(tempFile);
    }
  }

  /**
   * Generate AI response using Bedrock Claude
   */
  private async generateAIResponse(
    userMessage: string,
    scenarioPrompt?: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    if (scenarioPrompt) {
      const response = await this.ai.generateScenarioResponse(
        userMessage,
        scenarioPrompt,
        conversationHistory
      );
      return response.text;
    } else {
      const response = await this.ai.generateResponse({
        userMessage,
        conversationHistory,
      });
      return response.text;
    }
  }

  /**
   * Save audio to S3 for debugging/audit
   */
  private async saveAudioToS3(
    audioData: Buffer,
    sessionId: string,
    type: 'input' | 'output'
  ): Promise<string> {
    const timestamp = Date.now();
    const key = `sessions/${sessionId}/audio/${type}-${timestamp}.webm`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: audioData,
          ContentType: 'audio/webm',
        })
      );

      console.log(`[AudioProcessor] Saved ${type} audio to S3:`, key);
      return key;
    } catch (error) {
      console.error(`[AudioProcessor] Failed to save ${type} audio:`, error);
      // Non-critical error, continue processing
      return '';
    }
  }

  /**
   * Process text-only message (skip STT)
   */
  async processTextMessage(
    text: string,
    sessionId: string,
    scenarioPrompt?: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<Omit<ProcessAudioResult, 'transcript'>> {
    console.log('[AudioProcessor] Processing text message:', text);

    try {
      // Generate AI response
      const aiResponse = await this.generateAIResponse(
        text,
        scenarioPrompt,
        conversationHistory
      );

      // Synthesize to speech
      const ttsResult = await this.tts.generateSpeech({
        text: aiResponse,
        stability: 0.5,
        similarityBoost: 0.75,
      });

      return {
        aiResponse,
        audioResponse: ttsResult.audio,
        audioContentType: ttsResult.contentType,
      };
    } catch (error) {
      console.error('[AudioProcessor] Text processing failed:', error);
      throw error;
    }
  }
}
