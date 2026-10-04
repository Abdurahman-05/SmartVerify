import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

export function SecureFooter() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-center gap-2">
      <Lock size={18} color={colors.primaryText} strokeWidth={2.2} />
      <Text font="bold" tone="muted" className="text-sm tracking-[1px]">
        {t('brand.secure')}
      </Text>
    </View>
  );
}
