'use client';

import { useEffect, useRef, useCallback } from 'react';

export type CompositeLayout = 'side-by-side' | 'picture-in-picture';

interface VideoComposerProps {
  avatarCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  userVideoRef: React.RefObject<HTMLVideoElement | null>;
  layout?: CompositeLayout;
  width?: number;
  height?: number;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

/**
 * VideoComposer - アバター映像とユーザーカメラを合成
 *
 * Canvas APIを使用してリアルタイムで2つの映像を合成します。
 * - side-by-side: 左右に並べて表示
 * - picture-in-picture: アバターをメイン、ユーザーカメラを右下に小さく表示
 */
export function VideoComposer({
  avatarCanvasRef,
  userVideoRef,
  layout = 'picture-in-picture',
  width = 1280,
  height = 720,
  onCanvasReady,
}: VideoComposerProps) {
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Canvas合成処理
   */
  const drawComposite = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) {
      // Canvas not mounted yet — retry on next frame
      animationFrameRef.current = requestAnimationFrame(drawComposite);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(drawComposite);
      return;
    }

    const avatarCanvas = avatarCanvasRef.current;
    const userVideo = userVideoRef.current;

    // Canvas クリア
    ctx.clearRect(0, 0, width, height);

    // アバターまたはカメラが未準備の場合でもループを継続（黒フレームを生成してcaptureStreamを維持）
    if (avatarCanvas) {
      if (layout === 'side-by-side') {
        const halfWidth = width / 2;
        ctx.drawImage(avatarCanvas, 0, 0, halfWidth, height);
        if (userVideo && userVideo.readyState === userVideo.HAVE_ENOUGH_DATA) {
          ctx.drawImage(userVideo, halfWidth, 0, halfWidth, height);
        }
      } else {
        // Picture-in-Picture レイアウト
        ctx.drawImage(avatarCanvas, 0, 0, width, height);
        if (userVideo && userVideo.readyState === userVideo.HAVE_ENOUGH_DATA) {
          const pipWidth = 320;
          const pipHeight = 240;
          const margin = 20;
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.strokeRect(
            width - pipWidth - margin - 3,
            height - pipHeight - margin - 3,
            pipWidth + 6,
            pipHeight + 6
          );
          ctx.drawImage(
            userVideo,
            width - pipWidth - margin,
            height - pipHeight - margin,
            pipWidth,
            pipHeight
          );
        }
      }
    }

    // 常に次のフレームをリクエスト（アバター/カメラ未準備でもループを維持）
    animationFrameRef.current = requestAnimationFrame(drawComposite);
  }, [avatarCanvasRef, userVideoRef, layout, width, height]);

  /**
   * 合成開始
   */
  useEffect(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) {
      return;
    }

    // Canvas サイズ設定
    canvas.width = width;
    canvas.height = height;

    // 合成ループ開始
    drawComposite();

    // Canvas準備完了通知
    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    // クリーンアップ
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [drawComposite, width, height, onCanvasReady]);

  return (
    <canvas
      ref={compositeCanvasRef}
      className="hidden" // 実際の表示はSessionPlayerで制御
      width={width}
      height={height}
    />
  );
}
