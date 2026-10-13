import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, FileText, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankBadge } from '@/components/ui/BankBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

import { findPayerBank } from './payerBanks';
import { useReceiptFlow } from './receiptFlow';
import { PermissionView, ScanFrame } from './ScanScreen';
import { useVerifyFlow } from './verifyFlow';

/** Step 2: scan the receipt QR (VerifyScanQR + VerifyQRNotFound). */
export default function ScanReceiptQrScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const amount = useVerifyFlow((s) => s.amount);
  const bankCode = useReceiptFlow((s) => s.bankCode);
  const setFound = useReceiptFlow((s) => s.setFound);
  const bank = findPayerBank(bankCode);
  // Scanning pauses while a QR is handled or the "No QR found" sheet is open.
  const [paused, setPaused] = useState(false);
  const [notFound, setNotFound] = useState(false);

  if (!bank || amount <= 0) return <Redirect href="/verify-bank" />;

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/verify-bank/receipt');
  const readReceipt = () => {
    setNotFound(false);
    router.replace('/verify-bank/read');
  };

  if (!permission) return <View className="flex-1 bg-black" />;
  if (!permission.granted) {
    return (
      <PermissionView
        canAskAgain={permission.canAskAgain}
        onAllow={requestPermission}
        onClose={goBack}
      />
    );
  }

  const handleScanned = ({ data }: BarcodeScanningResult) => {
    if (paused) return;
    setPaused(true);
    const values = bank.parseQr(data);
    if (!values) {
      setNotFound(true);
      return;
    }
    setFound(values);
    router.replace('/verify-bank/found');
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={paused ? undefined : handleScanned}
      />

      <SafeAreaView className="absolute inset-0" pointerEvents="box-none">
        <View className="flex-row items-center gap-1 px-2 pt-3.5" pointerEvents="box-none">
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/40"
          >
            <ChevronLeft size={28} color={colors.surface} strokeWidth={2.2} />
          </Pressable>
          <Text font="heading" tone="inverse" className="text-[22px]" accessibilityRole="header">
            {t('verifyBank.scan.title')}
          </Text>
        </View>

        <View
          className="mx-4 mt-2 flex-row items-center justify-between rounded-2xl bg-white/15 px-3 py-2"
          accessible
        >
          <View className="flex-row items-center gap-2.5">
            <BankBadge code={bank.code} size={40} />
            <Text font="bold" tone="inverse" className="text-[17px]">
              {bank.shortName}
            </Text>
          </View>
          <MoneyText value={amount} tone="inverse" className="text-xl" />
        </View>

        <View
          className={`flex-1 items-center justify-center gap-6 ${notFound ? 'opacity-40' : ''}`}
          pointerEvents="none"
        >
          <ScanFrame />
          <Text font="semibold" tone="inverse" className="px-8 text-center text-[19px]">
            {t('verifyBank.scan.hint')}
          </Text>
        </View>

        <View className="px-4 pb-6">
          <Pressable
            onPress={readReceipt}
            accessibilityRole="button"
            className="h-[60px] flex-row items-center justify-center gap-2.5 rounded-[20px] border-2 border-white/70 active:bg-white/10"
          >
            <FileText size={22} color={colors.surface} strokeWidth={2.2} />
            <Text font="bold" tone="inverse" className="text-lg">
              {t('verifyBank.scan.noQr')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <BottomSheet
        visible={notFound}
        onClose={() => {
          setNotFound(false);
          setPaused(false);
        }}
      >
        <Text font="heading" className="text-center text-2xl" accessibilityRole="header">
          {t('verifyBank.scan.notFound')}
        </Text>
        <Button label={t('verifyBank.readReceipt')} icon={FileText} onPress={readReceipt} />
        <Button
          label={t('verifyBank.scan.again')}
          icon={RotateCcw}
          variant="outline"
          size="md"
          onPress={() => {
            setNotFound(false);
            setPaused(false);
          }}
        />
      </BottomSheet>
    </View>
  );
}
