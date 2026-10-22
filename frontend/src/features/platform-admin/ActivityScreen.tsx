import { useInfiniteQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { downloadCsv, getActivity, type ActivityCategory } from '@/lib/admin';
import { isNetworkError } from '@/lib/errors';

import { AdminShell } from './AdminShell';
import { ActionButton, PageTitle } from './ui';
import { ActivityRow } from './ActivityRow';

const TABS: (ActivityCategory | 'all')[] = [
  'all',
  'money',
  'customers',
  'rules',
  'sign_in',
  'private_data',
];

/** Every admin action and sign-in, newest first. Read-only. */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ActivityCategory | 'all'>('all');
  const category = tab === 'all' ? undefined : tab;

  const query = useInfiniteQuery({
    queryKey: ['admin-activity', tab],
    queryFn: ({ pageParam }) => getActivity({ category, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <AdminShell>
      <PageTitle
        title={t('platformAdmin.activity.title')}
        subtitle={t('platformAdmin.activity.subtitle')}
        right={
          <ActionButton
            label={t('platformAdmin.activityExtra.export')}
            icon={Download}
            onPress={() => void downloadCsv('activity')}
          />
        }
      />

      <View className="flex-row flex-wrap gap-2.5" accessibilityRole="tablist">
        {TABS.map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            className={`h-11 justify-center rounded-[22px] border-2 px-4 ${
              tab === key ? 'border-primary bg-primary' : 'border-border bg-surface'
            }`}
          >
            <Text
              font="semibold"
              tone={tab === key ? 'inverse' : 'default'}
              className="text-[15px]"
            >
              {key === 'all'
                ? t('platformAdmin.activity.all')
                : t(`platformAdmin.categories.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {query.isError && !query.data && isNetworkError(query.error) ? (
        <NoConnection onRetry={() => void refetch()} />
      ) : (
        <View className="rounded-[20px] border-[1.5px] border-border bg-surface px-5 py-3">
          <View className="flex-row flex-wrap gap-x-4 pb-2">
            {(['when', 'who', 'what', 'customer'] as const).map((h) => (
              <Text
                key={h}
                font="bold"
                tone="muted"
                className={`text-sm uppercase ${
                  h === 'when'
                    ? 'w-[130px]'
                    : h === 'who'
                      ? 'w-[150px]'
                      : h === 'what'
                        ? 'min-w-[220px] flex-1'
                        : 'w-[160px]'
                }`}
              >
                {t(`platformAdmin.activity.${h}`)}
              </Text>
            ))}
          </View>
          {query.isPending ? (
            <View className="items-center py-8">
              <SmallSpinner />
            </View>
          ) : items.length === 0 ? (
            <Text tone="muted" className="border-t-[1.5px] border-divider py-6 text-base">
              {t('platformAdmin.activity.empty')}
            </Text>
          ) : (
            items.map((item) => <ActivityRow key={item.id} item={item} />)
          )}
        </View>
      )}

      {items.length > 0 ? (
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text tone="muted" className="text-sm">
            {t('platformAdmin.activity.showing', { shown: items.length, total })}
          </Text>
          {query.hasNextPage ? (
            <View className="w-[200px]">
              <Button
                label={t('platformAdmin.activity.more')}
                variant="outline"
                size="md"
                disabled={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </AdminShell>
  );
}
