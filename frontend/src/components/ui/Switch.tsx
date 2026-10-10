import { Pressable, View } from 'react-native';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
}

export const Switch = ({ value, onValueChange, accessibilityLabel }: SwitchProps) => {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <View className={`h-8 w-14 justify-center rounded-full ${value ? 'bg-primary' : 'bg-borderStrong'}`}>
        <View className={`h-6 w-6 rounded-full bg-surface ${value ? 'ml-[26px]' : 'ml-1'}`} />
      </View>
    </Pressable>
  );
};
