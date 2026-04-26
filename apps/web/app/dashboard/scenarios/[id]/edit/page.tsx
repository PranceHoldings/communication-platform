'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getScenario, updateScenario } from '@/lib/api/scenarios';
import { getOrganizationSettings } from '@/lib/api/settings';
import type { OrganizationSettings } from '@prance/shared';
import { locales, defaultLocale } from '@/lib/i18n/config';
import type { Visibility } from '@prance/shared';
import Link from 'next/link';
import { toast } from 'sonner';
import { QuestionEditor, type Question } from '@/components/scenario-editor/QuestionEditor';
import { authApi } from '@/lib/api/auth';

export default function EditScenarioPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const scenarioId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState<string>(defaultLocale);
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [configJson, setConfigJson] = useState('');

  // Initial greeting field
  const [initialGreeting, setInitialGreeting] = useState('');

  // Silence timer display setting
  const [showSilenceTimer, setShowSilenceTimer] = useState<boolean | undefined>(undefined);

  // Questions list
  const [questions, setQuestions] = useState<Question[]>([]);

  // Prevent accidental form submission right after drag-and-drop
  const [recentQuestionChange, setRecentQuestionChange] = useState(false);

  // Organization settings for showing defaults
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);

  // Load existing scenario data
  useEffect(() => {
    const loadScenario = async () => {
      try {
        const scenario = await getScenario(scenarioId);

        // Access control: only the owner org (or SUPER_ADMIN) can edit
        const currentUser = authApi.getCurrentUser();
        if (currentUser && scenario.orgId !== currentUser.orgId && currentUser.role !== 'SUPER_ADMIN') {
          toast.error(t('scenarios.detail.readOnly'));
          router.push(`/dashboard/scenarios/${scenarioId}`);
          return;
        }

        setTitle(scenario.title);
        setCategory(scenario.category);
        setLanguage(scenario.language);
        setVisibility(scenario.visibility);

        // Extract systemPrompt and questions from configJson
        const config = scenario.configJson as any;
        if (config.systemPrompt) {
          setSystemPrompt(config.systemPrompt);
        }

        // Load questions from config with unique ID validation
        if (config.questions && Array.isArray(config.questions)) {
          // Ensure all questions have unique IDs
          const questionsWithIds = config.questions.map((q: any, index: number) => ({
            ...q,
            id:
              q.id || `question-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            order: q.order ?? index,
          }));

          // Check for duplicate IDs and regenerate if necessary
          const ids = new Set<string>();
          const uniqueQuestions = questionsWithIds.map((q: any, index: number) => {
            if (ids.has(q.id)) {
              console.warn(`[ScenarioEdit] Duplicate question ID detected: ${q.id}, regenerating`);
              return {
                ...q,
                id: `question-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
              };
            }
            ids.add(q.id);
            return q;
          });

          setQuestions(uniqueQuestions);
        }

        // Remove systemPrompt and questions from config display
        const { systemPrompt: _, questions: __, ...restConfig } = config;
        setConfigJson(JSON.stringify(restConfig, null, 2));

        // Load initial greeting
        setInitialGreeting(scenario.initialGreeting || '');

        // Load silence timer display setting
        // Note: null from DB means "use default", convert to undefined for UI
        console.log('[ScenarioEdit] Loaded scenario from DB:', {
          showSilenceTimer: scenario.showSilenceTimer,
          enableSilencePrompt: scenario.enableSilencePrompt,
          silenceTimeout: scenario.silenceTimeout,
        });
        setShowSilenceTimer(
          scenario.showSilenceTimer === null ? undefined : scenario.showSilenceTimer
        );

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scenario');
        setIsLoading(false);
      }
    };

    loadScenario();
  }, [scenarioId]);

  // Load organization settings for showing defaults
  useEffect(() => {
    const loadOrgSettings = async () => {
      try {
        const settings = await getOrganizationSettings();
        console.log('[ScenarioEdit] Organization settings loaded:', {
          showSilenceTimer: settings.showSilenceTimer,
          enableSilencePrompt: settings.enableSilencePrompt,
          silenceTimeout: settings.silenceTimeout,
        });
        setOrgSettings(settings);
      } catch (error) {
        console.error('Failed to load organization settings:', error);
      }
    };
    loadOrgSettings();
  }, []);

  // Prevent accidental form submission right after questions are reordered
  useEffect(() => {
    if (questions.length > 0) {
      setRecentQuestionChange(true);
      const timer = setTimeout(() => setRecentQuestionChange(false), 500);
      return () => clearTimeout(timer);
    }
  }, [questions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) {
      setError(t('scenarios.create.validation.titleRequired'));
      return;
    }

    if (!category.trim()) {
      setError(t('scenarios.create.validation.categoryRequired'));
      return;
    }

    // Validate JSON
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configJson);
    } catch (err) {
      setError(t('scenarios.create.validation.invalidJson'));
      return;
    }

    // Add systemPrompt to config
    if (systemPrompt.trim()) {
      parsedConfig.systemPrompt = systemPrompt.trim();
    }

    // Add questions to config
    if (questions.length > 0) {
      parsedConfig.questions = questions;
    }

    setIsSubmitting(true);

    // Debug: Log the data being sent
    const updateData = {
      title: title.trim(),
      category: category.trim(),
      language,
      visibility,
      configJson: parsedConfig,
      // Initial greeting
      initialGreeting: initialGreeting.trim() || undefined,
      // Silence timer display
      // undefined → null (use organization default)
      // true/false → explicit setting
      // Note: undefined is dropped by JSON.stringify, so we use null instead
      showSilenceTimer: showSilenceTimer === undefined ? null : showSilenceTimer,
    };
    console.log('[ScenarioEdit] Updating scenario with data:', updateData);
    console.log(
      '[ScenarioEdit] showSilenceTimer value:',
      showSilenceTimer,
      'type:',
      typeof showSilenceTimer
    );

    try {
      await updateScenario(scenarioId, updateData);

      toast.success(t('scenarios.edit.success'));
      router.push(`/dashboard/scenarios/${scenarioId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scenarios.edit.error'));
      toast.error(t('scenarios.edit.error'));
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-500">{t('scenarios.edit.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/scenarios/${scenarioId}`}
          className="text-sm text-indigo-600 hover:text-indigo-900 mb-4 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t('scenarios.edit.backToScenario')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{t('scenarios.edit.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('scenarios.edit.description')}</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg border border-gray-200 p-6 space-y-6"
      >
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            {t('scenarios.create.form.title')} *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('scenarios.create.form.titlePlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            {t('scenarios.create.form.category')} *
          </label>
          <input
            type="text"
            id="category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder={t('scenarios.create.form.categoryPlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        {/* Language and Visibility */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
              {t('scenarios.create.form.language')}
            </label>
            <select
              id="language"
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              {locales.map(locale => (
                <option key={locale} value={locale}>
                  {t(`languages.${locale}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility */}
          <div>
            <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-2">
              {t('scenarios.create.form.visibility')}
            </label>
            <select
              id="visibility"
              value={visibility}
              onChange={e => setVisibility(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="PRIVATE">{t('scenarios.visibility.PRIVATE')}</option>
              <option value="ORGANIZATION">{t('scenarios.visibility.ORGANIZATION')}</option>
              <option value="PUBLIC">{t('scenarios.visibility.PUBLIC')}</option>
            </select>
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-2">
            {t('scenarios.create.form.systemPrompt')}
          </label>
          <textarea
            id="systemPrompt"
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder={t('scenarios.create.form.systemPromptPlaceholder')}
            rows={6}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-2 text-sm text-gray-500">
            {t('scenarios.create.form.systemPromptHelp')}
          </p>
        </div>

        {/* Initial Greeting */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('scenarios.create.form.initialGreeting')}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {t('scenarios.create.form.initialGreetingDescription')}
          </p>
          <div>
            <textarea
              id="initialGreeting"
              value={initialGreeting}
              onChange={e => setInitialGreeting(e.target.value)}
              placeholder={t('scenarios.create.form.initialGreetingPlaceholder')}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-2 text-sm text-gray-500">
              {t('scenarios.create.form.initialGreetingHelp')}
            </p>
          </div>
        </div>

        {/* Silence Timer Display */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                {t('scenarios.create.form.showSilenceTimer')}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('scenarios.create.form.showSilenceTimerDescription')}
              </p>
            </div>
            <div className="ml-4 flex flex-col items-end space-y-2">
              <button
                type="button"
                onClick={() => {
                  // 3-state cycle: undefined → true → false → undefined
                  if (showSilenceTimer === undefined) {
                    setShowSilenceTimer(true);
                  } else if (showSilenceTimer === true) {
                    setShowSilenceTimer(false);
                  } else {
                    setShowSilenceTimer(undefined);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showSilenceTimer === true
                    ? 'bg-indigo-600'
                    : showSilenceTimer === false
                      ? 'bg-red-400'
                      : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={showSilenceTimer === true}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showSilenceTimer === true
                      ? 'translate-x-6'
                      : showSilenceTimer === false
                        ? 'translate-x-1'
                        : 'translate-x-3'
                  }`}
                />
              </button>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">
                  {showSilenceTimer === true
                    ? t('common.enabled')
                    : showSilenceTimer === false
                      ? t('common.disabled')
                      : t('common.useDefault')}
                </div>
                {showSilenceTimer === undefined && orgSettings && (
                  <div className="text-xs text-gray-500">
                    ({orgSettings.showSilenceTimer ? t('common.enabled') : t('common.disabled')})
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Questions Editor */}
        <div className="border-t pt-6">
          <QuestionEditor questions={questions} onChange={setQuestions} disabled={isSubmitting} />
        </div>

        {/* Configuration JSON */}
        <div className="border-t pt-6">
          <label htmlFor="configJson" className="block text-sm font-medium text-gray-700 mb-2">
            {t('scenarios.create.form.config')}
          </label>
          <textarea
            id="configJson"
            value={configJson}
            onChange={e => setConfigJson(e.target.value)}
            placeholder={t('scenarios.create.form.configPlaceholder')}
            rows={6}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-2 text-sm text-gray-500">{t('scenarios.edit.configHelp')}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <Link
            href={`/dashboard/scenarios/${scenarioId}`}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {t('scenarios.create.form.cancel')}
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || recentQuestionChange}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              recentQuestionChange
                ? t('scenarios.edit.waitingForQuestionChange')
                : isSubmitting
                  ? t('scenarios.edit.updating')
                  : undefined
            }
          >
            {isSubmitting ? t('scenarios.edit.updating') : t('scenarios.edit.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
