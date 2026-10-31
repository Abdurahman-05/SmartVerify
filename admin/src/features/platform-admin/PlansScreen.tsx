import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { BankBadge } from '@/components/ui/BankBadge';
import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import {
  getAdminProfile,
  getOtherSessions,
  getSettingsPage,
  saveSettings,
  sendTestAlert,
  setIdleTimeout,
  signOutOtherSessions,
  type SettingsPage,
} from '@/lib/admin';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AdminShell } from './AdminShell';
import { ActionButton, Card, CardTitle, Chip, ErrorNote, PageTitle, Row, Tabs } from './ui';

type PriceKey =
  | 'priceNormalMonthly'
  | 'priceNormalQuarterly'
  | 'priceNormalMultiMonthly'
  | 'priceRestaurantNormalMonthly'
  | 'priceRestaurantNormalQuarterly'
  | 'priceRestaurantMonthly';

function PriceInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 7))}
        keyboardType="number-pad"
        accessibilityLabel={label}
        className="h-12 w-[130px] rounded-[14px] border-2 border-borderStrong bg-surface px-3.5 font-heading text-lg text-text"
      />
      <Text tone="muted" className="text-[15px]">
        {t('common.etb')}
      </Text>
    </View>
  );
}

/** Prices, where customers pay, alerts, and the admin's own account settings. */
export default function PlansScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const page = useQuery({ queryKey: ['admin-settings'], queryFn: getSettingsPage });
  const profile = useQuery({ queryKey: ['admin-profile'], queryFn: getAdminProfile });
  const sessions = useQuery({ queryKey: ['admin-sessions'], queryFn: getOtherSessions });
  // Unsaved price edits; until the first edit the page shows the saved prices.
  const [priceEdits, setPrices] = useState<Record<PriceKey, string> | null>(null);

  const save = useMutation({
    mutationFn: () => {
      if (!page.data || !priceEdits) throw new Error('not loaded');
      const prices = priceEdits;
      return saveSettings({
        ...page.data.settings,
        priceNormalMonthly: Number(prices.priceNormalMonthly),
        priceNormalQuarterly: Number(prices.priceNormalQuarterly),
        priceNormalMultiMonthly: Number(prices.priceNormalMultiMonthly),
        priceRestaurantNormalMonthly: Number(prices.priceRestaurantNormalMonthly),
        priceRestaurantNormalQuarterly: Number(prices.priceRestaurantNormalQuarterly),
        priceRestaurantMonthly: Number(prices.priceRestaurantMonthly),
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<SettingsPage>(['admin-settings'], (old) =>
        old ? { ...old, settings: saved } : old
      );
      setPrices(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });
  const test = useMutation({ mutationFn: sendTestAlert });
  const idle = useMutation({
    mutationFn: (m: 30 | 120 | 480) => setIdleTimeout(m),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-profile'] }),
  });
  const others = useMutation({
    mutationFn: signOutOtherSessions,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-sessions'] }),
  });

  if (page.isError && !page.data && isNetworkError(page.error)) {
    return (
      <AdminShell>
        <NoConnection onRetry={() => void page.refetch()} />
      </AdminShell>
    );
  }
  if (!page.data) {
    return (
      <AdminShell>
        <View className="items-center py-10">
          <SmallSpinner />
        </View>
      </AdminShell>
    );
  }
  const s = page.data.settings;
  const prices = priceEdits ?? {
    priceNormalMonthly: String(s.priceNormalMonthly),
    priceNormalQuarterly: String(s.priceNormalQuarterly),
    priceNormalMultiMonthly: String(s.priceNormalMultiMonthly ?? 1500),
    priceRestaurantNormalMonthly: String(s.priceRestaurantNormalMonthly ?? 1000),
    priceRestaurantNormalQuarterly: String(s.priceRestaurantNormalQuarterly ?? 1500),
    priceRestaurantMonthly: String(s.priceRestaurantMonthly),
  };
  const valid = Object.values(prices).every((v) => Number(v) >= 1);
  const dirty =
    Number(prices.priceNormalMonthly) !== s.priceNormalMonthly ||
    Number(prices.priceNormalQuarterly) !== s.priceNormalQuarterly ||
    Number(prices.priceNormalMultiMonthly) !== (s.priceNormalMultiMonthly ?? 1500) ||
    Number(prices.priceRestaurantNormalMonthly) !== (s.priceRestaurantNormalMonthly ?? 1000) ||
    Number(prices.priceRestaurantNormalQuarterly) !== (s.priceRestaurantNormalQuarterly ?? 1500) ||
    Number(prices.priceRestaurantMonthly) !== s.priceRestaurantMonthly;
  const setPrice = (key: PriceKey) => (v: string) => {
    save.reset();
    setPrices({ ...prices, [key]: v });
  };
  const idleMinutes = (profile.data?.idleTimeoutMinutes ?? 120) as 30 | 120 | 480;

  return (
    <AdminShell>
      <PageTitle
        title={t('platformAdmin.plansPage.title')}
        subtitle={t('platformAdmin.plansPage.subtitle')}
        right={
          <View className="flex-row items-center gap-3">
            {save.isSuccess && !dirty ? (
              <Chip label={t('platformAdmin.common.saved')} tone="ok" />
            ) : null}
            <ActionButton
              label={t('platformAdmin.common.save')}
              variant="primary"
              disabled={!dirty || !valid || save.isPending}
              onPress={() => save.mutate()}
            />
          </View>
        }
      />
      <ErrorNote message={save.error ? t(errorMessageKey(save.error)) : null} />

      <Card>
        <CardTitle title={t('platformAdmin.plansPage.prices')} />
        <View className="flex-row flex-wrap gap-[18px]">
          <View className="min-w-[280px] flex-1 gap-3 rounded-2xl border-[1.5px] border-border p-5">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text font="heading" className="text-lg">
                {t('platformAdmin.plans.normal')}
              </Text>
              <Chip
                label={t('platformAdmin.plansPage.customers', {
                  count: page.data.planCounts.normal,
                })}
              />
            </View>
            <Text tone="muted" className="text-sm">
              {t('platformAdmin.plansPage.normalDesc')}
            </Text>
            <Row label={t('platformAdmin.plansPage.everyMonth')}>
              <PriceInput
                value={prices.priceNormalMonthly}
                onChange={setPrice('priceNormalMonthly')}
                label={`${t('platformAdmin.plans.normal')} ${t('platformAdmin.plansPage.everyMonth')}`}
              />
            </Row>
            <Row label={t('platformAdmin.plansPage.every3')}>
              <PriceInput
                value={prices.priceNormalQuarterly}
                onChange={setPrice('priceNormalQuarterly')}
                label={`${t('platformAdmin.plans.normal')} ${t('platformAdmin.plansPage.every3')}`}
              />
            </Row>
          </View>
          <View className="min-w-[280px] flex-1 gap-3 rounded-2xl border-[1.5px] border-border p-5">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text font="heading" className="text-lg">
                {t('platformAdmin.plans.normal_multi')}
              </Text>
              <Chip
                label={t('platformAdmin.plansPage.customers', {
                  count: page.data.planCounts.normal_multi ?? 0,
                })}
              />
            </View>
            <Text tone="muted" className="text-sm">
              {t('platformAdmin.plansPage.normalMultiDesc')}
            </Text>
            <Row label={t('platformAdmin.plansPage.everyMonth')}>
              <PriceInput
                value={prices.priceNormalMultiMonthly}
                onChange={setPrice('priceNormalMultiMonthly')}
                label={`${t('platformAdmin.plans.normal_multi')} ${t('platformAdmin.plansPage.everyMonth')}`}
              />
            </Row>
            <Row label={t('platformAdmin.plansPage.every3')}>
              <Text tone="muted" className="text-[15px]">
                {t('platformAdmin.plansPage.notOffered')}
              </Text>
            </Row>
          </View>
          <View className="min-w-[280px] flex-1 gap-3 rounded-2xl border-[1.5px] border-border p-5">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text font="heading" className="text-lg">
                {t('platformAdmin.plans.restaurant_normal')}
              </Text>
              <Chip
                label={t('platformAdmin.plansPage.customers', {
                  count: page.data.planCounts.restaurant_normal ?? 0,
                })}
              />
            </View>
            <Text tone="muted" className="text-sm">
              {t('platformAdmin.plansPage.restaurantNormalDesc')}
            </Text>
            <Row label={t('platformAdmin.plansPage.everyMonth')}>
              <PriceInput
                value={prices.priceRestaurantNormalMonthly}
                onChange={setPrice('priceRestaurantNormalMonthly')}
                label={`${t('platformAdmin.plans.restaurant_normal')} ${t('platformAdmin.plansPage.everyMonth')}`}
              />
            </Row>
            <Row label={t('platformAdmin.plansPage.every3')}>
              <PriceInput
                value={prices.priceRestaurantNormalQuarterly}
                onChange={setPrice('priceRestaurantNormalQuarterly')}
                label={`${t('platformAdmin.plans.restaurant_normal')} ${t('platformAdmin.plansPage.every3')}`}
              />
            </Row>
          </View>
          <View className="min-w-[280px] flex-1 gap-3 rounded-2xl border-[1.5px] border-border p-5">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text font="heading" className="text-lg">
                {t('platformAdmin.plans.restaurant')}
              </Text>
              <Chip
                label={t('platformAdmin.plansPage.customers', {
                  count: page.data.planCounts.restaurant,
                })}
              />
            </View>
            <Text tone="muted" className="text-sm">
              {t('platformAdmin.plansPage.restaurantDesc')}
            </Text>
            <Row label={t('platformAdmin.plansPage.everyMonth')}>
              <PriceInput
                value={prices.priceRestaurantMonthly}
                onChange={setPrice('priceRestaurantMonthly')}
                label={`${t('platformAdmin.plans.restaurant')} ${t('platformAdmin.plansPage.everyMonth')}`}
              />
            </Row>
            <Row label={t('platformAdmin.plansPage.every3')}>
              <Text tone="muted" className="text-[15px]">
                {t('platformAdmin.plansPage.notOffered')}
              </Text>
            </Row>
          </View>
        </View>
        <Text tone="muted" className="text-sm">
          {t('platformAdmin.plansPage.priceNote')}
        </Text>
      </Card>

      <View className="flex-row flex-wrap gap-[18px]">
        <Card className="min-w-[320px] flex-1">
          <CardTitle
            title={t('platformAdmin.plansPage.payTo')}
            subtitle={t('platformAdmin.plansPage.payToBody')}
          />
          {(
            [
              ['CBE', page.data.payTo.cbe],
              ['TEL', page.data.payTo.telebirr],
            ] as const
          ).map(([code, acc]) => (
            <View
              key={code}
              className="flex-row items-center gap-3 border-t-[1.5px] border-divider py-3"
            >
              <BankBadge code={code} size={44} />
              <View className="flex-1">
                <Text font="bold" className="text-[15px]">
                  {acc ? acc.name : t('platformAdmin.plansPage.notSet')}
                </Text>
                <Text tone="muted" className="text-sm">
                  {t(`platformAdmin.banks.${code}`)}
                  {acc ? ` · ••••${acc.last4}` : ''}
                </Text>
              </View>
            </View>
          ))}
          <Text tone="muted" className="text-sm">
            {t('platformAdmin.plansPage.envNote')}
          </Text>
        </Card>

        <Card className="min-w-[320px] flex-1">
          <CardTitle
            title={t('platformAdmin.plansPage.alerts')}
            subtitle={t('platformAdmin.plansPage.alertsBody')}
          />
          <Chip
            label={
              page.data.telegram
                ? t('platformAdmin.plansPage.telegramOn')
                : t('platformAdmin.plansPage.telegramOff')
            }
            tone={page.data.telegram ? 'ok' : 'warn'}
          />
          <View className="self-start">
            <ActionButton
              label={t('platformAdmin.plansPage.test')}
              icon={Send}
              disabled={!page.data.telegram || test.isPending}
              onPress={() => test.mutate()}
            />
          </View>
          {test.data ? (
            <Text
              font="semibold"
              className="text-[15px]"
              style={{ color: test.data.sent ? colors.success : colors.dangerFg }}
            >
              {test.data.sent
                ? t('platformAdmin.plansPage.testSent')
                : t('platformAdmin.plansPage.testFailed')}
            </Text>
          ) : null}
        </Card>
      </View>

      <Card>
        <CardTitle title={t('platformAdmin.plansPage.account')} />
        <Row label={t('platformAdmin.plansPage.twoStep')}>
          <View className="flex-row flex-wrap items-center gap-3">
            <Chip label={t('platformAdmin.plansPage.on')} tone="ok" />
            {profile.data ? (
              <Text tone="muted" className="text-sm">
                {t('platformAdmin.plansPage.backupLeft', { count: profile.data.backupCodesLeft })}
              </Text>
            ) : null}
          </View>
        </Row>
        <Row label={t('platformAdmin.plansPage.idle')}>
          <Tabs<'30' | '120' | '480'>
            value={String(idleMinutes) as '30' | '120' | '480'}
            onChange={(v) => idle.mutate(Number(v) as 30 | 120 | 480)}
            options={[
              { key: '30', label: t('platformAdmin.plansPage.idle30') },
              { key: '120', label: t('platformAdmin.plansPage.idle120') },
              { key: '480', label: t('platformAdmin.plansPage.idle480') },
            ]}
          />
        </Row>
        <Row label={t('platformAdmin.plansPage.otherDevices')}>
          <View className="flex-row flex-wrap items-center gap-3">
            <Text className="text-[15px]">
              {t('platformAdmin.plansPage.otherCount', { count: sessions.data?.others ?? 0 })}
            </Text>
            <ActionButton
              label={t('platformAdmin.plansPage.signOutOthers')}
              variant="danger"
              disabled={!sessions.data?.others || others.isPending}
              onPress={() => others.mutate()}
            />
          </View>
        </Row>
      </Card>
    </AdminShell>
  );
}
