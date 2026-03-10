/**
 * AWS Rekognition Analyzer
 * Provides facial emotion and expression analysis using AWS Rekognition
 */

import {
  RekognitionClient,
  DetectFacesCommand,
  DetectFacesCommandInput,
  DetectFacesCommandOutput,
  Emotion,
  FaceDetail,
} from '@aws-sdk/client-rekognition';
import { REKOGNITION_DEFAULTS } from '../config/defaults';

export interface EmotionScore {
  type: string; // 'HAPPY', 'SAD', 'ANGRY', 'CONFUSED', 'DISGUSTED', 'SURPRISED', 'CALM', 'FEAR'
  confidence: number; // 0-100
}

export interface FaceQuality {
  brightness: number;
  sharpness: number;
}

export interface Pose {
  pitch: number; // 上下の傾き (-90 to 90)
  roll: number; // 回転 (-180 to 180)
  yaw: number; // 左右の向き (-90 to 90)
}

export interface AgeRange {
  low: number;
  high: number;
}

export interface EmotionAnalysisResult {
  // Emotions
  emotions: EmotionScore[];
  dominantEmotion: string | null;

  // Demographics
  ageRange: AgeRange | null;
  gender: string | null; // 'Male' | 'Female'
  genderConfidence: number | null;

  // Face Quality
  eyesOpen: boolean | null;
  eyesOpenConfidence: number | null;
  mouthOpen: boolean | null;
  mouthOpenConfidence: number | null;

  // Pose
  pose: Pose | null;

  // Overall quality
  confidence: number;
  quality: FaceQuality | null;

  // Raw data (for debugging)
  raw?: FaceDetail;
}

export interface AnalyzeFrameOptions {
  attributes?: ('ALL' | 'DEFAULT')[];
  minConfidence?: number; // Minimum confidence threshold (default: 70)
}

export class RekognitionAnalyzer {
  private client: RekognitionClient;
  private region: string;

  constructor(config: { region?: string } = {}) {
    this.region = config.region || process.env.AWS_REGION || REKOGNITION_DEFAULTS.REGION;
    this.client = new RekognitionClient({ region: this.region });

    console.log('[RekognitionAnalyzer] Initialized', {
      region: this.region,
    });
  }

