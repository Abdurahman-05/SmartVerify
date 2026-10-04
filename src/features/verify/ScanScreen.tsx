import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatAmount, parseAmount } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { useVerifyFlow } from './verifyFlow';

const FRAME = 250;
const CORNER = 36;

function CloseButton({ onPress, light }: { onPress: () => void; light?: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('verify.scan.close')}
      className={`h-11 w-11 items-center justify-center rounded-full ${light ? 'bg-black/50' : 'active:bg-border'}`}
    >
      <X size={26} color={light ? colors.surface : colors.text} strokeWidth={2.4} />
    </Pressable>
  );
}

function ScanFrame() {
  const corner = 'absolute border-accent';
  const size = { width: CORNER, height: CORNER };
  return (
    <View style={{ width: FRAME, height: FRAME }}>
      <View className={`${corner} left-0 top-0 rounded-tl-[22px] border-l-[5px] border-t-[5px]`} style={size} />
      <View className={`${corner} right-0 top-0 rounded-tr-[22px] border-r-[5px] border-t-[5px]`} style={size} />
      <View className={`${corner} bottom-0 left-0 rounded-bl-[22px] border-b-[5px] border-l-[5px]`} style={size} />
      <View className={`${corner} bottom-0 right-0 rounded-br-[22px] border-b-[5px] border-r-[5px]`} style={size} />
    </View>
  );
}

function PermissionView({
  canAskAgain,
  onAllow,
  onClose,
}: {
  canAskAgain: boolean;
  onAllow: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-2.5 pt-4">
        <CloseButton onPress={onClose} />
      </View>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <View className="h-24 w-24 items-center justify-center rounded-[28px] bg-successBg">
          <Camera size={48} color={colors.primary} strokeWidth={2} />
        </View>
        <Text font="heading" className="text-center text-[26px]" accessibilityRole="header">
          {t('verify.scan.permissionTitle')}
        </Text>
        <Text tone="muted" className="text-center text-lg">
          {t('verify.scan.permissionBody')}
        </Text>
      </View>
      <View className="px-4 pb-7">
        <Button
          label={canAskAgain ? t('verify.scan.allow') : t('verify.scan.openSettings')}
          onPress={canAskAgain ? onAllow : () => Linking.openSettings()}
        />
      </View>
    </SafeAreaView>
  );
}

export default function ScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { account, amountInput, setQrData } = useVerifyFlow();
  const amount = parseAmount(amountInput);

  if (!account || amount <= 0) return <Redirect href="/verify" />;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/verify'));

  if (!permission) return <View className="flex-1 bg-black" />;

  if (!permission.granted) {
    return (
      <PermissionView
        canAskAgain={permission.canAskAgain}
        onAllow={requestPermission}
        onClose={close}
      />
    );
  }

  const handleScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    setQrData(data);
    router.replace('/checking');
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleScanned}
      />

      <SafeAreaView className="absolute inset-0" pointerEvents="box-none">
        <View className="flex-row items-center gap-2 px-2.5 pt-4" pointerEvents="box-none">
          <CloseButton onPress={close} light />
          <Text font="heading" tone="inverse" className="text-xl" accessibilityRole="header">
            {t('verify.scan.title')}
          </Text>
        </View>

        <View className="flex-1 items-center justify-center gap-6" pointerEvents="none">
          <ScanFrame />
          <Text font="semibold" tone="inverse" className="px-8 text-center text-lg">
            {t('verify.scan.hint')}
          </Text>
        </View>

        <View className="mx-4 mb-6 flex-row items-center justify-between rounded-[20px] bg-primary px-[18px] py-3">
          <View className="flex-1 pr-3">
            <Text font="semibold" tone="inverse" className="text-base">
              {t('verify.scan.waitingFor')}
            </Text>
            <Text tone="inverse" className="text-sm opacity-90" numberOfLines={1}>
              {account.bankName}
            </Text>
          </View>
          <Text font="heading" tone="inverse" className="text-[26px]">
            {formatAmount(amount)} {t('common.etb')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
