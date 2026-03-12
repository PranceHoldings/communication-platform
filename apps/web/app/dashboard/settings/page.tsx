'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/lib/i18n/provider';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { getOrganizationSettings, updateOrganizationSettings } from '@/lib/api/settings';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();

  // AI & Audio Settings state
  const [enableSilencePrompt, setEnableSilencePrompt] = useState(true);
  const [silenceTimeout, setSilenceTimeout] = useState(10);
  const [silencePromptStyle, setSilencePromptStyle] = useState<'formal' | 'casual' | 'neutral'>('neutral');
  const [showSilenceTimer, setShowSilenceTimer] = useState(false);
  const [silenceThreshold, setSilenceThreshold] = useState(0.12);
  const [minSilenceDuration, setMinSilenceDuration] = useState(500);

  // Loading & error states
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Load settings from API
  useEffect(() => {
    const loadSettings = async () => {
      if (!isAuthenticated) return;

      try {
        setIsLoadingSettings(true);
        setSettingsError(null);
        const settings = await getOrganizationSettings();

        // Update state with loaded settings
        if (settings.enableSilencePrompt !== undefined) {
          setEnableSilencePrompt(settings.enableSilencePrompt);
        }
        if (settings.silenceTimeout !== undefined) {
          setSilenceTimeout(settings.silenceTimeout);
        }
        if (settings.silencePromptStyle !== undefined) {
          setSilencePromptStyle(settings.silencePromptStyle);
        }
        if (settings.showSilenceTimer !== undefined) {
          setShowSilenceTimer(settings.showSilenceTimer);
        }
        if (settings.silenceThreshold !== undefined) {
          setSilenceThreshold(settings.silenceThreshold);
        }
        if (settings.minSilenceDuration !== undefined) {
          setMinSilenceDuration(settings.minSilenceDuration);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setSettingsError(error instanceof Error ? error.message : 'Failed to load settings');
        toast.error('Failed to load settings');
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadSettings();
  }, [isAuthenticated]);

  // Save settings to API
  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setSettingsError(null);

      await updateOrganizationSettings({
        enableSilencePrompt,
        silenceTimeout,
        silencePromptStyle,
        showSilenceTimer,
        silenceThreshold,
        minSilenceDuration,
      });

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsError(error instanceof Error ? error.message : 'Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default settings
  const handleResetSettings = () => {
    setEnableSilencePrompt(true);
    setSilenceTimeout(10);
    setSilencePromptStyle('neutral');
    setShowSilenceTimer(false);
    setSilenceThreshold(0.12);
    setMinSilenceDuration(500);
    toast.info('Settings reset to defaults');
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('settings.subtitle')}</p>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{t('settings.profile.title')}</h3>
          </div>
          <div className="px-6 py-5 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.profile.name')}
              </label>
              <input
                type="text"
                value={user.name}
                disabled
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.profile.email')}
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.profile.role')}
              </label>
              <input
                type="text"
                value={user.role}
                disabled
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{t('settings.preferences.title')}</h3>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    {t('settings.preferences.emailNotifications.title')}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {t('settings.preferences.emailNotifications.description')}
                  </p>
                </div>
                <button
                  type="button"
                  className="bg-gray-200 relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  role="switch"
                  aria-checked="false"
                >
                  <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200"></span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    {t('settings.preferences.sessionReminders.title')}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {t('settings.preferences.sessionReminders.description')}
                  </p>
                </div>
                <button
                  type="button"
                  className="bg-gray-200 relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  role="switch"
                  aria-checked="false"
                >
                  <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{t('settings.security.title')}</h3>
          </div>
          <div className="px-6 py-5">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('settings.security.changePassword')}
            </button>
          </div>
        </div>

        {/* AI & Audio Settings Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{t('settings.aiAudio.title')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('settings.aiAudio.subtitle')}</p>
          </div>
          <div className="px-6 py-5 space-y-8">
            {/* AI Response Behavior */}
            <div>
              <h4 className="text-base font-medium text-gray-900 mb-4">
                {t('settings.aiAudio.aiResponseBehavior.title')}
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                {t('settings.aiAudio.aiResponseBehavior.description')}
              </p>

              <div className="space-y-4">
                {/* Enable Silence Prompt */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900">
                      {t('settings.aiAudio.aiResponseBehavior.enableSilencePrompt')}
                    </label>
                    <p className="text-sm text-gray-500">
                      {t('settings.aiAudio.aiResponseBehavior.enableSilencePromptHelp')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableSilencePrompt(!enableSilencePrompt)}
                    className={`${
                      enableSilencePrompt ? 'bg-indigo-600' : 'bg-gray-200'
                    } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                    role="switch"
                    aria-checked={enableSilencePrompt}
                  >
                    <span
                      className={`${
                        enableSilencePrompt ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                    ></span>
                  </button>
                </div>

                {/* Silence Timeout */}
                {enableSilencePrompt && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('settings.aiAudio.aiResponseBehavior.silenceTimeout')}
                      </label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="number"
                          min="5"
                          max="60"
                          value={silenceTimeout}
                          onChange={e => setSilenceTimeout(parseInt(e.target.value) || 10)}
                          className="block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="text-sm text-gray-600">
                          {t('settings.aiAudio.aiResponseBehavior.silenceTimeoutSeconds')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {t('settings.aiAudio.aiResponseBehavior.silenceTimeoutHelp')}
                      </p>
                    </div>

                    {/* Silence Prompt Style */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('settings.aiAudio.aiResponseBehavior.silencePromptStyle')}
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
                              {t(`settings.aiAudio.aiResponseBehavior.silencePromptStyle${style.charAt(0).toUpperCase() + style.slice(1)}`)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Show Silence Timer */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-900">
                          {t('settings.aiAudio.aiResponseBehavior.showSilenceTimer')}
                        </label>
                        <p className="text-sm text-gray-500">
                          {t('settings.aiAudio.aiResponseBehavior.showSilenceTimerHelp')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSilenceTimer(!showSilenceTimer)}
                        className={`${
                          showSilenceTimer ? 'bg-indigo-600' : 'bg-gray-200'
                        } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        role="switch"
                        aria-checked={showSilenceTimer}
                      >
                        <span
                          className={`${
                            showSilenceTimer ? 'translate-x-5' : 'translate-x-0'
                          } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                        ></span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Audio Detection Settings */}
            <div className="pt-6 border-t border-gray-200">
              <h4 className="text-base font-medium text-gray-900 mb-4">
                {t('settings.aiAudio.audioDetectionSettings.title')}
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                {t('settings.aiAudio.audioDetectionSettings.description')}
              </p>

              <div className="space-y-4">
                {/* Silence Threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.aiAudio.audioDetectionSettings.silenceThreshold')}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max="0.2"
                    step="0.01"
                    value={silenceThreshold}
                    onChange={e => setSilenceThreshold(parseFloat(e.target.value) || 0.12)}
                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {t('settings.aiAudio.audioDetectionSettings.silenceThresholdHelp')}
                  </p>
                </div>

                {/* Min Silence Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.aiAudio.audioDetectionSettings.minSilenceDuration')}
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="100"
                      max="2000"
                      step="100"
                      value={minSilenceDuration}
                      onChange={e => setMinSilenceDuration(parseInt(e.target.value) || 500)}
                      className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="text-sm text-gray-600">ms</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('settings.aiAudio.audioDetectionSettings.minSilenceDurationHelp')}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-gray-200 flex space-x-3">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : t('settings.aiAudio.saveButton')}
              </button>
              <button
                type="button"
                onClick={handleResetSettings}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('settings.aiAudio.resetButton')}
              </button>
            </div>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">{t('settings.comingSoon')}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
