import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { useSession, type Plan } from '@/store/session';

import {
  normalPricing,
  normalQuarterlySavingEtb,
  restaurantFeatureKeys,
  restaurantMonthlyEtb,
  type BillingPeriod,
} from './plans';

interface PeriodOptionProps {
  label: string;
  priceEtb: number;
  note: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}

function PeriodOption({ label, priceEtb, note, badge, selected, onPress }: PeriodOptionProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`relative flex-1 rounded-input px-3 py-2.5 ${
        selected
          ? 'border-[2.5px] border-primary bg-primarySoft'
          : 'border-2 border-borderMid bg-surface'
      }`}
    >
      {badge ? (
        <View className="absolute -top-3 right-2.5 rounded-xl bg-amber px-2.5 py-0.5">
          <Text font="bold" className="text-sm">
            {badge}
          </Text>
        </View>
      ) : null}
      <Text font="bold" tone="muted" className="text-sm">
        {label}
      </Text>
      <Text font="heading" className="text-[22px]">
        <MoneyText value={priceEtb} showCurrency={false} className="text-[22px]" />{' '}
        <Text font="heading" className="text-sm">
          {t('common.etb')}
        </Text>
      </Text>
      <Text font="bold" tone="link" className="text-sm">
        {note}
      </Text>
    </Pressable>
  );
}

export default function ChoosePlanScreen() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const router = useRouter();
  const setPlan = useSession((s) => s.setPlan);
  const [period, setPeriod] = useState<BillingPeriod>('quarterly');

  const explore = (plan?: Plan) => {
    if (plan) setPlan(plan);
    router.dismissTo('/home');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="items-center gap-1.5 px-5 pb-1.5 pt-5">
          <BrandMark size={46} />
          <Text font="heading" className="text-center text-[27px]" accessibilityRole="header">
            {t('plan.title')}
          </Text>
          <Text tone="muted" className="text-center text-base">
            {t('plan.subtitle')}
          </Text>
        </View>

        <View className="mx-4 mt-2 rounded-card border-[1.5px] border-border bg-surface p-3.5">
          <Text font="heading" className="text-xl">
            {t('plans.normal')}
          </Text>
          <Text tone="muted" className="mt-0.5 text-[15px]">
            {t('plan.normalFeatures')}
          </Text>
          <View className="mt-4 flex-row gap-2.5" accessibilityRole="radiogroup">
            <PeriodOption
              label={t('plan.oneMonth')}
              priceEtb={normalPricing.monthly.priceEtb}
              note={t('plan.mostFlexible')}
              selected={period === 'monthly'}
              onPress={() => setPeriod('monthly')}
            />
            <PeriodOption
              label={t('plan.threeMonths')}
              priceEtb={normalPricing.quarterly.priceEtb}
              note={t('plan.save', { amount: formatMoney(normalQuarterlySavingEtb, false) })}
              badge={t('plan.bestValue')}
              selected={period === 'quarterly'}
              onPress={() => setPeriod('quarterly')}
            />
          </View>
          <View className="mt-3">
            <Button label={t('plan.exploreNormal')} size="md" onPress={() => explore('normal')} />
          </View>
        </View>

        <View className="mx-4 mt-3 rounded-card border-[2.5px] border-primary bg-surface p-3.5">
          <View className="flex-row flex-wrap items-center justify-between gap-x-2">
            <Text font="heading" className="text-xl">
              {t('plans.restaurant')}
            </Text>
            <Text font="heading" className="text-xl">
              <MoneyText value={restaurantMonthlyEtb} showCurrency={false} />{' '}
              <Text font="heading" className="text-sm">
                {t('plan.perMonth')}
              </Text>
            </Text>
          </View>
          <Text tone="muted" className="mt-0.5 text-[15px]">
            {t('plan.restaurantSubtitle')}
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
          <View className="mt-3">
            <Button
              label={t('plan.exploreRestaurant')}
              size="md"
              onPress={() => explore('restaurant')}
            />
          </View>
        </View>

        <View className="min-h-6 flex-1" />

        <View className="px-4">
          <Button
            label={t('plan.exploreFirst')}
            variant="outline"
            size="md"
            onPress={() => explore()}
          />
          <Text font="semibold" tone="muted" className="pb-[18px] pt-2 text-center text-sm">
            {t('plan.noPayment')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
