import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AlertTriangle, Clock, CreditCard, Download, type LucideIcon } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { MoneyText, formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { SmallSpinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { downloadCsv, getAdminProfile, getDashboard, type AccessStatus } from '@/lib/admin';
import { isNetworkError } from '@/lib/errors';
import { colors } from '@/theme/tokens';

import { AdminShell } from './AdminShell';
import { causeText } from './causes';
import { ActionButton, Card, CardTitle, Chip, StatusChip } from './ui';

const STATUS_COLORS: Record<AccessStatus, string> = {
  active: colors.primary,
  trial: colors.accentDeep,
  grace: colors.amber,
  restricted: colors.alert,
  suspended: colors.placeholder,
};

function Need({
  title,
  count,
  sub,
  href,
  icon: Icon,
  urgent,
}: {
  title: string;
  count: number;
  sub: string;
  href: Href;
  icon: LucideIcon;
  urgent?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="link"
      className={`min-h-[176px] min-w-[260px] flex-1 gap-3.5 rounded-[20px] border-[1.5px] p-6 ${
        urgent ? 'border-amber bg-tipBg' : 'border-border bg-surface'
      }`}
    >
      <View className="flex-row items-center gap-2.5">
        <Icon size={22} color={colors.text} strokeWidth={2} />
        <Text font="bold" className="text-base">
          {title}
        </Text>
      </View>
      <Text font="heading" className="text-[52px] leading-[56px]">
        {count}
      </Text>
      <Text tone="muted" className="mt-auto text-[15px]">
        {sub}
      </Text>
    </Pressable>
  );
}

/** Admin home: what needs you today, money, customers, and today's receipt checks. */
export default function AdminHomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const profile = useQuery({ queryKey: ['admin-profile'], queryFn: getAdminProfile });
  const dash = useQuery({ queryKey: ['admin-dashboard'], queryFn: getDashboard });
  const { refetch } = dash;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const d = dash.data;
  const locale = i18n.language === 'am' ? 'am-ET' : 'en-GB';
  const today = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const maxMonth = Math.max(1, ...(d?.money.months.map((m) => m.etb) ?? [1]));
  const change =
    d && d.money.lastMonth > 0
      ? Math.round(((d.money.thisMonth - d.money.lastMonth) / d.money.lastMonth) * 100)
      : null;

  return (
    <AdminShell>
      <View className="flex-row flex-wrap items-end justify-between gap-4">
        <View className="gap-1">
          <Text tone="muted" className="text-[15px]">
            {today}
          </Text>
          <Text font="heading" className="text-[32px]" accessibilityRole="header">
            {t('platformAdmin.home.greeting', { name: profile.data?.name ?? '' })}
          </Text>
        </View>
        <ActionButton
          label={t('platformAdmin.common.export')}
          icon={Download}
          onPress={() => void downloadCsv('customers')}
        />
      </View>

      {dash.isError && !d && isNetworkError(dash.error) ? (
        <NoConnection onRetry={() => void refetch()} />
      ) : !d ? (
        <View className="items-center py-10">
          <SmallSpinner />
        </View>
      ) : (
        <>
          <View className="gap-3.5">
            <Text font="heading" className="text-xl">
              {t('platformAdmin.home.needs')}
            </Text>
            <View className="flex-row flex-wrap gap-[18px]">
              <Need
                title={t('platformAdmin.home.reviews')}
                count={d.needs.reviews}
                sub={t('platformAdmin.home.reviewsSub', { count: d.needs.reviewsOlderThanDay })}
                href="/payments"
                icon={CreditCard}
                urgent={d.needs.reviews > 0}
              />
              <Need
                title={t('platformAdmin.home.overdue')}
                count={d.needs.overdue}
                sub={t('platformAdmin.home.overdueSub', { count: d.needs.restrictedThisWeek })}
                href="/customers"
                icon={Clock}
              />
              <Need
                title={t('platformAdmin.home.errors')}
                count={d.needs.errors}
                sub={
                  d.needs.topError
                    ? causeText(t, d.needs.topError)
                    : t('platformAdmin.home.errorsNone')
                }
                href="/health"
                icon={AlertTriangle}
              />
            </View>
          </View>

          <View className="flex-row flex-wrap gap-[18px]">
            <Card className="min-w-[320px] flex-[2]">
              <CardTitle
                title={t('platformAdmin.home.money')}
                subtitle={t('platformAdmin.home.moneySub')}
                right={
                  change !== null ? (
                    <Chip
                      label={`${change >= 0 ? '+' : ''}${change}%`}
                      tone={change >= 0 ? 'ok' : 'warn'}
                    />
                  ) : null
                }
              />
              <View className="flex-row flex-wrap gap-8">
                {(
                  [
                    ['thisMonth', d.money.thisMonth],
                    ['lastMonth', d.money.lastMonth],
                    ['expected', d.money.expected30],
                  ] as const
                ).map(([key, value]) => (
                  <View key={key} className="gap-1.5">
                    <Text font="bold" tone="muted" className="text-sm uppercase">
                      {t(`platformAdmin.home.${key}`)}
                    </Text>
                    <MoneyText value={value} className="text-[30px]" />
                  </View>
                ))}
              </View>
              <View
                className="h-[150px] flex-row items-end gap-3.5"
                accessible
                accessibilityLabel={d.money.months
                  .map((m) => `${m.month}: ${formatMoney(m.etb)}`)
                  .join(', ')}
              >
                {d.money.months.map((m, i) => (
                  <View key={m.month} className="h-full flex-1 items-center justify-end gap-1.5">
                    <View
                      className={`w-full rounded-lg ${
                        i === d.money.months.length - 1 ? 'bg-primary' : 'bg-primaryTile'
                      }`}
                      style={{ height: Math.max(4, (m.etb / maxMonth) * 120) }}
                    />
                    <Text tone="muted" className="text-sm">
                      {new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString(locale, {
                        month: 'short',
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card className="min-w-[300px] flex-1">
              <CardTitle
                title={t('platformAdmin.home.customers')}
                subtitle={t('platformAdmin.home.customersCount', { count: d.customers.total })}
              />
              <View className="h-4 flex-row overflow-hidden rounded-lg bg-neutralBg">
                {(Object.keys(STATUS_COLORS) as AccessStatus[]).map((s) =>
                  d.customers[s] > 0 ? (
                    <View
                      key={s}
                      style={{ flex: d.customers[s], backgroundColor: STATUS_COLORS[s] }}
                    />
                  ) : null
                )}
              </View>
              <View>
                {(Object.keys(STATUS_COLORS) as AccessStatus[]).map((s) => (
                  <View
                    key={s}
                    className="flex-row items-center gap-3 border-t-[1.5px] border-divider py-2"
                  >
                    <View
                      className="h-3.5 w-3.5 rounded"
                      style={{ backgroundColor: STATUS_COLORS[s] }}
                    />
                    <Text className="flex-1 text-[15px]">{t(`platformAdmin.status.${s}`)}</Text>
                    <Text font="bold" className="text-[15px]">
                      {d.customers[s]}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          <View className="flex-row flex-wrap gap-[18px]">
            <Card className="min-w-[320px] flex-1">
              <CardTitle
                title={t('platformAdmin.home.dueSoon')}
                right={
                  <Pressable
                    onPress={() => router.push('/customers')}
                    accessibilityRole="link"
                    className="min-h-11 justify-center"
                  >
                    <Text font="bold" tone="link" className="text-[15px]">
                      {t('platformAdmin.common.seeAll')}
                    </Text>
                  </Pressable>
                }
              />
              {d.dueSoon.length === 0 ? (
                <Text tone="muted" className="text-[15px]">
                  {t('platformAdmin.home.dueNone')}
                </Text>
              ) : (
                d.dueSoon.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/customers/${c.id}`)}
                    accessibilityRole="link"
                    className="min-h-11 flex-row flex-wrap items-center gap-3 border-t-[1.5px] border-divider py-3"
                  >
                    <View className="min-w-[160px] flex-1">
                      <Text font="bold" className="text-[15px]">
                        {c.name}
                      </Text>
                      <Text tone="muted" className="text-sm">
                        {c.plan
                          ? t(`platformAdmin.plans.${c.plan}`)
                          : t('platformAdmin.plans.none')}
                      </Text>
                    </View>
                    {c.priceEtb ? <MoneyText value={c.priceEtb} className="text-base" /> : null}
                    <StatusChip status={c.status} daysLeft={c.daysLeft} />
                  </Pressable>
                ))
              )}
            </Card>

            <Card className="min-w-[320px] flex-1">
              <CardTitle
                title={t('platformAdmin.home.checks')}
                subtitle={t('platformAdmin.home.checksSub')}
              />
              <View className="flex-row flex-wrap gap-3.5">
                {(
                  [
                    ['verified', d.checksToday.verified, 'bg-successBg', 'text-successFg'],
                    ['notMatching', d.checksToday.notMatching, 'bg-warnBg', 'text-warnFg'],
                    ['unable', d.checksToday.unable, 'bg-dangerBg', 'text-dangerFg'],
                  ] as const
                ).map(([key, value, box, text]) => (
                  <View key={key} className={`min-w-[110px] flex-1 rounded-2xl p-4 ${box}`}>
                    <Text font="heading" className={`text-[28px] ${text}`}>
                      {value}
                    </Text>
                    <Text font="bold" className={`text-sm ${text}`}>
                      {t(`platformAdmin.home.${key}`)}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="gap-3 border-t-[1.5px] border-divider pt-4">
                <View className="flex-row items-center justify-between">
                  <Text font="bold" className="text-[15px]">
                    {t('platformAdmin.home.banks')}
                  </Text>
                  <Pressable
                    onPress={() => router.push('/health')}
                    accessibilityRole="link"
                    className="min-h-11 justify-center"
                  >
                    <Text font="bold" tone="link" className="text-[15px]">
                      {t('platformAdmin.home.details')}
                    </Text>
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {d.banks.map((b) => (
                    <Chip
                      key={b.code}
                      label={`${t(`platformAdmin.banks.${b.code}`)} · ${
                        b.up === null
                          ? t('platformAdmin.banks.unknown')
                          : t(b.up ? 'platformAdmin.banks.up' : 'platformAdmin.banks.down')
                      }`}
                      tone={b.up === null ? 'neutral' : b.up ? 'ok' : 'error'}
                    />
                  ))}
                </View>
                <View className="flex-row justify-between">
                  <Text tone="muted" className="text-[15px]">
                    {t('platformAdmin.home.gemini')}
                  </Text>
                  <Text font="bold" className="text-[15px]">
                    {d.gemini.calls}
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </>
      )}
    </AdminShell>
  );
}
