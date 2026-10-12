import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, CheckCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { periods, type Period } from '@/lib/period';
import { getTips, markTipsPaid, tipsKey } from '@/lib/tips';
import { colors } from '@/theme/tokens';

import type { Tip } from './types';

interface WaiterTips {
  waiterId: string;
  name: string;
  count: number;
  total: number;
  unpaidIds: string[];
}

function byWaiter(tips: Tip[]): WaiterTips[] {
  const groups = new Map<string, WaiterTips>();
  for (const tip of tips) {
    const g = groups.get(tip.waiterId) ?? {
      waiterId: tip.waiterId,
      name: tip.waiterName ?? '',
      count: 0,
      total: 0,
      unpaidIds: [],
    };
    g.count += 1;
    g.total += tip.amount;
    if (!tip.paidOut) g.unpaidIds.push(tip.id);
    groups.set(tip.waiterId, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

/** Owner / manager: tips per waiter, paid out at the end of the day (AdminTips design). */
export default function TipsAdminScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');

  const query = useQuery({ queryKey: tipsKey(period, 'all'), queryFn: () => getTips(period) });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const markPaid = useMutation({
    mutationFn: markTipsPaid,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tips'] }),
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/admin'));

  if (query.isPending) return <LoadingView screenTitle={t('tipsAdmin.title')} onBack={goBack} />;
  if (query.isError && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const groups = byWaiter(query.data ?? []);
  const unpaidIds = groups.flatMap((g) => g.unpaidIds);
  const toPay = (query.data ?? [])
    .filter((tip) => !tip.paidOut)
    .reduce((s, tip) => s + tip.amount, 0);
  const waitersToPay = groups.filter((g) => g.unpaidIds.length).length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('tipsAdmin.title')}
        subtitle={t('tipsAdmin.subtitle')}
        onBack={goBack}
      />

      <View className="flex-row gap-2 px-4 pb-2.5" accessibilityRole="radiogroup">
        {periods.map((p) => (
          <Pill
            key={p}
            label={t(`period.${p}`)}
            selected={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
      </View>

      <View className="mx-4 mb-2.5 rounded-[20px] bg-primary px-[18px] py-3.5" accessible>
        <Text font="semibold" tone="inverse" className="text-sm opacity-90">
          {t('tipsAdmin.toPayOut')} · {t('tipsAdmin.waiters', { count: waitersToPay })}
        </Text>
        <MoneyText value={toPay} tone="inverse" className="mt-1 text-[30px]" />
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.waiterId}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
              <Text font="bold" tone="inverse" className="text-xl">
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text font="bold" className="text-[17px]" numberOfLines={1}>
                {item.name}
              </Text>
              <Text tone="muted" className="text-sm">
                {t('tipsAdmin.tipCount', { count: item.count })}
              </Text>
            </View>
            <View className="items-end gap-1">
              <MoneyText value={item.total} font="bold" className="text-[17px]" />
              {item.unpaidIds.length ? (
                <Pressable
                  onPress={() => markPaid.mutate(item.unpaidIds)}
                  disabled={markPaid.isPending}
                  accessibilityRole="button"
                  className="min-h-11 justify-center rounded-[22px] bg-primary px-3.5 active:opacity-80"
                >
                  <Text font="bold" tone="inverse" className="text-sm">
                    {t('tipsAdmin.markPaid')}
                  </Text>
                </Pressable>
              ) : (
                <View className="flex-row items-center gap-1 rounded-[14px] bg-successBg py-[3px] pl-2 pr-2.5">
                  <Check size={14} color={colors.successFg} strokeWidth={2.6} />
                  <Text font="bold" className="text-sm" style={{ color: colors.successFg }}>
                    {t('tipsAdmin.paid')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text tone="muted" className="pt-8 text-center text-lg">
            {query.isError ? t(errorMessageKey(query.error)) : t('tipsAdmin.empty')}
          </Text>
        }
      />

      {unpaidIds.length ? (
        <View className="px-4 pb-6 pt-1">
          <Button
            label={t('tipsAdmin.markAllPaid')}
            icon={CheckCheck}
            disabled={markPaid.isPending}
            onPress={() => markPaid.mutate(unpaidIds)}
          />
        </View>
      ) : null}

      <ErrorDialog
        visible={markPaid.isError}
        title={t('tipsAdmin.failedTitle')}
        message={t(errorMessageKey(markPaid.error))}
        actionLabel={t('errors.retry')}
        onClose={markPaid.reset}
      />
    </SafeAreaView>
  );
}
