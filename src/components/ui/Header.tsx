import { View, Text, Pressable } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export const Header = ({ title, onBack, rightContent }: HeaderProps) => {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-surface">
      <View className="flex-row items-center flex-1">
        {onBack && (
          <Pressable onPress={onBack} className="mr-3">
            <ChevronLeft size={24} color="#0D4A36" />
          </Pressable>
        )}
        <Text className="text-lg font-semibold text-text flex-1">{title}</Text>
      </View>
      {rightContent && <View>{rightContent}</View>}
    </View>
  );
};
