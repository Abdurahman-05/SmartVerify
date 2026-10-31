import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

/** The Normal plan's worker limit was reached (adding one, or turning one back on). */
export const isStaffLimit = (error: unknown) =>
  error instanceof ApiError && error.code === 'STAFF_LIMIT';

/**
 * Instead of a plain error: explains the Normal plan's limit and offers Normal Multi (any number of
 * workers). The owner goes straight to paying for it; a manager sees the plans.
 */
export function StaffLimitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isOwner = useSession((s) => s.user?.role === 'owner');

  const upgrade = () => {
    onClose();
    if (isOwner) {
      router.push({
        pathname: '/subscription-pay',
        params: { plan: 'normal_multi', period: 'monthly' },
      });
    } else {
      router.push('/subscription');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="flex-row items-center gap-3.5">
        <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-tipBg">
          <Users size={30} color={colors.warnFg} strokeWidth={2.2} />
        </View>
        <View className="flex-1">
          <Text font="heading" className="text-[22px] leading-tight" accessibilityRole="header">
            {t('staff.limit.title')}
          </Text>
          <Text tone="muted" className="mt-0.5 text-base">
            {t('staff.limit.body')}
          </Text>
        </View>
      </View>
      <Button label={t('staff.limit.upgrade')} icon={Users} onPress={upgrade} />
      <Button label={t('staff.limit.notNow')} variant="secondary" size="md" onPress={onClose} />
    </BottomSheet>
  );
}
