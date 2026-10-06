import { Bike, Clock, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { BillType } from '@/features/bills/types';
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

export const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

const typeIcon: Record<BillType, LucideIcon> = {
  dine: UtensilsCrossed,
  takeaway: ShoppingBag,
  delivery: Bike,
};

export function TypeTile({ type }: { type: BillType }) {
  const Icon = typeIcon[type];
  return (
    <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-primary">
      <Icon size={24} color={colors.surface} strokeWidth={2.2} />
    </View>
  );
}

export function WaitTag({ minutes }: { minutes: number }) {
  const { t } = useTranslation();
  const late = minutes > LATE_AFTER_MIN;
  const fg = late ? colors.dangerFg : colors.warnFg;
  return (
    <View
      accessible
      accessibilityLabel={t('kitchen.waitingLabel', { count: minutes })}
      className={`flex-row items-center gap-1 rounded-[14px] py-[3px] pl-2 pr-2.5 ${late ? 'bg-dangerBg' : 'bg-warnBg'}`}
    >
      <Clock size={14} color={fg} strokeWidth={2.6} />
      <Text font="bold" className="text-sm" style={{ color: fg }}>
        {t('kitchen.minutes', { count: minutes })}
      </Text>
    </View>
  );
}

export function NoteChips({ notes }: { notes: string[] }) {
  const { t } = useTranslation();
  if (notes.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {notes.map((note) => (
        <View key={note} className="rounded-[14px] bg-amber px-3 py-1">
          <Text font="bold" className="text-[15px]">
            {t(`orders.note.${note}`, { defaultValue: note })}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Second line under the order label, per order type. */
export function useOrderSubtitle() {
  const { t } = useTranslation();
  return (order: KitchenOrder) => {
    const waiter = t('kitchen.waiter', { name: order.waiterName });
    if (order.type === 'delivery' && order.area) return `${order.area} · ${waiter}`;
    if (order.type === 'takeaway' && order.customerName) return t('kitchen.forCustomer', { name: order.customerName });
    return waiter;
  };
}
