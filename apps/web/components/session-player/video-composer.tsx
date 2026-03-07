'use client';

import { useEffect, useRef, useCallback } from 'react';

export type CompositeLayout = 'side-by-side' | 'picture-in-picture';

interface VideoComposerProps {
  avatarCanvasRef: React.RefObject<HTMLCanvasElement>;
  userVideoRef: React.RefObject<HTMLVideoElement>;
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
    const avatarCanvas = avatarCanvasRef.current;
    const userVideo = userVideoRef.current;

    if (!canvas || !avatarCanvas || !userVideo) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Canvas クリア
    ctx.clearRect(0, 0, width, height);

    if (layout === 'side-by-side') {
      // 左右分割レイアウト
      const halfWidth = width / 2;

      // 左: アバター
      ctx.drawImage(avatarCanvas, 0, 0, halfWidth, height);

      // 右: ユーザーカメラ
      if (userVideo.readyState === userVideo.HAVE_ENOUGH_DATA) {
        ctx.drawImage(userVideo, halfWidth, 0, halfWidth, height);
      }
    } else {
      // Picture-in-Picture レイアウト
      // メイン: アバター（全画面）
      ctx.drawImage(avatarCanvas, 0, 0, width, height);

      // 子画面: ユーザーカメラ（右下）
      if (userVideo.readyState === userVideo.HAVE_ENOUGH_DATA) {
        const pipWidth = 320; // 子画面幅
        const pipHeight = 240; // 子画面高さ
        const margin = 20; // マージン

        // 黒い枠線を描画
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeRect(
          width - pipWidth - margin - 3,
          height - pipHeight - margin - 3,
          pipWidth + 6,
          pipHeight + 6
        );

        // ユーザーカメラを描画
        ctx.drawImage(
          userVideo,
          width - pipWidth - margin,
          height - pipHeight - margin,
          pipWidth,
          pipHeight
        );
      }
    }

    // 次のフレームをリクエスト
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
