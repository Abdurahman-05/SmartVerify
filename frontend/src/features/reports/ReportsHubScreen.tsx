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

/** Design colours that are not app tokens yet (reports only). */
const BAR_SOFT = 'rgba(13,74,54,0.35)';
const BAR_TRACK = '#E6F2EC';

const etb = (v: number) => `${formatMoney(v, false)} ETB`;
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
        <Text tone="muted" className="pt-2 text-sm">
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
  value: ReactNode;
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
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-70">
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
  return (
    <View className="rounded-[22px] bg-primary p-5" accessible>
      <Text font="semibold" className="text-base text-primarySoft">
        {label}
      </Text>
      <View className="flex-row items-end gap-1.5">
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
          ETB
        </Text>
      </View>
      {children}
    </View>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function SalesTab({ r, t }: { r: RestaurantReport; t: TFunction }) {
  const s = r.sales;
  const change =
    s.previousEtb > 0 ? Math.round(((s.totalEtb - s.previousEtb) / s.previousEtb) * 100) : null;
  // The chart runs from the first to the last hour with sales.
  const active = s.byHour.filter((h) => h.bills > 0);
  const first = active[0]?.hour ?? 0;
  const last = active[active.length - 1]?.hour ?? -1;
  const chart = s.byHour.filter((h) => h.hour >= first && h.hour <= last);
  const maxHour = maxOf(chart.map((h) => h.totalEtb));
  const top = [...active].sort((a, b) => b.totalEtb - a.totalEtb).slice(0, 3);
  const topHours = new Set(top.map((h) => h.hour));
  const maxDay = maxOf(s.byDay.map((d) => d.totalEtb));
  const hourLabel = (h: number) => t('reportsHub.hour', { from: h, to: (h + 1) % 24 });

  return (
    <>
      <Hero label={t('reportsHub.sales.total')} amount={s.totalEtb}>
        {change === null ? null : (
          <View className="mt-2.5 h-8 justify-center self-start rounded-full bg-surface px-3">
            <Text
              font="bold"
              className="text-[15px]"
              style={{ color: change >= 0 ? colors.success : colors.alert }}
            >
              {t(change >= 0 ? 'reportsHub.sales.up' : 'reportsHub.sales.down', {
                percent: Math.abs(change),
                amount: formatMoney(s.previousEtb, false),
              })}
            </Text>
          </View>
        )}
        <View className="mt-3 flex-row gap-2.5">
          <View className="flex-1 rounded-[14px] bg-white/[0.14] px-3 py-2">
            <Text font="semibold" tone="inverse" className="text-sm">
              {t('reportsHub.sales.bills')}
            </Text>
            <Text font="heading" tone="inverse" className="text-[17px]">
              {s.bills}
            </Text>
          </View>
          <View className="flex-1 rounded-[14px] bg-white/[0.14] px-3 py-2">
            <Text font="semibold" tone="inverse" className="text-sm">
              {t('reportsHub.sales.average')}
            </Text>
            <Text font="heading" tone="inverse" className="text-[17px]">
              {etb(s.averageEtb)}
            </Text>
          </View>
        </View>
      </Hero>

      <Card title={t('reportsHub.sales.methods')} isEmpty={s.bills === 0}>
        {s.methods.map((m) => (
          <Row
            key={m.method}
            title={t(methodKey(m.method))}
            sub={`${t('reportsHub.billsCount', { count: m.bills })} · ${pct(m.totalEtb, s.totalEtb)}%`}
            value={etb(m.totalEtb)}
            parts={[{ share: pct(m.totalEtb, s.totalEtb), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.sales.byHour')} isEmpty={active.length === 0}>
        <View
          className="mb-1 mt-1.5 h-[140px] flex-row items-end gap-[3px]"
          accessible
          accessibilityLabel={top.map((h) => `${hourLabel(h.hour)}: ${etb(h.totalEtb)}`).join(', ')}
        >
          {chart.map((h) => (
            <View key={h.hour} className="h-full flex-1 justify-end">
              <View
                className="w-full rounded-t-[4px]"
                style={{
                  height: `${Math.max(pct(h.totalEtb, maxHour), h.bills ? 6 : 0)}%`,
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
            value={etb(h.totalEtb)}
          />
        ))}
      </Card>

      {s.byDay.length > 1 ? (
        <Card title={t('reportsHub.sales.byDay')} isEmpty={s.bills === 0}>
          {s.byDay.map((d) => {
            const date = new Date(`${d.day}T12:00:00`);
            return (
              <Row
                key={d.day}
                title={`${t(`reportsHub.weekday_${date.getDay()}`)} · ${t('period.day', {
                  month: t(`period.month_${date.getMonth()}`),
                  day: date.getDate(),
                })}`}
                value={etb(d.totalEtb)}
                parts={[{ share: pct(d.totalEtb, maxDay), color: colors.primary }]}
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
  const [all, setAll] = useState(false);
  const name = (x: { name: string; nameAm: string | null }) => (am && x.nameAm ? x.nameAm : x.name);
  const ranked = m.items.slice(0, 15);
  const shown = all ? ranked : ranked.slice(0, 7);
  const maxQty = maxOf(ranked.map((i) => i.qty));
  const catTotal = m.categories.reduce((s, c) => s + c.totalEtb, 0);
  const maxSlow = maxOf(m.slow.map((i) => i.qty));
  const maxCancelled = maxOf(m.cancelled.items.map((i) => i.qty));

  return (
    <>
      <Card title={t('reportsHub.menu.best')} isEmpty={ranked.length === 0}>
        {shown.map((i, n) => (
          <Row
            key={`${i.name}-${n}`}
            rank={n + 1}
            title={name(i)}
            sub={etb(i.totalEtb)}
            value={t('reportsHub.qty', { count: i.qty })}
            parts={[{ share: pct(i.qty, maxQty), color: colors.primary }]}
          />
        ))}
        {!all && ranked.length > 7 ? (
          <Pressable
            onPress={() => setAll(true)}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center justify-center gap-1"
          >
            <Text font="bold" className="text-[15px] text-primaryText">
              {t('reportsHub.menu.showAll', { count: ranked.length })}
            </Text>
            <ChevronRight size={18} color={colors.primaryText} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </Card>

      <Card title={t('reportsHub.menu.categories')} isEmpty={m.categories.length === 0}>
        {m.categories.map((c) => (
          <Row
            key={c.name || 'other'}
            title={c.name ? name(c) : t('reportsHub.menu.noCategory')}
            sub={`${t('reportsHub.qty', { count: c.qty })} · ${pct(c.totalEtb, catTotal)}%`}
            value={etb(c.totalEtb)}
            parts={[{ share: pct(c.totalEtb, catTotal), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.menu.slow')} isEmpty={m.slow.length === 0}>
        {m.slow.map((i, n) => (
          <Row
            key={`${i.name}-${n}`}
            title={name(i)}
            sub={i.qty === 0 ? undefined : etb(i.totalEtb)}
            value={
              i.qty === 0 ? t('reportsHub.menu.notSold') : t('reportsHub.qty', { count: i.qty })
            }
            parts={[{ share: pct(i.qty, Math.max(maxSlow, 1) * 4), color: colors.primary }]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.menu.cancelled')} isEmpty={m.cancelled.orders === 0}>
        <View className="flex-row gap-2.5">
          <StatBox
            label={t('reportsHub.menu.cancelledLabel')}
            value={t('reportsHub.ordersCount', { count: m.cancelled.orders })}
            tone="bad"
          />
          <StatBox
            label={t('reportsHub.menu.moneyLost')}
            value={etb(m.cancelled.totalEtb)}
            tone="bad"
          />
        </View>
        <Text font="bold" className="text-sm">
          {t('reportsHub.menu.mostCancelled')}
        </Text>
        {m.cancelled.items.slice(0, 5).map((i) => (
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
        {m.cancelled.list.map((o) => (
          <View key={o.number} className="border-t border-divider pt-2.5">
            <Row
              title={`${t('reportsHub.menu.order', { number: o.number })} · ${etb(o.totalEtb)}`}
              sub={[o.by, o.reason].filter(Boolean).join(' · ')}
              value=""
            />
          </View>
        ))}
      </Card>
    </>
  );
}

function ExpensesTab({
  r,
  t,
  go,
}: {
  r: RestaurantReport;
  t: TFunction;
  go: (path: '/money-flow' | '/money-out') => void;
}) {
  const e = r.expenses;
  const maxBought = maxOf(e.bought.map((b) => b.totalEtb));
  const maxPerson = maxOf(e.byPerson.map((p) => p.totalEtb));
  return (
    <>
      <Hero label={t('reportsHub.expenses.total')} amount={e.totalEtb}>
        <Pressable
          onPress={() => go('/money-flow')}
          accessibilityRole="button"
          className="mt-3 min-h-12 flex-row items-center rounded-[14px] bg-white/15 px-3.5 active:opacity-80"
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
            sub={`${t('reportsHub.expensesCount', { count: k.count })} · ${pct(k.totalEtb, e.totalEtb)}%`}
            value={etb(k.totalEtb)}
            parts={[{ share: pct(k.totalEtb, e.totalEtb), color: colors.primary }]}
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
        isEmpty={e.bought.length === 0}
      >
        {e.bought.map((b) => (
          <Row
            key={b.name}
            title={b.name}
            sub={t('reportsHub.timesCount', { count: b.times })}
            value={etb(b.totalEtb)}
            parts={[{ share: pct(b.totalEtb, maxBought), color: colors.primary }]}
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
        isEmpty={e.byPerson.length === 0 && e.changed === 0 && e.deleted.length === 0}
      >
        {e.byPerson.map((p) => (
          <Row
            key={p.name}
            title={p.name}
            sub={t('reportsHub.expenses.split', {
              count: p.count,
              cash: formatMoney(p.cashEtb, false),
              bank: formatMoney(p.bankEtb, false),
            })}
            value={etb(p.totalEtb)}
            parts={[
              { share: pct(p.cashEtb, maxPerson), color: colors.primary },
              { share: pct(p.bankEtb, maxPerson), color: colors.amber },
            ]}
            onPress={() => go('/money-out')}
          />
        ))}
        {e.changed > 0 ? (
          <Pressable
            onPress={() => go('/money-out')}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center gap-3 border-t border-divider pt-2.5"
          >
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primarySoft">
              <Pencil size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text font="bold" className="flex-1 text-[15px]">
              {t('reportsHub.expenses.changed', { count: e.changed })}
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
                {t('reportsHub.expenses.deletedLine', { title: d.title, amount: etb(d.amountEtb) })}
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

function OkBad({ ok, bad, t }: { ok: number; bad: number; t: TFunction }) {
  return (
    <Text font="bold" className="text-[15px]">
      {t('reportsHub.staff.ok', { count: ok })}
      {bad > 0 ? (
        <Text font="bold" className="text-[15px]" style={{ color: colors.alert }}>
          {` · ${t('reportsHub.staff.failed', { count: bad })}`}
        </Text>
      ) : null}
    </Text>
  );
}

function StaffTab({ r, t }: { r: RestaurantReport; t: TFunction }) {
  const s = r.staff;
  const maxSales = maxOf(s.waiters.map((w) => w.salesEtb));
  const maxTips = maxOf(s.tips.map((x) => x.totalEtb));
  const maxDish = maxOf(s.kitchen.slowest.map((d) => d.averageMinutes));
  const checkParts = (ok: number, bad: number) => [
    { share: pct(ok, ok + bad), color: colors.success },
    { share: pct(bad, ok + bad), color: colors.alert },
  ];
  return (
    <>
      <Card title={t('reportsHub.staff.waiters')} isEmpty={s.waiters.length === 0}>
        {s.waiters.map((w, n) => (
          <Row
            key={w.name}
            rank={n + 1}
            title={w.name}
            sub={`${t('reportsHub.billsCount', { count: w.bills })} · ${t('reportsHub.staff.avg', {
              amount: formatMoney(w.averageEtb, false),
            })}`}
            value={etb(w.salesEtb)}
            parts={[{ share: pct(w.salesEtb, maxSales), color: colors.primary }]}
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
              paid: formatMoney(x.paidOutEtb, false),
              left: formatMoney(x.totalEtb - x.paidOutEtb, false),
            })}
            value={etb(x.totalEtb)}
            parts={[
              { share: pct(x.paidOutEtb, maxTips), color: colors.primary },
              { share: pct(x.totalEtb - x.paidOutEtb, maxTips), color: colors.amber },
            ]}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.staff.checks')} isEmpty={s.checks.ok + s.checks.bad === 0}>
        <View className="flex-row gap-2.5">
          <StatBox label={t('reportsHub.staff.verified')} value={String(s.checks.ok)} tone="good" />
          <StatBox
            label={t('reportsHub.staff.failedOrSuspicious')}
            value={String(s.checks.bad)}
            tone="bad"
          />
        </View>
        <Text font="bold" className="text-sm">
          {t('reportsHub.staff.byBank')}
        </Text>
        {s.checks.byBank.map((b) => (
          <Row
            key={b.bank}
            title={t(`banks.${b.bank}`, { defaultValue: b.bank })}
            value={<OkBad ok={b.ok} bad={b.bad} t={t} />}
            parts={checkParts(b.ok, b.bad)}
          />
        ))}
        <Text font="bold" className="text-sm">
          {t('reportsHub.staff.byStaff')}
        </Text>
        {s.checks.byPerson.map((p) => (
          <Row
            key={p.name}
            title={p.name}
            value={<OkBad ok={p.ok} bad={p.bad} t={t} />}
            parts={checkParts(p.ok, p.bad)}
          />
        ))}
      </Card>

      <Card title={t('reportsHub.staff.kitchen')} isEmpty={s.kitchen.orders === 0}>
        <View className="flex-row gap-2.5">
          <StatBox
            label={t('reportsHub.staff.onAverage')}
            value={t('reportsHub.staff.min', { minutes: s.kitchen.averageMinutes })}
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
            value={t('reportsHub.staff.min', { minutes: d.averageMinutes })}
            parts={[
              {
                share: pct(d.averageMinutes, maxDish),
                // Slower than the kitchen's average shows red.
                color: d.averageMinutes > s.kitchen.averageMinutes ? colors.alert : colors.primary,
              },
            ]}
          />
        ))}
      </Card>
    </>
  );
}

/** The open tab as a table for PDF / CSV. */
function exportTable(t: TFunction, tab: Tab, r: RestaurantReport, subtitle: string): ExportTable {
  const money = (v: number) => formatMoney(v, false);
  const qty = (count: number) => t('reportsHub.qty', { count });
  const rows: string[][] = [];
  if (tab === 'sales') {
    const s = r.sales;
    rows.push([
      t('reportsHub.sales.total'),
      t('reportsHub.billsCount', { count: s.bills }),
      money(s.totalEtb),
    ]);
    for (const m of s.methods)
      rows.push([t(methodKey(m.method)), String(m.bills), money(m.totalEtb)]);
    for (const h of s.byHour.filter((x) => x.bills > 0)) {
      const label = t('reportsHub.hour', { from: h.hour, to: (h.hour + 1) % 24 });
      rows.push([label, String(h.bills), money(h.totalEtb)]);
    }
    for (const d of s.byDay) rows.push([d.day, String(d.bills), money(d.totalEtb)]);
  } else if (tab === 'menu') {
    for (const i of r.menu.items) rows.push([i.name, qty(i.qty), money(i.totalEtb)]);
    for (const c of r.menu.categories) {
      rows.push([c.name || t('reportsHub.menu.noCategory'), qty(c.qty), money(c.totalEtb)]);
    }
    for (const o of r.menu.cancelled.list) {
      const who = [o.by, o.reason].filter(Boolean).join(' · ');
      rows.push([t('reportsHub.menu.order', { number: o.number }), who, money(o.totalEtb)]);
    }
  } else if (tab === 'expenses') {
    for (const k of r.expenses.byKind) {
      rows.push([t(`extras.money.categories.${k.kind}`), String(k.count), money(k.totalEtb)]);
    }
    for (const b of r.expenses.bought) rows.push([b.name, String(b.times), money(b.totalEtb)]);
    for (const p of r.expenses.byPerson) rows.push([p.name, String(p.count), money(p.totalEtb)]);
  } else {
    for (const w of r.staff.waiters) {
      rows.push([w.name, t('reportsHub.billsCount', { count: w.bills }), money(w.salesEtb)]);
    }
    for (const x of r.staff.tips) {
      rows.push([`${t('reportsHub.staff.tips')}: ${x.name}`, String(x.count), money(x.totalEtb)]);
    }
    for (const b of r.staff.checks.byBank) {
      const detail = `${t('reportsHub.staff.ok', { count: b.ok })} · ${t('reportsHub.staff.failed', { count: b.bad })}`;
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
 * Restaurant reports (owner, or a manager allowed to see reports): sales, food and drink,
 * expenses and buying, staff and checks — for a period or one day. The server makes every sum.
 * Design: docs/design/screens/reports-design.
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
      <View className="flex-row gap-2 px-4 pb-3" accessibilityRole="radiogroup">
        {periods.map((p) => (
          <PeriodChip
            key={p}
            label={t(`period.${p}`)}
            selected={!range.day && range.period === p}
            onPress={() => setRange({ period: p })}
          />
        ))}
      </View>

      <View className="border-y border-border bg-surface">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
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
                className={`min-h-12 justify-center border-b-[3px] px-3.5 ${
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
        <>
          <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
            {dayDate ? (
              <Text tone="muted" font="semibold" className="text-sm">
                {rangeLabel}
              </Text>
            ) : null}
            {tab === 'sales' ? <SalesTab r={report} t={t} /> : null}
            {tab === 'menu' ? (
              <MenuTab
                key={`${range.period}-${range.day ?? ''}`}
                r={report}
                t={t}
                am={i18n.language === 'am'}
              />
            ) : null}
            {tab === 'expenses' ? (
              <ExpensesTab r={report} t={t} go={(path) => router.push(path)} />
            ) : null}
            {tab === 'staff' ? <StaffTab r={report} t={t} /> : null}
          </ScrollView>
          <View className="flex-row gap-2.5 border-t border-border bg-surface px-4 py-3">
            <Pressable
              onPress={() => void download('pdf')}
              disabled={downloading}
              accessibilityRole="button"
              className={`min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-button bg-primary ${
                downloading ? 'opacity-50' : 'active:opacity-90'
              }`}
            >
              <Download size={20} color={colors.surface} strokeWidth={2.4} />
              <Text font="bold" tone="inverse" className="text-base">
                {t('report.downloadPdf')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void download('csv')}
              disabled={downloading}
              accessibilityRole="button"
              className={`min-h-14 flex-1 items-center justify-center rounded-button border-2 border-primary bg-surface ${
                downloading ? 'opacity-50' : 'active:opacity-80'
              }`}
            >
              <Text font="bold" className="text-base text-primary">
                {t('report.downloadCsv')}
              </Text>
            </Pressable>
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
