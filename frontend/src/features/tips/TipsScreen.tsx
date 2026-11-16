import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Avatar } from '@/features/waiter/Avatar';
import { useSession } from '@/store/session';
import { ScreenBg } from '@/ui/glass';

import TipsPanel from './TipsPanel';

/** My tips as its own page (the waiter's Activity tab shows the same panel). */
export default function TipsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const name = useSession((s) => s.user?.displayName ?? '');
  return (
    <ScreenBg>
      <SafeAreaView className="flex-1">
        <ScreenHeader
          title={t('tips.title')}
          subtitle={t('tips.waiter', { name })}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          right={<Avatar name={name} />}
        />
        <TipsPanel />
      </SafeAreaView>
    </ScreenBg>
  );
}
