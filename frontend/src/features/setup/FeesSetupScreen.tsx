import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CircleCheck, MapPin, Package, Plus, RefreshCw, Save, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { FormScreen } from '@/components/ui/FormScreen';
import { LoadingView } from '@/components/ui/LoadingView';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Field } from '@/features/orders/Field';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { digitsOnly } from '@/lib/format';
import { feesKey, type Fees } from '@/lib/restaurant';
import { getSetupFees, saveFees } from '@/lib/setup';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

const setupFeesKey = ['setup', 'fees'] as const;
const MAX_FEE_DIGITS = 5;

interface AreaRow {
  /** Local row key; `id` is set for areas that already exist on the server. */
  rowKey: string;
  id?: string;
  name: string;
  fee: string;
}

const toRows = (fees: Fees): AreaRow[] =>
  fees.deliveryAreas.map((a) => ({
    rowKey: a.id,
    id: a.id,
    name: a.name,
    fee: String(a.usualFeeEtb),
  }));

function FeesForm({ initial, onSaved }: { initial: Fees; onSaved: (fees: Fees) => void }) {
  const brand = useBrandColors();
  const { t } = useTranslation();
  const [packing, setPacking] = useState(String(initial.packingFeeEtb));
  const [rows, setRows] = useState<AreaRow[]>(() => toRows(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: saveFees,
    onSuccess: (fees) => {
      setRows(toRows(fees));
      setSaved(true);
      onSaved(fees);
    },
  });

  const update = (rowKey: string, change: Partial<AreaRow>) => {
    setSaved(false);
    setRows((list) => list.map((r) => (r.rowKey === rowKey ? { ...r, ...change } : r)));
  };

  const onSave = () => {
    Keyboard.dismiss();
    const next: Record<string, string> = {};
    if (packing === '') next.packing = 'setup.fees.errors.fee';
    const seen = new Set<string>();
    for (const row of rows) {
      const name = row.name.trim().toLowerCase();
      if (!name) next[`name-${row.rowKey}`] = 'setup.fees.errors.name';
      else if (seen.has(name)) next[`name-${row.rowKey}`] = 'setup.fees.errors.duplicate';
      seen.add(name);
      if (row.fee === '') next[`fee-${row.rowKey}`] = 'setup.fees.errors.fee';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate({
      packingFeeEtb: Number(packing),
      deliveryAreas: rows.map((r) => ({
        ...(r.id && { id: r.id }),
        name: r.name.trim(),
        usualFeeEtb: Number(r.fee),
      })),
    });
  };

  const err = (key: string) => (errors[key] ? t(errors[key]) : undefined);

  return (
    <>
      <View className="gap-3.5 px-4 pt-2">
        {saved ? (
          <View
            className="flex-row items-center gap-2 rounded-[16px] bg-successBg p-3"
            accessibilityLiveRegion="polite"
          >
            <CircleCheck size={22} color={colors.successFg} strokeWidth={2.2} />
            <Text font="bold" className="text-base" style={{ color: colors.successFg }}>
              {t('setup.fees.saved')}
            </Text>
          </View>
        ) : null}

        <View className="gap-3 rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3">
          <View className="flex-row items-center gap-2">
            <Package size={22} color={brand.primary} strokeWidth={2.2} />
            <View className="flex-1">
              <Text font="bold" className="text-[17px]">
                {t('setup.fees.packing')}
              </Text>
              <Text tone="muted" className="text-sm">
                {t('setup.fees.packingHint')}
              </Text>
            </View>
          </View>
          <Field
            label={t('setup.fees.amount')}
            value={packing}
            onChangeText={(text) => {
              setSaved(false);
              setPacking(digitsOnly(text, MAX_FEE_DIGITS));
            }}
            keyboardType="number-pad"
            maxLength={MAX_FEE_DIGITS}
            emphasis
            error={err('packing')}
          />
        </View>

        <View className="gap-3 rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3">
          <View className="flex-row items-center gap-2">
            <MapPin size={22} color={brand.primary} strokeWidth={2.2} />
            <Text font="bold" className="flex-1 text-[17px]">
              {t('setup.fees.areas')}
            </Text>
          </View>
          {rows.length === 0 ? (
            <Text tone="muted" className="text-base">
              {t('setup.fees.emptyAreas')}
            </Text>
          ) : null}
          {rows.map((row) => (
            <View key={row.rowKey} className="flex-row items-start gap-2">
              <View className="min-w-0 flex-1">
                <Field
                  label={t('setup.fees.areaName')}
                  placeholder={t('setup.fees.areaNamePlaceholder')}
                  value={row.name}
                  onChangeText={(name) => update(row.rowKey, { name })}
                  autoCapitalize="words"
                  maxLength={40}
                  error={err(`name-${row.rowKey}`)}
                />
              </View>
              <View className="w-24">
                <Field
                  label={t('setup.fees.fee')}
                  value={row.fee}
                  onChangeText={(text) =>
                    update(row.rowKey, { fee: digitsOnly(text, MAX_FEE_DIGITS) })
                  }
                  keyboardType="number-pad"
                  maxLength={MAX_FEE_DIGITS}
                  emphasis
                  error={err(`fee-${row.rowKey}`)}
                />
              </View>
              <Pressable
                onPress={() => {
                  setSaved(false);
                  setRows((list) => list.filter((r) => r.rowKey !== row.rowKey));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('setup.fees.removeArea', { name: row.name || '—' })}
                className="mt-[26px] h-[50px] w-11 items-center justify-center rounded-[14px] active:bg-dangerBg"
              >
                <X size={22} color={colors.dangerFg} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() => {
              setSaved(false);
              setRows((list) => [...list, { rowKey: `new-${Date.now()}`, name: '', fee: '' }]);
            }}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center justify-center gap-1.5 rounded-[16px] border-2 border-dashed border-primary active:bg-primarySoft"
          >
            <Plus size={20} color={brand.primary} strokeWidth={2.6} />
            <Text font="bold" className="text-base" style={{ color: brand.primary }}>
              {t('setup.fees.addArea')}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="min-h-6 flex-1" />

      <View className="px-4 pb-6 pt-3">
        <Button
          label={t('setup.fees.save')}
          icon={Save}
          disabled={mutation.isPending}
          onPress={onSave}
        />
      </View>

      <ErrorDialog
        visible={mutation.isError}
        title={t('setup.fees.failedTitle')}
        message={t(errorMessageKey(mutation.error))}
        actionLabel={t('errors.retry')}
        onClose={mutation.reset}
      />
    </>
  );
}

/** Owner/manager: packing fee and delivery areas with their usual fee (AdminFees design). */
export default function FeesSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: setupFeesKey, queryFn: getSetupFees });
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  if (query.isPending) return <LoadingView />;
  if (query.isError && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void query.refetch()} />;
  }

  return (
    <FormScreen>
      <ScreenHeader
        title={t('setup.fees.title')}
        subtitle={t('setup.fees.subtitle')}
        onBack={goBack}
      />
      {query.isError || !query.data ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text font="semibold" className="text-center text-lg">
            {t(errorMessageKey(query.error))}
          </Text>
          <View className="w-full">
            <Button
              label={t('errors.retry')}
              icon={RefreshCw}
              onPress={() => void query.refetch()}
            />
          </View>
        </View>
      ) : (
        <FeesForm
          initial={query.data}
          onSaved={(fees) => {
            queryClient.setQueryData(setupFeesKey, fees);
            void queryClient.invalidateQueries({ queryKey: feesKey });
          }}
        />
      )}
    </FormScreen>
  );
}
