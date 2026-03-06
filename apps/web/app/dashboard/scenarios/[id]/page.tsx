'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getScenario, deleteScenario, type Scenario } from '@/lib/api/scenarios';
import { authApi } from '@/lib/api/auth';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const scenarioId = params.id as string;
  const currentUser = authApi.getCurrentUser();
  const canDelete = currentUser && scenario && (
    scenario.orgId === currentUser.orgId ||
    currentUser.role === 'SUPER_ADMIN'
  );

  useEffect(() => {
    loadScenario();
  }, [scenarioId]);

  const loadScenario = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getScenario(scenarioId);
      setScenario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scenarios.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getVisibilityBadgeColor = (visibility: Scenario['visibility']) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'bg-green-100 text-green-800';
      case 'ORGANIZATION':
        return 'bg-blue-100 text-blue-800';
      case 'PRIVATE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);

    try {
      await deleteScenario(scenarioId);
      toast.success(t('scenarios.delete.success'));
      // Success - redirect to scenarios list
      router.push('/dashboard/scenarios');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('scenarios.delete.error');
      toast.error(errorMessage);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || t('scenarios.detail.notFound')}
        </div>
        <button
          onClick={() => router.push('/dashboard/scenarios')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          {t('scenarios.detail.backToList')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/scenarios"
            className="text-sm text-indigo-600 hover:text-indigo-900 mb-2 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('scenarios.detail.backToList')}
          </Link>
          <h1 className="text-3xl font-bold">{scenario.title}</h1>
          <p className="text-gray-600 mt-2">{t('scenarios.detail.scenarioId')}: {scenario.id}</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('scenarios.detail.basicInfo')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-600">{t('scenarios.detail.category')}:</span>
            <div className="font-medium">{scenario.category}</div>
          </div>
          <div>
            <span className="text-gray-600">{t('scenarios.detail.language')}:</span>
            <div className="font-medium">{scenario.language}</div>
          </div>
          <div>
            <span className="text-gray-600">{t('scenarios.detail.visibility')}:</span>
            <div>
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getVisibilityBadgeColor(
                  scenario.visibility
                )}`}
              >
                {t(`scenarios.visibility.${scenario.visibility}`)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-600">{t('scenarios.detail.created')}:</span>
            <div className="font-medium">{formatDate(scenario.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('scenarios.detail.config')}</h2>
        <pre className="bg-gray-50 rounded p-4 text-sm overflow-auto font-mono">
          {JSON.stringify(scenario.configJson, null, 2)}
        </pre>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('scenarios.detail.actions')}</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <Link
              href={`/dashboard/scenarios/${scenarioId}/edit`}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 inline-block"
            >
              {t('scenarios.detail.edit')}
            </Link>
            {canDelete && (
              <button
                className="px-6 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDeleteClick}
                disabled={isDeleting}
              >
                {isDeleting ? t('scenarios.delete.deleting') : t('scenarios.detail.delete')}
              </button>
            )}
          </div>
          {!canDelete && scenario.orgId !== currentUser?.orgId && (
            <p className="text-sm text-gray-500">
              Note: You can only delete scenarios from your organization
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t('scenarios.delete.confirm')}
        description={t('scenarios.delete.confirmMessage')}
        confirmText={t('scenarios.detail.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
