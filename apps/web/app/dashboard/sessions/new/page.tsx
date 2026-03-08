'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { listScenarios, type Scenario } from '@/lib/api/scenarios';
import type { Avatar } from '@prance/shared';
import { listAvatars } from '@/lib/api/avatars';
import { createSession } from '@/lib/api/sessions';
import Toast from '@/components/Toast';

type Step = 'scenario' | 'avatar' | 'options';

export default function NewSessionPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [currentStep, setCurrentStep] = useState<Step>('scenario');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  // Data
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);

  // Selection
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [metadata, setMetadata] = useState<string>('{}');

  // Filters
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [avatarSearch, setAvatarSearch] = useState('');
  const [avatarTypeFilter, setAvatarTypeFilter] = useState<'TWO_D' | 'THREE_D' | ''>('');
  const [avatarStyleFilter, setAvatarStyleFilter] = useState<'ANIME' | 'REALISTIC' | ''>('');

  // Load scenarios
  useEffect(() => {
    if (currentStep === 'scenario') {
      loadScenarios();
    }
  }, [currentStep]);

  // Load avatars
  useEffect(() => {
    if (currentStep === 'avatar') {
      loadAvatars();
    }
  }, [currentStep, avatarTypeFilter, avatarStyleFilter]);

  const loadScenarios = async () => {
    setLoading(true);
    setToast(null);
    try {
      const response = await listScenarios({ limit: 50 });
      setScenarios(response.scenarios);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load scenarios',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvatars = async () => {
    setLoading(true);
    setToast(null);
    try {
      const response = await listAvatars({
        limit: 50,
        type: avatarTypeFilter || undefined,
        style: avatarStyleFilter || undefined,
      });
      setAvatars(response.avatars);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load avatars',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 'scenario') {
      if (!selectedScenario) {
        setToast({ message: t('sessions.new.validation.scenario_required'), type: 'warning' });
        return;
      }
      setToast(null);
      setCurrentStep('avatar');
    } else if (currentStep === 'avatar') {
      if (!selectedAvatar) {
        setToast({ message: t('sessions.new.validation.avatar_required'), type: 'warning' });
        return;
      }
      setToast(null);
      setCurrentStep('options');
    }
  };

  const handleBack = () => {
    setToast(null);
    if (currentStep === 'avatar') {
      setCurrentStep('scenario');
    } else if (currentStep === 'options') {
      setCurrentStep('avatar');
    }
  };

  const handleCreate = async () => {
    console.log('[NewSession] handleCreate called', {
      selectedScenario: selectedScenario?.id,
      selectedAvatar: selectedAvatar?.id,
    });

    if (!selectedScenario || !selectedAvatar) {
      setToast({ message: 'Please complete all steps', type: 'warning' });
      return;
    }

    // Validate metadata JSON
    let metadataObj: Record<string, unknown> = {};
    if (metadata.trim()) {
      try {
        metadataObj = JSON.parse(metadata);
      } catch (err) {
        console.error('[NewSession] Invalid metadata JSON:', err);
        setToast({ message: t('sessions.new.validation.invalid_metadata'), type: 'error' });
        return;
      }
    }

    console.log('[NewSession] Creating session...', {
      scenarioId: selectedScenario.id,
      avatarId: selectedAvatar.id,
      metadata: metadataObj,
    });
    setCreating(true);
    setToast(null);
    try {
      const session = await createSession({
        scenarioId: selectedScenario.id,
        avatarId: selectedAvatar.id,
        metadata: metadataObj,
      });

      console.log('[NewSession] Session created:', session.id);
      console.log('[NewSession] Redirecting to:', `/dashboard/sessions/${session.id}`);

      // Redirect to session detail page
      router.push(`/dashboard/sessions/${session.id}`);
    } catch (err) {
      console.error('[NewSession] Failed to create session:', err);
      setToast({
        message: err instanceof Error ? err.message : t('sessions.new.error'),
        type: 'error',
      });
      setCreating(false);
    }
  };

  const filteredScenarios = scenarios.filter(
    scenario =>
      scenario.title.toLowerCase().includes(scenarioSearch.toLowerCase()) ||
      scenario.category.toLowerCase().includes(scenarioSearch.toLowerCase())
  );

  const filteredAvatars = avatars.filter(avatar =>
    avatar.name.toLowerCase().includes(avatarSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('sessions.new.title')}</h1>
        <p className="text-gray-600 mt-2">{t('sessions.new.description')}</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4">
        <div
          className={`flex items-center ${currentStep === 'scenario' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'scenario' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}
          >
            1
          </div>
          <span className="ml-2">{t('sessions.new.step_1')}</span>
        </div>
        <div className="h-0.5 w-16 bg-gray-300" />
        <div
          className={`flex items-center ${currentStep === 'avatar' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'avatar' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}
          >
            2
          </div>
          <span className="ml-2">{t('sessions.new.step_2')}</span>
        </div>
        <div className="h-0.5 w-16 bg-gray-300" />
        <div
          className={`flex items-center ${currentStep === 'options' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'options' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}
          >
            3
          </div>
          <span className="ml-2">{t('sessions.new.step_3')}</span>
        </div>
      </div>

      {/* Step: Scenario Selection */}
      {currentStep === 'scenario' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t('sessions.new.scenario.title')}</h2>
            <p className="text-gray-600 text-sm mt-1">{t('sessions.new.scenario.description')}</p>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder={t('sessions.new.scenario.search_placeholder')}
            value={scenarioSearch}
            onChange={e => setScenarioSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Scenarios Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              {t('sessions.new.scenario.loading')}
            </div>
          ) : filteredScenarios.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {t('sessions.new.scenario.no_results')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScenarios.map(scenario => (
                <div
                  key={scenario.id}
                  onClick={() => setSelectedScenario(scenario)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedScenario?.id === scenario.id
                      ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-lg mb-2">{scenario.title}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {t('sessions.new.scenario.card.category')}:
                      </span>
                      <span className="capitalize">{scenario.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {t('sessions.new.scenario.card.language')}:
                      </span>
                      <span className="uppercase">{scenario.language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {t('sessions.new.scenario.card.visibility')}:
                      </span>
                      <span>{t(`scenarios.visibility.${scenario.visibility}`)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <button
              onClick={() => router.push('/dashboard/sessions')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('sessions.new.actions.cancel')}
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedScenario}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {t('sessions.new.actions.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step: Avatar Selection */}
      {currentStep === 'avatar' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t('sessions.new.avatar.title')}</h2>
            <p className="text-gray-600 text-sm mt-1">{t('sessions.new.avatar.description')}</p>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder={t('sessions.new.avatar.search_placeholder')}
              value={avatarSearch}
              onChange={e => setAvatarSearch(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={avatarTypeFilter}
              onChange={e => setAvatarTypeFilter(e.target.value as 'TWO_D' | 'THREE_D' | '')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('sessions.new.avatar.filter.all_types')}</option>
              <option value="TWO_D">{t('sessions.new.avatar.filter.type_2d')}</option>
              <option value="THREE_D">{t('sessions.new.avatar.filter.type_3d')}</option>
            </select>
            <select
              value={avatarStyleFilter}
              onChange={e => setAvatarStyleFilter(e.target.value as 'ANIME' | 'REALISTIC' | '')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('sessions.new.avatar.filter.all_styles')}</option>
              <option value="ANIME">{t('sessions.new.avatar.filter.style_anime')}</option>
              <option value="REALISTIC">{t('sessions.new.avatar.filter.style_realistic')}</option>
            </select>
          </div>

          {/* Avatars Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              {t('sessions.new.avatar.loading')}
            </div>
          ) : filteredAvatars.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {t('sessions.new.avatar.no_results')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredAvatars.map(avatar => (
                <div
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedAvatar?.id === avatar.id
                      ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  {/* Avatar Thumbnail */}
                  {avatar.thumbnailUrl ? (
                    <img
                      src={avatar.thumbnailUrl}
                      alt={avatar.name}
                      className="w-full h-32 object-cover rounded mb-3"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 rounded mb-3 flex items-center justify-center text-gray-400">
                      No Image
                    </div>
                  )}

                  <h3 className="font-semibold mb-2">{avatar.name}</h3>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="font-medium">{t('sessions.new.avatar.card.type')}:</span>
                      <span>{t(`avatars.type.${avatar.type}`)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">{t('sessions.new.avatar.card.style')}:</span>
                      <span>{t(`avatars.style.${avatar.style}`)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">{t('sessions.new.avatar.card.source')}:</span>
                      <span>{t(`avatars.source.${avatar.source}`)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <button
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('sessions.new.actions.back')}
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedAvatar}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {t('sessions.new.actions.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step: Session Options */}
      {currentStep === 'options' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t('sessions.new.options.title')}</h2>
            <p className="text-gray-600 text-sm mt-1">{t('sessions.new.options.description')}</p>
          </div>

          {/* Selected Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div>
              <span className="font-semibold">{t('sessions.new.options.scenario')}:</span>{' '}
              {selectedScenario?.title}
              <span className="text-gray-600 text-sm ml-2">
                ({selectedScenario?.category} • {selectedScenario?.language?.toUpperCase()})
              </span>
            </div>
            <div>
              <span className="font-semibold">{t('sessions.new.options.avatar')}:</span>{' '}
              {selectedAvatar?.name}
              <span className="text-gray-600 text-sm ml-2">
                ({t(`avatars.style.${selectedAvatar?.style}`)} •{' '}
                {t(`avatars.type.${selectedAvatar?.type}`)})
              </span>
            </div>
          </div>

          {/* Metadata */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('sessions.new.options.metadata')}
            </label>
            <textarea
              value={metadata}
              onChange={e => setMetadata(e.target.value)}
              placeholder={t('sessions.new.options.metadata_placeholder')}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <button
              onClick={handleBack}
              disabled={creating}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {t('sessions.new.actions.back')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {creating ? t('sessions.new.creating') : t('sessions.new.actions.create')}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          isOpen={!!toast}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
