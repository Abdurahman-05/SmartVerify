import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { Text } from '@/components/ui/Text';
import { errorMessageKey } from '@/lib/errors';
import { explorePlan } from '@/lib/subscription';
import { useBrandColors } from '@/store/theme';
import { isNormalApp } from '@/lib/variant';
import { useSession, type Plan } from '@/store/session';

import {
  normalPlan,
  normalPricing,
  normalQuarterlySavingEtb,
  restaurantFeatureKeys,
  restaurantMonthlyEtb,
  type BillingPeriod,
} from './plans';
import { Pill } from '@/features/orders/Pill';
import { GlassCard, PrimaryButton, ScreenBg } from '@/ui/glass';

/** Design `.rd`: 24 px ring; the chosen one gets a thick brand ring. */
function Radio({ on }: { on: boolean }) {
  return (
    <View
      className={`h-6 w-6 rounded-full ${on ? 'border-[7px] border-primary' : 'border-2 border-borderStrong'}`}
    />
  );
}

interface PlanCardProps {
  name: string;
  priceEtb: number;
  unit: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}

/** One plan to pick (design `.g.pl`): radio, name and price, then details indented under it. */
function PlanCard({ name, priceEtb, unit, selected, onPress, children }: PlanCardProps) {
  return (
    <GlassCard
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`gap-1.5 px-4 py-3.5 ${selected ? 'border-2 border-primary' : ''}`}
    >
      <View className="flex-row items-center gap-2.5">
        <Radio on={selected} />
        <Text font="bold" className="flex-1 text-[17px]">
          {name}
        </Text>
        <Text font="heading" className="text-xl">
          <MoneyText value={priceEtb} showCurrency={false} className="text-xl" />{' '}
          <Text font="semibold" tone="muted" className="text-[13px]">
            {unit}
          </Text>
        </Text>
      </View>
      <View className="ml-[34px] gap-1">{children}</View>
    </GlassCard>
  );
}

export default function ChoosePlanScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const setPlan = useSession((s) => s.setPlan);
  const [period, setPeriod] = useState<BillingPeriod>('quarterly');
  const [chosen, setChosen] = useState<Plan>(isNormalApp ? normalPlan : 'restaurant');

  // The plan is saved on the server first, so it survives a restart and staff get it too.
  const mutation = useMutation({
    mutationFn: explorePlan,
    onSuccess: (_result, plan) => {
      setPlan(plan);
      router.dismissTo('/home');
    },
  });

  const explore = (plan?: Plan) => {
    if (plan) mutation.mutate(plan);
    else router.dismissTo('/home');
  };

  if (mutation.isPending) return <LoadingView />;

  const normalPrice = normalPricing[period].priceEtb;

  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, gap: 12, padding: 16, paddingTop: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text font="heading" className="text-2xl leading-[29px]" accessibilityRole="header">
              {t('plan.title')}
            </Text>
            <Text tone="muted" className="text-sm">
              {t('auth.step', { current: 3, total: 3 })} · {t('plan.subtitle')}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            <Pill
              label={t('plan.oneMonth')}
              selected={period === 'monthly'}
              onPress={() => setPeriod('monthly')}
            />
            <Pill
              label={`${t('plan.threeMonths')} · ${t('plan.save', {
                amount: formatMoney(normalQuarterlySavingEtb, false),
              })}`}
              selected={period === 'quarterly'}
              onPress={() => setPeriod('quarterly')}
            />
          </View>

          {isNormalApp ? null : (
            <PlanCard
              name={t('plans.restaurant')}
              priceEtb={restaurantMonthlyEtb}
              unit={t('plan.perMonthShort')}
              selected={chosen === 'restaurant'}
              onPress={() => setChosen('restaurant')}
            >
              <View className="h-6 justify-center self-start rounded-[12px] bg-amber px-[9px]">
                <Text font="bold" className="text-[13px]">
                  {t('plan.bestForRestaurants')}
                </Text>
              </View>
              <View className="gap-1">
                {restaurantFeatureKeys.map((key) => (
                  <View key={key} className="flex-row items-center gap-2">
                    <Check size={16} color={brand.primaryText} strokeWidth={3} />
                    <Text className="flex-1 text-sm text-[#3E3539]">
                      {t(`plan.features.${key}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </PlanCard>
          )}

          <PlanCard
            name={t(`plans.${normalPlan}`)}
            priceEtb={normalPrice}
            unit={
              period === 'monthly'
                ? t('plan.perMonth')
                : `${t('common.etb')} / ${t('plan.threeMonths')}`
            }
            selected={chosen === normalPlan}
            onPress={() => setChosen(normalPlan)}
          >
            <Text className="text-sm text-[#3E3539]">{t('plan.normalFeatures')}</Text>
          </PlanCard>

          <View className="min-h-4 flex-1" />

          <PrimaryButton
            label={chosen === 'restaurant' ? t('plan.exploreRestaurant') : t('plan.exploreNormal')}
            onPress={() => explore(chosen)}
          />
          <Pressable
            onPress={() => explore()}
            accessibilityRole="button"
            className="min-h-11 items-center justify-center active:opacity-70"
          >
            <Text font="bold" tone="link" className="text-[15px]">
              {t('plan.exploreFirst')}
            </Text>
          </Pressable>
          <Text tone="muted" className="-mt-2 text-center text-[13px]">
            {t('plan.noPayment')}
          </Text>
        </ScrollView>

        <ErrorDialog
          visible={mutation.isError}
          title={t('subscription.errorTitle')}
          message={t(errorMessageKey(mutation.error))}
          actionLabel={t('errors.retry')}
          onClose={mutation.reset}
        />
      </SafeAreaView>
    </ScreenBg>
  );
}
