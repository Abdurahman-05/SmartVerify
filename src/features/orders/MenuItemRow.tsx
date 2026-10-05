import { CupSoda, Soup, Utensils, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { formatAmount } from '@/lib/format';
import type { MenuCategory, MenuItem } from '@/lib/api/restaurant';
import { colors } from '@/theme/tokens';

const categoryIcon: Record<MenuCategory, LucideIcon> = {
  food: Soup,
  drinks: CupSoda,
  combos: Utensils,
};

interface MenuItemRowProps {
  item: MenuItem;
  quantity: number;
  onChange: (quantity: number) => void;
}

function RoundButton({
  label,
  filled,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  filled: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      className={`h-12 w-12 items-center justify-center rounded-full ${
        filled ? 'bg-primary active:opacity-80' : 'border-2 border-primary bg-surface active:bg-background'
      }`}
    >
      <Text font="bold" tone={filled ? 'inverse' : 'default'} className={`text-[28px] leading-8 ${filled ? '' : 'text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MenuItemRow({ item, quantity, onChange }: MenuItemRowProps) {
  const { t } = useTranslation();
  const Icon = categoryIcon[item.category];
  const inOrder = quantity > 0;

  return (
    <View
      className={`flex-row items-center gap-3 rounded-[18px] py-2 pl-2 pr-2.5 ${
        inOrder ? 'border-[2.5px] border-primary bg-primarySoft' : 'border-[1.5px] border-border bg-surface'
      }`}
    >
      <View className="h-16 w-16 items-center justify-center rounded-[14px] bg-successBg">
        <Icon size={28} color={colors.primary} strokeWidth={1.8} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px] leading-tight">
          {item.name}
        </Text>
        <Text font="bold" tone="link" className="mt-[3px] text-[17px]">
          {formatAmount(item.priceEtb)} {t('common.etb')}
        </Text>
      </View>
      {inOrder ? (
        <View className="flex-row items-center gap-0.5">
          <RoundButton
            label="−"
            filled={false}
            accessibilityLabel={t('orders.removeOne', { name: item.name })}
            onPress={() => onChange(quantity - 1)}
          />
          <Text
            font="bold"
            className="min-w-[30px] text-center text-[22px]"
            accessibilityLiveRegion="polite"
          >
            {quantity}
          </Text>
          <RoundButton
            label="+"
            filled
            accessibilityLabel={t('orders.addOne', { name: item.name })}
            onPress={() => onChange(quantity + 1)}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => onChange(1)}
          accessibilityRole="button"
          accessibilityLabel={t('orders.addItem', { name: item.name })}
          className="h-12 justify-center rounded-3xl bg-primary px-5 active:opacity-80"
        >
          <Text font="bold" tone="inverse" className="text-[17px]">
            {t('orders.add')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
