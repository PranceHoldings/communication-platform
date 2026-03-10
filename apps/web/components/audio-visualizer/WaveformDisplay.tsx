/**
 * Waveform Display Component
 * Displays real-time audio waveform visualization
 */

'use client';

import { useEffect, useRef } from 'react';

interface WaveformDisplayProps {
  waveformData: number[]; // Array of normalized values (0-1)
  audioLevel: number; // Current audio level (0-1)
  isActive: boolean;
  height?: number;
  barWidth?: number;
  barGap?: number;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
}

export function WaveformDisplay({
  waveformData,
  audioLevel,
  isActive,
  height = 80,
  barWidth = 3,
  barGap = 2,
  activeColor = 'rgb(99, 102, 241)', // indigo-500
  inactiveColor = 'rgb(209, 213, 219)', // gray-300
  className = '',
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = canvas.width;
    const canvasHeight = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, canvasHeight);

    if (!isActive) {
      // Draw inactive state (flat line)
      ctx.fillStyle = inactiveColor;
      const centerY = canvasHeight / 2;
      ctx.fillRect(0, centerY - 1, width, 2);
      return;
    }

    // Calculate number of bars that fit
    const barTotalWidth = barWidth + barGap;
    const maxBars = Math.floor(width / barTotalWidth);

    // Resample waveform data to fit number of bars
    const resampledData = resampleData(waveformData, maxBars);

    // Draw bars
    resampledData.forEach((value, index) => {
      const x = index * barTotalWidth;
      const barHeight = Math.max(2, value * canvasHeight);
      const y = (canvasHeight - barHeight) / 2;

      // Color intensity based on audio level
      const intensity = Math.min(1, audioLevel * 2);
      ctx.fillStyle = isActive
        ? interpolateColor(inactiveColor, activeColor, intensity)
        : inactiveColor;

      ctx.fillRect(x, y, barWidth, barHeight);
    });
  }, [
    waveformData,
    audioLevel,
    isActive,
    barWidth,
    barGap,
    activeColor,
    inactiveColor,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={height}
      className={className}
      style={{ width: '100%', height: `${height}px` }}
    />
  );
}

/**
 * Resample data array to target length
 */
function resampleData(data: number[], targetLength: number): number[] {
  if (data.length === 0) return Array(targetLength).fill(0);
  if (data.length === targetLength) return data;

  const result: number[] = [];
  const step = data.length / targetLength;

  for (let i = 0; i < targetLength; i++) {
    const startIdx = Math.floor(i * step);
    const endIdx = Math.floor((i + 1) * step);

    // Average values in this range
    let sum = 0;
    let count = 0;
    for (let j = startIdx; j < endIdx && j < data.length; j++) {
      sum += data[j] || 0;
      count++;
    }

    result.push(count > 0 ? sum / count : 0);
  }

  return result;
}

/**
 * Interpolate between two RGB colors
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
  const rgb1 = parseRgb(color1);
  const rgb2 = parseRgb(color2);

  if (!rgb1 || !rgb2) return color1;

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Parse RGB color string
 */
function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return null;

  return {
    r: parseInt(match[1]!, 10),
    g: parseInt(match[2]!, 10),
    b: parseInt(match[3]!, 10),
  };
}
