import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
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
import { readReceipt } from '@/lib/mock/receipt';
import { readReference } from '@/lib/verification';

import { findPayerBank, onReceipt, type PayerBank } from './payerBanks';
import { useReceiptFlow } from './receiptFlow';
import { useVerifyFlow } from './verifyFlow';

const CORNER = 34;

/** A grey line standing for receipt text we do not need. */
function Line({ width }: { width: `${number}%` }) {
  return <View className="h-2 rounded-full bg-border" style={{ width }} />;
}

/** Four brand-colored corners around the receipt, like a camera frame. */
function FrameCorners() {
  const corner = 'absolute border-primary';
  const size = { width: CORNER, height: CORNER };
  return (
    <>
      <View
        className={`${corner} left-0 top-0 rounded-tl-[18px] border-l-4 border-t-4`}
        style={size}
      />
      <View
        className={`${corner} right-0 top-0 rounded-tr-[18px] border-r-4 border-t-4`}
        style={size}
      />
      <View
        className={`${corner} bottom-0 left-0 rounded-bl-[18px] border-b-4 border-l-4`}
        style={size}
      />
      <View
        className={`${corner} bottom-0 right-0 rounded-br-[18px] border-b-4 border-r-4`}
        style={size}
      />
    </>
  );
}

/** A small drawn receipt with the things to find marked in amber. */
function SampleReceipt({ bank }: { bank: PayerBank }) {
  const { t } = useTranslation();
  return (
    <View className="relative w-[270px] p-[18px]">
      <FrameCorners />
      <View className="gap-2.5 rounded-[16px] bg-surface p-3.5">
        <View className="flex-row items-center gap-2">
          <BankBadge code={bank.code} size={40} />
          <View className="flex-1">
            <Line width="60%" />
          </View>
        </View>
        <Line width="85%" />
        {onReceipt(bank).map((field) => (
          <View key={field.key} className="rounded-[12px] border-2 border-amber bg-tipBg px-3 py-2">
            <Text font="semibold" className="text-sm text-warnFg">
              {t(`verifyBank.fields.${field.key}`)}
            </Text>
            <Text font="heading" className="text-base" numberOfLines={1}>
              {field.sample}
            </Text>
          </View>
        ))}
        <Line width="70%" />
        <Line width="50%" />
      </View>
    </View>
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

  const failed = (error: unknown) => {
    setReading(false);
    Alert.alert(t('common.error'), t(errorMessageKey(error)));
  };

  /**
   * CBE: take or pick the receipt picture; the server reads all its text (OCR) and the result
   * page shows it as read (extraction only, no check yet).
   */
  const readCbe = async (source: 'camera' | 'library') => {
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
      // Extraction only for now: show all the text read from the picture, nothing else.
      if (!asset.base64) throw new Error('no image data');
      const { text } = await readReference(asset.base64);
      setReading(false);
      router.push({
        pathname: '/verify/qr-result',
        params: { text: text.trim() || t('verifyBank.extracted.empty'), mode: 'read' },
      });
    } catch (error) {
      failed(error);
    }
  };

  // Other banks: FAKE reading for now.
  const read = () => {
    setReading(true);
    readReceipt(bank.fields)
      .then((found) => {
        setFound(found);
        router.replace('/verify-bank/found');
      })
      .catch(failed);
  };
  const cbe = bank.code === 'CBE';

  const names = onReceipt(bank).map((f) => t(`verifyBank.short.${f.key}`));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('verifyBank.readReceipt')}
        subtitle={t('verifyBank.stepOf', { step: 2, name: t('verifyBank.steps.receipt') })}
        onBack={goBack}
      />

      <View
        className="mx-4 mt-1 flex-row items-center gap-2.5 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-2"
        accessible
      >
        <BankBadge code={bank.code} size={40} />
        <Text font="bold" className="flex-1 text-[17px]" numberOfLines={1}>
          {bank.shortName}
        </Text>
        <MoneyText value={amount} className="text-xl" />
      </View>

      <View className="flex-1 items-center justify-center gap-4 px-6">
        <SampleReceipt bank={bank} />
        <Text font="bold" className="text-center text-[17px]">
          {t('verifyBank.read.keepInFrame', {
            things: names.join(` ${t('verifyBank.and')} `),
          })}
        </Text>
      </View>

      <View className="gap-2.5 px-4 pb-6 pt-2">
        <Button
          label={t('verifyBank.read.photo')}
          icon={Camera}
          onPress={cbe ? () => void readCbe('camera') : read}
        />
        <Button
          label={t('verifyBank.read.screenshot')}
          icon={ImageIcon}
          variant="outline"
          size="md"
          onPress={cbe ? () => void readCbe('library') : read}
        />
      </View>
    </SafeAreaView>
  );
}
