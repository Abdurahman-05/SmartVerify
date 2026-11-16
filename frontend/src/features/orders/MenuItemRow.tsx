import { Image } from 'expo-image';
import { CupSoda, Minus, Plus, Soup, Utensils, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { formatMoney } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { menuPhotoFor } from '@/lib/menuPhotos';
import type { MenuCategory } from '@/lib/mock/restaurant';
import type { MenuItem } from '@/lib/restaurant';
import { useGlass } from '@/components/ui/glassTokens';

export const categoryIcon: Record<MenuCategory, LucideIcon> = {
  food: Soup,
  drinks: CupSoda,
  combos: Utensils,
};

interface MenuItemRowProps {
  item: MenuItem;
  /** Simple number in the menu (1, 2, 3…), to find and call out an item quickly. */
  number: number;
  quantity: number;
  onChange: (quantity: number) => void;
  /** First row of the card: no divider above it. */
  first?: boolean;
}

/** One step button of the brand stepper (− / +), 40 × 44. */
function StepButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
}: {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      className="h-11 w-10 items-center justify-center active:opacity-70"
    >
      <Icon size={18} color="#FFFFFF" strokeWidth={2.6} />
    </Pressable>
  );
}

/**
 * A menu row inside the New order card (design `.mi`): 48 px photo or icon tile, name, price,
 * and "+ ADD" — or a brand stepper (− quantity +) once it is in the order.
 */
export function MenuItemRow({ item, number, quantity, onChange, first }: MenuItemRowProps) {
  const g = useGlass();
  const { t } = useTranslation();
  const Icon = categoryIcon[item.category];
  const photo = menuPhotoFor(item.catalogKey);
  const inOrder = quantity > 0;

  return (
    <View
      className={`flex-row items-center gap-3 py-2 ${first ? '' : 'border-t border-black/[0.07]'}`}
    >
      <View
        className="h-12 w-12 items-center justify-center overflow-hidden rounded-full"
        style={{ backgroundColor: g.tile }}
      >
        {photo ? (
          <Image
            source={photo}
            style={{ width: 48, height: 48 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Icon size={24} color={g.primaryDeep} strokeWidth={1.8} />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-base leading-5" numberOfLines={2}>
          <Text font="bold" tone="muted" className="text-[13px]">
            {number}.{' '}
          </Text>
          {item.name}
        </Text>
        <Text tone="muted" className="text-sm">
          {formatMoney(item.priceEtb)}
        </Text>
      </View>
      {inOrder ? (
        <View
          className="h-11 flex-row items-center rounded-full"
          style={{ backgroundColor: g.primaryDeep }}
        >
          <StepButton
            icon={Minus}
            accessibilityLabel={t('orders.removeOne', { name: item.name })}
            onPress={() => onChange(quantity - 1)}
          />
          <Text
            font="heading"
            tone="inverse"
            className="min-w-[22px] text-center text-base"
            accessibilityLiveRegion="polite"
          >
            {quantity}
          </Text>
          <StepButton
            icon={Plus}
            accessibilityLabel={t('orders.addOne', { name: item.name })}
            onPress={() => onChange(quantity + 1)}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => onChange(1)}
          accessibilityRole="button"
          accessibilityLabel={t('orders.addItem', { name: item.name })}
          className="h-11 flex-row items-center gap-1 rounded-full border-2 px-3.5 active:opacity-80"
          style={{ borderColor: g.primary }}
        >
          <Plus size={16} color={g.primaryDeep} strokeWidth={2.6} />
          <Text font="bold" className="text-sm" style={{ color: g.primaryDeep }}>
            {t('orders.add')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
