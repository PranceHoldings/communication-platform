/**
 * PDF Report Generator
 *
 * Generate PDF reports from session data using React-PDF
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { DefaultReportTemplate } from './templates/default-template';
import { ReportData, ReportGenerationOptions } from './types';
// import { generateRadarChart, generateTimelineChart } from './charts'; // Disabled: canvas dependency
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'prance-storage-dev';

/**
 * Generate charts and prepare report data
 */
async function prepareReportData(data: ReportData): Promise<ReportData> {
  console.log('[ReportGenerator] Preparing report data (charts disabled temporarily)...');

  // TODO: Re-enable chart generation with Lambda Layer for canvas
  // For now, return data without charts
  console.log('[ReportGenerator] Chart generation temporarily disabled');
  return {
    ...data,
    chartUrls: {
      radarChart: '',
      timelineChart: '',
    },
  };
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

    // Generate PDF using React-PDF (avoiding JSX syntax for esbuild compatibility)
    const template = createElement(DefaultReportTemplate, { data: preparedData });
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
