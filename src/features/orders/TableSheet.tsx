import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { Table, TableArea } from '@/lib/mock/restaurant';

import { Pill } from './Pill';

const areas: TableArea[] = ['main', 'upstairs', 'outside'];

interface TableSheetProps {
  visible: boolean;
  tables: Table[];
  currentId: string | null;
  onSelect: (table: Table) => void;
  onClose: () => void;
}

export function TableSheet({ visible, tables, currentId, onSelect, onClose }: TableSheetProps) {
  const { t } = useTranslation();
  const currentArea = tables.find((tb) => tb.id === currentId)?.area ?? 'main';
  const [area, setArea] = useState<TableArea>(currentArea);
  const shown = tables.filter((tb) => tb.area === area);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text font="heading" className="text-[26px]" accessibilityRole="header">
        {t('orders.chooseTable')}
      </Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {areas.map((a) => (
          <Pill key={a} label={t(`orders.area.${a}`)} selected={area === a} dark onPress={() => setArea(a)} />
        ))}
      </View>
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
        {shown.map((table) => {
          const isNow = table.id === currentId;
          const state = isNow ? t('orders.tableNow') : table.busy ? t('orders.tableBusy') : t('orders.tableFree');
          const disabled = table.busy && !isNow;
          return (
            <View key={table.id} className="w-1/4 p-[5px]">
              <Pressable
                onPress={() => {
                  onSelect(table);
                  onClose();
                }}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityLabel={t('orders.tableLabel', { number: table.number, state })}
                accessibilityState={{ selected: isNow, disabled }}
                className={`h-[66px] items-center justify-center rounded-[18px] ${
                  isNow
                    ? 'bg-primary'
                    : disabled
                      ? 'border-2 border-borderMid bg-neutralBg'
                      : 'border-2 border-primary bg-surface active:bg-primarySoft'
                }`}
              >
                <Text font="heading" tone={isNow ? 'inverse' : disabled ? 'muted' : 'default'} className="text-2xl leading-tight">
                  {table.number}
                </Text>
                <Text font="semibold" tone={isNow ? 'inverse' : disabled ? 'muted' : 'default'} className="text-sm">
                  {state}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Button label={t('orders.cancel')} variant="outline" size="md" onPress={onClose} />
    </BottomSheet>
  );
}
