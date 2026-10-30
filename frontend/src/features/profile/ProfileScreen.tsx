import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
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

import { ThemeSwatches } from './ThemeSwatches';

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
    <View
      accessible
      className="mx-4 mt-1 flex-row items-center gap-3.5 rounded-card bg-primary px-4 py-4"
    >
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
  const hasPasscode = useAppLock((s) => s.remembered && s.passcodeUserId === user?.userId);
  const biometric = useAppLock((s) => s.biometric);
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
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader title={t('profile.title')} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard user={user} />

        <View className="mx-4 mt-3 overflow-hidden rounded-card border-[1.5px] border-border bg-surface">
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
            <ListRow
              icon={UtensilsCrossed}
              label={t('profile.menu')}
              onPress={() => router.push('/menu')}
            />
          ) : null}
          {canManageStaff && user.plan === 'restaurant' ? (
            <ListRow
              icon={Armchair}
              label={t('profile.tables')}
              onPress={() => router.push('/setup/tables')}
            />
          ) : null}
          {canManageStaff && user.plan === 'restaurant' ? (
            <ListRow
              icon={Bike}
              label={t('profile.fees')}
              onPress={() => router.push('/setup/fees')}
            />
          ) : null}
          {user.role === 'owner' && user.plan === 'restaurant' ? (
            <ListRow
              icon={SlidersHorizontal}
              label={t('extras.title')}
              onPress={() => router.push('/extra-features')}
            />
          ) : null}
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
                  onValueChange={(on) => void setBiometric(on)}
                  accessibilityLabel={t('lock.fingerprintSetting')}
                />
              }
            />
          ) : null}
          <ListRow icon={Globe} label={t('profile.language')} right={<LanguageToggle />} />
          <ListRow
            icon={LifeBuoy}
            label={t('profile.help')}
            onPress={() => router.push('/help')}
            last
          />
        </View>

        <ThemeSwatches />

        <View className="mx-4 mt-4 gap-2">
          <Button
            label={t('profile.signOut')}
            icon={LogOut}
            variant="outline"
            onPress={() => void leave()}
          />
        </View>
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
  );
}
