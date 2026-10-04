import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

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
      <View className="min-h-14 flex-row items-center gap-1 px-2.5">
        {showBack ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-border"
          >
            <ChevronLeft size={28} color={colors.text} strokeWidth={2} />
          </Pressable>
        ) : null}
        <Text font="heading" className={`text-[22px] ${showBack ? '' : 'pl-2'}`} accessibilityRole="header">
          {t(titleKey)}
        </Text>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        <Text tone="muted" className="text-center text-lg">
          {t('placeholder.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
