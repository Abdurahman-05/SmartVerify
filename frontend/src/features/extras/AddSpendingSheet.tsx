import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { addSpending, spendingsKey, type PaidFrom, type SpendingCategory } from '@/lib/extras';

const MAX_AMOUNT_DIGITS = 7;
export const categories: SpendingCategory[] = ['FOOD', 'TRANSPORT', 'BILLS', 'OTHER'];

/** Bottom sheet: what the money was for, how much, what type, and where it came from. */
export function AddSpendingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<SpendingCategory>('FOOD');
  const [paidFrom, setPaidFrom] = useState<PaidFrom>('CASH');
  const [errors, setErrors] = useState<{ title?: boolean; amount?: boolean }>({});

  const save = useMutation({
    mutationFn: addSpending,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spendingsKey });
      setTitle('');
      setAmount('');
      setCategory('FOOD');
      setPaidFrom('CASH');
      onClose();
    },
  });

  const submit = () => {
    Keyboard.dismiss();
    const next = { title: !title.trim(), amount: Number(amount) < 1 };
    setErrors(next);
    if (next.title || next.amount) return;
    save.mutate({ title: title.trim(), amount: Number(amount), category, paidFrom });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
        <Text font="heading" className="text-[26px]" accessibilityRole="header">
          {t('extras.money.addTitle')}
        </Text>
        <Input
          label={t('extras.money.what')}
          placeholder={t('extras.money.whatPlaceholder')}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setErrors((e) => ({ ...e, title: false }));
          }}
          maxLength={80}
          error={errors.title ? t('extras.errors.title') : undefined}
        />
        <Input
          label={t('extras.money.amount')}
          placeholder="0"
          value={amount}
          onChangeText={(text) => {
            setAmount(digitsOnly(text, MAX_AMOUNT_DIGITS));
            setErrors((e) => ({ ...e, amount: false }));
          }}
          keyboardType="number-pad"
          maxLength={MAX_AMOUNT_DIGITS}
          error={errors.amount ? t('extras.errors.amount') : undefined}
        />
        <View className="gap-1.5">
          <Text font="bold" className="text-base">
            {t('extras.money.type')}
          </Text>
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            {categories.map((c) => (
              <Pill
                key={c}
                label={t(`extras.money.categories.${c}`)}
                selected={category === c}
                dark
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </View>
        <View className="gap-1.5">
          <Text font="bold" className="text-base">
            {t('extras.money.paidFrom')}
          </Text>
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            <Pill
              label={t('extras.cash')}
              selected={paidFrom === 'CASH'}
              dark
              onPress={() => setPaidFrom('CASH')}
            />
            <Pill
              label={t('extras.bank')}
              selected={paidFrom === 'BANK'}
              dark
              onPress={() => setPaidFrom('BANK')}
            />
          </View>
        </View>
        <Button label={t('common.save')} icon={Save} disabled={save.isPending} onPress={submit} />
        <Button label={t('common.cancel')} variant="outline" size="md" onPress={onClose} />
      </ScrollView>

      <ErrorDialog
        visible={save.isError}
        title={t('extras.money.failedTitle')}
        message={t(errorMessageKey(save.error))}
        actionLabel={t('errors.retry')}
        onClose={save.reset}
      />
    </BottomSheet>
  );
}
