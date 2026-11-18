import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

export function SecureFooter() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-center gap-1.5">
      <Lock size={14} color={colors.muted} strokeWidth={2.4} />
      <Text font="bold" tone="muted" className="text-[13px] tracking-[0.8px]">
        {t('brand.secure')}
      </Text>
    </View>
  );
}
