import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Landmark,
  Pencil,
  ReceiptText,
  Trash2,
  TrendingUp,
} from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/components/ui/LoadingView';
import { formatMoney } from '@/components/ui/MoneyText';
import { NoConnection } from '@/components/ui/NoConnection';
import { Text } from '@/components/ui/Text';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { ApiError } from '@/lib/api/client';
import { errorMessageKey, isNetworkError } from '@/lib/errors';
import { shareCsv, sharePdf, type ExportTable } from '@/lib/export';
import { type Period } from '@/lib/period';
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
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useGlass } from '@/components/ui/glassTokens';
import { HeroCard, HeroChip } from '@/components/ui/HeroCard';
import { IconTile } from '@/components/ui/IconTile';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Segmented } from '@/components/ui/Segmented';
import { StickyFooter } from '@/components/ui/StickyFooter';
import { TopBar } from '@/components/ui/TopBar';

const tabs: ReportTab[] = ['sales', 'food', 'expenses', 'staff'];
type AnyReport = SalesReport | FoodReport | ExpensesReport | StaffReport;
const fetchers: Record<ReportTab, (days: ReportDays) => Promise<AnyReport>> = {
  sales: getSalesReport,
  food: getFoodReport,
  expenses: getExpensesReport,
  staff: getStaffReport,
};

/** Whole ETB with commas, "ብር" in Amharic. */
const money = (v: number) => formatMoney(v);
const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const maxOf = (values: number[]) => Math.max(0, ...values);

// ─── Building blocks ─────────────────────────────────────────────────────────

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
    <GlassCard style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
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
    </GlassCard>
  );
}

