import { Check, Clock, Copy, X, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { TransactionStatus } from '@/lib/api/transactions';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

const config: Record<TransactionStatus, { bg: string; fg: string; icon: LucideIcon }> = {
  verified: { bg: 'bg-successBg', fg: colors.successFg, icon: Check },
  pending: { bg: 'bg-warnBg', fg: colors.warnFg, icon: Clock },
  mismatch: { bg: 'bg-dangerBg', fg: colors.dangerFg, icon: X },
  duplicate: { bg: 'bg-neutralBg', fg: colors.muted, icon: Copy },
};

interface StatusPillProps {
  status: TransactionStatus;
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const { t } = useTranslation();
  const { bg, fg, icon: Icon } = config[status];

  return (
    <View className={`flex-row items-center gap-1 self-end rounded-[14px] py-[3px] pl-2 pr-2.5 ${bg}`}>
      <Icon size={14} color={fg} strokeWidth={2.6} />
      <Text font="bold" className="text-sm" style={{ color: fg }}>
        {label ?? t(`status.${status}`)}
      </Text>
    </View>
  );
}
