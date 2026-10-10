import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { LoadingView } from '@/components/ui/LoadingView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { startSubscription } from '@/lib/mock/subscription';
import { useSession, type BillingPeriod, type Plan, type SessionUser } from '@/store/session';
import { colors } from '@/theme/tokens';

import {
  normalPricing,
  normalQuarterlySavingEtb,
  restaurantFeatureKeys,
  restaurantMonthlyEtb,
} from './plans';

function ChooseButton({
  label,
  filled,
  disabled,
  accessibilityLabel,
  onPress,
  className = '',
}: {
  label: string;
  filled: boolean;
  disabled: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      className={`h-11 items-center justify-center rounded-[14px] ${
        disabled
          ? 'bg-neutralBg'
          : filled
            ? 'bg-primary active:opacity-80'
            : 'border-2 border-text bg-surface active:bg-background'
      } ${className}`}
    >
      <Text font="bold" tone={filled && !disabled ? 'inverse' : 'default'} className="text-base">
        {label}
      </Text>
    </Pressable>
  );
}

function CurrentPlanCard({ user, onChangePlan }: { user: SessionUser; onChangePlan: () => void }) {
  const { t } = useTranslation();
  const active = user.subscription !== null;
  const name = user.plan ? t(`plans.${user.plan}`) : t('subscription.noPlan');

  return (
    <View className="mx-4 mt-1 flex-row items-center gap-2.5 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5">
      <View className="flex-1">
        <Text font="bold" className="text-[17px]">
          {name}
        </Text>
        <View className="mt-[3px] flex-row flex-wrap items-center gap-2">
          <Text tone="muted" className="text-sm">
            {t('subscription.yourPlan')}
          </Text>
          <View
            className={`flex-row items-center gap-1 rounded-[14px] py-[3px] pl-2 pr-2.5 ${active ? 'bg-successBg' : 'bg-warnBg'}`}
          >
            {active ? (
              <Check size={14} color={colors.successFg} strokeWidth={2.6} />
            ) : (
              <Clock size={14} color={colors.warnFg} strokeWidth={2.6} />
            )}
            <Text font="bold" className={`text-sm ${active ? 'text-successFg' : 'text-warnFg'}`}>
              {active ? t('subscription.active') : t('subscription.notStarted')}
            </Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={onChangePlan}
        accessibilityRole="button"
        className="h-11 justify-center rounded-[22px] border-2 border-borderStrong bg-surface px-4 active:bg-background"
      >
        <Text font="bold" tone="link" className="text-[15px]">
          {t('subscription.changePlan')}
        </Text>
      </Pressable>
    </View>
  );
}

