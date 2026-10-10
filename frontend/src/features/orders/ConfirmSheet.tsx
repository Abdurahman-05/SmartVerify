import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { MoneyText } from '@/components/ui/MoneyText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { OrderLine } from '@/lib/mock/restaurant';

interface ConfirmSheetProps {
  visible: boolean;
  tableNumber: number;
  lines: OrderLine[];
  total: number;
  onConfirm: () => void;
  onChangeTable: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  visible,
  tableNumber,
  lines,
  total,
  onConfirm,
  onChangeTable,
  onClose,
}: ConfirmSheetProps) {
  const { t } = useTranslation();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="items-center rounded-input bg-amber px-4 py-3" accessible>
        <Text font="bold" className="text-base">
          {t('orders.confirmQuestion')}
        </Text>
        <Text font="heading" className="text-[40px] leading-tight">
          {t('orders.table', { number: tableNumber })}
        </Text>
      </View>
      <View className="gap-2">
        {lines.map((line) => (
          <View key={line.itemId} className="flex-row justify-between gap-3">
            <Text font="semibold" className="flex-1 text-xl">
              {line.quantity} × {line.name}
            </Text>
            <MoneyText value={line.priceEtb * line.quantity} font="semibold" className="text-xl" />
          </View>
        ))}
        <View className="flex-row justify-between border-t-2 border-border pt-2.5">
          <Text font="bold" className="text-[22px]">
            {t('orders.total')}
          </Text>
          <MoneyText value={total} font="bold" className="text-[22px]" />
        </View>
      </View>
      <Button label={t('orders.yesSend', { number: tableNumber })} onPress={onConfirm} />
      <Button label={t('orders.noChange')} variant="outline" size="md" onPress={onChangeTable} />
    </BottomSheet>
  );
}
