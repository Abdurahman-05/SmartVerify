import { Eye, EyeOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { colors } from '@/theme/tokens';

interface PinVisibilityButtonProps {
  visible: boolean;
  onToggle: () => void;
}

export function PinVisibilityButton({ visible, onToggle }: PinVisibilityButtonProps) {
  const { t } = useTranslation();
  const Icon = visible ? EyeOff : Eye;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={visible ? t('common.hidePin') : t('common.showPin')}
      className="h-11 w-11 items-center justify-center"
    >
      <Icon size={24} color={colors.muted} strokeWidth={2} />
    </Pressable>
  );
}
