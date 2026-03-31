'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/lib/i18n/provider';
import {
  getRuntimeConfig,
  getRuntimeConfigHistory,
  updateRuntimeConfig,
  rollbackRuntimeConfig,
  type RuntimeConfig,
  type RuntimeConfigHistory,
} from '@/lib/api/runtime-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowLeft, Save, History, RotateCcw, AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  validateConfigChange,
  isWeightField,
} from '@/lib/utils/runtime-config-validation';
import { WeightVisualization } from '@/components/runtime-config/WeightVisualization';

export default function RuntimeConfigDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();

  const key = params.key as string;

  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [history, setHistory] = useState<RuntimeConfigHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newValue, setNewValue] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [validationWarning, setValidationWarning] = useState<string>('');
  const [allConfigs, setAllConfigs] = useState<Record<string, any>>({});

  // Check authorization
  useEffect(() => {
    if (isAuthenticated && user && user.role !== 'SUPER_ADMIN' && user.role !== 'CLIENT_ADMIN') {
      toast.error('Access denied');
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  // Load config and all related configs (for validation)
  useEffect(() => {
    if (!isAuthenticated || !key) return;

    const loadConfig = async () => {
      try {
        setIsLoading(true);
        const response = await getRuntimeConfig(key);
        setConfig(response.data);
        setNewValue(
          typeof response.data.value === 'object'
            ? JSON.stringify(response.data.value, null, 2)
            : String(response.data.value)
        );

        // Load all configs for interdependency validation
        if (isWeightField(key)) {
          const { getRuntimeConfigs } = await import('@/lib/api/runtime-config');
          const allConfigsResponse = await getRuntimeConfigs();
          const configMap: Record<string, any> = {};
          allConfigsResponse.data.configs.forEach((c) => {
            configMap[c.key] = c.value;
          });
          setAllConfigs(configMap);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        toast.error('Failed to load configuration');
        router.push('/dashboard/admin/runtime-config');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [isAuthenticated, key, router]);

  // Load history
  const loadHistory = async () => {
    if (!key) return;

    try {
      setIsLoadingHistory(true);
      const response = await getRuntimeConfigHistory(key, { limit: 50 });
      setHistory(response.data.history);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast.error('Failed to load history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && key) {
      loadHistory();
    }
  }, [isAuthenticated, key]);

  // Validate value with interdependency checks
  const validateValue = (value: string): boolean => {
    if (!config) return false;

    setValidationError('');
    setValidationWarning('');

    if (!value.trim()) {
      setValidationError(t('admin.runtimeConfig.validation.required'));
      return false;
    }

    try {
      let parsedValue: any = value;

      switch (config.dataType) {
        case 'NUMBER': {
          const num = parseFloat(value);
          if (isNaN(num)) {
            setValidationError(t('admin.runtimeConfig.validation.mustBeNumber'));
            return false;
          }
          if (config.minValue !== null && num < config.minValue) {
            setValidationError(
              t('admin.runtimeConfig.validation.belowMin', { min: config.minValue })
            );
            return false;
          }
          if (config.maxValue !== null && num > config.maxValue) {
            setValidationError(
              t('admin.runtimeConfig.validation.aboveMax', { max: config.maxValue })
            );
            return false;
          }
          parsedValue = num;
          break;
        }
        case 'BOOLEAN': {
          if (value !== 'true' && value !== 'false') {
            setValidationError(t('admin.runtimeConfig.validation.mustBeBoolean'));
            return false;
          }
          break;
        }
        case 'JSON': {
          try {
            JSON.parse(value);
          } catch {
            setValidationError(t('admin.runtimeConfig.validation.invalidJson'));
            return false;
          }
          break;
        }
      }

      // Interdependency validation (weights, thresholds, business rules)
      if (config.dataType === 'NUMBER') {
        const validationResult = validateConfigChange(
          config.key,
          parsedValue,
          config.dataType,
          allConfigs
        );

        if (!validationResult.valid) {
          setValidationError(validationResult.error || 'Validation failed');
          return false;
        }

        if (validationResult.warning) {
          setValidationWarning(validationResult.warning);
        }
      }
    } catch {
      return false;
    }

    return true;
  };

  // Real-time validation on value change
  useEffect(() => {
    if (config && newValue) {
      validateValue(newValue);
    }
  }, [newValue, config, allConfigs]);

  // Handle save
  const handleSave = async () => {
    if (!config || !validateValue(newValue) || !canEdit) {
      if (!canEdit) {
        toast.error('You do not have permission to update this configuration');
      }
      return;
    }

    try {
      setIsSaving(true);

      let parsedValue: any = newValue;
      if (config.dataType === 'NUMBER') {
        parsedValue = parseFloat(newValue);
      } else if (config.dataType === 'BOOLEAN') {
        parsedValue = newValue === 'true';
      } else if (config.dataType === 'JSON') {
        parsedValue = JSON.parse(newValue);
      }

      await updateRuntimeConfig(key, {
        value: parsedValue,
        reason: reason.trim() || undefined,
      });

      toast.success(t('admin.runtimeConfig.edit.success'));

      // Reload config and history
      const response = await getRuntimeConfig(key);
      setConfig(response.data);
      setNewValue(
        typeof response.data.value === 'object'
          ? JSON.stringify(response.data.value, null, 2)
          : String(response.data.value)
      );
      setReason('');
      loadHistory();
    } catch (error) {
      console.error('Failed to update config:', error);
      toast.error(t('admin.runtimeConfig.edit.error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle rollback
  const handleRollback = async (historyId: string) => {
    if (!config || user?.role !== 'SUPER_ADMIN') {
      if (user?.role !== 'SUPER_ADMIN') {
        toast.error('Only SUPER_ADMIN can rollback configurations');
      }
      return;
    }

    if (!confirm(t('admin.runtimeConfig.history.rollbackConfirm'))) {
      return;
    }

    try {
      await rollbackRuntimeConfig(key, {
        historyId,
        reason: 'Rolled back via UI',
      });

      toast.success(t('admin.runtimeConfig.history.rollbackSuccess'));

      // Reload config and history
      const response = await getRuntimeConfig(key);
      setConfig(response.data);
      setNewValue(
        typeof response.data.value === 'object'
          ? JSON.stringify(response.data.value, null, 2)
          : String(response.data.value)
      );
      loadHistory();
    } catch (error) {
      console.error('Failed to rollback:', error);
      toast.error(t('admin.runtimeConfig.history.rollbackError'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  // Determine if user can edit based on access level and role
  const canEdit =
    config.accessLevel === 'CLIENT_ADMIN_READ_WRITE' &&
    (user?.role === 'SUPER_ADMIN' || user?.role === 'CLIENT_ADMIN')
      ? true
      : config.accessLevel === 'SUPER_ADMIN_READ_WRITE' && user?.role === 'SUPER_ADMIN'
      ? true
      : false;

  const isReadOnly =
    config.accessLevel === 'SUPER_ADMIN_READ_ONLY' ||
    config.accessLevel === 'CLIENT_ADMIN_READ_ONLY';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/admin/runtime-config')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold font-mono">{config.key}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{config.description}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-sm">
              {t(`admin.runtimeConfig.categories.${config.category}`)}
            </Badge>
            <Badge
              variant={
                config.accessLevel === 'CLIENT_ADMIN_READ_WRITE'
                  ? 'default'
                  : config.accessLevel === 'SUPER_ADMIN_READ_WRITE'
                  ? 'secondary'
                  : 'destructive'
              }
              className="text-sm"
            >
              {t(`admin.runtimeConfig.accessLevels.${config.accessLevel}`)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.runtimeConfig.edit.title')}</CardTitle>
          {!canEdit && (
            <Alert variant={isReadOnly ? 'destructive' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {isReadOnly
                  ? config.accessLevel === 'SUPER_ADMIN_READ_ONLY'
                    ? 'This configuration is read-only for security reasons. No one can edit it via UI.'
                    : 'This configuration is read-only.'
                  : config.accessLevel === 'SUPER_ADMIN_READ_WRITE'
                  ? 'Only SUPER_ADMIN can update this configuration. You have read-only access.'
                  : 'You do not have permission to update this configuration.'}
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current value */}
          <div>
            <Label>{t('admin.runtimeConfig.edit.currentValue')}</Label>
            <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded-md font-mono text-sm">
              {typeof config.value === 'object'
                ? JSON.stringify(config.value, null, 2)
                : String(config.value)}
            </div>
          </div>

          {/* New value */}
          <div>
            <Label htmlFor="newValue">{t('admin.runtimeConfig.edit.newValue')}</Label>
            {config.dataType === 'JSON' ? (
              <Textarea
                id="newValue"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="font-mono text-sm"
                rows={10}
                disabled={!canEdit}
              />
            ) : (
              <Input
                id="newValue"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="font-mono"
                disabled={!canEdit}
              />
            )}
            {validationError && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
            {validationWarning && !validationError && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{validationWarning}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Weight visualization */}
          {config.dataType === 'NUMBER' && isWeightField(config.key) && (
            <div>
              <Label>Weight Distribution</Label>
              <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                <WeightVisualization
                  currentKey={config.key}
                  newValue={parseFloat(newValue) || 0}
                  allWeights={allConfigs}
                />
              </div>
            </div>
          )}

          {/* Constraints */}
          <div>
            <Label>{t('admin.runtimeConfig.edit.constraints')}</Label>
            <div className="mt-1 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('admin.runtimeConfig.edit.default')}:
                </span>{' '}
                <span className="font-mono">
                  {typeof config.defaultValue === 'object'
                    ? JSON.stringify(config.defaultValue)
                    : String(config.defaultValue)}
                </span>
              </div>
              {config.minValue !== null && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('admin.runtimeConfig.edit.min')}:
                  </span>{' '}
                  <span className="font-mono">{config.minValue}</span>
                </div>
              )}
              {config.maxValue !== null && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('admin.runtimeConfig.edit.max')}:
                  </span>{' '}
                  <span className="font-mono">{config.maxValue}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reason */}
          {canEdit && (
            <div>
              <Label htmlFor="reason">{t('admin.runtimeConfig.edit.reason')}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('admin.runtimeConfig.edit.reasonPlaceholder')}
                rows={3}
              />
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving || !!validationError}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving
                  ? t('admin.runtimeConfig.edit.saving')
                  : t('admin.runtimeConfig.edit.save')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setNewValue(
                    typeof config.value === 'object'
                      ? JSON.stringify(config.value, null, 2)
                      : String(config.value)
                  )
                }
                disabled={isSaving}
              >
                {t('admin.runtimeConfig.edit.cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle>{t('admin.runtimeConfig.history.title')}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {t('admin.runtimeConfig.history.noHistory')}
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={item.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{item.changedBy}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {format(new Date(item.changedAt), 'yyyy-MM-dd HH:mm:ss')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            {t('admin.runtimeConfig.history.oldValue')}:
                          </span>
                          <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded font-mono text-xs">
                            {typeof item.oldValue === 'object'
                              ? JSON.stringify(item.oldValue, null, 2)
                              : String(item.oldValue)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            {t('admin.runtimeConfig.history.newValue')}:
                          </span>
                          <div className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded font-mono text-xs">
                            {typeof item.newValue === 'object'
                              ? JSON.stringify(item.newValue, null, 2)
                              : String(item.newValue)}
                          </div>
                        </div>
                      </div>

                      {item.reason && (
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            {t('admin.runtimeConfig.history.reason')}:
                          </span>{' '}
                          <span>{item.reason}</span>
                        </div>
                      )}
                    </div>

                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRollback(item.id)}
                        className="ml-4"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {t('admin.runtimeConfig.history.rollback')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
