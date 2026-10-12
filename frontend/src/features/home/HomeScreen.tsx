import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { Bell, Check, Clock, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/BrandMark';
import { Text } from '@/components/ui/Text';
import { useBrandColors } from '@/store/theme';
import { billsKey, getBills } from '@/lib/bills';
import { getPayments, paymentsKey } from '@/lib/history';
import { useSession, type Plan, type SessionUser } from '@/store/session';
import { colors } from '@/theme/tokens';

import { getHomeActions, type HomeAction } from './homeActions';

function HomeHeader({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const planLabel = user.plan === 'restaurant' ? t('plans.restaurant') : null;
  const subtitle =
    user.plan === null
      ? `${user.businessName} · ${t('home.exploring')}`
      : [user.businessName, planLabel].filter(Boolean).join(' · ');

  return (
    <View className="flex-row items-center justify-between gap-2 px-4 pb-2 pt-4">
      <View className="flex-1 flex-row items-center gap-2.5">
        <BrandMark size={40} />
        <View className="flex-1">
          <Text font="heading" className="text-lg leading-tight" numberOfLines={1}>
            {t('brand.name')}
          </Text>
          <Text tone="muted" className="text-sm" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2.5">
        <View
          accessible
          accessibilityLabel={t('home.notifications')}
          className="h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-borderStrong bg-surface"
        >
          <Bell size={22} color={colors.text} strokeWidth={2} />
          <View className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-alert" />
        </View>
        <View
          accessible
          accessibilityLabel={t('home.profile')}
          className="h-11 w-11 items-center justify-center rounded-full bg-primary"
        >
          <Text font="bold" tone="inverse" className="text-lg">
            {user.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HeroCard({
  name,
  tablesWaiting,
  onVerify,
}: {
  name: string;
  tablesWaiting?: number;
  onVerify: () => void;
}) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  return (
    <View className="mx-4 mt-1 rounded-card bg-primary p-4">
      <Text font="heading" tone="inverse" className="text-[22px]">
        {t('home.welcome', { name })}
      </Text>
      <Text tone="inverse" className="mt-0.5 text-[15px] opacity-95">
        {t('home.heroSubtitle')}
      </Text>
      <Pressable
        onPress={onVerify}
        accessibilityRole="button"
        className="mt-3.5 min-h-14 flex-row flex-wrap items-center justify-center gap-2 rounded-input bg-surface px-3 py-2 active:opacity-80"
      >
        <ShieldCheck size={24} color={brand.primary} strokeWidth={2.2} />
        <Text font="bold" className="text-[19px] text-primary">
          {t('home.verifyPayment')}
        </Text>
        {tablesWaiting ? (
          <View className="ml-1.5 rounded-[14px] bg-amber px-2.5 py-0.5">
            <Text font="bold" className="text-sm">
              {t('home.tablesWaiting', { count: tablesWaiting })}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function ActionTile({
  action,
  subtitle,
  onPress,
}: {
  action: HomeAction;
  subtitle: string;
  onPress: () => void;
}) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const Icon = action.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t(`home.actions.${action.key}`)}, ${subtitle}`}
      className="min-h-[84px] flex-1 flex-row items-center gap-2.5 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2.5 active:bg-background"
    >
      <View className="h-11 w-11 items-center justify-center rounded-[13px] bg-primaryTile">
        <Icon size={24} color={brand.primary} strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text font="bold" className="text-[17px] leading-tight">
          {t(`home.actions.${action.key}`)}
        </Text>
        <Text tone="muted" className="mt-0.5 text-sm leading-tight">
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function StatBox({
  value,
  label,
  icon: Icon,
  bg,
  fg,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  bg: string;
  fg: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={`flex-1 items-center rounded-input px-1.5 py-2.5 ${bg}`}
    >
      <View className="flex-row items-center gap-1">
        <Icon size={20} color={fg} strokeWidth={2.6} />
        <Text font="heading" className="text-[28px] leading-tight" style={{ color: fg }}>
          {value}
        </Text>
      </View>
      <Text font="bold" className="text-sm" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Today's bills: paid (from the payment history) and still open. */
function TodayCard({ paid, open }: { paid: number; open: number }) {
  const { t } = useTranslation();
  return (
    <View className="mx-4 mb-2.5 rounded-[20px] border-[1.5px] border-border bg-surface px-3 py-2.5">
      <View className="mb-2 flex-row items-center justify-between">
        <Text font="bold" className="text-base">
          {t('home.today')}
        </Text>
        <Text font="bold" tone="link" className="text-sm">
          {t('home.live')}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <StatBox
          value={paid}
          label={t('history.today.paid')}
          icon={Check}
          bg="bg-successBg"
          fg={colors.successFg}
        />
        <StatBox
          value={open}
          label={t('history.today.open')}
          icon={Clock}
          bg="bg-warnBg"
          fg={colors.warnFg}
        />
      </View>
    </View>
  );
}

function useActionSubtitle(plan: Plan | null, tablesWaiting: number) {
  const { t } = useTranslation();
  const isRestaurant = plan === 'restaurant';

  return (action: HomeAction) => {
    switch (action.key) {
      case 'verify':
        return isRestaurant && tablesWaiting
          ? t('home.actions.verifySubTables', { count: tablesWaiting })
          : t('home.actions.verifySub');
      case 'tips':
        return isRestaurant ? t('home.actions.tipsSubToday') : t('home.actions.tipsSub');
      case 'subscription':
        return plan ? t(`plans.${plan}`) : t('home.actions.subscriptionSubNone');
      default:
        return t(`home.actions.${action.key}Sub`);
    }
  };
}

function toRows<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  // Open dine-in bills from the server (waiters: their own tables), refreshed with the bills.
  const isRestaurant = user?.plan === 'restaurant' && user.role !== 'chef';
  const { data: openList } = useQuery({
    queryKey: billsKey('all'),
    queryFn: () => getBills(),
    enabled: isRestaurant,
  });
  const tablesWaiting = (openList ?? []).filter((b) => b.type === 'dine').length;
  const { data: paidToday } = useQuery({
    queryKey: paymentsKey('today'),
    queryFn: () => getPayments('today'),
    enabled: isRestaurant,
  });
  const subtitleFor = useActionSubtitle(user?.plan ?? null, tablesWaiting);

  if (!user) return <Redirect href="/sign-in" />;
  if (user.role === 'chef') return <Redirect href="/kitchen" />;

  const actions = getHomeActions(user.plan, user.role);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <HomeHeader user={user} />
        <HeroCard
          name={user.displayName}
          tablesWaiting={user.plan === 'restaurant' ? tablesWaiting : undefined}
          onVerify={() => router.push(user.plan === 'restaurant' ? '/bills' : '/verify')}
        />

        <Text font="heading" className="px-4 pb-2 pt-3.5 text-lg" accessibilityRole="header">
          {t('home.whatToDo')}
        </Text>
        <View className="gap-2 px-4">
          {toRows(actions).map((row) => (
            <View key={row[0].key} className="flex-row gap-2">
              {row.map((action) => (
                <ActionTile
                  key={action.key}
                  action={action}
                  subtitle={subtitleFor(action)}
                  onPress={() => router.push(action.href)}
                />
              ))}
            </View>
          ))}
        </View>

        <View className="min-h-4 flex-1" />
        {isRestaurant && paidToday && openList ? (
          <TodayCard paid={paidToday.length} open={openList.length} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
