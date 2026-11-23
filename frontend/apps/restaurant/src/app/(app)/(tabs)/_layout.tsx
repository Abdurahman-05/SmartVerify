import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import {
  Bell,
  ChartColumn,
  ChefHat,
  Clock,
  House,
  ListChecks,
  ReceiptText,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getNotifications, NOTIFICATIONS_POLL_MS, notificationsKey } from '@/lib/notifications';
import { useFeatures } from '@/store/features';
import { useSession } from '@/store/session';
import { GlassNav, ScreenBg, ScreenBgProvided } from '@/ui/glass';

type TabIconProps = { color: ColorValue; focused: boolean };

const icon = (Icon: LucideIcon) =>
  function TabIcon({ color, focused }: TabIconProps) {
    return (
      <Icon size={focused ? 26 : 24} color={color as string} strokeWidth={focused ? 2.4 : 2} />
    );
  };

/** Floating pill: 52 px buttons + 8 px padding, 16 px above the bottom, 16 px gap above. */
const NAV_ROOM = 52 + 16 + 16 + 16;

const HomeIcon = icon(House);
const VerifyIcon = icon(ShieldCheck);
const HistoryIcon = icon(Clock);
const ProfileIcon = icon(User);
const NewOrderIcon = icon(ReceiptText);
const ActivityIcon = icon(ChartColumn);
const KitchenIcon = icon(ChefHat);
const BellIcon = icon(Bell);
const FinishedIcon = icon(ListChecks);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const role = useSession((s) => s.user?.role);
  const isChef = role === 'chef';
  const buyList = useFeatures((f) => f.featureBuyList);
  // Restaurant waiters get their four everyday places; owner, manager and Normal-plan workers
  // keep Home / Verify / History.
  const isWaiter = useSession((s) => s.user?.role === 'waiter' && s.user.plan === 'restaurant');
  const forWaiter = (show: boolean) => (show ? {} : { href: null });
  // The unread count on the bell, checked every 30 seconds while the app is open.
  const { data: inbox } = useQuery({
    queryKey: notificationsKey,
    queryFn: getNotifications,
    refetchInterval: NOTIFICATIONS_POLL_MS,
  });
  const unread = inbox?.unread ?? 0;

  // One background behind all tab screens (they draw none), also under the floating nav.
  return (
    <ScreenBg>
      <ScreenBgProvided.Provider value>
        <Tabs
          // Rendered as a component: tabBar is called as a plain function, and GlassNav uses hooks.
          tabBar={(props) => <GlassNav {...props} />}
          screenOptions={{
            headerShown: false,
            // The glass nav floats over the screen: leave room under the content for it.
            sceneStyle: { backgroundColor: 'transparent', paddingBottom: NAV_ROOM + insets.bottom },
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
            options={{
              title: t('nav.home'),
              tabBarIcon: HomeIcon,
              ...forWaiter(!isWaiter && !isChef),
            }}
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
            name="cook"
            options={{ title: t('kitchen.title'), tabBarIcon: KitchenIcon, ...forWaiter(isChef) }}
          />
          <Tabs.Screen
            name="finished"
            options={{
              title: t('extras.finished.open'),
              tabBarIcon: FinishedIcon,
              ...forWaiter(isChef && buyList),
            }}
          />
          <Tabs.Screen
            name="notifications"
            options={{
              title: t('notifications.tab'),
              tabBarIcon: BellIcon,
              tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: t('nav.profile'), tabBarIcon: ProfileIcon }}
          />
        </Tabs>
      </ScreenBgProvided.Provider>
    </ScreenBg>
  );
}
