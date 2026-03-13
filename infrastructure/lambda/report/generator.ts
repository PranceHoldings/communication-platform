/**
 * PDF Report Generator
 *
 * Generate PDF reports from session data using React-PDF
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { DefaultReportTemplate } from './templates/default-template';
import { ReportData, ReportGenerationOptions } from './types';
import { generateRadarChart, generateTimelineChart } from './charts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'prance-storage-dev';

/**
 * Generate charts and prepare report data
 */
async function prepareReportData(data: ReportData): Promise<ReportData> {
  console.log('[ReportGenerator] Preparing report data with charts...');

  try {
    // Generate radar chart
    const radarChartBuffer = await generateRadarChart({
      emotion: data.score.emotion,
      audio: data.score.audio,
      content: data.score.content,
      delivery: data.score.delivery,
    });

    // Upload radar chart to S3
    const radarChartKey = `reports/charts/${data.session.id}/radar-${Date.now()}.png`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: radarChartKey,
        Body: radarChartBuffer,
        ContentType: 'image/png',
      })
    );
    const radarChartUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${radarChartKey}`;
    console.log('[ReportGenerator] Radar chart uploaded:', radarChartUrl);

    // Generate timeline chart if data is available
    let timelineChartUrl = '';
    if (data.emotionAnalysis.length > 0 && data.audioAnalysis.length > 0) {
      const timelineChartBuffer = await generateTimelineChart({
        timestamps: data.emotionAnalysis.map(e => e.timestamp),
        emotionScores: data.emotionAnalysis.map(e => e.confidence * 100),
        audioScores: data.audioAnalysis.map(a => (a.clarity || 0) * 100),
      });

      const timelineChartKey = `reports/charts/${data.session.id}/timeline-${Date.now()}.png`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: timelineChartKey,
          Body: timelineChartBuffer,
          ContentType: 'image/png',
        })
      );
      timelineChartUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${timelineChartKey}`;
      console.log('[ReportGenerator] Timeline chart uploaded:', timelineChartUrl);
    }

    return {
      ...data,
      chartUrls: {
        radarChart: radarChartUrl,
        timelineChart: timelineChartUrl,
      },
    };
  } catch (error) {
    console.error('[ReportGenerator] Failed to prepare charts:', error);
    // Return data without charts if chart generation fails
    return data;
  }
}

/**
 * Generate PDF report from session data
 */
export async function generateReport(
  data: ReportData,
  options: ReportGenerationOptions = {}
): Promise<Buffer> {
  console.log('[ReportGenerator] Starting PDF generation for session:', data.session.id);

  try {
    // Prepare data with charts
    const preparedData = await prepareReportData(data);

    // Generate PDF using React-PDF
    const template = <DefaultReportTemplate data={preparedData} />;
    const pdfBuffer = await renderToBuffer(template);

    console.log('[ReportGenerator] PDF generated successfully:', {
      size: pdfBuffer.length,
      sessionId: data.session.id,
    });

    return pdfBuffer;
  } catch (error) {
    console.error('[ReportGenerator] PDF generation failed:', error);
    throw new Error(`Failed to generate PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate and upload PDF report to S3
 */
export async function generateAndUploadReport(
  data: ReportData,
  options: ReportGenerationOptions = {}
): Promise<{ pdfUrl: string; pdfKey: string }> {
  console.log('[ReportGenerator] Generating and uploading report to S3...');

  // Generate PDF
  const pdfBuffer = await generateReport(data, options);

  // Upload to S3
  const pdfKey = `reports/sessions/${data.session.id}/report-${Date.now()}.pdf`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        sessionId: data.session.id,
        generatedAt: new Date().toISOString(),
        userId: data.session.user.email,
      },
    })
  );

  const pdfUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${pdfKey}`;
  console.log('[ReportGenerator] PDF uploaded to S3:', pdfUrl);

  return {
    pdfUrl,
    pdfKey,
  };
}

/**
 * Get signed URL for PDF download (valid for 1 hour)
 */
export async function getSignedDownloadUrl(pdfKey: string): Promise<string> {
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: pdfKey,
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return signedUrl;
}
