import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from './ScreenHeader';
import { Text } from './Text';

interface PlaceholderScreenProps {
  titleKey: string;
  showBack?: boolean;
}

export function PlaceholderScreen({ titleKey, showBack = true }: PlaceholderScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScreenHeader
        title={t(titleKey)}
        onBack={
          showBack
            ? () => (router.canGoBack() ? router.back() : router.replace('/home'))
            : undefined
        }
      />
      <View className="flex-1 items-center justify-center px-6">
        <Text tone="muted" className="text-center text-lg">
          {t('placeholder.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
