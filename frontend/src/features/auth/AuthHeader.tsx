import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BrandMark } from '@/components/ui/BrandMark';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

interface AuthHeaderProps {
  onBack?: () => void;
}

export function AuthHeader({ onBack }: AuthHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className={`flex-row items-center gap-2 pb-1.5 pr-5 pt-5 ${onBack ? 'pl-2.5' : 'pl-5'}`}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-border"
        >
          <ChevronLeft size={28} color={colors.text} strokeWidth={2} />
        </Pressable>
      ) : null}
      <BrandMark size={onBack ? 40 : 44} />
      <Text font="heading" className="ml-0.5 flex-1 text-xl" numberOfLines={1}>
        {t('brand.name')}
      </Text>
      <LanguageToggle />
    </View>
  );
}
