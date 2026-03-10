'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { createScenario } from '@/lib/api/scenarios';
import { locales, defaultLocale } from '@/lib/i18n/config';
import type { Visibility } from '@prance/shared';
import Link from 'next/link';

export default function NewScenarioPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState<string>(defaultLocale);
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
  const [configJson, setConfigJson] = useState(
    '{\n  "duration": 30,\n  "difficulty": "beginner"\n}'
  );

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

    setIsSubmitting(true);

    try {
      const scenario = await createScenario({
        title: title.trim(),
        category: category.trim(),
        language,
        visibility,
        configJson: parsedConfig,
      });

      // Success - redirect to scenario detail page
      router.push(`/dashboard/scenarios/${scenario.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scenarios.create.error'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/scenarios"
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
          Back to Scenarios
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{t('scenarios.create.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('scenarios.create.description')}</p>
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

        {/* Configuration JSON */}
        <div>
          <label htmlFor="configJson" className="block text-sm font-medium text-gray-700 mb-2">
            {t('scenarios.create.form.config')} *
          </label>
          <textarea
            id="configJson"
            value={configJson}
            onChange={e => setConfigJson(e.target.value)}
            placeholder={t('scenarios.create.form.configPlaceholder')}
            rows={10}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
          <p className="mt-2 text-sm text-gray-500">
            Enter scenario configuration as valid JSON. Example:{' '}
            {`{ "duration": 30, "difficulty": "beginner" }`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <Link
            href="/dashboard/scenarios"
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {t('scenarios.create.form.cancel')}
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('scenarios.create.form.creating') : t('scenarios.create.form.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
