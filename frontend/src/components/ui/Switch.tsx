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
      <View
        className={`h-7 w-12 justify-center rounded-full ${value ? 'bg-primary' : 'bg-[#C9C0C4]'}`}
      >
        <View
          className={`h-[22px] w-[22px] rounded-full bg-surface ${value ? 'ml-[23px]' : 'ml-[3px]'}`}
        />
      </View>
    </Pressable>
  );
};
