import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseVideoRecorderOptions {
  /**
   * 録画するCanvasの参照
   */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;

  /**
   * 動画チャンクのコールバック（WebSocket送信用）
   * @param chunk - 動画データのBlob
   * @param timestamp - タイムスタンプ（ミリ秒）
   */
  onChunk?: (chunk: Blob, timestamp: number) => void;

  /**
   * 録画完了時のコールバック
   * @param blob - 完全な動画データ
   */
  onComplete?: (blob: Blob) => void;

  /**
   * エラー時のコールバック
   */
  onError?: (error: Error) => void;

  /**
   * チャンク送信間隔（ミリ秒）
   * @default 1000 (1秒)
   */
  chunkInterval?: number;

  /**
   * MediaRecorder のmimeType
   * @default 'video/webm;codecs=vp8,opus'
   */
  mimeType?: string;

  /**
   * ビットレート（bps）
   * @default 2500000 (2.5Mbps)
   */
  videoBitsPerSecond?: number;
}

interface UseVideoRecorderReturn {
  status: RecordingStatus;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  recordedChunks: Blob[];
  duration: number; // 録画時間（秒）
  error: Error | null;
}

/**
 * useVideoRecorder - Canvas録画フック
 *
 * MediaRecorder APIを使用してCanvasを録画し、
 * リアルタイムでチャンクをWebSocketに送信します。
 *
 * @example
 * ```tsx
 * const { startRecording, stopRecording, status } = useVideoRecorder({
 *   canvasRef: compositeCanvasRef,
 *   onChunk: (chunk, timestamp) => {
 *     websocket.send(chunk);
 *   },
 * });
 * ```
 */
export function useVideoRecorder({
  canvasRef,
  onChunk,
  onComplete,
  onError,
  chunkInterval = 1000,
  mimeType = 'video/webm;codecs=vp8,opus',
  videoBitsPerSecond = 2500000,
}: UseVideoRecorderOptions): UseVideoRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 録画開始
   */
  const startRecording = useCallback(async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas not found');
      }

      // MediaRecorder対応確認
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`MimeType ${mimeType} is not supported`);
      }

      // CanvasからMediaStreamを取得
      const stream = canvas.captureStream(30); // 30 FPS

      // MediaRecorder作成
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond,
      });

      // チャンクデータ受信
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          setRecordedChunks((prev) => [...prev, event.data]);

          // チャンクコールバック
          if (onChunk) {
            const timestamp = Date.now() - startTimeRef.current;
            onChunk(event.data, timestamp);
          }
        }
      };

      // 録画停止
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        if (onComplete) {
          onComplete(blob);
        }
        setStatus('stopped');

        // タイマーをクリア
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      // エラーハンドリング
      mediaRecorder.onerror = (event: Event) => {
        const err = new Error(`MediaRecorder error: ${event.type}`);
        setError(err);
        if (onError) {
          onError(err);
        }
        setStatus('stopped');
      };

      // 録画開始
      mediaRecorder.start(chunkInterval);
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();
      setStatus('recording');
      setError(null);
      setRecordedChunks([]);
      setDuration(0);

      // 録画時間カウンター
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      console.log('[useVideoRecorder] Recording started');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      if (onError) {
        onError(error);
      }
      setStatus('stopped');
    }
  }, [canvasRef, mimeType, videoBitsPerSecond, chunkInterval, onChunk, onComplete, onError]);

  /**
   * 録画停止
   */
  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return;
    }

    mediaRecorder.stop();
    mediaRecorderRef.current = null;

    console.log('[useVideoRecorder] Recording stopped');
  }, []);

  /**
   * 録画一時停止
   */
  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
      return;
    }

    mediaRecorder.pause();
    setStatus('paused');

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    console.log('[useVideoRecorder] Recording paused');
  }, []);

  /**
   * 録画再開
   */
  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state !== 'paused') {
      return;
    }

    mediaRecorder.resume();
    setStatus('recording');

    // タイマー再開
    durationIntervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    console.log('[useVideoRecorder] Recording resumed');
  }, []);

  /**
   * クリーンアップ
   */
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return {
    status,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordedChunks,
    duration,
    error,
  };
}
