import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { MoneyText } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

import type { BillOrder } from './types';

/** Change how many of each item, before the kitchen starts. 0 removes the item. */
export function EditOrderSheet({
  order,
  saving,
  onSave,
  onClose,
}: {
  order: BillOrder;
  saving: boolean;
  onSave: (items: { menuItemId: string; quantity: number }[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Only lines still on the menu can be kept (the server prices them again).
  const lines = order.items.filter((i): i is typeof i & { menuItemId: string } => !!i.menuItemId);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.menuItemId, l.quantity]))
  );
  const kept = lines.filter((l) => (qty[l.menuItemId] ?? 0) > 0);
  const total = kept.reduce((sum, l) => sum + l.priceEtb * (qty[l.menuItemId] ?? 0), 0);
  const step = (id: string, by: number) =>
    setQty((q) => ({ ...q, [id]: Math.min(99, Math.max(0, (q[id] ?? 0) + by)) }));

  return (
    <BottomSheet visible onClose={onClose}>
      <Text font="heading" className="text-xl" accessibilityRole="header">
        {t('bills.change.title', { number: order.number })}
      </Text>
      <View className="gap-2">
        {lines.map((l) => {
          const q = qty[l.menuItemId] ?? 0;
          return (
            <View key={l.menuItemId} className="flex-row items-center gap-3">
              <Text
                font="semibold"
                className={`flex-1 text-[17px] ${q === 0 ? 'line-through opacity-50' : ''}`}
              >
                {l.name}
              </Text>
              <Pressable
                onPress={() => step(l.menuItemId, -1)}
                disabled={q === 0}
                accessibilityRole="button"
                accessibilityLabel={t('bills.change.less', { name: l.name })}
                className="h-11 w-11 items-center justify-center rounded-full border-2 border-borderStrong active:bg-background"
              >
                <Minus size={20} color={colors.text} strokeWidth={2.4} />
              </Pressable>
              <Text font="bold" className="w-8 text-center text-lg">
                {q}
              </Text>
              <Pressable
                onPress={() => step(l.menuItemId, 1)}
                accessibilityRole="button"
                accessibilityLabel={t('bills.change.more', { name: l.name })}
                className="h-11 w-11 items-center justify-center rounded-full border-2 border-borderStrong active:bg-background"
              >
                <Plus size={20} color={colors.text} strokeWidth={2.4} />
              </Pressable>
            </View>
          );
        })}
      </View>
      <View className="flex-row items-baseline justify-between">
        <Text font="bold" className="text-base">
          {t('bills.change.newTotal')}
        </Text>
        <MoneyText value={total} font="bold" className="text-lg" />
      </View>
      {kept.length === 0 ? (
        <Text tone="muted" className="text-[15px]">
          {t('bills.change.emptyHint')}
        </Text>
      ) : null}
      <Button
        label={t('bills.change.save')}
        disabled={kept.length === 0 || saving}
        onPress={() =>
          onSave(kept.map((l) => ({ menuItemId: l.menuItemId, quantity: qty[l.menuItemId] ?? 0 })))
        }
      />
    </BottomSheet>
  );
}
