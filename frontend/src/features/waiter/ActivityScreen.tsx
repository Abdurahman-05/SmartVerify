import { CircleDollarSign, Clock, FileBarChart, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import ReportScreen from '@/features/reports/ReportScreen';
import TipsScreen from '@/features/tips/TipsScreen';
import TransactionsScreen from '@/features/transactions/TransactionsScreen';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

type Part = 'transactions' | 'tips' | 'reports';

const parts: { key: Part; icon: LucideIcon }[] = [
  { key: 'transactions', icon: Clock },
  { key: 'tips', icon: CircleDollarSign },
  { key: 'reports', icon: FileBarChart },
];

/**
 * Waiter's "Activity" tab: the existing Transactions, Tips and Reports pages, unchanged, with a
 * small switch under them.
 */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const brand = useBrandColors();
  const [part, setPart] = useState<Part>('transactions');

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        {part === 'transactions' ? (
          <TransactionsScreen />
        ) : part === 'tips' ? (
          <TipsScreen />
        ) : (
          <ReportScreen />
        )}
      </View>

      <View
        className="flex-row gap-1.5 border-t border-border bg-surface px-3 py-2"
        accessibilityRole="tablist"
      >
        {parts.map(({ key, icon: Icon }) => {
          const selected = part === key;
          return (
            <Pressable
              key={key}
              onPress={() => setPart(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2 ${
                selected ? 'bg-primary' : 'bg-background active:bg-border'
              }`}
            >
              <Icon size={18} color={selected ? colors.surface : brand.primary} strokeWidth={2.2} />
              <Text
                font="bold"
                tone={selected ? 'inverse' : 'default'}
                className="text-sm"
                numberOfLines={1}
              >
                {t(`waiterNav.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
