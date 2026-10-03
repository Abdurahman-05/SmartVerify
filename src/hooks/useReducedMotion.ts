import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduced(enabled ?? false))
      .catch(() => setReduced(false));
  }, []);

  return reduced;
};
