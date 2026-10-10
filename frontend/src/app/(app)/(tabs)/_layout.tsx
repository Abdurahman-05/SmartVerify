import { Tabs } from 'expo-router';
import { Clock, House, ShieldCheck, User } from 'lucide-react-native';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useBrandColors } from '@/store/theme';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

type TabIconProps = { color: ColorValue };

const HomeIcon = ({ color }: TabIconProps) => <House size={24} color={color as string} />;
const VerifyIcon = ({ color }: TabIconProps) => <ShieldCheck size={24} color={color as string} />;
const HistoryIcon = ({ color }: TabIconProps) => <Clock size={24} color={color as string} />;
const ProfileIcon = ({ color }: TabIconProps) => <User size={24} color={color as string} />;

export default function TabsLayout() {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const isChef = useSession((s) => s.user?.role === 'chef');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarLabelStyle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
        tabBarStyle: isChef
          ? { display: 'none' }
          : { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('nav.home'), tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="verify" options={{ title: t('nav.verify'), tabBarIcon: VerifyIcon }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: t('nav.history'), tabBarIcon: HistoryIcon }}
      />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
