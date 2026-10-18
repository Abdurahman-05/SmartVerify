import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, RefreshCw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Field } from '@/features/orders/Field';
import { Pill } from '@/features/orders/Pill';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { tablesKey, type Table, type TableArea } from '@/lib/restaurant';
import { addTables, getSetupTables, removeTable } from '@/lib/setup';
import { colors } from '@/theme/tokens';

const areas: TableArea[] = ['main', 'upstairs', 'outside'];
const setupTablesKey = ['setup', 'tables'] as const;
const MAX_AT_ONCE = 100;

/** Owner/manager: add tables per area and remove the ones not used any more. */
export default function TablesSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [area, setArea] = useState<TableArea>('main');
  const [range, setRange] = useState({ from: '', to: '' });
  const [rangeError, setRangeError] = useState(false);

  const query = useQuery({ queryKey: setupTablesKey, queryFn: getSetupTables });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: setupTablesKey });
    void queryClient.invalidateQueries({ queryKey: tablesKey });
  };
  const add = useMutation({
    mutationFn: (numbers: number[]) => addTables(area, numbers),
    onSuccess: () => {
      setRange({ from: '', to: '' });
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: removeTable, onSuccess: refresh });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  if (query.isPending) return <LoadingView screenTitle={t('setup.tables.title')} onBack={goBack} />;
  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }

  const tables = query.data ?? [];
  const shown = tables.filter((tb) => tb.area === area);
  const nextNumber = shown.reduce((max, tb) => Math.max(max, tb.number), 0) + 1;

  const onAdd = () => {
    Keyboard.dismiss();
    const from = Number(range.from || nextNumber);
    const to = Number(range.to || range.from || nextNumber);
    const valid = from >= 1 && to >= from && to <= 999 && to - from < MAX_AT_ONCE;
    setRangeError(!valid);
    if (valid) add.mutate(Array.from({ length: to - from + 1 }, (_, i) => from + i));
  };

  const confirmRemove = (table: Table) =>
    Alert.alert(
      t('setup.tables.removeTitle', { number: table.number }),
      t('setup.tables.removeBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('setup.tables.remove'),
          style: 'destructive',
          onPress: () => remove.mutate(table.id),
        },
      ]
    );

  const failed = add.isError ? add : remove.isError ? remove : null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader
        title={t('setup.tables.title')}
        subtitle={t('setup.tables.inUse', { count: tables.length })}
        onBack={goBack}
      />

      {query.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <Button label={t('errors.retry')} icon={RefreshCw} onPress={() => void refetch()} />
          </View>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}
        >
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            {areas.map((a) => (
              <Pill
                key={a}
                label={t(`orders.area.${a}`)}
                selected={area === a}
                onPress={() => setArea(a)}
              />
            ))}
          </View>

          {shown.length ? (
            <View className="gap-2">
              <Text tone="muted" className="text-sm">
                {t('setup.tables.tapToRemove')}
              </Text>
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
                {shown.map((table) => (
                  <View key={table.id} className="w-1/4 p-[5px]">
                    <Pressable
                      onPress={() => confirmRemove(table)}
                      accessibilityRole="button"
                      accessibilityLabel={t('setup.tables.removeTitle', { number: table.number })}
                      className={`h-[66px] items-center justify-center rounded-[18px] border-2 ${
                        table.busy ? 'border-borderMid bg-neutralBg' : 'border-primary bg-surface'
                      } active:bg-primarySoft`}
                    >
                      <Text font="heading" className="text-[22px]">
                        {table.number}
                      </Text>
                      {table.busy ? (
                        <Text font="bold" className="text-[11px]" style={{ color: colors.muted }}>
                          {t('setup.tables.busy')}
                        </Text>
                      ) : null}
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text tone="muted" className="py-2 text-base">
              {t('setup.tables.empty')}
            </Text>
          )}

          <View className="gap-3 rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3">
            <Text font="bold" className="text-[17px]">
              {t('setup.tables.addTitle')}
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  label={t('setup.tables.from')}
                  placeholder={String(nextNumber)}
                  value={range.from}
                  onChangeText={(text) => setRange((r) => ({ ...r, from: digitsOnly(text, 3) }))}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View className="flex-1">
                <Field
                  label={t('setup.tables.to')}
                  placeholder={range.from || String(nextNumber)}
                  value={range.to}
                  onChangeText={(text) => setRange((r) => ({ ...r, to: digitsOnly(text, 3) }))}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>
            {rangeError ? (
              <Text font="semibold" className="text-sm text-dangerFg">
                {t('setup.tables.rangeError')}
              </Text>
            ) : null}
            <Button
              label={t('setup.tables.add')}
              icon={Plus}
              size="md"
              disabled={add.isPending}
              onPress={onAdd}
            />
          </View>
        </ScrollView>
      )}

      <ErrorDialog
        visible={Boolean(failed)}
        title={t('setup.tables.failedTitle')}
        message={t(errorMessageKey(failed?.error))}
        actionLabel={t('errors.retry')}
        onClose={() => failed?.reset()}
      />
    </SafeAreaView>
  );
}
