import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import TipsPanel from '@/features/tips/TipsPanel';
import { useSession } from '@/store/session';
import { ScreenBg } from '@/ui/glass';

import { ActivityPayments } from './ActivityPayments';
import { Avatar } from './Avatar';

type Part = 'payments' | 'tips';

const parts: Part[] = ['payments', 'tips'];

/** Waiter's "Activity" tab: what they verified today, and the tips they earned from bank payments. */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const name = useSession((s) => s.user?.displayName ?? '');
  const [part, setPart] = useState<Part>('payments');

  return (
    <ScreenBg>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScreenHeader
          title={t('activity.title')}
          subtitle={t('activity.subtitle', { name })}
          right={<Avatar name={name} />}
        />
        <View className="px-4 pb-3 pt-1">
          <Segmented
            options={parts.map((value) => ({ value, label: t(`activity.${value}`) }))}
            value={part}
            onChange={setPart}
          />
        </View>
        {part === 'payments' ? <ActivityPayments /> : <TipsPanel />}
      </SafeAreaView>
    </ScreenBg>
  );
}
