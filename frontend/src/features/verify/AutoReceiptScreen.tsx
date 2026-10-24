import { scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { Camera, Image as ImageIcon, Info, QrCode } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { MoneyText } from '@/components/ui/MoneyText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey } from '@/lib/errors';
import { detectReceiptQr, readReference } from '@/lib/verification';
import { useBrandColors } from '@/store/theme';

import { checkingRoute, foundFromReference, useReceiptFlow } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';

/** The banks whose receipts are found and checked automatically. */
const SUPPORTED = ['CBE', 'TEL', 'DAS', 'BOA'] as const;

/**
 * Normal Verify: scan the receipt QR or give a photo / screenshot. Nobody picks the bank: the QR
 * or the picture tells which bank paid, and that bank's own check runs.
 */
export default function AutoReceiptScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrandColors();
  const amount = useVerifyFlow((s) => s.amount);
  const setQrData = useVerifyFlow((s) => s.setQrData);
  const [reading, setReading] = useState(false);

  if (amount <= 0) return <Redirect href="/verify" />;
  if (reading) {
    return (
      <LoadingView
        title={t('verifyBank.read.reading')}
        subtitle={t('verifyBank.auto.findingBank')}
      />
    );
  }

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/verify'));

  const readPicture = async (source: 'camera' | 'library') => {
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      Alert.alert(t('verify.scan.permissionTitle'), t('verify.scan.permissionBody'));
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset) return;

    setReading(true);
    try {
      const flow = useReceiptFlow.getState();
      // 1. A receipt QR in the picture tells the bank and the link at once (no Gemini call).
      const codes = await scanFromURLAsync(asset.uri, ['qr']).catch(() => []);
      const fromQr = codes.map((c) => detectReceiptQr(c.data)).find((found) => found !== null);
      if (fromQr) {
        flow.setBank(fromQr.bankCode);
        setQrData(fromQr.link);
        router.replace(checkingRoute('normal'));
        return;
      }
      // 2. Otherwise the server reads the picture and says which bank it is from.
      if (!asset.base64) throw new Error('no image data');
      const { bank, reference } = await readReference(asset.base64, 'AUTO');
      if (!bank) {
        setReading(false);
        Alert.alert(t('verifyBank.auto.unknownTitle'), t('verifyBank.auto.unknownBody'));
        return;
      }
      // 3. That bank's steps: the confirm page shows what was found and asks for the rest.
      flow.setBank(bank);
      flow.setFound(foundFromReference(bank, reference));
      router.replace('/verify-bank/found');
    } catch (error) {
      setReading(false);
      Alert.alert(t('common.error'), t(errorMessageKey(error)));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('verifyBank.title')}
        subtitle={t('verifyBank.auto.subtitle')}
        onBack={goBack}
      />

      <View className="mx-4 mt-1 flex-row items-center justify-between rounded-2xl bg-primary px-4 py-2.5">
        <Text font="semibold" tone="inverse" className="text-[15px]">
          {t('verifyBank.payByBank')}
        </Text>
        <MoneyText value={amount} tone="inverse" className="text-[22px]" />
      </View>

      <View className="flex-1 justify-center gap-5 px-6">
        <View
          className="flex-row justify-center gap-3"
          accessible
          accessibilityLabel={t('verifyBank.auto.banks')}
        >
          {SUPPORTED.map((code) => (
            <BankBadge key={code} code={code} size={48} />
          ))}
        </View>
        <Text font="heading" className="text-center text-[22px]">
          {t('verifyBank.auto.title')}
        </Text>
        <View className="flex-row items-start gap-2">
          <Info size={18} color={brand.primaryText} strokeWidth={2.2} />
          <Text tone="muted" className="flex-1 text-[15px] leading-5">
            {t('verifyBank.auto.hint')}
          </Text>
        </View>
      </View>

      <View className="gap-2.5 px-4 pb-6 pt-2">
        <Button
          label={t('verifyBank.scanQr')}
          icon={QrCode}
          onPress={() => router.push('/verify-bank/scan')}
        />
        <Button
          label={t('verifyBank.read.photo')}
          icon={Camera}
          variant="outline"
          size="md"
          onPress={() => void readPicture('camera')}
        />
        <Button
          label={t('verifyBank.read.screenshot')}
          icon={ImageIcon}
          variant="outline"
          size="md"
          onPress={() => void readPicture('library')}
        />
      </View>
    </SafeAreaView>
  );
}
