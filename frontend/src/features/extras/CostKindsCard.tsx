import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import {
  costKindsKey,
  expenseCategories,
  getCostKinds,
  setCostKinds,
  spendingsKey,
  type ExpenseCategory,
} from '@/lib/extras';

/**
 * Owner (Money out on): which kinds of spending count as business costs. Tapping a kind turns it
 * on or off at once; Money flow's profit and every expense's "Business cost" follow.
 */
export function CostKindsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: costKindsKey, queryFn: getCostKinds });
  const save = useMutation({
    mutationFn: setCostKinds,
    onSuccess: (kinds) => {
      queryClient.setQueryData(costKindsKey, kinds);
      void queryClient.invalidateQueries({ queryKey: spendingsKey });
      void queryClient.invalidateQueries({ queryKey: ['money-flow'] });
    },
  });

  const kinds = query.data ?? [];
  const toggle = (kind: ExpenseCategory) =>
    save.mutate(kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind]);

  return (
    <View className="gap-2 rounded-[18px] border-[1.5px] border-border bg-surface px-3 py-3">
      <Text font="bold" className="text-base" accessibilityRole="header">
        {t('extras.costs.title')}
      </Text>
      <Text tone="muted" className="text-sm leading-5">
        {t('extras.costs.hint')}
      </Text>
      <View
        className={`flex-row flex-wrap gap-2 pt-1 ${save.isPending || !query.data ? 'opacity-60' : ''}`}
        pointerEvents={save.isPending || !query.data ? 'none' : 'auto'}
      >
        {expenseCategories.map((c) => (
          <Pill
            key={c}
            label={t(`extras.money.categories.${c}`)}
            selected={kinds.includes(c)}
            dark
            onPress={() => toggle(c)}
          />
        ))}
      </View>
      {save.isError ? (
        <Text className="text-sm text-dangerFg">{t('extras.costs.failed')}</Text>
      ) : null}
    </View>
  );
}
