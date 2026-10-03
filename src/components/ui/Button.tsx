import { Pressable, Text } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type ButtonVariant = 'primary' | 'outline' | 'amber';

interface ButtonProps {
  onPress: () => void;
  children: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}

export const Button = ({
  onPress,
  children,
  variant = 'primary',
  disabled = false,
}: ButtonProps) => {
  const reducedMotion = useReducedMotion();

  const variantStyles = {
    primary: 'bg-primary',
    outline: 'bg-surface border-2 border-primary',
    amber: 'bg-amber',
  };

  const textColors = {
    primary: 'text-surface',
    outline: 'text-primary',
    amber: 'text-text',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-button min-h-primaryButton justify-center items-center px-6 ${variantStyles[variant]} ${disabled ? 'opacity-50' : ''}`}
    >
      {({ pressed }) => (
        <Text
          className={`text-base font-semibold ${textColors[variant]} ${!reducedMotion && pressed ? 'scale-95' : ''}`}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
};
