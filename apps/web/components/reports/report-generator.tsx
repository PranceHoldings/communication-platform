/**
 * Report Generator Component
 *
 * PDF report generation button with loading states
 */

'use client';

import { useState } from 'react';
import { generateReport, downloadReport, type ReportResponse } from '@/lib/api/reports';
import { useI18n } from '@/lib/i18n/provider';

interface ReportGeneratorProps {
  sessionId: string;
  sessionStatus: string;
}

export function ReportGenerator({ sessionId, sessionStatus }: ReportGeneratorProps) {
  const { t } = useI18n();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<ReportResponse['report'] | null>(null);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await generateReport(sessionId);
      setLastReport(response.report);

      // Auto-download PDF
      downloadReport(response.report.pdfUrl, sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      console.error('Report generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAgain = () => {
    if (lastReport) {
      downloadReport(lastReport.pdfUrl, sessionId);
    }
  };

  // Only show for completed sessions
  if (sessionStatus !== 'COMPLETED') {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {t('reports.generator.title')}
          </h3>
          <p className="text-sm text-gray-600">{t('reports.generator.description')}</p>
        </div>
        <svg
          className="w-12 h-12 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {lastReport && !generating && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 mb-2">{t('reports.generator.success')}</p>
          <p className="text-xs text-gray-600">
            {t('reports.generator.generatedAt')}:{' '}
            {new Date(lastReport.generatedAt).toLocaleString()}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleGenerateReport}
          disabled={generating}
          className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t('reports.generator.generating')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {lastReport ? t('reports.generator.regenerate') : t('reports.generator.generate')}
            </>
          )}
        </button>

        {lastReport && !generating && (
          <button
            onClick={handleDownloadAgain}
            className="inline-flex items-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title={t('reports.generator.downloadAgain')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-blue-900 font-medium mb-1">
              {t('reports.generator.info.title')}
            </p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• {t('reports.generator.info.scores')}</li>
              <li>• {t('reports.generator.info.aiSuggestions')}</li>
              <li>• {t('reports.generator.info.charts')}</li>
              <li>• {t('reports.generator.info.transcript')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