/** A bar of one or more coloured parts (shares of 100). */
function Track({ parts }: { parts: { share: number; color: string }[] }) {
  const brand = useBrandColors();
  return (
    <View
      className="mt-1.5 h-2 flex-row overflow-hidden rounded-full"
      style={{ backgroundColor: brand.primaryTile }}
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

/** Rank circle: number 1 in the theme colour, the others on the soft tile. */
function RankDot({ rank }: { rank: number }) {
  const g = useGlass();
  const first = rank === 1;
  return (
    <View
      className="mt-0.5 h-8 w-8 items-center justify-center rounded-full"
      style={{ backgroundColor: first ? g.primary : g.tile }}
    >
      <Text font="bold" className="text-sm" style={{ color: first ? '#FFFFFF' : g.primaryText }}>
        {rank}
      </Text>
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
      {rank ? <RankDot rank={rank} /> : null}
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

/** The theme-gradient hero card at the top of a tab. */
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
    <HeroCard>
      <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
        {label}
      </Text>
      <View className="flex-row items-end gap-2">
        <Text
          font="heading"
          tone="inverse"
          className="text-[34px] leading-[42px]"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(amount, false)}
        </Text>
        <Text font="heading" tone="inverse" className="pb-1.5 text-base">
          {t('common.etb')}
        </Text>
      </View>
      {children}
    </HeroCard>
  );
}

function HeroBox({ label, value }: { label: string; value: string }) {
  return (
    <HeroChip style={{ flex: 1 }}>
      <Text font="semibold" tone="inverse" className="text-[13px] opacity-90">
        {label}
      </Text>
      <Text font="heading" tone="inverse" className="text-[17px]">
        {value}
      </Text>
    </HeroChip>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

const PEAK = '#FDE047';
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Hourly bars inside the hero: white by value, the busiest hour yellow with its total above. */
function HourChart({ s }: { s: SalesReport }) {
  const active = s.byHour.filter((h) => h.bills > 0);
  if (active.length === 0) return null;
  const first = active[0].hour;
  const last = active[active.length - 1].hour;
  const chart = s.byHour.filter((h) => h.hour >= first && h.hour <= last);
  const max = maxOf(chart.map((h) => h.amount));
  const peakIndex = chart.findIndex((h) => h.amount === max);
  const peak = chart[peakIndex];
  const n = chart.length;
  const middle = chart[Math.floor((n - 1) / 2)];
  return (
    <View
      className="mt-3"
      accessible
      accessibilityLabel={`${hh(peak.hour)} · ${formatMoney(peak.amount, false)}`}
    >
      <View className="h-7">
        <View
          className="absolute items-center"
          style={{ left: `${(peakIndex / n) * 100}%`, width: `${100 / n}%` }}
        >
          <View className="rounded-[12px] bg-white px-2.5 py-0.5" style={{ minWidth: 96 }}>
            <Text font="bold" className="text-center text-[13px]" style={{ color: colors.text }}>
              {`${hh(peak.hour)} · ${formatMoney(peak.amount, false)}`}
            </Text>
          </View>
        </View>
      </View>
      <View className="h-[116px] flex-row items-end gap-1.5">
        {chart.map((h, i) => (
          <View key={h.hour} className="h-full flex-1 justify-end">
            <View
              className="w-full rounded-[8px]"
              style={{
                height: `${Math.max(pct(h.amount, max), h.bills ? 8 : 2)}%`,
                backgroundColor:
                  i === peakIndex ? PEAK : `rgba(255,255,255,${0.35 + 0.55 * (h.amount / max)})`,
              }}
            />
          </View>
        ))}
      </View>
      <View className="mt-2 flex-row justify-between">
        {[first, middle.hour, last].map((h, i) => (
          <Text key={i} tone="inverse" className="text-[13px] opacity-80">
            {hh(h)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Small glass card: icon tile, value, label (Bank, Cash, Orders, Busiest). */
function MiniStat({
  icon,
  tone,
  value,
  label,
}: {
  icon: typeof Landmark;
  tone: 'brand' | 'green' | 'amber' | 'red';
  value: string;
  label: string;
}) {
  return (
    <GlassCard
      containerStyle={{ flex: 1 }}
      style={{ alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, gap: 4 }}
    >
      <IconTile icon={icon} tone={tone} size={36} radius={12} iconSize={18} />
      <Text font="heading" className="text-base" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="text-[13px]" style={{ color: colors.muted }} numberOfLines={1}>
        {label}
      </Text>
    </GlassCard>
  );
}

/** One top seller: rank, name and amount, then a theme bar and how many sold. */
function TopSeller({
  rank,
  name,
  amount,
  qty,
  share,
  t,
  first,
}: {
  rank: number;
  name: string;
  amount: number;
  qty: number;
  share: number;
  t: TFunction;
  first: boolean;
}) {
  const g = useGlass();
  return (
    <View
      accessible
      className={`flex-row items-center gap-3 py-3 ${first ? '' : 'border-t border-black/[0.07]'}`}
    >
      <RankDot rank={rank} />
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Text font="bold" className="flex-1 text-base" numberOfLines={1}>
            {name}
          </Text>
          <Text font="heading" className="text-base">
            {formatMoney(amount, false)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: g.tile }}
          >
            <View
              className="h-2 rounded-full"
              style={{ width: `${Math.max(share, 3)}%`, backgroundColor: g.primary }}
            />
          </View>
          <Text className="text-[13px]" style={{ color: colors.muted }}>
            {t('reportsHub.qty', { count: qty })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SalesTab({
  s,
  t,
  showDays,
  days,
  am,
}: {
  s: SalesReport;
  t: TFunction;
  showDays: boolean;
  days: ReportDays;
  am: boolean;
}) {
  const brand = useBrandColors();
  // Top sellers come from the food report for the same days.
  const food = useQuery({
    queryKey: reportKey('food', days),
    queryFn: () => getFoodReport(days),
  });
  const change =
    s.previousTotal > 0 ? Math.round(((s.total - s.previousTotal) / s.previousTotal) * 100) : null;
  const busiest = [...s.byHour].filter((h) => h.bills > 0).sort((a, b) => b.amount - a.amount)[0];
  const maxDay = maxOf(s.byDay.map((d) => d.amount));
  const top = (food.data?.bestSellers ?? []).slice(0, 3);
  const maxTop = maxOf(top.map((i) => i.amount));
  const both = s.paidBy.both;

  return (
    <>
      <HeroCard>
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1" accessible>
            <Text font="bold" tone="inverse" className="text-[13px] uppercase opacity-90">
              {t('reportsHub.sales.total')}
            </Text>
            <Text
              font="heading"
              tone="inverse"
              className="text-[34px] leading-[42px]"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatMoney(s.total, false)}{' '}
              <Text font="heading" tone="inverse" className="text-base">
                {t('common.etb')}
              </Text>
            </Text>
          </View>
          {change === null ? null : (
            <HeroChip
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 }}
            >
              <TrendingUp size={15} color="#FFFFFF" strokeWidth={2.4} />
              <Text font="bold" tone="inverse" className="text-[13px]">
                {t('reportsHub.sales.vsBefore', {
                  change: `${change >= 0 ? '+' : '−'}${Math.abs(change)}`,
                })}
              </Text>
            </HeroChip>
          )}
        </View>
        <HourChart s={s} />
      </HeroCard>

      <View className="flex-row gap-2">
        <MiniStat
          icon={Landmark}
          tone="brand"
          value={formatMoney(s.paidBy.bank.amount, false)}
          label={t('reportsHub.bank')}
        />
        <MiniStat
          icon={Banknote}
          tone="green"
          value={formatMoney(s.paidBy.cash.amount, false)}
          label={t('reportsHub.cash')}
        />
        <MiniStat
          icon={ReceiptText}
          tone="red"
          value={String(s.bills)}
          label={t('reportsHub.sales.bills')}
        />
        <MiniStat
          icon={Clock}
          tone="amber"
          value={busiest ? hh(busiest.hour) : '—'}
          label={t('reportsHub.sales.busiest')}
        />
      </View>
      {both.bills > 0 ? (
        <Text className="-mt-1 px-1 text-[13px]" style={{ color: colors.muted }}>
          {`${t('reportsHub.cashBank')}: ${money(both.amount)} · ${t('reportsHub.billsCount', { count: both.bills })}`}
        </Text>
      ) : null}

      <View className="flex-row items-center justify-between">
        <Text font="bold" className="text-base" accessibilityRole="header">
          {t('reportsHub.sales.topSellers')}
        </Text>
        <Text className="text-sm" style={{ color: colors.muted }}>
          {t('reportsHub.sales.avgBill', { amount: money(s.avgBill) })}
        </Text>
      </View>
      <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 2 }}>
        {top.length === 0 ? (
          <Text tone="muted" className="py-3 text-[15px]">
            {food.isPending ? '…' : t('reportsHub.empty')}
          </Text>
        ) : (
          top.map((i, n) => (
            <TopSeller
              key={`${i.name}-${n}`}
              rank={n + 1}
              name={am && i.nameAm ? i.nameAm : i.name}
              amount={i.amount}
              qty={i.qty}
              share={pct(i.amount, maxTop)}
              t={t}
              first={n === 0}
            />
          ))
        )}
      </GlassCard>

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
                parts={[{ share: pct(d.amount, maxDay), color: brand.primary }]}
              />
            );
          })}
        </Card>
      ) : null}
    </>
  );
}

