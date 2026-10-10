import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrandColors } from '@/store/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { Text } from './Text';

export interface SheetOption<T extends string> {
  value: T;
  label: string;
  leading?: ReactNode;
}

interface OptionSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: SheetOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

/** Bottom sheet with a single-choice list. */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionSheetProps<T>) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityLabel={t('verify.scan.close')}
      />
      <SafeAreaView edges={['bottom']} className="rounded-t-card bg-surface px-4 pt-4">
        <Text font="heading" className="pb-3 text-xl" accessibilityRole="header">
          {title}
        </Text>
        <ScrollView
          style={{ maxHeight: height * 0.6 }}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                className={`min-h-14 flex-row items-center gap-3 rounded-[18px] border-2 px-4 py-2 ${
                  isSelected ? 'border-primary bg-primarySoft' : 'border-border bg-surface'
                }`}
              >
                {option.leading}
                <Text font="bold" className="flex-1 text-lg">
                  {option.label}
                </Text>
                {isSelected ? <Check size={24} color={brand.primary} strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
