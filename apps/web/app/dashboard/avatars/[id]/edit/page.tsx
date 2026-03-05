'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getAvatar, updateAvatar } from '@/lib/api/avatars';
import { toast } from 'sonner';
import Link from 'next/link';

export default function EditAvatarPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();

  const avatarId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'TWO_D' | 'THREE_D'>('TWO_D');
  const [style, setStyle] = useState<'ANIME' | 'REALISTIC'>('ANIME');
  const [source, setSource] = useState<'PRESET' | 'GENERATED' | 'ORG_CUSTOM'>('ORG_CUSTOM');
  const [originalSource, setOriginalSource] = useState<'PRESET' | 'GENERATED' | 'ORG_CUSTOM'>('ORG_CUSTOM');
  const [modelUrl, setModelUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [tags, setTags] = useState('');
  const [allowCloning, setAllowCloning] = useState(false);

  useEffect(() => {
    loadAvatar();
  }, [avatarId]);

  const loadAvatar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAvatar(avatarId);
      setName(data.name);
      setType(data.type);
      setStyle(data.style);
      setSource(data.source);
      setOriginalSource(data.source);
      setModelUrl(data.modelUrl);
      setThumbnailUrl(data.thumbnailUrl || '');
      setTags(data.tags.join(', '));
      setAllowCloning(data.allowCloning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError(t('avatars.create.validation.nameRequired'));
      return;
    }

    if (!modelUrl.trim()) {
      setError(t('avatars.create.validation.modelUrlRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      const tagsArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Build update data - don't include source if it's unchanged (especially for PRESET)
      const updateData: any = {
        name: name.trim(),
        type,
        style,
        modelUrl: modelUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        tags: tagsArray,
        allowCloning,
      };

      // Only include source if it has changed from original
      if (source !== originalSource) {
        updateData.source = source;
      }

      await updateAvatar(avatarId, updateData);

      toast.success('Avatar updated successfully');
      // Success - redirect to avatar detail page
      router.push(`/dashboard/avatars/${avatarId}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update avatar';
      setError(errorMsg);
      toast.error(errorMsg);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/avatars/${avatarId}`}
          className="text-sm text-indigo-600 hover:text-indigo-900 mb-4 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Avatar
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Edit Avatar</h1>
        <p className="mt-1 text-sm text-gray-500">Update avatar information</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.name')} *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('avatars.create.form.namePlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.type')} *
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="TWO_D">{t('avatars.type.TWO_D')}</option>
            <option value="THREE_D">{t('avatars.type.THREE_D')}</option>
          </select>
        </div>

        {/* Style */}
        <div>
          <label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.style')} *
          </label>
          <select
            id="style"
            value={style}
            onChange={(e) => setStyle(e.target.value as any)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ANIME">{t('avatars.style.ANIME')}</option>
            <option value="REALISTIC">{t('avatars.style.REALISTIC')}</option>
          </select>
        </div>

        {/* Source */}
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.source')} *
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            disabled={originalSource === 'PRESET'}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {originalSource === 'PRESET' && (
              <option value="PRESET">{t('avatars.source.PRESET')}</option>
            )}
            <option value="GENERATED">{t('avatars.source.GENERATED')}</option>
            <option value="ORG_CUSTOM">{t('avatars.source.ORG_CUSTOM')}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {originalSource === 'PRESET'
              ? 'PRESET avatars can only be managed by Super Administrators'
              : 'Select the avatar source type'}
          </p>
        </div>

        {/* Model URL */}
        <div>
          <label htmlFor="modelUrl" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.modelUrl')} *
          </label>
          <input
            type="text"
            id="modelUrl"
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            placeholder={t('avatars.create.form.modelUrlPlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        {/* Thumbnail URL */}
        <div>
          <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.thumbnailUrl')}
          </label>
          <input
            type="text"
            id="thumbnailUrl"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder={t('avatars.create.form.thumbnailUrlPlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.tags')}
          </label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('avatars.create.form.tagsPlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">Separate multiple tags with commas</p>
        </div>

        {/* Allow Cloning */}
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              id="allowCloning"
              checked={allowCloning}
              onChange={(e) => setAllowCloning(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3">
            <label htmlFor="allowCloning" className="text-sm font-medium text-gray-700">
              {t('avatars.create.form.allowCloning')}
            </label>
            <p className="text-xs text-gray-500">
              {t('avatars.create.form.allowCloningDescription')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <Link
            href={`/dashboard/avatars/${avatarId}`}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Updating...' : 'Update Avatar'}
          </button>
        </div>
      </form>
    </div>
  );
}
