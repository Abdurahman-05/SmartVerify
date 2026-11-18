import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Banknote, Check, ChevronLeft, Landmark, ShoppingBasket } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Keyboard, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoicePill } from '@/components/ui/ChoicePill';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { IconTile } from '@/components/ui/IconTile';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { TopBar } from '@/components/ui/TopBar';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { toastIfNetworkError } from '@/store/toast';
import { digitsOnly, formatTime } from '@/lib/format';
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

// Design: docs/design/owner/screens/06-buy-list.png
const MAX_PRICE_DIGITS = 7;

function BuyRow({
  item,
  onPress,
  expanded,
  children,
}: {
  item: BuyItem;
  onPress?: () => void;
  expanded?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const g = useGlass();
  const open = item.status === 'OPEN';
  const title = [item.name, item.qty].filter(Boolean).join(' · ');
  const time = formatTime(open ? item.createdAt : (item.boughtAt ?? item.createdAt));
  const detail = open
    ? [item.createdBy, time]
    : [
        t('extras.buy.boughtBy', { name: item.boughtBy ?? '' }),
        item.paidFrom ? t(item.paidFrom === 'CASH' ? 'extras.cash' : 'extras.bank') : null,
        time,
      ];
  const today = item.when === 'TODAY';
  return (
    <GlassCard highlight={expanded ? g.primary2 : undefined} style={{ padding: 14 }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <IconTile icon={ShoppingBasket} />
        <View className="min-w-0 flex-1">
          <Text font="bold" className="text-[16px] leading-[21px]" numberOfLines={2}>
            {title}
          </Text>
          <Text tone="muted" className="text-sm" numberOfLines={1}>
            {detail.filter(Boolean).join(' · ')}
          </Text>
        </View>
        {open ? (
          <>
            <View
              className="h-7 justify-center rounded-[14px] px-2.5"
              style={{ backgroundColor: today ? colors.warnBg : 'rgba(30,26,28,0.07)' }}
            >
              <Text
                font="bold"
                className="text-[13px]"
                style={{ color: today ? colors.warnFg : colors.muted }}
              >
                {t(today ? 'extras.finished.today' : 'extras.finished.week')}
              </Text>
            </View>
            {expanded ? null : (
              <View
                className="h-[26px] w-[26px] rounded-full border-2"
                style={{ borderColor: 'rgba(30,26,28,0.22)' }}
              />
            )}
          </>
        ) : (
          <>
            {item.price !== null ? (
              <MoneyText
                value={item.price}
                showCurrency={false}
                font="heading"
                className="text-[16px]"
              />
            ) : null}
            <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-successBg">
              <Check size={15} color={colors.successFg} strokeWidth={3} />
            </View>
          </>
        )}
      </Pressable>
      {children}
    </GlassCard>
  );
}

function BuyList() {
  const { t } = useTranslation();
  const router = useRouter();
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
    onError: toastIfNetworkError,
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

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/home'));

  if (query.isPending) {
    return <LoadingView screenTitle={t('extras.buy.title')} onBack={goBack} />;
  }
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const toBuy = openCount.data?.length ?? 0;

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('extras.buy.title')}
            subtitle={t('extras.buy.subtitleCount', { count: toBuy })}
            left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
          />
        </View>
        <View className="px-4 pb-3">
          <Segmented<BuyStatus>
            options={[
              { value: 'OPEN', label: `${t('extras.buy.toBuy')} · ${toBuy}` },
              {
                value: 'BOUGHT',
                label:
                  status === 'BOUGHT'
                    ? `${t('extras.buy.bought')} · ${query.data?.length ?? 0}`
                    : t('extras.buy.bought'),
              },
            ]}
            value={status}
            onChange={(next) => {
              setPicked(null);
              setStatus(next);
            }}
          />
        </View>

        <FlatList
          data={query.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const expanded = picked?.id === item.id;
            return (
              <BuyRow
                item={item}
                expanded={expanded}
                onPress={
                  item.status === 'OPEN'
                    ? () => (expanded ? setPicked(null) : open(item))
                    : undefined
                }
              >
                {expanded ? (
                  <View className="gap-3 pt-3.5">
                    <Text
                      font="bold"
                      className="text-[13px] uppercase"
                      style={{ color: colors.muted }}
                    >
                      {t('extras.buy.pricePaid')}
                    </Text>
                    <View
                      className="h-14 flex-row items-center gap-2.5 rounded-[28px] px-5"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.85)',
                        borderWidth: priceError ? 2 : 1,
                        borderColor: priceError ? colors.dangerFg : 'rgba(255,255,255,0.95)',
                      }}
                    >
                      <TextInput
                        accessibilityLabel={t('extras.buy.price')}
                        placeholder="0"
                        placeholderTextColor={colors.placeholder}
                        value={price ? formatMoney(Number(price), false) : ''}
                        onChangeText={(text) => {
                          setPrice(digitsOnly(text, MAX_PRICE_DIGITS));
                          setPriceError(false);
                        }}
                        keyboardType="number-pad"
                        autoFocus
                        className="h-full flex-1 font-heading text-[26px] text-text"
                      />
                      <Text font="bold" tone="muted" className="text-base">
                        {t('common.etb')}
                      </Text>
                    </View>
                    {priceError ? (
                      <Text font="semibold" className="text-[15px] text-dangerFg">
                        {t('extras.errors.amount')}
                      </Text>
                    ) : null}
                    <View className="flex-row gap-2" accessibilityRole="radiogroup">
                      <ChoicePill
                        icon={Banknote}
                        label={t('extras.cash')}
                        selected={paidFrom === 'CASH'}
                        onPress={() => setPaidFrom('CASH')}
                      />
                      <ChoicePill
                        icon={Landmark}
                        label={t('extras.bank')}
                        selected={paidFrom === 'BANK'}
                        onPress={() => setPaidFrom('BANK')}
                      />
                    </View>
                    <PrimaryButton
                      label={t('extras.buy.markBought')}
                      icon={Check}
                      loading={bought.isPending}
                      onPress={save}
                    />
                  </View>
                ) : null}
              </BuyRow>
            );
          }}
          ListEmptyComponent={
            <Text tone="muted" className="px-6 pt-10 text-center text-lg">
              {query.isError
                ? t(errorMessageKey(query.error))
                : t(status === 'OPEN' ? 'extras.buy.emptyOpen' : 'extras.buy.emptyBought')}
            </Text>
          }
        />

        <ErrorDialog
          visible={bought.isError && !isNetworkError(bought.error)}
          title={t('extras.buy.failedTitle')}
          message={t(errorMessageKey(bought.error))}
          actionLabel={t('errors.retry')}
          onClose={bought.reset}
        />
      </SafeAreaView>
    </ScreenBackground>
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
