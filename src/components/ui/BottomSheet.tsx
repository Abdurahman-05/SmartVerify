import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1"
        style={{ backgroundColor: 'rgba(20,32,27,0.62)' }}
        onPress={onClose}
        accessibilityLabel={t('verify.scan.close')}
      />
      <SafeAreaView edges={['bottom']} className="rounded-t-[28px] bg-surface">
        <View className="gap-3.5 px-4 pb-4 pt-6">{children}</View>
      </SafeAreaView>
    </Modal>
  );
}
