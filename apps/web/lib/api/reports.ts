/**
 * Report Generation API Client
 */

import { getAuthToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface ReportResponse {
  success: boolean;
  report: {
    sessionId: string;
    pdfUrl: string;
    pdfKey: string;
    generatedAt: string;
  };
}

export interface ReportError {
  error: string;
  message?: string;
}

/**
 * Generate PDF report for a completed session
 */
export async function generateReport(sessionId: string): Promise<ReportResponse> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ReportError = await response.json();
    throw new Error(errorData.message || errorData.error || 'Failed to generate report');
  }

  return response.json();
}

/**
 * Download PDF report
 */
export function downloadReport(pdfUrl: string, sessionId: string) {
  const link = document.createElement('a');
  link.href = pdfUrl;
  link.download = `session-report-${sessionId.slice(0, 8)}.pdf`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
