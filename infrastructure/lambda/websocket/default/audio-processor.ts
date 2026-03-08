/**
 * Audio Processing Pipeline
 * Handles STT -> AI -> TTS flow
 */

import { LANGUAGE_DEFAULTS } from '../../shared/config/defaults';
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
  language?: string; // Deprecated: 固定言語設定（非推奨）
  autoDetectLanguages?: string[]; // 自動言語検出候補（推奨）
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
    // Initialize STT with auto-detect (推奨) or fixed language (非推奨)
    this.stt = new AzureSpeechToText({
      subscriptionKey: config.azureSpeechKey,
      region: config.azureSpeechRegion,
      autoDetectLanguages: config.autoDetectLanguages, // 自動言語検出（推奨）
      language: config.language, // フォールバック用固定言語（非推奨）
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
  async processAudio(options: ProcessAudioOptions): Promise<ProcessAudioResult> {
    const { audioData, sessionId, scenarioPrompt, conversationHistory = [] } = options;

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
      await this.saveAudioToS3(ttsResult.audio, sessionId, 'output', ttsResult.contentType);

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
      throw error instanceof Error ? error : new Error('Audio processing failed');
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

      // Get ffmpeg path with multiple fallback options
      let ffmpegPath = process.env.FFMPEG_PATH;

      if (!ffmpegPath) {
        // Try Lambda Layer path first
        if (fs.existsSync('/opt/bin/ffmpeg')) {
          ffmpegPath = '/opt/bin/ffmpeg';
        } else {
          // Fallback to npm package (ffmpeg-static)
          try {
            ffmpegPath = require('ffmpeg-static');
          } catch (error) {
            throw new Error('ffmpeg not found. Check Lambda Layer or ffmpeg-static package.');
          }
        }
      }

      console.log('[AudioProcessor] Using ffmpeg path:', ffmpegPath);

      // Convert to WAV (16kHz, mono, 16-bit PCM) with volume boost for better speech recognition
      // Note: volume=10.0 amplifies audio by 10x to improve Azure STT detection
      // Also apply dynamic audio compression to normalize levels
      const command = `${ffmpegPath} -i ${inputFile} -af "volume=10.0,acompressor=threshold=0.089:ratio=9:attack=200:release=1000" -acodec pcm_s16le -ar 16000 -ac 1 -f wav ${outputFile}`;

      console.log('[AudioProcessor] Converting audio with ffmpeg:', command);
      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes('Output #0')) {
        console.warn('[AudioProcessor] ffmpeg stderr:', stderr);
      }

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
   * Analyze WAV file for audio quality diagnostics
   */
  private async analyzeWavFile(wavBuffer: Buffer): Promise<{
    sampleCount: number;
    durationSeconds: number;
    peakLevel: number;
    rmsLevel: number;
    hasSpeech: boolean;
  }> {
    // WAV header parsing
    // Offset 40: data chunk, next 4 bytes = data size
    const dataSize = wavBuffer.readUInt32LE(40);
    const sampleCount = dataSize / 2; // 16-bit = 2 bytes per sample
    const sampleRate = wavBuffer.readUInt32LE(24);
    const durationSeconds = sampleCount / sampleRate;

    // Analyze audio samples (starting at offset 44)
    let peakLevel = 0;
    let sumSquares = 0;

    for (let i = 44; i < wavBuffer.length; i += 2) {
      const sample = wavBuffer.readInt16LE(i);
      const normalizedSample = Math.abs(sample) / 32768.0; // Normalize to 0.0-1.0
      peakLevel = Math.max(peakLevel, normalizedSample);
      sumSquares += normalizedSample * normalizedSample;
    }

    const rmsLevel = Math.sqrt(sumSquares / sampleCount);

    // Heuristic: RMS > 0.01 suggests audio contains speech/sound
    const hasSpeech = rmsLevel > 0.01;

    return {
      sampleCount,
      durationSeconds,
      peakLevel,
      rmsLevel,
      hasSpeech,
    };
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
      audioFormat = 'unknown';
      wavBuffer = await this.convertToWav(audioData, 'unknown');
    }
    // Check if OGG format
    else if (audioData.slice(0, 4).toString() === 'OggS') {
      console.log('[AudioProcessor] Detected OGG format, converting to WAV');
      audioFormat = 'ogg';
      wavBuffer = await this.convertToWav(audioData, 'ogg');
    } else {
      console.log('[AudioProcessor] Unknown audio format, assuming WebM');
      audioFormat = 'unknown';
      wavBuffer = await this.convertToWav(audioData, 'unknown');
    }

    // 🔍 音声品質診断
    const analysis = await this.analyzeWavFile(wavBuffer);
    console.log('[AudioProcessor] Audio analysis:', {
      durationSeconds: analysis.durationSeconds.toFixed(2),
      sampleCount: analysis.sampleCount,
      peakLevel: analysis.peakLevel.toFixed(4),
      rmsLevel: analysis.rmsLevel.toFixed(4),
      hasSpeech: analysis.hasSpeech,
    });

    // 🚨 音声が含まれていない場合は事前に警告
    if (!analysis.hasSpeech) {
      console.warn('[AudioProcessor] WARNING: Audio RMS level too low, may not contain speech');
      throw new Error(
        `Audio quality check failed: RMS level ${analysis.rmsLevel.toFixed(4)} is too low. ` +
          `This typically means the microphone is muted, not working, or the audio is too quiet. ` +
          `Please check your microphone settings and speak louder.`
      );
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
    type: 'input' | 'output',
    contentType: string = 'audio/webm'
  ): Promise<string> {
    const timestamp = Date.now();

    // Determine file extension based on content type
    let extension = 'webm';
    if (contentType.includes('mpeg') || contentType.includes('mp3')) {
      extension = 'mp3';
    } else if (contentType.includes('wav')) {
      extension = 'wav';
    } else if (contentType.includes('ogg')) {
      extension = 'ogg';
    }

    const key = `sessions/${sessionId}/audio/${type}-${timestamp}.${extension}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: audioData,
          ContentType: contentType,
        })
      );

      console.log(`[AudioProcessor] Saved ${type} audio to S3:`, {
        key,
        contentType,
        size: audioData.length,
      });
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
      const aiResponse = await this.generateAIResponse(text, scenarioPrompt, conversationHistory);

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
