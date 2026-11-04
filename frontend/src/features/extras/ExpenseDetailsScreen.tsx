import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Pencil, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import {
  deleteExpense,
  expenseKey,
  getExpense,
  reviewExpense,
  spendingsKey,
  type Expense,
} from '@/lib/extras';
import { useSession } from '@/store/session';

import { AddSpendingSheet } from './AddSpendingSheet';
import { FeatureGate } from './FeatureGate';

const DELETE_REASONS = ['mistake', 'twice', 'notReal', 'wrongAmount'] as const;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 pb-3">
      <Text tone="muted" className="text-[15px]">
        {label}
      </Text>
      <Text font="bold" className="text-[15px]">
        {value}
      </Text>
    </View>
  );
}

function Details() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const [editing, setEditing] = useState(false);

  const query = useQuery({ queryKey: expenseKey(id), queryFn: () => getExpense(id) });
  const done = (row: Expense) => {
    queryClient.setQueryData(expenseKey(id), row);
    void queryClient.invalidateQueries({ queryKey: spendingsKey });
    void queryClient.invalidateQueries({ queryKey: ['money-flow'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
  const review = useMutation({ mutationFn: () => reviewExpense(id), onSuccess: done });
  const remove = useMutation({
    mutationFn: (reason: string) => deleteExpense(id, reason),
    onSuccess: done,
  });
  const failed = review.error ?? remove.error;

  if (query.isPending) return <LoadingView screenTitle={t('extras.money.detailTitle')} />;
  if (query.isError && !query.data) {
    if (isNetworkError(query.error)) return <NoConnection onRetry={() => void query.refetch()} />;
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title={t('extras.money.detailTitle')} onBack={() => router.back()} />
        <Text tone="muted" className="px-6 pt-6 text-center text-lg">
          {t(errorMessageKey(query.error))}
        </Text>
      </SafeAreaView>
    );
  }
  const e = query.data;
  const deleted = !!e.deletedAt;
  const busy = review.isPending || remove.isPending;

  const askDelete = () =>
    Alert.alert(t('extras.money.deleteTitle'), t('extras.money.deleteBody'), [
      ...DELETE_REASONS.map((r) => ({
        text: t(`extras.money.deleteReasons.${r}`),
        style: 'destructive' as const,
        onPress: () => remove.mutate(t(`extras.money.deleteReasons.${r}`)),
      })),
      { text: t('extras.money.keep'), style: 'cancel' as const },
    ]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScreenHeader title={t('extras.money.detailTitle')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View className="rounded-card border-[1.5px] border-border bg-surface px-5 py-4">
          {e.isNew ? (
            <Text font="bold" className="self-start rounded-lg bg-warnBg px-2 text-sm text-warnFg">
              {t('extras.money.notChecked')}
            </Text>
          ) : null}
          {deleted ? (
            <Text
              font="bold"
              className="self-start rounded-lg bg-dangerBg px-2 text-sm text-dangerFg"
            >
              {t('extras.money.deleted', { reason: e.deleteReason ?? '' })}
            </Text>
          ) : null}
          <MoneyText
            value={e.amount}
            className={`mt-2 text-[40px] ${deleted ? 'line-through' : ''}`}
          />
          <Text font="bold" className="text-[19px]">
            {e.title}
          </Text>
          {deleted ? null : (
            <Text
              font="semibold"
              className={`mt-0.5 text-[15px] ${e.isCost ? 'text-success' : 'text-muted'}`}
            >
              {t(e.isCost ? 'extras.money.cost' : 'extras.money.other')}
            </Text>
          )}
          <View className="my-3.5 h-px bg-divider" />
          <View className="flex-row flex-wrap">
            <Fact
              label={t('extras.money.kind')}
              value={t(`extras.money.categories.${e.category}`)}
            />
            <Fact
              label={t('extras.money.paidFrom')}
              value={t(e.paidFrom === 'CASH' ? 'extras.money.cashDrawer' : 'extras.bank')}
            />
            <Fact
              label={t('extras.money.receipt')}
              value={t(e.hasReceipt ? 'extras.money.hasReceipt' : 'extras.money.noReceipt')}
            />
            <Fact
              label={t('extras.money.usedFor')}
              value={t(e.forBusiness ? 'extras.money.forBusiness' : 'extras.money.personal')}
            />
            <Fact label={t('extras.money.addedBy')} value={e.createdBy} />
            <Fact
              label={t('extras.money.when')}
              value={`${formatDay(e.createdAt, false)}, ${formatTime(e.createdAt)}`}
            />
          </View>
        </View>
        {e.changedAt && e.changedBy ? (
          <Text tone="muted" className="px-1 text-sm">
            {e.oldAmount !== null
              ? t('extras.money.changed', {
                  name: e.changedBy,
                  time: formatTime(e.changedAt),
                  amount: formatMoney(e.oldAmount),
                })
              : t('extras.money.changedNoAmount', {
                  name: e.changedBy,
                  time: formatTime(e.changedAt),
                })}
          </Text>
        ) : null}
        {failed ? (
          <Text className="px-1 text-sm text-dangerFg">{t(errorMessageKey(failed))}</Text>
        ) : null}
      </ScrollView>

      {isOwner && !deleted ? (
        <View className="gap-2.5 px-4 pb-3 pt-2">
          {e.isNew ? (
            <Button
              label={t('extras.money.looksRight')}
              icon={Check}
              variant="success"
              disabled={busy}
              onPress={() => review.mutate()}
            />
          ) : null}
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Button
                label={t('extras.money.change')}
                icon={Pencil}
                size="md"
                disabled={busy}
                onPress={() => setEditing(true)}
              />
            </View>
            <View className="flex-1">
              <Button
                label={t('extras.money.delete')}
                icon={X}
                variant="danger"
                size="md"
                disabled={busy}
                onPress={askDelete}
              />
            </View>
          </View>
          <Text tone="muted" className="text-center text-sm">
            {t('extras.money.deleteHint')}
          </Text>
        </View>
      ) : null}

      {editing ? <AddSpendingSheet visible editing={e} onClose={() => setEditing(false)} /> : null}
    </SafeAreaView>
  );
}

/** One expense. The owner checks it ("looks right"), corrects it, or deletes it with a reason. */
export default function ExpenseDetailsScreen() {
  return (
    <FeatureGate feature="featureMoneyOut">
      <Details />
    </FeatureGate>
  );
}
