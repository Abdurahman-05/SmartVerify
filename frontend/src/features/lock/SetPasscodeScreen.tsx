import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { biometricAvailable, setBiometric, setPasscode } from '@/lib/appLock';
import { homeRouteFor, useSession } from '@/store/session';
import { useBrandColors } from '@/store/theme';

import { PasscodeDots, PasscodePad } from './PasscodePad';

type Step = 'create' | 'confirm' | 'fingerprint';

/**
 * Make (or change) the 4-digit app passcode: type it, type it again, then optionally turn on
 * the fingerprint. After the first sign-in it continues to the person's first screen.
 */
export default function SetPasscodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const { change } = useLocalSearchParams<{ change?: string }>();
  const user = useSession((s) => s.user);
  const [step, setStep] = useState<Step>('create');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const finish = () => {
    if (change) router.back();
    else router.replace(homeRouteFor(user));
  };

  const onDone = async (code: string) => {
    if (step === 'create') {
      setFirst(code);
      setValue('');
      setMismatch(false);
      setStep('confirm');
      return;
    }
    if (code !== first) {
      // Start again from the first entry.
      setMismatch(true);
      setValue('');
      setFirst('');
      setStep('create');
      return;
    }
    if (!user) return;
    await setPasscode(user.userId, code);
    if (!change && (await biometricAvailable())) setStep('fingerprint');
    else finish();
  };

  if (step === 'fingerprint') {
    return (
      <SafeAreaView className="flex-1 justify-center gap-5 bg-background px-6">
        <View className="items-center gap-3">
          <Fingerprint size={64} color={brand.primary} strokeWidth={1.8} />
          <Text font="heading" className="text-center text-2xl" accessibilityRole="header">
            {t('lock.fingerprintTitle')}
          </Text>
          <Text tone="muted" className="text-center text-base">
            {t('lock.fingerprintBody')}
          </Text>
        </View>
        <Button
          label={t('lock.fingerprintYes')}
          icon={Fingerprint}
          onPress={() => void setBiometric(true).then(finish)}
        />
        <Button label={t('lock.notNow')} variant="outline" onPress={finish} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {change ? <ScreenHeader title={t('lock.changeTitle')} onBack={() => router.back()} /> : null}
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="items-center gap-2">
          {change ? null : <BrandMark size={48} />}
          <Text font="heading" className="text-center text-2xl" accessibilityRole="header">
            {step === 'create' ? t('lock.createTitle') : t('lock.confirmTitle')}
          </Text>
          <Text
            tone={mismatch ? undefined : 'muted'}
            className={`text-center text-base ${mismatch ? 'text-dangerFg' : ''}`}
          >
            {mismatch
              ? t('lock.mismatch')
              : step === 'create'
                ? t('lock.createBody')
                : t('lock.confirmBody')}
          </Text>
        </View>
        <PasscodeDots count={value.length} error={mismatch && value.length === 0} />
        <PasscodePad value={value} onChange={setValue} onDone={(code) => void onDone(code)} />
      </View>
    </SafeAreaView>
  );
}
