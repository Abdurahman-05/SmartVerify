import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export const Card = ({ children, className, ...props }: CardProps) => {
  return (
    <View
      className={`bg-surface rounded-card border border-border p-4 ${className || ''}`}
      {...props}
    >
      {children}
    </View>
  );
};
