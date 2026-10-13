import { Redirect, useRouter } from 'expo-router';
import { Camera, Image as ImageIcon, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey } from '@/lib/errors';
import { readReceipt } from '@/lib/mock/receipt';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

import { findPayerBank } from './payerBanks';
import { useReceiptFlow } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';

function BigChoice({
  label,
  icon: Icon,
  filled,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  filled?: boolean;
  onPress: () => void;
}) {
  const brand = useBrandColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-1 items-center justify-center gap-3 rounded-[24px] border-2 active:opacity-90 ${
        filled ? 'border-primary bg-primary' : 'border-borderStrong bg-surface'
      }`}
    >
      <Icon size={44} color={filled ? colors.surface : brand.primary} strokeWidth={2} />
      <Text font="heading" tone={filled ? 'inverse' : 'default'} className="text-[22px]">
        {label}
      </Text>
    </Pressable>
  );
}

/** Step 2: read the receipt from a photo or a screenshot (VerifyReadReceipt). */
export default function ReadReceiptScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const amount = useVerifyFlow((s) => s.amount);
  const bank = findPayerBank(useReceiptFlow((s) => s.bankCode));
  const setFound = useReceiptFlow((s) => s.setFound);
  const [reading, setReading] = useState(false);

  if (!bank || amount <= 0) return <Redirect href="/verify-bank" />;
  if (reading) {
    return (
      <LoadingView
        title={t('verifyBank.read.reading')}
        subtitle={t('verifyBank.read.readingSub')}
      />
    );
  }

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/verify-bank/receipt');

  // FAKE reading for now: the photo / screenshot picker and the real reader come later.
  const read = () => {
    setReading(true);
    readReceipt(bank.fields)
      .then((found) => {
        setFound(found);
        router.replace('/verify-bank/found');
      })
      .catch((error: unknown) => {
        setReading(false);
        Alert.alert(t('common.error'), t(errorMessageKey(error)));
      });
  };

  const names = bank.fields.map((f) => t(`verifyBank.short.${f.key}`));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('verifyBank.readReceipt')}
        subtitle={`${bank.shortName} · ${formatMoney(amount)}`}
        onBack={goBack}
      />
      <Text tone="muted" className="px-5 pt-2 text-lg">
        {t('verifyBank.read.weFind', {
          things: names.join(` ${t('verifyBank.and')} `),
        })}
      </Text>
      <View className="flex-1 gap-3 p-4 pb-6">
        <BigChoice label={t('verifyBank.read.photo')} icon={Camera} filled onPress={read} />
        <BigChoice label={t('verifyBank.read.screenshot')} icon={ImageIcon} onPress={read} />
      </View>
    </SafeAreaView>
  );
}
