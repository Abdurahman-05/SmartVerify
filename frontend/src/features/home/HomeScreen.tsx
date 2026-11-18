import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { Bell, Lock, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionTile } from '@/components/ui/ActionTile';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { formatMoney } from '@/components/ui/MoneyText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Text } from '@/components/ui/Text';
import { useFeatures } from '@/store/features';
import { billsKey, getBills } from '@/lib/bills';
import { getPaymentsSummary, paymentsKey, paymentsSummaryKey, syncPayments } from '@/lib/history';
import { useSession, type Plan, type SessionUser } from '@/store/session';
import { colors } from '@/theme/tokens';
import { AccessBanner } from '@/features/business/AccessBanner';
import { LocationPrompt } from '@/features/business/LocationPrompt';

import { getReportAccess, reportAccessKey } from '@/lib/reports';
import { failedChecksKey, getFailedChecks } from '@/lib/verification';
import { getHomeActions, type HomeAction } from './homeActions';

// Design: docs/design/owner/screens/01-owner-home.png and 02-manager-home.png
const heroPizza = require('../../../assets/images/home/hero-pizza.png') as number;
const TAG_YELLOW = '#FACC15';

function HomeHeader({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const g = useGlass();
  const hello =
    user.role === 'manager'
      ? t('home.hi', { name: user.displayName })
      : t('home.welcome', { name: user.displayName });
  const subtitle =
    user.plan === null ? `${user.businessName} · ${t('home.exploring')}` : user.businessName;

  return (
    <View className="flex-row items-center justify-between gap-2 px-4 pb-3 pt-4">
      <View className="flex-1">
        <Text font="bold" className="text-sm" style={{ color: g.primaryText }} numberOfLines={1}>
          {`${hello} · ${t(`roles.${user.role}`)}`}
        </Text>
        <Text
          font="heading"
          className="text-[26px] leading-[32px]"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          accessibilityLabel={subtitle}
        >
          {user.businessName}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <GlassCard radius={22} accessibilityLabel={t('home.notifications')}>
          <View className="h-11 w-11 items-center justify-center">
            <Bell size={20} color={colors.text} strokeWidth={2} />
            <View className="absolute right-[9px] top-2 h-[9px] w-[9px] rounded-full bg-alert" />
          </View>
        </GlassCard>
        <View
          accessible
          accessibilityLabel={t('home.profile')}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: g.primaryDeep }}
        >
          <Text font="bold" tone="inverse" className="text-lg">
            {user.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** One see-through number chip inside the hero. */
function HeroStat({
  value,
  label,
  warn,
}: {
  value: number | string;
  label: string;
  warn?: boolean;
}) {
  return (
    <HeroChip style={{ flex: 1, paddingHorizontal: 10 }}>
      <View accessible accessibilityLabel={`${label}: ${value}`}>
        <Text tone="inverse" className="text-[13px] opacity-90" numberOfLines={1}>
          {label}
        </Text>
        <Text
          font="heading"
          className="text-lg leading-6"
          style={{
            color: warn && typeof value === 'number' && value > 0 ? colors.tipOnDark : '#FFFFFF',
          }}
        >
          {value}
        </Text>
      </View>
    </HeroChip>
  );
}

/** Hero: today's sales (live) with the payment counts, or the plan line before there is data. */
function TodayHero({
  user,
  today,
  failed = false,
}: {
  user: SessionUser;
  /** The numbers could not be loaded: show "—" instead of 0. */
  failed?: boolean;
  today?: {
    salesEtb: number;
    payments: number;
    pending: number;
    duplicate: number;
    tablesOpen: number;
  };
}) {
  const { t } = useTranslation();
  const planLine = user.plan ? t(`plans.${user.plan}`) : t('home.exploring');
  // Every plan shows today's live numbers (0 until the first payment).
  const dash = '—';
  const day = today ?? { salesEtb: 0, payments: 0, pending: 0, duplicate: 0, tablesOpen: 0 };
  // Restaurant managers run the floor: open tables instead of the plan name.
  const secondLine =
    user.plan === 'restaurant' && user.role === 'manager'
      ? t('home.tablesOpen', { count: day.tablesOpen })
      : planLine;
  return (
    <View style={{ marginHorizontal: 16 }}>
      <HeroCard>
        {/* Transparent pizza in the top corner, kept inside the card. */}
        <Image
          source={heroPizza}
          contentFit="contain"
          pointerEvents="none"
          accessible={false}
          style={{ position: 'absolute', top: 0, right: 0, width: 132, height: 136 }}
        />
        <View className="flex-row items-center gap-1.5">
          <View
            className="h-3.5 w-3.5 rounded-full border-2 border-white/50"
            style={{ backgroundColor: TAG_YELLOW }}
          />
          <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
            {`${t('home.today')} · ${t('home.live')}`}
          </Text>
        </View>
        <Text font="heading" tone="inverse" className="mt-0.5 pr-28 text-[32px] leading-[38px]">
          {failed ? dash : formatMoney(day.salesEtb, false)}{' '}
          <Text font="heading" tone="inverse" className="text-base">
            {t('common.etb')}
          </Text>
        </Text>
        <Text tone="inverse" className="pr-24 text-sm opacity-90" numberOfLines={1}>
          {failed ? dash : t('home.paymentsCount', { count: day.payments })} · {secondLine}
        </Text>
        <View className="mt-3 flex-row gap-2">
          <HeroStat value={failed ? dash : day.payments} label={t('status.verified')} />
          <HeroStat value={failed ? dash : day.pending} label={t('status.pending')} warn />
          <HeroStat value={failed ? dash : day.duplicate} label={t('status.duplicate')} />
        </View>
      </HeroCard>
    </View>
  );
}

function useActionSubtitle(
  plan: Plan | null,
  manages: boolean,
  tablesWaiting: number,
  openBills: number
) {
  const { t } = useTranslation();
  const isRestaurant = plan === 'restaurant';

  return (action: HomeAction) => {
    switch (action.key) {
      case 'verify':
        return isRestaurant && tablesWaiting
          ? t('home.actions.verifySubTables', { count: tablesWaiting })
          : t('home.actions.verifySub');
      case 'tips':
        if (isRestaurant && manages) return t('home.actions.tipsSubAll');
        return isRestaurant ? t('home.actions.tipsSubToday') : t('home.actions.tipsSub');
      case 'subscription':
        return plan ? t(`plans.${plan}`) : t('home.actions.subscriptionSubNone');
      case 'openBills':
        return t('home.actions.openBillsSub', { count: openBills });
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
  // Today's live numbers are shown on every plan.
  const signedIn = !!user && user.role !== 'chef';
  const { data: openList } = useQuery({
    queryKey: billsKey('all'),
    queryFn: () => getBills(),
    enabled: isRestaurant,
  });
  const tablesWaiting = (openList ?? []).filter((b) => b.type === 'dine').length;
  const { data: paidToday, isError: paidFailed } = useQuery({
    queryKey: paymentsKey('today'),
    queryFn: () => syncPayments('today'),
    enabled: signedIn,
  });
  // Checks that did not verify today: not confirmed yet (pending) and already-used receipts.
  const { data: failed, isError: failedChecksFailed } = useQuery({
    queryKey: failedChecksKey('today'),
    queryFn: () => getFailedChecks('today'),
    enabled: signedIn,
  });
  const { data: summary, isError: summaryFailed } = useQuery({
    queryKey: paymentsSummaryKey('today'),
    queryFn: () => getPaymentsSummary('today'),
    enabled: signedIn,
  });
  // Any dashboard number that could not load shows "—", never a false 0.
  const dashFailed =
    (summaryFailed && !summary) || (paidFailed && !paidToday) || (failedChecksFailed && !failed);
  const manages = user?.role === 'owner' || user?.role === 'manager';
  const subtitleFor = useActionSubtitle(
    user?.plan ?? null,
    manages,
    tablesWaiting,
    openList?.length ?? 0
  );
  const moneyOut = useFeatures((s) => s.featureMoneyOut);
  const { data: reportAccess } = useQuery({
    queryKey: reportAccessKey,
    queryFn: getReportAccess,
    enabled: isRestaurant,
  });
  const buyList = useFeatures((s) => s.featureBuyList);

  if (!user) return <Redirect href="/sign-in" />;
  if (user.role === 'chef') return <Redirect href="/cook" />;

  const actions = getHomeActions(user.plan, user.role, {
    buyList,
    moneyOut,
    reports: reportAccess?.canSeeReports ?? false,
  });
  const restaurantManager = user.plan === 'restaurant' && manages;
  const heading =
    restaurantManager && user.role === 'manager' ? t('home.runFloor') : t('home.whatToDo');
  const showOwnerOnly = user.role === 'owner' && actions.some((a) => a.ownerOnly);

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <HomeHeader user={user} />
          <AccessBanner />
          <LocationPrompt />
          <TodayHero
            user={user}
            failed={dashFailed}
            today={
              summary
                ? {
                    salesEtb: summary.salesEtb,
                    payments: summary.count || (paidToday?.length ?? 0),
                    pending: (failed ?? []).filter((c) => c.status === 'unable_to_verify').length,
                    duplicate: (failed ?? []).filter((c) => c.reasons.includes('DUPLICATE')).length,
                    tablesOpen: tablesWaiting,
                  }
                : undefined
            }
          />
          <View className="px-4 pt-3">
            <PrimaryButton
              height={60}
              label={t('home.verifyPayment')}
              icon={ShieldCheck}
              onPress={() => router.push(user.plan === 'restaurant' ? '/bills' : '/verify')}
              trailing={
                user.plan === 'restaurant' && tablesWaiting ? (
                  <View
                    className="ml-1 h-7 justify-center rounded-[14px] px-2.5"
                    style={{ backgroundColor: TAG_YELLOW }}
                  >
                    <Text font="bold" className="text-[13px]">
                      {t('home.tablesWaiting', { count: tablesWaiting })}
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>

          <View className="flex-row items-center justify-between px-4 pb-2.5 pt-4">
            <Text font="bold" className="flex-1 text-base" accessibilityRole="header">
              {heading}
            </Text>
            {showOwnerOnly ? (
              <View className="flex-row items-center gap-1">
                <Lock size={13} color={colors.muted} strokeWidth={2.4} />
                <Text font="bold" className="text-sm" style={{ color: colors.muted }}>
                  {t('home.ownerOnly')}
                </Text>
              </View>
            ) : null}
          </View>
          <View className="px-4">
            <GlassCard style={{ padding: 10, gap: 8 }}>
              {toRows(actions).map((row) => (
                <View key={row[0].key} className="flex-row gap-2">
                  {row.map((action) => (
                    <ActionTile
                      key={action.key}
                      icon={action.icon}
                      title={t(`home.actions.${action.key}`)}
                      sub={subtitleFor(action)}
                      locked={user.role === 'owner' && action.ownerOnly}
                      badge={action.key === 'openBills' ? (openList?.length ?? 0) : undefined}
                      onPress={() => router.push(action.href)}
                    />
                  ))}
                  {row.length === 1 ? <View className="flex-1" /> : null}
                </View>
              ))}
            </GlassCard>
          </View>

          <View className="min-h-24 flex-1" />
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}
