'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getScenario, updateScenario } from '@/lib/api/scenarios';
import { locales, defaultLocale } from '@/lib/i18n/config';
import type { Visibility } from '@prance/shared';
import Link from 'next/link';
import { toast } from 'sonner';

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

  // Silence management fields
  const [initialGreeting, setInitialGreeting] = useState('');
  const [enableSilencePrompt, setEnableSilencePrompt] = useState(true);
  const [silenceTimeout, setSilenceTimeout] = useState(10);
  const [silenceTimeoutPreset, setSilenceTimeoutPreset] = useState<string>('10');
  const [silencePromptStyle, setSilencePromptStyle] = useState<'formal' | 'casual' | 'neutral'>('neutral');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showSilenceTimer, setShowSilenceTimer] = useState(false);
  const [silenceThreshold, setSilenceThreshold] = useState(0.05);
  const [minSilenceDuration, setMinSilenceDuration] = useState(500);

  // Load existing scenario data
  useEffect(() => {
    const loadScenario = async () => {
      try {
        const scenario = await getScenario(scenarioId);
        setTitle(scenario.title);
        setCategory(scenario.category);
        setLanguage(scenario.language);
        setVisibility(scenario.visibility);

        // Extract systemPrompt and silencePromptStyle from configJson
        const config = scenario.configJson as any;
        if (config.systemPrompt) {
          setSystemPrompt(config.systemPrompt);
        }
        if (config.silencePromptStyle) {
          setSilencePromptStyle(config.silencePromptStyle);
        }

        // Remove systemPrompt and silencePromptStyle from config display
        const { systemPrompt: _, silencePromptStyle: __, ...restConfig } = config;
        setConfigJson(JSON.stringify(restConfig, null, 2));

        // Load silence management fields
        setInitialGreeting(scenario.initialGreeting || '');
        setEnableSilencePrompt(scenario.enableSilencePrompt ?? true);
        setSilenceTimeout(scenario.silenceTimeout || 10);
        setShowSilenceTimer(scenario.showSilenceTimer || false);
        setSilenceThreshold(scenario.silenceThreshold || 0.05);
        setMinSilenceDuration(scenario.minSilenceDuration || 500);

        // Set preset based on timeout value
        if ([5, 10, 15, 30].includes(scenario.silenceTimeout || 10)) {
          setSilenceTimeoutPreset((scenario.silenceTimeout || 10).toString());
        } else {
          setSilenceTimeoutPreset('custom');
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scenario');
        setIsLoading(false);
      }
    };

    loadScenario();
  }, [scenarioId]);

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

    // Add silencePromptStyle to config
    if (enableSilencePrompt) {
      parsedConfig.silencePromptStyle = silencePromptStyle;
    }

    setIsSubmitting(true);

    try {
      await updateScenario(scenarioId, {
        title: title.trim(),
        category: category.trim(),
        language,
        visibility,
        configJson: parsedConfig,
        // Silence management fields
        initialGreeting: initialGreeting.trim() || undefined,
        silenceTimeout,
        enableSilencePrompt,
        showSilenceTimer,
        silenceThreshold,
        minSilenceDuration,
      });

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

        {/* Silence Management - Same as new page */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('scenarios.create.form.silenceManagement')}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {t('scenarios.create.form.silenceManagementDescription')}
          </p>

          {/* Initial Greeting */}
          <div className="mb-6">
            <label htmlFor="initialGreeting" className="block text-sm font-medium text-gray-700 mb-2">
              {t('scenarios.create.form.initialGreeting')}
            </label>
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

          {/* Enable Silence Prompt */}
          <div className="mb-6">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={enableSilencePrompt}
                onChange={e => setEnableSilencePrompt(e.target.checked)}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2">
                <span className="block text-sm font-medium text-gray-700">
                  {t('scenarios.create.form.enableSilencePrompt')}
                </span>
                <span className="block text-sm text-gray-500">
                  {t('scenarios.create.form.enableSilencePromptHelp')}
                </span>
              </span>
            </label>
          </div>

          {/* Silence Timeout - Show only if enabled */}
          {enableSilencePrompt && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('scenarios.create.form.silenceTimeout')}
                </label>
                <div className="space-y-3">
                  {/* Presets */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      {t('scenarios.create.form.silenceTimeoutPresets')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[5, 10, 15, 30].map(seconds => (
                        <button
                          key={seconds}
                          type="button"
                          onClick={() => {
                            setSilenceTimeoutPreset(seconds.toString());
                            setSilenceTimeout(seconds);
                          }}
                          className={`px-4 py-2 border rounded-md text-sm font-medium ${
                            silenceTimeoutPreset === seconds.toString()
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {seconds}{t('scenarios.create.form.silenceTimeoutSeconds')}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSilenceTimeoutPreset('custom')}
                        className={`px-4 py-2 border rounded-md text-sm font-medium ${
                          silenceTimeoutPreset === 'custom'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {t('scenarios.create.form.silenceTimeoutCustom')}
                      </button>
                    </div>
                  </div>

                  {/* Custom Input */}
                  {silenceTimeoutPreset === 'custom' && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={silenceTimeout}
                        onChange={e => setSilenceTimeout(parseInt(e.target.value) || 10)}
                        className="block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="text-sm text-gray-600">
                        {t('scenarios.create.form.silenceTimeoutSeconds')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Silence Prompt Style */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('scenarios.create.form.silencePromptStyle')}
                </label>
                <div className="flex space-x-4">
                  {(['formal', 'casual', 'neutral'] as const).map(style => (
                    <label key={style} className="flex items-center">
                      <input
                        type="radio"
                        name="silencePromptStyle"
                        value={style}
                        checked={silencePromptStyle === style}
                        onChange={e => setSilencePromptStyle(e.target.value as any)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {t(`scenarios.create.form.silencePromptStyle${style.charAt(0).toUpperCase() + style.slice(1)}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center"
                >
                  <svg
                    className={`w-4 h-4 mr-1 transition-transform ${showAdvancedSettings ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {t('scenarios.create.form.advancedSettings')}
                </button>
              </div>

              {/* Advanced Settings */}
              {showAdvancedSettings && (
                <div className="space-y-4 pl-6 border-l-2 border-gray-200">
                  {/* Show Silence Timer */}
                  <div>
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={showSilenceTimer}
                        onChange={e => setShowSilenceTimer(e.target.checked)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2">
                        <span className="block text-sm font-medium text-gray-700">
                          {t('scenarios.create.form.showSilenceTimer')}
                        </span>
                        <span className="block text-sm text-gray-500">
                          {t('scenarios.create.form.showSilenceTimerHelp')}
                        </span>
                      </span>
                    </label>
                  </div>

                  {/* Silence Threshold */}
                  <div>
                    <label htmlFor="silenceThreshold" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('scenarios.create.form.silenceThreshold')}
                    </label>
                    <input
                      type="number"
                      id="silenceThreshold"
                      min="0.01"
                      max="0.2"
                      step="0.01"
                      value={silenceThreshold}
                      onChange={e => setSilenceThreshold(parseFloat(e.target.value) || 0.05)}
                      className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {t('scenarios.create.form.silenceThresholdHelp')}
                    </p>
                  </div>

                  {/* Min Silence Duration */}
                  <div>
                    <label htmlFor="minSilenceDuration" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('scenarios.create.form.minSilenceDuration')}
                    </label>
                    <input
                      type="number"
                      id="minSilenceDuration"
                      min="100"
                      max="2000"
                      step="100"
                      value={minSilenceDuration}
                      onChange={e => setMinSilenceDuration(parseInt(e.target.value) || 500)}
                      className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {t('scenarios.create.form.minSilenceDurationHelp')}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Configuration JSON */}
        <div>
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
            disabled={isSubmitting}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('scenarios.edit.updating') : t('scenarios.edit.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
