import { Tabs } from 'expo-router';
import {
  ChartColumn,
  Clock,
  House,
  ReceiptText,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useBrandColors } from '@/store/theme';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

type TabIconProps = { color: ColorValue; focused: boolean };

const icon =
  (Icon: LucideIcon) =>
  ({ color, focused }: TabIconProps) => (
    <Icon size={focused ? 26 : 24} color={color as string} strokeWidth={focused ? 2.4 : 2} />
  );

const HomeIcon = icon(House);
const VerifyIcon = icon(ShieldCheck);
const HistoryIcon = icon(Clock);
const ProfileIcon = icon(User);
const NewOrderIcon = icon(ReceiptText);
const ActivityIcon = icon(ChartColumn);

export default function TabsLayout() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const role = useSession((s) => s.user?.role);
  const isChef = role === 'chef';
  // Waiters get their four everyday places; owner and manager keep Home / Verify / History.
  const isWaiter = role === 'waiter';
  const forWaiter = (show: boolean) => (show ? {} : { href: null });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarLabelStyle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
        tabBarItemStyle: { paddingTop: 4 },
        tabBarStyle: isChef
          ? { display: 'none' }
          : {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              ...(isWaiter && { height: 72, paddingBottom: 10 }),
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
        options={{ title: t('nav.home'), tabBarIcon: HomeIcon, ...forWaiter(!isWaiter) }}
      />
      <Tabs.Screen
        name="verify"
        options={{ title: t('nav.verify'), tabBarIcon: VerifyIcon, ...forWaiter(!isWaiter) }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: t('nav.history'), tabBarIcon: HistoryIcon, ...forWaiter(!isWaiter) }}
      />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
