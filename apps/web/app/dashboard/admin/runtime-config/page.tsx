'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/lib/i18n/provider';
import { getRuntimeConfigs, type RuntimeConfig } from '@/lib/api/runtime-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Settings, ChevronRight } from 'lucide-react';

export default function RuntimeConfigPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();

  const [configs, setConfigs] = useState<RuntimeConfig[]>([]);
  const [groupedConfigs, setGroupedConfigs] = useState<Record<string, RuntimeConfig[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Check authorization (SUPER_ADMIN or CLIENT_ADMIN only)
  useEffect(() => {
    if (isAuthenticated && user && user.role !== 'SUPER_ADMIN' && user.role !== 'CLIENT_ADMIN') {
      toast.error('Access denied. Admin privileges required.');
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  // Load runtime configurations
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadConfigs = async () => {
      try {
        setIsLoading(true);
        const response = await getRuntimeConfigs();
        setConfigs(response.data.configs);
        setGroupedConfigs(response.data.groupedByCategory);
      } catch (error) {
        console.error('Failed to load runtime configs:', error);
        toast.error('Failed to load configurations');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfigs();
  }, [isAuthenticated]);

  // Filter configs by search and category
  const filteredConfigs = configs.filter((config) => {
    const matchesSearch =
      searchQuery === '' ||
      config.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || config.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(configs.map((c) => c.category)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-3xl font-bold">{t('admin.runtimeConfig.title')}</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('admin.runtimeConfig.description')}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('admin.runtimeConfig.list.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue placeholder={t('admin.runtimeConfig.list.filterByCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('admin.runtimeConfig.list.allCategories')}
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {t(`admin.runtimeConfig.categories.${category}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t('admin.runtimeConfig.list.totalConfigs', { count: filteredConfigs.length })}
          </div>
        </CardContent>
      </Card>

      {/* Config list */}
      {filteredConfigs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">{t('admin.runtimeConfig.list.noResults')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredConfigs.map((config) => (
            <Card
              key={config.key}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/admin/runtime-config/${config.key}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{config.key}</CardTitle>
                    <CardDescription className="mt-1">
                      {config.description}
                    </CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Category badge */}
                  <div>
                    <Badge variant="outline">
                      {t(`admin.runtimeConfig.categories.${config.category}`)}
                    </Badge>
                  </div>

                  {/* Value */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('admin.runtimeConfig.card.value')}:
                    </span>
                    <span className="font-mono font-semibold">
                      {typeof config.value === 'object'
                        ? JSON.stringify(config.value)
                        : String(config.value)}
                    </span>
                  </div>

                  {/* Data type */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('admin.runtimeConfig.card.dataType')}:
                    </span>
                    <Badge variant="secondary">
                      {t(`admin.runtimeConfig.dataTypes.${config.dataType}`)}
                    </Badge>
                  </div>

                  {/* Range (if applicable) */}
                  {config.dataType === 'NUMBER' &&
                    (config.minValue !== null || config.maxValue !== null) && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('admin.runtimeConfig.card.range')}:
                        </span>
                        <span className="text-gray-500">
                          {config.minValue ?? '∞'} - {config.maxValue ?? '∞'}
                        </span>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
