'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { createAvatar } from '@/lib/api/avatars';
import { toast } from 'sonner';
import Link from 'next/link';
import type { AvatarType, AvatarStyle, AvatarSource } from '@prance/shared';

export default function CreateAvatarPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [formData, setFormData] = useState({
    name: '',
    type: '' as AvatarType | '',
    style: '' as AvatarStyle | '',
    source: '' as AvatarSource | '',
    modelUrl: '',
    thumbnailUrl: '',
    tags: '',
    allowCloning: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('avatars.create.validation.nameRequired');
    }
    if (!formData.type) {
      newErrors.type = t('avatars.create.validation.typeRequired');
    }
    if (!formData.style) {
      newErrors.style = t('avatars.create.validation.styleRequired');
    }
    if (!formData.source) {
      newErrors.source = t('avatars.create.validation.sourceRequired');
    }
    if (!formData.modelUrl.trim()) {
      newErrors.modelUrl = t('avatars.create.validation.modelUrlRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const avatar = await createAvatar({
        name: formData.name.trim(),
        type: formData.type as AvatarType,
        style: formData.style as AvatarStyle,
        source: formData.source as AvatarSource,
        modelUrl: formData.modelUrl.trim(),
        thumbnailUrl: formData.thumbnailUrl.trim() || undefined,
        tags: tagsArray,
        allowCloning: formData.allowCloning,
      });

      toast.success(t('avatars.create.success'));
      // Redirect to avatar detail page
      router.push(`/dashboard/avatars/${avatar.id}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('avatars.create.error');
      setSubmitError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/avatars"
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
          {t('avatars.list.title')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('avatars.create.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('avatars.create.description')}</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {submitError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.name')}
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder={t('avatars.create.form.namePlaceholder')}
              className={`block w-full px-3 py-2 border ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.type')}
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={e => handleChange('type', e.target.value)}
              className={`block w-full px-3 py-2 border ${
                errors.type ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
            >
              <option value="">{t('avatars.list.filter.all')}</option>
              <option value="TWO_D">{t('avatars.type.TWO_D')}</option>
              <option value="THREE_D">{t('avatars.type.THREE_D')}</option>
            </select>
            {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type}</p>}
          </div>

          {/* Style */}
          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.style')}
            </label>
            <select
              id="style"
              value={formData.style}
              onChange={e => handleChange('style', e.target.value)}
              className={`block w-full px-3 py-2 border ${
                errors.style ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
            >
              <option value="">{t('avatars.list.filter.all')}</option>
              <option value="ANIME">{t('avatars.style.ANIME')}</option>
              <option value="REALISTIC">{t('avatars.style.REALISTIC')}</option>
            </select>
            {errors.style && <p className="mt-1 text-sm text-red-600">{errors.style}</p>}
          </div>

          {/* Source */}
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.source')}
            </label>
            <select
              id="source"
              value={formData.source}
              onChange={e => handleChange('source', e.target.value)}
              className={`block w-full px-3 py-2 border ${
                errors.source ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
            >
              <option value="">{t('avatars.list.filter.all')}</option>
              <option value="GENERATED">{t('avatars.source.GENERATED')}</option>
              <option value="ORG_CUSTOM">{t('avatars.source.ORG_CUSTOM')}</option>
            </select>
            {errors.source && <p className="mt-1 text-sm text-red-600">{errors.source}</p>}
            <p className="mt-1 text-xs text-gray-500">
              Note: PRESET avatars can only be created by Super Administrators
            </p>
          </div>

          {/* Model URL */}
          <div>
            <label htmlFor="modelUrl" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.modelUrl')}
            </label>
            <input
              type="text"
              id="modelUrl"
              value={formData.modelUrl}
              onChange={e => handleChange('modelUrl', e.target.value)}
              placeholder={t('avatars.create.form.modelUrlPlaceholder')}
              className={`block w-full px-3 py-2 border ${
                errors.modelUrl ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
            />
            {errors.modelUrl && <p className="mt-1 text-sm text-red-600">{errors.modelUrl}</p>}
          </div>

          {/* Thumbnail URL */}
          <div>
            <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.create.form.thumbnailUrl')}
            </label>
            <input
              type="text"
              id="thumbnailUrl"
              value={formData.thumbnailUrl}
              onChange={e => handleChange('thumbnailUrl', e.target.value)}
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
              value={formData.tags}
              onChange={e => handleChange('tags', e.target.value)}
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
                checked={formData.allowCloning}
                onChange={e => setFormData(prev => ({ ...prev, allowCloning: e.target.checked }))}
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
          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('avatars.create.form.creating') : t('avatars.create.form.submit')}
            </button>
            <Link
              href="/dashboard/avatars"
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('avatars.create.form.cancel')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
