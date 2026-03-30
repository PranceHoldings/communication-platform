/**
 * Audio Analyzer
 * Extracts audio features from recorded sessions for quality assessment
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { AudioFeatures, PauseInfo, FillerWordsInfo } from '@prance/shared';

const execAsync = promisify(exec);

export interface AudioAnalysisOptions {
  minPauseDuration?: number; // Minimum pause duration in seconds (default: 0.5)
  silenceThreshold?: number; // Silence threshold in dB (default: -30)
  detectFillerWords?: boolean; // Whether to detect filler words (default: true)
}

export interface AudioAnalysisResult extends AudioFeatures {
  pauses: PauseInfo[];
  fillerWords?: FillerWordsInfo;
  duration: number;
  processingTimeMs: number;
}

export class AudioAnalyzer {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor() {
    // Try to find ffmpeg in Lambda environment
    if (fs.existsSync('/opt/bin/ffmpeg')) {
      this.ffmpegPath = '/opt/bin/ffmpeg';
      this.ffprobePath = '/opt/bin/ffprobe';
    } else {
      // Fallback to system PATH
      this.ffmpegPath = 'ffmpeg';
      this.ffprobePath = 'ffprobe';
    }

    console.log('[AudioAnalyzer] Initialized', {
      ffmpegPath: this.ffmpegPath,
      ffprobePath: this.ffprobePath,
    });
  }

  /**
   * Analyze audio file and extract features
   */
  async analyzeAudio(
    audioPath: string,
    transcript?: string,
    options: AudioAnalysisOptions = {}
  ): Promise<AudioAnalysisResult> {
    const startTime = Date.now();

    const {
      minPauseDuration = 0.5, // Default: 0.5 seconds
      silenceThreshold = -30,
      detectFillerWords = true,
    } = options;

    console.log('[AudioAnalyzer] Starting audio analysis', {
      audioPath,
      hasTranscript: !!transcript,
      options,
    });

    try {
      // 1. Get audio information (duration, format, etc.)
      const audioInfo = await this.getAudioInfo(audioPath);
      console.log('[AudioAnalyzer] Audio info:', audioInfo);

      // 2. Analyze volume
      const volumeData = await this.analyzeVolume(audioPath);
      console.log('[AudioAnalyzer] Volume data:', volumeData);

      // 3. Detect pauses (silence)
      const pauses = await this.detectPauses(audioPath, minPauseDuration, silenceThreshold);
      console.log('[AudioAnalyzer] Detected pauses:', pauses.length);

      // 4. Calculate speaking rate (if transcript provided)
      let speakingRate: number | undefined;
      if (transcript) {
        speakingRate = this.calculateSpeakingRate(transcript, audioInfo.duration);
        console.log('[AudioAnalyzer] Speaking rate:', speakingRate, 'WPM');
      }

      // 5. Detect filler words (if transcript provided)
      let fillerWords: FillerWordsInfo | undefined;
      if (transcript && detectFillerWords) {
        fillerWords = this.detectFillerWords(transcript);
        console.log('[AudioAnalyzer] Filler words:', fillerWords.count);
      }

      // 6. Calculate pause statistics
      const pauseCount = pauses.length;
      const pauseDuration =
        pauses.length > 0 ? pauses.reduce((sum, p) => sum + p.duration, 0) / pauses.length : 0;

      const processingTime = Date.now() - startTime;

      const result: AudioAnalysisResult = {
        volume: volumeData.meanVolume,
        volumeVariance: volumeData.volumeVariance,
        speakingRate,
        pauseCount,
        pauseDuration,
        pauses,
        fillerWords,
        duration: audioInfo.duration,
        processingTimeMs: processingTime,
      };

      console.log('[AudioAnalyzer] Analysis complete', {
        duration: audioInfo.duration,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      console.error('[AudioAnalyzer] Analysis error:', error);
      throw new Error(
        `Failed to analyze audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get basic audio information using ffprobe
   */
  private async getAudioInfo(audioPath: string): Promise<{
    duration: number;
    format: string;
    sampleRate: number;
    channels: number;
  }> {
    try {
      const command = `${this.ffprobePath} -v error -show_entries format=duration,format_name -show_entries stream=sample_rate,channels -of json "${audioPath}"`;
      const { stdout } = await execAsync(command);
      const info = JSON.parse(stdout);

      const duration = parseFloat(info.format.duration);
      const format = info.format.format_name;
      const stream = info.streams?.[0] || {};
      const sampleRate = parseInt(stream.sample_rate || '0', 10);
      const channels = parseInt(stream.channels || '0', 10);

      if (isNaN(duration) || duration <= 0) {
        throw new Error('Invalid audio duration');
      }

      return {
        duration,
        format,
        sampleRate,
        channels,
      };
    } catch (error) {
      console.error('[AudioAnalyzer] Failed to get audio info:', error);
      throw new Error('Failed to get audio information');
    }
  }

  /**
   * Analyze volume using FFmpeg volumedetect filter
   */
  private async analyzeVolume(audioPath: string): Promise<{
    meanVolume: number;
    maxVolume: number;
    volumeVariance: number;
  }> {
    try {
      const command = `${this.ffmpegPath} -i "${audioPath}" -af "volumedetect" -f null /dev/null 2>&1`;
      const { stdout, stderr } = await execAsync(command);
      const output = stdout + stderr;

      // Parse volumedetect output
      // Example: [Parsed_volumedetect_0 @ 0x...] mean_volume: -20.5 dB
      // Example: [Parsed_volumedetect_0 @ 0x...] max_volume: -10.2 dB
      const meanMatch = output.match(/mean_volume:\s*([-\d.]+)\s*dB/);
      const maxMatch = output.match(/max_volume:\s*([-\d.]+)\s*dB/);

      const meanVolume = meanMatch ? parseFloat(meanMatch[1]) : -30;
      const maxVolume = maxMatch ? parseFloat(maxMatch[1]) : -10;

      // Estimate variance from mean and max
      // (simplified approach - proper variance would require frame-by-frame analysis)
      const volumeVariance = Math.pow((maxVolume - meanVolume) / 2, 2);

      return {
        meanVolume,
        maxVolume,
        volumeVariance,
      };
    } catch (error) {
      console.error('[AudioAnalyzer] Failed to analyze volume:', error);
      // Return default values on error
      return {
        meanVolume: -30,
        maxVolume: -10,
        volumeVariance: 25,
      };
    }
  }

  /**
   * Detect pauses (silence) using FFmpeg silencedetect filter
   */
  private async detectPauses(
    audioPath: string,
    minDuration: number,
    threshold: number
  ): Promise<PauseInfo[]> {
    try {
      const command = `${this.ffmpegPath} -i "${audioPath}" -af "silencedetect=noise=${threshold}dB:d=${minDuration}" -f null /dev/null 2>&1`;
      const { stdout, stderr } = await execAsync(command);
      const output = stdout + stderr;

      // Parse silencedetect output
      // Example: [silencedetect @ 0x...] silence_start: 5.2
      // Example: [silencedetect @ 0x...] silence_end: 6.1 | silence_duration: 0.9
      const pauses: PauseInfo[] = [];
      const lines = output.split('\n');

      let currentPause: Partial<PauseInfo> | null = null;

      for (const line of lines) {
        const startMatch = line.match(/silence_start:\s*([\d.]+)/);
        if (startMatch) {
          currentPause = {
            startTime: parseFloat(startMatch[1]),
          };
          continue;
        }

        const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
        if (endMatch && currentPause) {
          const endTime = parseFloat(endMatch[1]);
          const duration = parseFloat(endMatch[2]);

          pauses.push({
            startTime: currentPause.startTime!,
            endTime,
            duration,
          });

          currentPause = null;
        }
      }

      return pauses;
    } catch (error) {
      console.error('[AudioAnalyzer] Failed to detect pauses:', error);
      return [];
    }
  }

  /**
   * Calculate speaking rate (words per minute)
   */
  private calculateSpeakingRate(transcript: string, duration: number): number {
    const words = transcript.trim().split(/\s+/);
    const wordCount = words.length;
    const durationMinutes = duration / 60;

    if (durationMinutes === 0) {
      return 0;
    }

    return Math.round(wordCount / durationMinutes);
  }

  /**
   * Detect filler words in transcript
   */
  private detectFillerWords(transcript: string): FillerWordsInfo {
    // Common filler words in multiple languages
    const fillerWordPatterns = [
      // English
      /\b(um|uh|er|ah|like|you know|i mean|actually|basically|literally|sort of|kind of)\b/gi,
      // Japanese (Hiragana)
      /\b(ええと|えーと|あの|その|まあ|なんか|っていうか)\b/gi,
      // Japanese (Katakana - sometimes used)
      /\b(エート|アノ)\b/gi,
    ];

    const detectedWords: string[] = [];
    const frequency: { [word: string]: number } = {};

    for (const pattern of fillerWordPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        const word = match[0].toLowerCase();
        detectedWords.push(word);
        frequency[word] = (frequency[word] || 0) + 1;
      }
    }

    return {
      words: detectedWords,
      count: detectedWords.length,
      frequency,
    };
  }

  /**
   * Analyze audio from S3 (download, analyze, cleanup)
   */
  async analyzeAudioFromS3(
    s3Client: any,
    bucket: string,
    key: string,
    transcript?: string,
    options?: AudioAnalysisOptions
  ): Promise<AudioAnalysisResult> {
    const tmpDir = path.join('/tmp', `audio-analysis-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const audioPath = path.join(tmpDir, 'audio.webm');

    try {
      console.log('[AudioAnalyzer] Downloading audio from S3', { bucket, key });

      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        throw new Error('Failed to download audio from S3');
      }

      const audioBuffer = await response.Body.transformToByteArray();
      fs.writeFileSync(audioPath, Buffer.from(audioBuffer));

      console.log('[AudioAnalyzer] Audio downloaded', {
        size: audioBuffer.length,
        path: audioPath,
      });

      // Analyze the downloaded audio
      const result = await this.analyzeAudio(audioPath, transcript, options);

      return result;
    } finally {
      // Cleanup
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log('[AudioAnalyzer] Cleaned up tmp directory');
      } catch (cleanupError) {
        console.warn('[AudioAnalyzer] Failed to clean up tmp:', cleanupError);
      }
    }
  }
}
