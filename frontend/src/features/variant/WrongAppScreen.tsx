import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { signOut as signOutRequest } from '@/lib/auth';
import { isNormalApp } from '@/lib/variant';
import { useSession } from '@/store/session';

/** A business signed in to the other app: send them to their own app. */
export function WrongAppScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const leave = async () => {
    await signOutRequest();
    useSession.getState().signOut();
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView className="flex-1 justify-center gap-4 bg-background px-6">
      <View className="items-center gap-3">
        <BrandMark size={56} />
        <Text font="heading" className="text-center text-2xl" accessibilityRole="header">
          {t(isNormalApp ? 'wrongApp.title' : 'wrongApp.shopTitle')}
        </Text>
        <Text tone="muted" className="text-center text-base">
          {t(isNormalApp ? 'wrongApp.body' : 'wrongApp.shopBody')}
        </Text>
      </View>
      <Button label={t('wrongApp.signOut')} variant="outline" onPress={() => void leave()} />
    </SafeAreaView>
  );
}
