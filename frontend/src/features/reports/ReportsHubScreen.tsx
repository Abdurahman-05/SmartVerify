import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Download, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { CalendarButton } from '@/features/transactions/CalendarButton';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { shareCsv, sharePdf, type ExportTable } from '@/lib/export';
import { periods, type Period } from '@/lib/period';
import {
  daysOf,
  getExpensesReport,
  getFoodReport,
  getSalesReport,
  getStaffReport,
  reportKey,
  type ExpensesReport,
  type FoodReport,
  type ReportDays,
  type ReportTab,
  type SalesReport,
  type StaffReport,
} from '@/lib/reports';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

const tabs: ReportTab[] = ['sales', 'food', 'expenses', 'staff'];
type AnyReport = SalesReport | FoodReport | ExpensesReport | StaffReport;
const fetchers: Record<ReportTab, (days: ReportDays) => Promise<AnyReport>> = {
  sales: getSalesReport,
  food: getFoodReport,
  expenses: getExpensesReport,
  staff: getStaffReport,
};

/** The design's soft bar (primary at 35%) and bar track (primary soft). */
const BAR_SOFT = 'rgba(13,74,54,0.35)';
const BAR_TRACK = '#E6F2EC';

/** Whole ETB with commas, "ብር" in Amharic. */
const money = (v: number) => formatMoney(v);
const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const maxOf = (values: number[]) => Math.max(0, ...values);

// ─── Building blocks ─────────────────────────────────────────────────────────

function PeriodChip({
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
      className={`h-11 items-center justify-center rounded-full px-[18px] ${
        selected ? 'bg-primary' : 'border-2 border-border bg-surface'
      }`}
    >
      <Text font="bold" tone={selected ? 'inverse' : 'default'} className="text-[15px]">
        {label}
      </Text>
    </Pressable>
  );
}

function Card({
  title,
  hint,
  isEmpty,
  children,
}: {
  title: string;
  hint?: ReactNode;
  isEmpty?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View className="rounded-[22px] border-[1.5px] border-border bg-surface px-4 pb-2 pt-3.5">
      <Text font="heading" className="text-lg" accessibilityRole="header">
        {title}
      </Text>
      {hint ? <View className="pt-0.5">{hint}</View> : null}
      {isEmpty ? (
        <Text tone="muted" className="pb-2 pt-2 text-[15px]">
          {t('reportsHub.empty')}
        </Text>
      ) : (
        <View className="gap-4 pb-2 pt-2.5">{children}</View>
      )}
    </View>
  );
}

/** A bar of one or more coloured parts (shares of 100). */
function Track({ parts }: { parts: { share: number; color: string }[] }) {
  return (
    <View
      className="mt-1.5 h-2 flex-row overflow-hidden rounded-full"
      style={{ backgroundColor: BAR_TRACK }}
    >
      {parts.map((p, i) => (
        <View
          key={i}
          style={{ width: `${Math.max(0, Math.min(p.share, 100))}%`, backgroundColor: p.color }}
        />
      ))}
    </View>
  );
}

