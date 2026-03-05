'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { getAvatar, deleteAvatar, cloneAvatar, type Avatar } from '@/lib/api/avatars';
import { authApi } from '@/lib/api/auth';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';

export default function AvatarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  const avatarId = params.id as string;
  const currentUser = authApi.getCurrentUser();
  const canDelete = currentUser && avatar && (
    avatar.orgId === currentUser.orgId ||
    currentUser.role === 'SUPER_ADMIN'
  ) && avatar.source !== 'PRESET';

  const canClone = currentUser && avatar && (
    avatar.visibility === 'PUBLIC' &&
    avatar.allowCloning &&
    avatar.orgId !== currentUser.orgId
  );

  const isOwnOrg = currentUser && avatar && avatar.orgId === currentUser.orgId;

  useEffect(() => {
    loadAvatar();
  }, [avatarId]);

  const loadAvatar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAvatar(avatarId);
      setAvatar(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatar');
    } finally {
      setLoading(false);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);

    try {
      await deleteAvatar(avatarId);
      toast.success(t('avatars.delete.success'));
      // Success - redirect to avatars list
      router.push('/dashboard/avatars');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('avatars.delete.error');
      toast.error(errorMessage);
      setIsDeleting(false);
    }
  };

  const handleCloneClick = () => {
    setShowCloneDialog(true);
  };

  const handleCloneConfirm = async () => {
    setIsCloning(true);

    try {
      const clonedAvatar = await cloneAvatar(avatarId);
      toast.success(t('avatars.clone.success'));
      // Redirect to the cloned avatar detail page
      router.push(`/dashboard/avatars/${clonedAvatar.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('avatars.clone.error');
      toast.error(errorMessage);
      setIsCloning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !avatar) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Avatar not found'}
        </div>
        <button
          onClick={() => router.push('/dashboard/avatars')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          {t('avatars.list.title')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/avatars"
            className="text-sm text-indigo-600 hover:text-indigo-900 mb-2 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('avatars.list.title')}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{avatar.name}</h1>
            {avatar.source === 'PRESET' && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-full">
                {t('avatars.badge.preset')}
              </span>
            )}
            {isOwnOrg && avatar.source !== 'PRESET' && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                {t('avatars.badge.yourOrg')}
              </span>
            )}
            {!isOwnOrg && avatar.source !== 'PRESET' && (
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
                {t('avatars.badge.shared')}
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-2">Avatar ID: {avatar.id}</p>
        </div>
      </div>

      {/* Thumbnail */}
      {avatar.thumbnailUrl && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <img
            src={avatar.thumbnailUrl}
            alt={avatar.name}
            className="w-full max-w-md mx-auto"
          />
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">{t('avatars.detail.info')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-600">{t('avatars.create.form.type')}:</span>
            <div className="font-medium">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                {t(`avatars.type.${avatar.type}`)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-600">{t('avatars.create.form.style')}:</span>
            <div className="font-medium">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                {t(`avatars.style.${avatar.style}`)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-600">{t('avatars.create.form.source')}:</span>
            <div className="font-medium">
              <span className={`px-2 py-1 text-sm rounded ${getSourceBadgeColor(avatar.source)}`}>
                {t(`avatars.source.${avatar.source}`)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-600">{t('avatars.detail.createdAt')}:</span>
            <div className="font-medium">{formatDate(avatar.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* URLs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">URLs</h2>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-gray-600">{t('avatars.detail.modelUrl')}:</span>
            <div className="mt-1 p-3 bg-gray-50 rounded text-sm font-mono break-all">
              {avatar.modelUrl}
            </div>
          </div>
          {avatar.thumbnailUrl && (
            <div>
              <span className="text-sm text-gray-600">{t('avatars.detail.thumbnailUrl')}:</span>
              <div className="mt-1 p-3 bg-gray-50 rounded text-sm font-mono break-all">
                {avatar.thumbnailUrl}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {avatar.tags.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">{t('avatars.detail.tags')}</h2>
          <div className="flex flex-wrap gap-2">
            {avatar.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            {isOwnOrg && (
              <Link
                href={`/dashboard/avatars/${avatarId}/edit`}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 inline-block"
              >
                {t('avatars.detail.edit')}
              </Link>
            )}
            {canClone && (
              <button
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCloneClick}
                disabled={isCloning}
              >
                {isCloning ? t('avatars.clone.cloning') : t('avatars.clone.button')}
              </button>
            )}
            {canDelete && (
              <button
                className="px-6 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDeleteClick}
                disabled={isDeleting}
              >
                {isDeleting ? t('avatars.delete.deleting') : t('avatars.detail.delete')}
              </button>
            )}
          </div>
          {!canDelete && avatar.source === 'PRESET' && (
            <p className="text-sm text-gray-500">
              Note: PRESET avatars can only be deleted by Super Administrators
            </p>
          )}
          {!canDelete && avatar.source !== 'PRESET' && avatar.orgId !== currentUser?.orgId && (
            <p className="text-sm text-gray-500">
              Note: You can only delete avatars from your organization
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t('avatars.delete.confirm')}
        description={t('avatars.delete.confirmMessage')}
        confirmText={t('avatars.detail.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />

      {/* Clone Confirmation Dialog */}
      <ConfirmDialog
        open={showCloneDialog}
        onOpenChange={setShowCloneDialog}
        title={t('avatars.clone.confirm')}
        description={t('avatars.clone.confirmMessage')}
        confirmText={t('avatars.clone.button')}
        cancelText={t('common.cancel')}
        onConfirm={handleCloneConfirm}
        variant="default"
      />


    </div>
  );
}
