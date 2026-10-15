import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, CircleCheck, CircleX, Image as ImageIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SpinnerRing } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { errorMessageKey } from '@/lib/errors';
import { compareReading, type ReadResult } from '@/lib/verification';
import { colors } from '@/theme/tokens';

function ResultCard({ title, result }: { title: string; result: ReadResult }) {
  const { t } = useTranslation();
  const found = Boolean(result.reference);
  return (
    <View className="gap-2 rounded-card border-[1.5px] border-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text font="heading" className="text-lg">
          {title}
        </Text>
        <Text tone="muted" className="text-sm">
          {(result.ms / 1000).toFixed(1)} s
        </Text>
      </View>
      {result.ok ? (
        <>
          <View className="flex-row items-center gap-2">
            {found ? (
              <CircleCheck size={20} color={colors.success} strokeWidth={2.4} />
            ) : (
              <CircleX size={20} color={colors.dangerFg} strokeWidth={2.4} />
            )}
            <Text font="bold" className={`text-base ${found ? 'text-success' : 'text-dangerFg'}`}>
              {result.reference ?? t('devCompare.noReference')}
            </Text>
          </View>
          {result.amount != null || result.date ? (
            <Text tone="muted" className="text-sm">
              {[
                result.amount != null ? `${t('devCompare.amount')}: ${result.amount}` : null,
                result.date ? `${t('devCompare.date')}: ${result.date}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          <View className="rounded-input bg-background p-3">
            <Text className="text-sm" selectable>
              {result.text?.trim() || t('devCompare.noText')}
            </Text>
          </View>
        </>
      ) : (
        <Text font="semibold" className="text-base text-dangerFg">
          {t('devCompare.failed', { reason: result.error ?? '' })}
        </Text>
      )}
    </View>
  );
}

/**
 * DEVELOPMENT ONLY: reads one receipt picture with Gemini and with OCR + regex, side by side,
 * to compare how well each finds the Transaction ID.
 */
export default function ReadCompareScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ gemini: ReadResult; tesseract: ReadResult } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      setError(t('verify.scan.permissionBody'));
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.9,
    };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset?.base64) return;

    setUri(asset.uri);
    setResults(null);
    setBusy(true);
    try {
      setResults(await compareReading(asset.base64));
    } catch (e) {
      setError(t(errorMessageKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('devCompare.title')}
        subtitle={t('devCompare.subtitle')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      />
      <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 24 }}>
        <View className="gap-2.5">
          <Button
            label={t('verifyBank.read.photo')}
            icon={Camera}
            disabled={busy}
            onPress={() => void pick('camera')}
          />
          <Button
            label={t('verifyBank.read.screenshot')}
            icon={ImageIcon}
            variant="outline"
            size="md"
            disabled={busy}
            onPress={() => void pick('library')}
          />
        </View>

        {uri ? (
          <Image
            source={{ uri }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            className="h-56 w-full rounded-input bg-surface"
          />
        ) : null}

        {busy ? (
          <View className="items-center gap-3 py-6">
            <SpinnerRing size={48}>
              <View className="h-2.5 w-2.5 rounded-full bg-primary" />
            </SpinnerRing>
            <Text tone="muted" className="text-base">
              {t('devCompare.reading')}
            </Text>
          </View>
        ) : null}

        {results ? (
          <>
            <ResultCard title={t('devCompare.gemini')} result={results.gemini} />
            <ResultCard title={t('devCompare.ocr')} result={results.tesseract} />
          </>
        ) : null}
      </ScrollView>

      <ErrorDialog
        visible={error !== null}
        title={t('common.error')}
        message={error ?? ''}
        actionLabel={t('common.done')}
        onClose={() => setError(null)}
      />
    </SafeAreaView>
  );
}
