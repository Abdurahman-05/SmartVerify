import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Copy, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';

/** TEMPORARY: shows exactly what the scanned QR says, before we parse it per bank. */
export default function QrResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // mode=read: what was read from a receipt picture (extraction only, temporary).
  const { text = '', mode } = useLocalSearchParams<{ text?: string; mode?: 'read' }>();
  const read = mode === 'read';
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Back to the scanner, which unlocks itself when it is shown again.
  const scanAgain = () =>
    router.canGoBack() ? router.back() : router.replace('/verify-bank/scan');

  const copy = () => {
    void Clipboard.setStringAsync(text).then(() => setCopied(true));
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t(read ? 'verifyBank.qrResult.readTitle' : 'verifyBank.qrResult.title')}
        onBack={scanAgain}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="rounded-card border-[1.5px] border-border bg-surface p-4">
          <Text className="text-base" selectable>
            {text}
          </Text>
        </View>
      </ScrollView>
      <View className="gap-2.5 px-4 pb-6 pt-2">
        <Button
          label={t(read ? 'verifyBank.found.readAgain' : 'verifyBank.scan.again')}
          icon={RotateCcw}
          onPress={scanAgain}
        />
        <Button
          label={t(copied ? 'verifyBank.qrResult.copied' : 'verifyBank.qrResult.copy')}
          icon={copied ? Check : Copy}
          variant="outline"
          size="md"
          onPress={copy}
        />
      </View>
    </SafeAreaView>
  );
}