/** Title + sub line on the left, value on the right, optional bar and chevron. */
function Row({
  title,
  sub,
  value,
  parts,
  rank,
  onPress,
}: {
  title: string;
  sub?: ReactNode;
  value?: ReactNode;
  parts?: { share: number; color: string }[];
  rank?: number;
  onPress?: () => void;
}) {
  const body = (
    <View className="flex-row gap-3">
      {rank ? (
        <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-primarySoft">
          <Text font="bold" className="text-sm text-primaryText">
            {rank}
          </Text>
        </View>
      ) : null}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Text font="semibold" className="text-base" numberOfLines={2}>
              {title}
            </Text>
            {sub ? (
              <Text tone="muted" className="text-sm">
                {sub}
              </Text>
            ) : null}
          </View>
          {typeof value === 'string' ? (
            <Text font="heading" className="text-[15px]">
              {value}
            </Text>
          ) : (
            value
          )}
          {onPress ? <ChevronRight size={20} color={colors.muted} strokeWidth={2} /> : null}
        </View>
        {parts ? <Track parts={parts} /> : null}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-11 justify-center active:opacity-70"
    >
      {body}
    </Pressable>
  ) : (
    <View accessible>{body}</View>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'soft';
}) {
  const bg = tone === 'bad' ? 'bg-dangerBg' : tone === 'good' ? 'bg-successBg' : 'bg-primarySoft';
  const fg = tone === 'bad' ? colors.alert : tone === 'good' ? colors.success : colors.text;
  return (
    <View className={`flex-1 rounded-[14px] px-3 py-2 ${bg}`} accessible>
      <Text
        font="bold"
        className="text-sm"
        style={{ color: tone === 'bad' ? colors.dangerFg : colors.successFg }}
      >
        {label}
      </Text>
      <Text
        font="heading"
        className="text-[22px]"
        style={{ color: fg }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View className="flex-row gap-4">
      {items.map((i) => (
        <View key={i.label} className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          <Text tone="muted" className="text-sm">
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The green hero card at the top of a tab. */
function Hero({
  label,
  amount,
  children,
}: {
  label: string;
  amount: number;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View className="rounded-[22px] bg-primary p-5" accessible>
      <Text font="semibold" className="text-base" style={{ color: BAR_TRACK }}>
        {label}
      </Text>
      <View className="flex-row items-end gap-2">
        <Text
          font="heading"
          tone="inverse"
          className="text-[42px] leading-[50px]"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(amount, false)}
        </Text>
        <Text font="heading" tone="inverse" className="pb-2 text-xl">
          {t('common.etb')}
        </Text>
      </View>
      {children}
    </View>
  );
}

function HeroBox({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-[14px] bg-white/[0.14] px-3 py-2">
      <Text font="semibold" tone="inverse" className="text-sm">
        {label}
      </Text>
      <Text font="heading" tone="inverse" className="text-[17px]">
        {value}
      </Text>
    </View>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function SalesTab({ s, t, showDays }: { s: SalesReport; t: TFunction; showDays: boolean }) {
  const change =
    s.previousTotal > 0 ? Math.round(((s.total - s.previousTotal) / s.previousTotal) * 100) : null;
  // The chart runs from the first to the last hour with sales.
  const active = s.byHour.filter((h) => h.bills > 0);
  const first = active[0]?.hour ?? 0;
  const last = active[active.length - 1]?.hour ?? -1;
  const chart = s.byHour.filter((h) => h.hour >= first && h.hour <= last);
  const maxHour = maxOf(chart.map((h) => h.amount));
  const top = [...active].sort((a, b) => b.amount - a.amount).slice(0, 3);
  const topHours = new Set(top.map((h) => h.hour));
  const maxDay = maxOf(s.byDay.map((d) => d.amount));
  const hourLabel = (h: number) => t('reportsHub.hour', { from: h, to: (h + 1) % 24 });
  const methods = [
    { key: 'cash', label: t('reportsHub.cash'), ...s.paidBy.cash },
    { key: 'bank', label: t('reportsHub.bank'), ...s.paidBy.bank },
    { key: 'both', label: t('reportsHub.cashBank'), ...s.paidBy.both },
  ];

  return (
    <>
      <Hero label={t('reportsHub.sales.total')} amount={s.total}>
        {change === null ? null : (
          <View className="mt-2.5 h-8 justify-center self-start rounded-full bg-surface px-3">
            <Text
              font="bold"
              className="text-[15px]"
              style={{ color: change >= 0 ? colors.success : colors.alert }}
            >
              {t(change >= 0 ? 'reportsHub.sales.up' : 'reportsHub.sales.down', {
                percent: Math.abs(change),
                amount: money(s.previousTotal),
              })}
            </Text>
          </View>
        )}
        <View className="mt-3.5 flex-row gap-2">
          <HeroBox label={t('reportsHub.sales.bills')} value={String(s.bills)} />
          <HeroBox label={t('reportsHub.sales.average')} value={money(s.avgBill)} />
        </View>
      </Hero>

      <Card title={t('reportsHub.sales.methods')} isEmpty={s.bills === 0}>
        {methods.map((m) => (
          <Row
            key={m.key}
            title={m.label}
            sub={`${t('reportsHub.billsCount', { count: m.bills })} · ${pct(m.amount, s.total)}%`}
            value={money(m.amount)}
            parts={[{ share: pct(m.amount, s.total), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.sales.byHour')} isEmpty={active.length === 0}>
        <View
          className="mb-1 mt-1.5 h-[140px] flex-row items-end gap-[3px]"
          accessible
          accessibilityLabel={top.map((h) => `${hourLabel(h.hour)}: ${money(h.amount)}`).join(', ')}
        >
          {chart.map((h) => (
            <View key={h.hour} className="h-full flex-1 justify-end">
              <View
                className="w-full rounded-t-[4px]"
                style={{
                  height: `${Math.max(pct(h.amount, maxHour), h.bills ? 6 : 0)}%`,
                  backgroundColor: topHours.has(h.hour) ? colors.primary : BAR_SOFT,
                }}
              />
            </View>
          ))}
        </View>
        <View className="-mt-2 flex-row gap-[3px]">
          {chart.map((h) => (
            <Text
              key={h.hour}
              tone="muted"
              className="flex-1 text-center text-sm"
              numberOfLines={1}
            >
              {h.hour}
            </Text>
          ))}
        </View>
        {top.map((h) => (
          <Row
            key={h.hour}
            title={hourLabel(h.hour)}
            sub={t('reportsHub.billsCount', { count: h.bills })}
            value={money(h.amount)}
          />
        ))}
      </Card>

      {showDays ? (
        <Card
          title={t('reportsHub.sales.byDay')}
          hint={
            <Text tone="muted" className="text-sm">
              {t('reportsHub.sales.byDayHint')}
            </Text>
          }
          isEmpty={s.bills === 0}
        >
          {s.byDay.map((d) => {
            const date = new Date(`${d.date}T12:00:00`);
            return (
              <Row
                key={d.date}
                title={`${t(`reportsHub.weekday_${date.getDay()}`)} · ${t('period.day', {
                  month: t(`period.month_${date.getMonth()}`),
                  day: date.getDate(),
                })}`}
                sub={t('reportsHub.billsCount', { count: d.bills })}
                value={money(d.amount)}
                parts={[{ share: pct(d.amount, maxDay), color: colors.primary }]}
              />
            );
          })}
        </Card>
      ) : null}
    </>
  );
}

function FoodTab({ f, t, am }: { f: FoodReport; t: TFunction; am: boolean }) {
  const [all, setAll] = useState(false);
  const name = (x: { name: string; nameAm: string | null }) => (am && x.nameAm ? x.nameAm : x.name);
  const shown = all ? f.bestSellers : f.bestSellers.slice(0, 7);
  const maxQty = maxOf(f.bestSellers.map((i) => i.qty));
  const catTotal = f.byCategory.reduce((s, c) => s + c.amount, 0);
  const maxSlow = maxOf(f.slowSellers.map((i) => i.qty));
  const maxCancelled = maxOf(f.cancelled.topItems.map((i) => i.qty));

  return (
    <>
      <Card title={t('reportsHub.menu.best')} isEmpty={f.bestSellers.length === 0}>
        {shown.map((i, n) => (
          <Row
            key={`${i.name}-${n}`}
            rank={n + 1}
            title={name(i)}
            sub={money(i.amount)}
            value={t('reportsHub.qty', { count: i.qty })}
            parts={[{ share: pct(i.qty, maxQty), color: colors.primary }]}
          />
        ))}
        {!all && f.bestSellers.length > 7 ? (
          <Pressable
            onPress={() => setAll(true)}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center justify-center gap-1"
          >
            <Text font="bold" className="text-[15px] text-primaryText">
              {t('reportsHub.menu.showAll', { count: f.bestSellers.length })}
            </Text>
            <ChevronRight size={18} color={colors.primaryText} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </Card>

      <Card title={t('reportsHub.menu.categories')} isEmpty={f.byCategory.length === 0}>
        {f.byCategory.map((c) => (
          <Row
            key={c.name || 'other'}
            title={c.name ? name(c) : t('reportsHub.menu.noCategory')}
            sub={`${t('reportsHub.qty', { count: c.qty })} · ${pct(c.amount, catTotal)}%`}
            value={money(c.amount)}
            parts={[{ share: pct(c.amount, catTotal), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.menu.slow')} isEmpty={f.slowSellers.length === 0}>
        {f.slowSellers.map((i, n) => (
          <Row
            key={`${i.name}-${n}`}
            title={name(i)}
            sub={i.qty === 0 ? undefined : money(i.amount)}
            value={
              i.qty === 0 ? t('reportsHub.menu.notSold') : t('reportsHub.qty', { count: i.qty })
            }
            parts={[{ share: pct(i.qty, Math.max(maxSlow, 1) * 4), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.menu.cancelled')} isEmpty={f.cancelled.count === 0}>
        <View className="flex-row gap-2.5">
          <StatBox
            label={t('reportsHub.menu.cancelledLabel')}
            value={t('reportsHub.ordersCount', { count: f.cancelled.count })}
            tone="bad"
          />
          <StatBox
            label={t('reportsHub.menu.moneyLost')}
            value={money(f.cancelled.amount)}
            tone="bad"
          />
        </View>
        <Text font="bold" className="text-sm">
          {t('reportsHub.menu.mostCancelled')}
        </Text>
        {f.cancelled.topItems.map((i) => (
          <Row
            key={i.name}
            title={i.name}
            value={t('reportsHub.timesCount', { count: i.qty })}
            parts={[{ share: pct(i.qty, maxCancelled), color: colors.alert }]}
          />
        ))}
        <Text font="bold" className="text-sm">
          {t('reportsHub.menu.orders')}
        </Text>
        {f.cancelled.orders.map((o) => (
          <View key={o.id} className="border-t border-divider pt-2.5">
            <Row
              title={`${t('reportsHub.menu.order', { number: o.number })} · ${money(o.amount)}`}
              sub={[o.waiter, o.reason].filter(Boolean).join(' · ')}
            />
          </View>
        ))}
      </Card>
    </>
  );
}

function ExpensesTab({
  e,
  t,
  go,
}: {
  e: ExpensesReport;
  t: TFunction;
  go: (path: '/money-flow' | '/money-out') => void;
}) {
  const maxBought = maxOf(e.boughtItems.map((b) => b.amount));
  const maxPerson = maxOf(e.byPerson.map((p) => p.total));
  return (
    <>
      <Hero label={t('reportsHub.expenses.total')} amount={e.total}>
        <View className="mt-3 flex-row gap-2">
          <HeroBox label={t('reportsHub.expenses.profit')} value={money(e.profit)} />
          <HeroBox label={t('reportsHub.expenses.moneyLeft')} value={money(e.moneyLeft)} />
        </View>
        <Pressable
          onPress={() => go('/money-flow')}
          accessibilityRole="button"
          className="mt-2.5 min-h-12 flex-row items-center rounded-[14px] bg-white/[0.14] px-3.5 active:opacity-80"
        >
          <Text font="bold" tone="inverse" className="flex-1 text-[15px]">
            {t('reportsHub.expenses.openFlow')}
          </Text>
          <ChevronRight size={22} color={colors.surface} strokeWidth={2.2} />
        </Pressable>
      </Hero>

      <Card title={t('reportsHub.expenses.byKind')} isEmpty={e.byKind.length === 0}>
        {e.byKind.map((k) => (
          <Row
            key={k.kind}
            title={t(`extras.money.categories.${k.kind}`)}
            sub={`${t('reportsHub.expensesCount', { count: k.count })} · ${pct(k.amount, e.total)}%`}
            value={money(k.amount)}
            parts={[{ share: pct(k.amount, e.total), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card
        title={t('reportsHub.expenses.bought')}
        hint={
          <Text tone="muted" className="text-sm">
            {t('reportsHub.expenses.fromBuyList')}
          </Text>
        }
        isEmpty={e.boughtItems.length === 0}
      >
        {e.boughtItems.map((b) => (
          <Row
            key={b.name}
            title={b.name}
            sub={t('reportsHub.timesCount', { count: b.times })}
            value={money(b.amount)}
            parts={[{ share: pct(b.amount, maxBought), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card
        title={t('reportsHub.expenses.byPerson')}
        hint={
          <Legend
            items={[
              { label: t('reportsHub.cash'), color: colors.primary },
              { label: t('reportsHub.bank'), color: colors.amber },
            ]}
          />
        }
        isEmpty={e.byPerson.length === 0 && e.changedByOwner === 0 && e.deleted.length === 0}
      >
        {e.byPerson.map((p) => (
          <Row
            key={p.name}
            title={p.name}
            sub={t('reportsHub.expenses.split', {
              count: p.count,
              cash: formatMoney(p.cash, false),
              bank: formatMoney(p.bank, false),
            })}
            value={money(p.total)}
            parts={[
              { share: pct(p.cash, maxPerson), color: colors.primary },
              { share: pct(p.bank, maxPerson), color: colors.amber },
            ]}
            onPress={() => go('/money-out')}
          />
        ))}
        {e.changedByOwner > 0 ? (
          <Pressable
            onPress={() => go('/money-out')}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center gap-3 border-t border-divider pt-2.5"
          >
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primarySoft">
              <Pencil size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text font="bold" className="flex-1 text-[15px]">
              {t('reportsHub.expenses.changed', { count: e.changedByOwner })}
            </Text>
            <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
          </Pressable>
        ) : null}
        {e.deleted.map((d, n) => (
          <Pressable
            key={`${d.title}-${n}`}
            onPress={() => go('/money-out')}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center gap-3 border-t border-divider pt-2.5"
          >
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-dangerBg">
              <Trash2 size={18} color={colors.alert} strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text font="bold" className="text-[15px]">
                {t('reportsHub.expenses.deletedLine', { title: d.title, amount: money(d.amount) })}
              </Text>
              {d.reason ? (
                <Text tone="muted" className="text-sm">
                  {t('reportsHub.expenses.reason', { reason: d.reason })}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
          </Pressable>
        ))}
      </Card>
    </>
  );
}

function OkBad({ ok, failed, t }: { ok: number; failed: number; t: TFunction }) {
  return (
    <Text font="heading" className="text-[15px]">
      {t('reportsHub.staff.ok', { count: ok })}
      {failed > 0 ? (
        <Text font="heading" className="text-[15px]" style={{ color: colors.alert }}>
          {` · ${t('reportsHub.staff.failed', { count: failed })}`}
        </Text>
      ) : null}
    </Text>
  );
}

function StaffTab({ s, t }: { s: StaffReport; t: TFunction }) {
  const maxSales = maxOf(s.waiterSales.map((w) => w.sales));
  const maxTips = maxOf(s.tips.map((x) => x.total));
  const maxDish = maxOf(s.kitchen.slowest.map((d) => d.minutes));
  const c = s.receiptChecks;
  const checkParts = (ok: number, failed: number) => [
    { share: pct(ok, ok + failed), color: colors.success },
    { share: pct(failed, ok + failed), color: colors.alert },
  ];
  return (
    <>
      <Card title={t('reportsHub.staff.waiters')} isEmpty={s.waiterSales.length === 0}>
        {s.waiterSales.map((w, n) => (
          <Row
            key={w.name}
            rank={n + 1}
            title={w.name}
            sub={`${t('reportsHub.billsCount', { count: w.bills })} · ${t('reportsHub.staff.avg', {
              amount: money(w.avgBill),
            })}`}
            value={money(w.sales)}
            parts={[{ share: pct(w.sales, maxSales), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card
        title={t('reportsHub.staff.tips')}
        hint={
          <Legend
            items={[
              { label: t('reportsHub.staff.paidOutLegend'), color: colors.primary },
              { label: t('reportsHub.staff.stillToPay'), color: colors.amber },
            ]}
          />
        }
        isEmpty={s.tips.length === 0}
      >
        {s.tips.map((x) => (
          <Row
            key={x.name}
            title={x.name}
            sub={t('reportsHub.staff.paidLeft', {
              paid: formatMoney(x.paidOut, false),
              left: formatMoney(x.total - x.paidOut, false),
            })}
            value={money(x.total)}
            parts={[
              { share: pct(x.paidOut, maxTips), color: colors.primary },
              { share: pct(x.total - x.paidOut, maxTips), color: colors.amber },
            ]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.staff.checks')} isEmpty={c.ok + c.failed === 0}>
        <View className="flex-row gap-2.5">
          <StatBox label={t('reportsHub.staff.verified')} value={String(c.ok)} tone="good" />
          <StatBox
            label={t('reportsHub.staff.failedOrSuspicious')}
            value={String(c.failed)}
            tone="bad"
          />
        </View>
        <Text font="bold" className="text-sm">
          {t('reportsHub.staff.byBank')}
        </Text>
        {c.byBank.map((b) => (
          <Row
            key={b.bank}
            title={t(`reportsHub.bankNames.${b.bank}`, { defaultValue: b.bank })}
            value={<OkBad ok={b.ok} failed={b.failed} t={t} />}
            parts={checkParts(b.ok, b.failed)}
          />
        ))}
        <Text font="bold" className="text-sm">
          {t('reportsHub.staff.byStaff')}
        </Text>
        {c.byStaff.map((p) => (
          <Row
            key={p.name}
            title={p.name}
            value={<OkBad ok={p.ok} failed={p.failed} t={t} />}
            parts={checkParts(p.ok, p.failed)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.staff.kitchen')} isEmpty={s.kitchen.orders === 0}>
        <View className="flex-row gap-2.5">
          <StatBox
            label={t('reportsHub.staff.onAverage')}
            value={t('reportsHub.staff.min', { minutes: s.kitchen.avgMinutes })}
            tone="soft"
          />
          <StatBox
            label={t('reportsHub.staff.ordersLabel')}
            value={String(s.kitchen.orders)}
            tone="soft"
          />
        </View>
        <Text font="bold" className="text-sm">
          {t('reportsHub.staff.slowest')}
        </Text>
        {s.kitchen.slowest.map((d) => (
          <Row
            key={d.name}
            title={d.name}
            sub={t('reportsHub.ordersCount', { count: d.orders })}
            value={t('reportsHub.staff.min', { minutes: d.minutes })}
            parts={[
              {
                share: pct(d.minutes, maxDish),
                // Slower than the kitchen's average shows red.
                color: d.minutes > s.kitchen.avgMinutes ? colors.alert : colors.primary,
              },
            ]}
          />
        ))}
      </Card>
    </>
  );
}

/** The open tab as a table for PDF / CSV (made on the phone, so Amharic stays readable). */
function exportTable(t: TFunction, tab: ReportTab, data: AnyReport, subtitle: string): ExportTable {
  const m = (v: number) => formatMoney(v, false);
  const qty = (count: number) => t('reportsHub.qty', { count });
  const bills = (count: number) => t('reportsHub.billsCount', { count });
  const rows: string[][] = [];
  if (tab === 'sales') {
    const s = data as SalesReport;
    rows.push([t('reportsHub.sales.total'), bills(s.bills), m(s.total)]);
    rows.push([t('reportsHub.sales.average'), '', m(s.avgBill)]);
    rows.push([t('reportsHub.cash'), bills(s.paidBy.cash.bills), m(s.paidBy.cash.amount)]);
    rows.push([t('reportsHub.bank'), bills(s.paidBy.bank.bills), m(s.paidBy.bank.amount)]);
    rows.push([t('reportsHub.cashBank'), bills(s.paidBy.both.bills), m(s.paidBy.both.amount)]);
    for (const h of s.byHour.filter((x) => x.bills > 0)) {
      rows.push([
        t('reportsHub.hour', { from: h.hour, to: (h.hour + 1) % 24 }),
        bills(h.bills),
        m(h.amount),
      ]);
    }
    for (const d of s.byDay) rows.push([d.date, bills(d.bills), m(d.amount)]);
  } else if (tab === 'food') {
    const f = data as FoodReport;
    for (const i of f.bestSellers) rows.push([i.name, qty(i.qty), m(i.amount)]);
    for (const c of f.byCategory) {
      rows.push([c.name || t('reportsHub.menu.noCategory'), qty(c.qty), m(c.amount)]);
    }
    for (const o of f.cancelled.orders) {
      const who = [o.waiter, o.reason].filter(Boolean).join(' · ');
      rows.push([t('reportsHub.menu.order', { number: o.number }), who, m(o.amount)]);
    }
  } else if (tab === 'expenses') {
    const e = data as ExpensesReport;
    rows.push([t('reportsHub.expenses.total'), '', m(e.total)]);
    rows.push([t('reportsHub.expenses.profit'), '', m(e.profit)]);
    rows.push([t('reportsHub.expenses.moneyLeft'), '', m(e.moneyLeft)]);
    for (const k of e.byKind) {
      rows.push([t(`extras.money.categories.${k.kind}`), String(k.count), m(k.amount)]);
    }
    for (const b of e.boughtItems) rows.push([b.name, String(b.times), m(b.amount)]);
    for (const p of e.byPerson) rows.push([p.name, String(p.count), m(p.total)]);
  } else {
    const s = data as StaffReport;
    for (const w of s.waiterSales) rows.push([w.name, bills(w.bills), m(w.sales)]);
    for (const x of s.tips) rows.push([`${t('reportsHub.staff.tips')}: ${x.name}`, '', m(x.total)]);
    for (const b of s.receiptChecks.byBank) {
      const detail = `${t('reportsHub.staff.ok', { count: b.ok })} · ${t('reportsHub.staff.failed', { count: b.failed })}`;
      rows.push([b.bank, detail, '']);
    }
  }
  return {
    title: `${t('reportsHub.title')} · ${t(`reportsHub.tabs.${tab}`)}`,
    subtitle,
    columns: [
      t('reportsHub.export.what'),
      t('reportsHub.export.detail'),
      t('reportsHub.export.amount'),
    ],
    rows,
  };
}

/**
 * Restaurant reports (owner, or a manager while the owner allows it): sales, food and drink,
 * expenses, staff and checks — for today, 7 or 30 days, or one chosen day. Each tab is fetched
 * only when it opens; the server makes every sum. Design: docs/design/screens/reports-design.
 */
export default function ReportsHubScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const businessName = useSession((s) => s.user?.businessName ?? '');
  const [period, setPeriod] = useState<Period>('today');
  const [day, setDay] = useState<string | undefined>();
  const [tab, setTab] = useState<ReportTab>('sales');
  const [choosing, setChoosing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const days = daysOf(period, day);
  const query = useQuery({
    queryKey: reportKey(tab, days),
    queryFn: () => fetchers[tab](days),
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const dayDate = day ? new Date(`${day}T12:00:00`) : null;
  const rangeLabel = dayDate
    ? t('period.day', { month: t(`period.month_${dayDate.getMonth()}`), day: dayDate.getDate() })
    : t(`period.${period}`);
  const report = query.data;

  const download = async (kind: 'pdf' | 'csv') => {
    if (!report) return;
    setDownloading(true);
    try {
      const table = exportTable(t, tab, report, `${businessName} · ${rangeLabel}`);
      if (kind === 'pdf') await sharePdf(table);
      else await shareCsv(`report-${tab}-${days.from}-${days.to}.csv`, table);
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
        right={<CalendarButton day={dayDate ?? new Date()} onPress={() => setChoosing(true)} />}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-grow-0"
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 }}
        accessibilityRole="radiogroup"
      >
        {periods.map((p) => (
          <PeriodChip
            key={p}
            label={t(`period.${p}`)}
            selected={!day && period === p}
            onPress={() => {
              setDay(undefined);
              setPeriod(p);
            }}
          />
        ))}
        {dayDate ? (
          <PeriodChip label={rangeLabel} selected onPress={() => setChoosing(true)} />
        ) : null}
      </ScrollView>

      <View className="border-y border-border bg-surface">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 2 }}
          accessibilityRole="tablist"
        >
          {tabs.map((x) => {
            const selected = tab === x;
            return (
              <Pressable
                key={x}
                onPress={() => setTab(x)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className={`h-12 justify-center border-b-[3px] px-3.5 ${
                  selected ? 'border-primary' : 'border-transparent'
                }`}
              >
                <Text
                  font="bold"
                  tone={selected ? 'default' : 'muted'}
                  className={`text-[15px] ${selected ? 'text-primary' : ''}`}
                >
                  {t(`reportsHub.tabs.${x}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {query.isPending ? (
        <LoadingView />
      ) : !report ? (
        <Text tone="muted" className="px-6 pt-6 text-center text-lg">
          {forbidden ? t('extras.flow.notAllowed') : t(errorMessageKey(query.error))}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 14, padding: 16 }}>
          {tab === 'sales' ? (
            <SalesTab s={report as SalesReport} t={t} showDays={!day && period !== 'today'} />
          ) : null}
          {tab === 'food' ? (
            <FoodTab
              key={`${days.from}-${days.to}`}
              f={report as FoodReport}
              t={t}
              am={i18n.language === 'am'}
            />
          ) : null}
          {tab === 'expenses' ? (
            <ExpensesTab e={report as ExpensesReport} t={t} go={(path) => router.push(path)} />
          ) : null}
          {tab === 'staff' ? <StaffTab s={report as StaffReport} t={t} /> : null}
        </ScrollView>
      )}

      <View className="flex-row gap-2.5 border-t border-border bg-surface px-4 py-3">
        <Pressable
          onPress={() => void download('pdf')}
          disabled={downloading || !report}
          accessibilityRole="button"
          className={`h-14 flex-1 flex-row items-center justify-center gap-2.5 rounded-button bg-primary ${
            downloading || !report ? 'opacity-50' : 'active:opacity-90'
          }`}
        >
          <Download size={20} color={colors.surface} strokeWidth={2.4} />
          <Text font="bold" tone="inverse" className="text-[17px]">
            {t('report.downloadPdf')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void download('csv')}
          disabled={downloading || !report}
          accessibilityRole="button"
          className={`h-14 flex-1 items-center justify-center rounded-button border-2 border-primary bg-surface ${
            downloading || !report ? 'opacity-50' : 'active:opacity-80'
          }`}
        >
          <Text font="bold" className="text-[17px] text-primary">
            {t('report.downloadCsv')}
          </Text>
        </Pressable>
      </View>

      <CalendarSheet
        key={`${choosing}-${day}`}
        visible={choosing}
        period={period}
        day={day ?? null}
        onPeriod={(p) => {
          setDay(undefined);
          setPeriod(p);
        }}
        onDay={setDay}
        onClose={() => setChoosing(false)}
      />
    </SafeAreaView>
  );
}
