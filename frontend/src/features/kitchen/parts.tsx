import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useGlass } from '@/components/ui/glassTokens';
import { colors } from '@/theme/tokens';

import type { KitchenOrder } from './types';

const LATE_AFTER_MIN = 10;

/** Current time, refreshed every 30 seconds so waiting minutes stay fresh. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const isLate = (minutes: number) => minutes > LATE_AFTER_MIN;

export const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

/** Deep badge: TABLE 12, or TAKEAWAY / DELIVERY with the order number. */
export function OrderBadge({
  order,
  size = 64,
  soft,
}: {
  order: KitchenOrder;
  size?: number;
  /** See-through white, for use inside a HeroCard. */
  soft?: boolean;
}) {
  const { t } = useTranslation();
  const g = useGlass();
  const digits = /\d+/.exec(order.label)?.[0];
  const number = order.type === 'dine' && digits ? digits : `#${order.orderNo}`;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center rounded-[18px] px-1"
      style={{
        minWidth: size,
        height: size,
        backgroundColor: soft ? 'rgba(255,255,255,0.2)' : g.primaryDeep,
      }}
    >
      <Text font="bold" tone="inverse" className="text-[10px] uppercase" numberOfLines={1}>
        {t(`kitchen.badge.${order.type}`)}
      </Text>
      <Text font="heading" tone="inverse" className="text-2xl leading-7" numberOfLines={1}>
        {number}
      </Text>
    </View>
  );
}

/** Quantity badge in the deep theme colour. */
export function QtyBadge({ qty, big }: { qty: number; big?: boolean }) {
  const g = useGlass();
  return (
    <View
      className={`items-center justify-center rounded-[12px] px-1 ${big ? 'h-[46px] min-w-[46px]' : 'h-[34px] min-w-[34px]'}`}
      style={{ backgroundColor: g.primaryDeep }}
    >
      <Text font="heading" tone="inverse" className={big ? 'text-xl' : 'text-base'}>
        {qty}
      </Text>
    </View>
  );
}

export function WaitTag({ minutes }: { minutes: number }) {
  const { t } = useTranslation();
  const late = isLate(minutes);
  const fg = late ? colors.dangerFg : colors.warnFg;
  return (
    <View
      accessible
      accessibilityLabel={t('kitchen.waitingLabel', { count: minutes })}
      className={`flex-row items-center gap-1 rounded-full py-1 pl-2.5 pr-3 ${late ? 'bg-dangerBg' : 'bg-warnBg'}`}
    >
      <Clock size={14} color={fg} strokeWidth={2.6} />
      <Text font="bold" className="text-sm" style={{ color: fg }}>
        {t('kitchen.minutes', { count: minutes })}
      </Text>
    </View>
  );
}

/** Amber "Note" tag with what the waiter asked for. */
export function NoteRow({ notes }: { notes: string[] }) {
  const { t } = useTranslation();
  if (notes.length === 0) return null;
  return (
    <View
      accessible
      className="flex-row flex-wrap items-center gap-2.5 border-t border-black/[0.07] pt-2.5"
    >
      <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: colors.warnBg }}>
        <Text font="bold" className="text-sm" style={{ color: colors.warnFg }}>
          {t('kitchen.noteTag')}
        </Text>
      </View>
      <Text tone="muted" className="shrink text-base">
        {notes.map((note) => t(`orders.note.${note}`, { defaultValue: note })).join(', ')}
      </Text>
    </View>
  );
}

/** Order title per type: "Order #214 · Dine in", "For Mulu T.", the delivery area. */
export function useOrderTitle() {
  const { t } = useTranslation();
  return (order: KitchenOrder) => {
    if (order.type === 'takeaway' && order.customerName)
      return t('kitchen.forCustomer', { name: order.customerName });
    if (order.type === 'delivery' && order.area) return order.area;
    return t(`kitchen.order_${order.type}`, { number: order.orderNo });
  };
}
