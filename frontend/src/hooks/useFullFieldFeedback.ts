import { Vibration } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from './useReducedMotion';

const STEP_MS = 45;

/**
 * Telegram-style "this field is full": typing past the limit gives a short vibration and a small
 * shake. Wrap the input in an Animated.View with `style`, and pass the typed text through `limit`.
 */
export function useFullFieldFeedback(maxDigits: number) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  const notify = () => {
    Vibration.vibrate(40);
    if (reducedMotion) return;
    offset.set(
      withSequence(
        withTiming(-8, { duration: STEP_MS }),
        withTiming(8, { duration: STEP_MS }),
        withTiming(-5, { duration: STEP_MS }),
        withTiming(5, { duration: STEP_MS }),
        withTiming(0, { duration: STEP_MS })
      )
    );
  };

  /** Digits of `text`, capped at maxDigits. Notifies when a digit is typed into a full field. */
  const limit = (text: string, current: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length > maxDigits && current.length >= maxDigits) notify();
    return digits.slice(0, maxDigits);
  };

  return { style, limit };
}
