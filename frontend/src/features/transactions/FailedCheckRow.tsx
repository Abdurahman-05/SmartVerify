import { CircleX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { MoneyText } from '@/components/ui/MoneyText';
import { Text } from '@/components/ui/Text';
import { formatDay, formatTime } from '@/lib/format';
import type { FailedCheck } from '@/lib/verification';
import { colors } from '@/theme/tokens';

/** One bank receipt check that did not verify: which bill, why, who checked, when. */
export function FailedCheckRow({ check, showDate }: { check: FailedCheck; showDate: boolean }) {
  const { t } = useTranslation();
  const when = showDate
    ? `${formatDay(check.createdAt, false)}, ${formatTime(check.createdAt)}`
    : formatTime(check.createdAt);
  const [reason] = check.reasons;
  const why = reason
    ? t(
        check.status === 'not_matching'
          ? `verifyBank.check.reasons.${reason}`
          : `verifyBank.check.unableReasons.${reason}`
      )
    : '';
  const label = check.label ?? t('history.failed.noBill');

  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${t('history.failed.tag')}, ${why}, ${check.checkedBy}, ${when}`}
      className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-border bg-surface p-3"
    >
      <View className="h-12 w-12 items-center justify-center rounded-[14px] bg-dangerBg">
        <CircleX size={24} color={colors.dangerFg} strokeWidth={2.2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text font="bold" className="text-[17px]" numberOfLines={1}>
          {label}
        </Text>
        <Text font="semibold" className="mt-0.5 text-sm text-dangerFg" numberOfLines={2}>
          {why}
        </Text>
        <Text tone="muted" className="text-sm" numberOfLines={1}>
          {check.bankCode} · {check.checkedBy} · {when}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <MoneyText value={check.expectedAmountEtb} font="bold" className="text-lg" />
        <Text font="bold" className="text-sm text-dangerFg">
          {t('history.failed.tag')}
        </Text>
      </View>
    </View>
  );
}
