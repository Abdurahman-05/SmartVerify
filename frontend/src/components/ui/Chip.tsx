import { Pressable, Text } from 'react-native';

interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
}

export const Chip = ({ label, onPress, selected = false }: ChipProps) => {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-chip px-4 py-2 ${selected ? 'bg-primary' : 'bg-surface border border-border'}`}
    >
      <Text
        className={`text-sm font-medium ${selected ? 'text-surface' : 'text-text'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
};
