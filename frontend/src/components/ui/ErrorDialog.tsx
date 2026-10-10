import { X } from 'lucide-react-native';
import { Modal, Pressable, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

interface ErrorDialogProps {
  visible: boolean;
  title: string;
  message: string;
  actionLabel: string;
  onClose: () => void;
}

/** Red error popup in the style of the failed-payment screens. Shows above the keyboard. */
export function ErrorDialog({ visible, title, message, actionLabel, onClose }: ErrorDialogProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(20,32,27,0.62)' }}
      >
        {/* Tapping outside closes, like the bottom sheets. */}
        <Pressable className="absolute inset-0" onPress={onClose} accessible={false} />

        <View
          className="w-full max-w-[400px] overflow-hidden rounded-[28px] border-2 border-dangerBg bg-surface"
          accessibilityViewIsModal
          accessibilityLiveRegion="assertive"
        >
          <View className="items-center bg-dangerSurface pb-5 pt-7">
            <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-dangerBg">
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.alert }}
              >
                <X size={30} color={colors.surface} strokeWidth={2.8} />
              </View>
            </View>
          </View>

          <View className="gap-2 px-6 pt-5">
            <Text
              font="heading"
              className="text-center text-[24px]"
              style={{ color: colors.dangerFg }}
              accessibilityRole="header"
            >
              {title}
            </Text>
            <Text className="text-center text-[17px] leading-6">{message}</Text>
          </View>

          <View className="px-5 pb-5 pt-6">
            <Button label={actionLabel} variant="danger" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
