import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center items-center">
        <Text className="text-3xl font-bold text-primary">Smart Verify</Text>
        <Text className="text-base text-muted mt-2">Splash Screen - Phase 1</Text>
      </View>
    </SafeAreaView>
  );
}