  /**
   * Analyze a frame (image buffer) for facial emotions and expressions
   */
  async analyzeFrame(
    imageBuffer: Buffer,
    options: AnalyzeFrameOptions = {}
  ): Promise<EmotionAnalysisResult> {
    const startTime = Date.now();

    try {
      const input: DetectFacesCommandInput = {
        Image: {
          Bytes: imageBuffer,
        },
        Attributes: options.attributes || ['ALL'],
      };

      console.log('[RekognitionAnalyzer] Calling DetectFaces API', {
        imageSize: imageBuffer.length,
        attributes: input.Attributes,
      });

      const command = new DetectFacesCommand(input);
      const response: DetectFacesCommandOutput = await this.client.send(command);

      const processingTime = Date.now() - startTime;

      console.log('[RekognitionAnalyzer] DetectFaces completed', {
        processingTimeMs: processingTime,
        facesDetected: response.FaceDetails?.length || 0,
      });

      // If no faces detected, return empty result
      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        console.warn('[RekognitionAnalyzer] No faces detected in frame');
        return this.createEmptyResult();
      }

      // Get the first face (assuming single person in frame)
      const face = response.FaceDetails[0];

      // Apply confidence threshold
      const minConfidence = options.minConfidence || 70;
      if ((face.Confidence || 0) < minConfidence) {
        console.warn('[RekognitionAnalyzer] Face confidence below threshold', {
          confidence: face.Confidence,
          threshold: minConfidence,
        });
        return this.createEmptyResult();
      }

      // Parse emotions
      const emotions: EmotionScore[] = (face.Emotions || []).map((emotion: Emotion) => ({
        type: emotion.Type || 'UNKNOWN',
        confidence: emotion.Confidence || 0,
      }));

      // Find dominant emotion (highest confidence)
      const dominantEmotion = emotions.reduce((prev, current) =>
        current.confidence > prev.confidence ? current : prev
      );

      // Parse age range
      const ageRange: AgeRange | null = face.AgeRange
        ? {
            low: face.AgeRange.Low || 0,
            high: face.AgeRange.High || 0,
          }
        : null;

      // Parse pose
      const pose: Pose | null = face.Pose
        ? {
            pitch: face.Pose.Pitch || 0,
            roll: face.Pose.Roll || 0,
            yaw: face.Pose.Yaw || 0,
          }
        : null;

      // Parse quality
      const quality: FaceQuality | null = face.Quality
        ? {
            brightness: face.Quality.Brightness || 0,
            sharpness: face.Quality.Sharpness || 0,
          }
        : null;

      const result: EmotionAnalysisResult = {
        emotions,
        dominantEmotion: dominantEmotion.type,

        ageRange,
        gender: face.Gender?.Value || null,
        genderConfidence: face.Gender?.Confidence || null,

        eyesOpen: face.EyesOpen?.Value || null,
        eyesOpenConfidence: face.EyesOpen?.Confidence || null,
        mouthOpen: face.MouthOpen?.Value || null,
        mouthOpenConfidence: face.MouthOpen?.Confidence || null,

        pose,

        confidence: face.Confidence || 0,
        quality,

        raw: face, // Keep raw data for debugging
      };

      console.log('[RekognitionAnalyzer] Analysis result', {
        dominantEmotion: result.dominantEmotion,
        confidence: result.confidence,
        emotionCount: result.emotions.length,
      });

      return result;
    } catch (error) {
      console.error('[RekognitionAnalyzer] Analysis error:', error);
      throw new Error(
        `Failed to analyze frame: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Analyze a frame from S3
   */
  async analyzeFrameFromS3(
    bucket: string,
    key: string,
    options: AnalyzeFrameOptions = {}
  ): Promise<EmotionAnalysisResult> {
    const startTime = Date.now();

    try {
      const input: DetectFacesCommandInput = {
        Image: {
          S3Object: {
            Bucket: bucket,
            Name: key,
          },
        },
        Attributes: options.attributes || ['ALL'],
      };

      console.log('[RekognitionAnalyzer] Calling DetectFaces API (S3)', {
        bucket,
        key,
        attributes: input.Attributes,
      });

      const command = new DetectFacesCommand(input);
      const response: DetectFacesCommandOutput = await this.client.send(command);

      const processingTime = Date.now() - startTime;

      console.log('[RekognitionAnalyzer] DetectFaces completed (S3)', {
        processingTimeMs: processingTime,
        facesDetected: response.FaceDetails?.length || 0,
      });

      // Same parsing logic as analyzeFrame
      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        console.warn('[RekognitionAnalyzer] No faces detected in S3 frame');
        return this.createEmptyResult();
      }

      const face = response.FaceDetails[0];
      const minConfidence = options.minConfidence || 70;

      if ((face.Confidence || 0) < minConfidence) {
        console.warn('[RekognitionAnalyzer] Face confidence below threshold (S3)', {
          confidence: face.Confidence,
          threshold: minConfidence,
        });
        return this.createEmptyResult();
      }

      const emotions: EmotionScore[] = (face.Emotions || []).map((emotion: Emotion) => ({
        type: emotion.Type || 'UNKNOWN',
        confidence: emotion.Confidence || 0,
      }));

      const dominantEmotion = emotions.reduce((prev, current) =>
        current.confidence > prev.confidence ? current : prev
      );

      const ageRange: AgeRange | null = face.AgeRange
        ? {
            low: face.AgeRange.Low || 0,
            high: face.AgeRange.High || 0,
          }
        : null;

      const pose: Pose | null = face.Pose
        ? {
            pitch: face.Pose.Pitch || 0,
            roll: face.Pose.Roll || 0,
            yaw: face.Pose.Yaw || 0,
          }
        : null;

      const quality: FaceQuality | null = face.Quality
        ? {
            brightness: face.Quality.Brightness || 0,
            sharpness: face.Quality.Sharpness || 0,
          }
        : null;

      const result: EmotionAnalysisResult = {
        emotions,
        dominantEmotion: dominantEmotion.type,

        ageRange,
        gender: face.Gender?.Value || null,
        genderConfidence: face.Gender?.Confidence || null,

        eyesOpen: face.EyesOpen?.Value || null,
        eyesOpenConfidence: face.EyesOpen?.Confidence || null,
        mouthOpen: face.MouthOpen?.Value || null,
        mouthOpenConfidence: face.MouthOpen?.Confidence || null,

        pose,

        confidence: face.Confidence || 0,
        quality,

        raw: face,
      };

      return result;
    } catch (error) {
      console.error('[RekognitionAnalyzer] Analysis error (S3):', error);
      throw new Error(
        `Failed to analyze frame from S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create an empty result (no face detected)
   */
  private createEmptyResult(): EmotionAnalysisResult {
    return {
      emotions: [],
      dominantEmotion: null,
      ageRange: null,
      gender: null,
      genderConfidence: null,
      eyesOpen: null,
      eyesOpenConfidence: null,
      mouthOpen: null,
      mouthOpenConfidence: null,
      pose: null,
      confidence: 0,
      quality: null,
    };
  }

  /**
   * Get emotion summary statistics
   */
  getEmotionSummary(analyses: EmotionAnalysisResult[]): {
    averageEmotions: { [emotion: string]: number };
    dominantEmotionFrequency: { [emotion: string]: number };
    totalFrames: number;
  } {
    if (analyses.length === 0) {
      return {
        averageEmotions: {},
        dominantEmotionFrequency: {},
        totalFrames: 0,
      };
    }

    // Calculate average emotion scores
    const emotionSums: { [emotion: string]: number } = {};
    const emotionCounts: { [emotion: string]: number } = {};

    analyses.forEach(analysis => {
      analysis.emotions.forEach(emotion => {
        if (!emotionSums[emotion.type]) {
          emotionSums[emotion.type] = 0;
          emotionCounts[emotion.type] = 0;
        }
        emotionSums[emotion.type] += emotion.confidence;
        emotionCounts[emotion.type]++;
      });
    });

    const averageEmotions: { [emotion: string]: number } = {};
    Object.keys(emotionSums).forEach(emotion => {
      averageEmotions[emotion] = emotionSums[emotion] / emotionCounts[emotion];
    });

    // Count dominant emotion frequency
    const dominantEmotionFrequency: { [emotion: string]: number } = {};
    analyses.forEach(analysis => {
      if (analysis.dominantEmotion) {
        dominantEmotionFrequency[analysis.dominantEmotion] =
          (dominantEmotionFrequency[analysis.dominantEmotion] || 0) + 1;
      }
    });

    return {
      averageEmotions,
      dominantEmotionFrequency,
      totalFrames: analyses.length,
    };
  }
}
