import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

interface FormScreenProps {
  children: ReactNode;
  edges?: Edge[];
}

/** Full-height scrolling screen that keeps inputs visible above the keyboard. */
export function FormScreen({ children, edges }: FormScreenProps) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
