import { TextInput, View, Text } from 'react-native';
import { useState } from 'react';

interface InputProps {
  placeholder?: string;
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?:
    | 'default'
    | 'number-pad'
    | 'decimal-pad'
    | 'numeric'
    | 'email-address'
    | 'phone-pad';
  editable?: boolean;
}

export const Input = ({
  placeholder,
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  editable = true,
}: InputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-2">
      {label && <Text className="text-sm font-medium text-text">{label}</Text>}
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`px-4 py-3 rounded-button text-base border ${
          focused ? 'border-primary bg-background' : 'border-border bg-surface'
        } text-text`}
        placeholderTextColor="#3B4A44"
      />
    </View>
  );
};
