import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Keyboard, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { Input } from '@/components/ui/Input';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import {
  buyItemsKey,
  getBuyItems,
  markBought,
  spendingsKey,
  type BuyItem,
  type BuyStatus,
  type PaidFrom,
} from '@/lib/extras';
import { colors } from '@/theme/tokens';

import { FeatureGate } from './FeatureGate';

const MAX_PRICE_DIGITS = 7;

function BuyRow({ item, onPress }: { item: BuyItem; onPress?: () => void }) {
  const { t } = useTranslation();
  const open = item.status === 'OPEN';
  const detail = open
    ? [
        item.qty,
        t(item.when === 'TODAY' ? 'extras.finished.today' : 'extras.finished.week'),
        t('extras.buy.askedBy', { name: item.createdBy }),
      ]
    : [
        item.qty,
        t('extras.buy.boughtBy', { name: item.boughtBy ?? '' }),
        item.paidFrom ? t(item.paidFrom === 'CASH' ? 'extras.cash' : 'extras.bank') : null,
      ];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="min-h-16 flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface px-3.5 py-2.5 active:bg-background"
    >
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px]" numberOfLines={1}>
          {item.name}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={2}>
          {detail.filter(Boolean).join(' · ')}
        </Text>
      </View>
      {open ? (
        <ChevronRight size={22} color={colors.muted} strokeWidth={2.2} />
      ) : (
        <View className="items-end gap-0.5">
          {item.price !== null ? (
            <MoneyText value={item.price} font="bold" className="text-lg" />
          ) : null}
          <Check size={18} color={colors.successFg} strokeWidth={2.6} />
        </View>
      )}
    </Pressable>
  );
}

function BuyList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<BuyStatus>('OPEN');
  const [picked, setPicked] = useState<BuyItem | null>(null);
  const [price, setPrice] = useState('');
  const [paidFrom, setPaidFrom] = useState<PaidFrom>('CASH');
  const [priceError, setPriceError] = useState(false);

  const query = useQuery({
    queryKey: [...buyItemsKey, status],
    queryFn: () => getBuyItems(status),
  });
  const openCount = useQuery({
    queryKey: [...buyItemsKey, 'OPEN'],
    queryFn: () => getBuyItems('OPEN'),
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const bought = useMutation({
    mutationFn: (input: { id: string; price: number; paidFrom: PaidFrom }) =>
      markBought(input.id, { price: input.price, paidFrom: input.paidFrom }),
    onSuccess: () => setPicked(null),
    onSettled: () => {
      // A new spending may have been added too.
      void queryClient.invalidateQueries({ queryKey: buyItemsKey });
      void queryClient.invalidateQueries({ queryKey: spendingsKey });
    },
  });

  const open = (item: BuyItem) => {
    setPrice('');
    setPaidFrom('CASH');
    setPriceError(false);
    setPicked(item);
  };
  const save = () => {
    Keyboard.dismiss();
    if (!picked) return;
    if (Number(price) < 1) {
      setPriceError(true);
      return;
    }
    bought.mutate({ id: picked.id, price: Number(price), paidFrom });
  };

  if (query.isPending) return <LoadingView screenTitle={t('extras.buy.title')} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader title={t('extras.buy.title')} subtitle={t('extras.buy.subtitle')} />
      <View className="flex-row gap-2 px-4 pb-2.5" accessibilityRole="radiogroup">
        <Pill
          label={`${t('extras.buy.toBuy')} (${openCount.data?.length ?? 0})`}
          selected={status === 'OPEN'}
          onPress={() => setStatus('OPEN')}
        />
        <Pill
          label={t('extras.buy.bought')}
          selected={status === 'BOUGHT'}
          onPress={() => setStatus('BOUGHT')}
        />
      </View>

      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <BuyRow item={item} onPress={item.status === 'OPEN' ? () => open(item) : undefined} />
        )}
        ListEmptyComponent={
          <Text tone="muted" className="px-6 pt-10 text-center text-lg">
            {query.isError
              ? t(errorMessageKey(query.error))
              : t(status === 'OPEN' ? 'extras.buy.emptyOpen' : 'extras.buy.emptyBought')}
          </Text>
        }
      />

      <BottomSheet visible={Boolean(picked)} onClose={() => setPicked(null)}>
        <Text font="heading" className="text-[26px]" accessibilityRole="header">
          {t('extras.buy.sheetTitle')}
        </Text>
        <Text tone="muted" className="text-base">
          {[picked?.name, picked?.qty].filter(Boolean).join(' · ')}
        </Text>
        <Input
          label={t('extras.buy.price')}
          placeholder="0"
          value={price}
          onChangeText={(text) => {
            setPrice(digitsOnly(text, MAX_PRICE_DIGITS));
            setPriceError(false);
          }}
          keyboardType="number-pad"
          maxLength={MAX_PRICE_DIGITS}
          error={priceError ? t('extras.errors.amount') : undefined}
        />
        <View className="flex-row gap-2" accessibilityRole="radiogroup">
          <Pill
            label={t('extras.buy.paidCash')}
            selected={paidFrom === 'CASH'}
            dark
            onPress={() => setPaidFrom('CASH')}
          />
          <Pill
            label={t('extras.buy.paidBank')}
            selected={paidFrom === 'BANK'}
            dark
            onPress={() => setPaidFrom('BANK')}
          />
        </View>
        <Button
          label={t('extras.buy.markBought')}
          icon={Check}
          disabled={bought.isPending}
          onPress={save}
        />
        <Button
          label={t('common.cancel')}
          variant="outline"
          size="md"
          onPress={() => setPicked(null)}
        />
      </BottomSheet>

      <ErrorDialog
        visible={bought.isError}
        title={t('extras.buy.failedTitle')}
        message={t(errorMessageKey(bought.error))}
        actionLabel={t('errors.retry')}
        onClose={bought.reset}
      />
    </SafeAreaView>
  );
}

/** Manager (buy list on): what the kitchen needs, and marking it bought. */
export default function BuyListScreen() {
  return (
    <FeatureGate feature="featureBuyList">
      <BuyList />
    </FeatureGate>
  );
}
