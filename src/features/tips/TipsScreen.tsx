import { useRouter } from 'expo-router';
import { Banknote, HandCoins, Info, Landmark } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { formatDay, formatTime } from '@/lib/format';
import { periodRange, periods, type Period } from '@/lib/period';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

import { useTips } from './store';
import type { Tip } from './types';

function SourceTag({ source }: { source: Tip['source'] }) {
  const { t } = useTranslation();
  const isCash = source === 'cash';
  const fg = isCash ? colors.warnFg : colors.successFg;
  const Icon = isCash ? Banknote : Landmark;
  return (
    <View
      className={`flex-row items-center gap-1 self-end rounded-[14px] py-[3px] pl-2 pr-2.5 ${isCash ? 'bg-warnBg' : 'bg-successBg'}`}
    >
      <Icon size={14} color={fg} strokeWidth={2.4} />
      <Text font="bold" className="text-sm" style={{ color: fg }}>
        {isCash ? t('tips.cash') : t('tips.bank')}
      </Text>
    </View>
  );
}

export default function TipsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const allTips = useTips((s) => s.tips);
  const [period, setPeriod] = useState<Period>('today');

  const { from, to } = periodRange(period);
  const tips = allTips
    .filter((tip) => tip.waiterId === user?.userId)
    .filter((tip) => {
      const time = new Date(tip.createdAt).getTime();
      return time >= from.getTime() && time <= to.getTime();
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = tips.reduce((sum, tip) => sum + tip.amount, 0);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('tips.title')}
        subtitle={t('tips.waiter', { name: user?.displayName ?? '' })}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      />

      <View className="flex-row gap-2 px-4 pb-2.5 pt-1" accessibilityRole="radiogroup">
        {periods.map((p) => (
          <Pill key={p} label={t(`period.${p}`)} selected={period === p} onPress={() => setPeriod(p)} />
        ))}
      </View>

      <FlatList
        data={tips}
        keyExtractor={(tip) => tip.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
        ListHeaderComponent={
          <View className="gap-2">
            <View accessible className="rounded-card bg-primary px-5 py-3.5">
              <Text font="semibold" tone="inverse" className="text-[15px]">
                {t(`tips.summary_${period}`, { count: tips.length })}
              </Text>
              <MoneyText value={total} tone="inverse" className="text-4xl" numberOfLines={1} adjustsFontSizeToFit />
            </View>
            <Text font="heading" className="pb-0 pt-1.5 text-lg" accessibilityRole="header">
              {t('tips.fromEachTable')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const when =
            period === 'today'
              ? formatTime(item.createdAt)
              : `${formatDay(item.createdAt, false)}, ${formatTime(item.createdAt)}`;
          return (
            <View
              accessible
              accessibilityLabel={`${item.label}, +${formatMoney(item.amount)}, ${item.source === 'cash' ? t('tips.cash') : t('tips.bank')}, ${when}`}
              className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3"
            >
              <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-tipBg">
                <HandCoins size={24} color={colors.warnFg} strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text font="bold" className="text-[17px]">
                  {item.label}
                </Text>
                <Text tone="muted" className="mt-px text-sm">
                  {when}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text font="bold" tone="link" className="text-lg">
                  +<MoneyText value={item.amount} font="bold" tone="link" className="text-lg" />
                </Text>
                <SourceTag source={item.source} />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text tone="muted" className="pt-6 text-center text-lg">
            {t('tips.empty')}
          </Text>
        }
      />

      <View className="flex-row items-start gap-2 px-4 pb-4 pt-1">
        <Info size={20} color={colors.primaryText} strokeWidth={2.2} />
        <Text font="semibold" tone="muted" className="flex-1 text-[15px] leading-5">
          {t('tips.note')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
