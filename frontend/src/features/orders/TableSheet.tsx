import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { areaLabel } from '@/lib/areaLabel';
import type { Table } from '@/lib/restaurant';
import { tableCategoryKey } from '@/lib/tableCategories';

import { Pill } from './Pill';

interface TableSheetProps {
  visible: boolean;
  tables: Table[];
  currentId: string | null;
  onSelect: (table: Table) => void;
  onClose: () => void;
}

export function TableSheet({ visible, tables, currentId, onSelect, onClose }: TableSheetProps) {
  const { t, i18n } = useTranslation();
  // One tab per category that has tables (the server sends them in the owner's order).
  const groups = tables.filter(
    (tb, index) =>
      tables.findIndex((other) => tableCategoryKey(other) === tableCategoryKey(tb)) === index
  );
  const current = tables.find((tb) => tb.id === currentId);
  const [picked, setPicked] = useState(current ? tableCategoryKey(current) : null);
  const area = groups.some((g) => tableCategoryKey(g) === picked)
    ? picked
    : groups[0]
      ? tableCategoryKey(groups[0])
      : null;
  const shown = tables.filter((tb) => tableCategoryKey(tb) === area);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text font="heading" className="text-[26px]" accessibilityRole="header">
        {t('orders.chooseTable')}
      </Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {groups.map((g) => (
          <Pill
            key={tableCategoryKey(g)}
            label={areaLabel(t, i18n.language, g.area, g.categoryNameAm)}
            selected={area === tableCategoryKey(g)}
            dark
            onPress={() => setPicked(tableCategoryKey(g))}
          />
        ))}
      </View>
      {shown.length === 0 ? (
        <View className="gap-1 py-2">
          <Text font="bold" className="text-base">
            {t('orders.noTables')}
          </Text>
          <Text tone="muted" className="text-sm">
            {t('orders.noTablesHint')}
          </Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
        {shown.map((table) => {
          const isNow = table.id === currentId;
          const state = isNow
            ? t('orders.tableNow')
            : table.busy
              ? t('orders.tableBusy')
              : t('orders.tableFree');
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
                <Text
                  font="heading"
                  tone={isNow ? 'inverse' : disabled ? 'muted' : 'default'}
                  className="text-2xl leading-tight"
                >
                  {table.number}
                </Text>
                <Text
                  font="semibold"
                  tone={isNow ? 'inverse' : disabled ? 'muted' : 'default'}
                  className="text-sm"
                >
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
