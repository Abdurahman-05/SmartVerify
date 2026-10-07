import { useRouter } from 'expo-router';
import { Globe, Landmark, LifeBuoy, LogOut, Star, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { ListRow } from '@/components/ui/ListRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { formatPhone } from '@/lib/format';
import { useSession, type Plan, type Role, type SessionUser } from '@/store/session';

import { ThemeSwatches } from './ThemeSwatches';

const roles: Role[] = ['owner', 'manager', 'waiter', 'chef'];
const plans: Plan[] = ['normal', 'restaurant'];

function HeaderPill({ label }: { label: string }) {
  return (
    <View className="rounded-[14px] bg-white/15 px-2.5 py-[3px]">
      <Text font="bold" tone="inverse" className="text-sm">
        {label}
      </Text>
    </View>
  );
}

function ProfileCard({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  return (
    <View accessible className="mx-4 mt-1 flex-row items-center gap-3.5 rounded-card bg-primary px-4 py-4">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Text font="heading" className="text-[28px] text-primary">
          {user.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text font="heading" tone="inverse" className="text-xl" numberOfLines={1}>
          {user.displayName}
        </Text>
        {user.phone ? (
          <Text font="semibold" tone="inverse" className="text-[15px] opacity-90">
            +251 {formatPhone(user.phone)}
          </Text>
        ) : null}
        <Text font="semibold" tone="inverse" className="text-[15px] opacity-90" numberOfLines={1}>
          {user.businessName}
        </Text>
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          <HeaderPill label={t(`roles.${user.role}`)} />
          <HeaderPill label={user.plan ? t(`plans.${user.plan}`) : t('profile.noPlan')} />
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const { signOut, setRole, setPlan } = useSession();

  if (!user) return null;

  const isStaff = user.role === 'waiter' || user.role === 'chef';
  const isChef = user.role === 'chef';
  const canManageStaff = user.role === 'owner' || user.role === 'manager';

  const leave = () => {
    signOut();
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView edges={isChef ? undefined : ['top']} className="flex-1 bg-background">
      <ScreenHeader
        title={t('profile.title')}
        onBack={isChef ? () => (router.canGoBack() ? router.back() : router.replace('/kitchen')) : undefined}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <ProfileCard user={user} />

        <View className="mx-4 mt-3 overflow-hidden rounded-card border-[1.5px] border-border bg-surface">
          {!isStaff ? (
            <>
              <ListRow icon={Landmark} label={t('profile.bankAccounts')} onPress={() => router.push('/bank-accounts')} />
              <ListRow icon={Star} label={t('profile.subscription')} onPress={() => router.push('/subscription')} />
            </>
          ) : null}
          {canManageStaff ? (
            <ListRow icon={Users} label={t('profile.staff')} onPress={() => router.push('/staff')} />
          ) : null}
          <ListRow icon={Globe} label={t('profile.language')} right={<LanguageToggle />} />
          <ListRow icon={LifeBuoy} label={t('profile.help')} onPress={() => router.push('/help')} last />
        </View>

        <ThemeSwatches />

        <View className="mx-4 mt-4">
          <Button label={t('profile.signOut')} icon={LogOut} variant="outline" onPress={leave} />
        </View>

        {__DEV__ ? (
          <View className="mx-4 mt-5 gap-2 rounded-input border-2 border-dashed border-amber p-3">
            <Text font="bold" tone="muted" className="text-sm">
              {t('profile.devTitle')}
            </Text>
            <Text font="semibold" className="text-[15px]">
              {t('profile.devRole')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {roles.map((role) => (
                <Pill key={role} label={t(`roles.${role}`)} selected={user.role === role} onPress={() => setRole(role)} />
              ))}
            </View>
            <Text font="semibold" className="text-[15px]">
              {t('profile.devPlan')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {plans.map((plan) => (
                <Pill key={plan} label={t(`plans.${plan}`)} selected={user.plan === plan} onPress={() => setPlan(plan)} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
