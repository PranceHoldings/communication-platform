'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { createGuestSession, type CreateGuestSessionRequest } from '@/lib/api/guest-sessions';
import { listScenarios, type Scenario } from '@/lib/api/scenarios';
import { listAvatars, type Avatar } from '@/lib/api/avatars';

export default function CreateGuestSessionPage() {
  const router = useRouter();
  const { t } = useI18n();

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form data
  const [scenarioId, setScenarioId] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [dataRetentionDays, setDataRetentionDays] = useState('');
  const [customPin, setCustomPin] = useState('');

  // Lookup data
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  // Load scenarios and avatars
  useEffect(() => {
    loadScenarios();
    loadAvatars();
  }, []);

  const loadScenarios = async () => {
    try {
      const response = await listScenarios({ limit: 100 });
      setScenarios(response.scenarios);
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    } finally {
      setLoadingScenarios(false);
    }
  };

  const loadAvatars = async () => {
    try {
      const response = await listAvatars({ limit: 100 });
      setAvatars(response.avatars);
    } catch (err) {
      console.error('Failed to load avatars:', err);
    } finally {
      setLoadingAvatars(false);
    }
  };

  // Validation
  const validateStep1 = () => {
    if (!scenarioId) {
      setError(t('guestSessions.create.scenario.required'));
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!validUntil) {
      setError(t('guestSessions.create.validUntil.required'));
      return false;
    }

    const validUntilDate = new Date(validUntil);
    if (validUntilDate <= new Date()) {
      setError(t('guestSessions.create.validUntil.required'));
      return false;
    }

    if (customPin && (customPin.length < 4 || customPin.length > 8 || !/^\d+$/.test(customPin))) {
      setError(t('guestSessions.create.customPin.helper'));
      return false;
    }

    return true;
  };

  // Navigation
  const handleNext = () => {
    setError(null);

    if (currentStep === 1 && !validateStep1()) {
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Submit
  const handleSubmit = async () => {
    setError(null);

    if (!validateStep3()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CreateGuestSessionRequest = {
        scenarioId,
        avatarId: avatarId || undefined,
        guestName: guestName || undefined,
        guestEmail: guestEmail || undefined,
        validUntil,
        dataRetentionDays: dataRetentionDays ? parseInt(dataRetentionDays) : undefined,
        pinCode: customPin || undefined,
      };

      const response = await createGuestSession(data);
      setSuccess(true);

      // Redirect to detail page after success
      setTimeout(() => {
        router.push(`/dashboard/guest-sessions/${response.guestSession.id}`);
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('guestSessions.errors.createFailed');
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get default date (7 days from now)
  const getDefaultValidUntil = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 16);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('guestSessions.create.title')}</h1>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map(step => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex items-center w-full">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    step === currentStep
                      ? 'bg-indigo-600 text-white'
                      : step < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step < currentStep ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <p
                    className={`text-sm font-medium ${step === currentStep ? 'text-indigo-600' : 'text-gray-500'}`}
                  >
                    {t(`guestSessions.create.step${step}`)}
                  </p>
                </div>
              </div>
              {step < 3 && (
                <div
                  className={`h-1 w-full mx-4 ${
                    step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm text-green-800">{t('guestSessions.create.success')}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Step 1: Select Scenario */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.create.scenario.label')} <span className="text-red-500">*</span>
              </label>
              {loadingScenarios ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : (
                <select
                  value={scenarioId}
                  onChange={e => setScenarioId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">{t('guestSessions.create.scenario.placeholder')}</option>
                  {scenarios.map(scenario => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.title} ({scenario.language})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.create.avatar.label')}
              </label>
              {loadingAvatars ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : (
                <select
                  value={avatarId}
                  onChange={e => setAvatarId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">{t('guestSessions.create.avatar.placeholder')}</option>
                  {avatars.map(avatar => (
                    <option key={avatar.id} value={avatar.id}>
                      {avatar.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Guest Information */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.create.guestName.label')}
              </label>
              <input
                type="text"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder={t('guestSessions.create.guestName.placeholder')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.create.guestEmail.label')}
              </label>
              <input
                type="email"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                placeholder={t('guestSessions.create.guestEmail.placeholder')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Step 3: Settings */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.create.validUntil.label')} <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                defaultValue={getDefaultValidUntil()}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('guestSessions.create.validUntil.helper')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.create.dataRetention.label')}
              </label>
              <input
                type="number"
                value={dataRetentionDays}
                onChange={e => setDataRetentionDays(e.target.value)}
                placeholder="30"
                min="1"
                max="365"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('guestSessions.create.dataRetention.helper')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guestSessions.create.customPin.label')}
              </label>
              <input
                type="text"
                value={customPin}
                onChange={e => setCustomPin(e.target.value)}
                placeholder={t('guestSessions.create.customPin.placeholder')}
                pattern="\d{4,8}"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('guestSessions.create.customPin.helper')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.previous')}
        </button>

        {currentStep < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {t('common.next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || success}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('guestSessions.create.submitting') : t('guestSessions.create.submit')}
          </button>
        )}
      </div>
    </div>
  );
}
