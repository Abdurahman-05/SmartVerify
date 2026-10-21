import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

/** The Smart Verify team's admin: web only (a computer's browser), never in the phone app. */
export default function AdminLayout() {
  const { t } = useTranslation();
  if (Platform.OS !== 'web') {
    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <Text font="semibold" className="text-center text-lg">
          {t('platformAdmin.webOnly')}
        </Text>
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