function NormalOption({
  period,
  current,
  onChoose,
}: {
  period: BillingPeriod;
  current: boolean;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const recommended = period === 'quarterly';
  const { priceEtb } = normalPricing[period];
  const length = recommended ? t('subscription.threeMonths') : t('subscription.oneMonth');

  return (
    <View
      className={`relative flex-1 rounded-input px-3 py-2.5 ${
        recommended
          ? 'border-[2.5px] border-primary bg-primarySoft'
          : 'border-2 border-borderMid bg-surface'
      }`}
    >
      {recommended ? (
        <View className="absolute -top-3 right-2.5 rounded-xl bg-amber px-2.5 py-0.5">
          <Text font="bold" className="text-sm">
            {t('plan.bestValue')}
          </Text>
        </View>
      ) : null}
      <Text font="bold" tone="muted" className="text-sm">
        {length}
      </Text>
      <Text font="heading" className="text-[22px]">
        <MoneyText value={priceEtb} showCurrency={false} className="text-[22px]" />{' '}
        <Text font="heading" className="text-sm">
          {t('common.etb')}
        </Text>
      </Text>
      <Text font="bold" tone="link" className="min-h-[18px] text-sm">
        {recommended
          ? t('plan.save', { amount: formatMoney(normalQuarterlySavingEtb, false) })
          : ''}
      </Text>
      <ChooseButton
        className="mt-2"
        label={current ? t('subscription.current') : t('subscription.choose')}
        filled={recommended}
        disabled={current}
        accessibilityLabel={t('subscription.chooseLabel', {
          plan: t('plans.normal'),
          length,
          price: formatMoney(priceEtb, false),
        })}
        onPress={onChoose}
      />
    </View>
  );
}

export default function SubscriptionScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const setSubscription = useSession((s) => s.setSubscription);
  const scrollRef = useRef<ScrollView>(null);
  const [plansY, setPlansY] = useState(0);

  const mutation = useMutation({
    mutationFn: ({ plan, period }: { plan: Plan; period: BillingPeriod }) =>
      startSubscription(plan, period),
    onSuccess: (subscription) => {
      setSubscription(subscription);
      router.replace('/subscription-started');
    },
  });

  if (mutation.isPending) {
    return (
      <LoadingView
        title={t('subscription.starting')}
        subtitle={t('subscription.startingSubtitle')}
      />
    );
  }

  const current = user?.subscription ?? null;
  const isCurrent = (plan: Plan, period: BillingPeriod) =>
    current?.plan === plan && (plan === 'restaurant' || current.period === period);
  const choose = (plan: Plan, period: BillingPeriod) => mutation.mutate({ plan, period });
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('subscription.title')}
        subtitle={t('subscription.subtitle')}
        onBack={goBack}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {user ? (
          <CurrentPlanCard
            user={user}
            onChangePlan={() => scrollRef.current?.scrollTo({ y: plansY, animated: true })}
          />
        ) : null}

        <View onLayout={(e) => setPlansY(e.nativeEvent.layout.y)}>
          <View className="mx-4 mt-3 rounded-card border-[1.5px] border-border bg-surface p-3.5">
            <View className="flex-row items-center justify-between">
              <Text font="heading" className="text-xl">
                {t('plans.normal')}
              </Text>
              <View className="rounded-xl bg-neutralBg px-2.5 py-[3px]">
                <Text font="bold" tone="muted" className="text-sm">
                  {t('subscription.popular')}
                </Text>
              </View>
            </View>
            <Text tone="muted" className="mt-0.5 text-[15px]">
              {t('plan.normalFeatures')}
            </Text>
            <View className="mt-4 flex-row gap-2.5">
              {(['monthly', 'quarterly'] as const).map((period) => (
                <NormalOption
                  key={period}
                  period={period}
                  current={isCurrent('normal', period)}
                  onChoose={() => choose('normal', period)}
                />
              ))}
            </View>
          </View>

          <View className="mx-4 mt-3 rounded-card border-[2.5px] border-primary bg-surface p-3.5">
            <View className="flex-row items-center justify-between">
              <Text font="heading" className="text-xl">
                {t('plans.restaurant')}
              </Text>
              <View className="rounded-xl bg-primary px-2.5 py-[3px]">
                <Text font="bold" tone="inverse" className="text-sm">
                  {t('subscription.pro')}
                </Text>
              </View>
            </View>
            <Text tone="muted" className="mt-0.5 text-[15px]">
              {t('subscription.restaurantSubtitle')}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-y-2">
              {restaurantFeatureKeys.map((key) => (
                <View key={key} className="w-1/2 flex-row items-center gap-1.5 pr-2">
                  <Check size={18} color={brand.primaryText} strokeWidth={3} />
                  <Text font="semibold" className="flex-1 text-[15px]">
                    {t(`plan.features.${key}`)}
                  </Text>
                </View>
              ))}
            </View>
            <View className="mt-3.5 flex-row items-center justify-between gap-3">
              <View>
                <Text font="semibold" tone="muted" className="text-sm">
                  {t('subscription.totalPrice')}
                </Text>
                <Text font="heading" className="text-2xl">
                  <MoneyText value={restaurantMonthlyEtb} showCurrency={false} />{' '}
                  <Text font="heading" className="text-sm">
                    {t('plan.perMonth')}
                  </Text>
                </Text>
              </View>
              <Pressable
                onPress={() => choose('restaurant', 'monthly')}
                disabled={isCurrent('restaurant', 'monthly')}
                accessibilityRole="button"
                accessibilityLabel={t('subscription.chooseLabel', {
                  plan: t('plans.restaurant'),
                  length: t('subscription.oneMonth'),
                  price: formatMoney(restaurantMonthlyEtb, false),
                })}
                accessibilityState={{ disabled: isCurrent('restaurant', 'monthly') }}
                className={`h-[52px] justify-center rounded-input px-8 ${
                  isCurrent('restaurant', 'monthly')
                    ? 'bg-neutralBg'
                    : 'bg-primary active:opacity-80'
                }`}
              >
                <Text
                  font="bold"
                  tone={isCurrent('restaurant', 'monthly') ? 'default' : 'inverse'}
                  className="text-lg"
                >
                  {isCurrent('restaurant', 'monthly')
                    ? t('subscription.current')
                    : t('subscription.choose')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {mutation.isError ? (
          <Text font="semibold" className="px-4 pt-3 text-center text-base text-dangerFg">
            {t('subscription.error')}
          </Text>
        ) : null}

        <Text font="semibold" tone="muted" className="px-4 pt-3 text-center text-sm">
          {t('subscription.footer')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
