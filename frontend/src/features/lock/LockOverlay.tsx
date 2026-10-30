import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/BrandMark';
import { Text } from '@/components/ui/Text';
import { askBiometric, checkPasscode, MAX_TRIES, useAppLock } from '@/lib/appLock';
import { useSession } from '@/store/session';

import { PasscodeDots, PasscodePad } from './PasscodePad';
import { signOutCompletely } from './signOut';

/** Locks the app again when it comes back after the chosen time in the background. */
function useLockOnReturn() {
  const lastSeen = useRef(0);
  useEffect(() => {
    lastSeen.current = Date.now();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (Date.now() - lastSeen.current >= useAppLock.getState().lockAfter) {
          useAppLock.getState().lock(useSession.getState().user?.userId);
        }
      } else {
        lastSeen.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);
}

/**
 * Covers the whole app while it is locked: passcode keys, fingerprint, and "Use another
 * account" (a full sign-out). Checked on the phone, so it opens offline.
 */
export function LockOverlay() {
  useLockOnReturn();
  const locked = useAppLock((s) => s.locked);
  // Mounted only while locked, so the keys start empty each time.
  return locked ? <LockScreen /> : null;
}

function LockScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useSession((s) => s.user?.userId ?? '');
  const biometric = useAppLock((s) => s.biometricUsers.includes(userId));
  const tries = useAppLock((s) => s.tries);
  const name = useSession((s) => s.user?.displayName ?? '');
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const fingerprint = useCallback(() => {
    void askBiometric(t('lock.fingerprintPrompt'), t('lock.usePasscode'));
  }, [t]);

  // The fingerprint prompt opens by itself when the lock appears.
  useEffect(() => {
    if (biometric) fingerprint();
  }, [biometric, fingerprint]);

  const leave = (forgetPasscode = false) =>
    void signOutCompletely({ forgetPasscode }).then(() => router.replace('/sign-in'));

  const onDone = async (code: string) => {
    const result = await checkPasscode(userId, code);
    setValue('');
    if (result === 'blocked') {
      // Too many wrong passcodes: this one is no longer trusted.
      leave(true);
      return;
    }
    setWrong(result === 'wrong');
  };

  const left = MAX_TRIES - tries;
  return (
    <View className="absolute inset-0 bg-background">
      <SafeAreaView className="flex-1 justify-center gap-6 px-6">
        <View className="items-center gap-2">
          <BrandMark size={48} />
          <Text font="heading" className="text-center text-2xl" accessibilityRole="header">
            {t('lock.welcomeBack', { name })}
          </Text>
          <Text
            tone={wrong ? undefined : 'muted'}
            className={`text-center text-base ${wrong ? 'text-dangerFg' : ''}`}
          >
            {wrong ? t('lock.wrong', { count: left }) : t('lock.enterBody')}
          </Text>
        </View>
        <PasscodeDots count={value.length} error={wrong && value.length === 0} />
        <PasscodePad
          value={value}
          onChange={(v) => {
            setValue(v);
            if (v.length > 0) setWrong(false);
          }}
          onDone={(code) => void onDone(code)}
          onFingerprint={biometric ? fingerprint : undefined}
        />
        <Pressable
          onPress={() => leave()}
          accessibilityRole="button"
          className="min-h-11 items-center justify-center"
        >
          <Text font="bold" tone="link" className="text-base">
            {t('lock.anotherAccount')}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
