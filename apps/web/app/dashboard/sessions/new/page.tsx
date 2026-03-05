'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { listScenarios, type Scenario } from '@/lib/api/scenarios';
import { listAvatars, type Avatar } from '@/lib/api/avatars';
import { createSession } from '@/lib/api/sessions';

type Step = 'scenario' | 'avatar' | 'options';

export default function NewSessionPage() {
  const router = useRouter();
  const t = useTranslations('sessions.new');

  const [currentStep, setCurrentStep] = useState<Step>('scenario');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const response = await listScenarios({ limit: 50 });
      setScenarios(response.scenarios);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const loadAvatars = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAvatars({
        limit: 50,
        type: avatarTypeFilter || undefined,
        style: avatarStyleFilter || undefined,
      });
      setAvatars(response.avatars);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatars');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 'scenario') {
      if (!selectedScenario) {
        setError(t('validation.scenario_required'));
        return;
      }
      setError(null);
      setCurrentStep('avatar');
    } else if (currentStep === 'avatar') {
      if (!selectedAvatar) {
        setError(t('validation.avatar_required'));
        return;
      }
      setError(null);
      setCurrentStep('options');
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === 'avatar') {
      setCurrentStep('scenario');
    } else if (currentStep === 'options') {
      setCurrentStep('avatar');
    }
  };

  const handleCreate = async () => {
    if (!selectedScenario || !selectedAvatar) {
      setError('Please complete all steps');
      return;
    }

    // Validate metadata JSON
    let metadataObj: Record<string, unknown> = {};
    if (metadata.trim()) {
      try {
        metadataObj = JSON.parse(metadata);
      } catch (err) {
        setError(t('validation.invalid_metadata'));
        return;
      }
    }

    setCreating(true);
    setError(null);
    try {
      const session = await createSession({
        scenarioId: selectedScenario.id,
        avatarId: selectedAvatar.id,
        metadata: metadataObj,
      });

      // Redirect to session detail page
      router.push(`/dashboard/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
      setCreating(false);
    }
  };

  const filteredScenarios = scenarios.filter((scenario) =>
    scenario.title.toLowerCase().includes(scenarioSearch.toLowerCase()) ||
    scenario.category.toLowerCase().includes(scenarioSearch.toLowerCase())
  );

  const filteredAvatars = avatars.filter((avatar) =>
    avatar.name.toLowerCase().includes(avatarSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-gray-600 mt-2">{t('description')}</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4">
        <div className={`flex items-center ${currentStep === 'scenario' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'scenario' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>
            1
          </div>
          <span className="ml-2">{t('step_1')}</span>
        </div>
        <div className="h-0.5 w-16 bg-gray-300" />
        <div className={`flex items-center ${currentStep === 'avatar' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'avatar' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>
            2
          </div>
          <span className="ml-2">{t('step_2')}</span>
        </div>
        <div className="h-0.5 w-16 bg-gray-300" />
        <div className={`flex items-center ${currentStep === 'options' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'options' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>
            3
          </div>
          <span className="ml-2">{t('step_3')}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Step: Scenario Selection */}
      {currentStep === 'scenario' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t('scenario.title')}</h2>
            <p className="text-gray-600 text-sm mt-1">{t('scenario.description')}</p>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder={t('scenario.search_placeholder')}
            value={scenarioSearch}
            onChange={(e) => setScenarioSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Scenarios Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filteredScenarios.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('scenario.no_results')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScenarios.map((scenario) => (
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
                      <span className="font-medium">{t('scenario.card.category')}:</span>
                      <span>{scenario.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">{t('scenario.card.language')}:</span>
                      <span>{scenario.language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">{t('scenario.card.visibility')}:</span>
                      <span>{scenario.visibility}</span>
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
              {t('actions.cancel')}
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedScenario}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {t('actions.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step: Avatar Selection */}
      {currentStep === 'avatar' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t('avatar.title')}</h2>
            <p className="text-gray-600 text-sm mt-1">{t('avatar.description')}</p>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder={t('avatar.search_placeholder')}
              value={avatarSearch}
              onChange={(e) => setAvatarSearch(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={avatarTypeFilter}
              onChange={(e) => setAvatarTypeFilter(e.target.value as 'TWO_D' | 'THREE_D' | '')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('avatar.filter.all_types')}</option>
              <option value="TWO_D">{t('avatar.filter.type_2d')}</option>
              <option value="THREE_D">{t('avatar.filter.type_3d')}</option>
            </select>
            <select
              value={avatarStyleFilter}
              onChange={(e) => setAvatarStyleFilter(e.target.value as 'ANIME' | 'REALISTIC' | '')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('avatar.filter.all_styles')}</option>
              <option value="ANIME">{t('avatar.filter.style_anime')}</option>
              <option value="REALISTIC">{t('avatar.filter.style_realistic')}</option>
            </select>
          </div>

          {/* Avatars Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filteredAvatars.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('avatar.no_results')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredAvatars.map((avatar) => (
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
                      <span className="font-medium">{t('avatar.card.type')}:</span>
                      <span>{avatar.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">{t('avatar.card.style')}:</span>
                      <span>{avatar.style}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">{t('avatar.card.source')}:</span>
                      <span>{avatar.source}</span>
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
              {t('actions.back')}
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedAvatar}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {t('actions.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step: Session Options */}
      {currentStep === 'options' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t('options.title')}</h2>
            <p className="text-gray-600 text-sm mt-1">{t('options.description')}</p>
          </div>

          {/* Selected Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div>
              <span className="font-semibold">Scenario:</span> {selectedScenario?.title}
            </div>
            <div>
              <span className="font-semibold">Avatar:</span> {selectedAvatar?.name} ({selectedAvatar?.type})
            </div>
          </div>

          {/* Metadata */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('options.metadata')}</label>
            <textarea
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder={t('options.metadata_placeholder')}
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
              {t('actions.back')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {creating ? t('creating') : t('actions.create')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
