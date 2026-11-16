import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AuthBackground } from '@/components/ui/AuthBackground';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { AuthCard, AuthLogo, AuthSubtitle, AuthTitle, SecureLine } from '@/features/auth/AuthParts';
import { errorMessageKey } from '@/lib/errors';
import { explorePlan } from '@/lib/subscription';
import { isNormalApp } from '@/lib/variant';
import { useSession, type Plan } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';
import { GlassCard, PrimaryButton } from '@/ui/glass';

import {
  normalPlan,
  normalPricing,
  normalQuarterlySavingEtb,
  restaurantMonthlyEtb,
  type BillingPeriod,
} from './plans';

const FIELD_BORDER = 'rgba(30,26,28,0.08)';

/** 22 px ring; the chosen one gets a 7 px ring in the theme colour. */
function Radio({ on, color }: { on: boolean; color: string }) {
  return (
    <View
      className="h-[22px] w-[22px] rounded-full"
      style={{ borderWidth: on ? 7 : 2, borderColor: on ? color : 'rgba(30,26,28,0.25)' }}
    />
  );
}

/** One of the two period chips (1 month / 3 months). */
function PeriodChip({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="h-11 flex-1 justify-center active:opacity-80"
    >
      <View
        className="h-10 items-center justify-center rounded-[20px] px-2"
        style={{
          backgroundColor: selected ? color : 'rgba(255,255,255,0.85)',
          borderWidth: selected ? 0 : 1.5,
          borderColor: FIELD_BORDER,
        }}
      >
        <Text
          font="bold"
          className="text-[15px]"
          style={{ color: selected ? '#FFFFFF' : '#1E1A1C' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

interface PlanRowProps {
  name: string;
  priceEtb: number;
  unit: string;
  selected: boolean;
  color: string;
  onPress: () => void;
  children: ReactNode;
}

/** One plan: radio, name and price, then one feature line indented under the name. */
function PlanRow({ name, priceEtb, unit, selected, color, onPress, children }: PlanRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="gap-1 rounded-[20px] px-3.5 py-2.5 active:opacity-80"
      style={{
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? color : FIELD_BORDER,
      }}
    >
      <View className="flex-row items-center gap-2.5">
        <Radio on={selected} color={color} />
        <Text font="bold" className="flex-1 text-base" numberOfLines={1}>
          {name}
        </Text>
        <Text font="heading" className="text-lg">
          <MoneyText value={priceEtb} showCurrency={false} className="text-lg" />{' '}
          <Text font="semibold" className="text-xs" style={{ color: '#5E5559' }}>
            {unit}
          </Text>
        </Text>
      </View>
      <View className="ml-8">{children}</View>
    </Pressable>
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
  const chosenPrice = chosen === 'restaurant' ? restaurantMonthlyEtb : normalPrice;
  const featureText = 'text-[13px] text-[#3E3539]';

  return (
    <AuthBackground>
      <FormScreen plain>
        <View className="absolute left-5 right-5 top-4 z-10 flex-row items-center justify-between">
          {router.canGoBack() ? (
            <GlassCard
              radius={22}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              className="h-11 w-11 items-center justify-center"
            >
              <ChevronLeft size={22} color={colors.text} strokeWidth={2.2} />
            </GlassCard>
          ) : (
            <View />
          )}
          <LanguageToggle />
        </View>
        {/* Design: assets/images/theme and subscription/plan-screen.png */}
        <View
          className="flex-1 items-center pb-6"
          style={{ paddingTop: 56, paddingHorizontal: 22 }}
        >
          <AuthLogo />
          <AuthTitle text={t('plan.chooseTitle')} accent={brand.primary} />
          <AuthSubtitle
            text={`${t('auth.step', { current: 3, total: 3 })} · ${t('plan.changeLater')}`}
          />
          <View className="mt-2.5 w-32 flex-row gap-1.5">
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                className="h-1.5 flex-1 rounded-[3px]"
                style={{ backgroundColor: brand.primary }}
              />
            ))}
          </View>

          <AuthCard>
            <View style={{ gap: 8 }}>
              <View className="flex-row gap-2" accessibilityRole="radiogroup">
                <PeriodChip
                  label={t('plan.oneMonth')}
                  selected={period === 'monthly'}
                  color={brand.primary}
                  onPress={() => setPeriod('monthly')}
                />
                <PeriodChip
                  label={`${t('plan.threeMonths')} −${formatMoney(normalQuarterlySavingEtb, false)}`}
                  selected={period === 'quarterly'}
                  color={brand.primary}
                  onPress={() => setPeriod('quarterly')}
                />
              </View>

              {isNormalApp ? null : (
                <PlanRow
                  name={t('plans.restaurant')}
                  priceEtb={restaurantMonthlyEtb}
                  unit={t('plan.perMonthShort')}
                  selected={chosen === 'restaurant'}
                  color={brand.primary}
                  onPress={() => setChosen('restaurant')}
                >
                  <View className="flex-row gap-2">
                    <Check
                      size={15}
                      color={brand.primary}
                      strokeWidth={3}
                      style={{ marginTop: 2 }}
                    />
                    <Text className={`flex-1 ${featureText}`}>{t('plan.restaurantLine')}</Text>
                  </View>
                </PlanRow>
              )}

              <PlanRow
                name={t(`plans.${normalPlan}`)}
                priceEtb={normalPrice}
                unit={
                  period === 'monthly'
                    ? t('plan.perMonthShort')
                    : `${t('common.etb')} / ${t('plan.threeMonths')}`
                }
                selected={chosen === normalPlan}
                color={brand.primary}
                onPress={() => setChosen(normalPlan)}
              >
                <Text className={featureText}>{t('plan.normalFeatures')}</Text>
              </PlanRow>

              <PrimaryButton
                accent
                gradient={[brand.primaryDeep, brand.primaryDeep]}
                label={t('plan.continuePrice', { price: formatMoney(chosenPrice, false) })}
                onPress={() => explore(chosen)}
              />
            </View>
          </AuthCard>

          <Pressable
            onPress={() => explore()}
            accessibilityRole="button"
            className="mt-3.5 min-h-11 justify-center active:opacity-70"
          >
            <View
              className="rounded-[14px] px-3 py-1"
              style={{ backgroundColor: 'rgba(255,255,255,0.75)' }}
            >
              <Text font="bold" className="text-base" style={{ color: brand.primaryText }}>
                {t('plan.exploreFirst')}
              </Text>
            </View>
          </Pressable>
          <SecureLine text={t('brand.secure')} style={{ marginTop: 6 }} />
        </View>

        <ErrorDialog
          visible={mutation.isError}
          title={t('subscription.errorTitle')}
          message={t(errorMessageKey(mutation.error))}
          actionLabel={t('errors.retry')}
          onClose={mutation.reset}
        />
      </FormScreen>
    </AuthBackground>
  );
}
