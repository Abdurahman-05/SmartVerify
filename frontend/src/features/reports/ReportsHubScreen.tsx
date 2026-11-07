import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney, MoneyText } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { CalendarButton } from '@/features/transactions/CalendarButton';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { methodKey } from '@/features/transactions/methods';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { shareCsv, sharePdf, type ExportTable } from '@/lib/export';
import { periods } from '@/lib/period';
import {
  getRestaurantReport,
  restaurantReportKey,
  type ReportRange,
  type RestaurantReport,
} from '@/lib/reports';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

const tabs = ['sales', 'menu', 'expenses', 'staff'] as const;
type Tab = (typeof tabs)[number];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`h-12 items-center justify-center rounded-3xl px-4 ${
        selected ? 'bg-primary' : 'border-2 border-borderStrong bg-surface'
      }`}
    >
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-base">
        {label}
      </Text>
    </Pressable>
  );
}

/** One report: a titled card. Shows `empty` when there is nothing to list. */
function Card({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View className="rounded-[20px] border-[1.5px] border-border bg-surface px-3.5 py-3">
      <Text font="bold" className="pb-2 text-base" accessibilityRole="header">
        {title}
      </Text>
      {isEmpty ? (
        <Text tone="muted" className="text-sm">
          {t('reportsHub.empty')}
        </Text>
      ) : (
        <View className="gap-2.5">{children}</View>
      )}
    </View>
  );
}

/** A labelled line with a bar showing its share of the biggest value. */
function Bar({
  label,
  value,
  share,
  tone = 'primary',
}: {
  label: string;
  value: string;
  share?: number;
  tone?: 'primary' | 'danger';
}) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <View className="flex-row justify-between gap-2">
        <Text font="bold" className="flex-1 text-sm" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-sm">{value}</Text>
      </View>
      {share === undefined ? null : (
        <View className="mt-1 h-2 rounded-full bg-neutralBg">
          <View
            className={`h-2 rounded-full ${tone === 'danger' ? 'bg-alert' : 'bg-primary'}`}
            style={{ width: `${Math.max(Math.min(share, 100), 2)}%` }}
          />
        </View>
      )}
    </View>
  );
}

const pct = (value: number, max: number) => (max > 0 ? (value / max) * 100 : 0);
const maxOf = (values: number[]) => Math.max(0, ...values);
const money = (v: number) => formatMoney(v, false);

