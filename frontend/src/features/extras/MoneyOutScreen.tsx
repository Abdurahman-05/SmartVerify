import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { Banknote, CalendarDays, Landmark, Plus, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { getSpendings, spendingsKey, type Spending } from '@/lib/extras';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { AddSpendingSheet } from './AddSpendingSheet';
import { FeatureGate } from './FeatureGate';

function TotalBox({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  const brand = useBrandColors();
  return (
    <View
      className="flex-1 gap-1 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5"
      accessible
    >
      <View className="flex-row items-center gap-1.5">
        <Icon size={18} color={brand.primary} strokeWidth={2.2} />
        <Text font="bold" tone="muted" className="text-sm">
          {label}
        </Text>
      </View>
      <MoneyText value={value} font="bold" className="text-[17px]" />
    </View>
  );
}

function SpendingRow({ entry }: { entry: Spending }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3.5 py-2.5">
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base" numberOfLines={1}>
          {entry.title}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {[
            t(`extras.money.categories.${entry.category}`),
            t(entry.paidFrom === 'CASH' ? 'extras.cash' : 'extras.bank'),
            entry.createdBy,
            formatTime(entry.createdAt),
          ].join(' · ')}
        </Text>
      </View>
      <MoneyText value={entry.amount} font="bold" className="text-lg" />
    </View>
  );
}

function MoneyOut() {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const query = useQuery({ queryKey: spendingsKey, queryFn: getSpendings });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  if (query.isPending) return <LoadingView screenTitle={t('extras.money.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }
  const totals = query.data?.totals;

  const header = totals ? (
    <View className="gap-2 pb-3">
      <View className="rounded-[20px] bg-primary px-[18px] py-4" accessible>
        <Text font="semibold" tone="inverse" className="text-sm opacity-90">
          {t('extras.money.today')}
        </Text>
        <MoneyText value={totals.today} tone="inverse" className="mt-1 text-[34px]" />
      </View>
      <View className="flex-row gap-2">
        <TotalBox icon={Banknote} label={t('extras.cash')} value={totals.cash} />
        <TotalBox icon={Landmark} label={t('extras.bank')} value={totals.bank} />
        <TotalBox icon={CalendarDays} label={t('extras.money.week')} value={totals.week} />
      </View>
      <Text font="heading" className="pt-2 text-lg" accessibilityRole="header">
        {t('extras.money.entries')}
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader
        title={t('extras.money.title')}
        subtitle={t('extras.money.subtitle')}
        right={
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={t('extras.money.add')}
            className="h-11 flex-row items-center gap-1 rounded-[22px] bg-primary pl-3 pr-4 active:opacity-80"
          >
            <Plus size={20} color={colors.surface} strokeWidth={2.8} />
            <Text font="bold" tone="inverse" className="text-base">
              {t('extras.money.add')}
            </Text>
          </Pressable>
        }
      />
      <FlatList
        data={query.data?.entries ?? []}
        keyExtractor={(entry) => entry.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}
        renderItem={({ item }) => <SpendingRow entry={item} />}
        ListEmptyComponent={
          <Text tone="muted" className="px-6 pt-6 text-center text-lg">
            {query.isError ? t(errorMessageKey(query.error)) : t('extras.money.empty')}
          </Text>
        }
      />
      <AddSpendingSheet visible={adding} onClose={() => setAdding(false)} />
    </SafeAreaView>
  );
}

/** Manager (money out on): what was spent today and this week, and adding spending. */
export default function MoneyOutScreen() {
  return (
    <FeatureGate feature="featureMoneyOut">
      <MoneyOut />
    </FeatureGate>
  );
}
