import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Screen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-2xl font-semibold text-text">chef</Text>
        <Text className="text-base text-muted mt-2">Phase 1</Text>
      </View>
    </SafeAreaView>
  );
}
