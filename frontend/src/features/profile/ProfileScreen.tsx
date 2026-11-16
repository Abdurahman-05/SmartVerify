import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Armchair,
  Fingerprint,
  Lock,
  Timer,
  KeyRound,
  Bike,
  Globe,
  Landmark,
  LifeBuoy,
  LogOut,
  SlidersHorizontal,
  Star,
  Store,
  Users,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { ListRow } from '@/components/ui/ListRow';
import { Switch } from '@/components/ui/Switch';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { signOutCompletely } from '@/features/lock/signOut';
import { OptionSheet } from '@/components/ui/OptionSheet';
import {
  biometricAvailable,
  LOCK_AFTER_CHOICES,
  setBiometric,
  setLockAfter,
  useAppLock,
  type LockAfter,
} from '@/lib/appLock';
import { formatPhone } from '@/lib/format';
import { useSession, type SessionUser } from '@/store/session';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { ThemeSwatches } from './ThemeSwatches';
import { GlassCard, ScreenBg } from '@/ui/glass';

function ProfileCard({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const brand = useBrandColors();
  return (
    <GlassCard accessible className="mx-4 mt-1 flex-row items-center gap-3.5 px-4 py-3.5">
      <View className="h-14 w-14 overflow-hidden rounded-full">
        <View
          style={[
            { flex: 1, alignItems: 'center', justifyContent: 'center' },
            { backgroundColor: brand.primaryDeep },
          ]}
        >
          <Text font="heading" tone="inverse" className="text-[22px]">
            {user.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>
      <View className="min-w-0 flex-1">
        <Text font="heading" className="text-[19px] leading-6" numberOfLines={1}>
          {user.displayName}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {t(`roles.${user.role}`)} · {user.businessName}
        </Text>
        {user.phone ? (
          <Text tone="muted" className="text-sm" numberOfLines={1}>
            +251 {formatPhone(user.phone)}
          </Text>
        ) : null}
      </View>
      <View className="h-7 justify-center rounded-[14px] bg-amber px-2.5">
        <Text font="bold" className="text-[13px]" numberOfLines={1}>
          {user.plan ? t(`plans.${user.plan}`) : t('profile.noPlan')}
        </Text>
      </View>
    </GlassCard>
  );
}

/** A labelled group of settings rows (design: BUSINESS / APP). */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <GlassCard className="mx-4 mt-3 px-3 pb-0.5 pt-0.5">
      <Text font="bold" tone="muted" className="px-1 pb-0.5 pt-2.5 text-[13px] uppercase">
        {label}
      </Text>
      {children}
    </GlassCard>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const userId = user?.userId ?? '';
  const hasPasscode = useAppLock((s) => s.remembered && s.passcodeUsers.includes(userId));
  const biometric = useAppLock((s) => s.biometricUsers.includes(userId));
  const [canFingerprint, setCanFingerprint] = useState(false);
  const lockAfter = useAppLock((s) => s.lockAfter);
  const [lockSheet, setLockSheet] = useState(false);
  useEffect(() => {
    void biometricAvailable().then(setCanFingerprint);
  }, []);

  if (!user) return null;

  const isStaff = user.role === 'waiter' || user.role === 'chef';
  const canManageStaff = user.role === 'owner' || user.role === 'manager';

  // Sign out forgets this phone's sign-in (phone + PIN next time); the passcode stays for the
  // same person. While signed in, the passcode is asked after the chosen time away.
  const leave = async () => {
    await signOutCompletely();
    router.replace('/sign-in');
  };
  const lockLabel = (ms: LockAfter) => t('lock.after.minutes', { count: ms / 60_000 });

  return (
    <ScreenBg>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader title={t('profile.title')} />
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileCard user={user} />
          <ThemeSwatches />

          {!isStaff || canManageStaff ? (
            <Group label={t('profile.groupBusiness')}>
              {!isStaff ? (
                <>
                  <ListRow
                    icon={Landmark}
                    label={t('profile.bankAccounts')}
                    onPress={() => router.push('/bank-accounts')}
                  />
                  <ListRow
                    icon={Star}
                    label={t('profile.subscription')}
                    onPress={() => router.push('/subscription')}
                  />
                  <ListRow
                    icon={Store}
                    label={t('business.businessInfo.entry')}
                    onPress={() => router.push('/business-info')}
                  />
                </>
              ) : null}
              {canManageStaff ? (
                <ListRow
                  icon={Users}
                  label={t('profile.staff')}
                  onPress={() => router.push('/staff')}
                />
              ) : null}
              {canManageStaff && user.plan === 'restaurant' ? (
                <>
                  <ListRow
                    icon={UtensilsCrossed}
                    label={t('profile.menu')}
                    onPress={() => router.push('/menu')}
                  />
                  <ListRow
                    icon={Armchair}
                    label={t('profile.tables')}
                    onPress={() => router.push('/setup/tables')}
                  />
                  <ListRow
                    icon={Bike}
                    label={t('profile.fees')}
                    onPress={() => router.push('/setup/fees')}
                    last={user.role !== 'owner'}
                  />
                </>
              ) : null}
              {user.role === 'owner' && user.plan === 'restaurant' ? (
                <ListRow
                  icon={SlidersHorizontal}
                  label={t('extras.title')}
                  onPress={() => router.push('/extra-features')}
                  last
                />
              ) : null}
            </Group>
          ) : null}

          <Group label={t('profile.groupApp')}>
            <ListRow icon={Globe} label={t('profile.language')} right={<LanguageToggle />} />
            <ListRow
              icon={KeyRound}
              label={t('profile.changePin')}
              onPress={() => router.push('/change-pin')}
            />
            {hasPasscode ? (
              <ListRow
                icon={Lock}
                label={t('lock.changePasscode')}
                onPress={() => router.push({ pathname: '/set-passcode', params: { change: '1' } })}
              />
            ) : null}
            {hasPasscode ? (
              <ListRow
                icon={Timer}
                label={t('lock.after.label')}
                right={
                  <Text font="semibold" tone="muted" className="text-[15px]">
                    {lockLabel(lockAfter)}
                  </Text>
                }
                onPress={() => setLockSheet(true)}
              />
            ) : null}
            {hasPasscode && canFingerprint ? (
              <ListRow
                icon={Fingerprint}
                label={t('lock.fingerprintSetting')}
                right={
                  <Switch
                    value={biometric}
                    onValueChange={(on) => void setBiometric(userId, on)}
                    accessibilityLabel={t('lock.fingerprintSetting')}
                  />
                }
              />
            ) : null}
            <ListRow
              icon={LifeBuoy}
              label={t('profile.help')}
              onPress={() => router.push('/help')}
            />
            {/* Sign out: the design's red row at the end of the list. */}
            <Pressable
              onPress={() => void leave()}
              accessibilityRole="button"
              className="min-h-[50px] flex-row items-center gap-3 px-1 py-1.5 active:opacity-70"
            >
              <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-dangerBg">
                <LogOut size={18} color={colors.alert} strokeWidth={2.2} />
              </View>
              <Text font="semibold" className="flex-1 text-[15px]" style={{ color: colors.alert }}>
                {t('profile.signOut')}
              </Text>
            </Pressable>
          </Group>
        </ScrollView>
        <OptionSheet
          visible={lockSheet}
          title={t('lock.after.label')}
          options={LOCK_AFTER_CHOICES.map((ms) => ({ value: String(ms), label: lockLabel(ms) }))}
          selected={String(lockAfter)}
          onSelect={(value) => {
            const ms = LOCK_AFTER_CHOICES.find((c) => String(c) === value);
            if (ms !== undefined) void setLockAfter(ms);
          }}
          onClose={() => setLockSheet(false)}
        />
      </SafeAreaView>
    </ScreenBg>
  );
}
