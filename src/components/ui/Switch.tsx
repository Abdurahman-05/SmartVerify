import { View, Pressable } from 'react-native';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export const Switch = ({ value, onValueChange }: SwitchProps) => {
  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <View
        className={`w-12 h-7 rounded-full flex justify-center ${value ? 'bg-primary' : 'bg-border'}`}
      >
        <View
          className={`w-6 h-6 rounded-full bg-surface ${value ? 'ml-6' : 'ml-1'}`}
        />
      </View>
    </Pressable>
  );
};
