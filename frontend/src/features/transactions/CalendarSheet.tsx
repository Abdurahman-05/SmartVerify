import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { localDay, periods, type ListPeriod } from '@/lib/period';
import { useBrandColors } from '@/store/theme';
import { colors } from '@/theme/tokens';

interface CalendarSheetProps<P extends ListPeriod> {
  visible: boolean;
  period: P;
  /** Show "All" before Today (Transactions). */
  withAll?: boolean;
  /** The chosen day (YYYY-MM-DD), or null when a period is shown. */
  day: string | null;
  onPeriod: (period: P) => void;
  onDay: (day: string) => void;
  onClose: () => void;
}

/** The days of a month in weeks starting on Monday; null fills the empty places. */
function monthWeeks(year: number, month: number): (number | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** Today / 7 days / 30 days, or any one past day from a month calendar. */
/** P is Period on screens without "All", ListPeriod on Transactions (withAll). */
export function CalendarSheet<P extends ListPeriod>({
  visible,
  period,
  withAll = false,
  day,
  onPeriod,
  onDay,
  onClose,
}: CalendarSheetProps<P>) {
  const { t } = useTranslation();
  const brand = useBrandColors();
  const reducedMotion = useReducedMotion();
  const today = new Date();
  const todayKey = localDay(today);

  // The month on screen: the chosen day's month, else this month (fresh each time it opens).
  const [shown, setShown] = useState(() => {
    const base = day ? new Date(`${day}T12:00:00`) : today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const isThisMonth = shown.year === today.getFullYear() && shown.month === today.getMonth();
  const move = (by: number) => {
    const next = new Date(shown.year, shown.month + by, 1);
    setShown({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityLabel={t('verify.scan.close')}
      />
      <SafeAreaView edges={['bottom']} className="rounded-t-card bg-surface px-4 pb-3 pt-4">
        <Text font="heading" className="pb-3 text-xl" accessibilityRole="header">
          {t('period.choose')}
        </Text>

        <View className="flex-row gap-2">
          {((withAll ? ['all', ...periods] : periods) as P[]).map((p) => {
            const selected = !day && p === period;
            return (
              <Pressable
                key={p}
                onPress={() => {
                  onPeriod(p);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`min-h-12 flex-1 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-primary bg-primary' : 'border-border bg-surface'
                }`}
              >
                <Text font="semibold" className="text-base" tone={selected ? 'inverse' : undefined}>
                  {t(`period.${p}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text tone="muted" className="pb-1 pt-4 text-sm">
          {t('period.pickDay')}
        </Text>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => move(-1)}
            accessibilityRole="button"
            accessibilityLabel={t('period.prevMonth')}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-border"
          >
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text font="bold" className="text-lg">
            {t(`period.month_${shown.month}`)} {shown.year}
          </Text>
          <Pressable
            onPress={() => move(1)}
            disabled={isThisMonth}
            accessibilityRole="button"
            accessibilityLabel={t('period.nextMonth')}
            accessibilityState={{ disabled: isThisMonth }}
            className={`h-11 w-11 items-center justify-center rounded-full active:bg-border ${
              isThisMonth ? 'opacity-30' : ''
            }`}
          >
            <ChevronRight size={24} color={colors.text} />
          </Pressable>
        </View>

        <View className="flex-row pt-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Text key={i} tone="muted" font="bold" className="flex-1 text-center text-sm">
              {t(`period.weekday_${i}`)}
            </Text>
          ))}
        </View>
        {monthWeeks(shown.year, shown.month).map((week, w) => (
          <View key={w} className="flex-row">
            {week.map((n, i) => {
              if (n === null) return <View key={i} className="h-11 flex-1" />;
              const key = localDay(new Date(shown.year, shown.month, n));
              const future = key > todayKey;
              const selected = key === day;
              const isToday = key === todayKey;
              return (
                <Pressable
                  key={i}
                  disabled={future}
                  onPress={() => {
                    onDay(key);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('period.day', {
                    month: t(`period.month_${shown.month}`),
                    day: n,
                  })}
                  accessibilityState={{ selected, disabled: future }}
                  className="h-11 flex-1 items-center justify-center"
                >
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-full ${
                      selected ? 'bg-primary' : isToday ? 'border-2 border-primary' : ''
                    }`}
                  >
                    <Text
                      font={selected || isToday ? 'bold' : undefined}
                      className={`text-base ${future ? 'opacity-30' : ''}`}
                      style={
                        selected
                          ? { color: colors.surface }
                          : isToday
                            ? { color: brand.primary }
                            : undefined
                      }
                    >
                      {n}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </SafeAreaView>
    </Modal>
  );
}
