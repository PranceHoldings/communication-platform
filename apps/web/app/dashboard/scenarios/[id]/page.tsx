'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getScenario, deleteScenario, type Scenario } from '@/lib/api/scenarios';
import { getOrganizationSettings } from '@/lib/api/settings';
import type { OrganizationSettings } from '@prance/shared';
import { authApi } from '@/lib/api/auth';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const scenarioId = params.id as string;
  const currentUser = authApi.getCurrentUser();
  const canDelete =
    currentUser &&
    scenario &&
    (scenario.orgId === currentUser.orgId || currentUser.role === 'SUPER_ADMIN');

  // シナリオ読み込み（scenarioId が変わったときのみ）
  useEffect(() => {
    loadScenario();
  }, [scenarioId]);

  // 組織設定読み込み（pathname が変わるたびに常に最新を取得）
  // 🔴 CRITICAL: 組織設定変更後にこのページに戻ったときに最新値を表示するため
  useEffect(() => {
    loadOrgSettings();
  }, [pathname]);

  const loadScenario = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getScenario(scenarioId);
      console.log('[ScenarioDetail] Loaded scenario data:', data);
      console.log(
        '[ScenarioDetail] showSilenceTimer:',
        data.showSilenceTimer,
        'type:',
        typeof data.showSilenceTimer
      );
      console.log(
        '[ScenarioDetail] enableSilencePrompt:',
        data.enableSilencePrompt,
        'type:',
        typeof data.enableSilencePrompt
      );
      console.log(
        '[ScenarioDetail] silenceTimeout:',
        data.silenceTimeout,
        'type:',
        typeof data.silenceTimeout
      );
      setScenario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scenarios.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadOrgSettings = async () => {
    try {
      console.log('[ScenarioDetail] Loading organization settings...', {
        timestamp: new Date().toISOString(),
        pathname,
      });
      const settings = await getOrganizationSettings();
      console.log('[ScenarioDetail] Organization settings loaded:', {
        showSilenceTimer: settings.showSilenceTimer,
        enableSilencePrompt: settings.enableSilencePrompt,
        silenceTimeout: settings.silenceTimeout,
        timestamp: new Date().toISOString(),
      });
      setOrgSettings(settings);
    } catch (error) {
      console.error('[ScenarioDetail] Failed to load organization settings:', error);
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t('scenarios.detail.backToList')}
          </Link>
          <h1 className="text-3xl font-bold">{scenario.title}</h1>
          <p className="text-gray-600 mt-2">
            {t('scenarios.detail.scenarioId')}: {scenario.id}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow p-6" data-testid="scenario-detail">
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

      {/* Initial Greeting */}
      {scenario.initialGreeting && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {t('scenarios.create.form.initialGreeting')}
          </h2>
          <div className="bg-gray-50 rounded p-4 text-sm whitespace-pre-wrap">
            {scenario.initialGreeting}
          </div>
        </div>
      )}

      {/* Silence Timer Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('scenarios.detail.silenceSettings')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-gray-600">{t('scenarios.create.form.showSilenceTimer')}:</span>
            <div className="font-medium mt-1">
              {scenario.showSilenceTimer === true ? (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                  {t('common.enabled')}
                </span>
              ) : scenario.showSilenceTimer === false ? (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                  {t('common.disabled')}
                </span>
              ) : (
                <div className="space-y-1">
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                    {t('common.useDefault')}
                  </span>
                  {orgSettings && (
                    <div className="text-xs text-gray-500">
                      ({t('scenarios.detail.orgDefault')}:{' '}
                      {
                        // 🔴 CRITICAL: Parent-child relationship
                        // If enableSilencePrompt is disabled, showSilenceTimer should be forced to disabled
                        orgSettings.enableSilencePrompt === false
                          ? t('common.disabled')
                          : orgSettings.showSilenceTimer
                            ? t('common.enabled')
                            : t('common.disabled')
                      }
                      )
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-600">{t('scenarios.detail.enableSilencePrompt')}:</span>
            <div className="font-medium mt-1">
              {scenario.enableSilencePrompt === true ? (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                  {t('common.enabled')}
                </span>
              ) : scenario.enableSilencePrompt === false ? (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                  {t('common.disabled')}
                </span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                  {t('common.useDefault')}
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-600">{t('scenarios.detail.silenceTimeout')}:</span>
            <div className="font-medium mt-1">
              {scenario.silenceTimeout !== null && scenario.silenceTimeout !== undefined ? (
                <span className="text-gray-900">{scenario.silenceTimeout}s</span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                  {t('common.useDefault')}
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-600">{t('scenarios.detail.silencePromptTimeout')}:</span>
            <div className="font-medium mt-1">
              {scenario.silencePromptTimeout !== null &&
              scenario.silencePromptTimeout !== undefined ? (
                <span className="text-gray-900">{scenario.silencePromptTimeout}s</span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                  {t('common.useDefault')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      {scenario.configJson && (scenario.configJson as any).systemPrompt && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{t('scenarios.create.form.systemPrompt')}</h2>
          <div className="bg-gray-50 rounded p-4 text-sm whitespace-pre-wrap">
            {(scenario.configJson as any).systemPrompt}
          </div>
        </div>
      )}

      {/* Questions */}
      {scenario.configJson &&
        Array.isArray((scenario.configJson as any).questions) &&
        (scenario.configJson as any).questions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{t('scenarios.detail.questions')}</h2>
            <div className="space-y-3">
              {((scenario.configJson as any).questions as any[]).map((question, index) => (
                <div
                  key={question.id || index}
                  className="border-l-4 border-indigo-500 pl-4 py-2 bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{question.text}</div>
                      {question.category && (
                        <div className="text-sm text-gray-500 mt-1">
                          {t('scenarios.detail.questionCategory')}: {question.category}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-400 ml-4">#{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Other Configuration (Raw JSON) */}
      {scenario.configJson &&
        Object.keys(scenario.configJson).some(
          key => key !== 'systemPrompt' && key !== 'questions'
        ) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{t('scenarios.detail.otherConfig')}</h2>
            <pre className="bg-gray-50 rounded p-4 text-sm overflow-auto font-mono">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(scenario.configJson).filter(
                    ([key]) => key !== 'systemPrompt' && key !== 'questions'
                  )
                ),
                null,
                2
              )}
            </pre>
          </div>
        )}

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
