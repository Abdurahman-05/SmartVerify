import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { Bell, Clock, House, ShieldCheck, User, type LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getNotifications, NOTIFICATIONS_POLL_MS, notificationsKey } from '@/lib/notifications';
import { useBrandColors } from '@/store/theme';
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
const BellIcon = icon(Bell);
const ProfileIcon = icon(User);

/** Shop app: the same five tabs for the owner and the workers. */
export default function TabsLayout() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  // The unread count on the bell, checked every 30 seconds while the app is open.
  const { data: inbox } = useQuery({
    queryKey: notificationsKey,
    queryFn: getNotifications,
    refetchInterval: NOTIFICATIONS_POLL_MS,
  });
  const unread = inbox?.unread ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarLabelStyle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
        tabBarItemStyle: { paddingTop: 4 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('nav.home'), tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="verify" options={{ title: t('nav.verify'), tabBarIcon: VerifyIcon }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: t('nav.history'), tabBarIcon: HistoryIcon }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('notifications.tab'),
          tabBarIcon: BellIcon,
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
