'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getAvatar, updateAvatar } from '@/lib/api/avatars';
import Link from 'next/link';
import { toast } from 'sonner';

export default function EditAvatarPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const avatarId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'TWO_D' | 'THREE_D'>('THREE_D');
  const [style, setStyle] = useState<'ANIME' | 'REALISTIC'>('REALISTIC');
  const [source, setSource] = useState<'GENERATED' | 'ORG_CUSTOM'>('ORG_CUSTOM');
  const [modelUrl, setModelUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'ORGANIZATION' | 'PUBLIC'>('PRIVATE');
  const [allowCloning, setAllowCloning] = useState(false);

  // Load existing avatar data
  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const avatar = await getAvatar(avatarId);
        setName(avatar.name);
        setType(avatar.type);
        setStyle(avatar.style);
        setSource(avatar.source === 'PRESET' ? 'ORG_CUSTOM' : avatar.source);
        setModelUrl(avatar.modelUrl);
        setThumbnailUrl(avatar.thumbnailUrl || '');
        setTags(avatar.tags.join(', '));
        setVisibility(avatar.visibility);
        setAllowCloning(avatar.allowCloning);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load avatar');
        setIsLoading(false);
      }
    };

    loadAvatar();
  }, [avatarId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const tagArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      await updateAvatar(avatarId, {
        name: name.trim(),
        type,
        style,
        source,
        modelUrl: modelUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        tags: tagArray,
        visibility,
        allowCloning,
      });

      toast.success(t('avatars.create.success'));
      router.push(`/dashboard/avatars/${avatarId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('avatars.create.error'));
      toast.error(t('avatars.create.error'));
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-500">Loading avatar...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.type')}
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

          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.style')}
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
        </div>

        <div>
          <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.source')}
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="GENERATED">{t('avatars.source.GENERATED')}</option>
            <option value="ORG_CUSTOM">{t('avatars.source.ORG_CUSTOM')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="modelUrl" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.modelUrl')} *
          </label>
          <input
            type="url"
            id="modelUrl"
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            placeholder={t('avatars.create.form.modelUrlPlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.thumbnailUrl')}
          </label>
          <input
            type="url"
            id="thumbnailUrl"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder={t('avatars.create.form.thumbnailUrlPlaceholder')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

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
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-2">
            {t('avatars.create.form.visibility')}
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="PRIVATE">{t('avatars.visibility.PRIVATE')}</option>
            <option value="ORGANIZATION">{t('avatars.visibility.ORGANIZATION')}</option>
            <option value="PUBLIC">{t('avatars.visibility.PUBLIC')}</option>
          </select>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="allowCloning"
              type="checkbox"
              checked={allowCloning}
              onChange={(e) => setAllowCloning(e.target.checked)}
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="allowCloning" className="font-medium text-gray-700">
              {t('avatars.create.form.allowCloning')}
            </label>
            <p className="text-gray-500">{t('avatars.create.form.allowCloningDescription')}</p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <Link
            href={`/dashboard/avatars/${avatarId}`}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {t('avatars.create.form.cancel')}
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
