import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { ScreenBg } from '@/ui/glass';

interface FormScreenProps {
  children: ReactNode;
  edges?: Edge[];
  /** No background of its own (the screen is wrapped in one, e.g. AuthBackground). */
  plain?: boolean;
}

/** Full-height scrolling screen that keeps inputs visible above the keyboard. */
export function FormScreen({ children, edges, plain = false }: FormScreenProps) {
  const body = (
    <SafeAreaView edges={edges} className="flex-1">
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
  return plain ? <View className="flex-1">{body}</View> : <ScreenBg>{body}</ScreenBg>;
}
