import { Tabs } from 'expo-router';
import {
  ChartColumn,
  ChefHat,
  Clock,
  House,
  NotebookPen,
  ReceiptText,
  ShieldCheck,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFeatures } from '@/store/features';
import { useBrandColors } from '@/store/theme';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

type TabIconProps = { color: ColorValue; focused: boolean };

const icon = (Icon: LucideIcon) =>
  function TabIcon({ color, focused }: TabIconProps) {
    return (
      <Icon size={focused ? 26 : 24} color={color as string} strokeWidth={focused ? 2.4 : 2} />
    );
  };

const HomeIcon = icon(House);
const VerifyIcon = icon(ShieldCheck);
const HistoryIcon = icon(Clock);
const ProfileIcon = icon(User);
const NewOrderIcon = icon(ReceiptText);
const ActivityIcon = icon(ChartColumn);
const BuyListIcon = icon(NotebookPen);
const MoneyOutIcon = icon(Wallet);
const KitchenIcon = icon(ChefHat);

export default function TabsLayout() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const role = useSession((s) => s.user?.role);
  const isChef = role === 'chef';
  // Restaurant waiters get their four everyday places; owner, manager and Normal-plan workers
  // keep Home / Verify / History.
  const isWaiter = useSession((s) => s.user?.role === 'waiter' && s.user.plan === 'restaurant');
  const forWaiter = (show: boolean) => (show ? {} : { href: null });
  // Manager extras: a tab only while its feature is on (otherwise no tab at all).
  const isManager = role === 'manager';
  const buyList = useFeatures((s) => s.featureBuyList);
  const moneyOut = useFeatures((s) => s.featureMoneyOut);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarLabelStyle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
        tabBarItemStyle: { paddingTop: 4 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...((isWaiter || isChef) && { height: 72, paddingBottom: 10 }),
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="new-order"
        options={{
          title: t('waiterNav.newOrder'),
          tabBarIcon: NewOrderIcon,
          ...forWaiter(isWaiter),
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{ title: t('nav.verify'), tabBarIcon: VerifyIcon, ...forWaiter(isWaiter) }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t('waiterNav.activity'),
          tabBarIcon: ActivityIcon,
          ...forWaiter(isWaiter),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{ title: t('nav.home'), tabBarIcon: HomeIcon, ...forWaiter(!isWaiter && !isChef) }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: t('nav.verify'),
          tabBarIcon: VerifyIcon,
          ...forWaiter(!isWaiter && !isChef),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('nav.history'),
          tabBarIcon: HistoryIcon,
          ...forWaiter(!isWaiter && !isChef),
        }}
      />
      <Tabs.Screen
        name="buy-list"
        options={{
          title: t('extras.buy.tab'),
          tabBarIcon: BuyListIcon,
          ...forWaiter(isManager && buyList),
        }}
      />
      <Tabs.Screen
        name="money-out"
        options={{
          title: t('extras.money.tab'),
          tabBarIcon: MoneyOutIcon,
          ...forWaiter(isManager && moneyOut),
        }}
      />
      <Tabs.Screen
        name="cook"
        options={{ title: t('kitchen.title'), tabBarIcon: KitchenIcon, ...forWaiter(isChef) }}
      />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
