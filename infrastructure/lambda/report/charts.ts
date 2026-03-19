/**
 * Chart Generation Utilities
 *
 * Generate charts as PNG images using Chart.js and Canvas
 */

import { createCanvas } from 'canvas';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { RadarChartData, TimelineChartData, ChartGenerationOptions } from './types';

// Register Chart.js components
Chart.register(...registerables);

/**
 * Generate a radar chart showing category scores
 */
export async function generateRadarChart(
  data: RadarChartData,
  options: Partial<ChartGenerationOptions> = {}
): Promise<Buffer> {
  const { width = 600, height = 600, backgroundColor = '#ffffff', fontColor = '#374151' } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Set background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const config: ChartConfiguration = {
    type: 'radar',
    data: {
      labels: ['感情', '音声', '内容', '表現'],
      datasets: [
        {
          label: 'スコア',
          data: [data.emotion, data.audio, data.content, data.delivery],
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 2,
          pointBackgroundColor: 'rgb(99, 102, 241)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(99, 102, 241)',
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: 'カテゴリ別スコア',
          font: {
            size: 20,
            weight: 'bold',
          },
          color: fontColor,
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            font: {
              size: 12,
            },
            color: fontColor,
          },
          pointLabels: {
            font: {
              size: 14,
              weight: 'bold',
            },
            color: fontColor,
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
          angleLines: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
  };

  new Chart(ctx, config);

  return canvas.toBuffer('image/png');
}

/**
 * Generate a timeline chart showing emotion/audio scores over time
 */
export async function generateTimelineChart(
  data: TimelineChartData,
  options: Partial<ChartGenerationOptions> = {}
): Promise<Buffer> {
  const { width = 800, height = 400, backgroundColor = '#ffffff', fontColor = '#374151' } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Set background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const config: ChartConfiguration = {
    type: 'line',
    data: {
      labels: data.timestamps.map(
        t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
      ),
      datasets: [
        {
          label: '感情スコア',
          data: data.emotionScores,
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.3,
        },
        {
          label: '音声スコア',
          data: data.audioScores,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              size: 12,
            },
            color: fontColor,
          },
        },
        title: {
          display: true,
          text: 'スコア推移',
          font: {
            size: 18,
            weight: 'bold',
          },
          color: fontColor,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '時間',
            font: {
              size: 14,
            },
            color: fontColor,
          },
          ticks: {
            font: {
              size: 11,
            },
            color: fontColor,
            maxRotation: 45,
            minRotation: 45,
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
        },
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'スコア',
            font: {
              size: 14,
            },
            color: fontColor,
          },
          ticks: {
            font: {
              size: 11,
            },
            color: fontColor,
            stepSize: 20,
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
  };

  new Chart(ctx, config);

  return canvas.toBuffer('image/png');
}

/**
 * Generate a bar chart for detailed scores
 */
export async function generateDetailedScoreChart(
  scores: { label: string; value: number }[],
  options: Partial<ChartGenerationOptions> = {}
): Promise<Buffer> {
  const { width = 600, height = 400, backgroundColor = '#ffffff', fontColor = '#374151' } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Set background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: scores.map(s => s.label),
      datasets: [
        {
          label: 'スコア',
          data: scores.map(s => s.value),
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: '詳細スコア',
          font: {
            size: 18,
            weight: 'bold',
          },
          color: fontColor,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            font: {
              size: 11,
            },
            color: fontColor,
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
        y: {
          ticks: {
            font: {
              size: 12,
            },
            color: fontColor,
          },
          grid: {
            display: false,
          },
        },
      },
    },
  };

  new Chart(ctx, config);

  return canvas.toBuffer('image/png');
}