function FoodTab({ f, t, am }: { f: FoodReport; t: TFunction; am: boolean }) {
  const brand = useBrandColors();
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
            parts={[{ share: pct(i.qty, maxQty), color: brand.primary }]}
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
            <ChevronRight size={18} color={brand.primaryText} strokeWidth={2.4} />
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
            parts={[{ share: pct(c.amount, catTotal), color: brand.primary }]}
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
            parts={[{ share: pct(i.qty, Math.max(maxSlow, 1) * 4), color: brand.primary }]}
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
  const brand = useBrandColors();
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
            parts={[{ share: pct(k.amount, e.total), color: brand.primary }]}
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
            parts={[{ share: pct(b.amount, maxBought), color: brand.primary }]}
          />
        ))}
      </Card>

      <Card
        title={t('reportsHub.expenses.byPerson')}
        hint={
          <Legend
            items={[
              { label: t('reportsHub.cash'), color: brand.primary },
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
              { share: pct(p.cash, maxPerson), color: brand.primary },
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
              <Pencil size={18} color={brand.primary} strokeWidth={2.2} />
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
  const brand = useBrandColors();
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
            parts={[{ share: pct(w.sales, maxSales), color: brand.primary }]}
          />
        ))}
      </Card>

      <Card
        title={t('reportsHub.staff.tips')}
        hint={
          <Legend
            items={[
              { label: t('reportsHub.staff.paidOutLegend'), color: brand.primary },
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
              { share: pct(x.paidOut, maxTips), color: brand.primary },
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
                color: d.minutes > s.kitchen.avgMinutes ? colors.alert : brand.primary,
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
  // A waiter (only with the owner's permission) sees their own bills: no Expenses tab, and
  // Staff becomes "My work". The server counts their bills only either way.
  const ownOnly = useSession((s) => s.user?.role === 'waiter');
  const shownTabs = ownOnly ? tabs.filter((x) => x !== 'expenses') : tabs;
  const tabLabel = (x: ReportTab) =>
    ownOnly && x === 'staff' ? t('reportsHub.tabs.myWork') : t(`reportsHub.tabs.${x}`);
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
    } catch (error) {
      // While testing (Expo Go), show why; the APK shows only the friendly text.
      const reason = error instanceof Error ? error.message : JSON.stringify(error);
      const why = __DEV__ ? `\n\n${reason}` : '';
      if (__DEV__) console.warn('report download failed', error);
      Alert.alert(t('common.error'), `${t('transactions.downloadFailed')}${why}`);
    } finally {
      setDownloading(false);
    }
  };

  if (query.isError && !query.data && isNetworkError(query.error)) {
    return <NoConnection onRetry={() => void refetch()} />;
  }
  const forbidden = query.error instanceof ApiError && query.error.code === 'FORBIDDEN';

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pb-3 pt-2">
          <TopBar
            title={t('reportsHub.title')}
            subtitle={rangeLabel}
            left={{ icon: ChevronLeft, onPress: goBack, label: t('common.back') }}
            right={{
              icon: CalendarDays,
              onPress: () => setChoosing(true),
              label: t('period.choose'),
            }}
          />
        </View>
        <View className="px-4 pb-2">
          <Segmented<ReportTab>
            options={shownTabs.map((x) => ({ value: x, label: tabLabel(x) }))}
            value={tab}
            onChange={setTab}
          />
        </View>
        {ownOnly ? (
          <Text tone="muted" className="px-4 pt-1 text-sm">
            {t('reportsHub.ownOnly')}
          </Text>
        ) : null}

        {query.isPending ? (
          <LoadingView />
        ) : !report ? (
          <Text tone="muted" className="px-6 pt-6 text-center text-lg">
            {forbidden ? t('extras.flow.notAllowed') : t(errorMessageKey(query.error))}
          </Text>
        ) : (
          <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 110 }}>
            {tab === 'sales' ? (
              <SalesTab
                s={report as SalesReport}
                t={t}
                showDays={!day && period !== 'today'}
                days={days}
                am={i18n.language === 'am'}
              />
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

        {report ? (
          <StickyFooter>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <PrimaryButton
                  label={t('reportsHub.exportPdf')}
                  icon={Download}
                  loading={downloading}
                  onPress={() => void download('pdf')}
                />
              </View>
              <View style={{ width: 120 }}>
                <GhostButton
                  label={t('reportsHub.csv')}
                  icon={Download}
                  onPress={() => {
                    if (!downloading) void download('csv');
                  }}
                />
              </View>
            </View>
          </StickyFooter>
        ) : null}

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
    </ScreenBackground>
  );
}