function SalesTab({ r, t }: { r: RestaurantReport; t: TFunction }) {
  const s = r.sales;
  const change =
    s.previousEtb > 0 ? Math.round(((s.totalEtb - s.previousEtb) / s.previousEtb) * 100) : null;
  const hours = s.byHour.filter((h) => h.bills > 0);
  const maxHour = maxOf(hours.map((h) => h.totalEtb));
  const maxDay = maxOf(s.byDay.map((d) => d.totalEtb));
  const maxMethod = maxOf(s.methods.map((m) => m.totalEtb));
  return (
    <>
      <View className="rounded-card bg-primary px-5 py-4" accessible>
        <Text font="semibold" tone="inverse" className="text-[15px] opacity-90">
          {t('reportsHub.sales.total')}
        </Text>
        <MoneyText
          value={s.totalEtb}
          tone="inverse"
          className="mt-0.5 text-[36px]"
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <View className="mt-2.5 flex-row gap-2.5">
          <View className="flex-1 rounded-[14px] bg-white/10 px-3 py-2">
            <Text tone="inverse" className="text-sm opacity-90">
              {t('reportsHub.sales.bills')}
            </Text>
            <Text font="bold" tone="inverse" className="text-lg">
              {s.bills}
            </Text>
          </View>
          <View className="flex-1 rounded-[14px] bg-white/10 px-3 py-2">
            <Text tone="inverse" className="text-sm opacity-90">
              {t('reportsHub.sales.average')}
            </Text>
            <MoneyText value={s.averageEtb} tone="inverse" font="bold" className="text-lg" />
          </View>
        </View>
        {change === null ? null : (
          <Text font="semibold" tone="inverse" className="mt-2 text-sm">
            {t(change >= 0 ? 'reportsHub.sales.up' : 'reportsHub.sales.down', {
              percent: Math.abs(change),
              amount: money(s.previousEtb),
            })}
          </Text>
        )}
      </View>

      <Card title={t('reportsHub.sales.methods')} isEmpty={s.bills === 0}>
        {s.methods.map((m) => (
          <Bar
            key={m.method}
            label={t(methodKey(m.method))}
            value={`${money(m.totalEtb)} · ${t('reportsHub.billsCount', { count: m.bills })}`}
            share={pct(m.totalEtb, maxMethod)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.sales.byHour')} isEmpty={hours.length === 0}>
        {hours.map((h) => (
          <Bar
            key={h.hour}
            label={t('reportsHub.hour', { from: h.hour, to: (h.hour + 1) % 24 })}
            value={`${money(h.totalEtb)} · ${t('reportsHub.billsCount', { count: h.bills })}`}
            share={pct(h.totalEtb, maxHour)}
          />
        ))}
      </Card>

      {s.byDay.length > 1 ? (
        <Card title={t('reportsHub.sales.byDay')} isEmpty={s.bills === 0}>
          {s.byDay.map((d) => {
            const date = new Date(`${d.day}T12:00:00`);
            return (
              <Bar
                key={d.day}
                label={`${t(`reportsHub.weekday_${date.getDay()}`)} · ${t('period.day', {
                  month: t(`period.month_${date.getMonth()}`),
                  day: date.getDate(),
                })}`}
                value={money(d.totalEtb)}
                share={pct(d.totalEtb, maxDay)}
              />
            );
          })}
        </Card>
      ) : null}
    </>
  );
}

function MenuTab({ r, t, am }: { r: RestaurantReport; t: TFunction; am: boolean }) {
  const m = r.menu;
  const name = (x: { name: string; nameAm: string | null }) => (am && x.nameAm ? x.nameAm : x.name);
  const top = m.items.slice(0, 15);
  const maxQty = maxOf(top.map((i) => i.qty));
  const maxCat = maxOf(m.categories.map((c) => c.totalEtb));
  return (
    <>
      <Card title={t('reportsHub.menu.best')} isEmpty={top.length === 0}>
        {top.map((i, n) => (
          <Bar
            key={`${i.name}-${n}`}
            label={`${n + 1}. ${name(i)}`}
            value={`${t('reportsHub.qty', { count: i.qty })} · ${money(i.totalEtb)}`}
            share={pct(i.qty, maxQty)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.menu.categories')} isEmpty={m.categories.length === 0}>
        {m.categories.map((c) => (
          <Bar
            key={c.name || 'other'}
            label={c.name ? name(c) : t('reportsHub.menu.noCategory')}
            value={`${t('reportsHub.qty', { count: c.qty })} · ${money(c.totalEtb)}`}
            share={pct(c.totalEtb, maxCat)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.menu.slow')} isEmpty={m.slow.length === 0}>
        <Text tone="muted" className="text-sm">
          {t('reportsHub.menu.slowHint')}
        </Text>
        {m.slow.map((i, n) => (
          <Bar
            key={`${i.name}-${n}`}
            label={name(i)}
            value={
              i.qty === 0 ? t('reportsHub.menu.notSold') : t('reportsHub.qty', { count: i.qty })
            }
          />
        ))}
      </Card>

      <Card title={t('reportsHub.menu.cancelled')} isEmpty={m.cancelled.orders === 0}>
        <Text font="semibold" className="text-sm">
          {t('reportsHub.menu.cancelledTotal', {
            count: m.cancelled.orders,
            amount: money(m.cancelled.totalEtb),
          })}
        </Text>
        {m.cancelled.items.slice(0, 10).map((i) => (
          <Bar key={i.name} label={i.name} value={t('reportsHub.qty', { count: i.qty })} />
        ))}
        {m.cancelled.list.map((o) => (
          <View key={o.number} className="rounded-[12px] bg-background px-3 py-2" accessible>
            <Text font="bold" className="text-sm">
              {t('reportsHub.menu.order', { number: o.number })} · {money(o.totalEtb)}
            </Text>
            <Text tone="muted" className="text-sm">
              {[o.by, o.reason].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function ExpensesTab({
  r,
  t,
  onMoneyFlow,
}: {
  r: RestaurantReport;
  t: TFunction;
  onMoneyFlow: () => void;
}) {
  const e = r.expenses;
  const maxKind = maxOf(e.byKind.map((k) => k.totalEtb));
  const maxBought = maxOf(e.bought.map((b) => b.totalEtb));
  return (
    <>
      <Pressable
        onPress={onMoneyFlow}
        accessibilityRole="button"
        className="min-h-14 flex-row items-center gap-3 rounded-card bg-primary px-5 py-3.5 active:opacity-90"
      >
        <View className="flex-1">
          <Text font="semibold" tone="inverse" className="text-[15px] opacity-90">
            {t('reportsHub.expenses.total')}
          </Text>
          <MoneyText value={e.totalEtb} tone="inverse" className="text-[30px]" />
          <Text font="semibold" tone="inverse" className="text-sm">
            {t('reportsHub.expenses.openFlow')}
          </Text>
        </View>
        <ChevronRight size={26} color={colors.surface} strokeWidth={2.2} />
      </Pressable>

      <Card title={t('reportsHub.expenses.byKind')} isEmpty={e.byKind.length === 0}>
        {e.byKind.map((k) => (
          <Bar
            key={k.kind}
            label={t(`extras.money.categories.${k.kind}`)}
            value={`${money(k.totalEtb)} · ${t('reportsHub.timesCount', { count: k.count })}`}
            share={pct(k.totalEtb, maxKind)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.expenses.bought')} isEmpty={e.bought.length === 0}>
        {e.bought.map((b) => (
          <Bar
            key={b.name}
            label={b.name}
            value={`${money(b.totalEtb)} · ${t('reportsHub.timesCount', { count: b.times })}`}
            share={pct(b.totalEtb, maxBought)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.expenses.byPerson')} isEmpty={e.byPerson.length === 0}>
        {e.byPerson.map((p) => (
          <View key={p.name} className="rounded-[12px] bg-background px-3 py-2" accessible>
            <View className="flex-row justify-between">
              <Text font="bold" className="text-sm">
                {p.name}
              </Text>
              <Text font="bold" className="text-sm">
                {money(p.totalEtb)}
              </Text>
            </View>
            <Text tone="muted" className="text-sm">
              {t('reportsHub.expenses.split', {
                count: p.count,
                cash: money(p.cashEtb),
                bank: money(p.bankEtb),
              })}
            </Text>
          </View>
        ))}
        {e.changed > 0 ? (
          <Text tone="muted" className="text-sm">
            {t('reportsHub.expenses.changed', { count: e.changed })}
          </Text>
        ) : null}
        {e.deleted.map((d, n) => (
          <Bar
            key={`${d.title}-${n}`}
            label={`${t('reportsHub.expenses.deleted')}: ${d.title}`}
            value={`${money(d.amountEtb)}${d.reason ? ` · ${d.reason}` : ''}`}
          />
        ))}
      </Card>
    </>
  );
}

function StaffTab({ r, t }: { r: RestaurantReport; t: TFunction }) {
  const s = r.staff;
  const maxSales = maxOf(s.waiters.map((w) => w.salesEtb));
  const maxTips = maxOf(s.tips.map((x) => x.totalEtb));
  const checks = s.checks.ok + s.checks.bad;
  return (
    <>
      <Card title={t('reportsHub.staff.waiters')} isEmpty={s.waiters.length === 0}>
        {s.waiters.map((w) => (
          <Bar
            key={w.name}
            label={w.name}
            value={`${money(w.salesEtb)} · ${t('reportsHub.billsCount', { count: w.bills })} · ${t(
              'reportsHub.staff.avg',
              { amount: money(w.averageEtb) }
            )}`}
            share={pct(w.salesEtb, maxSales)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.staff.tips')} isEmpty={s.tips.length === 0}>
        {s.tips.map((x) => (
          <Bar
            key={x.name}
            label={x.name}
            value={`${money(x.totalEtb)} · ${t('reportsHub.staff.paidOut', {
              amount: money(x.paidOutEtb),
            })}`}
            share={pct(x.totalEtb, maxTips)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.staff.checks')} isEmpty={checks === 0}>
        <Text font="semibold" className="text-sm">
          {t('reportsHub.staff.checksTotal', { ok: s.checks.ok, bad: s.checks.bad })}
        </Text>
        {s.checks.byBank.map((b) => (
          <Bar
            key={b.bank}
            label={b.bank}
            value={t('reportsHub.staff.okBad', { ok: b.ok, bad: b.bad })}
            share={pct(b.bad, b.ok + b.bad)}
            tone="danger"
          />
        ))}
        {s.checks.byPerson.map((p) => (
          <Bar
            key={p.name}
            label={p.name}
            value={t('reportsHub.staff.okBad', { ok: p.ok, bad: p.bad })}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.staff.kitchen')} isEmpty={s.kitchen.orders === 0}>
        <Text font="semibold" className="text-sm">
          {t('reportsHub.staff.kitchenAverage', {
            minutes: s.kitchen.averageMinutes,
            count: s.kitchen.orders,
          })}
        </Text>
        {s.kitchen.slowest.map((d) => (
          <Bar
            key={d.name}
            label={d.name}
            value={t('reportsHub.staff.minutes', { minutes: d.averageMinutes, count: d.orders })}
          />
        ))}
      </Card>
    </>
  );
}

/** The open tab as a table for PDF / CSV. */
function exportTable(t: TFunction, tab: Tab, r: RestaurantReport, subtitle: string): ExportTable {
  const title = `${t('reportsHub.title')} · ${t(`reportsHub.tabs.${tab}`)}`;
  const columns = [
    t('reportsHub.export.what'),
    t('reportsHub.export.detail'),
    t('reportsHub.export.amount'),
  ];
  const rows: string[][] = [];
  if (tab === 'sales') {
    rows.push([
      t('reportsHub.sales.total'),
      t('reportsHub.billsCount', { count: r.sales.bills }),
      money(r.sales.totalEtb),
    ]);
    for (const m of r.sales.methods)
      rows.push([t(methodKey(m.method)), String(m.bills), money(m.totalEtb)]);
    for (const h of r.sales.byHour.filter((x) => x.bills > 0)) {
      rows.push([
        t('reportsHub.hour', { from: h.hour, to: (h.hour + 1) % 24 }),
        String(h.bills),
        money(h.totalEtb),
      ]);
    }
    for (const d of r.sales.byDay) rows.push([d.day, String(d.bills), money(d.totalEtb)]);
  } else if (tab === 'menu') {
    for (const i of r.menu.items)
      rows.push([i.name, t('reportsHub.qty', { count: i.qty }), money(i.totalEtb)]);
    for (const c of r.menu.categories)
      rows.push([
        c.name || t('reportsHub.menu.noCategory'),
        t('reportsHub.qty', { count: c.qty }),
        money(c.totalEtb),
      ]);
    for (const o of r.menu.cancelled.list) {
      rows.push([
        t('reportsHub.menu.order', { number: o.number }),
        [o.by, o.reason].filter(Boolean).join(' · '),
        money(o.totalEtb),
      ]);
    }
  } else if (tab === 'expenses') {
    for (const k of r.expenses.byKind)
      rows.push([t(`extras.money.categories.${k.kind}`), String(k.count), money(k.totalEtb)]);
    for (const b of r.expenses.bought) rows.push([b.name, String(b.times), money(b.totalEtb)]);
    for (const p of r.expenses.byPerson) rows.push([p.name, String(p.count), money(p.totalEtb)]);
  } else {
    for (const w of r.staff.waiters)
      rows.push([w.name, t('reportsHub.billsCount', { count: w.bills }), money(w.salesEtb)]);
    for (const x of r.staff.tips)
      rows.push([`${t('reportsHub.staff.tips')}: ${x.name}`, String(x.count), money(x.totalEtb)]);
    for (const b of r.staff.checks.byBank)
      rows.push([b.bank, t('reportsHub.staff.okBad', { ok: b.ok, bad: b.bad }), '']);
  }
  return { title, subtitle, columns, rows };
}

/**
 * Restaurant reports (owner, or a manager allowed to see reports): sales, food and drink,
 * expenses and buying, staff and checks — for a period or one day. The server makes every sum.
 */
export default function ReportsHubScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const businessName = useSession((s) => s.user?.businessName ?? '');
  const [range, setRange] = useState<ReportRange>({ period: 'today' });
  const [tab, setTab] = useState<Tab>('sales');
  const [choosing, setChoosing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const query = useQuery({
    queryKey: restaurantReportKey(range),
    queryFn: () => getRestaurantReport(range),
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const dayDate = range.day ? new Date(`${range.day}T12:00:00`) : null;
  const rangeLabel = dayDate
    ? t('period.day', { month: t(`period.month_${dayDate.getMonth()}`), day: dayDate.getDate() })
    : t(`period.${range.period}`);
  const report = query.data;

  const download = async (kind: 'pdf' | 'csv') => {
    if (!report) return;
    setDownloading(true);
    try {
      const table = exportTable(t, tab, report, `${businessName} · ${rangeLabel}`);
      if (kind === 'pdf') await sharePdf(table);
      else await shareCsv(`report-${tab}-${range.day ?? range.period}.csv`, table);
    } catch {
      Alert.alert(t('common.error'), t('transactions.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }
  const forbidden = query.error instanceof ApiError && query.error.code === 'FORBIDDEN';

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScreenHeader
        title={t('reportsHub.title')}
        onBack={goBack}
        right={<CalendarButton day={dayDate} onPress={() => setChoosing(true)} />}
      />
      <View className="flex-row gap-2 px-4 pb-2" accessibilityRole="radiogroup">
        {periods.map((p) => (
          <Chip
            key={p}
            label={t(`period.${p}`)}
            selected={!range.day && range.period === p}
            onPress={() => setRange({ period: p })}
          />
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-16 flex-grow-0"
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}
        accessibilityRole="tablist"
      >
        {tabs.map((x) => (
          <Chip
            key={x}
            label={t(`reportsHub.tabs.${x}`)}
            selected={tab === x}
            onPress={() => setTab(x)}
          />
        ))}
      </ScrollView>

      {query.isPending ? (
        <LoadingView />
      ) : !report ? (
        <Text tone="muted" className="px-6 pt-6 text-center text-lg">
          {forbidden ? t('extras.flow.notAllowed') : t(errorMessageKey(query.error))}
        </Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text tone="muted" font="semibold" className="text-sm">
              {rangeLabel}
            </Text>
            {tab === 'sales' ? <SalesTab r={report} t={t} /> : null}
            {tab === 'menu' ? <MenuTab r={report} t={t} am={i18n.language === 'am'} /> : null}
            {tab === 'expenses' ? (
              <ExpensesTab r={report} t={t} onMoneyFlow={() => router.push('/money-flow')} />
            ) : null}
            {tab === 'staff' ? <StaffTab r={report} t={t} /> : null}
          </ScrollView>
          <View className="flex-row gap-2.5 px-4 py-2.5">
            <View className="flex-1">
              <Button
                label={t('report.downloadPdf')}
                size="md"
                disabled={downloading}
                onPress={() => download('pdf')}
              />
            </View>
            <View className="flex-1">
              <Button
                label={t('report.downloadCsv')}
                variant="outline"
                size="md"
                disabled={downloading}
                onPress={() => download('csv')}
              />
            </View>
          </View>
        </>
      )}

      <CalendarSheet
        key={`${choosing}-${range.day}`}
        visible={choosing}
        period={range.period}
        day={range.day ?? null}
        onPeriod={(period) => setRange({ period })}
        onDay={(day) => setRange({ period: range.period, day })}
        onClose={() => setChoosing(false)}
      />
    </SafeAreaView>
  );
}
