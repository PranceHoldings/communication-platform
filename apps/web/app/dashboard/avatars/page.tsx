'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import type { Avatar, AvatarType, AvatarStyle, AvatarSource } from '@prance/shared';
import { listAvatars } from '@/lib/api/avatars';
import { authApi } from '@/lib/api/auth';
import Link from 'next/link';

export default function AvatarsPage() {
  const { t } = useI18n();
  const currentUser = authApi.getCurrentUser();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AvatarType | ''>('');
  const [styleFilter, setStyleFilter] = useState<AvatarStyle | ''>('');
  const [sourceFilter, setSourceFilter] = useState<AvatarSource | ''>('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  });

  useEffect(() => {
    loadAvatars();
  }, [typeFilter, styleFilter, sourceFilter]);

  const loadAvatars = async (offset = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listAvatars({
        limit: 20,
        offset,
        type: typeFilter || undefined,
        style: styleFilter || undefined,
        source: sourceFilter || undefined,
      });

      setAvatars(response.avatars);
      setPagination(response.pagination);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('avatars.errors.genericError');
      setError(`${t('avatars.errors.loadListFailed')}: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceBadgeColor = (source: Avatar['source']) => {
    switch (source) {
      case 'PRESET':
        return 'bg-purple-100 text-purple-800';
      case 'GENERATED':
        return 'bg-blue-100 text-blue-800';
      case 'ORG_CUSTOM':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBadge = (avatar: Avatar) => {
    if (avatar.source === 'PRESET') {
      return (
        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
          {t('avatars.badge.preset')}
        </span>
      );
    }
    if (currentUser && avatar.orgId === currentUser.orgId) {
      return (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
          {t('avatars.badge.yourOrg')}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
        {t('avatars.badge.shared')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('avatars.list.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('avatars.list.description')}</p>
        </div>
        <Link
          href="/dashboard/avatars/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('avatars.create.button')}
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.list.filter.type')}
            </label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">{t('avatars.list.filter.all')}</option>
              <option value="TWO_D">{t('avatars.type.TWO_D')}</option>
              <option value="THREE_D">{t('avatars.type.THREE_D')}</option>
            </select>
          </div>

          {/* Style Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.list.filter.style')}
            </label>
            <select
              value={styleFilter}
              onChange={e => setStyleFilter(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">{t('avatars.list.filter.all')}</option>
              <option value="ANIME">{t('avatars.style.ANIME')}</option>
              <option value="REALISTIC">{t('avatars.style.REALISTIC')}</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('avatars.list.filter.source')}
            </label>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">{t('avatars.list.filter.all')}</option>
              <option value="PRESET">{t('avatars.source.PRESET')}</option>
              <option value="GENERATED">{t('avatars.source.GENERATED')}</option>
              <option value="ORG_CUSTOM">{t('avatars.source.ORG_CUSTOM')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Avatars Grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-600">
            <p>{error}</p>
          </div>
        ) : avatars.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <p className="font-medium">{t('avatars.list.empty')}</p>
            <p className="text-sm mt-1">{t('avatars.list.emptyDescription')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {avatars.map(avatar => (
              <Link
                key={avatar.id}
                href={`/dashboard/avatars/${avatar.id}`}
                className="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {avatar.thumbnailUrl ? (
                    <img
                      src={avatar.thumbnailUrl}
                      alt={avatar.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-20 h-20 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{avatar.name}</h3>
                    {getBadge(avatar)}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {t(`avatars.type.${avatar.type}`)}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {t(`avatars.style.${avatar.style}`)}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${getSourceBadgeColor(avatar.source)}`}
                    >
                      {t(`avatars.source.${avatar.source}`)}
                    </span>
                  </div>

                  {avatar.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {avatar.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {avatar.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-gray-500 text-xs">
                          +{avatar.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {avatars.length > 0 && (
        <div className="flex items-center justify-between bg-white px-6 py-3 border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-700">
            Showing {pagination.offset + 1} to {pagination.offset + avatars.length} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => loadAvatars(Math.max(0, pagination.offset - pagination.limit))}
              disabled={pagination.offset === 0}
              className="px-3 py-1 rounded-md text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => loadAvatars(pagination.offset + pagination.limit)}
              disabled={!pagination.hasMore}
              className="px-3 py-1 rounded-md text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
